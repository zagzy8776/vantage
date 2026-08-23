import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { investigationOpportunitySyntheses } from "@/lib/db/schema";
import { getInvestigationDetail } from "@/services/investigations/service";
import { calculateOpportunityDecision } from "@/services/investigations/decision/service";
import { requireInvestigationAccess } from "@/auth/middleware";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; opportunityId: string }> }
) {
  const { id: investigationId } = await context.params;

  const auth = await requireInvestigationAccess(request, investigationId, "read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { opportunityId } = await context.params;

    // Get investigation detail for context
    const detail = await getInvestigationDetail(investigationId, {
      includeEvidence: true,
    });
    if (!detail) {
      return NextResponse.json(
        { error: "Investigation not found" },
        { status: 404 }
      );
    }

    // Get opportunity synthesis from database
    const db = getDb();
    const synthesis = await db
      .select()
      .from(investigationOpportunitySyntheses)
      .where(eq(investigationOpportunitySyntheses.investigationId, investigationId))
      .limit(1);

    if (!synthesis[0] || !synthesis[0].opportunities) {
      return NextResponse.json(
        { error: "Opportunity synthesis not found" },
        { status: 404 }
      );
    }

    // Find the specific opportunity
    const opportunities = synthesis[0].opportunities as Array<{
      id?: string;
      title: string;
      statement?: string;
      confidence?: number;
      businessIds?: string[];
      evidenceIds?: string[];
      riskSummary?: string;
      assumptions?: string[];
      status?: string;
    }>;
    const opportunity = opportunities.find(
      (opp) => opp.id === opportunityId || opp.title === opportunityId
    );
    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Build decision context
    const decisionContext = {
      totalBusinesses: detail.businesses.length,
      evidenceCount: opportunity.evidenceIds?.length || 0,
      evidenceQuality: determineEvidenceQuality(
        opportunity.evidenceIds?.length || 0,
        detail.businesses.length
      ),
      unknowns: (synthesis[0].unknowns as string[]) || [],
      hasContradictions: false, // TODO: Detect contradictions from evidence
      contradictionCount: 0,
      validationComplexity: determineValidationComplexity(
        opportunity.assumptions?.length || 0,
        (synthesis[0].unknowns as string[])?.length || 0
      ),
    };

    // Calculate decision
    const decision = calculateOpportunityDecision(
      {
        title: opportunity.title,
        statement: opportunity.statement || "",
        confidence: opportunity.confidence || 50,
        businessIds: opportunity.businessIds || [],
        evidenceIds: opportunity.evidenceIds || [],
        riskSummary: opportunity.riskSummary || "",
        assumptions: opportunity.assumptions || [],
        status: (opportunity.status as "hypothesis" | "needs_validation") || "hypothesis",
      },
      decisionContext
    );

    return NextResponse.json(decision);
  } catch (error) {
    console.error("Decision calculation error:", error);
    return NextResponse.json(
      { error: "Failed to calculate decision" },
      { status: 500 }
    );
  }
}

/**
 * Determine evidence quality from count and sample size
 */
function determineEvidenceQuality(
  evidenceCount: number,
  sampleSize: number
): "low" | "medium" | "high" {
  const ratio = sampleSize > 0 ? evidenceCount / sampleSize : 0;
  if (evidenceCount >= 5 && ratio >= 0.5) return "high";
  if (evidenceCount >= 3 && ratio >= 0.3) return "medium";
  return "low";
}

/**
 * Determine validation complexity from assumptions and unknowns
 */
function determineValidationComplexity(
  assumptionsCount: number,
  unknownsCount: number
): "low" | "medium" | "high" {
  const total = assumptionsCount + unknownsCount;
  if (total <= 2) return "low";
  if (total <= 5) return "medium";
  return "high";
}
