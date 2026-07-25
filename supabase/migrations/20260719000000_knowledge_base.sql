-- Phase: Knowledge Base
-- A knowledge source is either a pasted block of text or a plain .txt/.md
-- file (PDF/DOCX parsing is deferred — risky to ship untested in an Edge
-- Function). Sources belong to an organization and can be attached to any
-- number of AI Employees. Grounding is done by including each attached
-- source's text directly in the chat prompt (capped), not vector search —
-- real RAG/embeddings are a later enhancement.

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete set null,
  name text not null,
  description text,
  source_type text not null check (source_type in ('text', 'file')),
  file_path text,
  file_name text,
  mime_type text,
  content text not null,
  char_count integer not null generated always as (char_length(content)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.knowledge_sources is
  'Pasted text or a plain-text file''s extracted content. Grounds chat via '
  'direct context inclusion (capped), not vector search — that lands later.';

create index if not exists knowledge_sources_organization_id_idx
  on public.knowledge_sources (organization_id);

drop trigger if exists set_knowledge_sources_updated_at on public.knowledge_sources;
create trigger set_knowledge_sources_updated_at
  before update on public.knowledge_sources
  for each row
  execute function public.set_updated_at();

create table if not exists public.ai_employee_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ai_employee_id uuid not null references public.ai_employees (id) on delete cascade,
  knowledge_source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (ai_employee_id, knowledge_source_id)
);

comment on table public.ai_employee_knowledge_sources is
  'Which knowledge sources are attached to which AI Employee (many-to-many).';

create index if not exists ai_employee_knowledge_sources_employee_idx
  on public.ai_employee_knowledge_sources (ai_employee_id);

create index if not exists ai_employee_knowledge_sources_source_idx
  on public.ai_employee_knowledge_sources (knowledge_source_id);

-- Row Level Security ---------------------------------------------------------
-- Same shared-team-resource model as ai_employees/conversations.

alter table public.knowledge_sources enable row level security;
alter table public.ai_employee_knowledge_sources enable row level security;

create policy "Members can view their organization's knowledge sources"
  on public.knowledge_sources
  for select
  using (public.is_org_member(organization_id));

create policy "Members can create knowledge sources in their organization"
  on public.knowledge_sources
  for insert
  with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
  );

create policy "Members can update their organization's knowledge sources"
  on public.knowledge_sources
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Members can delete their organization's knowledge sources"
  on public.knowledge_sources
  for delete
  using (public.is_org_member(organization_id));

create policy "Members can view their organization's knowledge attachments"
  on public.ai_employee_knowledge_sources
  for select
  using (public.is_org_member(organization_id));

create policy "Members can attach knowledge sources in their organization"
  on public.ai_employee_knowledge_sources
  for insert
  with check (public.is_org_member(organization_id));

create policy "Members can detach knowledge sources in their organization"
  on public.ai_employee_knowledge_sources
  for delete
  using (public.is_org_member(organization_id));

-- Storage ---------------------------------------------------------------------
-- Private bucket. Objects are stored at "{organization_id}/{uuid}-{filename}",
-- and storage.foldername(name)[1] (the org id) is what RLS checks against.

insert into storage.buckets (id, name, public)
values ('knowledge-files', 'knowledge-files', false)
on conflict (id) do nothing;

create policy "Org members can read their organization's knowledge files"
  on storage.objects
  for select
  using (
    bucket_id = 'knowledge-files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "Org members can upload knowledge files for their organization"
  on storage.objects
  for insert
  with check (
    bucket_id = 'knowledge-files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "Org members can delete their organization's knowledge files"
  on storage.objects
  for delete
  using (
    bucket_id = 'knowledge-files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );
