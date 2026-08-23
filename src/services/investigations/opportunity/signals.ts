import type { ProblemCategory, ProblemSignal, ProblemSignalDefinition } from "./types";

export const PROBLEM_SIGNAL_LIBRARY: Record<ProblemCategory, ProblemSignalDefinition[]> = {
  appointment_no_shows: [
    { id: "booking_link", label: "Booking link", categories: ["booking"], synonyms: ["book", "appointment", "reservation"], interpretation: "A public booking workflow is observable; no-show frequency remains unknown." },
    { id: "cancellation_policy", label: "Cancellation policy", categories: ["booking", "customer_signal"], synonyms: ["cancel", "cancellation", "no-show"], interpretation: "The business communicates appointment rules; policy effectiveness is unknown." },
    { id: "appointment_review", label: "Appointment-related review signal", categories: ["customer_signal"], synonyms: ["appointment", "wait", "missed"], interpretation: "A public customer signal references appointments; actual rate and financial impact are unknown." },
  ],
  missed_followups: [{ id: "contact_workflow", label: "Contact workflow", categories: ["contact"], synonyms: ["contact", "follow up", "call"], interpretation: "Public contact channels are observable; internal follow-up performance is unknown." }],
  order_management: [{ id: "ecommerce_signal", label: "Order/e-commerce signal", categories: ["ecommerce", "services"], synonyms: ["order", "online", "cart"], interpretation: "Public ordering capability is observable; operational leakage is unknown." }],
  inventory_discrepancy: [{ id: "product_catalog", label: "Product catalog signal", categories: ["products", "ecommerce"], synonyms: ["product", "inventory", "stock"], interpretation: "Public product information is observable; inventory accuracy is unknown." }],
  payment_collection: [{ id: "payment_contact", label: "Payment/contact signal", categories: ["contact", "pricing"], synonyms: ["payment", "price", "invoice"], interpretation: "Public pricing or contact information is observable; collection performance is unknown." }],
  invoice_followup: [{ id: "invoice_signal", label: "Invoice signal", categories: ["pricing", "contact"], synonyms: ["invoice", "billing", "payment"], interpretation: "Public billing-related language is observable; overdue invoice volume is unknown." }],
  manual_reconciliation: [{ id: "technology_signal", label: "Technology/workflow signal", categories: ["technology"], synonyms: ["software", "system", "manual"], interpretation: "Public technology signals are observable; reconciliation effort is unknown." }],
  customer_retention: [{ id: "customer_signal", label: "Customer signal", categories: ["customer_signal", "social_presence"], synonyms: ["customer", "review", "loyalty"], interpretation: "Public customer signals are observable; retention rate is unknown." }],
  delivery_failure: [{ id: "delivery_signal", label: "Delivery/order signal", categories: ["ecommerce", "customer_signal"], synonyms: ["delivery", "shipping", "late"], interpretation: "Public delivery signals are observable; failure rate is unknown." }],
  staff_visibility: [{ id: "staff_signal", label: "Staff/service signal", categories: ["services", "contact"], synonyms: ["staff", "team", "service"], interpretation: "Public staffing/service signals are observable; internal visibility is unknown." }],
  pricing_management: [{ id: "pricing_signal", label: "Pricing signal", categories: ["pricing"], synonyms: ["price", "pricing", "cost"], interpretation: "Public pricing evidence is observable; pricing management performance is unknown." }],
  supplier_management: [{ id: "supplier_signal", label: "Supplier signal", categories: ["products", "services"], synonyms: ["supplier", "vendor", "wholesale"], interpretation: "Public supplier-related signals may be observable; supplier performance is unknown." }],
  workflow_fragmentation: [{ id: "workflow_signal", label: "Workflow fragmentation signal", categories: ["technology", "contact", "services"], synonyms: ["workflow", "system", "manual"], interpretation: "Multiple public workflow signals may be present; internal fragmentation is unknown." }],
  reporting_visibility: [{ id: "reporting_signal", label: "Reporting signal", categories: ["technology", "customer_signal"], synonyms: ["report", "analytics", "dashboard"], interpretation: "Public reporting/analytics signals may be present; internal visibility is unknown." }],
};

export function classifyProblemSignals(category: ProblemCategory, evidence: Array<{ id: string; businessId: string; statement: string; category: string }>): ProblemSignal[] {
  return (PROBLEM_SIGNAL_LIBRARY[category] ?? []).map((definition) => {
    const matching = evidence.filter((item) => definition.categories.includes(item.category) || definition.synonyms.some((word) => item.statement.toLowerCase().includes(word)));
    return { id: definition.id, label: definition.label, state: matching.length ? "observed" : "unknown", businessIds: Array.from(new Set(matching.map((item) => item.businessId))), evidenceIds: matching.map((item) => item.id), summary: matching.length ? `${definition.label} was observed in the reviewed sample. ${definition.interpretation}` : `${definition.label} was not established by the supplied evidence; this is unknown, not proof of absence.` };
  });
}