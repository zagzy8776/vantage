import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAuth } from "@/auth/middleware";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = getDb();
    const rows = await db.execute(sql`
      SELECT id, provider, title, company_name AS "companyName", company_domain AS "companyDomain",
        description, location, country_code AS "countryCode", city, employment_type AS "employmentType",
        remote, salary_min AS "salaryMin", salary_max AS "salaryMax", salary_currency AS "salaryCurrency",
        posted_at AS "postedAt", last_seen_at AS "lastSeenAt", apply_url AS "applyUrl", source_url AS "sourceUrl",
        source_name AS "sourceName", requirements, verification_status AS "verificationStatus",
        verification_score AS "verificationScore", verification_reasons AS "verificationReasons",
        verification_evidence AS "verificationEvidence", stale, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM jobs
      WHERE id = ${params.id}
        AND owner_id = ${auth.userId}
        AND (${auth.organizationId ?? null} IS NULL OR organization_id = ${auth.organizationId ?? null})
      LIMIT 1
    `;
    if (!rows.length) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    return NextResponse.json({ job: rows[0] }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "job_detail_failed", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Job intelligence is temporarily unavailable." }, { status: 503 });
  }
}
