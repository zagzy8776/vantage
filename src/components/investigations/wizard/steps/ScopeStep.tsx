"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";

interface ScopeStepProps {
  investigationId: string;
  onNext: () => void;
  onBack: () => void;
}

export function ScopeStep({ investigationId, onNext, onBack }: ScopeStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [problemCategory, setProblemCategory] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [additionalCriteria, setAdditionalCriteria] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        industry: industry || undefined,
        geography: {
          country,
          region: region || undefined,
          city: city || undefined,
        },
        researchQuestion: researchQuestion || undefined,
        criteria: additionalCriteria ? { additional: additionalCriteria } : undefined,
      };

      if (problemCategory) {
        payload.problemCategory = problemCategory;
      }
      if (serviceCategory) {
        payload.serviceCategory = serviceCategory;
      }

      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update investigation");
      }

      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update investigation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold font-mono text-foreground">Define the scope</h1>
        <p className="text-sm text-subtle mt-1">
          Tell VANTAGE where and what to investigate.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {error && (
            <div className="border border-danger/30 bg-danger/5 text-danger rounded px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g., Beauty, Restaurants, Healthcare"
            />
            <Input
              label="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g., Canada"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Region (optional)"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g., Ontario"
            />
            <Input
              label="City (optional)"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g., Toronto"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Problem Category"
              value={problemCategory}
              onChange={(e) => setProblemCategory(e.target.value)}
              options={[
                { value: "", label: "Select category..." },
                { value: "appointment_no_shows", label: "Appointment No-Shows" },
                { value: "booking_workflow", label: "Booking Workflow" },
                { value: "customer_retention", label: "Customer Retention" },
                { value: "online_presence", label: "Online Presence" },
              ]}
            />
            <Input
              label="Service Category"
              value={serviceCategory}
              onChange={(e) => setServiceCategory(e.target.value)}
              placeholder="e.g., booking, scheduling, delivery"
            />
          </div>

          <Textarea
            label="Research Question"
            value={researchQuestion}
            onChange={(e) => setResearchQuestion(e.target.value)}
            placeholder="What specific question do you want to answer?"
            rows={3}
          />

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground transition-colors list-none flex items-center gap-2">
              <svg
                className="w-4 h-4 transition-transform group-open:rotate-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Additional Criteria (optional)
            </summary>
            <div className="mt-3">
              <Textarea
                value={additionalCriteria}
                onChange={(e) => setAdditionalCriteria(e.target.value)}
                placeholder="Add any additional criteria or constraints..."
                rows={3}
              />
            </div>
          </details>

          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <Button type="submit" isLoading={isSubmitting} disabled={!country}>
              Generate Research Plan
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
