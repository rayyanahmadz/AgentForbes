-- Phase: Multi-Agent Teams
-- A team has a lead employee + member employees. Each incoming message is
-- routed by the lead (one quick classification call) to whichever teammate
-- is best suited, or handled by the lead itself. This is dynamic, per-message
-- routing — different from Workflow Builder's fixed, pre-defined step order.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null,
  description text,
  lead_ai_employee_id uuid not null references public.ai_employees (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.teams is
  'A team of AI Employees with one lead. The lead routes each incoming '
  'message to the best-suited member (or itself) at runtime.';

create index if not exists teams_organization_id_idx on public.teams (organization_id);

drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at
  before update on public.teams
  for each row
  execute function public.set_updated_at();

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  ai_employee_id uuid not null references public.ai_employees (id) on delete cascade,
  -- Short description of what this member is good at, shown to the lead
  -- when it decides who should handle an incoming message.
  role_note text,
  created_at timestamptz not null default now(),
  unique (team_id, ai_employee_id)
);

comment on table public.team_members is
  'Members of a team (not including the lead, who is on teams.lead_ai_employee_id).';

create index if not exists team_members_team_id_idx on public.team_members (team_id);

create table if not exists public.team_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_conversations_team_id_idx
  on public.team_conversations (team_id);

drop trigger if exists set_team_conversations_updated_at on public.team_conversations;
create trigger set_team_conversations_updated_at
  before update on public.team_conversations
  for each row
  execute function public.set_updated_at();

create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  team_conversation_id uuid not null references public.team_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- Which employee actually generated this reply (null for user messages,
  -- and null-safe if that employee is later deleted) — the UI shows this as
  -- "Answered by <name>".
  responded_by_employee_id uuid references public.ai_employees (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists team_messages_conversation_id_idx
  on public.team_messages (team_conversation_id);

-- Row Level Security ---------------------------------------------------------
-- Same shared-team-resource model as everything else.

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_conversations enable row level security;
alter table public.team_messages enable row level security;

create policy "Members can view their organization's teams"
  on public.teams for select using (public.is_org_member(organization_id));
create policy "Members can create teams in their organization"
  on public.teams for insert
  with check (public.is_org_member(organization_id) and created_by = auth.uid());
create policy "Members can update their organization's teams"
  on public.teams for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "Members can delete their organization's teams"
  on public.teams for delete using (public.is_org_member(organization_id));

create policy "Members can view their organization's team members"
  on public.team_members for select using (public.is_org_member(organization_id));
create policy "Members can add team members in their organization"
  on public.team_members for insert with check (public.is_org_member(organization_id));
create policy "Members can update their organization's team members"
  on public.team_members for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "Members can remove their organization's team members"
  on public.team_members for delete using (public.is_org_member(organization_id));

create policy "Members can view their organization's team conversations"
  on public.team_conversations for select using (public.is_org_member(organization_id));
create policy "Members can create team conversations in their organization"
  on public.team_conversations for insert
  with check (public.is_org_member(organization_id) and created_by = auth.uid());
create policy "Members can update their organization's team conversations"
  on public.team_conversations for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "Members can delete their organization's team conversations"
  on public.team_conversations for delete using (public.is_org_member(organization_id));

create policy "Members can view their organization's team messages"
  on public.team_messages for select using (public.is_org_member(organization_id));
create policy "Members can create team messages in their organization"
  on public.team_messages for insert with check (public.is_org_member(organization_id));
