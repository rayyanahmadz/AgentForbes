// Run with: deno test supabase/functions/_shared/grounding.test.ts
//
// Only the pure, synchronous functions from grounding.ts are covered here —
// hasCredits()/chargeOneCredit() do real async I/O through a Supabase
// client parameter and would need a mock client to test meaningfully. That
// mock's own correctness would itself be unverifiable in this environment
// (no way to run it against anything real), so it's left out rather than
// giving false confidence. buildKnowledgeContext, buildMemoryContext,
// buildSystemInstruction, and sseEvent take plain data in and return plain
// strings out — fully traceable by hand.

import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildKnowledgeContext,
  buildMemoryContext,
  buildSystemInstruction,
  sseEvent
} from "./grounding.ts";

Deno.test("buildKnowledgeContext - returns null for no sources", () => {
  assertEquals(buildKnowledgeContext([]), null);
});

Deno.test("buildKnowledgeContext - includes a short source in full, untruncated", () => {
  const result = buildKnowledgeContext([{ name: "Pricing FAQ", content: "We charge per seat." }]);
  assertStringIncludes(result!, "### Pricing FAQ");
  assertStringIncludes(result!, "We charge per seat.");
  assertEquals(result!.includes("[truncated]"), false);
});

Deno.test("buildKnowledgeContext - truncates a source over the 4000-char per-source cap", () => {
  const longContent = "A".repeat(5000);
  const result = buildKnowledgeContext([{ name: "Big Doc", content: longContent }]);

  assertStringIncludes(result!, "[truncated]");
  // Exactly 4000 A's should appear before the truncation marker, not 5000.
  assertStringIncludes(result!, "A".repeat(4000) + " …[truncated]");
  assertEquals(result!.includes("A".repeat(4001)), false);
});

Deno.test("buildKnowledgeContext - drops sources once the 12000-char total budget is exhausted", () => {
  // Three 10,000-char sources each get capped to the per-source max of
  // 4,000 (3 × 4000 = 12000, exactly the total budget) — a fourth source
  // should be dropped entirely rather than included with 0 chars.
  const sources = [
    { name: "First", content: "A".repeat(10000) },
    { name: "Second", content: "B".repeat(10000) },
    { name: "Third", content: "C".repeat(10000) },
    { name: "Fourth", content: "D".repeat(10000) }
  ];

  const result = buildKnowledgeContext(sources);

  assertStringIncludes(result!, "### First");
  assertStringIncludes(result!, "### Second");
  assertStringIncludes(result!, "### Third");
  assertEquals(result!.includes("### Fourth"), false);
});

Deno.test("buildMemoryContext - returns null for no memories", () => {
  assertEquals(buildMemoryContext([]), null);
});

Deno.test("buildMemoryContext - includes short memories as a bulleted list", () => {
  const result = buildMemoryContext([
    { content: "The user's company is Acme Corp." },
    { content: "They prefer replies in Spanish." }
  ]);

  assertStringIncludes(result!, "- The user's company is Acme Corp.");
  assertStringIncludes(result!, "- They prefer replies in Spanish.");
});

Deno.test("buildMemoryContext - silently truncates once the 3000-char total budget runs out (no marker, unlike knowledge context)", () => {
  const result = buildMemoryContext([
    { content: "A".repeat(2000) },
    { content: "B".repeat(2000) }
  ]);

  // First memory kept in full (2000 of the 3000 budget).
  assertStringIncludes(result!, "A".repeat(2000));
  // Second memory only gets the remaining 1000 chars — no [truncated]
  // marker at all, a real behavioral difference from buildKnowledgeContext.
  assertStringIncludes(result!, "B".repeat(1000));
  assertEquals(result!.includes("B".repeat(1001)), false);
  assertEquals(result!.includes("[truncated]"), false);
});

Deno.test("buildSystemInstruction - empty string when everything is null", () => {
  assertEquals(buildSystemInstruction(null, null, null), "");
});

Deno.test("buildSystemInstruction - returns just the instructions when memory/knowledge are absent", () => {
  assertEquals(buildSystemInstruction("Be concise.", null, null), "Be concise.");
});

Deno.test("buildSystemInstruction - joins all three present pieces with a blank line, in order", () => {
  const result = buildSystemInstruction("Be concise.", "Memory context.", "Knowledge context.");
  assertEquals(result, "Be concise.\n\nMemory context.\n\nKnowledge context.");
});

Deno.test("sseEvent - formats as a standard SSE event/data block", () => {
  assertEquals(sseEvent("delta", { text: "hi" }), 'event: delta\ndata: {"text":"hi"}\n\n');
});
