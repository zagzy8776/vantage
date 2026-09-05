"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type JobSearchAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

type ApiResponse = {
  suggestions?: string[];
};

function sectorForTitle(title: string) {
  const value = title.toLowerCase();
  const sectors: Array<[string, string[]]> = [
    ["Technology", ["software", "developer", "devops", "cloud", "data", "machine learning", "ai ", "cybersecurity", "security", "systems", "network", "database", "architect", "technical support", "it manager", "qa ", "test engineer"]],
    ["Finance", ["accountant", "accounting", "finance", "financial", "auditor", "bookkeeper", "controller", "tax ", "investment", "financial advisor"]],
    ["Business & Operations", ["administrative", "office ", "executive assistant", "operations", "project ", "program ", "business analyst", "management analyst", "strategy", "product "]],
    ["Marketing & Sales", ["marketing", "seo", "social media", "growth", "brand manager", "communications", "public relations", "sales", "business development", "account executive"]],
    ["Design & Media", ["designer", "creative", "art director", "animator", "illustrator", "photographer", "videographer", "video editor", "copywriter", "writer", "content", "editor"]],
    ["People & HR", ["human resources", "hr ", "recruiter", "talent acquisition", "people operations", "training", "learning and development", "payroll"]],
    ["Legal & Compliance", ["lawyer", "legal", "paralegal", "compliance", "risk manager", "risk analyst"]],
    ["Education", ["teacher", "teaching", "tutor", "lecturer", "professor", "instructional", "academic", "school administrator", "principal", "counselor"]],
    ["Healthcare", ["nurse", "medical", "pharmacist", "pharmacy", "laboratory", "lab technician", "radiologic", "physical therapist", "occupational therapist", "dental", "healthcare"]],
    ["Arts & Entertainment", ["dancer", "dance", "choreographer", "performing artist", "actor", "actress", "singer", "musician", "music teacher", "theater", "stage manager"]],
    ["Hospitality & Events", ["chef", "sous chef", "cook", "baker", "pastry", "restaurant", "bartender", "server", "waiter", "waitress", "barista", "catering", "hotel", "front desk", "housekeeper", "event "]],
    ["Retail & Supply Chain", ["retail", "store manager", "merchandiser", "warehouse", "inventory", "logistics", "supply chain", "procurement", "purchasing"]],
    ["Construction & Trades", ["construction", "electrician", "plumber", "carpenter", "welder", "mechanic", "automotive", "maintenance", "site engineer", "surveyor"]],
    ["Engineering", ["civil engineer", "mechanical engineer", "electrical engineer", "chemical engineer", "industrial engineer", "project engineer"]],
    ["Real Estate & Insurance", ["real estate", "property manager", "leasing", "insurance", "mortgage", "loan officer", "bank teller"]],
    ["Community & Public Service", ["security", "social worker", "community manager", "nonprofit"]],
  ];
  return sectors.find(([, terms]) => terms.some((term) => value.includes(term)))?.[0] ?? "Career opportunity";
}

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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const sectorCounts = useMemo(() => new Set(suggestions.map(sectorForTitle)).size, [suggestions]);

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
        const response = await fetch(`/api/jobs/autocomplete?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!response.ok) throw new Error("Autocomplete request failed");
        const data = (await response.json()) as ApiResponse;
        if (requestId !== requestRef.current) return;
        const next = Array.from(new Set((data.suggestions ?? []).filter(Boolean))).slice(0, 8);
        setSuggestions(next);
        setActiveIndex(0);
        setOpen(next.length > 0);
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

  function select(title: string) { onChange(title); setOpen(false); }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <div className={`flex h-12 items-center rounded-xl border bg-black/20 transition duration-150 ${open ? "border-white/25 bg-white/[.045]" : "border-white/10 hover:border-white/15"}`}>
        <svg aria-hidden="true" className="ml-3 h-4 w-4 shrink-0 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setOpen(false); return; }
            if (!open || !suggestions.length) { if (event.key === "Enter") onSubmit(); return; }
            if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => (index + 1) % suggestions.length); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length); }
            else if (event.key === "Enter") { event.preventDefault(); select(suggestions[activeIndex]); }
          }}
          placeholder="Search jobs by title or role"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search jobs by title or role"
          aria-autocomplete="list"
          aria-expanded={open}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/25"
        />
        {loading && <span aria-hidden="true" className="mr-3 h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-white/15 border-t-white/55" />}
      </div>

      {open && suggestions.length > 0 && (
        <div role="listbox" aria-label="Job title suggestions" className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#101114]/[.98] p-1.5 shadow-[0_28px_90px_rgba(0,0,0,.62)] backdrop-blur-xl">
          <div className="flex items-center justify-between px-3 pb-2 pt-2">
            <div><div className="text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Vantage opportunities</div><div className="mt-1 text-[11px] text-white/25">{suggestions.length} matches · {sectorCounts} sectors represented</div></div>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] text-white/25">Live catalog</span>
          </div>
          <div className="space-y-0.5">
            {suggestions.map((title, index) => (
              <button key={title} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(title)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${index === activeIndex ? "bg-white/[.075]" : "hover:bg-white/[.045]"}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] ${index === activeIndex ? "border-white/15 bg-white/[.07] text-white/60" : "border-white/10 bg-white/[.025] text-white/30"}`}>↗</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm text-white/75">{highlight(title, value)}</span><span className="mt-0.5 block truncate text-[10px] text-white/25">{sectorForTitle(title)}</span></span>
                {index === activeIndex && <span className="ml-2 shrink-0 rounded-md border border-white/10 px-1.5 py-1 text-[9px] text-white/25">Enter</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
