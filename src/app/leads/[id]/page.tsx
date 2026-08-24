export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_LEADS } from "@/data/mockData";
import { OpportunityScore } from "@/components/ui/OpportunityScore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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

async function loadLead(id: string) {
  const db = getDb();
  const row = await db
    .select({
      leadId: leads.id,
      opportunityScore: leads.opportunityScore,
      status: leads.status,
      websiteStatus: leads.websiteStatus,
      reason: leads.reason,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      businessId: businesses.id,
      externalId: businesses.externalId,
      source: businesses.source,
      name: businesses.name,
      category: businesses.category,
      address: businesses.address,
      country: businesses.country,
      region: businesses.region,
      city: businesses.city,
      area: businesses.area,
      street: businesses.street,
      latitude: businesses.latitude,
      longitude: businesses.longitude,
      phone: businesses.phone,
      website: businesses.website,
      verificationStatus: businesses.verificationStatus,
      rating: businesses.rating,
      reviewCount: businesses.reviewCount,
      priceLevel: businesses.priceLevel,
      discoveredAt: businesses.discoveredAt,
      businessUpdatedAt: businesses.updatedAt,
    })
    .from(leads)
    .innerJoin(businesses, eq(leads.businessId, businesses.id))
    .where(eq(leads.id, id))
    .limit(1);

  return row[0] ?? null;
}

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const record = await loadLead(params.id).catch(() => null);
  const latestWebsiteAnalyses = record ? await getLatestWebsiteAnalyses(record.businessId).catch(() => []) : [];
  const intelligenceHistory = record ? await getLeadIntelligenceHistory(record.leadId).catch(() => []) : [];
  const evidence = record ? await getBusinessEvidence(record.businessId).catch(() => []) : [];
  const evidenceConflicts = record ? await getBusinessEvidenceConflicts(record.businessId).catch(() => []) : [];
  const lead = record
    ? {
        id: record.leadId,
        business: {
          id: record.businessId,
          name: record.name,
          category: record.category,
          location: {
            country: record.country ?? "Unknown",
            countryCode: record.country?.slice(0, 2).toUpperCase() ?? "UN",
            region: record.region,
            city: record.city ?? "Unknown",
            area: record.area,
            street: record.street,
          },
          website: record.website,
          phone: record.phone,
          discoveredAt: record.discoveredAt.toISOString(),
        },
        opportunityScore: record.opportunityScore,
        websiteHealth: record.websiteStatus,
        status: record.status,
        lastAnalyzedAt: null,
        reason: record.reason,
        website: null,
        websiteAnalysis: latestWebsiteAnalyses[0]
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
          : null,
      }
    : MOCK_LEADS.find((l) => l.id === params.id);

  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
        <div>
          <div className="flex items-center gap-2 text-xs text-subtle uppercase tracking-wider font-mono mb-2"><span>Opportunity</span><span>•</span><span>Research brief</span></div>
          <h1 className="text-2xl font-extrabold font-mono">{lead.business.name}</h1>
          <p className="text-sm text-subtle">{lead.business.category} • {lead.business.location.city}, {lead.business.location.country}</p>
        </div>
        <div className="flex items-center gap-2"><StatusBadge type="stage" value={lead.status} /><StatusBadge type="health" value={lead.websiteHealth} /></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <Card title="Business Overview" subtitle="Customer-facing research summary." className="xl:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><div className="text-subtle text-xs uppercase">Name</div><div>{lead.business.name}</div></div>
            <div><div className="text-subtle text-xs uppercase">Category</div><div>{lead.business.category}</div></div>
            <div><div className="text-subtle text-xs uppercase">Location</div><div>{lead.business.location.city}, {lead.business.location.country}</div></div>
            <div><div className="text-subtle text-xs uppercase">Website</div><a className="text-accent hover:underline" href={lead.business.website ?? "#"} target="_blank" rel="noopener noreferrer">{lead.business.website ? formatDomain(lead.business.website) : "No website"}</a></div>
            <div><div className="text-subtle text-xs uppercase">Phone</div><div>{lead.business.phone ?? "—"}</div></div>
            <div><div className="text-subtle text-xs uppercase">Research status</div><div>{lead.status === "discovered" ? "Newly researched" : lead.status}</div></div>
            <div><div className="text-subtle text-xs uppercase">Discovered</div><div>{formatDate(lead.business.discoveredAt)}</div></div>
            <div><div className="text-subtle text-xs uppercase">Last analyzed</div><div>{formatDate(lead.lastAnalyzedAt)}</div></div>
          </div>
        </Card>
        <Card title="Opportunity Signal" subtitle="A quick prioritization signal for this business."><div className="flex items-center justify-center py-3"><OpportunityScore score={lead.opportunityScore} size="xl" showLabel /></div></Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <Card title="Why This Lead?" subtitle="What VANTAGE sees as the immediate reason to investigate further." className="xl:col-span-2"><p className="text-sm text-subtle leading-6">{lead.reason}</p></Card>
        <WebsiteAnalysisPanel
          businessId={lead.business.id}
          websiteUrl={lead.business.website}
          websiteStatus={lead.websiteHealth}
          initialAnalysis={lead.websiteAnalysis ?? null}
        />
      </div>

      <LeadIntelligencePanel leadId={lead.id} initialScore={lead.opportunityScore} initialIntelligence={intelligenceHistory[0] ?? null} history={intelligenceHistory} />
      {record && <EvidenceOverview evidence={evidence} conflicts={evidenceConflicts} aiConflicts={intelligenceHistory.flatMap((item) => item.validationIssues.filter((issue) => issue.type === "contradiction"))} verificationStatus={record.verificationStatus} />}
      <Card title="Outreach" subtitle="Personalized outreach will be available after qualification."><div className="flex items-start justify-between gap-4 flex-col sm:flex-row"><p className="text-sm text-subtle">Reserved for future personalized outreach drafts.</p><Button disabled variant="secondary">Generate Outreach Draft</Button></div></Card>
      <div><Link href="/leads" className="text-xs text-accent hover:underline">← Back to leads</Link></div>
    </div>
  );
}