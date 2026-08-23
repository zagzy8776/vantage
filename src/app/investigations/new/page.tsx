"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InvestigationWizard } from "@/components/investigations/wizard";

function NewInvestigationInner() {
  const searchParams = useSearchParams();
  const investigationId = searchParams.get("id");
  const planId = searchParams.get("planId");

  return (
    <InvestigationWizard
      investigationId={investigationId ?? undefined}
      planId={planId ?? undefined}
      initialStep={investigationId ? "plan-review" : "objective"}
    />
  );
}

export default function NewInvestigationPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <Suspense fallback={<div className="h-96 animate-pulse bg-surface-2 rounded" />}>
        <NewInvestigationInner />
      </Suspense>
    </div>
  );
}
