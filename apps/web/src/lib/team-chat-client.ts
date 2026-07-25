import { supabase } from "@/lib/supabase/client";

interface StreamTeamChatCallbacks {
  onPicked: (employeeName: string, employeeId: string) => void;
  onDelta: (text: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-chat`;

/** Same fetch-and-parse-SSE pattern as chat-client.ts, plus a 'picked' event. */
export async function streamTeamChatMessage(
  teamConversationId: string,
  message: string,
  callbacks: StreamTeamChatCallbacks
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
      body: JSON.stringify({ teamConversationId, message })
    });
  } catch {
    callbacks.onError("Couldn't reach the team chat service. Check your connection and try again.");
    return;
  }

  if (!response.ok || !response.body) {
    callbacks.onError(`Team chat service returned an error (${response.status}).`);
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
      let payload: { employeeName?: string; employeeId?: string; text?: string; message?: string };
      try {
        payload = JSON.parse(dataLine.slice(6));
      } catch {
        continue;
      }

      switch (eventName) {
        case "picked":
          if (payload.employeeName && payload.employeeId) {
            callbacks.onPicked(payload.employeeName, payload.employeeId);
          }
          break;
        case "delta":
          if (payload.text) callbacks.onDelta(payload.text);
          break;
        case "error":
          callbacks.onError(payload.message ?? "Something went wrong.");
          break;
        case "done":
          callbacks.onDone();
          break;
      }
    }
  }
}
