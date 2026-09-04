import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { checkJobProviders } from "@/providers/jobs/health";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const providers = await checkJobProviders();
    const healthy = providers.filter((provider) => provider.status === "healthy").length;
    return NextResponse.json({ providers, summary: { total: providers.length, healthy }, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "jobs_provider_health_failed", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Provider health check is temporarily unavailable." }, { status: 503 });
  }
}
