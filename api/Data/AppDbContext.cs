using Microsoft.EntityFrameworkCore;
using MealPlanner.Api.Models;

namespace MealPlanner.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Week> Weeks => Set<Week>();
    public DbSet<DayPlan> DayPlans => Set<DayPlan>();
    public DbSet<StapleItem> Staples => Set<StapleItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Week>()
            .HasMany(w => w.Days)
            .WithOne(d => d.Week)
            .HasForeignKey(d => d.WeekId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
