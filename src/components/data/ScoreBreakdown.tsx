import React from "react";
import { cn } from "../../lib/utils";
import { SCORE_TIER_META } from "../../lib/score";
import type { WebsiteIntelligenceMetrics } from "../../lib/types";

export interface ScoreBreakdownProps {
  metrics: WebsiteIntelligenceMetrics;
}

export function ScoreBreakdown({ metrics }: ScoreBreakdownProps) {
  const metricItems = [
    { label: "Performance", value: metrics.performance },
    { label: "Mobile", value: metrics.mobile },
    { label: "Accessibility", value: metrics.accessibility },
    { label: "SEO", value: metrics.seo },
    { label: "Security", value: metrics.security },
    { label: "Conversion", value: metrics.conversion },
    { label: "Booking", value: metrics.booking ?? "—" },
    { label: "E-commerce", value: metrics.ecommerce ?? "—" },
  ];

  return (
    <div className="space-y-2.5">
      {metricItems.map((item) => {
        const isNum = typeof item.value === "number";
        const numericValue = isNum ? item.value as number : 0;

        return (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-24 text-xs font-medium text-subtle">{item.label}</span>
            <div className="relative flex-1 h-5 bg-surface-2 rounded overflow-hidden">
              {isNum ? (
                <>
                  <div
                    className={cn(
                      "h-full rounded transition-all",
                      numericValue >= 90
                        ? "bg-success"
                        : numericValue >= 60
                        ? "bg-info"
                        : numericValue >= 30
                        ? "bg-warning"
                        : "bg-danger"
                    )}
                    style={{ width: `${numericValue}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[9px] font-mono text-subtle">
                    {numericValue}
                  </span>
                </>
              ) : (
                <span className="absolute inset-0 flex items-center px-2 text-[10px] text-subtle">{item.value}</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Score tier legend */}
      <div className="pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {(Object.keys(SCORE_TIER_META) as Array<keyof typeof SCORE_TIER_META>).map((tierKey) => {
          const meta = SCORE_TIER_META[tierKey];
          return (
            <div key={tierKey} className="flex items-center gap-1">
              <span className={cn("w-2.5 h-2.5 rounded", meta.bar)} />
              <span className="text-[9px] font-mono text-subtle">{meta.range}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
