using Microsoft.EntityFrameworkCore;
using MealPlanner.Api.Models;

namespace MealPlanner.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Week> Weeks => Set<Week>();
    public DbSet<DayPlan> DayPlans => Set<DayPlan>();
    public DbSet<ExtraItem> Extras => Set<ExtraItem>();
    public DbSet<ShoppingItem> ShoppingItems => Set<ShoppingItem>();
    public DbSet<IngredientAisle> IngredientAisles => Set<IngredientAisle>();
    public DbSet<MealAlias> MealAliases => Set<MealAlias>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Week>()
            .HasMany(w => w.Days)
            .WithOne(d => d.Week)
            .HasForeignKey(d => d.WeekId)
            .OnDelete(DeleteBehavior.Cascade);

        // One week per start date — guards against concurrent GetOrCreate races
        // (e.g. two clients, or StrictMode's double-fired load) creating dupes.
        modelBuilder.Entity<Week>()
            .HasIndex(w => w.StartDate).IsUnique();

        modelBuilder.Entity<ExtraItem>()
            .HasOne(e => e.Week)
            .WithMany()
            .HasForeignKey(e => e.WeekId)
            .OnDelete(DeleteBehavior.Cascade);

        // Learned-correction lookups are keyed by their normalized string.
        modelBuilder.Entity<IngredientAisle>()
            .HasIndex(i => i.Name).IsUnique();
        modelBuilder.Entity<MealAlias>()
            .HasIndex(a => a.Alias).IsUnique();
    }
}
