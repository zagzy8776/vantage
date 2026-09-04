import { createOpenAICompatibleProvider } from "./shared";

export const togetherProvider = createOpenAICompatibleProvider({
  provider: "together",
  endpoint: "https://api.together.xyz/v1/chat/completions",
  apiKeyEnv: "TOGETHER_API_KEY",
  modelEnv: "TOGETHER_MODEL",
  defaultModel: "openai/gpt-oss-120b",
});
