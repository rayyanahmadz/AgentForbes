import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Brain, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Textarea } from "@agentforge/ui";

import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase/client";
import type { AiEmployee, EmployeeMemory } from "@/lib/supabase/types";

const MAX_MEMORY_CHARS = 1000;

export function EmployeeMemoriesPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { user } = useAuth();
  const { organization } = useOrganization();

  const [employee, setEmployee] = useState<AiEmployee | null>(null);
  const [memories, setMemories] = useState<EmployeeMemory[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!employeeId) return;

    setIsLoading(true);
    const [{ data: employeeData }, { data: memoriesData, error: fetchError }] =
      await Promise.all([
        supabase.from("ai_employees").select("*").eq("id", employeeId).single(),
        supabase
          .from("employee_memories")
          .select("*")
          .eq("ai_employee_id", employeeId)
          .order("created_at", { ascending: false })
      ]);

    setEmployee(employeeData ?? null);
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setMemories(memoriesData ?? []);
    }
    setIsLoading(false);
  }, [employeeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !organization || !employeeId || !user) return;

    setIsSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("employee_memories")
      .insert({
        organization_id: organization.id,
        ai_employee_id: employeeId,
        created_by: user.id,
        content: trimmed
      })
      .select("*")
      .single();

    setIsSaving(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Couldn't save that memory.");
      return;
    }

    setMemories((current) => [data, ...current]);
    setDraft("");
  }

  async function handleDelete(memory: EmployeeMemory) {
    const confirmed = window.confirm("Delete this memory?");
    if (!confirmed) return;

    setDeletingId(memory.id);
    const { error: deleteError } = await supabase
      .from("employee_memories")
      .delete()
      .eq("id", memory.id);
    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMemories((current) => current.filter((item) => item.id !== memory.id));
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/dashboard/employees">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {employee ? `${employee.name}'s memory` : "Memory"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Facts this employee recalls in every conversation — not just the one
            where it learned them.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <Textarea
              rows={3}
              maxLength={MAX_MEMORY_CHARS}
              placeholder="e.g. The user's company is called Acme Corp and they're based in Karachi."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {draft.length}/{MAX_MEMORY_CHARS}
              </p>
              <Button type="submit" size="sm" disabled={isSaving || !draft.trim()}>
                {isSaving ? "Saving…" : "Add memory"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {memories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Brain className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-medium">No memories yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add one above, or save an assistant reply as a memory directly from
              a chat conversation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {memories.map((memory) => (
            <li key={memory.id}>
              <Card>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <p className="whitespace-pre-wrap text-sm">{memory.content}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-destructive hover:text-destructive"
                    disabled={deletingId === memory.id}
                    onClick={() => void handleDelete(memory)}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
