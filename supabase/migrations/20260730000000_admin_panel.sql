-- Phase: Admin Panel
-- Introduces a genuinely new authorization boundary: a platform operator
-- role that sits ABOVE organization membership entirely. Every other table
-- in this project is scoped by is_org_member()/is_org_admin() — this is the
-- first (and only) concept that spans every organization at once.
--
-- There is deliberately no self-service way to become a platform admin —
-- that would be a privilege-escalation hole. Granting the first one is a
-- manual step:
--
--   insert into public.platform_admins (user_id) values ('<your-user-id>');
--
-- run directly in the Supabase SQL editor, not through the app. See the
-- README for the full bootstrap instructions.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'Allowlist of platform staff. No INSERT/UPDATE/DELETE policy for any '
  'client role by design — only ever modified directly in the database.';

alter table public.platform_admins enable row level security;

create policy "Platform admins can view the admin allowlist"
  on public.platform_admins
  for select
  using (public.is_platform_admin());

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

comment on function public.is_platform_admin is
  'Mirrors the is_org_admin()/is_org_member() pattern used everywhere else '
  'in this project, but with no organization scope at all.';

-- Notifications gained two new types for this phase's bank-transfer
-- decisions (same "extend the CHECK constraint" pattern used when
-- Organization Management added added_to_organization).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'low_credits',
    'workflow_run_completed',
    'workflow_run_failed',
    'marketplace_install',
    'bank_transfer_submitted',
    'added_to_organization',
    'bank_transfer_verified',
    'bank_transfer_rejected'
  ));

-- 1. Bank transfer verification -----------------------------------------------
-- The concrete thing the Payments phase deliberately left unbuilt: it noted
-- claims would sit in 'awaiting_verification' permanently until this phase
-- built real access control for approving them.

create or replace function public.list_pending_bank_transfers()
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  credits_purchased integer,
  amount_cents integer,
  currency text,
  bank_transfer_reference text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin access required';
  end if;

  return query
    select o.id, o.organization_id, org.name, o.credits_purchased, o.amount_cents,
           o.currency, o.bank_transfer_reference, o.created_at
    from public.payment_orders o
    join public.organizations org on org.id = o.organization_id
    where o.status = 'awaiting_verification'
      and o.gateway = 'manual_bank_transfer'
    order by o.created_at asc;
end;
$$;

create or replace function public.verify_bank_transfer(
  target_order_id uuid,
  approve boolean,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org_id uuid;
  order_credits integer;
  order_status text;
  order_created_by uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin access required';
  end if;

  select organization_id, credits_purchased, status, created_by
  into target_org_id, order_credits, order_status, order_created_by
  from public.payment_orders
  where id = target_order_id and gateway = 'manual_bank_transfer';

  if target_org_id is null then
    raise exception 'Bank transfer order not found';
  end if;

  if order_status != 'awaiting_verification' then
    raise exception 'This claim was already resolved (status: %)', order_status;
  end if;

  update public.payment_orders
  set status = case when approve then 'verified' else 'rejected' end,
      admin_note = note,
      updated_at = now()
  where id = target_order_id;

  if approve then
    -- Reuses the exact same function the Stripe webhook uses to credit a
    -- wallet — one source of truth for "how credits get added," regardless
    -- of which gateway or approval path triggered it.
    perform public.increment_wallet_balance(target_org_id, order_credits);
  end if;

  -- Notifying the submitter is inserting a notification for someone OTHER
  -- than the caller (the admin), so — same as low_credits/marketplace_install
  -- in the Notifications phase — this has to happen inside a function that
  -- already bypasses RLS, not as a self-insert from the client.
  if order_created_by is not null then
    insert into public.notifications (user_id, organization_id, type, title, body, link)
    values (
      order_created_by,
      target_org_id,
      case when approve then 'bank_transfer_verified' else 'bank_transfer_rejected' end,
      case when approve then 'Bank transfer verified' else 'Bank transfer rejected' end,
      coalesce(note, case when approve
        then order_credits || ' credits have been added to your wallet.'
        else 'Contact support if you believe this was a mistake.' end),
      '/dashboard/wallet'
    );
  end if;
end;
$$;

-- 2. Platform stats overview --------------------------------------------------

create or replace function public.get_platform_stats()
returns table (
  total_organizations bigint,
  total_users bigint,
  total_ai_employees bigint,
  total_marketplace_listings bigint,
  total_credits_purchased bigint,
  total_credits_spent bigint,
  total_revenue_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin access required';
  end if;

  return query
    select
      (select count(*) from public.organizations),
      (select count(*) from public.profiles),
      (select count(*) from public.ai_employees),
      (select count(*) from public.marketplace_listings where is_published = true),
      (select coalesce(sum(credits_purchased), 0) from public.payment_orders where status in ('paid', 'verified')),
      (select coalesce(sum(-amount), 0) from public.credit_ledger),
      (select coalesce(sum(amount_cents), 0) from public.payment_orders where status in ('paid', 'verified'));
end;
$$;

-- 3. Marketplace moderation ---------------------------------------------------
-- Viewing published listings needs no new function — marketplace_listings'
-- existing "anyone authenticated can view published listings" policy from
-- the Marketplace phase already covers that. Only the unpublish ACTION
-- needs admin gating, since the existing update policy is publisher-org-only.

create or replace function public.admin_unpublish_listing(target_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin access required';
  end if;

  update public.marketplace_listings
  set is_published = false
  where id = target_listing_id;
end;
$$;
