import type { EvidenceItem, WebsiteResearchDiagnostic } from "@/services/evidence/types";

export interface WebsiteResearchProviderRequest {
  businessId: string;
  url: string;
  maxPages: number;
}

export interface WebsiteResearchProviderResult {
  provider: string;
  pagesFetched: string[];
  evidence: EvidenceItem[];
  errors: string[];
  diagnostics?: WebsiteResearchDiagnostic[];
}

export interface WebsiteResearchProvider {
  name: "firecrawl";
  research(request: WebsiteResearchProviderRequest): Promise<WebsiteResearchProviderResult>;
}