using System.Net.Http.Json;
using System.Text.Json;

namespace MealPlanner.Tests;

public class LearningTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateClient();
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private record AisleEntry(string Name, string Aisle);
    private record AliasEntry(string Alias, string Canonical);

    private async Task<List<AisleEntry>> GetAisles()
    {
        var res = await _client.GetAsync("/api/ingredient-aisles");
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<List<AisleEntry>>(JsonOpts))!;
    }

    [Fact]
    public async Task PutAisle_CreatesThenUpdates_AndNormalizesKey()
    {
        // Mixed-case + punctuation should normalize to "baby potatoes"
        var put = await _client.PutAsJsonAsync("/api/ingredient-aisles/Baby Potatoes!", new { aisle = "produce" });
        put.EnsureSuccessStatusCode();
        var created = (await put.Content.ReadFromJsonAsync<AisleEntry>(JsonOpts))!;
        Assert.Equal("baby potatoes", created.Name);
        Assert.Equal("produce", created.Aisle);

        var all = await GetAisles();
        Assert.Contains(all, a => a.Name == "baby potatoes" && a.Aisle == "produce");

        // Upsert: same key, new aisle — no duplicate row
        var put2 = await _client.PutAsJsonAsync("/api/ingredient-aisles/baby potatoes", new { aisle = "pantry" });
        put2.EnsureSuccessStatusCode();
        var after = await GetAisles();
        var row = Assert.Single(after, a => a.Name == "baby potatoes");
        Assert.Equal("pantry", row.Aisle);
    }

    [Fact]
    public async Task PostAlias_CreatesThenUpdates_NoDuplicate()
    {
        var post = await _client.PostAsJsonAsync("/api/meal-aliases", new { alias = "Pasta Night", canonical = "Pasta bar" });
        post.EnsureSuccessStatusCode();
        var created = (await post.Content.ReadFromJsonAsync<AliasEntry>(JsonOpts))!;
        Assert.Equal("pasta night", created.Alias);
        Assert.Equal("Pasta bar", created.Canonical);

        // Same alias re-pointed — upsert, not duplicate
        await _client.PostAsJsonAsync("/api/meal-aliases", new { alias = "pasta night", canonical = "Spaghetti" });
        var res = await _client.GetAsync("/api/meal-aliases");
        var all = (await res.Content.ReadFromJsonAsync<List<AliasEntry>>(JsonOpts))!;
        var row = Assert.Single(all, a => a.Alias == "pasta night");
        Assert.Equal("Spaghetti", row.Canonical);
    }

    [Fact]
    public async Task PutAisle_RejectsEmpty()
    {
        var res = await _client.PutAsJsonAsync("/api/ingredient-aisles/garlic", new { aisle = "" });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, res.StatusCode);
    }
}
