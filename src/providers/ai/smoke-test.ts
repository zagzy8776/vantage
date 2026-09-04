import { aiProviderRegistry } from "./registry";
import type { AIProviderId } from "./types";
import type { AIRequest } from "@/services/intelligence/types";

interface AIProviderSmokeTestResult {
  provider: AIProviderId;
  configured: boolean;
  requestSent: boolean;
  httpStatus: number | null;
  responseParsed: boolean;
  success: boolean;
  errorCategory: "none" | "not_configured" | "authentication" | "invalid_request" | "rate_limit" | "server_error" | "timeout" | "network" | "parse_error" | "unknown";
  errorMessage: string | null;
  model: string | null;
}

const envKeyMap: Record<AIProviderId, string> = {
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  together: "TOGETHER_API_KEY",
  minimax: "MINIMAX_API_KEY",
  pollinations: "POLLINATIONS_API_KEY",
};

export async function runAIProviderSmokeTest(request?: AIRequest): Promise<AIProviderSmokeTestResult[]> {
  const results: AIProviderSmokeTestResult[] = [];
  const testRequest: AIRequest = request ?? {
    messages: [{ role: "user", content: "Return the word: OK" }],
    temperature: 0,
    maxTokens: 10,
  };

  for (const providerId of Object.keys(aiProviderRegistry) as AIProviderId[]) {
    const provider = aiProviderRegistry[providerId];
    const result: AIProviderSmokeTestResult = {
      provider: providerId,
      configured: false,
      requestSent: false,
      httpStatus: null,
      responseParsed: false,
      success: false,
      errorCategory: "none",
      errorMessage: null,
      model: null,
    };

    result.configured = Boolean(process.env[envKeyMap[providerId]]?.trim());

    if (!result.configured) {
      result.errorCategory = "not_configured";
      result.errorMessage = `${envKeyMap[providerId]} is not configured.`;
      results.push(result);
      continue;
    }

    try {
      result.requestSent = true;
      const response = await provider.generate(testRequest);
      result.httpStatus = 200;
      result.responseParsed = true;
      result.success = true;
      result.model = response.model ?? null;
      results.push(result);
    } catch (error) {
      result.requestSent = true;
      const err = error as Error & { status?: number };
      result.httpStatus = err.status ?? null;
      result.errorMessage = err.message ?? "Unknown error";
      result.responseParsed = false;
      result.success = false;

      if (err.status === 401 || err.status === 403) {
        result.errorCategory = "authentication";
      } else if (err.status === 400 || err.status === 422) {
        result.errorCategory = "invalid_request";
      } else if (err.status === 429) {
        result.errorCategory = "rate_limit";
      } else if (err.status && err.status >= 500) {
        result.errorCategory = "server_error";
      } else if (err.message?.toLowerCase().includes("timeout") || err.message?.toLowerCase().includes("aborted")) {
        result.errorCategory = "timeout";
      } else if (err.message?.toLowerCase().includes("fetch") || err.message?.toLowerCase().includes("network")) {
        result.errorCategory = "network";
      } else if (err.message?.toLowerCase().includes("invalid") || err.message?.toLowerCase().includes("parse")) {
        result.errorCategory = "parse_error";
      } else {
        result.errorCategory = "unknown";
      }

      results.push(result);
    }
  }

  return results;
}
