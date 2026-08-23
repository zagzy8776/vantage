import type { EvidenceSearchQuery, EvidenceSearchResult } from "@/services/evidence/types";

export type EvidenceSearchProviderId = "tavily" | "exa";

export interface EvidenceSearchProvider {
  name: EvidenceSearchProviderId;
  search(query: EvidenceSearchQuery): Promise<EvidenceSearchResult>;
}

export class EvidenceSearchProviderError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options?: { retryable?: boolean; status?: number }) {
    super(message);
    this.name = "EvidenceSearchProviderError";
    this.retryable = options?.retryable ?? true;
    this.status = options?.status;
  }
}