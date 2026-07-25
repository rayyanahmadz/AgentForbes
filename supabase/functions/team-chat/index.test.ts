// Run with: deno test supabase/functions/team-chat/index.test.ts
//
// Covers buildRoutingInstruction and matchTeamMemberByName — the pure
// prompt-building and response-parsing logic around the routing decision.
// The actual Gemini call and every database read/write are left uncovered
// for the same reason as elsewhere in this project: they'd need a mock
// Supabase/Gemini client whose own correctness couldn't be verified here.

import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildRoutingInstruction, matchTeamMemberByName } from "./index.ts";

Deno.test("buildRoutingInstruction - includes the team name", () => {
  const result = buildRoutingInstruction("Customer Support", []);
  assertStringIncludes(result, '"Customer Support" team');
});

Deno.test("buildRoutingInstruction - lists each member by name", () => {
  const result = buildRoutingInstruction("Support", [
    { name: "Billing Bot", note: null },
    { name: "Tech Bot", note: null }
  ]);
  assertStringIncludes(result, "- Billing Bot");
  assertStringIncludes(result, "- Tech Bot");
});

Deno.test("buildRoutingInstruction - appends the note when present", () => {
  const result = buildRoutingInstruction("Support", [
    { name: "Billing Bot", note: "Handles refunds and invoices" }
  ]);
  assertStringIncludes(result, "- Billing Bot: Handles refunds and invoices");
});

Deno.test("buildRoutingInstruction - omits the colon entirely when note is null", () => {
  const result = buildRoutingInstruction("Support", [{ name: "Billing Bot", note: null }]);
  assertStringIncludes(result, "- Billing Bot\n");
  assertEquals(result.includes("Billing Bot:"), false);
});

Deno.test("buildRoutingInstruction - instructs SELF as the no-good-match fallback", () => {
  const result = buildRoutingInstruction("Support", []);
  assertStringIncludes(result, "exactly: SELF");
});

const members = [
  { name: "Billing Bot", employee: { id: "1", name: "Billing Bot" } },
  { name: "Tech Bot", employee: { id: "2", name: "Tech Bot" } }
];

Deno.test("matchTeamMemberByName - matches an exact name", () => {
  const result = matchTeamMemberByName("Billing Bot", members);
  assertEquals(result?.id, "1");
});

Deno.test("matchTeamMemberByName - matches case-insensitively", () => {
  const result = matchTeamMemberByName("BILLING BOT", members);
  assertEquals(result?.id, "1");
});

Deno.test("matchTeamMemberByName - trims surrounding whitespace", () => {
  const result = matchTeamMemberByName("  Tech Bot  \n", members);
  assertEquals(result?.id, "2");
});

Deno.test("matchTeamMemberByName - strips surrounding quotes and periods Gemini sometimes adds", () => {
  const result = matchTeamMemberByName(`"Tech Bot."`, members);
  assertEquals(result?.id, "2");
});

Deno.test("matchTeamMemberByName - returns null for the literal SELF response", () => {
  assertEquals(matchTeamMemberByName("SELF", members), null);
});

Deno.test("matchTeamMemberByName - returns null for an unparseable/unmatched response", () => {
  assertEquals(matchTeamMemberByName("I'm not sure who should handle this.", members), null);
});

Deno.test("matchTeamMemberByName - returns null against an empty member list", () => {
  assertEquals(matchTeamMemberByName("Billing Bot", []), null);
});
