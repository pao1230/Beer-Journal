# 🍺 Brewing Journal

Personal homebrewing journal: recipes, brew sessions, problems and lessons learned — so each
batch learns from the last one. See [PLAN.md](PLAN.md) for the full product plan.

**Phases 1–3 are implemented:**

- **Ingredients** — type-specific specs (color/potential, alpha acid, attenuation), search, archive
  instead of delete once used
- **Equipment profiles** — boil-off, losses, efficiency; drives the estimated pre-boil volume
- **Recipes** — ingredient list with stages and addition times, multi-step mash, water, targets
  (OG/FG/IBU/SRM/CO2, ABV calculated). Editing a recipe that has been brewed creates a new
  **version**, and each version snapshots ingredient specs, so old brews never change
- **Brew sessions** — "Brew Again" from a recipe or "Clone this brew"; target vs actual, status,
  planned vs actual ingredient amounts and substitutions
- **7 brew steps** — targets pulled from the recipe, quick-entry readings, custom measurements,
  notes, problems, complete/reopen, and the same step from the **previous batch** side by side
- **Fermentation daily log**, packaging method
- **Problems & lessons** — cause/action/impact, lessons linked to a problem or standalone, search
  across everything
- **Validation** — FG must be below OG; warnings when OG/FG, mash temp or pH drift from target,
  with one-tap "Log as problem"
- **Fermentation charts** — gravity (with target FG), temperature and pH by day, overlaid with the
  previous batch; hover/keyboard tooltips and a data-table fallback
- **pH through the brew** — every pH reading from water prep to fermentation, flagged against the
  target mash pH
- **Compare brews** — up to 4 batches side by side: overview, every step reading, ingredient
  amounts, problems, and overlaid fermentation curves; "only differences" toggle
- **Recipe scaling** — preview a new batch size, then save as a new version or a new recipe
- **Search** across problems, lessons and notes — every word must match, "quoted phrases",
  highlights, works for Thai
- **Calculators** — estimated OG/FG/ABV (grain potential × efficiency; kettle sugars and
  unfermentable lactose handled), IBU (Tinseth), SRM (Morey), water ions in ppm from brewing
  salts, actual brewhouse efficiency, priming sugar. Live in the recipe editor too
- **Inventory & cost** — stock ledger per ingredient (purchases, stock counts, brew deductions
  with undo), weighted-average cost, batch cost and cost per litre, "enough in stock?" check on
  every recipe
- **Photos** on any brew step — resized in the browser, stored in Postgres (no external storage)
- **Export** — CSV of all brews or one brew's full record (Excel-friendly UTF-8), and a printable
  report you can save as PDF (renders Thai correctly)
- Mobile bottom nav, installable web app manifest, optional basic auth

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 ·
PostgreSQL · Prisma 7 · Vitest

## Getting started

```bash
cp .env.example .env
docker compose up -d          # Postgres on localhost:5432 (or point DATABASE_URL at your own)
npm install                   # also runs `prisma generate`
npm run db:migrate            # create tables
npm run db:seed               # optional: Sweet Stout recipe + brew #001 + starter ingredients
npm run dev                   # http://localhost:3000
```

| Script | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | Route type generation + `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (brewing math, calculators, inventory, CSV, scaling, search) |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Seed sample data (skipped if the DB already has data) |

## Deploying

There is no login yet (Phase 1 is single-user). **Before putting it on the internet, set
`BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD`** — `src/proxy.ts` then requires HTTP basic auth on
every page and server action. Run `npm run db:deploy` against the production database.

## Layout

```text
prisma/schema.prisma        data model (see PLAN.md §25)
src/lib/brewing.ts          step definitions, formatting, ABV/volume math, validation
src/app/ingredients         ingredient master
src/app/equipment           equipment profiles
src/app/recipes             recipe list/detail/editor + versioning actions
src/app/brews               sessions, steps, problems, lessons (actions.ts has all mutations)
src/app/compare             side-by-side brew comparison
src/app/lessons             knowledge-base search (problems, lessons, notes)
src/components/line-chart   dependency-free SVG line chart
src/lib/search.ts           query parsing, filters, highlighting
src/lib/calc.ts             IBU/SRM/OG/FG, water profile, efficiency, priming sugar
src/lib/inventory.ts        stock ledger math and costing
src/app/inventory           inventory page, stock card, inventory actions
```
