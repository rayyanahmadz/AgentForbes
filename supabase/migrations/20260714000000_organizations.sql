-- Phase: Database — organizations & membership
-- Adds multi-tenancy: every user gets a personal organization on signup
-- (owner role), and can later be invited into others as admin/member.

create extension if not exists pgcrypto;

-- 1. Role enum -----------------------------------------------------------

create type public.org_role as enum ('owner', 'admin', 'member');

-- 2. Tables ----------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is
  'A tenant. Every user gets one personal organization automatically on signup.';

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

comment on table public.organization_members is
  'Membership + role of a user within an organization.';

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

create index if not exists organization_members_organization_id_idx
  on public.organization_members (organization_id);

-- Track which organization a user is currently working in.
alter table public.profiles
  add column if not exists default_organization_id uuid
    references public.organizations (id) on delete set null;

-- 3. updated_at trigger (reuses set_updated_at() from the profiles migration) --

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
  before update on public.organizations
  for each row
  execute function public.set_updated_at();

-- 4. Membership helper functions (used by RLS policies below) --------------

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- 5. Row Level Security ------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "Members can view their organizations"
  on public.organizations
  for select
  using (public.is_org_member(id));

create policy "Admins can update their organization"
  on public.organizations
  for update
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- No general insert/delete policy: organizations are created only via the
-- handle_new_user() trigger (personal org) or a dedicated "create org" RPC
-- added in a later phase.

create policy "Members can view fellow members of their organizations"
  on public.organization_members
  for select
  using (public.is_org_member(organization_id));

create policy "Admins can change member roles"
  on public.organization_members
  for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "Admins can remove members"
  on public.organization_members
  for delete
  using (public.is_org_admin(organization_id));

-- No general insert policy yet: joining an org (invites) is a later phase.
-- The personal-org owner membership is inserted by handle_new_user() below,
-- which runs as security definer and bypasses RLS.

-- 6. Extend signup to create a personal organization ------------------------

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
begin
  -- Profile row (unchanged from the auth migration)
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );

  -- Personal organization, named after the user
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

  update public.profiles
  set default_organization_id = new_org_id
  where id = new.id;

  return new;
end;
$$;
-- Trigger already exists from the auth migration (on_auth_user_created) and
-- points at this function by name, so no need to recreate it here.
