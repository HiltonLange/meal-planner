namespace MealPlanner.Api.Models;

public class ShoppingItem
{
    public int Id { get; set; }
    public int WeekId { get; set; }
    public int? DayPlanId { get; set; }  // null = staple
    public string Name { get; set; } = "";
    public bool Purchased { get; set; }
    public int SortOrder { get; set; }
}
