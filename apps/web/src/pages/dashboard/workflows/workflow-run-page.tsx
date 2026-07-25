import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Play, X } from "lucide-react";
import { Button, Card, CardContent, Textarea } from "@agentforge/ui";

import { streamWorkflowRun } from "@/lib/workflow-client";
import { supabase } from "@/lib/supabase/client";
import type { Workflow, WorkflowRun, WorkflowStep, WorkflowStepRun } from "@/lib/supabase/types";

interface StepProgress {
  status: "pending" | "running" | "completed" | "failed";
  output?: string;
  error?: string;
}

export function WorkflowRunPage() {
  const { workflowId } = useParams<{ workflowId: string }>();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState<Record<number, StepProgress>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [pastRuns, setPastRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [selectedRunSteps, setSelectedRunSteps] = useState<WorkflowStepRun[]>([]);

  const loadPastRuns = useCallback(async () => {
  if (!workflowId) return;

  const id = workflowId;

  const { data } = await supabase
    .from("workflow_runs")
    .select("*")
.eq("id", id)      .order("created_at", { ascending: false })
      .limit(20);
    setPastRuns(data ?? []);
  }, [workflowId]);

  useEffect(() => {
  if (!workflowId) return;

  const id = workflowId;

  async function load() {
      const [{ data: workflowData }, { data: stepData }] = await Promise.all([
        supabase.from("workflows").select("*").eq("id", id).single(),
        supabase
          .from("workflow_steps")
          .select("*")
.eq("workflow_id", id)          .order("step_order", { ascending: true })
      ]);
      setWorkflow(workflowData ?? null);
      setSteps(stepData ?? []);
    }

    void load();
    void loadPastRuns();
  }, [workflowId, loadPastRuns]);

  async function handleRun() {
  if (!workflowId || isRunning) return;

  const id = workflowId;

  setIsRunning(true);
  setRunError(null);
    setSelectedRun(null);
    setProgress(
      Object.fromEntries(steps.map((step) => [step.step_order, { status: "pending" as const }]))
    );

await streamWorkflowRun(id, input, {      onStepStart: (stepOrder) => {
        setProgress((current) => ({ ...current, [stepOrder]: { status: "running" } }));
      },
      onStepComplete: (stepOrder, output) => {
        setProgress((current) => ({ ...current, [stepOrder]: { status: "completed", output } }));
      },
      onStepError: (stepOrder, message) => {
        setProgress((current) => ({
          ...current,
          [stepOrder]: { status: "failed", error: message }
        }));
      },
      onRunComplete: () => {
        setIsRunning(false);
        void loadPastRuns();
      },
      onRunFailed: (message) => {
        setRunError(message);
        setIsRunning(false);
        void loadPastRuns();
      }
    });

    setIsRunning(false);
  }

  async function handleSelectRun(run: WorkflowRun) {
    setSelectedRun(run);
    const { data } = await supabase
      .from("workflow_step_runs")
      .select("*")
      .eq("workflow_run_id", run.id)
      .order("step_order", { ascending: true });
    setSelectedRunSteps(data ?? []);
  }

  if (!workflow) {
    return <p className="text-sm text-muted-foreground">Loading workflow…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/dashboard/workflows">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{workflow.name}</h1>
          {workflow.description && (
            <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <Textarea
            rows={4}
            placeholder="Enter the input for this run…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={isRunning}
          />
          <div>
            <Button onClick={() => void handleRun()} disabled={isRunning} className="gap-1.5">
              <Play className="h-4 w-4" strokeWidth={1.75} />
              {isRunning ? "Running…" : "Run workflow"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {runError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {runError}
        </div>
      )}

      {Object.keys(progress).length > 0 && (
        <div className="flex flex-col gap-3">
          {steps.map((step) => {
            const stepProgress = progress[step.step_order];
            if (!stepProgress) return null;

            return (
              <Card key={step.id}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-2">
                    <StepStatusIcon status={stepProgress.status} />
                    <p className="text-sm font-medium">
                      {step.step_order}. {step.name}
                    </p>
                  </div>
                  {stepProgress.output && (
                    <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                      {stepProgress.output}
                    </p>
                  )}
                  {stepProgress.error && (
                    <p className="text-sm text-destructive">{stepProgress.error}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Past runs</h2>
        {pastRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pastRuns.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => void handleSelectRun(run)}
                  className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-accent/50"
                >
                  <span className="truncate">{new Date(run.created_at).toLocaleString()}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      run.status === "completed"
                        ? "bg-primary/10 text-primary"
                        : run.status === "failed"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {run.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedRun && (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4">
              <p className="text-sm font-medium">
                Run from {new Date(selectedRun.created_at).toLocaleString()}
              </p>
              {selectedRunSteps.map((stepRun) => (
                <div key={stepRun.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <StepStatusIcon status={stepRun.status} />
                    <p className="text-xs font-medium text-muted-foreground">
                      Step {stepRun.step_order}
                    </p>
                  </div>
                  {stepRun.output && (
                    <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                      {stepRun.output}
                    </p>
                  )}
                  {stepRun.error && <p className="text-sm text-destructive">{stepRun.error}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StepStatusIcon({ status }: { status: string }) {
  if (status === "completed") {
    return <Check className="h-4 w-4 text-primary" strokeWidth={2} />;
  }
  if (status === "failed") {
    return <X className="h-4 w-4 text-destructive" strokeWidth={2} />;
  }
  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.75} />;
  }
  return <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />;
}
