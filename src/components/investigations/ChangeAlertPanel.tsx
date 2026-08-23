"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { EvidenceDiff, ChangeSignificance } from "@/services/investigations/monitoring/types";

const SIGNIFICANCE_BADGES = {
  low: "bg-subtle/10 text-subtle border-subtle/30",
  medium: "bg-info/10 text-info border-info/30",
  high: "bg-warning/10 text-warning border-warning/30",
  critical: "bg-danger/10 text-danger border-danger/30",
};

interface ChangeAlertPanelProps {
  changes: Array<{
    changeType: string;
    significance: ChangeSignificance;
    description: string;
    businessId: string;
    businessName: string;
    evidenceDiffs: EvidenceDiff[];
  }>;
  onApprove: (changeId: string) => void;
  onReject: (changeId: string) => void;
  onInvestigate: (changeId: string) => void;
}

export function ChangeAlertPanel({ changes, onApprove, onReject, onInvestigate }: ChangeAlertPanelProps) {
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());

  const toggleExpand = (changeId: string) => {
    const newExpanded = new Set(expandedChanges);
    if (newExpanded.has(changeId)) {
      newExpanded.delete(changeId);
    } else {
      newExpanded.add(changeId);
    }
    setExpandedChanges(newExpanded);
  };

  if (changes.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-subtle">No significant changes detected.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-lg font-bold">Change Alerts</h3>
        <p className="text-sm text-subtle mt-1">
          {changes.length} significant change{changes.length !== 1 ? "s" : ""} detected requiring review.
        </p>
      </div>

      <div className="space-y-3">
        {changes.map((change, index) => {
          const changeId = `change_${index}`;
          const isExpanded = expandedChanges.has(changeId);

          return (
            <div key={changeId} className="border border-border rounded-lg overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-surface-2 transition-colors"
                onClick={() => toggleExpand(changeId)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${SIGNIFICANCE_BADGES[change.significance]}`}>
                        {change.significance.toUpperCase()}
                      </span>
                      <span className="text-xs text-subtle uppercase">
                        {change.changeType}
                      </span>
                    </div>
                    <h4 className="font-semibold">{change.businessName}</h4>
                    <p className="text-sm text-subtle mt-1">{change.description}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    {isExpanded ? "Collapse" : "Expand"}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-4 bg-surface-1">
                  <div className="space-y-2 mb-4">
                    <h5 className="text-sm font-semibold">Evidence Changes</h5>
                    {change.evidenceDiffs.map((diff, diffIndex) => (
                      <div key={diffIndex} className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-subtle">{diff.changeType}:</span>
                          <span className="font-medium">{diff.after.statement || diff.before.statement}</span>
                        </div>
                        {diff.before.sourceUrl && (
                          <div className="text-xs text-subtle pl-4">
                            Source: {diff.before.sourceUrl}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <Button size="sm" onClick={() => onApprove(changeId)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onInvestigate(changeId)}>
                      Investigate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onReject(changeId)}>
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-info/5 border border-info/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2">Review Guidelines</h4>
        <ul className="text-xs text-subtle space-y-1">
          <li>• <strong>Approve</strong> if the change is valid and should update findings</li>
          <li>• <strong>Investigate</strong> if you need more information before deciding</li>
          <li>• <strong>Reject</strong> if the change is a false positive or not relevant</li>
        </ul>
      </div>
    </Card>
  );
}
