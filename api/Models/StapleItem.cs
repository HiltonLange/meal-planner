namespace MealPlanner.Api.Models;

public class StapleItem
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public bool Purchased { get; set; }
    public DateTime AddedDate { get; set; } = DateTime.UtcNow;
}
