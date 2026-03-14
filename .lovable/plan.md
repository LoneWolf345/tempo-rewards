

## Generate a Professional README.md

Replace the current placeholder README with a polished, comprehensive document based on the full codebase analysis.

### What I Found

**What it is:** An internal rewards reconciliation tool ("TeMPO Rewards Tracker") that matches technician upsell submissions (from TeMPO) against gift card fulfillments (from Sendoso), surfacing mismatches so administrators can ensure every technician gets paid.

**Who it's for:** Internal operations/admin staff at Cableone who manage field technician incentive programs. Technicians use it read-only to check their reward status.

**Tech stack:** React 18, TypeScript, Vite 5, Tailwind CSS 3, shadcn/ui, Supabase (auth + Postgres + RLS), React Router 6, TanStack React Query, date-fns, Recharts, Zod. Deployed via Docker on OpenShift.

**Database tables:** `profiles`, `user_roles` (admin/technician enum), `tempo_submissions`, `sendoso_records`, `upload_history`.

**Key features:**
1. Email/password auth restricted to `@corp.cableone.net`
2. Role-based access (admin vs technician) via `user_roles` table + RLS
3. Admin CSV upload for TeMPO and Sendoso data (with upsert, validation, audit logging)
4. Automated record reconciliation with 1:1 and group (subset-sum) matching
5. Per-technician dashboard with status pipeline, search, sort, and filtering
6. Admin user emulation ("view as" a technician)
7. Upload history with audit trail
8. Docker/OpenShift deployment with `vite preview`

**Env vars:** `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`

**No license file found.**

### README Structure

The new `README.md` (~200 lines) will contain:

1. **Title + tagline** — "TeMPO Rewards Tracker — Reconcile technician upsell submissions against reward fulfillments."
2. **Overview** — 2-3 sentences on what/why/who.
3. **Features** — 8-bullet highlight reel.
4. **Tech Stack** — grouped table (Frontend, Backend, Infrastructure).
5. **Getting Started** — prerequisites (Node 22, Bun or npm), install steps, env var table, `npm run dev` command.
6. **Usage** — brief walkthrough: sign in, view dashboard, admin uploads.
7. **Project Structure** — depth-2 tree with descriptions.
8. **Deployment** — Docker build/run commands with `--build-arg`, Mermaid diagram (carried over from existing README).
9. **License** — "No license file found."

### Single File Change

- **`README.md`** — full rewrite with the structure above. All content derived from codebase inspection; nothing invented.

