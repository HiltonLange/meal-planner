using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace MealPlanner.Tests;

public class ExtrasTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateClient();

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private record WeekDto(int Id, string StartDate, List<DayDto> Days);
    private record DayDto(int Id, int DayOfWeek, string DayName, string Meal, string Notes, string Ingredients);
    private record ExtraDto(int Id, int WeekId, string Name, string AddedDate);
    private record ShoppingItemDto(int Id, int WeekId, int? DayPlanId, string Name, bool Purchased, int SortOrder);

    private async Task<WeekDto> GetCurrentWeek()
    {
        var res = await _client.GetAsync("/api/weeks/current");
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<WeekDto>(JsonOpts))!;
    }

    private async Task<ExtraDto> AddExtra(int weekId, string name)
    {
        var res = await _client.PostAsJsonAsync($"/api/weeks/{weekId}/extras", new { name });
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<ExtraDto>(JsonOpts))!;
    }

    private async Task<List<ExtraDto>> GetExtras(int weekId)
    {
        var res = await _client.GetAsync($"/api/weeks/{weekId}/extras");
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<List<ExtraDto>>(JsonOpts))!;
    }

    private async Task<List<ShoppingItemDto>> Generate(int weekId)
    {
        var res = await _client.PostAsync($"/api/weeks/{weekId}/shopping-items/generate", null);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<List<ShoppingItemDto>>(JsonOpts))!;
    }

    [Fact]
    public async Task AddExtra_AppearsInGenerate_AsNonMealItem()
    {
        var week = await GetCurrentWeek();
        await AddExtra(week.Id, "paper towels");

        var items = await Generate(week.Id);

        var towels = items.SingleOrDefault(i => i.Name == "paper towels");
        Assert.NotNull(towels);
        Assert.Null(towels!.DayPlanId); // extras are not tied to a meal
    }

    [Fact]
    public async Task Extras_AreScopedToWeek_AndDoNotCarryOver()
    {
        var week = await GetCurrentWeek();
        await AddExtra(week.Id, "dish soap");

        // A different week (created on demand) starts with no extras.
        var otherRes = await _client.GetAsync("/api/weeks/by-date/2020-01-05"); // a Sunday
        otherRes.EnsureSuccessStatusCode();
        var other = (await otherRes.Content.ReadFromJsonAsync<WeekDto>(JsonOpts))!;
        Assert.NotEqual(week.Id, other.Id);

        var otherExtras = await GetExtras(other.Id);
        Assert.Empty(otherExtras);
    }

    [Fact]
    public async Task DeleteExtra_RemovesIt()
    {
        var week = await GetCurrentWeek();
        var extra = await AddExtra(week.Id, "batteries");

        var del = await _client.DeleteAsync($"/api/extras/{extra.Id}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);

        var remaining = await GetExtras(week.Id);
        Assert.DoesNotContain(remaining, e => e.Id == extra.Id);
    }
}
