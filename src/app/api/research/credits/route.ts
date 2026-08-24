import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { getResearchCredits, getResearchPlanForUser, listResearchCreditLedger } from "@/services/research-credits/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.userId === "public-guest") {
    return NextResponse.json({ plan: "free", limit: null, used: 0, remaining: null, demo: true });
  }

  try {
    const plan = await getResearchPlanForUser(auth.userId, auth.organizationId);
    const credits = await getResearchCredits(auth.userId, plan);
    const ledger = await listResearchCreditLedger(auth.userId, 20);
    return NextResponse.json({ ...credits, ledger }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Research credits are unavailable." }, { status: 503 });
  }
}
