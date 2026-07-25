-- Phase: Notifications
-- A per-user inbox, not an org-shared resource like almost everything else
-- in this schema — a notification belongs to the one person it's for, so
-- RLS here is "your own rows only" rather than the is_org_member() pattern
-- used everywhere else. Worth calling out explicitly, the same way the
-- Marketplace phase called out its own RLS deviation.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Contextual only (e.g. which org a low-balance warning is about) — NOT
  -- what gates access. Access is entirely user_id = auth.uid().
  organization_id uuid references public.organizations (id) on delete cascade,
  type text not null check (
    type in (
      'low_credits',
      'workflow_run_completed',
      'workflow_run_failed',
      'marketplace_install',
      'bank_transfer_submitted'
    )
  ),
  title text not null,
  body text,
  -- In-app relative path to send the user to when they click it, e.g.
  -- '/dashboard/wallet'. Nullable: not every notification needs one.
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Per-user inbox. Unlike nearly every other table in this project, access '
  'is NOT gated by organization membership — a notification is private to '
  'the one person it was created for.';

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications
  for select
  using (user_id = auth.uid());

-- Users can create notifications for THEMSELVES only (covers self-triggered
-- events: submitting a bank transfer claim, a workflow run you started
-- finishing). Notifying someone ELSE (a teammate whose org just gained a
-- marketplace install, every member of an org whose credits ran out) can't
-- go through this policy — those cases run inside existing SECURITY DEFINER
-- functions (deduct_credits(), increment_marketplace_install_count()) that
-- already bypass RLS, extended below to also insert a notification.
create policy "Users can create their own notifications"
  on public.notifications
  for insert
  with check (user_id = auth.uid());

create policy "Users can mark their own notifications read"
  on public.notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own notifications"
  on public.notifications
  for delete
  using (user_id = auth.uid());

-- Extend deduct_credits() (from the Billing phase) to notify every member
-- of an organization the first time a charge brings its balance to exactly
-- zero. Because deduct_credits() only succeeds when balance_credits >=
-- amount, this fires naturally once per depletion — not on every
-- subsequent blocked call, since those are stopped earlier by hasCredits()
-- and never reach this function at all.
create or replace function public.deduct_credits(
  target_org_id uuid,
  amount integer,
  charge_reason text,
  target_reference_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows integer;
  new_balance integer;
begin
  update public.organization_wallets
  set balance_credits = balance_credits - amount
  where organization_id = target_org_id
    and balance_credits >= amount
  returning balance_credits into new_balance;

  get diagnostics updated_rows = row_count;

  if updated_rows > 0 then
    insert into public.credit_ledger (organization_id, amount, reason, reference_id)
    values (target_org_id, -amount, charge_reason, target_reference_id);

    if new_balance = 0 then
      insert into public.notifications (user_id, organization_id, type, title, body, link)
      select
        om.user_id,
        target_org_id,
        'low_credits',
        'Your organization is out of AI credits',
        'Chat, workflows, and teams need at least 1 credit to run. Buy more from the Wallet page.',
        '/dashboard/wallet'
      from public.organization_members om
      where om.organization_id = target_org_id;
    end if;
  end if;

  return updated_rows > 0;
end;
$$;

-- Extend increment_marketplace_install_count() (from the Marketplace phase)
-- to notify the listing's publisher when someone installs it.
create or replace function public.increment_marketplace_install_count(target_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  publisher_id uuid;
  listing_name text;
begin
  update public.marketplace_listings
  set install_count = install_count + 1
  where id = target_listing_id
    and is_published = true
  returning created_by, name into publisher_id, listing_name;

  if publisher_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      publisher_id,
      'marketplace_install',
      'Someone installed "' || listing_name || '"',
      'Your published AI Employee template just got a new install.',
      '/dashboard/marketplace'
    );
  end if;
end;
$$;
