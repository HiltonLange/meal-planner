# Meal Planner

A mobile-first PWA for weekly family meal planning. Replaces the "meals
on a Google Sheet / ingredients on a whiteboard / write 1 next to items
you bought" workflow the Lange family was using.

Live: https://green-pebble-0bad19b10.1.azurestaticapps.net

## Why

Google Sheets on a phone is painful — the keyboard covers columns, long
ingredient lists overflow, and shopping tracking is a game of "write 1
next to this line". This app is built around the three things that
actually happen each week:

1. **Plan** — figure out what we're eating Sun through Sat.
2. **List** — capture what we need to pick up for each meal, plus staples.
3. **Shop** — walk through the store ticking items off, with live sync
   so my wife and I can split up and both check things off from our
   own phones.

The UX reflects that as three phases, swapped via a bottom tab bar.

## Design rules

- **Everything is free text.** A meal is a string — "Ivars", "takeouts",
  "pasta bolognese". No meal entity in the DB. Ingredients are reminder
  strings, no quantities.
- **Week is the primary unit.** All 7 days are visible inline. Saturday
  is rendered as optional since we often do takeouts.
- **No auth.** The app has two users on a private URL. If this ever goes
  beyond our family, auth becomes the first problem to fix.
- **Starts simple, evolves.** The deferred features (meal history,
  favourites, kid voting) all come later once we know what actually
  hurts in daily use. See the GitHub issues labeled
  [`enhancement`](https://github.com/HiltonLange/meal-planner/issues).

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind + `vite-plugin-pwa` |
| Backend | ASP.NET Core 9 Minimal API + EF Core + SQLite |
| Hosting | Azure Static Web Apps (frontend) + Azure App Service (API) |
| CI | GitHub Actions for frontend; API deployed manually (see `DEPLOY.md`) |

## Repo layout

```
api/                 .NET Minimal API
  Program.cs         All routes + helpers (intentionally single-file)
  Data/              EF Core DbContext
  Models/            Week, DayPlan, StapleItem, ShoppingItem
  Migrations/        EF Core migrations
web/                 Vite + React PWA
  src/
    App.tsx          Top-level week state + bottom tab bar
    api.ts           Fetch wrappers around the API
    types.ts         DTO mirrors of the API shapes
    components/
      WeekView.tsx   Phase 1: plan day-by-day meals
      DayCard.tsx    Compact per-day input (meal + collapsible notes)
      ListBuilder.tsx Phase 2: capture ingredients per meal + staples
      ShoppingList.tsx Phase 3: unified checklist with 4s polling
DEPLOY.md            Azure resources + manual API publish recipe
CLAUDE.md            Working notes for Claude-assisted development
```

## Local dev

```bash
# Terminal 1 — API (http://localhost:5207)
cd api
dotnet run

# Terminal 2 — frontend (http://localhost:5173, proxies /api to the API)
cd web
npm install
npm run dev
```

The frontend dev server proxies `/api/*` to `localhost:5207` via
`vite.config.ts`, so you don't need to set `VITE_API_URL` for local work.

### Testing on a phone over LAN

1. Find your PC's LAN IP: `ipconfig` → IPv4 on Wi-Fi adapter.
2. API: `dotnet run --urls=http://0.0.0.0:5207`
3. Frontend: `VITE_API_URL=http://<lan-ip>:5207 npx vite --host 0.0.0.0`
4. Temporarily add `http://<lan-ip>:5173` to the CORS `WithOrigins(...)`
   list in `api/Program.cs`.
5. Open `http://<lan-ip>:5173` on the phone (same Wi-Fi).
6. Windows Firewall will prompt the first time — allow on private.

## Deploying

See `DEPLOY.md`. Frontend auto-deploys on push to `master`. API is
currently a manual `dotnet publish` + `az webapp deploy` — wiring up CI
for the API is tracked in [#1](https://github.com/HiltonLange/meal-planner/issues).

## Status

The app is in its infancy. The database can and does get wiped between
iterations — no backcompat needed yet. Once I'm actually using it
regularly we'll switch to preserving data.
