"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { InvestigationMember, InvestigationNote, TaskAssignment, MemberRole } from "@/services/collaboration/types";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
  { value: "reviewer", label: "Reviewer" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

interface CollaborationPanelProps {
  _investigationId?: string;
  members: InvestigationMember[];
  notes: InvestigationNote[];
  tasks: TaskAssignment[];
  _currentUserId?: string;
  onAddMember: (email: string, role: MemberRole) => void;
  onCreateNote: (content: string, type: string) => void;
  onCreateTask: (title: string, description: string, assignee: string, priority: string) => void;
}

export function CollaborationPanel({
  _investigationId,
  members,
  notes,
  tasks,
  _currentUserId,
  onAddMember,
  onCreateNote,
  onCreateTask,
}: CollaborationPanelProps) {
  const [activeTab, setActiveTab] = useState<"members" | "notes" | "tasks">("members");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>("viewer");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteType, setNewNoteType] = useState("general");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");

  const handleAddMember = () => {
    if (newMemberEmail) {
      onAddMember(newMemberEmail, newMemberRole);
      setNewMemberEmail("");
      setNewMemberRole("viewer");
    }
  };

  const handleCreateNote = () => {
    if (newNoteContent) {
      onCreateNote(newNoteContent, newNoteType);
      setNewNoteContent("");
    }
  };

  const handleCreateTask = () => {
    if (newTaskTitle && newTaskAssignee) {
      onCreateTask(newTaskTitle, newTaskDescription, newTaskAssignee, newTaskPriority);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskAssignee("");
      setNewTaskPriority("medium");
    }
  };

  return (
    <Card className="space-y-6">
      <div>
        <h3 className="text-lg font-bold">Collaboration</h3>
        <p className="text-sm text-subtle mt-1">
          Manage team members, notes, and tasks for this investigation.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <Button
          variant={activeTab === "members" ? "primary" : "ghost"}
          onClick={() => setActiveTab("members")}
        >
          Members ({members.length})
        </Button>
        <Button
          variant={activeTab === "notes" ? "primary" : "ghost"}
          onClick={() => setActiveTab("notes")}
        >
          Notes ({notes.length})
        </Button>
        <Button
          variant={activeTab === "tasks" ? "primary" : "ghost"}
          onClick={() => setActiveTab("tasks")}
        >
          Tasks ({tasks.length})
        </Button>
      </div>

      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add member by email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
            />
            <Select
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value as MemberRole)}
              options={ROLE_OPTIONS}
            />
            <Button onClick={handleAddMember}>Add</Button>
          </div>

          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-surface-1 rounded-lg">
                <div>
                  <div className="font-medium">{member.userName}</div>
                  <div className="text-sm text-subtle">{member.userEmail}</div>
                </div>
                <span className="text-xs px-2 py-1 bg-surface-2 rounded">{member.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "notes" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Add a note..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
            />
            <div className="flex gap-2">
              <Select
                value={newNoteType}
                onChange={(e) => setNewNoteType(e.target.value)}
                options={[
                  { value: "general", label: "General" },
                  { value: "evidence", label: "Evidence" },
                  { value: "finding", label: "Finding" },
                  { value: "opportunity", label: "Opportunity" },
                ]}
              />
              <Button onClick={handleCreateNote}>Add Note</Button>
            </div>
          </div>

          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="p-3 bg-surface-1 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-subtle">{note.authorName}</span>
                  <span className="text-xs text-subtle">{new Date(note.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm">{note.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="space-y-2 p-4 bg-surface-1 rounded-lg">
            <Input
              placeholder="Task title"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <Select
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                options={members.map((m) => ({ value: m.userId, label: m.userName }))}
              />
              <Select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
                options={PRIORITY_OPTIONS}
              />
              <Button onClick={handleCreateTask}>Create Task</Button>
            </div>
          </div>

          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="p-3 bg-surface-1 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{task.title}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    task.priority === "urgent" ? "bg-danger/10 text-danger" :
                    task.priority === "high" ? "bg-warning/10 text-warning" :
                    "bg-surface-2 text-subtle"
                  }`}>
                    {task.priority}
                  </span>
                </div>
                {task.description && <p className="text-sm text-subtle mb-2">{task.description}</p>}
                <div className="flex items-center justify-between text-xs text-subtle">
                  <span>Assigned to: {task.assignedToName}</span>
                  <span className={`px-2 py-0.5 rounded ${
                    task.status === "completed" ? "bg-success/10 text-success" :
                    task.status === "in_progress" ? "bg-info/10 text-info" :
                    "bg-surface-2"
                  }`}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
