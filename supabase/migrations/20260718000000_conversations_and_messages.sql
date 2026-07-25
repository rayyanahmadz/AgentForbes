-- Phase: AI Chat
-- Conversations and messages for talking to an AI Employee. organization_id
-- is denormalized onto both tables (rather than joining through
-- ai_employees/conversations every RLS check) to keep policies simple and fast.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ai_employee_id uuid not null references public.ai_employees (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_ai_employee_id_idx
  on public.conversations (ai_employee_id);

create index if not exists conversations_organization_id_idx
  on public.conversations (organization_id);

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
  before update on public.conversations
  for each row
  execute function public.set_updated_at();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx
  on public.messages (conversation_id, created_at);

-- Row Level Security ---------------------------------------------------------
-- Same "shared team resource" model as ai_employees: any org member can see
-- and manage the org's conversations. Locking a conversation to just its
-- creator is real scope for a later privacy/permissions pass.

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Members can view their organization's conversations"
  on public.conversations
  for select
  using (public.is_org_member(organization_id));

create policy "Members can create conversations in their organization"
  on public.conversations
  for insert
  with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
  );

create policy "Members can update their organization's conversations"
  on public.conversations
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Members can delete their organization's conversations"
  on public.conversations
  for delete
  using (public.is_org_member(organization_id));

create policy "Members can view messages in their organization"
  on public.messages
  for select
  using (public.is_org_member(organization_id));

create policy "Members can send messages in their organization"
  on public.messages
  for insert
  with check (public.is_org_member(organization_id));

-- No update/delete policy on messages: a chat transcript is append-only from
-- the client's perspective. (The Edge Function inserts the assistant's reply
-- using the caller's own forwarded auth, so this same insert policy covers it.)
