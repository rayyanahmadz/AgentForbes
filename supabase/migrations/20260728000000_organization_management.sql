-- Phase: Organization Management
-- Inviting teammates and managing member roles — deliberately deferred all
-- the way back in the Database phase (Phase 3) and again in Dashboard
-- (Phase 5), both of which needed a new RLS policy on profiles to let
-- members see their teammates' names, but decided that was real scope
-- belonging to this phase rather than something to half-build early.

-- 0. Extend the Notifications phase's type check constraint -----------------
-- invite-member (below) notifies an existing user immediately when they're
-- added to an organization — a new notification type this constraint
-- didn't originally allow for.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (
    type in (
      'low_credits',
      'workflow_run_completed',
      'workflow_run_failed',
      'marketplace_install',
      'bank_transfer_submitted',
      'added_to_organization'
    )
  );

-- 1. Let org members see each other's profiles ------------------------------
-- Every table so far follows "readable only within your own org" — this
-- extends that same idea to profiles, which previously only allowed reading
-- your OWN row. Needed for any member list / "who's on this team" UI.

create policy "Org members can view fellow members' profiles"
  on public.profiles
  for select
  using (
    exists (
      select 1
      from public.organization_members mine
      join public.organization_members theirs
        on theirs.organization_id = mine.organization_id
      where mine.user_id = auth.uid()
        and theirs.user_id = public.profiles.id
    )
  );

-- 2. Pending invitations -----------------------------------------------------
-- Only needed for genuinely new users (no account yet), who get a real
-- Supabase Auth invite email and are joined automatically via
-- handle_new_user() below when they complete signup. A person who already
-- has an account is added to the organization immediately by the
-- invite-member Edge Function — there is no "pending" state or accept
-- screen for that case, so this table only ever holds the new-user case.

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.org_role not null default 'member',
  invited_by uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (organization_id, email, status)
);

comment on table public.organization_invitations is
  'Pending email invitations for people who do not have an account yet. '
  'Resolved automatically by handle_new_user() when they sign up.';

alter table public.organization_invitations enable row level security;

create policy "Admins can view their organization's invitations"
  on public.organization_invitations
  for select
  using (public.is_org_admin(organization_id));

create policy "Admins can revoke their organization's invitations"
  on public.organization_invitations
  for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- No insert policy: rows are only ever created by the invite-member Edge
-- Function, which uses the service-role client and does its own
-- is_org_admin() check before writing.

-- 3. Extend signup to also claim any pending invitations --------------------
-- handle_new_user() already creates the profile and personal organization
-- (from the Authentication and Database phases). It now also checks for
-- pending invitations matching the new user's email and joins them to those
-- organizations too, with the role they were invited as.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  base_slug text;
  final_slug text;
  invitation record;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');

  base_slug := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9]+', '-', 'g'));
  final_slug := base_slug || '-' || substr(md5(random()::text), 1, 6);

  insert into public.organizations (name, slug, owner_id)
  values (
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)) || '''s Organization',
    final_slug,
    new.id
  )
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  update public.profiles set default_organization_id = new_org_id where id = new.id;

  -- Claim any pending invitations sent to this email address.
  for invitation in
    select * from public.organization_invitations
    where email = new.email and status = 'pending'
  loop
    insert into public.organization_members (organization_id, user_id, role)
    values (invitation.organization_id, new.id, invitation.role)
    on conflict (organization_id, user_id) do nothing;

    update public.organization_invitations
    set status = 'accepted', accepted_at = now()
    where id = invitation.id;
  end loop;

  return new;
end;
$$;

-- 4. Protect the organization's founding owner -------------------------------
-- organization_members already has admin-only update/delete RLS policies
-- (from the Database phase) — this adds a hard guarantee UNDERNEATH that:
-- no admin, however the request got authorized, can demote or remove the
-- row belonging to organizations.owner_id. Transferring ownership or an
-- owner leaving their own organization stays out of scope for this phase.

create or replace function public.prevent_owner_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_owner_id uuid;
  target_user_id uuid;
begin
  target_user_id := coalesce(new.user_id, old.user_id);

  select owner_id into org_owner_id
  from public.organizations
  where id = coalesce(new.organization_id, old.organization_id);

  if org_owner_id = target_user_id then
    raise exception 'Cannot change or remove the organization owner''s membership.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists guard_owner_membership on public.organization_members;
create trigger guard_owner_membership
  before update or delete on public.organization_members
  for each row
  execute function public.prevent_owner_membership_change();
