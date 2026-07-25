import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label
} from "@agentforge/ui";

import { ApiKeysCard } from "@/components/dashboard/api-keys-card";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase/client";

export function OrganizationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization, role, isLoading, refresh, myOrganizations, switchOrganization } =
    useOrganization();
  const [name, setName] = useState(organization?.name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const canEdit = role === "owner" || role === "admin";

  useEffect(() => {
    setName(organization?.name ?? "");
  }, [organization?.name]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;

    setIsSaving(true);
    setStatus(null);

    const { error } = await supabase
      .from("organizations")
      .update({ name: name.trim() })
      .eq("id", organization.id);

    setIsSaving(false);

    if (error) {
      setStatus({ type: "error", message: error.message });
      return;
    }

    await refresh();
    setStatus({ type: "success", message: "Organization updated." });
  }

  async function handleLeave() {
    if (!organization || !user) return;

    const confirmed = window.confirm(
      `Leave ${organization.name}? You'll lose access unless someone invites you back.`
    );
    if (!confirmed) return;

    setIsLeaving(true);

    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", organization.id)
      .eq("user_id", user.id);

    if (error) {
      setIsLeaving(false);
      setStatus({ type: "error", message: error.message });
      return;
    }

    const nextOrg = myOrganizations.find((entry) => entry.organization.id !== organization.id);
    if (nextOrg) {
      await switchOrganization(nextOrg.organization.id);
    }

    setIsLeaving(false);
    navigate("/dashboard");
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading organization…</p>;
  }

  if (!organization) {
    return <p className="text-sm text-muted-foreground">No organization found.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You're a{role === "owner" ? "n" : ""} {role} of this organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization details</CardTitle>
          <CardDescription>
            {canEdit
              ? "Only owners and admins can rename the organization."
              : "Ask an owner or admin to make changes here."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orgName">Name</Label>
              <Input
                id="orgName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canEdit}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orgSlug">Slug</Label>
              <Input id="orgSlug" value={organization.slug} disabled />
            </div>

            {status && (
              <p
                className={
                  status.type === "success" ? "text-sm text-primary" : "text-sm text-destructive"
                }
              >
                {status.message}
              </p>
            )}

            {canEdit && (
              <div>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <ApiKeysCard organizationId={organization.id} role={role} />

      {organization.owner_id !== user?.id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leave organization</CardTitle>
            <CardDescription>
              You'll lose access to {organization.name} unless someone adds you back.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={isLeaving}
              onClick={() => void handleLeave()}
            >
              {isLeaving ? "Leaving…" : "Leave organization"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
