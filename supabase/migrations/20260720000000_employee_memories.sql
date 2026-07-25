-- Phase: Memory
-- Discrete facts an AI Employee retains ACROSS all of its conversations — the
-- thing that's genuinely new here versus a single conversation's own message
-- history (already persisted since the AI Chat phase) or Knowledge Base's
-- static documents (from the Knowledge Base phase). Added two ways: manually
-- by a user, or by saving a specific assistant reply from a chat thread.

create table if not exists public.employee_memories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ai_employee_id uuid not null references public.ai_employees (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.employee_memories is
  'Discrete facts an employee should recall in every conversation, not just '
  'the one it was learned in. Injected into the chat system instruction '
  'alongside (but separate from) Knowledge Base context.';

create index if not exists employee_memories_ai_employee_id_idx
  on public.employee_memories (ai_employee_id);

drop trigger if exists set_employee_memories_updated_at on public.employee_memories;
create trigger set_employee_memories_updated_at
  before update on public.employee_memories
  for each row
  execute function public.set_updated_at();

-- Row Level Security ---------------------------------------------------------
-- Same shared-team-resource model as ai_employees / knowledge_sources.

alter table public.employee_memories enable row level security;

create policy "Members can view their organization's employee memories"
  on public.employee_memories
  for select
  using (public.is_org_member(organization_id));

create policy "Members can create employee memories in their organization"
  on public.employee_memories
  for insert
  with check (
    public.is_org_member(organization_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy "Members can update their organization's employee memories"
  on public.employee_memories
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Members can delete their organization's employee memories"
  on public.employee_memories
  for delete
  using (public.is_org_member(organization_id));
