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
// Idempotent: reconciles shopping items against current ingredients + staples.
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

    var staples = await db.Staples.OrderBy(s => s.AddedDate).ToListAsync();
    foreach (var staple in staples)
    {
        var key = (DayPlanId: (int?)null, staple.Name.Trim().ToLowerInvariant());
        if (seen.Add(key))
            desired.Add((null, staple.Name));
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

// --- Staples ---

app.MapGet("/api/staples", async (AppDbContext db) =>
    Results.Ok(await db.Staples.OrderBy(s => s.AddedDate).ToListAsync()));

app.MapPost("/api/staples", async (StapleRequest req, AppDbContext db) =>
{
    var item = new StapleItem { Name = req.Name };
    db.Staples.Add(item);
    await db.SaveChangesAsync();
    return Results.Created($"/api/staples/{item.Id}", item);
});

app.MapDelete("/api/staples/{id:int}", async (int id, AppDbContext db) =>
{
    var item = await db.Staples.FindAsync(id);
    if (item is null) return Results.NotFound();
    db.Staples.Remove(item);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.Run();

// --- Helpers ---

static DateOnly GetCurrentSunday() => ToSunday(DateOnly.FromDateTime(DateTime.Now));

static DateOnly ToSunday(DateOnly date) => date.AddDays(-(int)date.DayOfWeek);

static async Task<Week> GetOrCreateWeek(AppDbContext db, DateOnly sunday)
{
    var week = await db.Weeks.Include(w => w.Days).FirstOrDefaultAsync(w => w.StartDate == sunday);
    if (week is null)
    {
        week = new Week { StartDate = sunday };
        week.Days = Enumerable.Range(0, 7).Select(i => new DayPlan { DayOfWeek = i }).ToList();
        db.Weeks.Add(week);
        await db.SaveChangesAsync();
        return week;
    }

    // Backfill any missing days (e.g. legacy weeks created with only Sun–Fri)
    var present = week.Days.Select(d => d.DayOfWeek).ToHashSet();
    var missing = Enumerable.Range(0, 7).Where(i => !present.Contains(i)).ToList();
    if (missing.Count > 0)
    {
        foreach (var dow in missing)
            week.Days.Add(new DayPlan { DayOfWeek = dow, WeekId = week.Id });
        await db.SaveChangesAsync();
    }
    return week;
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

// --- DTOs ---

record WeekDto(int Id, DateOnly StartDate, List<DayDto> Days);
record DayDto(int Id, int DayOfWeek, string DayName, string Meal, string Notes, string Ingredients);
record DayPatchRequest(string? Meal, string? Notes, string? Ingredients);
record StapleRequest(string Name);

// Allow WebApplicationFactory to reference the entry point
public partial class Program { }
