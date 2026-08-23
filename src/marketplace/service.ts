/**
 * Milestone 13: Researcher Marketplace
 * 
 * Marketplace service - clearly separated from core investigation architecture.
 */

import { newId } from "@/lib/ids";
import type {
  ResearchTask,
  TaskApplication,
  EvidenceSubmission,
  Payment,
  TaskStatus,
  SubmissionStatus,
  PaymentStatus,
} from "./types";

/**
 * Post a new research task
 */
export function postTask(
  investigationId: string,
  investigationTitle: string,
  postedBy: string,
  postedByName: string,
  title: string,
  description: string,
  requirements: string[],
  budget: number,
  currency: string,
  deadline: Date | null
): ResearchTask {
  return {
    id: newId(),
    investigationId,
    investigationTitle,
    postedBy,
    postedByName,
    title,
    description,
    requirements,
    budget,
    currency,
    status: "open",
    deadline,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedTo: null,
    assignedToName: null,
    assignedAt: null,
  };
}

/**
 * Update task status
 */
export function updateTaskStatus(task: ResearchTask, status: TaskStatus): ResearchTask {
  return {
    ...task,
    status,
    updatedAt: new Date(),
  };
}

/**
 * Assign task to researcher
 */
export function assignTask(
  task: ResearchTask,
  assignedTo: string,
  assignedToName: string
): ResearchTask {
  return {
    ...task,
    status: "assigned",
    assignedTo,
    assignedToName,
    assignedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Apply for a task
 */
export function applyForTask(
  taskId: string,
  applicantId: string,
  applicantName: string,
  applicantEmail: string,
  coverLetter: string,
  qualifications: string[],
  proposedTimeline: string
): TaskApplication {
  return {
    id: newId(),
    taskId,
    applicantId,
    applicantName,
    applicantEmail,
    coverLetter,
    qualifications,
    proposedTimeline,
    status: "pending",
    appliedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: null,
  };
}

/**
 * Accept application
 */
export function acceptApplication(
  application: TaskApplication,
  reviewedBy: string,
  reviewNotes: string | null
): TaskApplication {
  return {
    ...application,
    status: "accepted",
    reviewedAt: new Date(),
    reviewedBy,
    reviewNotes,
  };
}

/**
 * Reject application
 */
export function rejectApplication(
  application: TaskApplication,
  reviewedBy: string,
  reviewNotes: string | null
): TaskApplication {
  return {
    ...application,
    status: "rejected",
    reviewedAt: new Date(),
    reviewedBy,
    reviewNotes,
  };
}

/**
 * Submit evidence for a task
 */
export function submitEvidence(
  taskId: string,
  submittedBy: string,
  submittedByName: string,
  evidence: Array<{
    statement: string;
    category: string;
    sourceUrl: string;
    businessId?: string;
    businessName?: string;
    confidence: number;
  }>,
  sources: Array<{
    url: string;
    title: string;
    type: "website" | "document" | "interview" | "observation" | "other";
  }>,
  observations: string[],
  unknowns: string[],
  notes: string
): EvidenceSubmission {
  return {
    id: newId(),
    taskId,
    submittedBy,
    submittedByName,
    status: "pending",
    evidence: evidence.map(e => ({ ...e, id: newId() })),
    sources: sources.map(s => ({ ...s, id: newId(), accessedAt: new Date() })),
    observations,
    unknowns,
    notes,
    submittedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: null,
  };
}

/**
 * Update submission status
 */
export function updateSubmissionStatus(
  submission: EvidenceSubmission,
  status: SubmissionStatus,
  reviewedBy: string,
  reviewNotes: string | null
): EvidenceSubmission {
  return {
    ...submission,
    status,
    reviewedAt: new Date(),
    reviewedBy,
    reviewNotes,
  };
}

/**
 * Create payment record
 */
export function createPayment(
  taskId: string,
  submissionId: string,
  paidTo: string,
  paidToName: string,
  paidBy: string,
  amount: number,
  currency: string
): Payment {
  return {
    id: newId(),
    taskId,
    submissionId,
    paidTo,
    paidToName,
    paidBy,
    amount,
    currency,
    status: "pending",
    createdAt: new Date(),
    processedAt: null,
    transactionId: null,
  };
}

/**
 * Update payment status
 */
export function updatePaymentStatus(
  payment: Payment,
  status: PaymentStatus,
  transactionId: string | null
): Payment {
  return {
    ...payment,
    status,
    processedAt: status === "paid" ? new Date() : payment.processedAt,
    transactionId,
  };
}

/**
 * Get tasks by status
 */
export function getTasksByStatus(tasks: ResearchTask[], status: TaskStatus): ResearchTask[] {
  return tasks.filter(t => t.status === status);
}

/**
 * Get applications for a task
 */
export function getApplicationsForTask(applications: TaskApplication[], taskId: string): TaskApplication[] {
  return applications.filter(a => a.taskId === taskId);
}

/**
 * Get submissions for a task
 */
export function getSubmissionsForTask(submissions: EvidenceSubmission[], taskId: string): EvidenceSubmission[] {
  return submissions.filter(s => s.taskId === taskId);
}

/**
 * Get payments for a task
 */
export function getPaymentsForTask(payments: Payment[], taskId: string): Payment[] {
  return payments.filter(p => p.taskId === taskId);
}
