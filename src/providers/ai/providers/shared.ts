import type { AIRequest, AIResult } from "@/services/intelligence/types";
import { AIProviderError, type AIProviderId } from "../types";
import { resolveAIModel } from "../models";

const DEFAULT_TIMEOUT_MS = 45_000;

interface OpenAICompatibleOptions {
  provider: AIProviderId;
  endpoint: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

interface ChatCompletionPayload {
  id?: string;
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string; code?: string | number };
}

function providerKey(envName: string) {
  return process.env[envName]?.trim();
}

function timeoutSignal() {
  return AbortSignal.timeout(Number(process.env.AI_PROVIDER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
}

export function createOpenAICompatibleProvider(options: OpenAICompatibleOptions) {
  return {
    name: options.provider,
    async generate(request: AIRequest): Promise<AIResult> {
      const apiKey = providerKey(options.apiKeyEnv);
      if (!apiKey) throw new AIProviderError(`${options.apiKeyEnv} is not configured.`, { retryable: false });

      const modelConfiguration = options.provider === "groq" || options.provider === "cerebras"
        ? resolveAIModel(options.provider, options.modelEnv)
        : null;
      const model = request.model ?? modelConfiguration?.model ?? process.env[options.modelEnv] ?? options.defaultModel;
      const responseFormat = request.responseFormat === "json" ? { type: "json_object" } : undefined;
      const response = await fetch(options.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...options.headers },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0,
          max_tokens: request.maxTokens ?? 1800,
          ...(responseFormat ? { response_format: responseFormat } : {}),
          ...options.body,
        }),
        cache: "no-store",
        signal: timeoutSignal(),
      });

      const payload = (await response.json().catch(() => null)) as ChatCompletionPayload | null;
      if (!response.ok) {
        const message = payload?.error?.message || `${options.provider} request failed.`;
        throw new AIProviderError(message, { retryable: response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500, status: response.status });
      }

      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new AIProviderError(`${options.provider} returned an empty response.`, { retryable: true });

      return {
        provider: options.provider,
        model: payload?.model ?? model,
        modelSource: modelConfiguration?.source,
        modelRole: modelConfiguration?.role,
        requestId: payload?.id,
        content,
        usage: payload?.usage
          ? { promptTokens: payload.usage.prompt_tokens, completionTokens: payload.usage.completion_tokens, totalTokens: payload.usage.total_tokens }
          : undefined,
      };
    },
  };
}

export function createMiniMaxProvider() {
  return {
    name: "minimax" as const,
    async generate(request: AIRequest): Promise<AIResult> {
      const apiKey = providerKey("MINIMAX_API_KEY");
      if (!apiKey) throw new AIProviderError("MINIMAX_API_KEY is not configured.", { retryable: false });
      const model = request.model ?? process.env.MINIMAX_MODEL ?? "MiniMax-M3";
      const response = await fetch("https://api.minimax.io/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: request.messages, temperature: request.temperature ?? 0, max_completion_tokens: request.maxTokens ?? 1800, stream: false }),
        cache: "no-store",
        signal: timeoutSignal(),
      });
      const payload = (await response.json().catch(() => null)) as ChatCompletionPayload | null;
      if (!response.ok) throw new AIProviderError(payload?.error?.message || "MiniMax request failed.", { retryable: response.status === 408 || response.status === 429 || response.status >= 500, status: response.status });
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new AIProviderError("MiniMax returned an empty response.", { retryable: true });
      return { provider: "minimax", model: payload?.model ?? model, requestId: payload?.id, content, usage: payload?.usage ? { promptTokens: payload.usage.prompt_tokens, completionTokens: payload.usage.completion_tokens, totalTokens: payload.usage.total_tokens } : undefined };
    },
  };
}

export function createPollinationsProvider() {
  return {
    name: "pollinations" as const,
    async generate(request: AIRequest): Promise<AIResult> {
      const apiKey = providerKey("POLLINATIONS_API_KEY");
      if (!apiKey) throw new AIProviderError("POLLINATIONS_API_KEY is not configured.", { retryable: false });
      const model = request.model ?? process.env.POLLINATIONS_MODEL ?? "openai-fast";
      const response = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: request.messages, temperature: request.temperature ?? 0, max_tokens: request.maxTokens ?? 1800, stream: false }),
        cache: "no-store",
        signal: timeoutSignal(),
      });
      const payload = (await response.json().catch(() => null)) as ChatCompletionPayload | null;
      if (!response.ok) throw new AIProviderError(payload?.error?.message || "Pollinations request failed.", { retryable: response.status === 408 || response.status === 429 || response.status >= 500, status: response.status });
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new AIProviderError("Pollinations returned an empty response.", { retryable: true });
      return { provider: "pollinations", model: payload?.model ?? model, requestId: payload?.id, content, usage: payload?.usage ? { promptTokens: payload.usage.prompt_tokens, completionTokens: payload.usage.completion_tokens, totalTokens: payload.usage.total_tokens } : undefined };
    },
  };
}