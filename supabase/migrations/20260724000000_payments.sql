-- Phase: Payments
-- AI credits, purchased via Stripe (test mode, real checkout + webhook) or
-- claimed via manual bank transfer (real record, no fake auto-approval —
-- verifying a bank transfer claim is explicitly the Admin Panel phase's job,
-- not this one, so claims sit in 'awaiting_verification' with no way to
-- move them further yet).
--
-- SECURITY-CRITICAL DESIGN, read before touching this file:
-- Nobody should ever be able to grant themselves credits by calling the API
-- directly. So:
--   - organization_wallets has NO insert/update/delete policy for the
--     authenticated role at all. The only way its balance changes is the
--     increment_wallet_balance() function below, and that function's
--     EXECUTE privilege is explicitly revoked from authenticated/anon and
--     granted only to service_role — i.e. only code running with the
--     service role key (the Stripe webhook Edge Function) can call it.
--   - payment_orders has NO update policy for authenticated either. A user
--     can create a pending/awaiting_verification order, but only
--     service-role code can ever transition its status — never the client
--     that created it.

create table if not exists public.organization_wallets (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  balance_credits integer not null default 0 check (balance_credits >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.organization_wallets is
  'AI credit balance per organization. Write-locked: see security note above.';

drop trigger if exists set_organization_wallets_updated_at on public.organization_wallets;
create trigger set_organization_wallets_updated_at
  before update on public.organization_wallets
  for each row
  execute function public.set_updated_at();

-- Every organization gets a zero-balance wallet automatically.
create or replace function public.handle_new_organization_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_wallets (organization_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_organization_created_wallet on public.organizations;
create trigger on_organization_created_wallet
  after insert on public.organizations
  for each row
  execute function public.handle_new_organization_wallet();

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  gateway text not null check (gateway in ('stripe', 'manual_bank_transfer')),
  credits_purchased integer not null check (credits_purchased > 0),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'awaiting_verification', 'verified', 'rejected')),
  stripe_checkout_session_id text,
  bank_transfer_reference text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payment_orders is
  'One row per purchase attempt, either gateway. Write-locked after '
  'creation: see security note above — status only ever changes server-side.';

create index if not exists payment_orders_organization_id_idx
  on public.payment_orders (organization_id);
create index if not exists payment_orders_stripe_session_idx
  on public.payment_orders (stripe_checkout_session_id);

drop trigger if exists set_payment_orders_updated_at on public.payment_orders;
create trigger set_payment_orders_updated_at
  before update on public.payment_orders
  for each row
  execute function public.set_updated_at();

-- Row Level Security ---------------------------------------------------------

alter table public.organization_wallets enable row level security;
alter table public.payment_orders enable row level security;

create policy "Members can view their organization's wallet"
  on public.organization_wallets
  for select
  using (public.is_org_member(organization_id));

-- Deliberately no insert/update/delete policy on organization_wallets for
-- any client role — see security note at the top of this file.

create policy "Members can view their organization's payment orders"
  on public.payment_orders
  for select
  using (public.is_org_member(organization_id));

create policy "Members can create payment orders for their organization"
  on public.payment_orders
  for insert
  with check (public.is_org_member(organization_id) and created_by = auth.uid());

-- Deliberately no update/delete policy on payment_orders for any client
-- role — see security note at the top of this file.

-- Only the Stripe webhook (running as service_role) may credit a wallet.
-- EXECUTE is explicitly revoked from authenticated/anon so no logged-in
-- user can call this directly and grant themselves credits — contrast with
-- has_org_api_key()/increment_marketplace_install_count() from earlier
-- phases, which are deliberately open to any authenticated user because
-- their blast radius is harmless. This one moves real balances, so it isn't.
create or replace function public.increment_wallet_balance(target_org_id uuid, amount integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.organization_wallets
  set balance_credits = balance_credits + amount
  where organization_id = target_org_id;
$$;

revoke all on function public.increment_wallet_balance(uuid, integer) from public;
revoke all on function public.increment_wallet_balance(uuid, integer) from authenticated;
revoke all on function public.increment_wallet_balance(uuid, integer) from anon;
grant execute on function public.increment_wallet_balance(uuid, integer) to service_role;
