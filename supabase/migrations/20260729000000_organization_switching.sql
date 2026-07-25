-- Phase: Organization Management (continued)
-- The org switcher only makes sense if a user can belong to more than one
-- organization through means other than signup's auto-created personal org
-- or being added by an admin — namely, creating an additional org
-- themselves — and can voluntarily leave one they no longer want to be
-- part of. Both were still missing after the invite/members work in the
-- previous migration.

-- 1. Let any authenticated user create an additional organization ----------
-- organizations has never had an insert policy for regular clients — every
-- org so far was created by handle_new_user()'s security-definer trigger.
-- This RPC follows the same trusted-function pattern rather than opening a
-- raw insert policy, reusing the same unique-slug approach.

create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  final_slug text;
  new_org_id uuid;
begin
  if trim(org_name) = '' then
    raise exception 'Organization name cannot be empty';
  end if;

  base_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  final_slug := base_slug || '-' || substr(md5(random()::text), 1, 6);

  insert into public.organizations (name, slug, owner_id)
  values (trim(org_name), final_slug, auth.uid())
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, auth.uid(), 'owner');

  return new_org_id;
end;
$$;

comment on function public.create_organization is
  'Lets any authenticated user create an additional organization beyond '
  'their auto-created personal one, becoming its owner. Does not change '
  'profiles.default_organization_id — the frontend switches into it '
  'explicitly after creation, same as switching to any other org.';

-- 2. Let a member voluntarily leave an organization -------------------------
-- The existing "Admins can remove members" delete policy (Database phase)
-- only lets an admin remove someone else. A regular member had no way to
-- remove themselves. The guard_owner_membership trigger (previous
-- migration) still protects the founding owner from this path too — an
-- owner leaving their own organization stays out of scope, same as that
-- migration already noted for ownership transfer.

create policy "Users can remove themselves from an organization"
  on public.organization_members
  for delete
  using (user_id = auth.uid());
