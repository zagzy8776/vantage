"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Suggestion = {
  label: string;
  hint: string;
  aliases: string[];
};

type JobSearchAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

const suggestions: Suggestion[] = [
  { label: "Full Stack Developer", hint: "Web · JavaScript · APIs", aliases: ["full stack", "fullstack", "full stack developer"] },
  { label: "Full Stack Engineer", hint: "React · Node.js · TypeScript", aliases: ["full stack engineer", "fullstack engineer"] },
  { label: "Frontend Developer", hint: "React · Next.js · UI", aliases: ["frontend", "front end", "frontend developer"] },
  { label: "Backend Developer", hint: "APIs · Node.js · Python", aliases: ["backend", "back end", "backend developer"] },
  { label: "Software Engineer", hint: "Software development", aliases: ["software", "software engineer"] },
  { label: "React Developer", hint: "React · JavaScript · TypeScript", aliases: ["react", "react developer"] },
  { label: "Next.js Developer", hint: "Next.js · React · TypeScript", aliases: ["next", "nextjs", "next.js"] },
  { label: "Python Developer", hint: "Python · APIs · Backend", aliases: ["python", "python developer"] },
  { label: "DevOps Engineer", hint: "Cloud · CI/CD · Infrastructure", aliases: ["devops", "dev ops"] },
  { label: "Data Engineer", hint: "Data · SQL · Pipelines", aliases: ["data engineer", "data"] },
  { label: "Machine Learning Engineer", hint: "ML · Python · Models", aliases: ["machine learning", "ml engineer", "ml"] },
  { label: "QA Engineer", hint: "Testing · Automation · Quality", aliases: ["qa", "quality assurance", "test engineer"] },
];

export function JobSearchAutocomplete({ value, onChange, onSubmit }: JobSearchAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query.length < 2) return [];
    return suggestions
      .filter((item) => [item.label, item.hint, ...item.aliases].some((text) => text.toLowerCase().includes(query)))
      .slice(0, 6);
  }, [value]);

  useEffect(() => {
    setActiveIndex(0);
    setOpen(value.trim().length >= 2 && matches.length > 0);
  }, [value, matches.length]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function select(item: Suggestion) {
    onChange(item.label);
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
          onFocus={() => { if (matches.length) setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setOpen(false); return; }
            if (!open || !matches.length) {
              if (event.key === "Enter") onSubmit();
              return;
            }
            if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => (index + 1) % matches.length); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => (index - 1 + matches.length) % matches.length); }
            else if (event.key === "Enter") { event.preventDefault(); select(matches[activeIndex]); }
          }}
          placeholder="Job title, role, or skill"
          autoComplete="off"
          spellCheck={false}
          aria-label="Job title, role, or skill"
          aria-autocomplete="list"
          aria-expanded={open}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/25"
        />
      </div>

      {open && matches.length > 0 && (
        <div role="listbox" className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#101114] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,.55)]">
          <div className="px-3 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[.18em] text-white/25">Vantage suggestions</div>
          {matches.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(item)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${index === activeIndex ? "bg-white/[.07]" : "hover:bg-white/[.045]"}`}
            >
              <span className="min-w-0"><span className="block truncate text-sm text-white/80">{item.label}</span><span className="mt-0.5 block truncate text-[10px] text-white/30">{item.hint}</span></span>
              <span className="ml-3 text-[10px] text-white/20">↵</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
