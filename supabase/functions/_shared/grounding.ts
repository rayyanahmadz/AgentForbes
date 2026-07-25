// Shared across supabase/functions/chat, run-workflow, and team-chat. Deno
// edge functions each deploy independently, but relative imports across
// function folders work fine at deploy time — this avoids duplicating (and
// risking drift between) the knowledge/memory grounding logic and, since the
// Billing phase, the credit-check-and-deduct logic too.

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

/**
 * Read-only pre-check so a function can fail fast with a clear message
 * before doing any real work (loading grounding context, calling Gemini)
 * when the organization is already out of credits. Not itself the security
 * boundary — deduct_credits() re-checks atomically at spend time — this is
 * purely a fast, friendly early exit.
 */
export async function hasCredits(
  // deno-lint-ignore no-explicit-any
  userClient: any,
  organizationId: string
): Promise<boolean> {
  const { data } = await userClient
    .from("organization_wallets")
    .select("balance_credits")
    .eq("organization_id", organizationId)
    .single();

  return (data?.balance_credits ?? 0) > 0;
}

/**
 * Charges 1 credit for a successful AI call. Called AFTER a successful
 * response (not before) so a failed Gemini call never costs the
 * organization anything — only hasCredits() gates access up front. Must be
 * called with the service-role admin client: deduct_credits()'s EXECUTE
 * privilege is revoked from authenticated/anon in the Billing migration, so
 * calling this with a user-scoped client would just fail with a permission
 * error.
 */
export async function chargeOneCredit(
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  organizationId: string,
  reason: "chat" | "workflow_step" | "team_chat",
  referenceId: string | null
): Promise<void> {
  const { data: charged, error } = await adminClient.rpc("deduct_credits", {
    target_org_id: organizationId,
    amount: 1,
    charge_reason: reason,
    target_reference_id: referenceId
  });

  if (error) {
    console.error(`Failed to charge credit (${reason}):`, error.message);
    return;
  }

  if (!charged) {
    // Balance hit zero between the earlier hasCredits() check and now —
    // rare, and the reply already went to the user, so we log it for
    // visibility rather than trying to claw back a response already sent.
    console.warn(`Credit charge skipped (insufficient balance at charge time): ${reason}`);
  }
}

const MAX_CHARS_PER_SOURCE = 4000;
const MAX_TOTAL_KNOWLEDGE_CHARS = 12000;
const MAX_TOTAL_MEMORY_CHARS = 3000;

export function buildKnowledgeContext(
  sources: { name: string; content: string }[]
): string | null {
  if (sources.length === 0) return null;

  let remaining = MAX_TOTAL_KNOWLEDGE_CHARS;
  const chunks: string[] = [];

  for (const source of sources) {
    if (remaining <= 0) break;
    const take = Math.min(MAX_CHARS_PER_SOURCE, remaining);
    const text = source.content.slice(0, take);
    const truncated = source.content.length > take ? " …[truncated]" : "";
    chunks.push(`### ${source.name}\n${text}${truncated}`);
    remaining -= take;
  }

  return (
    "You have access to the following knowledge sources. Use them to ground " +
    "your answers when relevant, and say so if the answer isn't in them:\n\n" +
    chunks.join("\n\n")
  );
}

export function buildMemoryContext(memories: { content: string }[]): string | null {
  if (memories.length === 0) return null;

  let remaining = MAX_TOTAL_MEMORY_CHARS;
  const lines: string[] = [];

  for (const memory of memories) {
    if (remaining <= 0) break;
    const take = Math.min(memory.content.length, remaining);
    lines.push(`- ${memory.content.slice(0, take)}`);
    remaining -= take;
  }

  return (
    "Long-term memory — facts you've retained from past conversations with " +
    "this organization (not just this thread). Treat these as true unless " +
    "the current conversation says otherwise:\n\n" +
    lines.join("\n")
  );
}

/** Combines an employee's instructions with its memory + knowledge context. */
export function buildSystemInstruction(
  instructions: string | null,
  memoryContext: string | null,
  knowledgeContext: string | null
): string {
  return [instructions, memoryContext, knowledgeContext].filter(Boolean).join("\n\n");
}

export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * One non-streaming call to Gemini's generateContent endpoint. Used by
 * run-workflow, where each step needs a complete result before the next
 * step's prompt can be built — unlike chat, which streams tokens live.
 */
export async function callGeminiOnce(params: {
  apiKey: string;
  model: string;
  temperature: number;
  systemInstruction: string;
  prompt: string;
}): Promise<{ text: string } | { error: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: params.prompt }] }],
      systemInstruction: params.systemInstruction
        ? { role: "system", parts: [{ text: params.systemInstruction }] }
        : undefined,
      generationConfig: { temperature: params.temperature }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { error: `Gemini API error (${response.status}): ${errorText.slice(0, 300)}` };
  }

  const data = await response.json();
  const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return { error: "Gemini returned an empty response." };
  }

  return { text };
}

/**
 * Same as callGeminiOnce, but takes a multi-turn contents array instead of a
 * single prompt string — for callers (api-team-chat) that need real
 * conversation history without string-concatenating it into one blob, which
 * risks confusing the model if a message's own text happens to contain
 * something that looks like a turn label.
 */
export async function callGeminiOnceWithHistory(params: {
  apiKey: string;
  model: string;
  temperature: number;
  systemInstruction: string;
  contents: { role: string; parts: { text: string }[] }[];
}): Promise<{ text: string } | { error: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: params.contents,
      systemInstruction: params.systemInstruction
        ? { role: "system", parts: [{ text: params.systemInstruction }] }
        : undefined,
      generationConfig: { temperature: params.temperature }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { error: `Gemini API error (${response.status}): ${errorText.slice(0, 300)}` };
  }

  const data = await response.json();
  const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return { error: "Gemini returned an empty response." };
  }

  return { text };
}

/**
 * Streams a Gemini reply token-by-token via a callback, returning the full
 * accumulated text at the end. Used by team-chat (chat/index.ts has its own
 * inline copy of this same logic, predating this shared module — left as is
 * there to avoid touching a function that's already working).
 */
export async function streamGeminiSSE(params: {
  apiKey: string;
  model: string;
  temperature: number;
  systemInstruction: string;
  contents: { role: string; parts: { text: string }[] }[];
  onDelta: (text: string) => void;
}): Promise<{ fullText: string } | { error: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:streamGenerateContent?alt=sse&key=${params.apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: params.contents,
        systemInstruction: params.systemInstruction
          ? { role: "system", parts: [{ text: params.systemInstruction }] }
          : undefined,
        generationConfig: { temperature: params.temperature }
      })
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reach Gemini." };
  }

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    return { error: `Gemini API error (${response.status}): ${errorText.slice(0, 300)}` };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

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
        const deltaText: string | undefined = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (deltaText) {
          fullText += deltaText;
          params.onDelta(deltaText);
        }
      } catch {
        // Skip malformed SSE chunks rather than aborting the whole stream.
      }
    }
  }

  if (!fullText.trim()) {
    return { error: "Gemini returned an empty response." };
  }

  return { fullText };
}
