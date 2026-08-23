"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ObjectiveStep } from "./steps/ObjectiveStep";
import { ScopeStep } from "./steps/ScopeStep";
import { PlanReviewStep } from "./steps/PlanReviewStep";
import { PlanEditStep } from "./steps/PlanEditStep";
import { ApproveStep } from "./steps/ApproveStep";
import { ExecutionStep } from "./steps/ExecutionStep";
import { FindingsStep } from "./steps/FindingsStep";
import { CompleteStep } from "./steps/CompleteStep";

export type WizardStep = {
  id: string;
  label: string;
  shortLabel: string;
};

export const WIZARD_STEPS: WizardStep[] = [
  { id: "objective", label: "Objective", shortLabel: "Obj" },
  { id: "scope", label: "Scope", shortLabel: "Scope" },
  { id: "plan-review", label: "Plan Review", shortLabel: "Plan" },
  { id: "plan-edit", label: "Edit Plan", shortLabel: "Edit" },
  { id: "approve", label: "Approve & Run", shortLabel: "Approve" },
  { id: "execution", label: "Execute", shortLabel: "Run" },
  { id: "findings", label: "Findings", shortLabel: "Find" },
  { id: "complete", label: "Complete", shortLabel: "Done" },
];

export interface InvestigationWizardProps {
  investigationId?: string;
  planId?: string;
  initialStep?: string;
}

export function InvestigationWizard({ investigationId, planId, initialStep = "objective" }: InvestigationWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentIndex = useMemo(
    () => WIZARD_STEPS.findIndex((s) => s.id === currentStep),
    [currentStep]
  );

  const goToStep = useCallback(
    (stepId: string, dir: "forward" | "backward" = "forward") => {
      setDirection(dir);
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(stepId);
        setIsTransitioning(false);
      }, 150);
    },
    []
  );

  const goNext = useCallback(() => {
    if (currentIndex < WIZARD_STEPS.length - 1) {
      goToStep(WIZARD_STEPS[currentIndex + 1].id, "forward");
    }
  }, [currentIndex, goToStep]);

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      goToStep(WIZARD_STEPS[currentIndex - 1].id, "backward");
    }
  }, [currentIndex, goToStep]);

  const renderStep = () => {
    switch (currentStep) {
      case "objective":
        return (
          <ObjectiveStep
            onComplete={(id) => {
              router.push(`/investigations/${id}/scope`);
            }}
            onBack={() => router.push("/investigations")}
          />
        );
      case "scope":
        return (
          <ScopeStep
            investigationId={investigationId!}
            onNext={goNext}
            onBack={goBack}
          />
        );
      case "plan-review":
        return (
          <PlanReviewStep
            investigationId={investigationId!}
            planId={planId!}
            onNext={goNext}
            onBack={goBack}
            onEdit={() => goToStep("plan-edit", "forward")}
          />
        );
      case "plan-edit":
        return (
          <PlanEditStep
            investigationId={investigationId!}
            planId={planId!}
            onNext={goNext}
            onBack={goBack}
          />
        );
      case "approve":
        return (
          <ApproveStep
            investigationId={investigationId!}
            planId={planId!}
            onNext={goNext}
            onBack={goBack}
          />
        );
      case "execution":
        return (
          <ExecutionStep
            investigationId={investigationId!}
            planId={planId!}
            onNext={goNext}
            onBack={goBack}
          />
        );
      case "findings":
        return (
          <FindingsStep
            investigationId={investigationId!}
            onNext={goNext}
            onBack={goBack}
          />
        );
      case "complete":
        return (
          <CompleteStep
            investigationId={investigationId!}
            onNext={() => router.push(`/investigations/${investigationId}`)}
            onBack={goBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-surface border border-border rounded-lg p-4 shadow-card">
        <div className="flex items-center justify-between">
          {WIZARD_STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentIndex;
            const isPending = index > currentIndex;

            return (
              <React.Fragment key={step.id}>
                {index > 0 && (
                  <div
                    className={`h-px flex-1 mx-2 ${
                      isCompleted ? "bg-accent" : "bg-border"
                    }`}
                  />
                )}
                <button
                  onClick={() => {
                    if (isCompleted || isActive) {
                      goToStep(step.id, "forward");
                    }
                  }}
                  disabled={isPending}
                  className={`flex flex-col items-center gap-1.5 min-w-[60px] transition-all ${
                    isPending ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                      isActive
                        ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20"
                        : isCompleted
                        ? "bg-success/20 text-success border border-success/40"
                        : "bg-surface-2 text-subtle border border-border"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wide whitespace-nowrap ${
                      isActive
                        ? "text-accent font-semibold"
                        : isCompleted
                        ? "text-success"
                        : "text-subtle"
                    }`}
                  >
                    {step.shortLabel}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div
        className={`transition-all duration-150 ${
          isTransitioning
            ? direction === "forward"
              ? "opacity-0 translate-x-2"
              : "opacity-0 -translate-x-2"
            : "opacity-100 translate-x-0"
        }`}
      >
        {renderStep()}
      </div>
    </div>
  );
}
