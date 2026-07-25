import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Switch,
  Textarea
} from "@agentforge/ui";

import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase/client";
import type { AiEmployee } from "@/lib/supabase/types";

const MAX_STEPS = 10;

interface StepDraft {
  key: string;
  name: string;
  aiEmployeeId: string;
  promptTemplate: string;
}

function newStep(defaultEmployeeId: string): StepDraft {
  return {
    key: crypto.randomUUID(),
    name: "",
    aiEmployeeId: defaultEmployeeId,
    promptTemplate: ""
  };
}

export function WorkflowFormPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const isEditing = Boolean(workflowId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();

  const [employees, setEmployees] = useState<AiEmployee[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load this org's employees, to populate each step's dropdown.
  useEffect(() => {
    if (!organization) return;

    supabase
      .from("ai_employees")
      .select("*")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true })
      .then(({ data }) => setEmployees(data ?? []));
  }, [organization]);

  // If editing, load the workflow + its steps.
  useEffect(() => {
    if (!isEditing || !workflowId) return;

    let isMounted = true;
    setIsLoading(true);

    async function load() {
      const [{ data: workflow, error: workflowError }, { data: stepRows }] = await Promise.all([
        supabase.from("workflows").select("*").eq("id", workflowId).single(),
        supabase
          .from("workflow_steps")
          .select("*")
          .eq("workflow_id", workflowId)
          .order("step_order", { ascending: true })
      ]);

      if (!isMounted) return;

      if (workflowError) {
        setError(workflowError.message);
      } else if (workflow) {
        setName(workflow.name);
        setDescription(workflow.description ?? "");
        setIsActive(workflow.is_active);
      }

      setSteps(
        (stepRows ?? []).map((row) => ({
          key: row.id,
          name: row.name,
          aiEmployeeId: row.ai_employee_id,
          promptTemplate: row.prompt_template
        }))
      );
      setIsLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [isEditing, workflowId]);

  function addStep() {
    if (steps.length >= MAX_STEPS) return;
    setSteps((current) => [...current, newStep(employees[0]?.id ?? "")]);
  }

  function removeStep(key: string) {
    setSteps((current) => current.filter((step) => step.key !== key));
  }

  function updateStep(key: string, patch: Partial<StepDraft>) {
    setSteps((current) =>
      current.map((step) => (step.key === key ? { ...step, ...patch } : step))
    );
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !user) return;

    if (steps.length === 0) {
      setError("Add at least one step.");
      return;
    }
    if (steps.some((step) => !step.aiEmployeeId || !step.promptTemplate.trim())) {
      setError("Every step needs an AI Employee and a prompt.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const workflowPayload = {
      organization_id: organization.id,
      name: name.trim(),
      description: description.trim() || null,
      is_active: isActive
    };

    let savedWorkflowId = workflowId ?? null;

    if (isEditing && workflowId) {
      const { error: updateError } = await supabase
        .from("workflows")
        .update(workflowPayload)
        .eq("id", workflowId);
      if (updateError) {
        setError(updateError.message);
        setIsSaving(false);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("workflows")
        .insert({ ...workflowPayload, created_by: user.id })
        .select("id")
        .single();
      if (insertError || !data) {
        setError(insertError?.message ?? "Couldn't create the workflow.");
        setIsSaving(false);
        return;
      }
      savedWorkflowId = data.id;
    }

    // Simplest reliable sync: replace all steps rather than diffing.
    if (isEditing && savedWorkflowId) {
      const { error: deleteError } = await supabase
        .from("workflow_steps")
        .delete()
        .eq("workflow_id", savedWorkflowId);
      if (deleteError) {
        setError(deleteError.message);
        setIsSaving(false);
        return;
      }
    }

    const { error: stepsError } = await supabase.from("workflow_steps").insert(
      steps.map((step, index) => ({
        organization_id: organization.id,
        workflow_id: savedWorkflowId!,
        step_order: index + 1,
        name: step.name.trim() || `Step ${index + 1}`,
        ai_employee_id: step.aiEmployeeId,
        prompt_template: step.promptTemplate.trim()
      }))
    );

    setIsSaving(false);

    if (stepsError) {
      setError(stepsError.message);
      return;
    }

    navigate("/dashboard/workflows");
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEditing ? "Edit workflow" : "New workflow"}
        </h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You need at least one AI Employee before you can build a workflow.{" "}
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
          {isEditing ? "Edit workflow" : "New workflow"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Steps run in order. Use <code className="rounded bg-muted px-1">{"{{input}}"}</code>{" "}
          for the run's starting input and{" "}
          <code className="rounded bg-muted px-1">{"{{previous_output}}"}</code> for the
          previous step's result.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Name the workflow and describe what it does.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                placeholder="e.g. Summarize and translate"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="One line about what this workflow does"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="isActive">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive workflows are kept as drafts.
                </p>
              </div>
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {steps.map((step, index) => (
            <Card key={step.key}>
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Step {index + 1}</p>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => moveStep(index, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === steps.length - 1}
                      onClick={() => moveStep(index, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeStep(step.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`step-name-${step.key}`}>Step name (optional)</Label>
                    <Input
                      id={`step-name-${step.key}`}
                      placeholder={`e.g. Summarize`}
                      value={step.name}
                      onChange={(event) => updateStep(step.key, { name: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`step-employee-${step.key}`}>AI Employee</Label>
                    <Select
                      id={`step-employee-${step.key}`}
                      value={step.aiEmployeeId}
                      onChange={(event) =>
                        updateStep(step.key, { aiEmployeeId: event.target.value })
                      }
                    >
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`step-prompt-${step.key}`}>Prompt</Label>
                  <Textarea
                    id={`step-prompt-${step.key}`}
                    rows={3}
                    placeholder={
                      index === 0
                        ? "e.g. Summarize the following in three bullet points:\n\n{{input}}"
                        : "e.g. Translate this to Spanish:\n\n{{previous_output}}"
                    }
                    value={step.promptTemplate}
                    onChange={(event) =>
                      updateStep(step.key, { promptTemplate: event.target.value })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={steps.length >= MAX_STEPS}
            onClick={addStep}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add step
          </Button>
          {steps.length >= MAX_STEPS && (
            <p className="text-xs text-muted-foreground">
              Maximum {MAX_STEPS} steps per workflow.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Create workflow"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/dashboard/workflows">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
