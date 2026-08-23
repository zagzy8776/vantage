import { NextRequest, NextResponse } from "next/server";
import { validateMonitoringConfig, getDefaultMonitoringConfig } from "@/services/investigations/monitoring/config";
import type { MonitoringConfig } from "@/services/investigations/monitoring/types";
import { requireRole } from "@/auth/middleware";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: investigationId } = await context.params;

    // TODO: Fetch existing monitoring configuration from database
    // For now, return default config
    const config = getDefaultMonitoringConfig(investigationId);

    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to get monitoring config:", error);
    return NextResponse.json(
      { error: "Failed to get monitoring configuration" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: investigationId } = await context.params;
    const body = await request.json();

    const config: Partial<MonitoringConfig> = {
      ...body,
      investigationId,
    };

    const validation = validateMonitoringConfig(config);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid monitoring configuration", details: validation.errors },
        { status: 400 }
      );
    }

    // TODO: Save monitoring configuration to database
    const savedConfig = config as MonitoringConfig;

    return NextResponse.json(savedConfig, { status: 201 });
  } catch (error) {
    console.error("Failed to save monitoring config:", error);
    return NextResponse.json(
      { error: "Failed to save monitoring configuration" },
      { status: 500 }
    );
  }
}
