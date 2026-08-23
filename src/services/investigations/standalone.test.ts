import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStandaloneInvestigation } from "./service";

const mockCreateInvestigationPlan = vi.fn();

vi.mock("./planning/planner", () => ({
  createInvestigationPlan: (...args: unknown[]) => mockCreateInvestigationPlan(...args),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    insert: () => ({
      values: () => ({
        returning: () => [],
      }),
    }),
  }),
}));

describe("createStandaloneInvestigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates investigation and generates plan with correct objective snapshot", async () => {
    mockCreateInvestigationPlan.mockResolvedValue({
      planId: "plan_123",
      version: 1,
      status: "review",
      validationIssues: [],
    });

    const result = await createStandaloneInvestigation({
      title: "Test Investigation",
      objective: "Test objective",
      investigationType: "problem",
      industry: "Restaurants",
      geography: {
        country: "Nigeria",
        city: "Lagos",
      },
      problemCategory: "appointment_no_shows",
      researchQuestion: "Test question",
    });

    expect(result.investigationId).toBeDefined();
    expect(result.planId).toBe("plan_123");
    expect(result.planVersion).toBe(1);

    expect(mockCreateInvestigationPlan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        objectiveSnapshot: {
          investigationType: "problem",
          objective: "Test objective",
          problemCategory: "appointment_no_shows",
          serviceCategory: undefined,
          targetIndustry: "Restaurants",
          geography: {
            country: "Nigeria",
            city: "Lagos",
          },
          criteria: undefined,
        },
      })
    );
  });

  it("handles service opportunity investigations with service category", async () => {
    mockCreateInvestigationPlan.mockResolvedValue({
      planId: "plan_456",
      version: 1,
      status: "review",
      validationIssues: [],
    });

    const result = await createStandaloneInvestigation({
      title: "Service Opportunity Test",
      objective: "Find service opportunities",
      investigationType: "service_opportunity",
      geography: {
        country: "Canada",
        city: "Toronto",
      },
      serviceCategory: "delivery",
    });

    expect(result.planId).toBe("plan_456");

    expect(mockCreateInvestigationPlan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        objectiveSnapshot: expect.objectContaining({
          investigationType: "service_opportunity",
          serviceCategory: "delivery",
          problemCategory: undefined,
        }),
      })
    );
  });

  it("validates problem category for problem investigations", async () => {
    await expect(
      createStandaloneInvestigation({
        title: "Test",
        objective: "Test",
        investigationType: "problem",
        geography: { country: "Nigeria" },
      })
    ).rejects.toThrow("Problem category is required");
  });

  it("validates service category for service opportunity investigations", async () => {
    await expect(
      createStandaloneInvestigation({
        title: "Test",
        objective: "Test",
        investigationType: "service_opportunity",
        geography: { country: "Nigeria" },
      })
    ).rejects.toThrow("Service category is required");
  });

  it("validates geography country is required", async () => {
    await expect(
      createStandaloneInvestigation({
        title: "Test",
        objective: "Test",
        investigationType: "industry",
        geography: { country: "" },
      })
    ).rejects.toThrow("Country is required");
  });

  it("validates title is required", async () => {
    await expect(
      createStandaloneInvestigation({
        title: "",
        objective: "Test",
        investigationType: "industry",
        geography: { country: "Nigeria" },
      })
    ).rejects.toThrow("Title is required");
  });

  it("validates objective is required", async () => {
    await expect(
      createStandaloneInvestigation({
        title: "Test",
        objective: "",
        investigationType: "industry",
        geography: { country: "Nigeria" },
      })
    ).rejects.toThrow("Objective is required");
  });

  it("validates investigation type", async () => {
    await expect(
      createStandaloneInvestigation({
        title: "Test",
        objective: "Test",
        investigationType: "invalid_type" as "company" | "industry" | "market" | "problem" | "service_opportunity",
        geography: { country: "Nigeria" },
      })
    ).rejects.toThrow("Invalid investigation type");
  });

  it("handles optional geography fields", async () => {
    mockCreateInvestigationPlan.mockResolvedValue({
      planId: "plan_789",
      version: 1,
      status: "review",
      validationIssues: [],
    });

    const result = await createStandaloneInvestigation({
      title: "Test",
      objective: "Test",
      investigationType: "industry",
      geography: {
        country: "USA",
        region: "California",
        city: "San Francisco",
      },
    });

    expect(result.planId).toBe("plan_789");

    expect(mockCreateInvestigationPlan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        objectiveSnapshot: expect.objectContaining({
          geography: {
            country: "USA",
            region: "California",
            city: "San Francisco",
          },
        }),
      })
    );
  });

  it("handles optional industry field", async () => {
    mockCreateInvestigationPlan.mockResolvedValue({
      planId: "plan_abc",
      version: 1,
      status: "review",
      validationIssues: [],
    });

    const result = await createStandaloneInvestigation({
      title: "Test",
      objective: "Test",
      investigationType: "market",
      geography: { country: "UK" },
      industry: "Technology",
    });

    expect(result.planId).toBe("plan_abc");

    expect(mockCreateInvestigationPlan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        objectiveSnapshot: expect.objectContaining({
          targetIndustry: "Technology",
        }),
      })
    );
  });

  it("handles optional research question", async () => {
    mockCreateInvestigationPlan.mockResolvedValue({
      planId: "plan_xyz",
      version: 1,
      status: "review",
      validationIssues: [],
    });

    const result = await createStandaloneInvestigation({
      title: "Test",
      objective: "Test",
      investigationType: "problem",
      geography: { country: "Germany" },
      problemCategory: "appointment_no_shows",
      researchQuestion: "What is the impact?",
    });

    expect(result.planId).toBe("plan_xyz");

    expect(mockCreateInvestigationPlan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        objectiveSnapshot: expect.objectContaining({
          investigationType: "problem",
          objective: "Test",
          problemCategory: "appointment_no_shows",
          geography: { country: "Germany" },
          criteria: undefined,
        }),
      })
    );
  });

  it("handles optional criteria", async () => {
    mockCreateInvestigationPlan.mockResolvedValue({
      planId: "plan_criteria",
      version: 1,
      status: "review",
      validationIssues: [],
    });

    const result = await createStandaloneInvestigation({
      title: "Test",
      objective: "Test",
      investigationType: "company",
      geography: { country: "France" },
      criteria: { minRevenue: 1000000, maxEmployees: 500 },
    });

    expect(result.planId).toBe("plan_criteria");

    expect(mockCreateInvestigationPlan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        objectiveSnapshot: expect.objectContaining({
          investigationType: "company",
          objective: "Test",
          geography: { country: "France" },
          criteria: { minRevenue: 1000000, maxEmployees: 500 },
        }),
      })
    );
  });

  it("plan starts with review status when valid", async () => {
    mockCreateInvestigationPlan.mockResolvedValue({
      planId: "plan_review",
      version: 1,
      status: "review",
      validationIssues: [],
    });

    await createStandaloneInvestigation({
      title: "Test",
      objective: "Test",
      investigationType: "industry",
      geography: { country: "Japan" },
    });

    expect(mockCreateInvestigationPlan).toHaveBeenCalled();
  });

  it("plan starts with draft status when validation issues exist", async () => {
    mockCreateInvestigationPlan.mockResolvedValue({
      planId: "plan_draft",
      version: 1,
      status: "draft",
      validationIssues: [{ path: "steps[0]", code: "missing_provider", message: "Provider required" }],
    });

    await createStandaloneInvestigation({
      title: "Test",
      objective: "Test",
      investigationType: "industry",
      geography: { country: "Brazil" },
    });

    expect(mockCreateInvestigationPlan).toHaveBeenCalled();
  });
});
