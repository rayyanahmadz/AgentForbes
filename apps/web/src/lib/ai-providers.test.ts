import { describe, expect, it } from "vitest";
import { AI_PROVIDERS, getProviderOption } from "./ai-providers";

describe("getProviderOption", () => {
  it("finds the matching provider option", () => {
    expect(getProviderOption("anthropic").label).toBe("Anthropic Claude");
    expect(getProviderOption("gemini").label).toBe("Google Gemini");
  });

  it("falls back to the first provider (Gemini) for an unrecognized value", () => {
    // Defensive case: e.g. old data from before a provider was added/renamed.
    const result = getProviderOption("made-up-provider" as never);
    expect(result).toBe(AI_PROVIDERS[0]);
    expect(result.value).toBe("gemini");
  });
});

describe("AI_PROVIDERS", () => {
  it("has unique values", () => {
    const values = AI_PROVIDERS.map((p) => p.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("includes all six providers named in the product brief", () => {
    const values = AI_PROVIDERS.map((p) => p.value).sort();
    expect(values).toEqual(
      ["anthropic", "gemini", "lmstudio", "ollama", "openai", "openrouter"].sort()
    );
  });
});
