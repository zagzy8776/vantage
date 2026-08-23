import { NextRequest, NextResponse } from "next/server";
import { applyForTask } from "@/marketplace/service";
import { sanitizeTaskApplication } from "@/marketplace/submission-sanitizer";
import { requireAuth, requireRole } from "@/auth/middleware";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  // Require authentication
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Require researcher or higher role to apply for tasks
  const authorized = await requireRole(request, ["owner", "admin", "analyst", "researcher"]);
  if (authorized instanceof NextResponse) return authorized;

  try {
    const { taskId } = await context.params;
    const body = await request.json();

    const {
      applicantName,
      coverLetter,
      qualifications,
      proposedTimeline,
    } = body;

    if (typeof coverLetter !== "string" || coverLetter.trim().length === 0) {
      return NextResponse.json(
        { error: "Cover letter is required" },
        { status: 400 }
      );
    }

    // PH3: identity comes from the session, not the request body -
    // an authenticated researcher cannot apply as someone else.
    let sanitizedApplication: ReturnType<typeof sanitizeTaskApplication>;
    try {
      sanitizedApplication = sanitizeTaskApplication({
        taskId,
        coverLetter,
        qualifications: Array.isArray(qualifications)
          ? qualifications.filter((q): q is string => typeof q === "string")
          : [],
        proposedTimeline: typeof proposedTimeline === "string" ? proposedTimeline : "",
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid application" },
        { status: 400 }
      );
    }
    const cleanApplicantName =
      typeof applicantName === "string" && applicantName.trim().length > 0
        ? applicantName.trim().slice(0, 120)
        : auth.email;

    const application = applyForTask(
      taskId,
      auth.userId,
      cleanApplicantName,
      auth.email,
      sanitizedApplication.coverLetter,
      sanitizedApplication.qualifications,
      sanitizedApplication.proposedTimeline
    );

    // TODO: Save application to database
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    console.error("Failed to apply for task:", error);
    return NextResponse.json(
      { error: "Failed to apply for task" },
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

  // Require analyst or higher role to view applications
  const authorized = await requireRole(request, ["owner", "admin", "analyst"]);
  if (authorized instanceof NextResponse) return authorized;

  try {
    await context.params;

    // TODO: Fetch applications for task from database
    const applications: unknown[] = [];

    return NextResponse.json(applications);
  } catch (error) {
    console.error("Failed to get applications:", error);
    return NextResponse.json(
      { error: "Failed to get applications" },
      { status: 500 }
    );
  }
}
