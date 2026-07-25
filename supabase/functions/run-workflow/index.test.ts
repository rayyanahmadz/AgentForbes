// Run with: deno test supabase/functions/run-workflow/index.test.ts
//
// Only substituteTemplate is covered — the only pure, synchronous function
// in this file. Everything else does real I/O (Supabase queries, Gemini
// calls) through clients this environment has no way to mock and verify.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { substituteTemplate } from "./index.ts";

Deno.test("substituteTemplate - replaces {{input}} with the run's input", () => {
  assertEquals(
    substituteTemplate("Summarize: {{input}}", "the raw text", ""),
    "Summarize: the raw text"
  );
});

Deno.test("substituteTemplate - replaces {{previous_output}} with the prior step's output", () => {
  assertEquals(
    substituteTemplate("Translate: {{previous_output}}", "", "a summary"),
    "Translate: a summary"
  );
});

Deno.test("substituteTemplate - replaces both placeholders in one template", () => {
  assertEquals(
    substituteTemplate("Input was {{input}}, previous step said {{previous_output}}", "X", "Y"),
    "Input was X, previous step said Y"
  );
});

Deno.test("substituteTemplate - replaces every occurrence, not just the first", () => {
  assertEquals(
    substituteTemplate("{{input}} and {{input}} again", "hi", ""),
    "hi and hi again"
  );
});

Deno.test("substituteTemplate - leaves a template with no placeholders unchanged", () => {
  assertEquals(
    substituteTemplate("A fixed prompt with no variables.", "unused", "unused"),
    "A fixed prompt with no variables."
  );
});

Deno.test("substituteTemplate - substitutes an empty string cleanly (first step, no previous output)", () => {
  assertEquals(
    substituteTemplate("Step one: {{input}}. Previous: [{{previous_output}}]", "hello", ""),
    "Step one: hello. Previous: []"
  );
});
