import { and, desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { researchCreditAccounts, researchCreditLedger } from "@/lib/db/schema";

export type ResearchPlan = "free" | "pro" | "researcher" | "team" | "enterprise";

export const DEFAULT_RESEARCH_LIMITS: Record<ResearchPlan, number> = {
  free: 5,
  pro: 50,
  researcher: 250,
  team: 1000,
  enterprise: 5000,
};

function accountId(userId: string) {
  return `credit_${userId}`;
}

function ledgerId() {
  return `credit_tx_${randomBytes(12).toString("hex")}`;
}

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function ensureResearchCreditAccount(
  userId: string,
  plan: ResearchPlan = "free",
) {
  const db = getDb();
  const limit = DEFAULT_RESEARCH_LIMITS[plan] ?? DEFAULT_RESEARCH_LIMITS.free;
  const start = monthStart();

  await db
    .insert(researchCreditAccounts)
    .values({
      userId,
      plan,
      monthlyLimit: limit,
      monthlyUsed: 0,
      periodStart: start,
    })
    .onConflictDoNothing({ target: researchCreditAccounts.userId });

  const row = (
    await db
      .select()
      .from(researchCreditAccounts)
      .where(eq(researchCreditAccounts.userId, userId))
      .limit(1)
  )[0];

  if (!row) throw new Error("Research credit account unavailable.");

  if (row.periodStart.getTime() < start.getTime()) {
    const reset = await db
      .update(researchCreditAccounts)
      .set({ monthlyUsed: 0, periodStart: start, updatedAt: new Date() })
      .where(
        and(
          eq(researchCreditAccounts.userId, userId),
          sql`${researchCreditAccounts.periodStart} < ${start}`,
        ),
      )
      .returning();
    return reset[0] ?? row;
  }

  return row;
}

export async function getResearchCredits(userId: string, plan: ResearchPlan = "free") {
  const row = await ensureResearchCreditAccount(userId, plan);
  return {
    plan: row.plan as ResearchPlan,
    limit: row.monthlyLimit,
    used: row.monthlyUsed,
    remaining: Math.max(0, row.monthlyLimit - row.monthlyUsed),
    periodStart: row.periodStart,
  };
}

/**
 * Atomically reserve one research credit. The UPDATE predicate makes two
 * concurrent requests compete safely without a read-then-write race.
 */
export async function reserveResearchCredit(input: {
  userId: string;
  plan?: ResearchPlan;
  searchRunId: string;
}): Promise<{ ok: true; remaining: number } | { ok: false; remaining: number; limit: number }> {
  await ensureResearchCreditAccount(input.userId, input.plan ?? "free");
  const db = getDb();
  const rows = await db
    .update(researchCreditAccounts)
    .set({ monthlyUsed: sql`${researchCreditAccounts.monthlyUsed} + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(researchCreditAccounts.userId, input.userId),
        sql`${researchCreditAccounts.monthlyUsed} < ${researchCreditAccounts.monthlyLimit}`,
      ),
    )
    .returning({ used: researchCreditAccounts.monthlyUsed, limit: researchCreditAccounts.monthlyLimit });

  if (!rows[0]) {
    const current = await getResearchCredits(input.userId, input.plan ?? "free");
    return { ok: false, remaining: current.remaining, limit: current.limit };
  }

  await db.insert(researchCreditLedger).values({
    id: ledgerId(),
    userId: input.userId,
    amount: -1,
    kind: "reservation",
    searchRunId: input.searchRunId,
    description: "Research run reservation",
  });

  return { ok: true, remaining: Math.max(0, rows[0].limit - rows[0].used) };
}

export async function refundResearchCredit(input: {
  userId: string;
  searchRunId: string;
  reason?: string;
}) {
  const db = getDb();
  const existing = await db
    .select({ id: researchCreditLedger.id })
    .from(researchCreditLedger)
    .where(
      and(
        eq(researchCreditLedger.userId, input.userId),
        eq(researchCreditLedger.searchRunId, input.searchRunId),
        eq(researchCreditLedger.kind, "refund"),
      ),
    )
    .limit(1);
  if (existing[0]) return;

  const rows = await db
    .update(researchCreditAccounts)
    .set({ monthlyUsed: sql`GREATEST(0, ${researchCreditAccounts.monthlyUsed} - 1)`, updatedAt: new Date() })
    .where(eq(researchCreditAccounts.userId, input.userId))
    .returning({ userId: researchCreditAccounts.userId });
  if (!rows[0]) return;

  await db.insert(researchCreditLedger).values({
    id: ledgerId(),
    userId: input.userId,
    amount: 1,
    kind: "refund",
    searchRunId: input.searchRunId,
    description: input.reason ?? "Research run refund",
  });
}

export async function listResearchCreditLedger(userId: string, limit = 50) {
  return getDb()
    .select()
    .from(researchCreditLedger)
    .where(eq(researchCreditLedger.userId, userId))
    .orderBy(desc(researchCreditLedger.createdAt))
    .limit(Math.max(1, Math.min(limit, 100)));
}
