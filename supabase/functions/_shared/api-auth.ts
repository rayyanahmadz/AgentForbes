// Shared by every public api-* Edge Function (api-chat, api-run-workflow,
// api-team-chat). These endpoints are called by external HTTP clients with
// a plaintext API key, not a Supabase session — a genuinely different trust
// model from every other function in this project. There is no user JWT to
// scope a userClient with here, so these functions do ALL of their database
// work through the admin (service role) client, after this module has
// independently verified the caller is allowed to act as the key's
// organization.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface ApiKeyContext {
  organizationId: string;
  apiKeyId: string;
  createdBy: string | null;
}

export type ApiKeyAuthResult =
  | ({ ok: true } & ApiKeyContext)
  | { ok: false; status: number; message: string };

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifies the `Authorization: Bearer af_live_...` header against api_keys,
 * using the admin client since there is no Supabase session to check RLS
 * against. Updates last_used_at (best-effort — a failure there never blocks
 * the request).
 */
export async function authenticateApiKey(
  req: Request,
  adminClient: SupabaseClient
): Promise<ApiKeyAuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      message: "Missing or malformed Authorization header. Expected: Bearer af_live_..."
    };
  }

  const plaintextKey = authHeader.slice(7).trim();
  if (!plaintextKey) {
    return { ok: false, status: 401, message: "Empty API key." };
  }

  const keyHash = await sha256Hex(plaintextKey);

  const { data: keyRow, error } = await adminClient
    .from("api_keys")
    .select("id, organization_id, created_by, is_active")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !keyRow) {
    return { ok: false, status: 401, message: "Invalid API key." };
  }

  if (!keyRow.is_active) {
    return { ok: false, status: 401, message: "This API key has been revoked." };
  }

  // Best-effort — an update failure here shouldn't fail the actual request.
  void adminClient
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  return {
    ok: true,
    organizationId: keyRow.organization_id,
    apiKeyId: keyRow.id,
    createdBy: keyRow.created_by
  };
}

export function createAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey);
}

export const API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...API_CORS_HEADERS, "Content-Type": "application/json" }
  });
}
