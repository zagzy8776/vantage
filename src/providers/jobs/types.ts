export type JobProvider = "adzuna" | "jsearch" | "jobspipe" | "hirebase" | "theirstack" | "web_discovery";
export type RegionalJobProvider = "myjobmag" | "jobberman" | "hotnigerianjobs" | "jobgurus" | "jobsinnigeria" | "workinnigeria" | "fuzu" | "careerjet" | "brightermonday" | "careers24" | "careerjunction" | "pnet" | "careerlinkafrica" | "jobsphere" | "jobsearchafrica" | "postkazi" | "hiresasa" | "talentpot" | "worknation" | "closely" | "africajobline" | "jobconnectafrica" | "pacafrica";
export type AnyJobProvider = JobProvider | RegionalJobProvider;

export type JobVerificationStatus = "unverified" | "needs_verification" | "direct_employer_verified" | "rejected" | "stale";

export interface JobSearchQuery {
  title: string;
  country?: string;
  countryCode?: string;
  city?: string;
  remote?: boolean;
  directOnly?: boolean;
  limit?: number;
  postedWithinDays?: number;
  page?: number;
  cursor?: string;
}

export interface JobIntelligence {
  summary: string;
  seniority?: string;
  mustHave: string[];
  niceToHave: string[];
  skills: string[];
  experience?: string;
  education?: string;
  responsibilities: string[];
  locationRequirement?: string;
  remotePolicy?: string;
  applicationAdvice: string[];
  unknowns: string[];
  confidence: number;
  provider?: string;
  model?: string;
  source?: "ai" | "evidence";
}

export interface JobContactEvidence { value: string; url: string; reason: string; }

export interface NormalizedJob {
  id: string;
  provider: AnyJobProvider;
  title: string;
  companyName: string;
  companyDomain?: string;
  companyWebsite?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyContactUrl?: string;
  companyContactEvidence?: JobContactEvidence[];
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
  intelligence?: JobIntelligence;
  verificationStatus: JobVerificationStatus;
  verificationScore?: number;
  verificationReasons: string[];
  verificationEvidence?: Array<{ url: string; reason: string }>;
}

export interface JobProviderResult {
  provider: JobProvider;
  status: "success" | "zero-results" | "unavailable" | "rate-limited" | "invalid-request" | "failed";
  jobs: NormalizedJob[];
  totalCount?: number;
  nextCursor?: string;
  hasMore?: boolean;
  errorMessage?: string;
}

export interface JobDiscoveryProvider { name: JobProvider; search(query: JobSearchQuery): Promise<JobProviderResult>; }
