# 🍺 Brewing Journal Web App — Plan (v2)

> **Status:** Phase 1 is implemented (see [README](README.md)). Some Phase 2 items came for free
> and are also done: fermentation daily log, recipe versioning, deviation warnings with
> "Log as problem", and lessons/problems search. Still to do from Phase 2: charts, compare brews,
> recipe scaling, and proper full-text search.
>
> Small deviations from §25 made during implementation:
> - `problems.brew_session_id` is always set (the step is optional), which makes per-brew queries simpler.
> - ABV is calculated from OG/FG instead of stored, so it can't drift out of sync.
> - Water `source` lives on `recipe_versions`; the "Water" ingredient type is for salts/agents.
> - `brew_ingredients` stores `substituted_for_name` (text) rather than an id, so it survives ingredient edits.

> Revised from the original plan. Changes from v1 are marked **[NEW]** or **[FIX]** inline. See
> [§0 Summary of Changes](#0-summary-of-changes-from-v1) for a full diff-style list.

## 0. Summary of Changes from v1

**Fixes to the data model (would have caused real bugs later):**
- **[FIX] Ingredient edits no longer rewrite history.** `recipe_ingredients` now snapshots the
  ingredient's name, brand, and key specs (such as alpha acid) at the time it's added, instead of only holding a foreign key.
  Editing "Pale Ale Malt" next year no longer silently changes what last year's recipe says it used.
- **[FIX] `fermentation_logs` now hangs off `brew_step_id`**, consistent with `measurements` and
  `problems`, instead of being the one table tied directly to `brew_session_id`.
- **[FIX] `lessons_learned` is now its own table**, not just a field on `problems` — v1's own
  examples (§19) show lessons that don't come from a documented problem.
- **[FIX] `problems.brew_step_id` is nullable**, with an optional `brew_session_id`, so you can log
  a problem that isn't tied to one step (wrong ingredient ordered, fermenter cracked in storage).
- **[FIX] Mash Schedule supports multiple steps** (protein rest, saccharification, mash-out) instead
  of one fixed temperature/time. v1's schema also had no table for the mash schedule at all.
- **[FIX] Targets move from `recipes` to `recipe_versions`.** In v1, `target_og`, `batch_size`, etc.
  sat on `recipes`, so editing v2's target OG overwrote v1's. That broke the promise in §23.
- **[FIX] New `brew_ingredients` table.** "Brew Again" and "Clone Previous Brew" both say they copy
  ingredients into the session, but v1 had no table for brew-level ingredients. That also meant
  you couldn't record a brew-day swap (for example, US-05 was out of stock, so you used S-04).
- **[FIX] Water volumes and target pH have a home** (`recipe_versions` columns). v1 had no schema
  for them.

**New sections:**
- **[NEW] §7A Equipment Profile** — boil-off rate, mash tun deadspace, efficiency %. Needed for
  realistic targets and for recipe scaling.
- **[NEW] §17A Packaging Step** — was named in the step list but never designed in v1.
- **[NEW] §24A Recipe Scaling** — adjust a recipe to a different batch size.
- **[NEW] §24B Validation & Sanity Checks** — OG must be > FG, warn on large target/actual deltas.
- **[NEW] §11 Step Template** — v1 repeated a full mockup per step (§11–16); this is now one
  generic shape plus a table of what's *different* per step.

**Ingredient data gaps filled** (needed for Phase 3 calculators to ever work): hop alpha acid %,
grain color (°L/EBC) and potential extract, yeast attenuation % and form.

**Tech stack additions:** local Postgres via Docker Compose, Vercel for deploy, a charting library
pick, file storage for photos, PWA installability for brew-day mobile use.

Everything else (navigation, dashboard, recipe/brew session split, cloning, versioning, compare,
knowledge-base search) is kept from v1 — that structure was sound.

---

## 1. Project Overview

Personal web app for logging homebrewing, built around 4 core concepts:

1. **Ingredient Master** — ingredients you've used before, reusable across recipes
2. **Recipe** — the plan: what you intend to brew
3. **Brew Session** — the reality: what actually happened for a given batch
4. **Problems & Lessons Learned** — mistakes, causes, fixes, and takeaways, logged as first-class
   data (not buried in free-text notes) so they're searchable later

Core loop:

> Recipe → Brew → Actual Data → Problems → Lessons Learned → use last batch's data to improve the next one

---

## 2. Core Concept

```text
                    🍺 Brewing App
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
    Ingredients        Recipes          Brew Sessions
        │                 │                 │
   ┌────┼────┐            │          ┌──────┼──────┐
   │    │    │            │          │      │      │
 Grain Hop Yeast        Recipe      Steps  Data  Problems
                          │                 │
                          └──────┬──────────┘
                                 │
                         Lessons Learned
```

### Recipe vs. Brew Session

| | Recipe | Brew Session |
|---|---|---|
| Represents | Intent | Reality |
| OG/FG | Target | Actual |
| Volume | Target | Actual |
| Temps/times | Planned | Measured |
| Problems | — | Logged per step or per session |
| Mutability | Versioned (§23) | Immutable once brewed — it's a historical record |

---

## 3. Main Navigation

```text
Dashboard
Recipes
Ingredients
Brew Sessions
History / Lessons
```

Mobile bottom nav:

```text
🏠 Home   📖 Recipes   ➕ Brew   📊 History
```

---

## 4. Dashboard

```text
🍺 Brewing Journal

[ + New Brew ]

Recent Brews
────────────────────────────
Sweet Stout          19 Sep 2026
OG 1.072  FG -        Status: Fermenting
────────────────────────────
APA                  02 Sep 2026
OG 1.052  FG 1.010  ABV 5.5%  Status: Completed
```

```text
Total Brews      12
Completed         9
Fermenting        2
Recipes           6
```

---

## 5. Ingredient Master

### 5.1 Categories

Grain · Hop · Yeast · Water · Other

### 5.2 Ingredient Data **[FIX: type-specific fields added]**

A bare name/brand isn't enough — v1 correctly noted brand/supplier matter, but each ingredient
*type* also needs its own brewing-relevant fields, or Phase 3's ABV/IBU/SRM calculators have
nothing to compute from.

```text
Ingredient (common)
- id, name, type, brand, supplier, notes, is_archived

Grain-specific
- color            (°Lovibond or EBC)
- potential        (extract potential, e.g. 1.036 or ppg)

Hop-specific
- alpha_acid_pct
- form             (pellet / leaf / cryo)

Yeast-specific
- attenuation_pct
- form             (dry / liquid)
- flocculation     (low / medium / high)

Water-specific
- source           (RO / tap / bottled)

(no extra fields for "Other")
```

`is_archived` **[NEW]** — instead of deleting an ingredient once it's been used in a recipe
(which would orphan history), archive it. Archived ingredients disappear from the selector but
stay resolvable in old recipes.

### 5.3 Ingredient Selector

```text
Type          [ Grain ▼ ]
Ingredient    [ Pale Ale Malt ▼ ]
Amount        [ 4.2 ] kg
[ Add ]
```

---

## 6. Recipe

### 6.1 Basic Information **[FIX: target IBU/SRM/carbonation added]**

v1 only had target OG/FG/ABV. Without target IBU and SRM up front, there's nothing for the
Phase 3 IBU/SRM calculators to validate against, and no way to tell "did this batch come out
too bitter/dark" without a target to compare to.

```text
Recipe Name       Sweet Stout
Style             Sweet Stout
Batch Size        20 L
Boil Time         60 min
Target OG         1.074
Target FG         1.026
Target ABV        6.3%
Target IBU        28
Target SRM        38
Target Carbonation  2.4 vol CO2
Equipment Profile  [ Home 3-Vessel ▼ ]   ← see §7A
```

### 6.2 Fermentables

| Ingredient | Amount |
|---|---:|
| Pale Ale Malt | 4.2 kg |
| Roasted Barley | 500 g |
| Caradis Malt | 450 g |
| Carafa Special II | 250 g |
| Oat Flaked | 500 g |

### 6.3 Hops

| Hop | Amount | Time |
|---|---:|---:|
| Magnum | 28 g | 60 min |
| EK Golding | 28 g | 43 min |

### 6.4 Other

| Item | Amount | Time |
|---|---:|---:|
| Lactose | 500 g | 55 min |
| Yeast Nutrient | per recipe | per recipe |

### 6.5 Yeast

```text
Safale US-05
```

---

## 7. Water Profile

```text
Water
Source          RO / Tap / Bottled
Total Volume    25 L
Target pH       5.6

Additions
Sodium Bicarbonate    7 g
Calcium Chloride      3 g
Calcium Carbonate     3 g
```

Split into:

```text
Mash Water     17.8 L
Sparge Water    7.2 L
```

Brew Session records the *actual* values used, separate from Target.

---

## 7A. Equipment Profile **[NEW]**

Without a fixed equipment profile, "target volume" numbers are guesses and recipe scaling (§24A)
has nothing to scale by. One-time setup per brew rig, reused across recipes.

```text
Equipment Profile: Home 3-Vessel
- Batch Size (default)     20 L
- Boil-off Rate            2.5 L/hr
- Mash Tun Deadspace        0.5 L
- Trub/Chiller Loss         1.0 L
- Brewhouse Efficiency      72%
```

Recipes reference an equipment profile; it seeds default pre-boil/post-boil volume math instead
of the user having to eyeball it every time.

---

## 8. Start New Brew ("Brew Again")

```text
[ Brew Again ]
```

Creates a new Brew Session by copying from the Recipe (its current version — see §23).

**Copy:** ingredients, amounts, mash schedule, sparge, boil schedule, yeast, water profile
**Don't copy:** actual OG/FG, fermentation logs, problems, lessons learned, actual measurements

---

## 9. Brew Session

```text
Sweet Stout — Brew #001
19 September 2026

Target Volume   20 L        Actual Volume   21.5 L
Target OG       1.074       Actual OG       1.072
```

Status: `Planning → Brewing → Fermenting → Conditioning → Completed` (or `Cancelled`)

---

## 10. Brew Steps

```text
① Water Preparation  ② Mashing  ③ Sparging  ④ Boiling
⑤ Cooling  ⑥ Fermentation  ⑦ Packaging
```

Every step shares the same shape — see §11, which also has a per-step table of what's
*different*. (v1's §11–16 repeated a full mockup for each step; they're merged into §11. Section numbers
otherwise follow v1, so §12–16 are intentionally skipped.)

---

## 11. Step Template **[NEW — replaces repeated mockups]**

Every step has:

```text
<Step Name>

Target            ← planned values, pre-filled from the Recipe
Actual            ← [ input fields ]
Measurements      ← 0+ typed readings (SG, pH, temp, volume, ...)
Notes             ← free-form text
Problems          ← 0+ Problem entries (§18)

[ + Measurement ]  [ + Note ]  [ + Problem ]
[ Complete Step ]
```

**Structured + free-form together, always** (this is the one non-negotiable principle — see §33):
structured fields feed graphs/compare/calculators, free-form notes capture what a number can't.

```text
Structured: Temperature 69°C · Time 60 min · pH 5.4
Notes: "รอบนี้คน mash น้อยไปช่วง 10 นาทีแรก ทำให้อุณหภูมิด้านบนกับด้านล่างต่างกัน"
```

Per-step specifics:

| Step | Target fields | Measurements |
|---|---|---|
| Water Prep | Volume, target pH, mineral additions | Actual pH, temp |
| Mashing | **List of mash steps** (type, temp, time), mash-out included (see below) | Pre/post-mash pH, first runoff SG |
| Sparging | Volume, temperature | Actual volume/temp, pH, runoff SG |
| Boiling | Total time, hop/other addition timeline | Pre/post-boil volume, pre/post-boil SG |
| Cooling | Target temp | Start/end time, duration |
| Fermentation | — (see §17, daily log) | Daily temp/gravity/pH |
| Packaging | **[NEW]** method, priming/carbonation target | Final volume, carbonation (measured) |

### Mashing: multi-step schedule **[FIX]**

v1 modeled mashing as one fixed temperature/time. Real recipes often need a rest sequence:

```text
Mash Steps
① Protein Rest     50°C   15 min
② Saccharification 69°C   60 min
③ Mash Out          75°C   15 min
```

Each step gets its own target vs. actual, same as before — just as a list instead of a
singleton.

---

## 17. Fermentation — Daily Log

```text
Day 1   Temperature 18.2°C   Gravity 1.060   Activity High   Notes "Lots of krausen"
Day 2   Temperature 18.1°C   Gravity 1.045
```

Gravity and Temperature charts plotted from these entries (Phase 2 — pick a charting library,
see §26).

---

## 17A. Packaging Step **[NEW]**

Named in v1's step list (§10) but never designed — filling that gap:

```text
Packaging

Method            [ Bottle / Keg / Force-carb / Bottle-condition ]

Target
Carbonation       2.4 vol CO2
Priming Sugar     (auto-calc from beer volume, target CO2, and peak ferment temp, Phase 3)

Actual
Final Volume      19.8 L
Packaging Date    ...
Carbonation (measured, if kegged)  ...

Notes / Problems  (as usual)
```

---

## 18. Problem Log

Problem is its own entity, not a note. **[FIX: no longer requires a step]**

```text
⚠️ Problem #12
Step         Mashing
Problem      Mash temperature สูงกว่า target
Target       69°C          Actual   70°C
Cause        Strike water ร้อนเกินไป
Action       เติมน้ำเย็น
Impact       Mash temperature กลับมา 69.5°C
```

```text
Problem
- id, title, description, cause, action, impact
- brew_step_id   (nullable)
- brew_session_id (set when not tied to a specific step)
```

`lesson_learned` is **no longer a field here** — see §19.

---

## 19. Lessons Learned **[FIX: separate entity]**

v1 stored `lesson_learned` as a field on `problems`, but its own examples included lessons with
no originating problem ("Prepare backup hydrometer", "Check final volume before calculating OG").
So lessons are their own table, optionally linked back to a problem or brew session:

```text
Lesson
- id, text, tags[]
- problem_id      (nullable — set if it came from a specific problem)
- brew_session_id (nullable)
- created_at
```

```text
🧠 Lessons Learned
- Don't measure OG while wort is ~70°C
- Prepare backup hydrometer
- Check final volume before calculating OG
- Check mash temperature after stirring
```

Full-text search across problems + lessons + notes:

```text
Search: hydrometer
→ Sweet Stout #001 — Problem: Hydrometer unusable — Lesson: Keep backup hydrometer
```

---

## 20. Previous Brew (inline comparison)

While filling in a step, show the same step from the previous brew of the same recipe, so the
user learns from it without leaving the page:

```text
Mashing ─────────────────────
CURRENT     Target 69°C   Actual 68.5°C
PREVIOUS    Target 69°C   Actual 70°C
            ⚠️ Problem: Temperature สูงเกิน
            💡 Lesson: ลด Strike Temperature 1°C
```

---

## 21. Brew History / Collection

```text
🍺 My Brews
[ Search ] [ Style ▼ ] [ Recipe ▼ ] [ Status ▼ ] [ Year ▼ ]

Sweet Stout #002   23 Sep 2026   OG 1.074  FG -       Fermenting
Sweet Stout #001   19 Sep 2026   OG 1.072  FG 1.026   6.0%  Completed
APA #003           10 Sep 2026   OG 1.054  FG 1.010   5.8%
```

---

## 22. Clone Previous Brew

Separate from "Brew Again" (which starts from a Recipe): clone an existing Brew Session directly.

```text
Sweet Stout #001
[ Clone This Brew ]
```

**Copy:** ingredients, water, mash, boil, yeast, schedule
**Don't copy:** actual measurements, fermentation data, problems, batch-specific notes

---

## 23. Recipe Versioning

```text
Sweet Stout
v1 ├── Brew #001
v2 ├── Brew #002, Brew #003
```

Editing a Recipe creates a new version; old Brew Sessions keep pointing at the version they
were actually brewed from. `brew_sessions.recipe_version_id` is set at brew time and never
changes.

**[FIX]** For this to work, *everything that can change between versions* must live on
`recipe_versions`, not `recipes`: batch size, boil time, targets, water volumes, and the
equipment profile. `recipes` only keeps identity (name, style).

> **Note:** this same rewrite-history problem exists for ingredients (§5.2's `is_archived`
> fix) and is why `recipe_ingredients` snapshots key values instead of only holding a live FK —
> see §25.

---

## 24. Compare Brews

Phase-2+ feature, purely for comparison — not for ranking "best" batch:

```text
Sweet Stout          #001    #002    #003
OG                  1.072   1.074   1.073
FG                  1.026   1.024   1.025
ABV                  6.0%    6.6%    6.3%
Mash                 70°C    69°C    69°C
Problems                3       1       0
```

---

## 24A. Recipe Scaling **[NEW]**

Given an Equipment Profile (§7A) with a known boil-off rate and efficiency, scaling a recipe to
a different batch size should proportionally adjust fermentable/hop/water amounts rather than
requiring the user to redo the math by hand.

```text
Sweet Stout (20 L) → Scale to → [ 10 L ]
All fermentables, hops, and water volumes scaled ×0.5
Hop timing and mash temps unchanged
```

Phase 2+; depends on §7A existing first.

---

## 24B. Validation & Sanity Checks **[NEW]**

Lightweight guardrails, not a rigid form:

- `actual_fg` must be less than `actual_og` (catches transposed entries)
- Warn (don't block) when actual deviates from target by more than a threshold
  (e.g. mash temp off by >2°C, OG off by >0.005) — and offer a one-tap
  **[ + Log as Problem ]** shortcut right there, instead of making the user
  remember to do it separately
- Batch number is unique per recipe

---

## 25. Database Design

### ingredients
```text
id, name, type, brand, supplier, notes, is_archived, created_at, updated_at
-- type-specific (nullable, only relevant for their type):
color, potential,              -- grain
alpha_acid_pct, form,          -- hop
attenuation_pct, flocculation, -- yeast (also uses `form`)
source                          -- water
```

### equipment_profiles **[NEW]**
```text
id, name, batch_size_default, boil_off_rate, mash_tun_deadspace,
trub_chiller_loss, efficiency_pct, created_at
```

### recipes **[FIX: identity only]**
```text
id, name, style, notes, created_at, updated_at
```

### recipe_versions **[FIX: now holds everything that changes between versions]**
```text
id, recipe_id, version, notes, created_at,
equipment_profile_id, batch_size, boil_time,
target_og, target_fg, target_abv, target_ibu, target_srm, target_carbonation,
water_source, mash_water_l, sparge_water_l, target_mash_ph
-- unique (recipe_id, version)
```
Water salt additions (CaCl2, NaHCO3, ...) are rows in `recipe_ingredients` with
`addition_stage = 'mash' | 'sparge'`.

### recipe_ingredients **[FIX: snapshot fields added]**
```text
id, recipe_version_id, ingredient_id,
name_snapshot, brand_snapshot,                         -- [NEW] frozen at add-time
alpha_acid_snapshot, color_snapshot, attenuation_snapshot, -- [NEW] specs vary lot-to-lot
amount, unit, addition_time, addition_stage, notes
```

### mash_steps **[NEW — v1 had no table for the mash schedule]**
```text
id, recipe_version_id, step_order, step_type, temperature, time_min
```

### brew_sessions
```text
id, recipe_id, recipe_version_id, cloned_from_session_id (nullable),
batch_number, brew_date,
actual_volume, actual_og, actual_fg, actual_abv,
status, notes, created_at, updated_at
-- unique (recipe_id, batch_number)
```
`recipe_id` is stored directly, not only reached through the version, so batch numbers
(#001, #002, ...) keep counting across versions. The unique constraint needs that column.
`cloned_from_session_id` backs the "Based on Sweet Stout #001" label in §22.

### brew_ingredients **[NEW]**
```text
id, brew_session_id, ingredient_id, name_snapshot,
planned_amount, actual_amount, unit, addition_time, addition_stage,
substituted_for_id (nullable), notes
```
Copied from `recipe_ingredients` when you press "Brew Again", or from another session's
`brew_ingredients` when you press "Clone". `actual_amount` and `substituted_for_id` capture what
really went in on brew day.

### brew_steps
```text
id, brew_session_id, step_type, started_at, ended_at, notes
```

### measurements
```text
id, brew_step_id, type, value, unit, recorded_at, notes
```

### problems **[FIX]**
```text
id, brew_step_id (nullable), brew_session_id (nullable),
title, description, cause, action, impact, created_at
```

### lessons **[NEW — replaces problems.lesson_learned]**
```text
id, text, tags, problem_id (nullable), brew_session_id (nullable), created_at
```

### fermentation_logs **[FIX: now tied to the Fermentation brew_step]**
```text
id, brew_step_id, date, temperature, gravity, ph, notes
```

---

## 26. Recommended Tech Stack

### Frontend
- Next.js, TypeScript, React

### UI
- Tailwind CSS + shadcn/ui
- Charting **[NEW — pick one]**: Recharts (simplest, fits shadcn's aesthetic) for gravity/temp
  graphs in Phase 2

### Backend
- Next.js API routes / Server Actions to start

### Database
- PostgreSQL — **[NEW]** run locally via Docker Compose for dev; no need to provision a hosted
  DB until deploying

### ORM
- Prisma

### File Storage **[NEW]**
- Needed for Phase 3 photo uploads — Vercel Blob (pairs with Vercel deploy) or any S3-compatible
  bucket. Decide when Phase 3 starts; no need to build for it now.

### Deployment **[NEW]**
- Vercel (pairs naturally with Next.js)

### PWA **[NEW]**
- Worth making installable (`next-pwa` or App Router's built-in manifest support) — brew day
  happens standing next to a kettle with wet hands, not at a desk. Installable + large touch
  targets matters more here than most personal-use apps.

### Authentication
- Phase 1: none needed, single user
- Later: add if sharing with others

---

## 27. MVP — Phase 1 (Core)

**Ingredients**
- Create / Edit / Delete (archive, not hard-delete — §5.2) / Search / Dropdown Selector
- Type-specific fields (color/potential, alpha acid, attenuation) — cheap to add now, expensive
  to backfill once real recipes exist

**Equipment Profile [NEW]**
- One profile, basic fields (batch size, boil-off rate, efficiency) — even a single hardcoded
  profile beats none, since Recipe's volume math depends on it

**Recipes**
- Create / Edit, ingredient list, water profile, **multi-step** mash schedule, boil schedule,
  yeast, target IBU/SRM alongside OG/FG/ABV

**Brew Session**
- Start Brew (copy from Recipe), Target/Actual, Brew Steps **including Packaging**

**Problem Log**
- Problem: cause/action/impact — no `lesson_learned` field (that's its own entity now)

**Lessons Learned [NEW]**
- Minimal: text + optional link to a problem or session. Full search comes in Phase 2.

**History**
- List Brew Sessions, Search, View Detail

**Clone**
- Brew Again, Clone Previous Brew

---

## 28. Phase 2

- Fermentation Daily Log, Gravity Chart, Temperature Chart, pH Tracking
- Recipe Versioning, Compare Brews
- Full-text Search across Lessons + Problems + Notes
- Recipe Scaling **[NEW]**
- Validation warnings + one-tap "log as problem" **[NEW]**

---

## 29. Phase 3

- Cost per Batch, Ingredient Inventory, Stock Remaining, Batch Cost
- ABV / IBU (Tinseth) / SRM (Morey) / Mash Efficiency / Water Profile Calculators
  — now unblocked since §5.2 added the ingredient fields these formulas need
- Priming Sugar Calculator **[NEW]** — feeds directly into §17A Packaging
- Export PDF / CSV
- Photo Upload — attach photos to a Brew Step

---

## 30. Future Idea: Brewing Knowledge Base

Once there's enough data across batches, the app becomes a searchable personal knowledge base:

```text
Search: "mash temperature"
→ 4 Problems, 3 Lessons, 8 Brew Sessions
```

Lets you look back at your own experience easily.

---

## 31. Recommended User Flow

```text
Create Ingredient → Create Recipe → Start Brew
  → Water Prep → Mashing → Sparging → Boiling → Cooling
  → Fermentation → Packaging → Complete Brew
  → History → Lessons Learned → Brew Again
```

---

## 32. Important UX Principle

Don't make forms feel like paperwork. Every step starts minimal — Target, Actual, and buttons
to add more only if the user wants to (§11). Nobody should have to scroll through unused
fields to log a 30-second gravity reading.

---

## 33. Structured Data + Free-form Note

The core principle of the whole system:

- **Structured** (Temperature, Time, pH, Volume) → powers graphs, compare, calculators
- **Free-form** → captures the lived experience a number can't

Always capture both, for every step.

---

## 34. Final Product Vision

> "A brewing journal that can learn from the previous batch."

Not a recipe book — a loop:

```text
Recipe → Actual Brew → Measurements → Problems → Lessons → Next Brew → Better Data
```

The more you brew, the more useful the system gets.
