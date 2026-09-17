# Fletcher

Release planning, creative review and rollout for artist teams. Replaces the 200-page marketing playbook Google Doc with projects, generated timelines, spec-checked assets, time-coded video review and day-by-day comms plans.

What is built, partial, and still to do, section by section against the playbook: [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack

- **Web:** Next.js (App Router), React, Tailwind v4, shadcn/ui (radix-nova preset, themed after Attio's product UI)
- **API:** tRPC v11 (`packages/api`), shared by web and the future Expo app
- **Data:** Postgres + Drizzle ORM (`packages/db`)
- **Domain:** pure TypeScript timeline engine, comms generator, asset specs and default templates (`packages/core`, vitest)
- **Auth:** not yet. A dev-user stub (`DEV_USER_EMAIL`) stands in for the Supabase session.
- **Uploads:** local disk (`.uploads/`) behind a storage adapter; swap for Supabase Storage / Mux later.

## Run it locally

```bash
cp .env.example .env         # set DATABASE_URL (local Postgres or `pnpm db:up` for docker)
pnpm install
pnpm db:migrate
pnpm db:seed                 # system templates + the MŌRIAH demo workspace at /w/moriah
pnpm dev                     # http://localhost:3000
```

`pnpm db:reset` drops everything, migrates and reseeds. `pnpm test` runs the engine tests. `pnpm typecheck` checks every package.

## Layout

```
apps/web            Next.js app: app/w/[slug]/… pages, components/ui (shadcn), components/fletcher (domain components)
packages/core       enums, dates, timeline engine, comms generator, asset specs, default templates, zod schemas
packages/db         drizzle schema, migrations, seed, project factory service
packages/api        tRPC routers, context (dev auth stub), storage adapter
```

## How the timeline engine works

A **timeline template** is a list of tasks with `offsetDays` relative to an anchor date (release date, premiere, announce), an optional `durationDays`, `dependsOn` keys, a weekday `snapTo`, and an optional deliverable kind. Creating a project materializes those tasks with real dates. Changing the project date re-shifts every task that still follows the template; dates set by hand are pinned. `validateTimeline` flags dependencies that ended up after their dependents and overdue work.

A **comms template** is a list of rollout moments (offset, time, CTA, asset hint) each with a nested per-platform checklist. Creating a project materializes them as moments + items with owners and checkboxes.

System templates live in `packages/core/src/templates`. Workspaces duplicate them and edit offsets, roles, moments and items in the Templates page.

## Next up (Tier 1)

Supabase auth + invites, per-seat Stripe billing, Expo mobile app, liner script generator, collaborator asks, tour/press/DSP/CRM modules, file library, key-art → every-size asset generation.
