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
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];
  const activeOptionId = `${listId}-option-${activeIndex}`;

  useEffect(() => {
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [options, value]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!open || options.length === 0) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        setActiveIndex((current) => {
          if (event.key === "ArrowDown") return (current + 1) % options.length;
          if (event.key === "ArrowUp") return (current - 1 + options.length) % options.length;
          return event.key === "Home" ? 0 : options.length - 1;
        });
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const option = options[activeIndex];
        if (option) {
          onChange(option.value);
          setOpen(false);
        }
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const query = `${typeaheadRef.current}${event.key}`.toLowerCase();
        typeaheadRef.current = query;
        if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
        typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = ""; }, 700);
        const start = (activeIndex + 1) % options.length;
        const ordered = [...options.slice(start), ...options.slice(0, start)];
        const match = ordered.find((option) => option.label.toLowerCase().startsWith(query));
        if (match) setActiveIndex(options.findIndex((option) => option.value === match.value));
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    };
  }, [activeIndex, onChange, open, options]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => {
          setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex h-12 w-full items-center justify-between rounded-xl border bg-black/20 px-3 text-left text-sm outline-none transition duration-150 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10 ${open ? "border-white/25 bg-white/[.045]" : "border-white/10 hover:border-white/15 hover:bg-white/[.025]"}`}
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
          aria-activedescendant={activeOptionId}
          className="vantage-select-menu absolute left-0 top-[calc(100%+8px)] z-50 max-h-72 w-full min-w-[180px] overflow-y-auto overscroll-contain rounded-xl border border-white/[.12] bg-[#111318]/[.98] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,.55)] backdrop-blur-xl"
        >
          {options.map((option, index) => {
            const active = option.value === value;
            const highlighted = index === activeIndex;
            return (
              <button
                key={option.value}
                id={`${listId}-option-${index}`}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onChange(option.value);
                  setActiveIndex(index);
                  setOpen(false);
                }}
                className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition duration-100 ${highlighted ? "bg-white/[.07] text-white" : "text-white/55 hover:bg-white/[.055] hover:text-white/90"} ${active ? "font-medium" : ""}`}
              >
                <span className="truncate">{option.label}</span>
                {active && <span className="ml-3 shrink-0 text-xs text-white/45">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
