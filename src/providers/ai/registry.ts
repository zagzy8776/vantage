import type { AIProvider, AIProviderId } from "./types";
import { cerebrasProvider } from "./providers/cerebras";
import { groqProvider } from "./providers/groq";
import { openRouterProvider } from "./providers/openrouter";

export const aiProviderRegistry: Record<AIProviderId, AIProvider> = {
  groq: groqProvider,
  cerebras: cerebrasProvider,
  openrouter: openRouterProvider,
};