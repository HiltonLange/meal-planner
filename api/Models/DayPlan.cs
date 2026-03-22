namespace MealPlanner.Api.Models;

public class DayPlan
{
    public int Id { get; set; }
    public int WeekId { get; set; }
    public Week Week { get; set; } = null!;

    public int DayOfWeek { get; set; } // 0 = Sunday, 5 = Friday

    public string Meal { get; set; } = "";
    public string Notes { get; set; } = "";
    public string Ingredients { get; set; } = ""; // free text, newline/comma separated
}
