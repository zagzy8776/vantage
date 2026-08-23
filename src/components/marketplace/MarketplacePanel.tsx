"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ResearchTask, TaskApplication } from "@/marketplace/types";

interface MarketplacePanelProps {
  _investigationId?: string;
  _investigationTitle?: string;
  tasks: ResearchTask[];
  applications: TaskApplication[];
  currentUserId: string;
  onPostTask: (title: string, description: string, requirements: string[], budget: number, deadline: Date | null) => void;
  _onApplyForTask?: (taskId: string, coverLetter: string, qualifications: string[], proposedTimeline: string) => void;
  onAssignTask: (taskId: string, applicationId: string) => void;
}

export function MarketplacePanel({
  _investigationId,
  _investigationTitle,
  tasks,
  applications,
  currentUserId,
  onPostTask,
  _onApplyForTask,
  onAssignTask,
}: MarketplacePanelProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "applications" | "my-tasks">("tasks");
  const [showPostTask, setShowPostTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskRequirements, setNewTaskRequirements] = useState("");
  const [newTaskBudget, setNewTaskBudget] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");

  const handlePostTask = () => {
    if (newTaskTitle && newTaskDescription && newTaskBudget) {
      const requirements = newTaskRequirements.split("\n").filter(r => r.trim());
      onPostTask(
        newTaskTitle,
        newTaskDescription,
        requirements,
        parseFloat(newTaskBudget),
        newTaskDeadline ? new Date(newTaskDeadline) : null
      );
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskRequirements("");
      setNewTaskBudget("");
      setNewTaskDeadline("");
      setShowPostTask(false);
    }
  };


  const handleAssign = (taskId: string, applicationId: string) => {
    onAssignTask(taskId, applicationId);
  };

  const myTasks = tasks.filter(t => t.assignedTo === currentUserId);

  return (
    <Card className="space-y-6">
      <div>
        <h3 className="text-lg font-bold">Researcher Marketplace</h3>
        <p className="text-sm text-subtle mt-1">
          Post research tasks, review applications, and manage researcher assignments.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <Button
          variant={activeTab === "tasks" ? "primary" : "ghost"}
          onClick={() => setActiveTab("tasks")}
        >
          Tasks ({tasks.length})
        </Button>
        <Button
          variant={activeTab === "applications" ? "primary" : "ghost"}
          onClick={() => setActiveTab("applications")}
        >
          Applications ({applications.length})
        </Button>
        <Button
          variant={activeTab === "my-tasks" ? "primary" : "ghost"}
          onClick={() => setActiveTab("my-tasks")}
        >
          My Tasks ({myTasks.length})
        </Button>
      </div>

      {activeTab === "tasks" && (
        <div className="space-y-4">
          <Button onClick={() => setShowPostTask(!showPostTask)}>
            {showPostTask ? "Cancel" : "Post New Task"}
          </Button>

          {showPostTask && (
            <div className="space-y-3 p-4 bg-surface-1 rounded-lg">
              <Input
                placeholder="Task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
              <textarea
                placeholder="Task description"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                className="w-full p-2 border rounded min-h-[100px]"
              />
              <textarea
                placeholder="Requirements (one per line)"
                value={newTaskRequirements}
                onChange={(e) => setNewTaskRequirements(e.target.value)}
                className="w-full p-2 border rounded min-h-[80px]"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Budget (USD)"
                  type="number"
                  value={newTaskBudget}
                  onChange={(e) => setNewTaskBudget(e.target.value)}
                />
                <Input
                  placeholder="Deadline (optional)"
                  type="date"
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                />
              </div>
              <Button onClick={handlePostTask}>Post Task</Button>
            </div>
          )}

          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="p-4 bg-surface-1 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{task.title}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    task.status === "open" ? "bg-success/10 text-success" :
                    task.status === "assigned" ? "bg-info/10 text-info" :
                    "bg-surface-2"
                  }`}>
                    {task.status}
                  </span>
                </div>
                <p className="text-sm text-subtle mb-2">{task.description}</p>
                <div className="flex items-center justify-between text-xs text-subtle">
                  <span>Budget: ${task.budget} {task.currency}</span>
                  {task.deadline && <span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>}
                </div>
                {task.assignedToName && (
                  <div className="text-xs text-subtle mt-1">
                    Assigned to: {task.assignedToName}
                  </div>
                )}
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                  >
                    View Applications ({getApplicationsForTask(applications, task.id).length})
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "applications" && (
        <div className="space-y-2">
          {applications.map((application) => (
            <div key={application.id} className="p-4 bg-surface-1 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{application.applicantName}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  application.status === "accepted" ? "bg-success/10 text-success" :
                  application.status === "rejected" ? "bg-danger/10 text-danger" :
                  "bg-surface-2"
                }`}>
                  {application.status}
                </span>
              </div>
              <p className="text-sm text-subtle mb-2">{application.coverLetter}</p>
              <div className="text-xs text-subtle">
                <div>Qualifications: {application.qualifications.join(", ")}</div>
                <div>Timeline: {application.proposedTimeline}</div>
              </div>
              {application.status === "pending" && (
                <div className="mt-2">
                  <Button
                    size="sm"
                    onClick={() => handleAssign(application.taskId, application.id)}
                  >
                    Assign Task
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "my-tasks" && (
        <div className="space-y-2">
          {myTasks.length === 0 ? (
            <div className="text-center py-8 text-subtle">
              No assigned tasks.
            </div>
          ) : (
            myTasks.map((task) => (
              <div key={task.id} className="p-4 bg-surface-1 rounded-lg">
                <div className="font-medium">{task.title}</div>
                <p className="text-sm text-subtle">{task.description}</p>
                <div className="text-xs text-subtle mt-2">
                  Budget: ${task.budget} {task.currency}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}

function getApplicationsForTask(applications: TaskApplication[], taskId: string): TaskApplication[] {
  return applications.filter(a => a.taskId === taskId);
}
