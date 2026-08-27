export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { OpportunityScore } from "@/components/ui/OpportunityScore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { formatDate, formatDomain } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { businesses, leads } from "@/lib/db/schema";
import { getLatestWebsiteAnalyses } from "@/services/website-analysis/service";
import { WebsiteAnalysisPanel } from "@/components/features/WebsiteAnalysisPanel";
import { LeadIntelligencePanel } from "@/components/features/LeadIntelligencePanel";
import { getLeadIntelligenceHistory } from "@/services/intelligence/lead-analysis";
import { getBusinessEvidence, getBusinessEvidenceConflicts } from "@/services/evidence/service";
import { EvidenceOverview } from "@/components/features/EvidenceOverview";
import { OutreachPanel } from "@/components/features/OutreachPanel";
import { getBusinessPublicEmail } from "@/services/outreach/draft";

async function loadLead(id: string) {
  const db = getDb();
  const row = await db
    .select({
      leadId: leads.id,
      opportunityScore: leads.opportunityScore,
      status: leads.status,
      websiteStatus: leads.websiteStatus,
      reason: leads.reason,
      businessId: businesses.id,
      name: businesses.name,
      category: businesses.category,
      country: businesses.country,
      city: businesses.city,
      phone: businesses.phone,
      website: businesses.website,
      verificationStatus: businesses.verificationStatus,
      discoveredAt: businesses.discoveredAt,
    })
    .from(leads)
    .innerJoin(businesses, eq(leads.businessId, businesses.id))
    .where(eq(leads.id, id))
    .limit(1);

  return row[0] ?? null;
}

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const record = await loadLead(params.id).catch(() => null);
  if (!record) notFound();

  const latestWebsiteAnalyses = await getLatestWebsiteAnalyses(record.businessId).catch(() => []);
  const intelligenceHistory = await getLeadIntelligenceHistory(record.leadId).catch(() => []);
  const evidence = await getBusinessEvidence(record.businessId).catch(() => []);
  const evidenceConflicts = await getBusinessEvidenceConflicts(record.businessId).catch(() => []);
  const publicEmail = await getBusinessPublicEmail(record.businessId).catch(() => null);

  const location = [record.city, record.country].filter(Boolean).join(", ") || "—";
  const websiteAnalysis = latestWebsiteAnalyses[0]
    ? {
        businessId: record.businessId,
        url: latestWebsiteAnalyses[0].url,
        canonicalUrl: latestWebsiteAnalyses[0].url,
        normalizedUrl: latestWebsiteAnalyses[0].url,
        status: latestWebsiteAnalyses[0].status,
        errorCode: latestWebsiteAnalyses[0].errorCode,
        analyzedAt: latestWebsiteAnalyses[0].analyzedAt.toISOString(),
        performanceScore: latestWebsiteAnalyses[0].performanceScore,
        accessibilityScore: latestWebsiteAnalyses[0].accessibilityScore,
        bestPracticesScore: latestWebsiteAnalyses[0].bestPracticesScore,
        seoScore: latestWebsiteAnalyses[0].seoScore,
        reused: true,
        technicalHealthScore: null,
        websiteStatus: record.websiteStatus,
        evidence: { hasWebsite: Boolean(record.website) },
      }
    : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
        <div className="min-w-0">
          <p className="section-label text-accent mb-1">Lead</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{record.name}</h1>
          <p className="text-sm text-subtle mt-1">
            {record.category} · {location}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <OpportunityScore score={record.opportunityScore} size="lg" showLabel />
          <StatusBadge type="stage" value={record.status} />
        </div>
      </div>

      <Card title="Why this lead">
        <p className="text-sm text-subtle leading-relaxed">{record.reason}</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase text-subtle font-mono">Website</div>
            {record.website ? (
              <a className="text-accent hover:underline" href={record.website} target="_blank" rel="noopener noreferrer">
                {formatDomain(record.website)}
              </a>
            ) : (
              <span>No website</span>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase text-subtle font-mono">Phone</div>
            <div>{record.phone ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-subtle font-mono">Email</div>
            <div className="break-all">{publicEmail ?? "No public email found"}</div>
          </div>
        </div>
      </Card>

      <OutreachPanel
        leadId={record.leadId}
        initialPhone={record.phone}
        initialEmail={publicEmail}
        initialStatus={record.status}
      />

      <details className="group border border-border rounded-xl bg-surface/90 open:shadow-card">
        <summary className="cursor-pointer list-none px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">More research</div>
            <p className="text-xs text-subtle mt-0.5">Website scores, AI notes, and evidence (optional)</p>
          </div>
          <span className="text-xs font-mono text-accent group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="border-t border-border p-4 sm:p-5 space-y-6">
          <WebsiteAnalysisPanel
            businessId={record.businessId}
            websiteUrl={record.website}
            websiteStatus={record.websiteStatus}
            initialAnalysis={websiteAnalysis}
          />
          <LeadIntelligencePanel
            leadId={record.leadId}
            initialScore={record.opportunityScore}
            initialIntelligence={intelligenceHistory[0] ?? null}
            history={intelligenceHistory}
          />
          <EvidenceOverview
            evidence={evidence}
            conflicts={evidenceConflicts}
            aiConflicts={intelligenceHistory.flatMap((item) =>
              item.validationIssues.filter((issue) => issue.type === "contradiction"),
            )}
            verificationStatus={record.verificationStatus}
          />
          <p className="text-[11px] text-subtle">Discovered {formatDate(record.discoveredAt.toISOString())}</p>
        </div>
      </details>

      <Link href="/leads" className="text-xs text-accent hover:underline inline-block">
        ← Back to leads
      </Link>
    </div>
  );
}
