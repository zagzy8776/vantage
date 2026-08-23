import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/services/collaboration/report";
import { requireInvestigationAccess } from "@/auth/middleware";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: investigationId } = await context.params;

  // Tenant isolation: write access required to generate reports
  const auth = await requireInvestigationAccess(request, investigationId, "write");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    const {
      investigationTitle,
      investigationObjective,
      executiveSummary,
      findings,
      evidence,
      opportunities,
      recommendedActions,
      generatedBy,
      generatedByName,
    } = body;

    if (!investigationTitle || !executiveSummary || !generatedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const report = generateReport({
      investigationId,
      investigationTitle,
      investigationObjective: investigationObjective || "",
      executiveSummary,
      findings: (findings || []).map((f: { level: string }) => ({ ...f, level: (f.level as "fact" | "finding") })),
      evidence: (evidence || []).map((e: { level: string }) => ({ ...e, level: (e.level as "fact" | "finding") })),
      opportunities: opportunities || [],
      recommendedActions: recommendedActions || [],
      generatedBy,
      generatedByName,
    });

    // TODO: Save report to database
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Failed to generate report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: investigationId } = await context.params;

  // Tenant isolation: read access required
  const auth = await requireInvestigationAccess(request, investigationId, "read");
  if (auth instanceof NextResponse) return auth;

  try {
    void investigationId;

    // TODO: Fetch reports from database
    const reports: unknown[] = [];

    return NextResponse.json(reports);
  } catch (error) {
    console.error("Failed to get reports:", error);
    return NextResponse.json(
      { error: "Failed to get reports" },
      { status: 500 }
    );
  }
}
