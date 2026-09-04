import type { AIProvider, AIProviderId } from "./types";
import { cerebrasProvider } from "./providers/cerebras";
import { groqProvider } from "./providers/groq";
import { openRouterProvider } from "./providers/openrouter";
import { minimaxProvider } from "./providers/minimax";
import { pollinationsProvider } from "./providers/pollinations";
import { togetherProvider } from "./providers/together";

export const aiProviderRegistry: Record<AIProviderId, AIProvider> = {
  groq: groqProvider,
  cerebras: cerebrasProvider,
  together: togetherProvider,
  openrouter: openRouterProvider,
  minimax: minimaxProvider,
  pollinations: pollinationsProvider,
};
