# Meal Planner — Frontend Design Brief

A brief for rebuilding the frontend to look and flow better. Read it
top to bottom once: the first half is **creative direction** (where you
have freedom), the second half is **hard constraints** (the fixed
backend contract, build, and product rules you must not break).

The backend stays as-is. This is a frontend reskin/rebuild against a
stable REST API. You can keep React or pick another framework — see
[Build & deploy](#build--deploy) for what that costs.

---

## 1. The product in one minute

A mobile-first PWA that replaces a kitchen-whiteboard / Google-Sheets
habit for planning a family's week of dinners and doing the shop. It is
in **real weekly use** by Hilton and his wife.

The week is the unit of everything. A week has 7 days (Sun→Sat). The job
splits into three phases, navigated by a bottom tab bar:

1. **Plan** — decide what we're eating each night (Sun→Sat).
2. **List** — for each planned meal, jot the ingredients to pick up,
   plus a free "Extras" list (the old whiteboard catch-all).
3. **Shop** — one combined checklist you tick off in the store, with
   live sync so two people can split up and both check things off.

Everything is free text and low-ceremony. There are no recipes, no
quantities, no accounts. The whole point is speed and glanceability.

## 2. Who uses it, and on what

- **Primary: phone.** Android, one-handed, often mid-task (cooking,
  herding kids, pushing a cart). Design for the thumb. This is ~90% of
  use and should be where it feels best.
- **Occasional: tablet.** Some planning on a larger screen. Use the
  extra width gracefully, but don't *require* it.
- **Very occasional: PC.** Don't optimize for it; just don't break or
  sprawl. A centered, phone-width column on desktop is perfectly fine.

Two people use it concurrently (Hilton + wife), especially on the Shop
screen — see [Concurrency](#concurrency--live-sync).

**Family context** (flavor for copy/placeholders, not features): wife +
kids; daughter **Aspen is pescetarian** (no meat, eats fish); kids do
**Bellevue Youth Theater (BYT)** — hence the notes placeholder
"BYT — kids out 8pm".

## 3. The three phases, and where they currently chafe

This is the flow to make *feel* better — the friction points are hints,
not a spec.

**Plan.** Seven compact day cards. Each: day label + date, a free-text
meal input ("what's for dinner?"), and a collapsible per-day **notes**
field for appointments/weather. Saturday is rendered muted with a
"takeouts?" hint — it's optional.
- *Chafe:* it's a flat list of 7 identical inputs. Nothing helps you
  remember what you cooked before, see the week as a shape, or move
  quickly. Plenty of room to make planning feel light and even fun.

**List.** For every day that has a meal, an ingredient field that takes
**chips** (type, comma/Enter to add, backspace to edit, paste splits on
commas/newlines). Below that, the **Extras** list (free items not tied
to a meal). A big "Generate & Start Shopping →" button compiles
everything into the Shop checklist.
- *Chafe:* the relationship between meals and their ingredients could be
  clearer; entering a lot of chips on a phone keyboard is the heaviest
  typing moment in the app and deserves the most love.

**Shop.** One flat checklist. Unchecked items first (grouped by meal,
then an "Extras" group), a divider, then a collapsed "Done (n)" section.
Tap toggles purchased (optimistic). A header shows `checked/total` and a
Reset. Polls every 4s so a second phone stays in sync.
- *Chafe:* it works but is visually plain. In-store legibility (big
  targets, high contrast, fast feel, easy to find your place) is the
  bar. There is currently **no way to add an item directly on the Shop
  screen** — a known gap; a quick-add there would be welcome (it'd POST
  an Extra to the current week).

## 4. Design direction (your canvas)

Make it look and flow **way better**. You have real freedom on the
visual identity. What matters:

**Principles**
- **Phone-first, thumb-first.** Primary actions live in the bottom
  reachable zone. Touch targets ≥ 44px. Assume one hand.
- **Glanceable.** Legible at arm's length in a bright kitchen or a
  store aisle. Strong contrast, generous type, clear state.
- **Fast and optimistic.** Every tap responds instantly; the network
  catches up behind it. Never make the user wait on a spinner to see
  their own action. (The current app already does optimistic updates —
  keep that feel.)
- **Low ceremony.** Free text, few taps, no modal mazes. Adding a meal
  or an ingredient should feel like jotting on paper.
- **Continuous flow.** Plan → List → Shop is one journey across a week.
  The transitions and shared context should feel connected, not like
  three separate screens.
- **Calm, not cluttered.** Delight is welcome; noise is not.

**Current identity (reinvent freely, but know what's there)**
- Dark theme: slate background (`#0f172a`), emerald accent (`#059669`),
  Tailwind v4. Bottom tab bar (Plan / List / Shop). Chip-style
  ingredient entry. Week navigated by ‹ / › with a "Today" jump.
- The PWA theme/splash currently keys off emerald-on-slate (manifest
  `theme_color #059669`, `background_color #0f172a`). If you change the
  palette, update the manifest too.

**What's worth keeping (it earns its place)**
- Chip-based ingredient capture — it's fast; don't regress its speed.
- Optimistic toggles + 4s sync on Shop.
- Week-at-a-glance scoping; no drill-down into a single day.
- Saturday treated as soft/optional.

You may change layout, motion, palette, typography, component style, the
tab metaphor, anything visual — as long as the [hard rules](#5-hard-product-rules-do-not-break)
and the [API contract](#7-backend-contract-fixed) hold.

## 5. Hard product rules (do not break)

These are product decisions, not styling. Breaking them changes the app
into something else.

- **Meals are free text.** No recipe/meal entity, no dropdown of
  "dishes." A meal is a string on a day. (History-based autocomplete is
  fine and wanted later — but it suggests from past strings, it doesn't
  introduce a Meal table.)
- **No quantities.** Ingredients and extras are reminder strings
  ("garlic", "the good bread"), never "2 × 400g".
- **The week is the unit.** Everything is scoped to a week. No
  per-day detail screen, no navigating "into" a day beyond its inline
  notes.
- **Saturday is optional.** It exists but is visually de-emphasized;
  don't make it mandatory.
- **Extras start blank every week.** They do not carry over. (They're
  per-week rows server-side.)
- **No auth.** Don't add login. Security is "the URL is unguessable."
  Don't surface anything that implies accounts/users.

## 6. Responsive targets

| Device | Priority | Guidance |
|---|---|---|
| Phone (~360–430px) | **Primary** | Where it must feel best. One-handed, bottom actions, big targets. |
| Tablet (~768–1024px) | Occasional | Use width gracefully (e.g. show the week with more breathing room, or meals + their ingredients side by side). Optional polish, not required. |
| Desktop (>1024px) | Rare | Don't sprawl. A centered max-width column (~480–640px) is acceptable. Just don't break. |

Test in a real phone viewport first and most.

## 7. Backend contract (FIXED)

The API is an ASP.NET Core Minimal API. **Do not assume you can change
it** — treat this as the integration surface. Base URL is
`${VITE_API_URL}/api` in prod; in local dev, call `/api` and let Vite
proxy it (see [Build & deploy](#build--deploy)).

All bodies are JSON. IDs are integers. Dates are ISO `YYYY-MM-DD`.

### Data shapes

```ts
// A week. Created on demand by the GET endpoints below.
interface WeekDto {
  id: number
  startDate: string          // Sunday, e.g. "2026-06-14"
  days: DayDto[]             // always 7, ordered Sun→Sat
}

interface DayDto {
  id: number
  dayOfWeek: number          // 0=Sun … 6=Sat
  dayName: string            // "Sunday" … "Saturday"
  meal: string               // free text, "" if unset
  notes: string              // free text, "" if unset
  ingredients: string        // ONE string; chips are a UI concept —
                             // the API stores comma/newline-joined text
}

// A non-meal item for one week's list (the "Extras" list).
interface ExtraItem {
  id: number
  weekId: number
  name: string
  addedDate: string          // ISO timestamp
}

// A line on the Shop checklist (produced by /generate).
interface ShoppingItem {
  id: number
  weekId: number
  dayPlanId: number | null   // the meal it came from; null = an Extra
  name: string
  purchased: boolean
  sortOrder: number          // canonical display order
}
```

### Endpoints

| Method & path | Purpose | Returns |
|---|---|---|
| `GET /api/health` | Liveness | `{status, timestamp}` |
| `GET /api/weeks/current` | This week; **creates it if missing** | `WeekDto` |
| `GET /api/weeks/by-date/{YYYY-MM-DD}` | Week containing that date; **creates if missing** | `WeekDto` |
| `GET /api/weeks` | All weeks, newest first (history source) | `WeekDto[]` |
| `GET /api/weeks/{id}` | One week | `WeekDto` / 404 |
| `PATCH /api/days/{id}` | Update a day. Body: any of `{ meal?, notes?, ingredients? }` (omitted fields untouched) | `DayDto` |
| `GET /api/weeks/{weekId}/extras` | This week's extras | `ExtraItem[]` |
| `POST /api/weeks/{weekId}/extras` | Add an extra. Body `{ name }` | `ExtraItem` (201) |
| `DELETE /api/extras/{id}` | Remove an extra | 204 |
| `GET /api/weeks/{weekId}/shopping-items` | The Shop checklist (**poll this**) | `ShoppingItem[]` |
| `POST /api/weeks/{weekId}/shopping-items/generate` | (Re)build the checklist from days' ingredients + extras | `ShoppingItem[]` |
| `PATCH /api/shopping-items/{id}/purchased` | **Toggle** purchased | `ShoppingItem` |
| `DELETE /api/shopping-items/{id}` | Remove one item | 204 |
| `POST /api/weeks/{weekId}/shopping-items/reset` | Uncheck all (new shop, same list) | 204 |

### Behaviors that matter for UX

- **Weeks are lazy.** You never "create" a week; you GET `current` or
  `by-date` and the server makes it (with 7 empty days) if needed.
- **Ingredients are one string per day.** The chip UI splits/joins on
  commas and newlines client-side, then PATCHes the whole
  `ingredients` string. Persist as you go (debounced) — don't rely on a
  "save" button.
- **`generate` is idempotent and safe to call repeatedly.** It
  reconciles the checklist against the current ingredients + extras:
  keeps already-purchased items, de-dupes, drops items you removed, and
  assigns `sortOrder` (meals grouped by `dayPlanId`, extras as
  `dayPlanId: null`). So "regenerate" after editing the list is a
  normal, non-destructive action.
- **Toggle is a toggle**, not set-true. PATCHing `/purchased` flips it.

## 8. Build & deploy

- **Frontend** lives in `/web` and is built by GitHub Actions
  (`azure-static-web-apps-*.yml`) on every push to `master`. The
  workflow runs the build in `/web`, deploys `/web/dist` to Azure
  Static Web Apps, and **injects `VITE_API_URL`** (the prod API URL) at
  build time. `web/src/api.ts` reads `import.meta.env.VITE_API_URL`.
- **If you keep Vite/React in `/web` outputting to `dist`,** the
  existing CI just works. **If you change framework or output dir,**
  update the SWA workflow's `app_location` / `output_location` and make
  sure the prod API URL still reaches the client at build time (env var
  or equivalent).
- **Local dev:** `cd web && npm run dev` serves on `:5173` and **proxies
  `/api` → `http://localhost:5207`** (the API). So in dev, fetch
  relative `/api/...` and you avoid CORS entirely. Run the API with
  `cd api && dotnet run`.
- **PWA:** installable, `registerType: 'autoUpdate'`, precaches the app
  shell. Keep it installable and offline-tolerant for the shell. Update
  the manifest (name/colors/icons) if you restyle.

## 9. Constraints & gotchas

- **CORS is allowlisted.** The API only accepts browser origins it
  knows: `http://localhost:5173` and the production SWA origin
  (hardcoded in the API's `Program.cs`). Dev avoids this via the Vite
  proxy. If you ever serve the frontend from a *new* origin/port, that
  origin must be added server-side — flag it, don't fight it.
- **No auth = the API is open to anyone with the URL.** Don't build
  login, but also don't add anything that leaks the URL or assumes
  per-user data. There is exactly one shared dataset.
- **Concurrency / live sync.** Two people use Shop at once. The current
  model: optimistic local toggle + a 4s poll of
  `GET .../shopping-items` that reconciles, *preserving* any toggle
  that's still in flight so a poll can't clobber it. Keep a
  concurrency-safe approach (polling is fine; the endpoints are
  idempotent/toggle-based and tolerate it).
- **Backend is small & cheap (B1).** Now has Always On, so no cold
  starts, but keep payloads lean and avoid chatty request storms.
  Polling every ~4s on Shop is the established budget.
- **One string, many chips.** Re-rendering a day's chips from
  `ingredients` must round-trip losslessly through split→join. Watch
  commas inside an item (there are none today — items are short
  reminders — but don't design something that breaks on punctuation).

## 10. Room to grow (design with headroom)

None of these exist yet, but the redesign shouldn't paint them into a
corner. All of them derive from **existing free-text data** (e.g.
`GET /api/weeks` for history) — none needs a new "Meal" entity:

- **Meal autocomplete** from past weeks' meal strings.
- **"Been a while since…"** nudges for favorites you haven't cooked
  lately.
- **Kid voting** on the week's meals.
- **Pescetarian flagging** (Aspen) — a marker on meals, not a new menu.
- **Kids-safe view** — a simplified read-only mode.

Leave space in the layout for a meal to carry a little metadata later
(a tag, a vote count) without a redesign.

## 11. Local dev quickstart

```bash
# Terminal 1 — API (http://localhost:5207)
cd api && dotnet run

# Terminal 2 — web (http://localhost:5173, proxies /api → :5207)
cd web && npm run dev

# Typecheck the frontend
cd web && npx tsc --noEmit
```

Delete `api/mealplanner.db` anytime for a clean local slate (local dev
DB only — production data is separate and must be preserved).

## 12. "Done" looks like

- Feels great one-handed on a phone; the heavy moment (chip entry on
  List) is the smoothest it can be.
- Plan → List → Shop reads as one continuous, fast flow.
- Every tap is instant; sync is invisible.
- All six [hard rules](#5-hard-product-rules-do-not-break) intact and
  the [API contract](#7-backend-contract-fixed) unchanged.
- Tablet looks deliberate; desktop doesn't break.
- Still installable as a PWA, manifest matches the new look.
