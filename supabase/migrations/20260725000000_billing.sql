-- Phase: Billing
-- The spend side of the wallet built in the Payments phase. 1 credit is
-- charged per successful AI call (chat message, workflow step, team chat
-- message) as a flat platform usage fee — separate from and in addition to
-- whatever the organization's own Gemini API key costs them directly.
--
-- Also grants every organization 50 free starter credits (see the bottom of
-- this file) so a fresh install stays usable without a real purchase first.
--
-- Same security model as increment_wallet_balance() from the Payments
-- phase: nobody should be able to touch their own balance directly. Only
-- code running with the service role key (the chat/run-workflow/team-chat
-- Edge Functions) can call deduct_credits().

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Negative for a spend (the only kind this phase creates). Signed rather
  -- than an unsigned "amount spent" column so a future grant/refund can
  -- reuse this same table as a positive entry without a schema change.
  amount integer not null,
  reason text not null check (reason in ('chat', 'workflow_step', 'team_chat')),
  -- The conversation/run/team-conversation this charge came from. No FK
  -- constraint since it can point at three different tables depending on
  -- reason — kept as a plain uuid rather than three nullable FK columns.
  reference_id uuid,
  created_at timestamptz not null default now()
);

comment on table public.credit_ledger is
  'Append-only record of every credit charge. Write-locked: see security '
  'note above — only deduct_credits() (service_role only) ever inserts here.';

create index if not exists credit_ledger_organization_id_idx
  on public.credit_ledger (organization_id);

alter table public.credit_ledger enable row level security;

create policy "Members can view their organization's credit ledger"
  on public.credit_ledger
  for select
  using (public.is_org_member(organization_id));

-- Deliberately no insert/update/delete policy for any client role — see
-- security note at the top of this file.

-- Atomically checks-and-deducts: only succeeds (returns true) if the
-- organization currently has enough balance, and records the ledger entry
-- in the same transaction. Returns false on insufficient balance rather
-- than letting the wallet go negative.
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
begin
  update public.organization_wallets
  set balance_credits = balance_credits - amount
  where organization_id = target_org_id
    and balance_credits >= amount;

  get diagnostics updated_rows = row_count;

  if updated_rows > 0 then
    insert into public.credit_ledger (organization_id, amount, reason, reference_id)
    values (target_org_id, -amount, charge_reason, target_reference_id);
  end if;

  return updated_rows > 0;
end;
$$;

revoke all on function public.deduct_credits(uuid, integer, text, uuid) from public;
revoke all on function public.deduct_credits(uuid, integer, text, uuid) from authenticated;
revoke all on function public.deduct_credits(uuid, integer, text, uuid) from anon;
grant execute on function public.deduct_credits(uuid, integer, text, uuid) to service_role;

-- Every organization now needs credits to use chat/workflows/teams at all
-- (see hasCredits()/chargeOneCredit() in the shared Edge Function module).
-- Without a free starting balance, a brand-new org — including one just set
-- up for local development — couldn't use any AI feature until someone ran
-- a real Stripe test-mode purchase first. That breaks this project's own
-- "buildable and testable on free tiers" requirement, so new organizations
-- get a small free starter balance instead of zero.
create or replace function public.handle_new_organization_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_wallets (organization_id, balance_credits)
  values (new.id, 50);
  return new;
end;
$$;

-- One-time backfill for organizations created before this migration (by
-- earlier phases in this same project) that are still sitting at the old
-- default of zero.
update public.organization_wallets
set balance_credits = balance_credits + 50
where balance_credits = 0;
