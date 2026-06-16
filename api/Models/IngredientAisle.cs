namespace MealPlanner.Api.Models;

// Learned mapping: a normalized ingredient name -> store aisle key.
// Family-scoped (shared across the household, not per-week). Written every
// time the user assigns/confirms an aisle on the Shop screen, so the store
// walk order gets smarter over time. This is the one genuinely-new persisted
// piece of the "learning layer" — clusters/hints are derived from history.
public class IngredientAisle
{
    public int Id { get; set; }
    public string Name { get; set; } = "";   // normalized ingredient name (unique)
    public string Aisle { get; set; } = "";   // aisle key: produce/bakery/meat/dairy/pantry/frozen/other
}
