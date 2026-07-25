import { supabase } from "@/lib/supabase/client";

interface StreamChatCallbacks {
  onDelta: (text: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

/**
 * Calls the `chat` Edge Function directly via fetch (rather than
 * supabase.functions.invoke) so we can read the response body as a stream —
 * invoke() buffers the whole response before returning.
 */
export async function streamChatMessage(
  conversationId: string,
  message: string,
  callbacks: StreamChatCallbacks
): Promise<void> {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    callbacks.onError("You've been signed out. Please log in again.");
    return;
  }

  let response: Response;
  try {
    response = await fetch(FUNCTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ conversationId, message })
    });
  } catch {
    callbacks.onError("Couldn't reach the chat service. Check your connection and try again.");
    return;
  }

  if (!response.ok || !response.body) {
    callbacks.onError(`Chat service returned an error (${response.status}).`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
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
        callbacks.onDelta(payload.text);
      } else if (eventName === "error") {
        callbacks.onError(payload.message ?? "Something went wrong.");
      } else if (eventName === "done") {
        callbacks.onDone();
      }
    }
  }
}
