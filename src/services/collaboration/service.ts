/**
 * Milestone 12: Collaboration, Reports & Exports
 * 
 * Collaboration service for managing investigation members, notes, tasks, and reviews.
 */

import { newId } from "@/lib/ids";
import type {
  InvestigationMember,
  InvestigationNote,
  TaskAssignment,
  ReviewRequest,
  MemberRole,
  NoteType,
  AssignmentStatus,
  ReviewStatus,
} from "./types";

/**
 * Add a member to an investigation
 */
export function addMember(
  investigationId: string,
  userId: string,
  userName: string,
  userEmail: string,
  role: MemberRole
): InvestigationMember {
  return {
    id: newId(),
    investigationId,
    userId,
    userName,
    userEmail,
    role,
    joinedAt: new Date(),
  };
}

/**
 * Update member role
 */
export function updateMemberRole(member: InvestigationMember, newRole: MemberRole): InvestigationMember {
  return {
    ...member,
    role: newRole,
  };
}

/**
 * Remove a member from investigation
 */
export function removeMember(members: InvestigationMember[], memberId: string): InvestigationMember[] {
  return members.filter(m => m.id !== memberId);
}

/**
 * Check if member has permission
 */
export function hasPermission(member: InvestigationMember, action: "read" | "write" | "admin"): boolean {
  const rolePermissions: Record<MemberRole, string[]> = {
    owner: ["read", "write", "admin"],
    admin: ["read", "write", "admin"],
    editor: ["read", "write"],
    viewer: ["read"],
    reviewer: ["read"],
  };

  return rolePermissions[member.role].includes(action);
}

/**
 * Create a note
 */
export function createNote(
  investigationId: string,
  authorId: string,
  authorName: string,
  type: NoteType,
  content: string,
  targetId?: string
): InvestigationNote {
  return {
    id: newId(),
    investigationId,
    authorId,
    authorName,
    type,
    targetId,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Update a note
 */
export function updateNote(note: InvestigationNote, content: string): InvestigationNote {
  return {
    ...note,
    content,
    updatedAt: new Date(),
  };
}

/**
 * Delete a note
 */
export function deleteNote(notes: InvestigationNote[], noteId: string): InvestigationNote[] {
  return notes.filter(n => n.id !== noteId);
}

/**
 * Get notes by type
 */
export function getNotesByType(notes: InvestigationNote[], type: NoteType): InvestigationNote[] {
  return notes.filter(n => n.type === type);
}

/**
 * Get notes by target
 */
export function getNotesByTarget(notes: InvestigationNote[], targetId: string): InvestigationNote[] {
  return notes.filter(n => n.targetId === targetId);
}

/**
 * Create a task assignment
 */
export function createTask(
  investigationId: string,
  assignedTo: string,
  assignedToName: string,
  assignedBy: string,
  assignedByName: string,
  title: string,
  description: string,
  priority: "low" | "medium" | "high" | "urgent",
  dueDate: Date | null
): TaskAssignment {
  return {
    id: newId(),
    investigationId,
    assignedTo,
    assignedToName,
    assignedBy,
    assignedByName,
    title,
    description,
    status: "pending",
    priority,
    dueDate,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };
}

/**
 * Update task status
 */
export function updateTaskStatus(
  task: TaskAssignment,
  status: AssignmentStatus
): TaskAssignment {
  const completedAt = status === "completed" ? new Date() : task.completedAt;
  
  return {
    ...task,
    status,
    updatedAt: new Date(),
    completedAt,
  };
}

/**
 * Assign task to different user
 */
export function reassignTask(
  task: TaskAssignment,
  newAssignedTo: string,
  newAssignedToName: string,
  assignedBy: string,
  assignedByName: string
): TaskAssignment {
  return {
    ...task,
    assignedTo: newAssignedTo,
    assignedToName: newAssignedToName,
    assignedBy,
    assignedByName,
    updatedAt: new Date(),
  };
}

/**
 * Delete a task
 */
export function deleteTask(tasks: TaskAssignment[], taskId: string): TaskAssignment[] {
  return tasks.filter(t => t.id !== taskId);
}

/**
 * Get tasks by assignee
 */
export function getTasksByAssignee(tasks: TaskAssignment[], assigneeId: string): TaskAssignment[] {
  return tasks.filter(t => t.assignedTo === assigneeId);
}

/**
 * Get tasks by status
 */
export function getTasksByStatus(tasks: TaskAssignment[], status: AssignmentStatus): TaskAssignment[] {
  return tasks.filter(t => t.status === status);
}

/**
 * Create a review request
 */
export function createReviewRequest(
  investigationId: string,
  requestedBy: string,
  requestedByName: string,
  requestedFrom: string,
  requestedFromName: string,
  notes: string
): ReviewRequest {
  return {
    id: newId(),
    investigationId,
    requestedBy,
    requestedByName,
    requestedFrom,
    requestedFromName,
    status: "pending",
    notes,
    createdAt: new Date(),
    reviewedAt: null,
    reviewNotes: null,
  };
}

/**
 * Complete a review request
 */
export function completeReviewRequest(
  review: ReviewRequest,
  status: "approved" | "rejected" | "needs_changes",
  reviewNotes: string | null
): ReviewRequest {
  return {
    ...review,
    status,
    reviewNotes,
    reviewedAt: new Date(),
  };
}

/**
 * Delete a review request
 */
export function deleteReviewRequest(reviews: ReviewRequest[], reviewId: string): ReviewRequest[] {
  return reviews.filter(r => r.id !== reviewId);
}

/**
 * Get pending reviews for a user
 */
export function getPendingReviewsForUser(reviews: ReviewRequest[], userId: string): ReviewRequest[] {
  return reviews.filter(r => r.requestedFrom === userId && r.status === "pending");
}

/**
 * Get review requests by status
 */
export function getReviewsByStatus(reviews: ReviewRequest[], status: ReviewStatus): ReviewRequest[] {
  return reviews.filter(r => r.status === status);
}
