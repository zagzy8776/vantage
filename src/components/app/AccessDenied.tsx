import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export interface AccessDeniedProps {
  title?: string;
  description?: string;
}

/**
 * Reusable permission-denied state (HTTP 403).
 *
 * A 403 means the user IS authenticated but lacks permission - it must
 * never be converted into a login redirect.
 */
export function AccessDenied({
  title = "Permission denied",
  description = "Your account does not have access to this action. Ask a platform owner if you believe this is a mistake.",
}: AccessDeniedProps) {
  return (
    <div className="border border-danger/30 bg-danger/5 rounded-lg p-8 text-center flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-danger/15 border border-danger/40 text-danger flex items-center justify-center">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.5 0L3.16 16.25A2 2 0 005 19z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-foreground font-mono uppercase tracking-wide">{title}</h3>
      <p className="text-xs text-subtle max-w-sm">{description}</p>
      <Link href="/" className="mt-1">
        <Button variant="secondary" size="sm">Back to Overview</Button>
      </Link>
    </div>
  );
}
