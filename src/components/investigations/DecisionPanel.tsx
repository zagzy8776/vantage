"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { DecisionResult } from "@/services/investigations/decision/types";

interface DecisionPanelProps {
  decision: DecisionResult;
}

const PRIORITY_COLORS = {
  CRITICAL: "text-danger",
  HIGH: "text-warning",
  MEDIUM: "text-info",
  LOW: "text-subtle",
};

const PRIORITY_BADGES = {
  CRITICAL: "bg-danger/10 text-danger border-danger/30",
  HIGH: "bg-warning/10 text-warning border-warning/30",
  MEDIUM: "bg-info/10 text-info border-info/30",
  LOW: "bg-subtle/10 text-subtle border-subtle/30",
};

export function DecisionPanel({ decision }: DecisionPanelProps) {
  const [showCalculation, setShowCalculation] = useState(false);

  return (
    <Card className="space-y-4">
      {/* Header with title and priority */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-subtle uppercase tracking-wide mb-1">
            OPPORTUNITY HYPOTHESIS
          </h3>
          <h2 className="text-lg font-bold">{decision.explanation.title}</h2>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${PRIORITY_BADGES[decision.priority]}`}>
          {decision.priority}
        </div>
      </div>

      {/* Why this matters */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Why this matters</h4>
        <p className="text-sm text-subtle leading-relaxed">
          {decision.explanation.why.join(". ")}.
        </p>
      </div>

      {/* What we know */}
      {decision.explanation.known.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">What we know</h4>
          <ul className="space-y-1">
            {decision.explanation.known.map((item, i) => (
              <li key={i} className="text-sm text-subtle flex items-start gap-2">
                <span className="text-success mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What we don't know */}
      {decision.explanation.unknown.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">What we don&apos;t know</h4>
          <ul className="space-y-1">
            {decision.explanation.unknown.map((item, i) => (
              <li key={i} className="text-sm text-subtle flex items-start gap-2">
                <span className="text-warning mt-0.5">?</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Best next step */}
      <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
        <h4 className="text-sm font-semibold mb-1">Best next step</h4>
        <p className="text-sm text-subtle">
          <span className="text-accent font-medium">→</span> {decision.explanation.nextAction.action}
        </p>
        <p className="text-xs text-subtle mt-1">
          Validation cost: <span className="font-medium">{decision.explanation.nextAction.cost}</span>
        </p>
      </div>

      {/* Expandable calculation breakdown */}
      <div className="border-t border-border pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCalculation(!showCalculation)}
          className="text-xs text-subtle hover:text-foreground"
        >
          {showCalculation ? "Hide" : "Show"} calculation
        </Button>

        {showCalculation && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-subtle">Evidence strength</span>
                <span className="font-mono">{decision.breakdown.evidenceStrength}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtle">Affected-business reach</span>
                <span className="font-mono">{decision.breakdown.affectedBusinessReach}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtle">Confidence</span>
                <span className="font-mono">{decision.breakdown.confidence}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtle">Validation ease</span>
                <span className="font-mono">{decision.breakdown.validationEase}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtle">Unknown penalty</span>
                <span className="font-mono text-danger">-{decision.breakdown.unknownPenalty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtle">Contradiction penalty</span>
                <span className="font-mono text-danger">-{decision.breakdown.contradictionPenalty}</span>
              </div>
            </div>
            <div className="border-t border-border pt-2">
              <div className="text-xs text-subtle mb-1">Calculation:</div>
              <code className="text-xs font-mono bg-surface-2 px-2 py-1 rounded block">
                {decision.breakdown.calculation}
              </code>
            </div>
            <div className="border-t border-border pt-2 flex justify-between items-center">
              <span className="text-sm font-semibold">Decision priority</span>
              <span className={`text-sm font-bold ${PRIORITY_COLORS[decision.priority]}`}>
                {decision.priority}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
