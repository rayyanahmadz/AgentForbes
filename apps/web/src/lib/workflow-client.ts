import { supabase } from "@/lib/supabase/client";

interface StreamWorkflowCallbacks {
  onStepStart: (stepOrder: number, name: string) => void;
  onStepComplete: (stepOrder: number, output: string) => void;
  onStepError: (stepOrder: number, message: string) => void;
  onRunComplete: (finalOutput: string) => void;
  onRunFailed: (message: string) => void;
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-workflow`;

/**
 * Calls the `run-workflow` Edge Function directly via fetch (not
 * supabase.functions.invoke, which buffers the whole response) so per-step
 * progress can render as each step finishes, the same pattern chat-client.ts
 * uses for token streaming.
 */
export async function streamWorkflowRun(
  workflowId: string,
  input: string,
  callbacks: StreamWorkflowCallbacks
): Promise<void> {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    callbacks.onRunFailed("You've been signed out. Please log in again.");
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
      body: JSON.stringify({ workflowId, input })
    });
  } catch {
    callbacks.onRunFailed(
      "Couldn't reach the workflow service. Check your connection and try again."
    );
    return;
  }

  if (!response.ok || !response.body) {
    callbacks.onRunFailed(`Workflow service returned an error (${response.status}).`);
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
      let payload: {
        stepOrder?: number;
        name?: string;
        output?: string;
        message?: string;
        finalOutput?: string;
      };
      try {
        payload = JSON.parse(dataLine.slice(6));
      } catch {
        continue;
      }

      switch (eventName) {
        case "step-start":
          if (payload.stepOrder !== undefined) {
            callbacks.onStepStart(payload.stepOrder, payload.name ?? "");
          }
          break;
        case "step-complete":
          if (payload.stepOrder !== undefined) {
            callbacks.onStepComplete(payload.stepOrder, payload.output ?? "");
          }
          break;
        case "step-error":
          if (payload.stepOrder !== undefined) {
            callbacks.onStepError(payload.stepOrder, payload.message ?? "Step failed.");
          }
          break;
        case "run-complete":
          callbacks.onRunComplete(payload.finalOutput ?? "");
          break;
        case "run-failed":
          callbacks.onRunFailed(payload.message ?? "The workflow run failed.");
          break;
      }
    }
  }
}
