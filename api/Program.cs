using Microsoft.EntityFrameworkCore;
using MealPlanner.Api.Data;
using MealPlanner.Api.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite("Data Source=mealplanner.db"));

builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

// Apply migrations and seed weeks on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

app.UseCors();

// --- Weeks ---

// GET /api/weeks/current  — returns this week (creates it if needed)
app.MapGet("/api/weeks/current", async (AppDbContext db) =>
{
    var sunday = GetCurrentSunday();
    var week = await GetOrCreateWeek(db, sunday);
    return Results.Ok(ToDto(week));
});

// GET /api/weeks  — list all weeks (for history), newest first
app.MapGet("/api/weeks", async (AppDbContext db) =>
{
    var weeks = await db.Weeks
        .Include(w => w.Days)
        .OrderByDescending(w => w.StartDate)
        .ToListAsync();
    return Results.Ok(weeks.Select(ToDto));
});

// GET /api/weeks/{id}
app.MapGet("/api/weeks/{id:int}", async (int id, AppDbContext db) =>
{
    var week = await db.Weeks.Include(w => w.Days).FirstOrDefaultAsync(w => w.Id == id);
    return week is null ? Results.NotFound() : Results.Ok(ToDto(week));
});

// GET /api/weeks/by-date/{date}  — e.g. /api/weeks/by-date/2026-03-22, creates if missing
app.MapGet("/api/weeks/by-date/{date}", async (string date, AppDbContext db) =>
{
    if (!DateOnly.TryParse(date, out var parsed)) return Results.BadRequest("Invalid date");
    var sunday = ToSunday(parsed);
    var week = await GetOrCreateWeek(db, sunday);
    return Results.Ok(ToDto(week));
});

// --- Days ---

// PATCH /api/days/{id}  — update a single day's fields
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

// --- Shopping list ---

// GET /api/weeks/{weekId}/shopping
// Parses ingredient text from all days + active staples into a unified list
app.MapGet("/api/weeks/{weekId:int}/shopping", async (int weekId, AppDbContext db) =>
{
    var week = await db.Weeks.Include(w => w.Days).FirstOrDefaultAsync(w => w.Id == weekId);
    if (week is null) return Results.NotFound();

    var staples = await db.Staples.ToListAsync();

    var dayItems = week.Days
        .Where(d => !string.IsNullOrWhiteSpace(d.Ingredients))
        .SelectMany(d =>
        {
            var dayName = DayName(d.DayOfWeek);
            return ParseIngredients(d.Ingredients)
                .Select(i => new ShoppingItemDto(0, i, false, "day", dayName));
        })
        .ToList();

    var stapleItems = staples
        .Select(s => new ShoppingItemDto(s.Id, s.Name, s.Purchased, "staple", null))
        .ToList();

    return Results.Ok(new { dayItems, stapleItems });
});

// PATCH /api/days/{dayId}/ingredients/{index}/purchased  — toggle a day ingredient
// Since day ingredients are free text, we track purchased state client-side via local storage.
// This endpoint isn't needed — see note in frontend.

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

app.MapPatch("/api/staples/{id:int}/purchased", async (int id, AppDbContext db) =>
{
    var item = await db.Staples.FindAsync(id);
    if (item is null) return Results.NotFound();
    item.Purchased = !item.Purchased;
    await db.SaveChangesAsync();
    return Results.Ok(item);
});

app.MapDelete("/api/staples/{id:int}", async (int id, AppDbContext db) =>
{
    var item = await db.Staples.FindAsync(id);
    if (item is null) return Results.NotFound();
    db.Staples.Remove(item);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Reset all purchased flags (start of new shopping trip)
app.MapPost("/api/staples/reset-purchased", async (AppDbContext db) =>
{
    await db.Staples.Where(s => s.Purchased).ExecuteUpdateAsync(s => s.SetProperty(x => x.Purchased, false));
    return Results.NoContent();
});

app.Run();

// --- Helpers ---

static DateOnly GetCurrentSunday() => ToSunday(DateOnly.FromDateTime(DateTime.Now));

static DateOnly ToSunday(DateOnly date)
{
    var diff = (int)date.DayOfWeek; // DayOfWeek.Sunday == 0
    return date.AddDays(-diff);
}

static async Task<Week> GetOrCreateWeek(AppDbContext db, DateOnly sunday)
{
    var week = await db.Weeks.Include(w => w.Days).FirstOrDefaultAsync(w => w.StartDate == sunday);
    if (week is not null) return week;

    week = new Week { StartDate = sunday };
    week.Days = Enumerable.Range(0, 6).Select(i => new DayPlan { DayOfWeek = i }).ToList();
    db.Weeks.Add(week);
    await db.SaveChangesAsync();
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
    3 => "Wednesday", 4 => "Thursday", 5 => "Friday",
    _ => "?"
};

static IEnumerable<string> ParseIngredients(string text) =>
    text.Split(['\n', ','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(s => !string.IsNullOrWhiteSpace(s))
        .Distinct(StringComparer.OrdinalIgnoreCase);

// --- DTOs / Records ---

record WeekDto(int Id, DateOnly StartDate, List<DayDto> Days);
record DayDto(int Id, int DayOfWeek, string DayName, string Meal, string Notes, string Ingredients);
record DayPatchRequest(string? Meal, string? Notes, string? Ingredients);
record StapleRequest(string Name);
record ShoppingItemDto(int Id, string Name, bool Purchased, string Source, string? DayName);
