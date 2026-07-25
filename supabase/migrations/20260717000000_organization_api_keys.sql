-- Phase: AI Chat
-- Stores provider API keys per organization. Deliberately has NO select policy
-- for the authenticated role — nobody using the anon/authenticated client can
-- ever read a key back, including admins. Only the Edge Function, using the
-- service role key (which bypasses RLS entirely), can read it. This is the
-- standard "write it, we don't show it back" pattern (same UX as GitHub
-- tokens or Stripe restricted keys).
--
-- To let the UI show "configured / not configured" without exposing the key,
-- has_org_api_key() below returns a boolean via a security-definer function.

create table if not exists public.organization_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null
    check (provider in ('anthropic', 'openai', 'gemini', 'openrouter', 'ollama', 'lmstudio')),
  api_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

comment on table public.organization_api_keys is
  'Provider API keys, one per (organization, provider). No SELECT policy: '
  'only readable server-side via the service role key (Edge Functions).';

drop trigger if exists set_organization_api_keys_updated_at on public.organization_api_keys;
create trigger set_organization_api_keys_updated_at
  before update on public.organization_api_keys
  for each row
  execute function public.set_updated_at();

alter table public.organization_api_keys enable row level security;

-- No SELECT policy at all — default deny for every client role.

create policy "Admins can set their organization's API keys"
  on public.organization_api_keys
  for insert
  with check (public.is_org_admin(organization_id));

create policy "Admins can update their organization's API keys"
  on public.organization_api_keys
  for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "Admins can remove their organization's API keys"
  on public.organization_api_keys
  for delete
  using (public.is_org_admin(organization_id));

-- Lets any org member (not just admins) check whether a key is configured,
-- without ever exposing the key itself.
create or replace function public.has_org_api_key(target_org_id uuid, target_provider text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_api_keys
    where organization_id = target_org_id
      and provider = target_provider
  )
  and public.is_org_member(target_org_id);
$$;
