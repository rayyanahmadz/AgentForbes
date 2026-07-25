import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Copy, Key, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@agentforge/ui";

import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase/client";
import type { ApiKey } from "@/lib/supabase/types";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export function ApiKeysPage() {
  const { organization, role } = useOrganization();
  const canManage = role === "owner" || role === "admin";

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    if (!organization) return;
    setIsLoading(true);
    const { data } = await supabase
      .from("api_keys")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false });
    setKeys(data ?? []);
    setIsLoading(false);
  }, [organization]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !newKeyName.trim()) return;

    setIsCreating(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("create_api_key", {
      target_org_id: organization.id,
      key_name: newKeyName.trim()
    });

    setIsCreating(false);

    if (rpcError || !data || data.length === 0) {
      setError(rpcError?.message ?? "Couldn't create the key.");
      return;
    }

    setJustCreatedKey(data[0]!.plaintext_key);
    setNewKeyName("");
    void loadKeys();
  }

  async function handleRevoke(key: ApiKey) {
    const confirmed = window.confirm(
      `Revoke "${key.name}"? Any integration using it will stop working immediately.`
    );
    if (!confirmed) return;

    setRevokingId(key.id);
    const { error: revokeError } = await supabase
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", key.id);
    setRevokingId(null);

    if (revokeError) {
      setError(revokeError.message);
      return;
    }

    void loadKeys();
  }

  function handleCopy() {
    if (!justCreatedKey) return;
    void navigator.clipboard.writeText(justCreatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!canManage) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Only organization owners and admins can view and manage API keys.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Call AgentForge programmatically — chat with an employee, run a
          workflow, or message a team over plain HTTP.
        </p>
      </div>

      {justCreatedKey && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-base">Your new API key</CardTitle>
            <CardDescription>
              Copy it now — for security, it won't be shown again. Only a hash is
              stored from here on.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-sm">
              {justCreatedKey}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Copy
                </>
              )}
            </Button>
            <Button type="button" size="sm" onClick={() => setJustCreatedKey(null)}>
              Done
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create a key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="keyName" className="sr-only">
                Key name
              </Label>
              <Input
                id="keyName"
                placeholder="e.g. Production integration"
                value={newKeyName}
                onChange={(event) => setNewKeyName(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={isCreating || !newKeyName.trim()}>
              {isCreating ? "Creating…" : "Create key"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Your keys</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : keys.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Key className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">No API keys yet.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {keys.map((key) => (
              <li key={key.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{key.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {key.key_prefix}··· · created{" "}
                        {new Date(key.created_at).toLocaleDateString()}
                        {key.last_used_at &&
                          ` · last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          key.is_active
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {key.is_active ? "Active" : "Revoked"}
                      </span>
                      {key.is_active && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={revokingId === key.id}
                          onClick={() => void handleRevoke(key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Using the API</CardTitle>
          <CardDescription>
            Every endpoint takes <code className="rounded bg-muted px-1">Authorization: Bearer &lt;your key&gt;</code>{" "}
            and returns JSON. Only employees/teams on the Gemini provider work end to
            end so far — same as in the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ApiExample
            title="Chat with an employee"
            command={`curl -X POST ${FUNCTIONS_BASE}/api-chat \\
  -H "Authorization: Bearer af_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"employeeId": "<employee-id>", "message": "Hello!"}'`}
          />
          <ApiExample
            title="Run a workflow"
            command={`curl -X POST ${FUNCTIONS_BASE}/api-run-workflow \\
  -H "Authorization: Bearer af_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"workflowId": "<workflow-id>", "input": "..."}'`}
          />
          <ApiExample
            title="Message a team"
            command={`curl -X POST ${FUNCTIONS_BASE}/api-team-chat \\
  -H "Authorization: Bearer af_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"teamId": "<team-id>", "message": "Hello!"}'`}
          />
          <p className="text-xs text-muted-foreground">
            Pass the id returned in the response (<code className="rounded bg-muted px-1">conversationId</code>,{" "}
            <code className="rounded bg-muted px-1">teamConversationId</code>) back on your next call to continue
            the same conversation. Each successful call spends 1 credit from your organization's wallet, same as
            using the dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ApiExample({ title, command }: { title: string; command: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">{title}</p>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
        <code>{command}</code>
      </pre>
    </div>
  );
}
