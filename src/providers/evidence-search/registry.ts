import { exaEvidenceSearchProvider } from "./exa";
import { tavilyEvidenceSearchProvider } from "./tavily";
import type { EvidenceSearchProvider, EvidenceSearchProviderId } from "./types";

export const evidenceSearchRegistry: Record<EvidenceSearchProviderId, EvidenceSearchProvider> = {
  tavily: tavilyEvidenceSearchProvider,
  exa: exaEvidenceSearchProvider,
};