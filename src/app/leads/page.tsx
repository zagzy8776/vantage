"use client";

import { LeadTable } from "@/components/data/LeadTable";
import { MOCK_LEADS } from "@/data/mockData";

export default function LeadsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold font-mono">Leads</h1>
        <p className="text-sm text-subtle">Tracked leads with score tiers, website health and pipeline state.</p>
      </div>
      <LeadTable leads={MOCK_LEADS} showPipelineFilter />
    </div>
  );
}