// Supabase Edge Function: chat
//
// Runs on Deno. Deploy with: supabase functions deploy chat
// Requires these secrets to be set (supabase secrets set KEY=value):
//   SUPABASE_URL              — auto-provided by the platform
//   SUPABASE_ANON_KEY         — auto-provided by the platform
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided by the platform
//
// Only Gemini is wired up to a real provider this phase. Every other
// provider returns a clear "not yet supported" error instead of a fake reply.
//
// Knowledge grounding: attached knowledge_sources' text is included directly
// in the system instruction (capped per-source and in total), not retrieved
// via vector search — real embeddings-based RAG is a later enhancement.
//
// Memory: employee_memories are facts retained ACROSS every conversation with
// this employee (not just the current thread's own history), also folded
// into the system instruction, capped separately from knowledge context.
//
// Billing: 1 credit is charged per successful reply — a flat platform usage
// fee on top of whatever the organization's own Gemini key costs them
// directly. Blocked up front at zero balance; never charged for a failed call.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  CORS_HEADERS,
  buildKnowledgeContext,
  buildMemoryContext,
  buildSystemInstruction,
  chargeOneCredit,
  hasCredits,
  sseEvent
} from "../_shared/grounding.ts";

interface ChatRequestBody {
  conversationId: string;
  message: string;
}

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

  // Scoped to the calling user — every query through this client is subject
  // to RLS exactly as if the user made it directly.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  // Bypasses RLS entirely — used ONLY to read the provider API key, which has
  // no select policy for any authenticated role.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user }
  } = await userClient.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: CORS_HEADERS });
  }

  if (!body.conversationId || !body.message?.trim()) {
    return new Response("conversationId and message are required", {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  // Loading through userClient means RLS (is_org_member) already proves this
  // user may access this conversation — no manual membership check needed.
  const { data: conversation, error: conversationError } = await userClient
    .from("conversations")
    .select("id, organization_id, ai_employee_id")
    .eq("id", body.conversationId)
    .single();

  if (conversationError || !conversation) {
    return new Response("Conversation not found", { status: 404, headers: CORS_HEADERS });
  }

  if (!(await hasCredits(userClient, conversation.organization_id))) {
    return new Response(
      sseEvent("error", {
        message: "Your organization is out of AI credits. Buy more from the Wallet page."
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" } }
    );
  }

  const { data: employee, error: employeeError } = await userClient
    .from("ai_employees")
    .select("provider, model, instructions, temperature")
    .eq("id", conversation.ai_employee_id)
    .single();

  if (employeeError || !employee) {
    return new Response("AI Employee not found", { status: 404, headers: CORS_HEADERS });
  }

  // RLS (is_org_member) already scopes this to sources the caller can see —
  // no manual membership check needed here either.
  const { data: attachedSources } = await userClient
    .from("ai_employee_knowledge_sources")
    .select("knowledge_sources (name, content)")
    .eq("ai_employee_id", conversation.ai_employee_id);

  const knowledgeContext = buildKnowledgeContext(
    (attachedSources ?? [])
      .map((row) => row.knowledge_sources)
      .filter((source): source is { name: string; content: string } => Boolean(source))
  );

  const { data: memoryRows } = await userClient
    .from("employee_memories")
    .select("content")
    .eq("ai_employee_id", conversation.ai_employee_id)
    .order("created_at", { ascending: false });

  const memoryContext = buildMemoryContext(memoryRows ?? []);
  const combinedInstructions = buildSystemInstruction(
    employee.instructions,
    memoryContext,
    knowledgeContext
  );

  if (employee.provider !== "gemini") {
    return new Response(
      sseEvent("error", {
        message: `The "${employee.provider}" provider isn't wired up yet — only Gemini works end to end so far. Switch this employee to Gemini, or check back after the AI Provider Adapters phase.`
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" } }
    );
  }

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

  // Persist the user's message before calling the model.
  const { error: insertUserMessageError } = await userClient.from("messages").insert({
    organization_id: conversation.organization_id,
    conversation_id: conversation.id,
    role: "user",
    content: body.message.trim()
  });

  if (insertUserMessageError) {
    return new Response(
      sseEvent("error", { message: insertUserMessageError.message }),
      { headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" } }
    );
  }

  const { data: history } = await userClient
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  const geminiContents = (history ?? []).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullText = "";

      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${employee.model}:streamGenerateContent?alt=sse&key=${keyRow.api_key}`;

        const geminiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: geminiContents,
            systemInstruction: combinedInstructions
              ? { role: "system", parts: [{ text: combinedInstructions }] }
              : undefined,
            generationConfig: { temperature: Number(employee.temperature) }
          })
        });

        if (!geminiResponse.ok || !geminiResponse.body) {
          const errorText = await geminiResponse.text();
          controller.enqueue(
            encoder.encode(
              sseEvent("error", {
                message: `Gemini API error (${geminiResponse.status}): ${errorText.slice(0, 300)}`
              })
            )
          );
          controller.close();
          return;
        }

        const reader = geminiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const deltaText: string | undefined =
                parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (deltaText) {
                fullText += deltaText;
                controller.enqueue(encoder.encode(sseEvent("delta", { text: deltaText })));
              }
            } catch {
              // Skip malformed SSE chunks rather than aborting the whole stream.
            }
          }
        }

        if (fullText.trim().length > 0) {
          await userClient.from("messages").insert({
            organization_id: conversation.organization_id,
            conversation_id: conversation.id,
            role: "assistant",
            content: fullText.trim()
          });

          await chargeOneCredit(adminClient, conversation.organization_id, "chat", conversation.id);
        }

        controller.enqueue(encoder.encode(sseEvent("done", {})));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            sseEvent("error", {
              message: err instanceof Error ? err.message : "Unknown error calling Gemini"
            })
          )
        );
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
