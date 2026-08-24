const COVERAGE = [
  {
    title: "Business identity",
    description: "Confirm the business name, category, location, contact details, and identity consistency.",
  },
  {
    title: "Web presence",
    description: "Check whether an official website is present, reachable, and consistent with the business being researched.",
  },
  {
    title: "Customer signals",
    description: "Use public signals such as ratings and review activity as context, not as a substitute for deeper evidence.",
  },
  {
    title: "Digital capabilities",
    description: "Look for observable capabilities such as booking, commerce, contact flows, and other public digital signals.",
  },
  {
    title: "Technical quality",
    description: "When available, assess public website performance, accessibility, SEO, and related quality indicators.",
  },
  {
    title: "Evidence consistency",
    description: "Compare observations, flag conflicts, and keep unsupported conclusions separate from verified findings.",
  },
];

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-mono">Research coverage</p>
        <h1 className="text-2xl font-mono font-extrabold tracking-tight">What VANTAGE checks</h1>
        <p className="text-sm text-subtle max-w-2xl">VANTAGE combines multiple public research signals behind the scenes and presents the result as one evidence-grounded business view.</p>
      </header>

      <section className="rounded-xl border border-accent/30 bg-accent/5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg border border-accent/40 bg-accent/10 flex items-center justify-center text-accent font-mono font-bold">VT</div>
          <div>
            <h2 className="font-semibold">Research is source-agnostic</h2>
            <p className="text-xs text-subtle mt-1 leading-5">You choose the business and geography. VANTAGE chooses the available public evidence needed to answer the research question, validates what it can, and labels uncertainty when evidence is incomplete.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {COVERAGE.map((item, index) => (
          <article key={item.title} className="rounded-xl border border-border bg-surface p-5">
            <p className="text-[10px] uppercase font-mono text-accent">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="font-semibold mt-2">{item.title}</h2>
            <p className="text-xs text-subtle mt-2 leading-5">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold">Evidence first</h2>
            <p className="text-xs text-subtle mt-1">A research signal can remain unknown when the available evidence is not strong enough.</p>
          </div>
          <span className="text-[10px] uppercase font-mono border border-success/30 bg-success/10 text-success rounded px-2 py-1">Customer view</span>
        </div>
      </section>
    </div>
  );
}
