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
| API (.NET 9) | App Service `hilton-meal-planner-api` (Linux, DOTNETCORE\|9.0) | `meal-planner-rg` | https://hilton-meal-planner-api.azurewebsites.net |
| Data | SQLite file on App Service local disk (`mealplanner.db`) | — | — |

Note: the SQLite DB lives on the App Service filesystem and is wiped on
every deploy swap / storage reset. That's fine while the app is in its
infancy — no backcompat needed.

## Frontend deploy

Automatic via GitHub Actions (`.github/workflows/azure-static-web-apps-*.yml`)
on every push to `master`. The workflow injects
`VITE_API_URL=https://hilton-meal-planner-api.azurewebsites.net` at build
time so `web/src/api.ts` points at production.

## API deploy (manual)

No CI wired up yet. Run from `api/`:

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
