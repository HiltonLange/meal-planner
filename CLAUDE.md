# CLAUDE.md

Working notes for Claude when assisting on this repo.

## What this project is

Mobile-first PWA for weekly family meal planning. Three-phase UX —
**Plan** (pick meals Sun–Sat), **List** (capture ingredients per meal +
staples), **Shop** (unified checklist with 4s polling for concurrent
use). See `README.md` for the full context.

## Design rules — do not break these without asking

- **Meals are free text.** Do not introduce a `Meal` entity or lookup
  table. Autocomplete from history will come later, but the source of
  truth stays `DayPlan.Meal` as a string.
- **No quantities on ingredients.** They are reminder strings.
- **Week is the unit.** Everything is scoped to a week. Don't introduce
  day-detail navigation.
- **Saturday is optional.** The day exists, but it's rendered muted and
  the placeholder hints "takeouts?". Don't make it mandatory.
- **No auth yet.** Don't add login flows. The app relies on the URL
  being unguessable.
- **The backend is a single `Program.cs`.** Keep routes inline —
  don't extract controllers or a service layer unless the file gets
  genuinely unreadable.

## Pre-real-use rules

The user is not using the app for real yet. This means:

- **Blow away data freely.** Dropping `mealplanner.db`, rewriting
  schema, regenerating migrations — all fair game. Prefer a clean reset
  over backcompat shims.
- **No defensive "handle legacy shape" branches.** If you wrote a
  backfill for data that shouldn't exist anymore, delete it.
- **This changes the day Hilton says he's using it for real.** Switch
  modes and start preserving data at that point.

## Collaboration preferences

- **Hilton is a C# backend engineer.** He's fluent on the API side, less
  so on the React/Tailwind side — frame frontend work in terms of what
  it does rather than idiomatic React jargon when it matters.
- **Prefers simple, pragmatic solutions that ramp up.** Don't
  preemptively introduce abstractions, layers, or config for
  hypothetical needs.
- **Confirm before `git push`.** Committing locally is fine without
  confirmation; pushing to `origin` needs explicit approval each time
  (a single approval covers the push in front of you, not future ones).
- **Testing on phone**: his primary device is Android. For UI changes,
  consider whether touch targets and phone viewports still work.
- **Family context:** wife + kids; daughter Aspen is pescetarian (no
  meat, eats fish). Kids are in Bellevue Youth Theater (BYT), which
  is why "BYT — kids out 8pm" appears as a notes placeholder.

## Deployment

Full recipe in `DEPLOY.md`. Two things that burned time once and
shouldn't burn time again:

1. **The API is in the Visual Studio Enterprise subscription**, not the
   Microsoft corp subscription Hilton's `az` login defaults to. Run
   `az account set --subscription 4d5f5be2-3e19-45b2-99d3-cddcdb3b2e37`
   first or nothing will be visible.
2. **Never zip the publish folder with PowerShell `Compress-Archive`.**
   It produces Windows-backslash entries that break Kudu's Linux rsync
   with `Invalid argument (22)` and a 400 deploy. Use Python's
   `zipfile` module (snippet in `DEPLOY.md`) or any tool that writes
   forward-slash arc paths.

## Tech-debt / TODO triggers

Look at open GitHub issues labeled `tech-debt` and `enhancement` for
the current backlog. Highlights:

- API has no CI, no health check, no App Insights, no HTTPS redirect,
  and its SQLite DB lives on ephemeral App Service disk.
- CORS origins are hardcoded in `Program.cs`.
- No tests anywhere yet.

Don't fix all of these proactively — they're tracked deliberately.
Tackle them when Hilton asks or when one is blocking the current task.

## Commands

```bash
# Frontend typecheck
cd web && npx tsc --noEmit

# Backend build
cd api && dotnet build

# Local dev (two terminals)
cd api && dotnet run                       # http://localhost:5207
cd web && npm run dev                      # http://localhost:5173 (proxies /api)
```
