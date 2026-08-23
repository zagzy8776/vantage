"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

const INVESTIGATION_TYPES = [
  { value: "problem", label: "Problem", description: "Understand whether an operational problem exists." },
  { value: "service_opportunity", label: "Service Opportunity", description: "Find businesses that may need a service or software solution." },
  { value: "industry", label: "Industry", description: "Investigate patterns across an industry." },
  { value: "market", label: "Market", description: "Explore market behavior and emerging opportunities." },
  { value: "company", label: "Company", description: "Investigate a specific business." },
  { value: "custom", label: "Custom", description: "Define a custom investigation objective." },
];

interface ObjectiveStepProps {
  onComplete: (investigationId: string) => void;
  onBack: () => void;
}

export function ObjectiveStep({ onComplete, onBack }: ObjectiveStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [investigationType, setInvestigationType] = useState("problem");
  const [problemCategory, setProblemCategory] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/investigations/standalone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          objective,
          investigationType,
          problemCategory: investigationType === "problem" ? problemCategory : undefined,
          serviceCategory: investigationType === "service_opportunity" ? "general" : undefined,
          geography: { country: "Canada" },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create investigation");
      }

      onComplete(data.investigationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create investigation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold font-mono text-foreground">New Investigation</h1>
        <p className="text-sm text-subtle mt-1">
          Turn a question into an evidence-backed investigation.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {error && (
            <div className="border border-danger/30 bg-danger/5 text-danger rounded px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground mb-2 block">
                What do you want to investigate?
              </span>
              <Textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Investigate appointment no-shows among beauty businesses in Toronto."
                required
                rows={4}
                className="text-base"
              />
            </label>

            <Input
              label="Investigation Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Toronto Appointment No-Show Investigation"
              required
            />

            <div>
              <span className="text-sm font-medium text-foreground mb-3 block">
                Investigation Type
              </span>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {INVESTIGATION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setInvestigationType(type.value)}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      investigationType === type.value
                        ? "border-accent bg-accent/5 shadow-sm"
                        : "border-border hover:border-border-strong bg-surface"
                    }`}
                  >
                    <div
                      className={`text-sm font-semibold mb-1 ${
                        investigationType === type.value ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {type.label}
                    </div>
                    <div className="text-xs text-subtle leading-relaxed">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {investigationType === "problem" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Problem Category <span className="text-danger">*</span>
                </label>
                <select
                  value={problemCategory}
                  onChange={(e) => setProblemCategory(e.target.value)}
                  required
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="">Select a problem category...</option>
                  <option value="appointment_no_shows">Appointment No-Shows</option>
                  <option value="booking_workflow">Booking Workflow</option>
                  <option value="customer_retention">Customer Retention</option>
                  <option value="online_presence">Online Presence</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <Button type="submit" isLoading={isSubmitting} disabled={!title || !objective || (investigationType === "problem" && !problemCategory)}>
              Create Investigation
            </Button>
            <Button type="button" variant="secondary" onClick={onBack} disabled={isSubmitting}>
              Back
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
