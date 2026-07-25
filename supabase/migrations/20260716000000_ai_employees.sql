-- Phase: AI Digital Employees
-- The core resource of the product: a configured AI Employee belonging to an
-- organization. This phase covers create/read/update/delete of the employee's
-- specification only (name, provider, model, instructions, temperature).
-- Actually talking to an AI provider happens in the AI Chat phase.

create table if not exists public.ai_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete set null,
  name text not null,
  description text,
  instructions text,
  -- Kept as text + check constraint (not a Postgres enum) so adding a new
  -- provider later is a one-line constraint change, not a type migration.
  provider text not null default 'gemini'
    check (provider in ('anthropic', 'openai', 'gemini', 'openrouter', 'ollama', 'lmstudio')),
  model text not null default 'gemini-2.0-flash',
  temperature numeric(3, 2) not null default 0.70
    check (temperature >= 0 and temperature <= 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_employees is
  'A configured AI Employee (spec only — model, instructions, provider). '
  'Memory, knowledge, tools, and actual conversations are added in later phases.';

create index if not exists ai_employees_organization_id_idx
  on public.ai_employees (organization_id);

drop trigger if exists set_ai_employees_updated_at on public.ai_employees;
create trigger set_ai_employees_updated_at
  before update on public.ai_employees
  for each row
  execute function public.set_updated_at();

-- Row Level Security ---------------------------------------------------------
-- MVP policy: any member of the organization can view, create, edit, and
-- delete its AI Employees (shared team resource, like a doc in a shared
-- folder). Restricting this to specific roles is real scope that belongs to
-- the Organization Management phase, not this one.

alter table public.ai_employees enable row level security;

create policy "Members can view their organization's AI Employees"
  on public.ai_employees
  for select
  using (public.is_org_member(organization_id));

create policy "Members can create AI Employees in their organization"
  on public.ai_employees
  for insert
  with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
  );

create policy "Members can update their organization's AI Employees"
  on public.ai_employees
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Members can delete their organization's AI Employees"
  on public.ai_employees
  for delete
  using (public.is_org_member(organization_id));
