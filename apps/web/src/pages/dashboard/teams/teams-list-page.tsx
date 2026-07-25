import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button, Card, CardContent } from "@agentforge/ui";

import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase/client";
import type { Team } from "@/lib/supabase/types";

interface TeamWithDetails extends Team {
  leadName: string;
  memberCount: number;
}

export function TeamsListPage() {
  const { organization, isLoading: isOrgLoading } = useOrganization();
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    if (!organization) return;

    setIsLoading(true);
    const { data, error: fetchError } = await supabase
      .from("teams")
      .select("*, ai_employees (name), team_members (count)")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setTeams(
        (data ?? []).map((row) => {
          const cast = row as unknown as {
            ai_employees: { name: string } | null;
            team_members: { count: number }[];
          };
          return {
            ...row,
            leadName: cast.ai_employees?.name ?? "Unknown",
            memberCount: cast.team_members?.[0]?.count ?? 0
          };
        })
      );
    }
    setIsLoading(false);
  }, [organization]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  async function handleDelete(team: Team) {
    const confirmed = window.confirm(
      `Delete "${team.name}"? Its conversation history will be deleted too. This can't be undone.`
    );
    if (!confirmed) return;

    setDeletingId(team.id);
    const { error: deleteError } = await supabase.from("teams").delete().eq("id", team.id);
    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setTeams((current) => current.filter((item) => item.id !== team.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A lead employee routes each message to the best-suited teammate.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/teams/new">
            <Plus className="h-4 w-4" strokeWidth={2} />
            New team
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isOrgLoading || isLoading ? (
        <p className="text-sm text-muted-foreground">Loading teams…</p>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-medium">No teams yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Pick a lead employee and add teammates — the lead decides who answers
              each message.
            </p>
            <Button asChild size="sm" className="mt-2">
              <Link to="/dashboard/teams/new">Create your first team</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                    <Users className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{team.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Lead: {team.leadName} · {team.memberCount}{" "}
                      {team.memberCount === 1 ? "member" : "members"}
                    </p>
                  </div>
                </div>

                {team.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {team.description}
                  </p>
                )}

                <div className="mt-1 flex flex-wrap gap-2">
                  <Button asChild size="sm" className="gap-1.5">
                    <Link to={`/dashboard/teams/${team.id}/chat`}>
                      <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Chat
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <Link to={`/dashboard/teams/${team.id}/edit`}>
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    disabled={deletingId === team.id}
                    onClick={() => void handleDelete(team)}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {deletingId === team.id ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
