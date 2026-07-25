// Supabase Edge Function: run-workflow
//
// Runs on Deno. Deploy with: supabase functions deploy run-workflow
// Requires the same auto-provided secrets as the chat function.
//
// Executes a workflow's steps in order. Each step:
//   1. substitutes {{input}} (the run's initial input) and {{previous_output}}
//      (the prior step's output) into its prompt_template
//   2. calls that step's AI Employee (Gemini only, same scope as AI Chat),
//      including its knowledge sources + memory, same as chat
//   3. persists the result to workflow_step_runs and streams progress back
//
// If any step fails, the run stops there — later steps are never faked, and
// everything completed before the failure stays on the record.
//
// Billing: 1 credit is charged per completed step (checked before, charged
// after success), so a workflow with more steps than remaining credits
// fails cleanly partway through rather than running steps nobody paid for.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  CORS_HEADERS,
  buildKnowledgeContext,
  buildMemoryContext,
  buildSystemInstruction,
  callGeminiOnce,
  chargeOneCredit,
  hasCredits,
  sseEvent
} from "../_shared/grounding.ts";

interface RunWorkflowRequestBody {
  workflowId: string;
  input: string;
}

// Exported so this pure string-substitution logic can be unit tested
// directly (see index.test.ts) without needing to mock the whole request
// handler around it.
export function substituteTemplate(template: string, input: string, previousOutput: string): string {
  return template
    .replaceAll("{{input}}", input)
    .replaceAll("{{previous_output}}", previousOutput);
}

// Guarded so importing the pure functions above (substituteTemplate) for
// unit testing doesn't also start a real server as an import side effect —
// import.meta.main is true only when this file is run directly, which is
// exactly how Supabase's Edge Runtime invokes it in production, so this
// changes nothing about real deployments.
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

  let body: RunWorkflowRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: CORS_HEADERS });
  }

  if (!body.workflowId) {
    return new Response("workflowId is required", { status: 400, headers: CORS_HEADERS });
  }

  // RLS (is_org_member) proves this user may access this workflow.
  const { data: workflow, error: workflowError } = await userClient
    .from("workflows")
    .select("id, organization_id, name")
    .eq("id", body.workflowId)
    .single();

  if (workflowError || !workflow) {
    return new Response("Workflow not found", { status: 404, headers: CORS_HEADERS });
  }

  const { data: steps, error: stepsError } = await userClient
    .from("workflow_steps")
    .select("id, step_order, name, ai_employee_id, prompt_template")
    .eq("workflow_id", workflow.id)
    .order("step_order", { ascending: true });

  if (stepsError || !steps || steps.length === 0) {
    return new Response("This workflow has no steps yet", { status: 400, headers: CORS_HEADERS });
  }

  const runInput = body.input ?? "";

  const { data: run, error: runError } = await userClient
    .from("workflow_runs")
    .insert({
      organization_id: workflow.organization_id,
      workflow_id: workflow.id,
      triggered_by: user.id,
      input: runInput,
      status: "running"
    })
    .select("id")
    .single();

  if (runError || !run) {
    return new Response(
      `Couldn't start the run: ${runError?.message ?? "unknown error"}`,
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(event, data)));

      let previousOutput = "";

      async function failRun(message: string) {
        await userClient
          .from("workflow_runs")
          .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
          .eq("id", run!.id);
        send("run-failed", { message });

        // Self-insert: the notification recipient (user.id) is the same
        // user making this request, so RLS's "insert your own only" policy
        // covers this without needing the service-role client.
        await userClient.from("notifications").insert({
          user_id: user.id,
          organization_id: workflow.organization_id,
          type: "workflow_run_failed",
          title: `"${workflow.name}" run failed`,
          body: message,
          link: `/dashboard/workflows/${workflow.id}/run`
        });
      }

      try {
        for (const step of steps) {
          send("step-start", { stepOrder: step.step_order, name: step.name });

          const { data: employee, error: employeeError } = await userClient
            .from("ai_employees")
            .select("provider, model, instructions, temperature")
            .eq("id", step.ai_employee_id)
            .single();

          if (employeeError || !employee) {
            await failRun(`Step "${step.name}": its AI Employee no longer exists.`);
            break;
          }

          const prompt = substituteTemplate(step.prompt_template, runInput, previousOutput);

          const { data: stepRun, error: stepRunInsertError } = await userClient
            .from("workflow_step_runs")
            .insert({
              organization_id: workflow.organization_id,
              workflow_run_id: run.id,
              workflow_step_id: step.id,
              step_order: step.step_order,
              status: "running",
              prompt,
              started_at: new Date().toISOString()
            })
            .select("id")
            .single();

          if (stepRunInsertError || !stepRun) {
            await failRun(`Step "${step.name}": couldn't record its run.`);
            break;
          }

          if (employee.provider !== "gemini") {
            const message = `Step "${step.name}" uses the "${employee.provider}" provider, which isn't wired up yet — only Gemini works end to end so far.`;
            await userClient
              .from("workflow_step_runs")
              .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
              .eq("id", stepRun.id);
            send("step-error", { stepOrder: step.step_order, message });
            await failRun(message);
            break;
          }

          if (!(await hasCredits(userClient, workflow.organization_id))) {
            const message =
              "Your organization is out of AI credits. Buy more from the Wallet page.";
            await userClient
              .from("workflow_step_runs")
              .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
              .eq("id", stepRun.id);
            send("step-error", { stepOrder: step.step_order, message });
            await failRun(message);
            break;
          }

          const { data: keyRow } = await adminClient
            .from("organization_api_keys")
            .select("api_key")
            .eq("organization_id", workflow.organization_id)
            .eq("provider", "gemini")
            .maybeSingle();

          if (!keyRow?.api_key) {
            const message =
              "No Gemini API key is configured for this organization yet. Add one in Organization settings.";
            await userClient
              .from("workflow_step_runs")
              .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
              .eq("id", stepRun.id);
            send("step-error", { stepOrder: step.step_order, message });
            await failRun(message);
            break;
          }

          const { data: attachedSources } = await userClient
            .from("ai_employee_knowledge_sources")
            .select("knowledge_sources (name, content)")
            .eq("ai_employee_id", step.ai_employee_id);

          const knowledgeContext = buildKnowledgeContext(
            (attachedSources ?? [])
              .map((row) => row.knowledge_sources)
              .filter((s): s is { name: string; content: string } => Boolean(s))
          );

          const { data: memoryRows } = await userClient
            .from("employee_memories")
            .select("content")
            .eq("ai_employee_id", step.ai_employee_id)
            .order("created_at", { ascending: false });

          const memoryContext = buildMemoryContext(memoryRows ?? []);
          const systemInstruction = buildSystemInstruction(
            employee.instructions,
            memoryContext,
            knowledgeContext
          );

          const result = await callGeminiOnce({
            apiKey: keyRow.api_key,
            model: employee.model,
            temperature: Number(employee.temperature),
            systemInstruction,
            prompt
          });

          if ("error" in result) {
            await userClient
              .from("workflow_step_runs")
              .update({
                status: "failed",
                error: result.error,
                completed_at: new Date().toISOString()
              })
              .eq("id", stepRun.id);
            send("step-error", { stepOrder: step.step_order, message: result.error });
            await failRun(`Step "${step.name}" failed: ${result.error}`);
            break;
          }

          await userClient
            .from("workflow_step_runs")
            .update({
              status: "completed",
              output: result.text,
              completed_at: new Date().toISOString()
            })
            .eq("id", stepRun.id);

          await chargeOneCredit(adminClient, workflow.organization_id, "workflow_step", run.id);

          send("step-complete", { stepOrder: step.step_order, output: result.text });
          previousOutput = result.text;
        }

        // If we made it through every step without breaking out early on a
        // failure, mark the run complete.
        const { data: finalRun } = await userClient
          .from("workflow_runs")
          .select("status")
          .eq("id", run.id)
          .single();

        if (finalRun?.status === "running") {
          await userClient
            .from("workflow_runs")
            .update({
              status: "completed",
              final_output: previousOutput,
              completed_at: new Date().toISOString()
            })
            .eq("id", run.id);
          send("run-complete", { finalOutput: previousOutput });

          await userClient.from("notifications").insert({
            user_id: user.id,
            organization_id: workflow.organization_id,
            type: "workflow_run_completed",
            title: `"${workflow.name}" finished running`,
            body: previousOutput.slice(0, 140),
            link: `/dashboard/workflows/${workflow.id}/run`
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error running workflow";
        await failRun(message);
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
