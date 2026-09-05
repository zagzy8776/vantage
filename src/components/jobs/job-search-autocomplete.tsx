"use client";

import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { title: string; sector: string };
type JobSearchAutocompleteProps = { value: string; onChange: (value: string) => void; onSubmit: () => void };
type ApiResponse = { suggestions?: Suggestion[] };

function highlight(title: string, query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return <>{title}</>;
  const index = title.toLowerCase().indexOf(normalizedQuery.toLowerCase());
  if (index < 0) return <>{title}</>;
  return <>{title.slice(0, index)}<span className="text-white">{title.slice(index, index + normalizedQuery.length)}</span>{title.slice(index + normalizedQuery.length)}</>;
}

export function JobSearchAutocomplete({ value, onChange, onSubmit }: JobSearchAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const listId = useId();

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) { setSuggestions([]); setOpen(false); return; }
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/jobs/autocomplete?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!response.ok) throw new Error("Autocomplete request failed");
        const data = (await response.json()) as ApiResponse;
        if (requestId !== requestRef.current) return;
        const next = (data.suggestions ?? []).filter((item) => item?.title).slice(0, 8);
        setSuggestions(next); setActiveIndex(0); setOpen(next.length > 0);
      } catch {
        if (requestId === requestRef.current) { setSuggestions([]); setOpen(false); }
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function select(suggestion: Suggestion) { onChange(suggestion.title); setOpen(false); }
  const sectors = [...new Set(suggestions.map((item) => item.sector))];
  const activeOptionId = open && suggestions[activeIndex] ? `${listId}-option-${activeIndex}` : undefined;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <div className={`flex h-12 items-center rounded-xl border bg-black/20 transition duration-150 ${open ? "border-white/25 bg-white/[.045]" : "border-white/10 hover:border-white/15"}`}>
        <svg aria-hidden="true" className="ml-3 h-4 w-4 shrink-0 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        <input value={value} onChange={(event) => onChange(event.target.value)} onFocus={() => { if (suggestions.length) setOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); return; } if (!open || !suggestions.length) { if (event.key === "Enter") onSubmit(); return; } if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => (index + 1) % suggestions.length); } else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length); } else if (event.key === "Home") { event.preventDefault(); setActiveIndex(0); } else if (event.key === "End") { event.preventDefault(); setActiveIndex(suggestions.length - 1); } else if (event.key === "Enter") { event.preventDefault(); select(suggestions[activeIndex]); } }} placeholder="Search jobs by title or role" autoComplete="off" spellCheck={false} aria-label="Search jobs by title or role" aria-autocomplete="list" aria-controls={open ? listId : undefined} aria-activedescendant={activeOptionId} aria-expanded={open} className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/25" />
        {loading && <span aria-hidden="true" className="mr-3 h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-white/15 border-t-white/55" />}
      </div>
      {open && suggestions.length > 0 && (
        <div id={listId} role="listbox" aria-label="Job title suggestions" className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#101114]/[.98] p-1.5 shadow-[0_28px_90px_rgba(0,0,0,.62)] backdrop-blur-xl">
          <div className="flex items-center justify-between px-3 pb-2 pt-2"><div><div className="text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Vantage opportunities</div><div className="mt-1 text-[11px] text-white/25">{suggestions.length} matches · {sectors.length} sectors represented</div></div><span className="rounded-full border border-white/10 px-2 py-1 text-[9px] text-white/25">Live catalog</span></div>
          <div className="space-y-0.5">{suggestions.map((suggestion, index) => <button key={`${suggestion.title}-${suggestion.sector}`} id={`${listId}-option-${index}`} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(suggestion)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${index === activeIndex ? "bg-white/[.075]" : "hover:bg-white/[.045]"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] ${index === activeIndex ? "border-white/15 bg-white/[.07] text-white/60" : "border-white/10 bg-white/[.025] text-white/30"}`}>↗</span><span className="min-w-0 flex-1"><span className="block truncate text-sm text-white/75">{highlight(suggestion.title, value)}</span><span className="mt-0.5 block truncate text-[10px] text-white/25">{suggestion.sector}</span></span>{index === activeIndex && <span className="ml-2 shrink-0 rounded-md border border-white/10 px-1.5 py-1 text-[9px] text-white/25">Enter</span>}</button>)}</div>
        </div>
      )}
    </div>
  );
}
