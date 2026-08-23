"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import type { InvestigationReport, ExportFormat } from "@/services/collaboration/types";

const FORMAT_OPTIONS = [
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "pdf", label: "PDF" },
];

interface ReportPanelProps {
  _investigationId?: string;
  _investigationTitle?: string;
  reports: InvestigationReport[];
  onGenerateReport: () => void;
  onExportReport: (reportId: string, format: ExportFormat) => void;
}

export function ReportPanel({
  _investigationId,
  _investigationTitle,
  reports,
  onGenerateReport,
  onExportReport,
}: ReportPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("json");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const handleExport = () => {
    if (selectedReportId) {
      onExportReport(selectedReportId, selectedFormat);
    }
  };

  return (
    <Card className="space-y-6">
      <div>
        <h3 className="text-lg font-bold">Reports & Exports</h3>
        <p className="text-sm text-subtle mt-1">
          Generate investigation reports with evidence hierarchy preservation.
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={onGenerateReport}>Generate Report</Button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-8 text-subtle">
          No reports generated yet.
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Generated Reports</h4>
            <div className="space-y-2">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedReportId === report.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface-1 hover:bg-surface-2"
                  }`}
                  onClick={() => setSelectedReportId(report.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{report.title}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      report.status === "ready" ? "bg-success/10 text-success" :
                      report.status === "generating" ? "bg-info/10 text-info" :
                      "bg-surface-2"
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  <div className="text-xs text-subtle space-y-1">
                    <div>Generated: {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "Pending"}</div>
                    <div>Findings: {report.metadata.totalFindings} | Evidence: {report.metadata.totalEvidence} | Opportunities: {report.metadata.totalOpportunities}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedReportId && (
            <div className="border-t border-border pt-4">
              <h4 className="font-semibold mb-3">Export Report</h4>
              <div className="flex gap-3 items-center">
                <Select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                  options={FORMAT_OPTIONS}
                  label="Format"
                />
                <Button onClick={handleExport} disabled={!selectedReportId}>
                  Export
                </Button>
              </div>

              <div className="mt-4 p-4 bg-surface-1 rounded-lg">
                <h5 className="text-sm font-semibold mb-2">Report Summary</h5>
                <div className="text-sm space-y-1">
                  <div><strong>Executive Summary:</strong> {reports.find(r => r.id === selectedReportId)?.metadata.executiveSummary.substring(0, 150)}...</div>
                  <div><strong>Total Findings:</strong> {reports.find(r => r.id === selectedReportId)?.metadata.totalFindings}</div>
                  <div><strong>Total Evidence:</strong> {reports.find(r => r.id === selectedReportId)?.metadata.totalEvidence}</div>
                  <div><strong>Total Opportunities:</strong> {reports.find(r => r.id === selectedReportId)?.metadata.totalOpportunities}</div>
                  <div><strong>Total Unknowns:</strong> {reports.find(r => r.id === selectedReportId)?.metadata.totalUnknowns}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-info/5 border border-info/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2">Evidence Hierarchy Preservation</h4>
        <ul className="text-xs text-subtle space-y-1">
          <li>• Reports distinguish between <strong>facts</strong> (directly observed) and <strong>findings</strong> (derived)</li>
          <li>• Evidence is attributed with confidence levels and sources</li>
          <li>• Hypotheses are never presented as facts</li>
          <li>• Unknowns are explicitly listed</li>
          <li>• Export formats maintain this hierarchy</li>
        </ul>
      </div>
    </Card>
  );
}
