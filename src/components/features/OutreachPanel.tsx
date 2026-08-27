"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Draft = {
  subject: string;
  body: string;
  toEmail: string | null;
  phone: string | null;
  businessName: string;
  source: "ai" | "template";
};

export interface OutreachPanelProps {
  leadId: string;
  initialPhone: string | null;
  initialEmail: string | null;
  initialStatus: string;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function OutreachPanel({ leadId, initialPhone, initialEmail, initialStatus }: OutreachPanelProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [phone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const flashCopied = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
  };

  const handleCopy = useCallback(async (key: string, value: string) => {
    try {
      await copyText(value);
      flashCopied(key);
    } catch {
      setError("Could not copy. Select the text and copy manually.");
    }
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/outreach`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Could not generate draft.");
      const next = payload.draft as Draft;
      setDraft(next);
      if (next.toEmail) setEmail(next.toEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate draft.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkContacted = async () => {
    setMarking(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/outreach`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_contacted" }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Could not update status.");
      setStatus("contacted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setMarking(false);
    }
  };

  const fullEmailText = draft
    ? `Subject: ${draft.subject}\n\n${draft.body}`
    : "";

  return (
    <Card title="Outreach" subtitle="AI writes the message. You copy it and send from your own email or phone.">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border border-border bg-surface-2/30 p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-subtle font-mono">Email</div>
            <div className="font-medium break-all">{email ?? "No public email found"}</div>
            {email && (
              <Button size="sm" variant="secondary" onClick={() => void handleCopy("email", email)}>
                {copied === "email" ? "Copied" : "Copy email"}
              </Button>
            )}
          </div>
          <div className="rounded-md border border-border bg-surface-2/30 p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-subtle font-mono">Phone</div>
            <div className="font-medium">{phone ?? "No phone on file"}</div>
            {phone && (
              <Button size="sm" variant="secondary" onClick={() => void handleCopy("phone", phone)}>
                {copied === "phone" ? "Copied" : "Copy number"}
              </Button>
            )}
          </div>
        </div>

        {!draft ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-subtle">
              Generate a short email you can paste into Gmail or Outlook. Vantage does not send it for you.
            </p>
            <Button variant="primary" onClick={() => void handleGenerate()} isLoading={loading}>
              {loading ? "Generating…" : "Generate outreach draft"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-[10px] uppercase tracking-wider text-subtle font-mono">
                Draft {draft.source === "ai" ? "· AI" : "· template"}
              </div>
              <Button size="sm" variant="secondary" onClick={() => void handleGenerate()} isLoading={loading}>
                Regenerate
              </Button>
            </div>
            <div className="rounded-md border border-border bg-surface/60 p-3 space-y-2">
              <div className="text-xs text-subtle">Subject</div>
              <div className="text-sm font-medium">{draft.subject}</div>
            </div>
            <div className="rounded-md border border-border bg-surface/60 p-3 space-y-2">
              <div className="text-xs text-subtle">Message</div>
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-6">{draft.body}</pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void handleCopy("message", fullEmailText)}>
                {copied === "message" ? "Copied" : "Copy full message"}
              </Button>
              <Button variant="secondary" onClick={() => void handleCopy("body", draft.body)}>
                {copied === "body" ? "Copied" : "Copy body only"}
              </Button>
              {status !== "contacted" && status !== "replied" && status !== "won" && (
                <Button variant="secondary" onClick={() => void handleMarkContacted()} isLoading={marking}>
                  {marking ? "Saving…" : "Mark as contacted"}
                </Button>
              )}
              {(status === "contacted" || status === "replied" || status === "won") && (
                <span className="text-xs text-success self-center font-mono uppercase">Status: {status}</span>
              )}
            </div>
            <p className="text-[11px] text-subtle">
              Paste into your email app, add your name/signature, and send. Use the phone number to call or text from your phone if there is no email.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Card>
  );
}
