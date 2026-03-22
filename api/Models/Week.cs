namespace MealPlanner.Api.Models;

public class Week
{
    public int Id { get; set; }
    public DateOnly StartDate { get; set; } // Always a Sunday
    public List<DayPlan> Days { get; set; } = [];
}
