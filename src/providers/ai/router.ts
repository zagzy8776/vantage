import type { AIRequest } from "@/services/intelligence/types";
import { aiProviderRegistry } from "./registry";
import { AIProviderError, type AIProviderId, type AIRouterOptions, type AIRouterResult } from "./types";

const DEFAULT_ORDER: AIProviderId[] = ["groq", "cerebras", "minimax", "pollinations", "openrouter"];

function configured(provider: AIProviderId) {
  const envKey: Record<AIProviderId, string> = {
    groq: "GROQ_API_KEY",
    cerebras: "CEREBRAS_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    minimax: "MINIMAX_API_KEY",
    pollinations: "POLLINATIONS_API_KEY",
  };
  return Boolean(process.env[envKey[provider]]?.trim());
}

export function getAIProviderOrder(): AIProviderId[] {
  const requested = (process.env.AI_PROVIDER_ORDER ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is AIProviderId => DEFAULT_ORDER.includes(item as AIProviderId));
  return Array.from(new Set([...requested, ...DEFAULT_ORDER]));
}

export async function generateWithFallback(request: AIRequest, options?: AIRouterOptions): Promise<AIRouterResult> {
  const order = options?.order ?? getAIProviderOrder();
  const failures: string[] = [];
  const failureDetails: Array<{ provider: string; status?: number; message: string }> = [];
  let attempts = 0;

  for (const providerId of order) {
    if (!configured(providerId)) continue;
    attempts += 1;
    try {
      let result = await aiProviderRegistry[providerId].generate(request);
      if (options?.validate) {
        try {
          options.validate(result.content);
        } catch {
          if (!options.repairRequest) throw new AIProviderError("Provider returned invalid structured output.", { retryable: true });
          result = await aiProviderRegistry[providerId].generate(options.repairRequest(result.content));
          options.validate(result.content);
        }
      }
      return {
        ...result,
        metadata: {
          provider: result.provider,
          model: result.model,
          modelSource: result.modelSource,
          modelRole: result.modelRole,
          fallbackUsed: attempts > 1,
          attempts,
          failures: failureDetails,
        },
      };
    } catch (error) {
      const providerError = error instanceof AIProviderError ? error : new AIProviderError("Provider request failed.");
      failures.push(`${providerId}: ${providerError.message}`);
      failureDetails.push({ provider: providerId, status: providerError.status, message: providerError.message.slice(0, 240) });
      if (!providerError.retryable) continue;
    }
  }

  throw Object.assign(
    new AIProviderError(failures.length ? "All configured AI providers were unavailable." : "No AI provider is configured.", { retryable: false }),
    { failureDetails },
  );
}
