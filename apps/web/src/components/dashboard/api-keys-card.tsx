import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@agentforge/ui";

import { supabase } from "@/lib/supabase/client";
import type { OrgRole } from "@/lib/supabase/types";

interface ApiKeysCardProps {
  organizationId: string;
  role: OrgRole | null;
}

export function ApiKeysCard({ organizationId, role }: ApiKeysCardProps) {
  const canEdit = role === "owner" || role === "admin";

  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [newKey, setNewKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    let isMounted = true;

    supabase
      .rpc("has_org_api_key", { target_org_id: organizationId, target_provider: "gemini" })
      .then(({ data }) => {
        if (isMounted) setIsConfigured(Boolean(data));
      });

    return () => {
      isMounted = false;
    };
  }, [organizationId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newKey.trim()) return;

    setIsSaving(true);
    setStatus(null);

    // Try update first (key already exists), fall back to insert.
    const { error: updateError, count } = await supabase
      .from("organization_api_keys")
      .update({ api_key: newKey.trim() }, { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("provider", "gemini");

    let finalError = updateError;

    if (!updateError && count === 0) {
      const { error: insertError } = await supabase.from("organization_api_keys").insert({
        organization_id: organizationId,
        provider: "gemini",
        api_key: newKey.trim()
      });
      finalError = insertError;
    }

    setIsSaving(false);

    if (finalError) {
      setStatus({ type: "error", message: finalError.message });
      return;
    }

    setNewKey("");
    setIsConfigured(true);
    setStatus({ type: "success", message: "Gemini API key saved." });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider API keys</CardTitle>
        <CardDescription>
          {canEdit
            ? "Bring your own key so employees using this provider can actually chat. We never display a saved key back — only whether one is set."
            : "Ask an owner or admin to configure provider API keys."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="geminiKey">
              Gemini API key{" "}
              <span className="font-normal text-muted-foreground">
                (
                {isConfigured === null
                  ? "checking…"
                  : isConfigured
                    ? "configured ✓"
                    : "not configured"}
                )
              </span>
            </Label>
            <Input
              id="geminiKey"
              type="password"
              autoComplete="off"
              placeholder={isConfigured ? "Enter a new key to replace it" : "Paste your Gemini API key"}
              value={newKey}
              onChange={(event) => setNewKey(event.target.value)}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              Get a free key at{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                aistudio.google.com/app/apikey
              </a>
              . Other providers land in the AI Provider Adapters phase.
            </p>
          </div>

          {status && (
            <p
              className={
                status.type === "success" ? "text-sm text-primary" : "text-sm text-destructive"
              }
            >
              {status.message}
            </p>
          )}

          {canEdit && (
            <div>
              <Button type="submit" disabled={isSaving || !newKey.trim()}>
                {isSaving ? "Saving…" : "Save key"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
