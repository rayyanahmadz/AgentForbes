-- Phase: Workflow Builder
-- Scope: a named, ORDERED sequence of steps, each run by one AI Employee.
-- Each step's prompt can reference {{input}} (the run's initial input) and
-- {{previous_output}} (the immediately preceding step's output). Run
-- manually via a "Run" button; no branching/conditionals and no schedule
-- triggers yet — see the README for why this scope was chosen deliberately.

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workflows is
  'A named, ordered sequence of AI Employee steps. See workflow_steps for the '
  'steps themselves and workflow_runs/workflow_step_runs for execution history.';

create index if not exists workflows_organization_id_idx
  on public.workflows (organization_id);

drop trigger if exists set_workflows_updated_at on public.workflows;
create trigger set_workflows_updated_at
  before update on public.workflows
  for each row
  execute function public.set_updated_at();

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  step_order integer not null check (step_order >= 1),
  name text not null,
  ai_employee_id uuid not null references public.ai_employees (id) on delete cascade,
  -- Supports {{input}} and {{previous_output}} placeholders, substituted at
  -- run time — see run-workflow Edge Function.
  prompt_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, step_order)
);

comment on table public.workflow_steps is
  'One ordered step of a workflow. prompt_template supports {{input}} and '
  '{{previous_output}} placeholders, substituted when the workflow runs.';

create index if not exists workflow_steps_workflow_id_idx
  on public.workflow_steps (workflow_id);

drop trigger if exists set_workflow_steps_updated_at on public.workflow_steps;
create trigger set_workflow_steps_updated_at
  before update on public.workflow_steps
  for each row
  execute function public.set_updated_at();

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  triggered_by uuid references auth.users (id) on delete set null,
  input text not null default '',
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  final_output text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.workflow_runs is
  'One execution of a workflow, from the initial input to (if it gets that '
  'far) the last step''s output.';

create index if not exists workflow_runs_workflow_id_idx
  on public.workflow_runs (workflow_id);

create table if not exists public.workflow_step_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workflow_run_id uuid not null references public.workflow_runs (id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps (id) on delete cascade,
  step_order integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  prompt text,
  output text,
  error text,
  started_at timestamptz,
  completed_at timestamptz
);

comment on table public.workflow_step_runs is
  'Per-step result within one workflow_run — lets the UI show live progress '
  'and lets a completed/failed run be inspected step by step afterwards.';

create index if not exists workflow_step_runs_run_id_idx
  on public.workflow_step_runs (workflow_run_id);

-- Row Level Security ---------------------------------------------------------
-- Same shared-team-resource model as ai_employees / knowledge_sources.

alter table public.workflows enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_step_runs enable row level security;

create policy "Members can view their organization's workflows"
  on public.workflows for select using (public.is_org_member(organization_id));
create policy "Members can create workflows in their organization"
  on public.workflows for insert
  with check (public.is_org_member(organization_id) and created_by = auth.uid());
create policy "Members can update their organization's workflows"
  on public.workflows for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "Members can delete their organization's workflows"
  on public.workflows for delete using (public.is_org_member(organization_id));

create policy "Members can view their organization's workflow steps"
  on public.workflow_steps for select using (public.is_org_member(organization_id));
create policy "Members can create workflow steps in their organization"
  on public.workflow_steps for insert with check (public.is_org_member(organization_id));
create policy "Members can update their organization's workflow steps"
  on public.workflow_steps for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "Members can delete their organization's workflow steps"
  on public.workflow_steps for delete using (public.is_org_member(organization_id));

create policy "Members can view their organization's workflow runs"
  on public.workflow_runs for select using (public.is_org_member(organization_id));
create policy "Members can create workflow runs in their organization"
  on public.workflow_runs for insert
  with check (public.is_org_member(organization_id) and triggered_by = auth.uid());
create policy "Members can update their organization's workflow runs"
  on public.workflow_runs for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Members can view their organization's workflow step runs"
  on public.workflow_step_runs for select using (public.is_org_member(organization_id));
create policy "Members can create workflow step runs in their organization"
  on public.workflow_step_runs for insert with check (public.is_org_member(organization_id));
create policy "Members can update their organization's workflow step runs"
  on public.workflow_step_runs for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
