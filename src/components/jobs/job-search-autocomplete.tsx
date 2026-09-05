"use client";

import { useEffect, useRef, useState } from "react";

type JobSearchAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

type ApiResponse = {
  suggestions?: string[];
};

export function JobSearchAutocomplete({ value, onChange, onSubmit }: JobSearchAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/jobs/autocomplete?q=${encodeURIComponent(query)}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Autocomplete request failed");
        const data = (await response.json()) as ApiResponse;
        if (requestId !== requestRef.current) return;
        const next = Array.from(new Set((data.suggestions ?? []).filter(Boolean))).slice(0, 8);
        setSuggestions(next);
        setActiveIndex(0);
        setOpen(next.length > 0);
      } catch {
        if (requestId === requestRef.current) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function select(title: string) {
    onChange(title);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <div className={`flex h-12 items-center rounded-xl border bg-black/20 transition duration-150 ${open ? "border-white/25 bg-white/[.045]" : "border-white/10 hover:border-white/15"}`}>
        <svg aria-hidden="true" className="ml-3 h-4 w-4 shrink-0 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
        </svg>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setOpen(false); return; }
            if (!open || !suggestions.length) {
              if (event.key === "Enter") onSubmit();
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % suggestions.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              select(suggestions[activeIndex]);
            }
          }}
          placeholder="Job title, role, or skill"
          autoComplete="off"
          spellCheck={false}
          aria-label="Job title, role, or skill"
          aria-autocomplete="list"
          aria-expanded={open}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/25"
        />
        {loading && <span aria-hidden="true" className="mr-3 h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-white/15 border-t-white/55" />}
      </div>

      {open && suggestions.length > 0 && (
        <div role="listbox" aria-label="Job title suggestions" className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#101114] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,.55)]">
          <div className="px-3 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[.18em] text-white/25">Vantage job titles</div>
          {suggestions.map((title, index) => (
            <button
              key={title}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(title)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${index === activeIndex ? "bg-white/[.07]" : "hover:bg-white/[.045]"}`}
            >
              <span className="truncate text-sm text-white/80">{title}</span>
              {index === activeIndex && <span className="ml-3 shrink-0 text-[10px] text-white/25">Enter</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
