using Microsoft.EntityFrameworkCore;
using MealPlanner.Api.Data;
using MealPlanner.Api.Models;
using Azure.Monitor.OpenTelemetry.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Application Insights via OpenTelemetry (reads APPLICATIONINSIGHTS_CONNECTION_STRING from env)
if (!string.IsNullOrEmpty(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]))
    builder.Services.AddOpenTelemetry().UseAzureMonitor();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Data Source=mealplanner.db";

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite(connectionString));

builder.Services.AddCors(opt =>
{
    var origins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? [];
    opt.AddDefaultPolicy(p => p
        .WithOrigins(origins)
        .AllowAnyMethod()
        .AllowAnyHeader());
});

var app = builder.Build();

// Ensure the DB directory exists (e.g. /home/data/ on App Service)
var dbPath = connectionString.Replace("Data Source=", "");
var dbDir = Path.GetDirectoryName(dbPath);
if (!string.IsNullOrEmpty(dbDir))
    Directory.CreateDirectory(dbDir);

// Apply migrations on startup (skip for non-relational providers like InMemory)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (db.Database.IsRelational())
    {
        // WAL journal mode uses mmap which fails on Azure Files (SMB) — use DELETE instead
        db.Database.ExecuteSqlRaw("PRAGMA journal_mode=DELETE;");
        db.Database.Migrate();
    }
    else
    {
        db.Database.EnsureCreated();
    }
}

app.UseCors();

app.MapGet("/", () => Results.Redirect("/api/health"));

// --- Health ---

app.MapGet("/api/health", async (AppDbContext db) =>
{
    try
    {
        await db.Database.CanConnectAsync();
        return Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
    }
    catch
    {
        return Results.Json(
            new { status = "unhealthy", timestamp = DateTime.UtcNow },
            statusCode: 503);
    }
});

// --- Weeks ---

app.MapGet("/api/weeks/current", async (AppDbContext db) =>
{
    var week = await GetOrCreateWeek(db, GetCurrentSunday());
    return Results.Ok(ToDto(week));
});

app.MapGet("/api/weeks", async (AppDbContext db) =>
{
    var weeks = await db.Weeks
        .Include(w => w.Days)
        .OrderByDescending(w => w.StartDate)
        .ToListAsync();
    return Results.Ok(weeks.Select(ToDto));
});

app.MapGet("/api/weeks/{id:int}", async (int id, AppDbContext db) =>
{
    var week = await db.Weeks.Include(w => w.Days).FirstOrDefaultAsync(w => w.Id == id);
    return week is null ? Results.NotFound() : Results.Ok(ToDto(week));
});

app.MapGet("/api/weeks/by-date/{date}", async (string date, AppDbContext db) =>
{
    if (!DateOnly.TryParse(date, out var parsed)) return Results.BadRequest("Invalid date");
    var week = await GetOrCreateWeek(db, ToSunday(parsed));
    return Results.Ok(ToDto(week));
});

// --- Days ---

app.MapPatch("/api/days/{id:int}", async (int id, DayPatchRequest req, AppDbContext db) =>
{
    var day = await db.DayPlans.FindAsync(id);
    if (day is null) return Results.NotFound();

    if (req.Meal is not null) day.Meal = req.Meal;
    if (req.Notes is not null) day.Notes = req.Notes;
    if (req.Ingredients is not null) day.Ingredients = req.Ingredients;

    await db.SaveChangesAsync();
    return Results.Ok(ToDayDto(day));
});

// --- Shopping items ---

// GET /api/weeks/{weekId}/shopping-items — poll this for real-time sync
app.MapGet("/api/weeks/{weekId:int}/shopping-items", async (int weekId, AppDbContext db) =>
{
    var items = await db.ShoppingItems
        .Where(s => s.WeekId == weekId)
        .OrderBy(s => s.SortOrder)
        .ToListAsync();
    return Results.Ok(items);
});

// POST /api/weeks/{weekId}/shopping-items/generate
// Idempotent: reconciles shopping items against current ingredients + extras.
// Purchased items are preserved; duplicates are prevented; orphans are cleaned up.
app.MapPost("/api/weeks/{weekId:int}/shopping-items/generate", async (int weekId, AppDbContext db) =>
{
    var week = await db.Weeks.Include(w => w.Days).FirstOrDefaultAsync(w => w.Id == weekId);
    if (week is null) return Results.NotFound();

    // Build desired set, deduped by (dayPlanId, normalizedName)
    var desired = new List<(int? DayPlanId, string Name)>();
    var seen = new HashSet<(int?, string)>();

    foreach (var day in week.Days.OrderBy(d => d.DayOfWeek))
    {
        foreach (var name in ParseIngredients(day.Ingredients))
        {
            var key = (DayPlanId: (int?)day.Id, name.Trim().ToLowerInvariant());
            if (seen.Add(key))
                desired.Add((day.Id, name));
        }
    }

    var extras = await db.Extras
        .Where(e => e.WeekId == weekId)
        .OrderBy(e => e.AddedDate)
        .ToListAsync();
    foreach (var extra in extras)
    {
        var key = (DayPlanId: (int?)null, extra.Name.Trim().ToLowerInvariant());
        if (seen.Add(key))
            desired.Add((null, extra.Name));
    }

    // Fetch all existing items for this week
    var existing = await db.ShoppingItems
        .Where(s => s.WeekId == weekId)
        .ToListAsync();

    var existingByKey = existing
        .GroupBy(e => (e.DayPlanId, e.Name.Trim().ToLowerInvariant()))
        .ToDictionary(g => g.Key, g => g.ToList());

    var keepItems = new List<ShoppingItem>();
    var deleteItems = new List<ShoppingItem>();

    // For each desired item, keep exactly one existing row (prefer purchased)
    foreach (var (dayPlanId, name) in desired)
    {
        var key = (dayPlanId, name.Trim().ToLowerInvariant());
        if (existingByKey.TryGetValue(key, out var matches))
        {
            var keeper = matches.FirstOrDefault(m => m.Purchased) ?? matches[0];
            keepItems.Add(keeper);
            deleteItems.AddRange(matches.Where(m => m != keeper));
            existingByKey.Remove(key);
        }
        else
        {
            // New item — create it
            var item = new ShoppingItem
            {
                WeekId = weekId,
                DayPlanId = dayPlanId,
                Name = name,
                Purchased = false,
                SortOrder = 0
            };
            db.ShoppingItems.Add(item);
            keepItems.Add(item);
        }
    }

    // Remaining existing items are orphans — delete unpurchased, keep purchased
    foreach (var orphanGroup in existingByKey.Values)
    {
        foreach (var orphan in orphanGroup)
        {
            if (orphan.Purchased)
                keepItems.Add(orphan);
            else
                deleteItems.Add(orphan);
        }
    }

    db.ShoppingItems.RemoveRange(deleteItems);

    // Recompute sort order in canonical sequence
    int order = 0;
    foreach (var item in keepItems)
        item.SortOrder = order++;

    await db.SaveChangesAsync();

    var all = await db.ShoppingItems
        .Where(s => s.WeekId == weekId)
        .OrderBy(s => s.SortOrder)
        .ToListAsync();

    return Results.Ok(all);
});

// PATCH /api/shopping-items/{id}/purchased — toggle
app.MapPatch("/api/shopping-items/{id:int}/purchased", async (int id, AppDbContext db) =>
{
    var item = await db.ShoppingItems.FindAsync(id);
    if (item is null) return Results.NotFound();
    item.Purchased = !item.Purchased;
    await db.SaveChangesAsync();
    return Results.Ok(item);
});

// DELETE /api/shopping-items/{id}
app.MapDelete("/api/shopping-items/{id:int}", async (int id, AppDbContext db) =>
{
    var item = await db.ShoppingItems.FindAsync(id);
    if (item is null) return Results.NotFound();
    db.ShoppingItems.Remove(item);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// POST /api/weeks/{weekId}/shopping-items/reset — uncheck all items
app.MapPost("/api/weeks/{weekId:int}/shopping-items/reset", async (int weekId, AppDbContext db) =>
{
    await db.ShoppingItems
        .Where(s => s.WeekId == weekId && s.Purchased)
        .ExecuteUpdateAsync(s => s.SetProperty(x => x.Purchased, false));
    return Results.NoContent();
});

// --- Extras (per-week non-meal items; the old "staples" whiteboard list) ---

app.MapGet("/api/weeks/{weekId:int}/extras", async (int weekId, AppDbContext db) =>
    Results.Ok(await db.Extras
        .Where(e => e.WeekId == weekId)
        .OrderBy(e => e.AddedDate)
        .ToListAsync()));

app.MapPost("/api/weeks/{weekId:int}/extras", async (int weekId, ExtraRequest req, AppDbContext db) =>
{
    if (!await db.Weeks.AnyAsync(w => w.Id == weekId)) return Results.NotFound();
    var item = new ExtraItem { WeekId = weekId, Name = req.Name };
    db.Extras.Add(item);
    await db.SaveChangesAsync();
    return Results.Created($"/api/extras/{item.Id}", item);
});

app.MapDelete("/api/extras/{id:int}", async (int id, AppDbContext db) =>
{
    var item = await db.Extras.FindAsync(id);
    if (item is null) return Results.NotFound();
    db.Extras.Remove(item);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// --- Learned ingredient -> aisle map (family-scoped; the Shop "learning") ---

app.MapGet("/api/ingredient-aisles", async (AppDbContext db) =>
    Results.Ok(await db.IngredientAisles
        .Select(i => new AisleEntry(i.Name, i.Aisle))
        .ToListAsync()));

// Upsert one correction. Applies to every shopping item with this name on the
// client. Name is normalized so client and server agree on the key.
app.MapPut("/api/ingredient-aisles/{name}", async (string name, AisleRequest req, AppDbContext db) =>
{
    var key = Normalize(name);
    if (string.IsNullOrEmpty(key) || string.IsNullOrWhiteSpace(req.Aisle))
        return Results.BadRequest("name and aisle required");
    var existing = await db.IngredientAisles.FirstOrDefaultAsync(i => i.Name == key);
    if (existing is null)
        db.IngredientAisles.Add(new IngredientAisle { Name = key, Aisle = req.Aisle });
    else
        existing.Aisle = req.Aisle;
    await db.SaveChangesAsync();
    return Results.Ok(new AisleEntry(key, req.Aisle));
});

// --- Learned meal aliases (synonym overlay; NOT a meal entity) ---

app.MapGet("/api/meal-aliases", async (AppDbContext db) =>
    Results.Ok(await db.MealAliases
        .Select(a => new AliasEntry(a.Alias, a.Canonical))
        .ToListAsync()));

app.MapPost("/api/meal-aliases", async (MealAliasRequest req, AppDbContext db) =>
{
    var alias = Normalize(req.Alias);
    if (string.IsNullOrEmpty(alias) || string.IsNullOrWhiteSpace(req.Canonical))
        return Results.BadRequest("alias and canonical required");
    var existing = await db.MealAliases.FirstOrDefaultAsync(a => a.Alias == alias);
    if (existing is null)
        db.MealAliases.Add(new MealAlias { Alias = alias, Canonical = req.Canonical });
    else
        existing.Canonical = req.Canonical;
    await db.SaveChangesAsync();
    return Results.Ok(new AliasEntry(alias, req.Canonical));
});

app.Run();

// --- Helpers ---

static DateOnly GetCurrentSunday() => ToSunday(DateOnly.FromDateTime(DateTime.Now));

static DateOnly ToSunday(DateOnly date) => date.AddDays(-(int)date.DayOfWeek);

static async Task<Week> GetOrCreateWeek(AppDbContext db, DateOnly sunday)
{
    var week = await db.Weeks.Include(w => w.Days).FirstOrDefaultAsync(w => w.StartDate == sunday);
    if (week is not null) return week;

    week = new Week
    {
        StartDate = sunday,
        Days = Enumerable.Range(0, 7).Select(i => new DayPlan { DayOfWeek = i }).ToList(),
    };
    db.Weeks.Add(week);
    try
    {
        await db.SaveChangesAsync();
        return week;
    }
    catch (DbUpdateException)
    {
        // Lost a race with a concurrent create (unique StartDate) — reload the winner.
        db.ChangeTracker.Clear();
        return await db.Weeks.Include(w => w.Days).FirstAsync(w => w.StartDate == sunday);
    }
}

static WeekDto ToDto(Week week) => new(
    week.Id,
    week.StartDate,
    week.Days.OrderBy(d => d.DayOfWeek).Select(ToDayDto).ToList()
);

static DayDto ToDayDto(DayPlan d) => new(d.Id, d.DayOfWeek, DayName(d.DayOfWeek), d.Meal, d.Notes, d.Ingredients);

static string DayName(int dow) => dow switch
{
    0 => "Sunday", 1 => "Monday", 2 => "Tuesday",
    3 => "Wednesday", 4 => "Thursday", 5 => "Friday", 6 => "Saturday",
    _ => "?"
};

static IEnumerable<string> ParseIngredients(string text) =>
    text.Split(['\n', ','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(s => !string.IsNullOrWhiteSpace(s));

// Mirrors the client's normalize(): lowercase, strip to [a-z0-9 ], collapse
// whitespace. A no-op on already-normalized input, so client/server keys agree.
static string Normalize(string? s)
{
    if (string.IsNullOrWhiteSpace(s)) return "";
    var sb = new System.Text.StringBuilder(s.Length);
    var prevSpace = false;
    foreach (var ch in s.Trim().ToLowerInvariant())
    {
        if (ch is (>= 'a' and <= 'z') or (>= '0' and <= '9'))
        {
            sb.Append(ch);
            prevSpace = false;
        }
        else if (char.IsWhiteSpace(ch))
        {
            if (!prevSpace && sb.Length > 0) sb.Append(' ');
            prevSpace = true;
        }
        // any other char is dropped
    }
    return sb.ToString().TrimEnd();
}

// --- DTOs ---

record WeekDto(int Id, DateOnly StartDate, List<DayDto> Days);
record DayDto(int Id, int DayOfWeek, string DayName, string Meal, string Notes, string Ingredients);
record DayPatchRequest(string? Meal, string? Notes, string? Ingredients);
record ExtraRequest(string Name);
record AisleEntry(string Name, string Aisle);
record AisleRequest(string Aisle);
record AliasEntry(string Alias, string Canonical);
record MealAliasRequest(string Alias, string Canonical);

// Allow WebApplicationFactory to reference the entry point
public partial class Program { }
