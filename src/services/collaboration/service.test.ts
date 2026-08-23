import { describe, it, expect } from "vitest";
import {
  addMember,
  updateMemberRole,
  removeMember,
  hasPermission,
  createNote,
  updateNote,
  deleteNote,
  getNotesByType,
  getNotesByTarget,
  createTask,
  updateTaskStatus,
  reassignTask,
  deleteTask,
  getTasksByAssignee,
  getTasksByStatus,
  createReviewRequest,
  completeReviewRequest,
  deleteReviewRequest,
  getPendingReviewsForUser,
  getReviewsByStatus,
} from "./service";

describe("Collaboration Service", () => {
  describe("Members", () => {
    it("adds a member to investigation", () => {
      const member = addMember("inv1", "user1", "John Doe", "john@example.com", "editor");
      
      expect(member.investigationId).toBe("inv1");
      expect(member.userId).toBe("user1");
      expect(member.userName).toBe("John Doe");
      expect(member.userEmail).toBe("john@example.com");
      expect(member.role).toBe("editor");
      expect(member.joinedAt).toBeInstanceOf(Date);
    });

    it("updates member role", () => {
      const member = addMember("inv1", "user1", "John", "john@example.com", "viewer");
      const updated = updateMemberRole(member, "admin");
      
      expect(updated.role).toBe("admin");
    });

    it("removes a member", () => {
      const members = [
        addMember("inv1", "user1", "John", "john@example.com", "editor"),
        addMember("inv1", "user2", "Jane", "jane@example.com", "viewer"),
      ];
      
      const updated = removeMember(members, members[0].id);
      
      expect(updated).toHaveLength(1);
      expect(updated[0].userId).toBe("user2");
    });

    it("checks member permissions", () => {
      const owner = addMember("inv1", "user1", "John", "john@example.com", "owner");
      const editor = addMember("inv1", "user2", "Jane", "jane@example.com", "editor");
      const viewer = addMember("inv1", "user3", "Bob", "bob@example.com", "viewer");
      
      expect(hasPermission(owner, "read")).toBe(true);
      expect(hasPermission(owner, "write")).toBe(true);
      expect(hasPermission(owner, "admin")).toBe(true);
      
      expect(hasPermission(editor, "read")).toBe(true);
      expect(hasPermission(editor, "write")).toBe(true);
      expect(hasPermission(editor, "admin")).toBe(false);
      
      expect(hasPermission(viewer, "read")).toBe(true);
      expect(hasPermission(viewer, "write")).toBe(false);
      expect(hasPermission(viewer, "admin")).toBe(false);
    });
  });

  describe("Notes", () => {
    it("creates a note", () => {
      const note = createNote("inv1", "user1", "John", "general", "Test note");
      
      expect(note.investigationId).toBe("inv1");
      expect(note.authorId).toBe("user1");
      expect(note.authorName).toBe("John");
      expect(note.type).toBe("general");
      expect(note.content).toBe("Test note");
      expect(note.createdAt).toBeInstanceOf(Date);
      expect(note.updatedAt).toBeInstanceOf(Date);
    });

    it("updates a note", () => {
      const note = createNote("inv1", "user1", "John", "general", "Original");
      // Small delay to ensure timestamp difference
      const originalTime = note.updatedAt.getTime();
      const updated = updateNote(note, "Updated content");
      
      expect(updated.content).toBe("Updated content");
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalTime);
    });

    it("deletes a note", () => {
      const notes = [
        createNote("inv1", "user1", "John", "general", "Note 1"),
        createNote("inv1", "user1", "John", "general", "Note 2"),
      ];
      
      const updated = deleteNote(notes, notes[0].id);
      
      expect(updated).toHaveLength(1);
      expect(updated[0].content).toBe("Note 2");
    });

    it("filters notes by type", () => {
      const notes = [
        createNote("inv1", "user1", "John", "general", "General note"),
        createNote("inv1", "user1", "John", "evidence", "Evidence note"),
        createNote("inv1", "user1", "John", "evidence", "Another evidence"),
      ];
      
      const evidenceNotes = getNotesByType(notes, "evidence");
      
      expect(evidenceNotes).toHaveLength(2);
      expect(evidenceNotes.every(n => n.type === "evidence")).toBe(true);
    });

    it("filters notes by target", () => {
      const notes = [
        createNote("inv1", "user1", "John", "evidence", "Note 1", "target1"),
        createNote("inv1", "user1", "John", "evidence", "Note 2", "target2"),
        createNote("inv1", "user1", "John", "evidence", "Note 3", "target1"),
      ];
      
      const targetNotes = getNotesByTarget(notes, "target1");
      
      expect(targetNotes).toHaveLength(2);
      expect(targetNotes.every(n => n.targetId === "target1")).toBe(true);
    });
  });

  describe("Tasks", () => {
    it("creates a task", () => {
      const task = createTask(
        "inv1",
        "user1",
        "John",
        "user2",
        "Jane",
        "Test task",
        "Task description",
        "medium",
        null
      );
      
      expect(task.investigationId).toBe("inv1");
      expect(task.assignedTo).toBe("user1");
      expect(task.assignedToName).toBe("John");
      expect(task.assignedBy).toBe("user2");
      expect(task.assignedByName).toBe("Jane");
      expect(task.title).toBe("Test task");
      expect(task.description).toBe("Task description");
      expect(task.priority).toBe("medium");
      expect(task.status).toBe("pending");
    });

    it("updates task status", () => {
      const task = createTask("inv1", "user1", "John", "user2", "Jane", "Task", "Desc", "medium", null);
      const updated = updateTaskStatus(task, "completed");
      
      expect(updated.status).toBe("completed");
      expect(updated.completedAt).toBeInstanceOf(Date);
    });

    it("reassigns task", () => {
      const task = createTask("inv1", "user1", "John", "user2", "Jane", "Task", "Desc", "medium", null);
      const reassigned = reassignTask(task, "user3", "Bob", "user2", "Jane");
      
      expect(reassigned.assignedTo).toBe("user3");
      expect(reassigned.assignedToName).toBe("Bob");
    });

    it("deletes a task", () => {
      const tasks = [
        createTask("inv1", "user1", "John", "user2", "Jane", "Task 1", "Desc", "medium", null),
        createTask("inv1", "user1", "John", "user2", "Jane", "Task 2", "Desc", "medium", null),
      ];
      
      const updated = deleteTask(tasks, tasks[0].id);
      
      expect(updated).toHaveLength(1);
      expect(updated[0].title).toBe("Task 2");
    });

    it("filters tasks by assignee", () => {
      const tasks = [
        createTask("inv1", "user1", "John", "user2", "Jane", "Task 1", "Desc", "medium", null),
        createTask("inv1", "user2", "Jane", "user1", "John", "Task 2", "Desc", "medium", null),
        createTask("inv1", "user1", "John", "user2", "Jane", "Task 3", "Desc", "medium", null),
      ];
      
      const user1Tasks = getTasksByAssignee(tasks, "user1");
      
      expect(user1Tasks).toHaveLength(2);
      expect(user1Tasks.every(t => t.assignedTo === "user1")).toBe(true);
    });

    it("filters tasks by status", () => {
      const tasks = [
        createTask("inv1", "user1", "John", "user2", "Jane", "Task 1", "Desc", "medium", null),
        createTask("inv1", "user1", "John", "user2", "Jane", "Task 2", "Desc", "medium", null),
      ];
      const updated = updateTaskStatus(tasks[0], "completed");
      
      const completedTasks = getTasksByStatus([updated, tasks[1]], "completed");
      
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].status).toBe("completed");
    });
  });

  describe("Review Requests", () => {
    it("creates a review request", () => {
      const review = createReviewRequest("inv1", "user1", "John", "user2", "Jane", "Please review");
      
      expect(review.investigationId).toBe("inv1");
      expect(review.requestedBy).toBe("user1");
      expect(review.requestedFrom).toBe("user2");
      expect(review.status).toBe("pending");
      expect(review.notes).toBe("Please review");
    });

    it("completes a review request", () => {
      const review = createReviewRequest("inv1", "user1", "John", "user2", "Jane", "Please review");
      const completed = completeReviewRequest(review, "approved", "Looks good");
      
      expect(completed.status).toBe("approved");
      expect(completed.reviewNotes).toBe("Looks good");
      expect(completed.reviewedAt).toBeInstanceOf(Date);
    });

    it("deletes a review request", () => {
      const reviews = [
        createReviewRequest("inv1", "user1", "John", "user2", "Jane", "Review 1"),
        createReviewRequest("inv1", "user1", "John", "user2", "Jane", "Review 2"),
      ];
      
      const updated = deleteReviewRequest(reviews, reviews[0].id);
      
      expect(updated).toHaveLength(1);
      expect(updated[0].notes).toBe("Review 2");
    });

    it("gets pending reviews for user", () => {
      const reviews = [
        createReviewRequest("inv1", "user1", "John", "user2", "Jane", "Review 1"),
        createReviewRequest("inv1", "user1", "John", "user3", "Bob", "Review 2"),
        createReviewRequest("inv1", "user1", "John", "user2", "Jane", "Review 3"),
      ];
      
      const pendingForUser2 = getPendingReviewsForUser(reviews, "user2");
      
      expect(pendingForUser2).toHaveLength(2);
      expect(pendingForUser2.every(r => r.requestedFrom === "user2")).toBe(true);
    });

    it("filters reviews by status", () => {
      const reviews = [
        createReviewRequest("inv1", "user1", "John", "user2", "Jane", "Review 1"),
        createReviewRequest("inv1", "user1", "John", "user3", "Bob", "Review 2"),
      ];
      const completed = completeReviewRequest(reviews[0], "approved", "Good");
      
      const approvedReviews = getReviewsByStatus([completed, reviews[1]], "approved");
      
      expect(approvedReviews).toHaveLength(1);
      expect(approvedReviews[0].status).toBe("approved");
    });
  });
});
