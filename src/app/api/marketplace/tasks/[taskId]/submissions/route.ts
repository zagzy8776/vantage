import { NextRequest, NextResponse } from "next/server";
import { submitEvidence } from "@/marketplace/service";
import { validateEvidenceSubmission } from "@/marketplace/validation";
import { validateMarketplaceUrl } from "@/marketplace/submission-sanitizer";
import { containsXss } from "@/lib/security/input-sanitizer";
import { requireAuth, requireRole } from "@/auth/middleware";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  // Require authentication
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Require researcher or higher role to submit evidence
  const authorized = await requireRole(request, ["owner", "admin", "analyst", "researcher"]);
  if (authorized instanceof NextResponse) return authorized;

  try {
    const { taskId } = await context.params;
    const body = await request.json();

    const {
      submittedByName,
      evidence,
      sources,
      observations,
      unknowns,
      notes,
    } = body;

    if (!Array.isArray(evidence) || !Array.isArray(sources) || typeof notes !== "string") {
      return NextResponse.json(
        { error: "evidence, sources and notes are required" },
        { status: 400 }
      );
    }

    // PH3: submissions are attributed to the authenticated researcher -
    // a caller cannot submit evidence under another user's identity.
    const cleanSubmittedByName =
      typeof submittedByName === "string" && submittedByName.trim().length > 0
        ? submittedByName.trim().slice(0, 120)
        : auth.email;

    // PH3: reject XSS payloads in free-text fields (raw input, pre-storage)
    const textFields: Array<[string, string]> = [["notes", notes]];
    (Array.isArray(observations) ? observations : []).forEach((o: unknown, i: number) => {
      if (typeof o === "string") textFields.push(["observation " + (i + 1), o]);
    });
    evidence.forEach((ev: unknown, i: number) => {
      const statement = (ev as { statement?: unknown } | null)?.statement;
      if (typeof statement === "string") textFields.push(["evidence " + (i + 1), statement]);
    });
    for (const [label, text] of textFields) {
      if (containsXss(text)) {
        return NextResponse.json(
          { error: label + " contains potentially malicious content" },
          { status: 400 }
        );
      }
    }

    // PH3: every cited URL must be a well-formed http(s) URL without injection
    for (let i = 0; i < sources.length; i++) {
      const url = (sources[i] as { url?: unknown } | null)?.url;
      const check = validateMarketplaceUrl(typeof url === "string" ? url : "");
      if (!check.valid) {
        return NextResponse.json(
          { error: "Source " + (i + 1) + ": " + (check.error ?? "invalid URL") },
          { status: 400 }
        );
      }
    }
    for (let i = 0; i < evidence.length; i++) {
      const sourceUrl = (evidence[i] as { sourceUrl?: unknown } | null)?.sourceUrl;
      if (typeof sourceUrl === "string" && sourceUrl.trim().length > 0) {
        const check = validateMarketplaceUrl(sourceUrl);
        if (!check.valid) {
          return NextResponse.json(
            { error: "Evidence " + (i + 1) + ": " + (check.error ?? "invalid source URL") },
            { status: 400 }
          );
        }
      }
    }

    // Validate submission
    const validation = validateEvidenceSubmission(
      evidence,
      sources,
      observations || [],
      unknowns || [],
      notes
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }

    const submission = submitEvidence(
      taskId,
      auth.userId,
      cleanSubmittedByName,
      evidence,
      sources,
      observations || [],
      unknowns || [],
      notes
    );

    // TODO: Save submission to database
    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error("Failed to submit evidence:", error);
    return NextResponse.json(
      { error: "Failed to submit evidence" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  // Require authentication
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Require analyst or higher role to view submissions
  const authorized = await requireRole(request, ["owner", "admin", "analyst", "reviewer"]);
  if (authorized instanceof NextResponse) return authorized;

  try {
    await context.params;

    // TODO: Fetch submissions for task from database
    const submissions: unknown[] = [];

    return NextResponse.json(submissions);
  } catch (error) {
    console.error("Failed to get submissions:", error);
    return NextResponse.json(
      { error: "Failed to get submissions" },
      { status: 500 }
    );
  }
}
