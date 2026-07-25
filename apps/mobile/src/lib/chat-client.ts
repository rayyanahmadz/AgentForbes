import { supabase } from "@/lib/supabase";

const FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/chat`;

interface SendChatMessageResult {
  fullText: string | null;
  error: string | null;
}

/**
 * Deliberately NOT using a streaming reader (response.body.getReader()),
 * unlike apps/web's chat-client.ts. React Native's fetch streaming support
 * varies across the iOS/Android/Hermes stack in ways this sandbox has no
 * way to verify — there's no simulator or device here to test against.
 * response.text() waits for the complete response instead, which is
 * universally supported. The chat Edge Function itself is unchanged — this
 * only affects whether the client reads it incrementally or all at once,
 * so the reply's content is identical either way, just not shown token by
 * token as it's generated.
 */
export async function sendChatMessage(
  conversationId: string,
  message: string
): Promise<SendChatMessageResult> {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return { fullText: null, error: "You've been signed out. Please log in again." };
  }

  let response: Response;
  try {
    response = await fetch(FUNCTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""
      },
      body: JSON.stringify({ conversationId, message })
    });
  } catch {
    return {
      fullText: null,
      error: "Couldn't reach the chat service. Check your connection and try again."
    };
  }

  if (!response.ok) {
    return { fullText: null, error: `Chat service returned an error (${response.status}).` };
  }

  const rawText = await response.text();
  let fullText = "";
  let errorMessage: string | null = null;

  // Same SSE wire format as the web client — "event: X\ndata: {...}\n\n" —
  // just parsed from a complete string instead of incrementally.
  for (const rawEvent of rawText.split("\n\n")) {
    const eventLine = rawEvent.split("\n").find((line) => line.startsWith("event: "));
    const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data: "));
    if (!eventLine || !dataLine) continue;

    const eventName = eventLine.slice(7).trim();
    let payload: { text?: string; message?: string };
    try {
      payload = JSON.parse(dataLine.slice(6));
    } catch {
      continue;
    }

    if (eventName === "delta" && payload.text) {
      fullText += payload.text;
    } else if (eventName === "error") {
      errorMessage = payload.message ?? "Something went wrong.";
    }
  }

  if (errorMessage) {
    return { fullText: null, error: errorMessage };
  }

  if (!fullText) {
    return { fullText: null, error: "The employee didn't return a reply. Try again." };
  }

  return { fullText, error: null };
}
