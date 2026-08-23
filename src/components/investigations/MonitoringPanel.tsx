"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { MonitoringConfig, MonitoringFrequency, ChangeSignificance } from "@/services/investigations/monitoring/types";

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const ALERT_THRESHOLD_OPTIONS = [
  { value: "low", label: "Low (all changes)" },
  { value: "medium", label: "Medium (medium+)" },
  { value: "high", label: "High (high+)" },
  { value: "critical", label: "Critical only" },
];

interface MonitoringPanelProps {
  investigationId: string;
  existingConfig?: MonitoringConfig;
  onSave: (config: MonitoringConfig) => void;
  onCancel?: () => void;
}

export function MonitoringPanel({ investigationId, existingConfig, onSave, onCancel }: MonitoringPanelProps) {
  const [frequency, setFrequency] = useState<MonitoringFrequency>(existingConfig?.frequency || "weekly");
  const [maxSearchRuns, setMaxSearchRuns] = useState(existingConfig?.budget?.maxSearchRuns || 5);
  const [maxEvidenceItems, setMaxEvidenceItems] = useState(existingConfig?.budget?.maxEvidenceItems || 100);
  const [alertThreshold, setAlertThreshold] = useState<ChangeSignificance>(existingConfig?.alertThreshold || "medium");

  const handleSave = () => {
    const config: MonitoringConfig = {
      investigationId,
      frequency,
      scope: existingConfig?.scope || {
        businessIds: [],
      },
      signals: existingConfig?.signals || ["booking", "cancellation", "appointment", "scheduling"],
      budget: {
        maxSearchRuns,
        maxEvidenceItems,
      },
      alertThreshold,
    };
    onSave(config);
  };

  return (
    <Card className="space-y-6">
      <div>
        <h3 className="text-lg font-bold">Monitoring Configuration</h3>
        <p className="text-sm text-subtle mt-1">
          Configure how VANTAGE monitors this investigation for changes.
        </p>
      </div>

      <div className="space-y-4">
        <Select
          label="Monitoring Frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as MonitoringFrequency)}
          options={FREQUENCY_OPTIONS}
          hint="How often to check for changes"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Max Search Runs"
            type="number"
            value={maxSearchRuns.toString()}
            onChange={(e) => setMaxSearchRuns(parseInt(e.target.value) || 5)}
            min="1"
            hint="Per monitoring cycle"
          />
          <Input
            label="Max Evidence Items"
            type="number"
            value={maxEvidenceItems.toString()}
            onChange={(e) => setMaxEvidenceItems(parseInt(e.target.value) || 100)}
            min="1"
            hint="Per monitoring cycle"
          />
        </div>

        <Select
          label="Alert Threshold"
          value={alertThreshold}
          onChange={(e) => setAlertThreshold(e.target.value as ChangeSignificance)}
          options={ALERT_THRESHOLD_OPTIONS}
          hint="Minimum significance to trigger alert"
        />
      </div>

      <div className="bg-info/5 border border-info/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2">How Monitoring Works</h4>
        <ul className="text-xs text-subtle space-y-1">
          <li>• VANTAGE periodically checks monitored businesses for changes</li>
          <li>• New evidence, removed evidence, and changes are detected</li>
          <li>• Changes are evaluated for significance using the decision layer</li>
          <li>• Significant changes trigger alerts for your review</li>
          <li>• You approve changes before findings are updated</li>
        </ul>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button onClick={handleSave}>Save Configuration</Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
