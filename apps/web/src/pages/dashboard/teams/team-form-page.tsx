import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import type { AiEmployee } from "@/lib/supabase/types";

interface MemberDraft {
  selected: boolean;
  roleNote: string;
}

export function TeamFormPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const isEditing = Boolean(teamId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();

  const [employees, setEmployees] = useState<AiEmployee[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leadEmployeeId, setLeadEmployeeId] = useState("");
  const [members, setMembers] = useState<Record<string, MemberDraft>>({});
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  if (!organization?.id) return;

  const organizationId = organization.id;

  async function loadEmployees() {
    const { data } = await supabase
      .from("ai_employees")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    setEmployees(data ?? []);

    if (!isEditing && data && data.length > 0) {
setLeadEmployeeId(data.at(0)?.id ?? "");    }
  }

  void loadEmployees();
}, [organization, isEditing]);

  useEffect(() => {
    if (!isEditing || !teamId) return;

    let isMounted = true;
    setIsLoading(true);

    async function load() {
      const [{ data: team, error: teamError }, { data: memberRows }] = await Promise.all([
        supabase.from("teams").select("*").eq("id", teamId!).single(),
        supabase.from("team_members").select("*").eq("team_id", teamId!)
      ]);

      if (!isMounted) return;

      if (teamError) {
        setError(teamError.message);
      } else if (team) {
        setName(team.name);
        setDescription(team.description ?? "");
        setLeadEmployeeId(team.lead_ai_employee_id);
      }

      const draft: Record<string, MemberDraft> = {};
      for (const row of memberRows ?? []) {
        draft[row.ai_employee_id] = { selected: true, roleNote: row.role_note ?? "" };
      }
      setMembers(draft);
      setIsLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [isEditing, teamId]);

  function toggleMember(employeeId: string) {
    setMembers((current) => ({
      ...current,
      [employeeId]: {
        selected: !current[employeeId]?.selected,
        roleNote: current[employeeId]?.roleNote ?? ""
      }
    }));
  }

  function updateMemberNote(employeeId: string, roleNote: string) {
    setMembers((current) => ({
      ...current,
      [employeeId]: { selected: current[employeeId]?.selected ?? false, roleNote }
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !user || !leadEmployeeId) return;

    const selectedMemberIds = Object.entries(members)
      .filter(([, draft]) => draft.selected)
      .map(([employeeId]) => employeeId);

    setIsSaving(true);
    setError(null);

    const teamPayload = {
      organization_id: organization.id,
      name: name.trim(),
      description: description.trim() || null,
      lead_ai_employee_id: leadEmployeeId
    };

    let savedTeamId = teamId ?? null;

    if (isEditing && teamId) {
      const { error: updateError } = await supabase
        .from("teams")
        .update(teamPayload)
        .eq("id", teamId);
      if (updateError) {
        setError(updateError.message);
        setIsSaving(false);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("teams")
        .insert({ ...teamPayload, created_by: user.id })
        .select("id")
        .single();
      if (insertError || !data) {
        setError(insertError?.message ?? "Couldn't create the team.");
        setIsSaving(false);
        return;
      }
      savedTeamId = data.id;
    }

    if (isEditing && savedTeamId) {
      const { error: deleteError } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", savedTeamId);
      if (deleteError) {
        setError(deleteError.message);
        setIsSaving(false);
        return;
      }
    }

    if (selectedMemberIds.length > 0) {
      const { error: membersError } = await supabase.from("team_members").insert(
        selectedMemberIds.map((employeeId) => ({
          organization_id: organization.id,
          team_id: savedTeamId!,
          ai_employee_id: employeeId,
          role_note: members[employeeId]?.roleNote.trim() || null
        }))
      );
      if (membersError) {
        setError(membersError.message);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    navigate("/dashboard/teams");
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEditing ? "Edit team" : "New team"}
        </h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You need at least one AI Employee before you can build a team.{" "}
            <Link to="/dashboard/employees/new" className="text-primary underline">
              Create one first
            </Link>
            .
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEditing ? "Edit team" : "New team"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The lead reads every incoming message and decides which teammate should
          answer — or answers it directly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Name the team and choose its lead.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                placeholder="e.g. Customer Support"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="One line about what this team handles"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead">Lead employee</Label>
              <Select
                id="lead"
                value={leadEmployeeId}
                onChange={(event) => setLeadEmployeeId(event.target.value)}
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Must use the Gemini provider — the lead makes the routing decision
                for every message.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Add a short note on what each member is good at — it's shown to the
              lead when it decides who should answer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {employees
                .filter((employee) => employee.id !== leadEmployeeId)
                .map((employee) => {
                  const draft = members[employee.id];
                  return (
                    <li key={employee.id} className="rounded-md border p-3">
                      <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-primary"
                          checked={draft?.selected ?? false}
                          onChange={() => toggleMember(employee.id)}
                        />
                        <span className="flex-1">
                          <span className="font-medium">{employee.name}</span>
                          {draft?.selected && (
                            <Input
                              className="mt-2"
                              placeholder="e.g. Handles billing and refund questions"
                              value={draft.roleNote}
                              onChange={(event) =>
                                updateMemberNote(employee.id, event.target.value)
                              }
                            />
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
            </ul>
            {employees.length === 1 && (
              <p className="mt-2 text-sm text-muted-foreground">
                You only have one AI Employee, so it must lead a team of itself for
                now — create more employees to add teammates.
              </p>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Create team"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/dashboard/teams">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
