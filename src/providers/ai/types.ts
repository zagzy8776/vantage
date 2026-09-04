import type { AIRequest, AIResult } from "@/services/intelligence/types";

export type AIProviderId = "groq" | "cerebras" | "openrouter" | "minimax" | "pollinations";

export interface AIProvider {
  name: AIProviderId;
  generate(request: AIRequest): Promise<AIResult>;
}

export interface AIRouterMetadata {
  provider: string;
  model?: string;
  modelSource?: "environment" | "provider-default";
  modelRole?: "primary" | "fallback" | "preview";
  fallbackUsed: boolean;
  attempts: number;
  failures?: Array<{ provider: string; status?: number; message: string }>;
}

export interface AIRouterResult extends AIResult {
  metadata: AIRouterMetadata;
}

export interface AIRouterOptions {
  order?: AIProviderId[];
  validate?: (content: string) => void;
  repairRequest?: (content: string) => AIRequest;
}

export class AIProviderError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options?: { retryable?: boolean; status?: number }) {
    super(message);
    this.name = "AIProviderError";
    this.retryable = options?.retryable ?? true;
    this.status = options?.status;
  }
}
