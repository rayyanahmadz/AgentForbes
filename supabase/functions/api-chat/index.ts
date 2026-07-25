// Public API: POST /functions/v1/api-chat
// Authorization: Bearer af_live_...
// Body: { employeeId: string, message: string, conversationId?: string }
//
// Returns a plain JSON response (not SSE) — this is for external HTTP
// clients (curl, server-to-server integrations), where a single JSON object
// is the expected shape, not a browser reading a streaming response.
//
// Deploy with: supabase functions deploy api-chat --no-verify-jwt
// (like stripe-webhook, this endpoint's callers don't have a Supabase JWT —
// authentication is entirely the api_keys check in _shared/api-auth.ts)

import {
  API_CORS_HEADERS,
  authenticateApiKey,
  createAdminClient,
  jsonResponse
} from "../_shared/api-auth.ts";
import {
  buildKnowledgeContext,
  buildMemoryContext,
  buildSystemInstruction,
  callGeminiOnceWithHistory,
  chargeOneCredit,
  hasCredits
} from "../_shared/grounding.ts";

interface ApiChatBody {
  employeeId: string;
  message: string;
  conversationId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: API_CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const adminClient = createAdminClient();
  const auth = await authenticateApiKey(req, adminClient);
  if (!auth.ok) {
    return jsonResponse({ error: auth.message }, auth.status);
  }

  let body: ApiChatBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.employeeId || !body.message?.trim()) {
    return jsonResponse({ error: "employeeId and message are required" }, 400);
  }

  if (!(await hasCredits(adminClient, auth.organizationId))) {
    return jsonResponse(
      {
        error:
          "This organization is out of AI credits. Buy more credits from the AgentForge dashboard."
      },
      402
    );
  }

  const { data: employee, error: employeeError } = await adminClient
    .from("ai_employees")
    .select("id, name, provider, model, instructions, temperature")
    .eq("id", body.employeeId)
    .eq("organization_id", auth.organizationId)
    .single();

  if (employeeError || !employee) {
    return jsonResponse({ error: "No such employee in this organization." }, 404);
  }

  if (employee.provider !== "gemini") {
    return jsonResponse(
      {
        error: `This employee uses the "${employee.provider}" provider, which isn't wired up to real chat yet. Only Gemini works end to end so far.`
      },
      422
    );
  }

  const { data: keyRow } = await adminClient
    .from("organization_api_keys")
    .select("api_key")
    .eq("organization_id", auth.organizationId)
    .eq("provider", "gemini")
    .maybeSingle();

  if (!keyRow?.api_key) {
    return jsonResponse(
      {
        error:
          "No Gemini API key is configured for this organization. Add one in Organization settings."
      },
      422
    );
  }

  // Resolve or create the conversation.
  let conversationId = body.conversationId ?? null;

  if (conversationId) {
    const { data: existing } = await adminClient
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("ai_employee_id", employee.id)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (!existing) {
      return jsonResponse(
        { error: "conversationId not found for this employee/organization." },
        404
      );
    }
  } else {
    const { data: created, error: createError } = await adminClient
      .from("conversations")
      .insert({
        organization_id: auth.organizationId,
        ai_employee_id: employee.id,
        created_by: auth.createdBy,
        title: body.message.trim().slice(0, 60)
      })
      .select("id")
      .single();

    if (createError || !created) {
      return jsonResponse({ error: "Couldn't start a conversation." }, 500);
    }
    conversationId = created.id;
  }

  await adminClient.from("messages").insert({
    organization_id: auth.organizationId,
    conversation_id: conversationId,
    role: "user",
    content: body.message.trim()
  });

  // Full history, not just the current message — otherwise a caller
  // continuing an existing conversationId would silently lose all prior
  // context on every turn after the first.
  const { data: history } = await adminClient
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const geminiContents = (history ?? []).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const { data: attachedSources } = await adminClient
    .from("ai_employee_knowledge_sources")
    .select("knowledge_sources (name, content)")
    .eq("ai_employee_id", employee.id);

  const knowledgeContext = buildKnowledgeContext(
    (attachedSources ?? [])
      .map((row) => row.knowledge_sources)
      .filter((s): s is { name: string; content: string } => Boolean(s))
  );

  const { data: memoryRows } = await adminClient
    .from("employee_memories")
    .select("content")
    .eq("ai_employee_id", employee.id)
    .order("created_at", { ascending: false });

  const memoryContext = buildMemoryContext(memoryRows ?? []);
  const systemInstruction = buildSystemInstruction(
    employee.instructions,
    memoryContext,
    knowledgeContext
  );

  const result = await callGeminiOnceWithHistory({
    apiKey: keyRow.api_key,
    model: employee.model,
    temperature: Number(employee.temperature),
    systemInstruction,
    contents: geminiContents
  });

  if ("error" in result) {
    return jsonResponse({ error: result.error }, 502);
  }

  await adminClient.from("messages").insert({
    organization_id: auth.organizationId,
    conversation_id: conversationId,
    role: "assistant",
    content: result.text
  });

  await chargeOneCredit(adminClient, auth.organizationId, "chat", conversationId);

  return jsonResponse({
    conversationId,
    message: { role: "assistant", content: result.text }
  });
});
