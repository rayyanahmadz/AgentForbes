// Public API: POST /functions/v1/api-team-chat
// Authorization: Bearer af_live_...
// Body: { teamId: string, message: string, teamConversationId?: string }
//
// Same lead-routes-to-teammate logic as the internal team-chat function,
// but a plain JSON response instead of SSE, and authenticated by API key
// instead of a Supabase session.
//
// Deploy with: supabase functions deploy api-team-chat --no-verify-jwt

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
  callGeminiOnce,
  callGeminiOnceWithHistory,
  chargeOneCredit,
  hasCredits
} from "../_shared/grounding.ts";

interface ApiTeamChatBody {
  teamId: string;
  message: string;
  teamConversationId?: string;
}

interface EmployeeRow {
  id: string;
  name: string;
  description: string | null;
  provider: string;
  model: string;
  instructions: string | null;
  temperature: number;
}

function buildRoutingInstruction(
  teamName: string,
  members: { name: string; note: string | null }[]
): string {
  const memberLines = members.map((m) => `- ${m.name}${m.note ? `: ${m.note}` : ""}`).join("\n");
  return (
    `You are a routing dispatcher for the "${teamName}" team. Your only job is ` +
    `to pick who should handle the user's message — you never answer it yourself.\n\n` +
    `Team members available:\n${memberLines}\n\n` +
    `Respond with ONLY the exact name of the single best member to handle this ` +
    `message, copied exactly as listed above. If none fit well, respond with ` +
    `exactly: SELF\n\nNo other text, no punctuation, no explanation.`
  );
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

  let body: ApiTeamChatBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.teamId || !body.message?.trim()) {
    return jsonResponse({ error: "teamId and message are required" }, 400);
  }

  if (!(await hasCredits(adminClient, auth.organizationId))) {
    return jsonResponse(
      { error: "This organization is out of AI credits. Buy more from the AgentForge dashboard." },
      402
    );
  }

  const { data: team, error: teamError } = await adminClient
    .from("teams")
    .select("id, name, lead_ai_employee_id")
    .eq("id", body.teamId)
    .eq("organization_id", auth.organizationId)
    .single();

  if (teamError || !team) {
    return jsonResponse({ error: "No such team in this organization." }, 404);
  }

  const { data: lead, error: leadError } = await adminClient
    .from("ai_employees")
    .select("id, name, description, provider, model, instructions, temperature")
    .eq("id", team.lead_ai_employee_id)
    .eq("organization_id", auth.organizationId)
    .single<EmployeeRow>();

  if (leadError || !lead) {
    return jsonResponse({ error: "Team lead employee not found." }, 404);
  }

  if (lead.provider !== "gemini") {
    return jsonResponse(
      {
        error: `This team's lead ("${lead.name}") uses the "${lead.provider}" provider, which isn't wired up yet. Only Gemini works end to end so far.`
      },
      422
    );
  }

  const { data: memberRows } = await adminClient
    .from("team_members")
    .select("role_note, ai_employees (id, name, description, provider, model, instructions, temperature)")
    .eq("team_id", team.id);

  const members = (memberRows ?? [])
    .map((row) => ({
      note: row.role_note as string | null,
      employee: row.ai_employees as unknown as EmployeeRow | null
    }))
    .filter((m): m is { note: string | null; employee: EmployeeRow } => Boolean(m.employee));

  const { data: keyRow } = await adminClient
    .from("organization_api_keys")
    .select("api_key")
    .eq("organization_id", auth.organizationId)
    .eq("provider", "gemini")
    .maybeSingle();

  if (!keyRow?.api_key) {
    return jsonResponse(
      { error: "No Gemini API key is configured for this organization. Add one in Organization settings." },
      422
    );
  }

  // Resolve or create the team conversation.
  let conversationId = body.teamConversationId ?? null;

  if (conversationId) {
    const { data: existing } = await adminClient
      .from("team_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("team_id", team.id)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (!existing) {
      return jsonResponse(
        { error: "teamConversationId not found for this team/organization." },
        404
      );
    }
  } else {
    const { data: created, error: createError } = await adminClient
      .from("team_conversations")
      .insert({
        organization_id: auth.organizationId,
        team_id: team.id,
        created_by: auth.createdBy,
        title: body.message.trim().slice(0, 60)
      })
      .select("id")
      .single();

    if (createError || !created) {
      return jsonResponse({ error: "Couldn't start a team conversation." }, 500);
    }
    conversationId = created.id;
  }

  await adminClient.from("team_messages").insert({
    organization_id: auth.organizationId,
    team_conversation_id: conversationId,
    role: "user",
    content: body.message.trim()
  });

  let chosen: EmployeeRow = lead;

  if (members.length > 0) {
    const routingResult = await callGeminiOnce({
      apiKey: keyRow.api_key,
      model: lead.model,
      temperature: 0.1,
      systemInstruction: buildRoutingInstruction(
        team.name,
        members.map((m) => ({ name: m.employee.name, note: m.note ?? m.employee.description }))
      ),
      prompt: body.message.trim()
    });

    if ("text" in routingResult) {
      const pick = routingResult.text.trim().replace(/^["'.]+|["'.]+$/g, "");
      const match = members.find((m) => m.employee.name.toLowerCase() === pick.toLowerCase());
      if (match) chosen = match.employee;
    }
  }

  if (chosen.provider !== "gemini") {
    return jsonResponse(
      {
        error: `"${chosen.name}" uses the "${chosen.provider}" provider, which isn't wired up yet. Only Gemini works end to end so far.`
      },
      422
    );
  }

  const { data: attachedSources } = await adminClient
    .from("ai_employee_knowledge_sources")
    .select("knowledge_sources (name, content)")
    .eq("ai_employee_id", chosen.id);

  const knowledgeContext = buildKnowledgeContext(
    (attachedSources ?? [])
      .map((row) => row.knowledge_sources)
      .filter((s): s is { name: string; content: string } => Boolean(s))
  );

  const { data: memoryRows } = await adminClient
    .from("employee_memories")
    .select("content")
    .eq("ai_employee_id", chosen.id)
    .order("created_at", { ascending: false });

  const memoryContext = buildMemoryContext(memoryRows ?? []);
  const systemInstruction = buildSystemInstruction(chosen.instructions, memoryContext, knowledgeContext);

  const { data: history } = await adminClient
    .from("team_messages")
    .select("role, content")
    .eq("team_conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const geminiContents = (history ?? []).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const result = await callGeminiOnceWithHistory({
    apiKey: keyRow.api_key,
    model: chosen.model,
    temperature: Number(chosen.temperature),
    systemInstruction,
    contents: geminiContents
  });

  if ("error" in result) {
    return jsonResponse({ error: result.error }, 502);
  }

  await adminClient.from("team_messages").insert({
    organization_id: auth.organizationId,
    team_conversation_id: conversationId,
    role: "assistant",
    content: result.text,
    responded_by_employee_id: chosen.id
  });

  await chargeOneCredit(adminClient, auth.organizationId, "team_chat", conversationId);

  return jsonResponse({
    teamConversationId: conversationId,
    respondedBy: { id: chosen.id, name: chosen.name },
    message: { role: "assistant", content: result.text }
  });
});
