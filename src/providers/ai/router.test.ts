import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithFallback } from "./router";
import { aiProviderRegistry } from "./registry";

describe("AI provider router", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-groq";
    process.env.CEREBRAS_API_KEY = "test-cerebras";
    vi.restoreAllMocks();
  });

  it("uses the primary configured provider", async () => {
    vi.spyOn(aiProviderRegistry.groq, "generate").mockResolvedValue({ provider: "groq", model: "test", content: "{}" });
    const result = await generateWithFallback({ messages: [] }, { order: ["groq", "cerebras"] });
    expect(result.metadata).toMatchObject({ provider: "groq", fallbackUsed: false, attempts: 1 });
  });

  it("falls back after a retryable provider failure", async () => {
    vi.spyOn(aiProviderRegistry.groq, "generate").mockRejectedValue(new Error("timeout"));
    vi.spyOn(aiProviderRegistry.cerebras, "generate").mockResolvedValue({ provider: "cerebras", model: "test", content: "{}" });
    const result = await generateWithFallback({ messages: [] }, { order: ["groq", "cerebras"] });
    expect(result.metadata).toMatchObject({ provider: "cerebras", fallbackUsed: true, attempts: 2, failures: [{ provider: "groq" }] });
  });

  it("fails when all providers are unavailable", async () => {
    vi.spyOn(aiProviderRegistry.groq, "generate").mockRejectedValue(new Error("down"));
    vi.spyOn(aiProviderRegistry.cerebras, "generate").mockRejectedValue(new Error("down"));
    await expect(generateWithFallback({ messages: [] }, { order: ["groq", "cerebras"] })).rejects.toThrow("All configured AI providers");
  });

  it("retains safe failure details when all providers fail", async () => {
    vi.spyOn(aiProviderRegistry.groq, "generate").mockRejectedValue(new Error("down"));
    vi.spyOn(aiProviderRegistry.cerebras, "generate").mockRejectedValue(new Error("down"));
    try {
      await generateWithFallback({ messages: [] }, { order: ["groq", "cerebras"] });
    } catch (error) {
      expect((error as { failureDetails?: Array<{ provider: string }> }).failureDetails).toEqual([{ provider: "groq", message: "Provider request failed." }, { provider: "cerebras", message: "Provider request failed." }]);
    }
  });
});