import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Mail, Trash2, UserPlus, Users } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select
} from "@agentforge/ui";

import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase/client";
import type { OrganizationInvitation, OrgRole } from "@/lib/supabase/types";

interface MemberRow {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  isOwner: boolean;
}

export function MembersPage() {
  const { user } = useAuth();
  const { organization, role: myRole } = useOrganization();
  const canManage = myRole === "owner" || myRole === "admin";

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organization) return;

    setIsLoading(true);
    const [{ data: memberRows, error: memberError }, { data: invitationRows }] =
      await Promise.all([
        supabase
          .from("organization_members")
          .select("id, user_id, role")
          .eq("organization_id", organization.id),
        supabase
          .from("organization_invitations")
          .select("*")
          .eq("organization_id", organization.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      ]);

    if (memberError) {
      setError(memberError.message);
      setIsLoading(false);
      return;
    }

    const userIds = (memberRows ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds.length > 0 ? userIds : [""]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    setMembers(
      (memberRows ?? []).map((m) => ({
        membershipId: m.id,
        userId: m.user_id,
        name: profileById.get(m.user_id)?.full_name ?? "Unknown",
        email: profileById.get(m.user_id)?.email ?? "",
        role: m.role,
        isOwner: m.user_id === organization.owner_id
      }))
    );
    setInvitations(invitationRows ?? []);
    setIsLoading(false);
  }, [organization]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !inviteEmail.trim()) return;

    setIsInviting(true);
    setInviteStatus(null);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke("invite-member", {
      body: { organizationId: organization.id, email: inviteEmail.trim(), role: inviteRole }
    });

    setIsInviting(false);

    if (invokeError) {
      setError(invokeError.message);
      return;
    }
    if (data?.error) {
      setError(data.error);
      return;
    }

    setInviteStatus(
      data?.status === "added_immediately"
        ? `${inviteEmail.trim()} already had an account and was added right away.`
        : `Invite email sent to ${inviteEmail.trim()}.`
    );
    setInviteEmail("");
    void loadData();
  }

  async function handleRoleChange(member: MemberRow, newRole: OrgRole) {
    setUpdatingId(member.membershipId);
    const { error: updateError } = await supabase
      .from("organization_members")
      .update({ role: newRole })
      .eq("id", member.membershipId);
    setUpdatingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    void loadData();
  }

  async function handleRemove(member: MemberRow) {
    const confirmed = window.confirm(`Remove ${member.name} from this organization?`);
    if (!confirmed) return;

    setUpdatingId(member.membershipId);
    const { error: deleteError } = await supabase
      .from("organization_members")
      .delete()
      .eq("id", member.membershipId);
    setUpdatingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    void loadData();
  }

  async function handleRevokeInvitation(invitation: OrganizationInvitation) {
    const { error: revokeError } = await supabase
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("id", invitation.id);

    if (revokeError) {
      setError(revokeError.message);
      return;
    }
    void loadData();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who's in {organization?.name ?? "this organization"}, and what they can do.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Invite someone</CardTitle>
            <CardDescription>
              If they already have an account, they're added right away. If not,
              they'll get a real invite email to sign up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="inviteEmail" className="sr-only">
                  Email
                </Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  required
                  placeholder="teammate@example.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
              </div>
              <div className="sm:w-40">
                <Label htmlFor="inviteRole" className="sr-only">
                  Role
                </Label>
                <Select
                  id="inviteRole"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as "admin" | "member")}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              <Button type="submit" disabled={isInviting || !inviteEmail.trim()} className="gap-1.5">
                <UserPlus className="h-4 w-4" strokeWidth={1.75} />
                {isInviting ? "Inviting…" : "Invite"}
              </Button>
            </form>
            {inviteStatus && <p className="mt-2 text-sm text-primary">{inviteStatus}</p>}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {isLoading ? "Loading members…" : `${members.length} member${members.length === 1 ? "" : "s"}`}
        </h2>
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li key={member.membershipId}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                      {member.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {member.name}
                        {member.userId === user?.id && (
                          <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {member.isOwner ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        Owner
                      </span>
                    ) : canManage ? (
                      <>
                        <Select
                          value={member.role}
                          disabled={updatingId === member.membershipId}
                          onChange={(event) =>
                            void handleRoleChange(member, event.target.value as OrgRole)
                          }
                          className="h-8 w-28 text-xs"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={updatingId === member.membershipId}
                          onClick={() => void handleRemove(member)}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </Button>
                      </>
                    ) : (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground capitalize">
                        {member.role}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      {canManage && invitations.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Pending invitations</h2>
          <ul className="flex flex-col gap-2">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                      <div>
                        <p>{invitation.email}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {invitation.role} · invited{" "}
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleRevokeInvitation(invitation)}
                    >
                      Revoke
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLoading && members.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Users className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">No members found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
