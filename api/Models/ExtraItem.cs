namespace MealPlanner.Api.Models;

// A non-meal item the user wants on this week's list (the old "whiteboard"
// list). Scoped to a single week — starts blank each week, does not carry over.
public class ExtraItem
{
    public int Id { get; set; }
    public int WeekId { get; set; }
    public Week? Week { get; set; }
    public string Name { get; set; } = "";
    public DateTime AddedDate { get; set; } = DateTime.UtcNow;
}
