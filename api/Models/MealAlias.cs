namespace MealPlanner.Api.Models;

// Learned synonym: a normalized typed phrase -> the canonical meal name it
// should reuse. NOT a meal entity — no ingredients, no quantities, no
// definition. Just a string->string overlay so that once the user confirms
// "pasta night" means their "Pasta bar", the fuzzy-reuse banner stops nagging
// and it becomes an exact match next time. Clusters themselves are derived
// from DayPlan.Meal history on the client.
public class MealAlias
{
    public int Id { get; set; }
    public string Alias { get; set; } = "";       // normalized typed phrase (unique)
    public string Canonical { get; set; } = "";    // canonical cluster name
}
