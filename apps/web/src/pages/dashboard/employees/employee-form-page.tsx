import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Database } from "lucide-react";
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
import { AI_PROVIDERS, getProviderOption } from "@/lib/ai-providers";
import { supabase } from "@/lib/supabase/client";
import type { AiProvider, KnowledgeSource } from "@/lib/supabase/types";

interface FormState {
  name: string;
  description: string;
  instructions: string;
  provider: AiProvider;
  model: string;
  temperature: number;
  isActive: boolean;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  instructions: "",
  provider: "gemini",
  model: getProviderOption("gemini").suggestedModel,
  temperature: 0.7,
  isActive: true
};

export function EmployeeFormPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const isEditing = Boolean(employeeId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [initialSourceIds, setInitialSourceIds] = useState<Set<string>>(new Set());

  // Load this org's available knowledge sources.
  useEffect(() => {
    if (!organization) return;

    supabase
      .from("knowledge_sources")
      .select("*")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true })
      .then(({ data }) => setKnowledgeSources(data ?? []));
  }, [organization]);

  // If editing, load which sources are already attached.
  useEffect(() => {
    if (!isEditing || !employeeId) return;

    supabase
      .from("ai_employee_knowledge_sources")
      .select("knowledge_source_id")
      .eq("ai_employee_id", employeeId)
      .then(({ data }) => {
        const ids = new Set((data ?? []).map((row) => row.knowledge_source_id));
        setSelectedSourceIds(ids);
        setInitialSourceIds(ids);
      });
  }, [isEditing, employeeId]);

  function toggleSource(sourceId: string) {
    setSelectedSourceIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!isEditing || !employeeId) return;

    let isMounted = true;
    setIsLoading(true);

    supabase
      .from("ai_employees")
      .select("*")
      .eq("id", employeeId)
      .single()
      .then(({ data, error: fetchError }) => {
        if (!isMounted) return;
        if (fetchError) {
          setError(fetchError.message);
        } else if (data) {
          setForm({
            name: data.name,
            description: data.description ?? "",
            instructions: data.instructions ?? "",
provider: data.provider as AiProvider,            model: data.model,
            temperature: Number(data.temperature),
            isActive: data.is_active
          });
        }
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isEditing, employeeId]);

  function handleProviderChange(provider: AiProvider) {
    setForm((current) => ({
      ...current,
      provider,
      // Only swap in the suggested model if the field still holds the
      // previous provider's suggestion — don't clobber a custom value.
      model:
        current.model === getProviderOption(current.provider).suggestedModel
          ? getProviderOption(provider).suggestedModel
          : current.model
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !user) return;

    setIsSaving(true);
    setError(null);

    const payload = {
      organization_id: organization.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      instructions: form.instructions.trim() || null,
      provider: form.provider,
      model: form.model.trim(),
      temperature: form.temperature,
      is_active: form.isActive
    };

    let savedEmployeeId = employeeId ?? null;

    if (isEditing && employeeId) {
      const { error: updateError } = await supabase
        .from("ai_employees")
        .update(payload)
        .eq("id", employeeId);
      if (updateError) {
        setError(updateError.message);
        setIsSaving(false);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("ai_employees")
        .insert({ ...payload, created_by: user.id })
        .select("id")
        .single();
      if (insertError || !data) {
        setError(insertError?.message ?? "Couldn't create the employee.");
        setIsSaving(false);
        return;
      }
      savedEmployeeId = data.id;
    }

    // Sync knowledge source attachments: only touch what actually changed.
    if (savedEmployeeId) {
      const toAttach = [...selectedSourceIds].filter((id) => !initialSourceIds.has(id));
      const toDetach = [...initialSourceIds].filter((id) => !selectedSourceIds.has(id));

      if (toAttach.length > 0) {
        const { error: attachError } = await supabase
          .from("ai_employee_knowledge_sources")
          .insert(
            toAttach.map((knowledgeSourceId) => ({
              organization_id: organization.id,
              ai_employee_id: savedEmployeeId!,
              knowledge_source_id: knowledgeSourceId
            }))
          );
        if (attachError) {
          setError(attachError.message);
          setIsSaving(false);
          return;
        }
      }

      if (toDetach.length > 0) {
        const { error: detachError } = await supabase
          .from("ai_employee_knowledge_sources")
          .delete()
          .eq("ai_employee_id", savedEmployeeId)
          .in("knowledge_source_id", toDetach);
        if (detachError) {
          setError(detachError.message);
          setIsSaving(false);
          return;
        }
      }
    }

    setIsSaving(false);
    navigate("/dashboard/employees");
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEditing ? "Edit AI Employee" : "New AI Employee"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Memory and tools are added in later phases — this covers the employee's
          core spec plus which knowledge sources it can reference.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Name it and describe what it's for.</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="employee-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                placeholder="e.g. Support Agent"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="One line about what this employee does"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                rows={5}
                placeholder="How should this employee behave? What does it know, and what should it avoid?"
                value={form.instructions}
                onChange={(event) =>
                  setForm((current) => ({ ...current, instructions: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="provider">Provider</Label>
                <Select
                  id="provider"
                  value={form.provider}
                  onChange={(event) => handleProviderChange(event.target.value as AiProvider)}
                >
                  {AI_PROVIDERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  {getProviderOption(form.provider).note}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  required
                  value={form.model}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, model: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="temperature">
                Temperature <span className="text-muted-foreground">({form.temperature.toFixed(1)})</span>
              </Label>
              <input
                id="temperature"
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={form.temperature}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    temperature: Number(event.target.value)
                  }))
                }
                className="accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                Lower is more focused and consistent; higher is more varied and
                creative.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="isActive">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive employees are kept as drafts and won't be usable once
                  chat lands.
                </p>
              </div>
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isActive: checked }))
                }
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" strokeWidth={1.75} />
            Knowledge sources
          </CardTitle>
          <CardDescription>
            {knowledgeSources.length === 0 ? (
              <>
                No knowledge sources yet —{" "}
                <Link to="/dashboard/knowledge/new" className="underline">
                  add one
                </Link>{" "}
                first, then attach it here.
              </>
            ) : (
              "Choose which sources this employee can reference in chat."
            )}
          </CardDescription>
        </CardHeader>
        {knowledgeSources.length > 0 && (
          <CardContent>
            <ul className="flex flex-col gap-2">
              {knowledgeSources.map((source) => (
                <li key={source.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm hover:bg-accent/50">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-primary"
                      checked={selectedSourceIds.has(source.id)}
                      onChange={() => toggleSource(source.id)}
                      form="employee-form"
                    />
                    <span>
                      <span className="font-medium">{source.name}</span>
                      {source.description && (
                        <span className="block text-xs text-muted-foreground">
                          {source.description}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" form="employee-form" disabled={isSaving}>
          {isSaving ? "Saving…" : isEditing ? "Save changes" : "Create employee"}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link to="/dashboard/employees">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
