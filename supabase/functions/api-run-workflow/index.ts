// Public API: POST /functions/v1/api-run-workflow
// Authorization: Bearer af_live_...
// Body: { workflowId: string, input: string }
//
// Runs every step synchronously and returns the whole result as one JSON
// object once finished — no SSE progress events, unlike the internal
// run-workflow function the dashboard UI uses. A multi-step run can take a
// while; that's a normal tradeoff for a synchronous API call and Edge
// Functions have a generous execution window for it.
//
// Deploy with: supabase functions deploy api-run-workflow --no-verify-jwt

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
  chargeOneCredit,
  hasCredits
} from "../_shared/grounding.ts";

interface ApiRunWorkflowBody {
  workflowId: string;
  input: string;
}

function substituteTemplate(template: string, input: string, previousOutput: string): string {
  return template.replaceAll("{{input}}", input).replaceAll("{{previous_output}}", previousOutput);
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

  let body: ApiRunWorkflowBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.workflowId) {
    return jsonResponse({ error: "workflowId is required" }, 400);
  }

  const { data: workflow, error: workflowError } = await adminClient
    .from("workflows")
    .select("id, name")
    .eq("id", body.workflowId)
    .eq("organization_id", auth.organizationId)
    .single();

  if (workflowError || !workflow) {
    return jsonResponse({ error: "No such workflow in this organization." }, 404);
  }

  const { data: steps, error: stepsError } = await adminClient
    .from("workflow_steps")
    .select("id, step_order, name, ai_employee_id, prompt_template")
    .eq("workflow_id", workflow.id)
    .order("step_order", { ascending: true });

  if (stepsError || !steps || steps.length === 0) {
    return jsonResponse({ error: "This workflow has no steps yet." }, 400);
  }

  const runInput = body.input ?? "";

  const { data: run, error: runError } = await adminClient
    .from("workflow_runs")
    .insert({
      organization_id: auth.organizationId,
      workflow_id: workflow.id,
      triggered_by: auth.createdBy,
      input: runInput,
      status: "running"
    })
    .select("id")
    .single();

  if (runError || !run) {
    return jsonResponse({ error: "Couldn't start the run." }, 500);
  }

  const stepResults: Array<{
    stepOrder: number;
    name: string;
    status: "completed" | "failed";
    output?: string;
    error?: string;
  }> = [];

  let previousOutput = "";

  async function failRun(message: string) {
    await adminClient
      .from("workflow_runs")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", run!.id);
  }

  for (const step of steps) {
    if (!(await hasCredits(adminClient, auth.organizationId))) {
      const message = "Out of AI credits partway through this run.";
      stepResults.push({ stepOrder: step.step_order, name: step.name, status: "failed", error: message });
      await failRun(message);
      return jsonResponse(
        { runId: run.id, status: "failed", error: message, steps: stepResults },
        402
      );
    }

    const { data: employee, error: employeeError } = await adminClient
      .from("ai_employees")
      .select("provider, model, instructions, temperature")
      .eq("id", step.ai_employee_id)
      .eq("organization_id", auth.organizationId)
      .single();

    if (employeeError || !employee) {
      const message = `Step "${step.name}": its AI Employee no longer exists.`;
      stepResults.push({ stepOrder: step.step_order, name: step.name, status: "failed", error: message });
      await failRun(message);
      return jsonResponse({ runId: run.id, status: "failed", error: message, steps: stepResults }, 500);
    }

    const prompt = substituteTemplate(step.prompt_template, runInput, previousOutput);

    const { data: stepRun } = await adminClient
      .from("workflow_step_runs")
      .insert({
        organization_id: auth.organizationId,
        workflow_run_id: run.id,
        workflow_step_id: step.id,
        step_order: step.step_order,
        status: "running",
        prompt,
        started_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (employee.provider !== "gemini") {
      const message = `Step "${step.name}" uses the "${employee.provider}" provider, which isn't wired up yet. Only Gemini works end to end so far.`;
      if (stepRun) {
        await adminClient
          .from("workflow_step_runs")
          .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
          .eq("id", stepRun.id);
      }
      stepResults.push({ stepOrder: step.step_order, name: step.name, status: "failed", error: message });
      await failRun(message);
      return jsonResponse({ runId: run.id, status: "failed", error: message, steps: stepResults }, 422);
    }

    const { data: keyRow } = await adminClient
      .from("organization_api_keys")
      .select("api_key")
      .eq("organization_id", auth.organizationId)
      .eq("provider", "gemini")
      .maybeSingle();

    if (!keyRow?.api_key) {
      const message =
        "No Gemini API key is configured for this organization. Add one in Organization settings.";
      if (stepRun) {
        await adminClient
          .from("workflow_step_runs")
          .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
          .eq("id", stepRun.id);
      }
      stepResults.push({ stepOrder: step.step_order, name: step.name, status: "failed", error: message });
      await failRun(message);
      return jsonResponse({ runId: run.id, status: "failed", error: message, steps: stepResults }, 422);
    }

    const { data: attachedSources } = await adminClient
      .from("ai_employee_knowledge_sources")
      .select("knowledge_sources (name, content)")
      .eq("ai_employee_id", step.ai_employee_id);

    const knowledgeContext = buildKnowledgeContext(
      (attachedSources ?? [])
        .map((row) => row.knowledge_sources)
        .filter((s): s is { name: string; content: string } => Boolean(s))
    );

    const { data: memoryRows } = await adminClient
      .from("employee_memories")
      .select("content")
      .eq("ai_employee_id", step.ai_employee_id)
      .order("created_at", { ascending: false });

    const memoryContext = buildMemoryContext(memoryRows ?? []);
    const systemInstruction = buildSystemInstruction(employee.instructions, memoryContext, knowledgeContext);

    const result = await callGeminiOnce({
      apiKey: keyRow.api_key,
      model: employee.model,
      temperature: Number(employee.temperature),
      systemInstruction,
      prompt
    });

    if ("error" in result) {
      if (stepRun) {
        await adminClient
          .from("workflow_step_runs")
          .update({ status: "failed", error: result.error, completed_at: new Date().toISOString() })
          .eq("id", stepRun.id);
      }
      stepResults.push({ stepOrder: step.step_order, name: step.name, status: "failed", error: result.error });
      await failRun(`Step "${step.name}" failed: ${result.error}`);
      return jsonResponse(
        { runId: run.id, status: "failed", error: result.error, steps: stepResults },
        502
      );
    }

    if (stepRun) {
      await adminClient
        .from("workflow_step_runs")
        .update({ status: "completed", output: result.text, completed_at: new Date().toISOString() })
        .eq("id", stepRun.id);
    }

    await chargeOneCredit(adminClient, auth.organizationId, "workflow_step", run.id);

    stepResults.push({ stepOrder: step.step_order, name: step.name, status: "completed", output: result.text });
    previousOutput = result.text;
  }

  await adminClient
    .from("workflow_runs")
    .update({ status: "completed", final_output: previousOutput, completed_at: new Date().toISOString() })
    .eq("id", run.id);

  return jsonResponse({
    runId: run.id,
    status: "completed",
    finalOutput: previousOutput,
    steps: stepResults
  });
});
