namespace MealPlanner.Api.Models;

public class ShoppingItem
{
    public int Id { get; set; }
    public int WeekId { get; set; }
    public int? DayPlanId { get; set; }  // null = extra (non-meal item)
    public string Name { get; set; } = "";
    public bool Purchased { get; set; }
    public int SortOrder { get; set; }
}
