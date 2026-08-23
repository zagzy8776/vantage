"use client";

import React from "react";
import { InvestigationRoom } from "@/components/investigations/InvestigationRoom";

export default function InvestigationDetailPage({ params }: { params: { id: string } }) {
  return <InvestigationRoom id={params.id} />;
}