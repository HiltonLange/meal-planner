using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace MealPlanner.Tests;

public class GenerateTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateClient();

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private record WeekDto(int Id, string StartDate, List<DayDto> Days);
    private record DayDto(int Id, int DayOfWeek, string DayName, string Meal, string Notes, string Ingredients);
    private record ShoppingItemDto(int Id, int WeekId, int? DayPlanId, string Name, bool Purchased, int SortOrder);

    private async Task<WeekDto> GetCurrentWeek()
    {
        var res = await _client.GetAsync("/api/weeks/current");
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<WeekDto>(JsonOpts))!;
    }

    private async Task SetIngredients(int dayId, string ingredients)
    {
        var res = await _client.PatchAsJsonAsync($"/api/days/{dayId}", new { ingredients });
        res.EnsureSuccessStatusCode();
    }

    private async Task<List<ShoppingItemDto>> Generate(int weekId)
    {
        var res = await _client.PostAsync($"/api/weeks/{weekId}/shopping-items/generate", null);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<List<ShoppingItemDto>>(JsonOpts))!;
    }

    private async Task TogglePurchased(int itemId)
    {
        var res = await _client.PatchAsync($"/api/shopping-items/{itemId}/purchased", null);
        res.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Generate_CreatesItems()
    {
        var week = await GetCurrentWeek();
        var sunday = week.Days.First(d => d.DayOfWeek == 0);

        await SetIngredients(sunday.Id, "garlic, bread");
        var items = await Generate(week.Id);

        Assert.Contains(items, i => i.Name == "garlic");
        Assert.Contains(items, i => i.Name == "bread");
    }

    [Fact]
    public async Task Generate_IsIdempotent_NoDuplicates()
    {
        var week = await GetCurrentWeek();
        var monday = week.Days.First(d => d.DayOfWeek == 1);

        await SetIngredients(monday.Id, "tomato, onion");

        var first = await Generate(week.Id);
        var second = await Generate(week.Id);

        // Same count — no duplicates
        Assert.Equal(first.Count, second.Count);
    }

    [Fact]
    public async Task Generate_PreservesPurchased_NoDuplicates()
    {
        var week = await GetCurrentWeek();
        var tuesday = week.Days.First(d => d.DayOfWeek == 2);

        await SetIngredients(tuesday.Id, "cheese, lettuce");

        var items = await Generate(week.Id);
        var cheese = items.First(i => i.Name == "cheese");

        // Purchase cheese
        await TogglePurchased(cheese.Id);

        // Regenerate
        var after = await Generate(week.Id);

        // Cheese should appear exactly once and still be purchased
        var cheeseItems = after.Where(i => i.Name == "cheese").ToList();
        Assert.Single(cheeseItems);
        Assert.True(cheeseItems[0].Purchased);
    }

    [Fact]
    public async Task Generate_RemovesOrphanedUnpurchased()
    {
        var week = await GetCurrentWeek();
        var wednesday = week.Days.First(d => d.DayOfWeek == 3);

        await SetIngredients(wednesday.Id, "butter, cream");
        await Generate(week.Id);

        // Remove butter
        await SetIngredients(wednesday.Id, "cream");
        var after = await Generate(week.Id);

        Assert.DoesNotContain(after, i => i.Name == "butter");
        Assert.Contains(after, i => i.Name == "cream");
    }

    [Fact]
    public async Task Generate_DedupesSameIngredientTwice()
    {
        var week = await GetCurrentWeek();
        var thursday = week.Days.First(d => d.DayOfWeek == 4);

        await SetIngredients(thursday.Id, "salt, salt, pepper");
        var items = await Generate(week.Id);

        var saltItems = items.Where(i => i.Name == "salt" && i.DayPlanId == thursday.Id).ToList();
        Assert.Single(saltItems);
    }
}
