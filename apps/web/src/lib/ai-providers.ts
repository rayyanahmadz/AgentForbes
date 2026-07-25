import type { AiProvider } from "@/lib/supabase/types";

export interface AiProviderOption {
  value: AiProvider;
  label: string;
  suggestedModel: string;
  note: string;
}

/**
 * Static metadata for the provider dropdown. `model` stays a free-text field
 * in the form (not a locked dropdown of model IDs) since provider catalogs
 * change often and real per-provider adapters + "bring your own API key"
 * land in the AI Provider Adapters phase. This just seeds a sensible default.
 */
export const AI_PROVIDERS: AiProviderOption[] = [
  {
    value: "gemini",
    label: "Google Gemini",
    suggestedModel: "gemini-2.0-flash",
    note: "Default free development provider."
  },
  {
    value: "anthropic",
    label: "Anthropic Claude",
    suggestedModel: "claude-sonnet-4-6",
    note: "Requires your own API key."
  },
  {
    value: "openai",
    label: "OpenAI",
    suggestedModel: "gpt-4o-mini",
    note: "Requires your own API key."
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    suggestedModel: "openrouter/auto",
    note: "Routes to many underlying models."
  },
  {
    value: "ollama",
    label: "Ollama (local)",
    suggestedModel: "llama3",
    note: "Runs on your own machine — no API key or cost."
  },
  {
    value: "lmstudio",
    label: "LM Studio (local)",
    suggestedModel: "local-model",
    note: "Runs on your own machine — no API key or cost."
  }
];

export function getProviderOption(provider: AiProvider): AiProviderOption {
  return AI_PROVIDERS.find((option) => option.value === provider) ?? AI_PROVIDERS[0]!;
}
