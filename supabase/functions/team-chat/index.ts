// Supabase Edge Function: team-chat
//
// Runs on Deno. Deploy with: supabase functions deploy team-chat
// Requires the same auto-provided secrets as chat and run-workflow.
//
// For each incoming message: the team's lead employee makes one quick,
// low-temperature classification call to decide which teammate (or itself,
// "SELF") is best suited to answer. That chosen employee — with its own
// knowledge, memory, and instructions, same as a normal chat — then
// generates the actual streamed reply. This is dynamic, per-message routing:
// different from Workflow Builder's fixed, pre-defined step order.
//
// Scope for this phase: both the lead (for routing) and whichever employee
// is ultimately chosen must use the Gemini provider — same constraint as
// every other AI-calling feature so far.
//
// Billing: 1 credit total per user message, bundling both the routing call
// and the chosen teammate's reply — checked before, charged after success.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  CORS_HEADERS,
  buildKnowledgeContext,
  buildMemoryContext,
  buildSystemInstruction,
  callGeminiOnce,
  chargeOneCredit,
  hasCredits,
  streamGeminiSSE,
  sseEvent
} from "../_shared/grounding.ts";

interface TeamChatRequestBody {
  teamConversationId: string;
  message: string;
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

// Exported so this pure string-building logic can be unit tested directly
// (see index.test.ts) without needing to mock the whole request handler.
export function buildRoutingInstruction(
  teamName: string,
  members: { name: string; note: string | null }[]
): string {
  const memberLines = members
    .map((m) => `- ${m.name}${m.note ? `: ${m.note}` : ""}`)
    .join("\n");

  return (
    `You are a routing dispatcher for the "${teamName}" team. Your only job is ` +
    `to pick who should handle the user's message — you never answer it yourself.\n\n` +
    `Team members available:\n${memberLines}\n\n` +
    `Respond with ONLY the exact name of the single best member to handle this ` +
    `message, copied exactly as listed above. If none fit well, respond with ` +
    `exactly: SELF\n\nNo other text, no punctuation, no explanation.`
  );
}

// Exported so this pure parsing/matching logic can be unit tested directly
// (see index.test.ts). Any unparseable or unmatched response (including the
// literal "SELF") returns null, and the caller falls back to the lead
// answering directly — routing failure never blocks the conversation.
export function matchTeamMemberByName<T extends { name: string }>(
  rawResponseText: string,
  members: { name: string; employee: T }[]
): T | null {
  const pick = rawResponseText.trim().replace(/^["'.]+|["'.]+$/g, "");
  const match = members.find((m) => m.name.toLowerCase() === pick.toLowerCase());
  return match ? match.employee : null;
}

// Guarded so importing the pure functions above (buildRoutingInstruction,
// matchTeamMemberByName) for unit testing doesn't also start a real server
// as an import side effect — import.meta.main is true only when this file
// is run directly, exactly how Supabase's Edge Runtime invokes it in
// production, so this changes nothing about real deployments.
if (import.meta.main) {
  Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Missing Authorization header", { status: 401, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user }
  } = await userClient.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  let body: TeamChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: CORS_HEADERS });
  }

  if (!body.teamConversationId || !body.message?.trim()) {
    return new Response("teamConversationId and message are required", {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  // RLS (is_org_member) proves this user may access this team conversation.
  const { data: conversation, error: conversationError } = await userClient
    .from("team_conversations")
    .select("id, organization_id, team_id")
    .eq("id", body.teamConversationId)
    .single();

  if (conversationError || !conversation) {
    return new Response("Team conversation not found", { status: 404, headers: CORS_HEADERS });
  }

  if (!(await hasCredits(userClient, conversation.organization_id))) {
    return new Response(
      sseEvent("error", {
        message: "Your organization is out of AI credits. Buy more from the Wallet page."
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" } }
    );
  }

  const { data: team, error: teamError } = await userClient
    .from("teams")
    .select("id, name, lead_ai_employee_id")
    .eq("id", conversation.team_id)
    .single();

  if (teamError || !team) {
    return new Response("Team not found", { status: 404, headers: CORS_HEADERS });
  }

  const { data: lead, error: leadError } = await userClient
    .from("ai_employees")
    .select("id, name, description, provider, model, instructions, temperature")
    .eq("id", team.lead_ai_employee_id)
    .single<EmployeeRow>();

  if (leadError || !lead) {
    return new Response("Team lead employee not found", { status: 404, headers: CORS_HEADERS });
  }

  if (lead.provider !== "gemini") {
    return new Response(
      sseEvent("error", {
        message: `This team's lead ("${lead.name}") uses the "${lead.provider}" provider, which isn't wired up yet. Only Gemini works end to end so far — switch the lead to a Gemini employee.`
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" } }
    );
  }

  const { data: memberRows } = await userClient
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
    .eq("organization_id", conversation.organization_id)
    .eq("provider", "gemini")
    .maybeSingle();

  if (!keyRow?.api_key) {
    return new Response(
      sseEvent("error", {
        message:
          "No Gemini API key is configured for this organization yet. Add one in Organization settings."
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" } }
    );
  }

  const { error: insertUserMessageError } = await userClient.from("team_messages").insert({
    organization_id: conversation.organization_id,
    team_conversation_id: conversation.id,
    role: "user",
    content: body.message.trim()
  });

  if (insertUserMessageError) {
    return new Response(sseEvent("error", { message: insertUserMessageError.message }), {
      headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" }
    });
  }

  // Decide who answers: skip the routing call entirely if there are no
  // members to route to.
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
      const match = matchTeamMemberByName(
        routingResult.text,
        members.map((m) => ({ name: m.employee.name, employee: m.employee }))
      );
      if (match) {
        chosen = match;
      }
      // Anything else (including a literal "SELF" or an unparseable
      // response) safely falls back to the lead — never left unhandled.
    }
    // A routing error also safely falls back to the lead answering directly.
  }

  if (chosen.provider !== "gemini") {
    return new Response(
      sseEvent("error", {
        message: `"${chosen.name}" uses the "${chosen.provider}" provider, which isn't wired up yet. Only Gemini works end to end so far.`
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" } }
    );
  }

  const { data: attachedSources } = await userClient
    .from("ai_employee_knowledge_sources")
    .select("knowledge_sources (name, content)")
    .eq("ai_employee_id", chosen.id);

  const knowledgeContext = buildKnowledgeContext(
    (attachedSources ?? [])
      .map((row) => row.knowledge_sources)
      .filter((s): s is { name: string; content: string } => Boolean(s))
  );

  const { data: memoryRows } = await userClient
    .from("employee_memories")
    .select("content")
    .eq("ai_employee_id", chosen.id)
    .order("created_at", { ascending: false });

  const memoryContext = buildMemoryContext(memoryRows ?? []);
  const systemInstruction = buildSystemInstruction(
    chosen.instructions,
    memoryContext,
    knowledgeContext
  );

  const { data: history } = await userClient
    .from("team_messages")
    .select("role, content")
    .eq("team_conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  const geminiContents = (history ?? []).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(event, data)));

      send("picked", { employeeName: chosen.name, employeeId: chosen.id });

      try {
        const result = await streamGeminiSSE({
          apiKey: keyRow.api_key,
          model: chosen.model,
          temperature: Number(chosen.temperature),
          systemInstruction,
          contents: geminiContents,
          onDelta: (text) => send("delta", { text })
        });

        if ("error" in result) {
          send("error", { message: result.error });
          return;
        }

        await userClient.from("team_messages").insert({
          organization_id: conversation.organization_id,
          team_conversation_id: conversation.id,
          role: "assistant",
          content: result.fullText.trim(),
          responded_by_employee_id: chosen.id
        });

        // One credit total per user-facing message, bundling both the
        // lead's routing call and the chosen teammate's reply — the user
        // sent one message, so they're charged once, regardless of how many
        // Gemini calls happened internally to answer it.
        await chargeOneCredit(adminClient, conversation.organization_id, "team_chat", conversation.id);

        send("done", {});
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Unknown error running team chat"
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
  });
}
