"use client";

import { useEffect, useId, useRef, useState } from "react";

type Option = { value: string; label: string };

type VantageSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  ariaLabel: string;
  className?: string;
};

export function VantageSelect({ value, onChange, options, ariaLabel, className = "" }: VantageSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex h-12 w-full items-center justify-between rounded-xl border bg-black/20 px-3 text-left text-sm outline-none transition duration-150 ${open ? "border-white/25 bg-white/[.045]" : "border-white/10 hover:border-white/15 hover:bg-white/[.025]"}`}
      >
        <span className="truncate text-white/80">{selected?.label}</span>
        <svg className={`ml-2 h-4 w-4 shrink-0 text-white/35 transition-transform duration-150 ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="vantage-select-menu absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-xl border border-white/[.12] bg-[#111318]/[.98] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,.55)] backdrop-blur-xl"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition duration-100 ${active ? "bg-white/[.08] text-white" : "text-white/55 hover:bg-white/[.055] hover:text-white/90"}`}
              >
                <span>{option.label}</span>
                {active && <span className="text-xs text-white/45">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
