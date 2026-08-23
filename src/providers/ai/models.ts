import type { AIProviderId } from "./types";

export type AIModelSource = "environment" | "provider-default";
export type AIModelRole = "primary" | "fallback" | "preview";

export interface AIModelConfiguration {
  provider: AIProviderId;
  model: string;
  source: AIModelSource;
  role: AIModelRole;
  production: boolean;
}

export const PRODUCTION_AI_MODELS: Record<"groq" | "cerebras", string> = {
  groq: "openai/gpt-oss-20b",
  cerebras: "gpt-oss-120b",
};

export const PREVIEW_AI_MODELS = { cerebras: "gemma-4-31b" } as const;

const MODEL_ROLES: Record<"groq" | "cerebras", AIModelRole> = {
  groq: "primary",
  cerebras: "fallback",
};

export function resolveAIModel(provider: "groq" | "cerebras", envName: string): AIModelConfiguration {
  const configuredModel = process.env[envName]?.trim();
  return {
    provider,
    model: configuredModel || PRODUCTION_AI_MODELS[provider],
    source: configuredModel ? "environment" : "provider-default",
    role: MODEL_ROLES[provider],
    production: true,
  };
}

export function getAIModelConfiguration(): AIModelConfiguration[] {
  return [
    resolveAIModel("groq", "GROQ_MODEL"),
    resolveAIModel("cerebras", "CEREBRAS_MODEL"),
    { provider: "cerebras", model: PREVIEW_AI_MODELS.cerebras, source: "provider-default", role: "preview", production: false },
  ];
}