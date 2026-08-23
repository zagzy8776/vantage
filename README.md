# VANTAGE — Lead Intelligence Platform

VANTAGE is a personal lead-discovery and business-intelligence platform. It runs deep, multi-source investigations on local business markets, verifies what it finds, and produces evidence-backed opportunity reports — every claim traceable to its source.

---

## What it does

Given a market query (e.g. *"beauty salons in Toronto"*), VANTAGE executes a full investigation pipeline:

```
Business discovery     Foursquare · Yelp
        ↓
Web discovery          Tavily · Exa
        ↓
Verification           cross-source checks
        ↓
Website enrichment     Firecrawl
        ↓
Performance analysis   Google PageSpeed
        ↓
AI intelligence        multi-provider LLM router (Groq → Cerebras → …)
        ↓
Evidence-backed report fact-vs-finding hierarchy · confidence scores
```

Executions are **durable**: an investigation is triggered by an API call but does not depend on it. State lives in PostgreSQL (Neon), a background worker carries executions through provider failures, and terminal states (`completed`, `completed_with_errors`, `failed`, `cancelled`) are always reached and reconciled.

## Core capabilities

- **Deep discovery** — category expansion, budgeted provider fan-out, deduplication across sources
- **Evidence model** — every finding links to persisted raw source evidence; facts and inferences never mix
- **Opportunity scoring** — website health (performance, mobile, SEO, booking/e-commerce gaps) combined into actionable lead scores
- **Investigations workspace** — statuses, actions, notes, and full execution traces
- **Collaboration** — members with roles (owner/admin/editor/viewer/reviewer), tasks, review workflows
- **Reports & exports** — JSON and CSV export preserving the evidence hierarchy
- **Researcher marketplace** — human-in-the-loop research tasks with submission validation and mandatory human review of AI-flagged content
- **Auth & tenancy** — signed session tokens with server-side revocation, role-based access control, organization-level isolation (IDOR-tested)

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + React 18 |
| Language | TypeScript (strict) |
| Database | PostgreSQL on Neon, serverless driver |
| ORM / migrations | Drizzle ORM |
| Styling | Tailwind CSS |
| Testing | Vitest |
| Linting | ESLint (`--max-warnings=0`) |

## Quality gates

Every change passes all four:

```bash
npm run typecheck   # strict TypeScript
npm run lint        # zero warnings tolerated
npm test            # 665 tests across 77 suites
npm run build       # production build
```

## Getting started

```bash
git clone https://github.com/zagzy8776/vantage.git
cd vantage
npm install

cp .env.example .env.local   # fill in values — server-side only, never commit
npm run db:migrate
npm run dev
```

All environment variables are server-only. See `.env.example` for the full annotated template (database, discovery providers, AI providers, web research providers, budgets).

## Project structure

```
src/
├── app/            Next.js App Router — pages + 36 API routes
├── auth/           Sessions, tokens, RBAC, tenant-isolation tests
├── components/     UI panels (investigations, collaboration, marketplace)
├── lib/            DB client, security (rate limiting, CSRF, secrets, sanitizers)
├── services/       Domain logic: discovery, investigations, synthesis,
│                   website analysis, search runs, collaboration
└── marketplace/    Researcher marketplace: tasks, validation, review
scripts/            DB migration + operational tooling
docs/               Engineering documentation
```

## Design principles

- **Fail closed** — missing/tampered credentials reject requests; unknowns are surfaced, not papered over
- **Budgeted execution** — every external provider call is bounded by explicit limits
- **Terminal integrity** — executions always resolve; individual provider failures degrade to `completed_with_errors`
- **Human review where it matters** — AI-generated marketplace submissions require human approval

## Status

Active development. Core investigation pipeline, collaboration, reporting, and marketplace are implemented and tested; production hardening (observability, distributed rate limiting, billing) is in progress.

## License

Proprietary. All rights reserved.
