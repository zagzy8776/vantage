import { NextRequest, NextResponse } from "next/server";
import { exportReport } from "@/services/collaboration/report";
import type { ExportFormat } from "@/services/collaboration/types";
import { requireInvestigationAccess } from "@/auth/middleware";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; reportId: string }> }
) {
  const { id: investigationId } = await context.params;

  // Tenant isolation: read access required to export reports
  const auth = await requireInvestigationAccess(request, investigationId, "read");
  if (auth instanceof NextResponse) return auth;

  try {
    void investigationId;
    const body = await request.json();
    const { format } = body;

    if (!format || !["json", "csv", "pdf"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Must be json, csv, or pdf" },
        { status: 400 }
      );
    }

    // TODO: Fetch report from database
    // const report = await getReport(reportId);
    const report = null;

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const exportResult = exportReport(report, format as ExportFormat);

    return NextResponse.json(exportResult);
  } catch (error) {
    console.error("Failed to export report:", error);
    return NextResponse.json(
      { error: "Failed to export report" },
      { status: 500 }
    );
  }
}
