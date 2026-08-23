export type WebsiteVerificationStatus = "verified" | "likely" | "uncertain" | "rejected";

export interface WebsiteVerificationResult {
  inputUrl: string;
  normalizedUrl: string | null;
  domain: string | null;
  officialWebsite: boolean;
  sourceReference: boolean;
  status: WebsiteVerificationStatus;
  confidenceScore: number;
  reasons: string[];
}

export interface WebsiteVerificationContext {
  businessName?: string;
  city?: string;
  country?: string;
  phone?: string;
  address?: string;
}