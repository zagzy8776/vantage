import { MOCK_PROVIDERS } from "@/data/mockData";
import { getAIProviderOrder } from "@/providers/ai/router";

const aiEnvKeys: Record<string, string> = {
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  together: "TOGETHER_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  minimax: "MINIMAX_API_KEY",
  pollinations: "POLLINATIONS_API_KEY",
};

export default function ProvidersPage() {
  const aiProviders = MOCK_PROVIDERS.filter((provider) => provider.kind === "ai");
  const order = getAIProviderOrder();
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-mono font-extrabold">AI Providers</h1><p className="text-sm text-subtle">Server-side providers used by the evidence-based intelligence router. Credentials are never shown.</p></div>
      <div className="border border-border rounded-lg p-4 bg-surface"><div className="text-xs text-subtle uppercase font-mono">Fallback order</div><div className="mt-2 flex flex-wrap gap-2">{order.map((provider, index) => <span key={provider} className="text-xs font-mono border border-border rounded px-2 py-1">{index + 1}. {provider}</span>)}</div></div>
      <div className="grid gap-3 md:grid-cols-2">{aiProviders.map((provider) => { const configured = Boolean(process.env[aiEnvKeys[provider.id]]?.trim()); return <div key={provider.id} className="border border-border rounded-lg p-4 bg-surface"><div className="flex items-center justify-between gap-3"><div><div className="font-semibold">{provider.name}</div><div className="text-xs text-subtle uppercase font-mono">{provider.kind}</div></div><div className={`text-[10px] font-mono ${configured ? "text-success" : "text-subtle"}`}>{configured ? "CONFIGURED" : "NOT CONFIGURED"}</div></div><p className="text-sm text-subtle mt-2">{provider.description}</p><div className="text-[10px] font-mono text-subtle mt-3">{provider.envKey}</div></div>; })}</div>
    </div>
  );
}