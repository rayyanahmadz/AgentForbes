-- Phase: Marketplace
-- Publish an AI Employee's spec as a free, cross-organization listing that
-- any org can browse and install as a fresh copy. Scoped deliberately to
-- employee templates only — see the README for what's deferred and why.
--
-- IMPORTANT RLS DEVIATION: every other table in this project uses the
-- shared-team-resource pattern (readable only by is_org_member). Marketplace
-- listings are the first thing in this schema that's readable by ANY
-- authenticated user regardless of organization — that's the entire point
-- of a marketplace. Call this out explicitly since it's a deliberate
-- exception, not an oversight.

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  -- Snapshotting the publisher's org name (rather than joining organizations
  -- live) avoids needing a new cross-org read policy on the organizations
  -- table just for attribution.
  publisher_name text not null,
  -- Snapshot of the employee's spec at publish time — intentionally
  -- decoupled from the live ai_employees row, so later edits to the
  -- publisher's own employee don't retroactively change what's installed by
  -- everyone who already grabbed a copy.
  name text not null,
  description text,
  instructions text,
  provider text not null
    check (provider in ('anthropic', 'openai', 'gemini', 'openrouter', 'ollama', 'lmstudio')),
  model text not null,
  temperature numeric(3, 2) not null check (temperature >= 0 and temperature <= 2),
  install_count integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.marketplace_listings is
  'Free, cross-organization AI Employee templates. A snapshot at publish '
  'time, not a live link to the source employee. No ratings/reviews/paid '
  'sales yet — those need the Payments/Billing phases.';

create index if not exists marketplace_listings_organization_id_idx
  on public.marketplace_listings (organization_id);
create index if not exists marketplace_listings_is_published_idx
  on public.marketplace_listings (is_published);

drop trigger if exists set_marketplace_listings_updated_at on public.marketplace_listings;
create trigger set_marketplace_listings_updated_at
  before update on public.marketplace_listings
  for each row
  execute function public.set_updated_at();

-- Row Level Security ---------------------------------------------------------

alter table public.marketplace_listings enable row level security;

-- Any authenticated user can browse published listings from any
-- organization — this is the deliberate exception noted above. Publishers
-- can also see their own unpublished drafts.
create policy "Anyone can view published listings; publishers see their own drafts too"
  on public.marketplace_listings
  for select
  to authenticated
  using (is_published = true or public.is_org_member(organization_id));

create policy "Members can publish listings from their organization"
  on public.marketplace_listings
  for insert
  with check (public.is_org_member(organization_id) and created_by = auth.uid());

create policy "Members can edit their organization's listings"
  on public.marketplace_listings
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Members can delete their organization's listings"
  on public.marketplace_listings
  for delete
  using (public.is_org_member(organization_id));

-- Lets any authenticated user (typically NOT a member of the publishing
-- org) bump a listing's install count without granting them any broader
-- update access — the one narrow exception to "publisher org only" writes.
create or replace function public.increment_marketplace_install_count(target_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.marketplace_listings
  set install_count = install_count + 1
  where id = target_listing_id
    and is_published = true;
$$;
