import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Play, Plus, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { Button, Card, CardContent } from "@agentforge/ui";

import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase/client";
import type { Workflow } from "@/lib/supabase/types";

interface WorkflowWithStepCount extends Workflow {
  stepCount: number;
}

export function WorkflowsListPage() {
  const { organization, isLoading: isOrgLoading } = useOrganization();
  const [workflows, setWorkflows] = useState<WorkflowWithStepCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadWorkflows = useCallback(async () => {
    if (!organization) return;

    setIsLoading(true);
    const { data, error: fetchError } = await supabase
      .from("workflows")
      .select("*, workflow_steps(count)")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setWorkflows(
        (data ?? []).map((row) => ({
          ...row,
          stepCount: (row as unknown as { workflow_steps: { count: number }[] })
            .workflow_steps?.[0]?.count ?? 0
        }))
      );
    }
    setIsLoading(false);
  }, [organization]);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  async function handleDelete(workflow: Workflow) {
    const confirmed = window.confirm(
      `Delete "${workflow.name}"? Its run history will be deleted too. This can't be undone.`
    );
    if (!confirmed) return;

    setDeletingId(workflow.id);
    const { error: deleteError } = await supabase
      .from("workflows")
      .delete()
      .eq("id", workflow.id);
    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setWorkflows((current) => current.filter((item) => item.id !== workflow.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chain AI Employees into a multi-step, ordered automation.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/workflows/new">
            <Plus className="h-4 w-4" strokeWidth={2} />
            New workflow
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isOrgLoading || isLoading ? (
        <p className="text-sm text-muted-foreground">Loading workflows…</p>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <WorkflowIcon className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-medium">No workflows yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Chain two or more AI Employees together — each step's prompt can use
              the previous step's output.
            </p>
            <Button asChild size="sm" className="mt-2">
              <Link to="/dashboard/workflows/new">Create your first workflow</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                    <WorkflowIcon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{workflow.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {workflow.stepCount} {workflow.stepCount === 1 ? "step" : "steps"}
                    </p>
                  </div>
                </div>

                {workflow.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {workflow.description}
                  </p>
                )}

                <div className="mt-1 flex flex-wrap gap-2">
                  <Button asChild size="sm" className="gap-1.5">
                    <Link to={`/dashboard/workflows/${workflow.id}/run`}>
                      <Play className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Run
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <Link to={`/dashboard/workflows/${workflow.id}/edit`}>
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    disabled={deletingId === workflow.id}
                    onClick={() => void handleDelete(workflow)}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {deletingId === workflow.id ? "Deleting…" : "Delete"}
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
