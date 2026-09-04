export type JobProvider = "adzuna" | "jsearch" | "jobspipe" | "hirebase" | "theirstack";

export type JobVerificationStatus = "unverified" | "needs_verification" | "direct_employer_verified" | "rejected" | "stale";

export interface JobSearchQuery {
  title: string;
  country?: string;
  countryCode?: string;
  city?: string;
  remote?: boolean;
  limit?: number;
  postedWithinDays?: number;
}

export interface NormalizedJob {
  id: string;
  provider: JobProvider;
  title: string;
  companyName: string;
  companyDomain?: string;
  description?: string;
  location?: string;
  countryCode?: string;
  city?: string;
  employmentType?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  postedAt?: string;
  lastSeenAt?: string;
  applyUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  requirements?: string[];
  verificationStatus: JobVerificationStatus;
  verificationScore?: number;
  verificationReasons: string[];
  verificationEvidence?: Array<{ url: string; reason: string }>;
}

export interface JobProviderResult {
  provider: JobProvider;
  status: "success" | "zero-results" | "unavailable" | "rate-limited" | "invalid-request" | "failed";
  jobs: NormalizedJob[];
  errorMessage?: string;
}

export interface JobDiscoveryProvider {
  name: JobProvider;
  search(query: JobSearchQuery): Promise<JobProviderResult>;
}
