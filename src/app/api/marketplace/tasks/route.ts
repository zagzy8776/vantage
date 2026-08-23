import { NextRequest, NextResponse } from "next/server";
import { postTask } from "@/marketplace/service";
import { sanitizeTaskDescription } from "@/marketplace/submission-sanitizer";
import { requireAuth, requireRole } from "@/auth/middleware";

export async function POST(request: NextRequest) {
  // Require authentication
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Require analyst or higher role to post tasks
  const authorized = await requireRole(request, ["owner", "admin", "analyst"]);
  if (authorized instanceof NextResponse) return authorized;

  try {
    const body = await request.json();

    const {
      investigationId,
      investigationTitle,
      postedBy,
      postedByName,
      title,
      description,
      requirements,
      budget,
      currency,
      deadline,
    } = body;

    if (!investigationId || !title || !description || !budget || !postedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // PH3: input hardening - reject dangerous content, bound inputs
    if (typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
      return NextResponse.json({ error: "Title must be 1-200 characters" }, { status: 400 });
    }

    let cleanDescription: string;
    try {
      cleanDescription = sanitizeTaskDescription(typeof description === "string" ? description : "");
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid description" },
        { status: 400 }
      );
    }

    const parsedBudget = Number(budget);
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0 || parsedBudget > 1_000_000) {
      return NextResponse.json({ error: "Budget must be a positive amount up to 1,000,000" }, { status: 400 });
    }

    const cleanRequirements = Array.isArray(requirements)
      ? requirements
          .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
          .slice(0, 20)
          .map((r) => r.slice(0, 300))
      : [];

    const task = postTask(
      investigationId,
      typeof investigationTitle === "string" ? investigationTitle.slice(0, 200) : "",
      postedBy,
      typeof postedByName === "string" ? postedByName.slice(0, 120) : "",
      title.trim(),
      cleanDescription,
      cleanRequirements,
      parsedBudget,
      typeof currency === "string" && currency.length <= 3 ? currency.toUpperCase() : "USD",
      deadline ? new Date(deadline) : null
    );

    // TODO: Save task to database
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to post task:", error);
    return NextResponse.json(
      { error: "Failed to post task" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Require authentication
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // TODO: Fetch tasks from database
    const tasks: unknown[] = [];

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Failed to get tasks:", error);
    return NextResponse.json(
      { error: "Failed to get tasks" },
      { status: 500 }
    );
  }
}
