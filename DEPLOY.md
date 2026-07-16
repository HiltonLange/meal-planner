# Deploy notes

## Azure resources

All resources live in the **Visual Studio Enterprise Subscription**
(`4d5f5be2-3e19-45b2-99d3-cddcdb3b2e37`, tenant `7e3d121e-7da9-47e4-a7eb-db92a445471d`) —
*not* the corp `hilange@microsoft.com` default. Switch with:

```bash
az account set --subscription 4d5f5be2-3e19-45b2-99d3-cddcdb3b2e37
```

| Component | Resource | RG | URL |
|---|---|---|---|
| Frontend (PWA) | Static Web App `green-pebble-0bad19b10` | (SWA-managed) | https://green-pebble-0bad19b10.1.azurestaticapps.net |
| API (.NET 9) | App Service `hilton-meal-planner-api` (**Windows**, dotnet:9) | `meal-planner-rg` | https://hilton-meal-planner-api.azurewebsites.net |
| Data | SQLite file on App Service **persistent** storage (`/home/data/mealplanner.db`) | `meal-planner-rg` | — |

### Storage / persistence (verified 2026-06-14)

The DB path is **not** the relative `mealplanner.db` in `appsettings.json`.
Production overrides it via an App Service **connection string** setting:

```
DefaultConnection = "Data Source=/home/data/mealplanner.db"   (type: Custom)
```

`/home` on App Service is persistent (backed by Azure Files/SMB), shared
across instances and **survives restarts, deploys, and scale operations**.
So the DB is *not* wiped on deploy — it holds real weekly data now.

Two consequences worth remembering:

- **SQLite WAL mode breaks on `/home`** (WAL uses mmap, which fails over
  SMB). `Program.cs` forces `PRAGMA journal_mode=DELETE;` on startup to
  avoid this. Don't switch it back to WAL.
- **There are no backups.** Persistent ≠ backed up. A bad migration,
  file corruption, or deleting the plan loses everything. A periodic
  copy of `mealplanner.db` to Blob storage is the obvious next step
  (not yet done).

App Service Plan: **F1 Free** (`meal-planner-free-plan`, Windows), 1
instance. Moved off the paid B1 Basic (~$13/mo) on 2026-07-16 to the free
tier. `httpsOnly` is off. **Always On is unavailable on F1** — the app
cold-starts after ~20 min idle (Kudu/SCM can be slow to wake). F1 also
caps CPU at 60 min/day and storage at 1 GB, which is comfortably within
this app's usage.

> Note: Azure App Service on **Linux** has no free tier (B1 is the floor),
> which is why the free-tier move required switching the app to a
> **Windows** plan. The app can't change OS in place, so it was deleted
> and recreated under the same name (hostname preserved); the SQLite DB
> was backed up from `/home/data` and restored onto the new instance.

## Frontend deploy

Automatic via GitHub Actions (`.github/workflows/azure-static-web-apps-*.yml`)
on every push to `master`. The workflow injects
`VITE_API_URL=https://hilton-meal-planner-api.azurewebsites.net` at build
time so `web/src/api.ts` points at production.

## API deploy (automatic via CI/CD)

The API deploys **automatically** via GitHub Actions
(`.github/workflows/api-ci.yml`) on every push to `master` that touches
`api/**`, `tests/**`, or the workflow file. The job restores, builds,
runs the tests, then publishes and deploys to App Service using the
`AZURE_WEBAPP_PUBLISH_PROFILE` secret. EF migrations run on app startup,
so a schema change ships by merging to `master` — no manual step.

Watch a run: `gh run list --workflow=api-ci.yml` /
`gh run watch <id>`. Note the API is **F1 Free (no Always On)**, so after
deploy the first request cold-starts (Kudu/SCM can be slow to wake).

### Manual deploy (fallback only — normally unnecessary)

If CI is down and you must push by hand, run from `api/`:

```bash
rm -rf publish publish.zip
dotnet publish -c Release -o publish

# Use Python to zip — NOT PowerShell Compress-Archive (see gotcha below)
python -c "
import os, zipfile
with zipfile.ZipFile('publish.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for dirpath, _, files in os.walk('publish'):
        for f in files:
            full = os.path.join(dirpath, f)
            z.write(full, os.path.relpath(full, 'publish').replace(os.sep, '/'))
"

az webapp deploy -g meal-planner-rg -n hilton-meal-planner-api \
    --src-path publish.zip --type zip
```

### Gotcha: don't use `Compress-Archive`

PowerShell's `Compress-Archive` writes zip entries with Windows backslash
separators (`runtimes\linux-x64\native\libe_sqlite3.so`). Kudu extracts
on Linux, sees literal backslashes in filenames, and rsync fails with
`Invalid argument (22)` — the deploy returns a 400 and nothing updates.
Use the Python snippet above, 7-zip, or any tool that writes forward-slash
arc paths.

## CORS

`api/Program.cs` allows only `http://localhost:5173` and the Static Web
Apps production origin. If you ever use a LAN IP for phone testing, add
that origin to the `WithOrigins(...)` list temporarily.
