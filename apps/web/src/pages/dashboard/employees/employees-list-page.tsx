import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Brain, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardContent } from "@agentforge/ui";

import { useOrganization } from "@/contexts/organization-context";
import { getProviderOption } from "@/lib/ai-providers";
import { supabase } from "@/lib/supabase/client";
import type { AiEmployee } from "@/lib/supabase/types";
import type { AiProvider } from "@/lib/supabase/types";

export function EmployeesListPage() {
  const { organization, isLoading: isOrgLoading } = useOrganization();
  const [employees, setEmployees] = useState<AiEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    if (!organization) return;

    setIsLoading(true);
    const { data, error: fetchError } = await supabase
      .from("ai_employees")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setEmployees(data ?? []);
    }
    setIsLoading(false);
  }, [organization]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  async function handleDelete(employee: AiEmployee) {
    const confirmed = window.confirm(
      `Delete "${employee.name}"? This can't be undone.`
    );
    if (!confirmed) return;

    setDeletingId(employee.id);
    const { error: deleteError } = await supabase
      .from("ai_employees")
      .delete()
      .eq("id", employee.id);
    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setEmployees((current) => current.filter((item) => item.id !== employee.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the employees your organization can put to work.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/employees/new">
            <Plus className="h-4 w-4" strokeWidth={2} />
            New employee
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isOrgLoading || isLoading ? (
        <p className="text-sm text-muted-foreground">Loading employees…</p>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Bot className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-medium">No AI Employees yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create your first one to give it a model, instructions, and — in a
              later phase — memory, knowledge, and tools.
            </p>
            <Button asChild size="sm" className="mt-2">
              <Link to="/dashboard/employees/new">Create an employee</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {employees.map((employee) => {
            const providerOption = getProviderOption(
  employee.provider as AiProvider
);
            return (
              <Card key={employee.id}>
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                        <Bot className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{employee.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {providerOption.label} · {employee.model}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        employee.is_active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {employee.is_active ? "Active" : "Draft"}
                    </span>
                  </div>

                  {employee.provider !== "gemini" && (
                    <p className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-400">
                      Only Gemini is wired up to real chat so far — this provider
                      will show an error when you try to chat.
                    </p>
                  )}

                  {employee.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {employee.description}
                    </p>
                  )}

                  <div className="mt-1 flex flex-wrap gap-2">
                    <Button asChild size="sm" className="gap-1.5">
                      <Link to={`/dashboard/employees/${employee.id}/chat`}>
                        <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Chat
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link to={`/dashboard/employees/${employee.id}/edit`}>
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Edit
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link to={`/dashboard/employees/${employee.id}/memories`}>
                        <Brain className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Memory
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={deletingId === employee.id}
                      onClick={() => void handleDelete(employee)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {deletingId === employee.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
