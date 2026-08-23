import { describe, it, expect } from "vitest";
import {
  postTask,
  updateTaskStatus,
  assignTask,
  applyForTask,
  acceptApplication,
  rejectApplication,
  submitEvidence,
  updateSubmissionStatus,
  createPayment,
  updatePaymentStatus,
  getTasksByStatus,
  getApplicationsForTask,
  getSubmissionsForTask,
  getPaymentsForTask,
} from "./service";

describe("Marketplace Service", () => {
  describe("Tasks", () => {
    it("posts a new research task", () => {
      const task = postTask(
        "inv1",
        "Test Investigation",
        "user1",
        "John Doe",
        "Research Toronto beauty spas",
        "Find booking systems and pricing",
        ["Booking systems", "Pricing"],
        500,
        "USD",
        new Date("2024-12-31")
      );

      expect(task.investigationId).toBe("inv1");
      expect(task.title).toBe("Research Toronto beauty spas");
      expect(task.budget).toBe(500);
      expect(task.currency).toBe("USD");
      expect(task.status).toBe("open");
      expect(task.assignedTo).toBeNull();
    });

    it("updates task status", () => {
      const task = postTask("inv1", "Test", "user1", "John", "Task", "Desc", [], 100, "USD", null);
      const updated = updateTaskStatus(task, "in_progress");

      expect(updated.status).toBe("in_progress");
    });

    it("assigns task to researcher", () => {
      const task = postTask("inv1", "Test", "user1", "John", "Task", "Desc", [], 100, "USD", null);
      const assigned = assignTask(task, "user2", "Jane Doe");

      expect(assigned.status).toBe("assigned");
      expect(assigned.assignedTo).toBe("user2");
      expect(assigned.assignedToName).toBe("Jane Doe");
      expect(assigned.assignedAt).toBeInstanceOf(Date);
    });

    it("filters tasks by status", () => {
      const task1 = postTask("inv1", "Test", "user1", "John", "Task 1", "Desc", [], 100, "USD", null);
      const task2 = postTask("inv1", "Test", "user1", "John", "Task 2", "Desc", [], 100, "USD", null);
      const task3 = postTask("inv1", "Test", "user1", "John", "Task 3", "Desc", [], 100, "USD", null);
      
      const assigned1 = assignTask(task1, "user2", "Jane");
      const assigned2 = assignTask(task2, "user3", "Bob");

      const openTasks = getTasksByStatus([assigned1, assigned2, task3], "open");

      expect(openTasks).toHaveLength(1);
      expect(openTasks[0].id).toBe(task3.id);
    });
  });

  describe("Applications", () => {
    it("applies for a task", () => {
      const application = applyForTask(
        "task1",
        "user1",
        "Jane Doe",
        "jane@example.com",
        "I have experience in beauty industry research",
        ["5 years experience", "Fluent in English"],
        "2 weeks"
      );

      expect(application.taskId).toBe("task1");
      expect(application.applicantId).toBe("user1");
      expect(application.applicantName).toBe("Jane Doe");
      expect(application.status).toBe("pending");
    });

    it("accepts an application", () => {
      const application = applyForTask("task1", "user1", "Jane", "jane@example.com", "Cover", [], "2 weeks");
      const accepted = acceptApplication(application, "user2", "Great fit");

      expect(accepted.status).toBe("accepted");
      expect(accepted.reviewedBy).toBe("user2");
      expect(accepted.reviewNotes).toBe("Great fit");
      expect(accepted.reviewedAt).toBeInstanceOf(Date);
    });

    it("rejects an application", () => {
      const application = applyForTask("task1", "user1", "Jane", "jane@example.com", "Cover", [], "2 weeks");
      const rejected = rejectApplication(application, "user2", "Not enough experience");

      expect(rejected.status).toBe("rejected");
      expect(rejected.reviewNotes).toBe("Not enough experience");
    });

    it("filters applications by task", () => {
      const app1 = applyForTask("task1", "user1", "Jane", "jane@example.com", "Cover", [], "2 weeks");
      const app2 = applyForTask("task2", "user2", "Bob", "bob@example.com", "Cover", [], "2 weeks");
      const app3 = applyForTask("task1", "user3", "Alice", "alice@example.com", "Cover", [], "2 weeks");

      const task1Apps = getApplicationsForTask([app1, app2, app3], "task1");

      expect(task1Apps).toHaveLength(2);
      expect(task1Apps.every(a => a.taskId === "task1")).toBe(true);
    });
  });

  describe("Evidence Submissions", () => {
    it("submits evidence for a task", () => {
      const submission = submitEvidence(
        "task1",
        "user1",
        "Jane Doe",
        [
          {
            statement: "Spa uses Bookify for bookings",
            category: "booking",
            sourceUrl: "https://spa.com",
            confidence: 80,
          },
        ],
        [
          {
            url: "https://spa.com",
            title: "Spa Website",
            type: "website",
          },
        ],
        ["Observed booking widget on homepage"],
        ["Pricing not visible online"],
        "Research conducted on 2024-01-15"
      );

      expect(submission.taskId).toBe("task1");
      expect(submission.submittedBy).toBe("user1");
      expect(submission.status).toBe("pending");
      expect(submission.evidence).toHaveLength(1);
      expect(submission.sources).toHaveLength(1);
      expect(submission.observations).toHaveLength(1);
      expect(submission.unknowns).toHaveLength(1);
    });

    it("updates submission status", () => {
      const submission = submitEvidence(
        "task1",
        "user1",
        "Jane",
        [{ statement: "Test", category: "booking", sourceUrl: "https://test.com", confidence: 80 }],
        [{ url: "https://test.com", title: "Test", type: "website" }],
        [],
        [],
        "Notes"
      );
      const updated = updateSubmissionStatus(submission, "approved", "user2", "Good work");

      expect(updated.status).toBe("approved");
      expect(updated.reviewedBy).toBe("user2");
      expect(updated.reviewNotes).toBe("Good work");
      expect(updated.reviewedAt).toBeInstanceOf(Date);
    });

    it("filters submissions by task", () => {
      const sub1 = submitEvidence("task1", "user1", "Jane", [], [], [], [], "Notes");
      const sub2 = submitEvidence("task2", "user2", "Bob", [], [], [], [], "Notes");
      const sub3 = submitEvidence("task1", "user3", "Alice", [], [], [], [], "Notes");

      const task1Subs = getSubmissionsForTask([sub1, sub2, sub3], "task1");

      expect(task1Subs).toHaveLength(2);
      expect(task1Subs.every(s => s.taskId === "task1")).toBe(true);
    });
  });

  describe("Payments", () => {
    it("creates a payment record", () => {
      const payment = createPayment("task1", "sub1", "user1", "Jane Doe", "user2", 500, "USD");

      expect(payment.taskId).toBe("task1");
      expect(payment.submissionId).toBe("sub1");
      expect(payment.paidTo).toBe("user1");
      expect(payment.amount).toBe(500);
      expect(payment.currency).toBe("USD");
      expect(payment.status).toBe("pending");
    });

    it("updates payment status", () => {
      const payment = createPayment("task1", "sub1", "user1", "Jane", "user2", 500, "USD");
      const updated = updatePaymentStatus(payment, "paid", "txn_123");

      expect(updated.status).toBe("paid");
      expect(updated.transactionId).toBe("txn_123");
      expect(updated.processedAt).toBeInstanceOf(Date);
    });

    it("filters payments by task", () => {
      const pay1 = createPayment("task1", "sub1", "user1", "Jane", "user2", 500, "USD");
      const pay2 = createPayment("task2", "sub2", "user3", "Bob", "user2", 300, "USD");
      const pay3 = createPayment("task1", "sub3", "user4", "Alice", "user2", 400, "USD");

      const task1Payments = getPaymentsForTask([pay1, pay2, pay3], "task1");

      expect(task1Payments).toHaveLength(2);
      expect(task1Payments.every(p => p.taskId === "task1")).toBe(true);
    });
  });
});
