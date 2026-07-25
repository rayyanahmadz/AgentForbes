-- Phase: API Platform
-- Lets an organization call AgentForge programmatically over plain HTTP,
-- authenticated by an API key instead of a Supabase session/JWT — a
-- genuinely different trust model from every other Edge Function so far,
-- all of which authenticate the caller via their Supabase auth session.
--
-- Same secret-handling pattern as GitHub/Stripe: the plaintext key is
-- returned to the client exactly once, at creation. Only a SHA-256 hash is
-- ever stored — nobody, including this project's own code, can retrieve a
-- previously issued key's plaintext again.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null,
  -- First 12 chars of the plaintext key (e.g. "af_live_a1b2"), shown in the
  -- UI so an admin can tell keys apart without ever seeing the full value
  -- again.
  key_prefix text not null,
  key_hash text not null unique,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.api_keys is
  'Hashed API keys for programmatic access. The plaintext key is never '
  'stored — see create_api_key() below, which is the only place it ever '
  'exists, for the single response where it is returned.';

create index if not exists api_keys_organization_id_idx on public.api_keys (organization_id);
create index if not exists api_keys_key_hash_idx on public.api_keys (key_hash);

alter table public.api_keys enable row level security;

-- API keys are sensitive enough that only owners/admins — not every member
-- — can see the list or manage them (unlike the "any member" pattern used
-- for employees, workflows, and teams).
create policy "Admins can view their organization's API keys"
  on public.api_keys
  for select
  using (public.is_org_admin(organization_id));

create policy "Admins can revoke or rename their organization's API keys"
  on public.api_keys
  for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "Admins can delete their organization's API keys"
  on public.api_keys
  for delete
  using (public.is_org_admin(organization_id));

-- No insert policy: keys are created exclusively through create_api_key()
-- below, which runs as security definer and checks admin status itself, so
-- an RLS insert policy isn't needed as a second gate.

create or replace function public.create_api_key(target_org_id uuid, key_name text)
returns table (id uuid, plaintext_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_key text;
  new_hash text;
  new_id uuid;
begin
  if not public.is_org_admin(target_org_id) then
    raise exception 'Only organization owners/admins can create API keys';
  end if;

  new_key := 'af_live_' || encode(gen_random_bytes(24), 'hex');
  new_hash := encode(digest(new_key, 'sha256'), 'hex');

  insert into public.api_keys (organization_id, created_by, name, key_prefix, key_hash)
  values (target_org_id, auth.uid(), key_name, left(new_key, 12), new_hash)
  returning api_keys.id into new_id;

  return query select new_id, new_key;
end;
$$;

comment on function public.create_api_key is
  'The only place a plaintext API key ever exists. Returns it once; the '
  'caller (the frontend) must show it to the user immediately and cannot '
  'retrieve it again afterward — only key_prefix is ever stored.';
