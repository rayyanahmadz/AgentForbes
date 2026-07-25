import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Database, FileText, Plus, Trash2, Type } from "lucide-react";
import { Button, Card, CardContent } from "@agentforge/ui";

import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase/client";
import type { KnowledgeSource } from "@/lib/supabase/types";

export function KnowledgeListPage() {
  const { organization, isLoading: isOrgLoading } = useOrganization();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    if (!organization) return;

    setIsLoading(true);
    const { data, error: fetchError } = await supabase
      .from("knowledge_sources")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setSources(data ?? []);
    }
    setIsLoading(false);
  }, [organization]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  async function handleDelete(source: KnowledgeSource) {
    const confirmed = window.confirm(
      `Delete "${source.name}"? Any employees using it will stop referencing it.`
    );
    if (!confirmed) return;

    setDeletingId(source.id);

    if (source.file_path) {
      await supabase.storage.from("knowledge-files").remove([source.file_path]);
    }

    const { error: deleteError } = await supabase
      .from("knowledge_sources")
      .delete()
      .eq("id", source.id);

    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSources((current) => current.filter((item) => item.id !== source.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Text and documents your AI Employees can be grounded in.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/knowledge/new">
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add source
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isOrgLoading || isLoading ? (
        <p className="text-sm text-muted-foreground">Loading knowledge sources…</p>
      ) : sources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Database className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-medium">No knowledge sources yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Paste some text or upload a .txt/.md file, then attach it to an
              employee from that employee's edit page.
            </p>
            <Button asChild size="sm" className="mt-2">
              <Link to="/dashboard/knowledge/new">Add your first source</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sources.map((source) => (
            <Card key={source.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                      {source.source_type === "file" ? (
                        <FileText className="h-4 w-4" strokeWidth={1.75} />
                      ) : (
                        <Type className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{source.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {source.char_count.toLocaleString()} characters
                        {source.file_name ? ` · ${source.file_name}` : ""}
                      </p>
                    </div>
                  </div>
                </div>

                {source.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {source.description}
                  </p>
                )}

                <div className="mt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    disabled={deletingId === source.id}
                    onClick={() => void handleDelete(source)}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {deletingId === source.id ? "Deleting…" : "Delete"}
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
