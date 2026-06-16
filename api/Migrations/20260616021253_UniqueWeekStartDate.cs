using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MealPlanner.Api.Migrations
{
    /// <inheritdoc />
    public partial class UniqueWeekStartDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Heal any pre-existing duplicate weeks (created by the GetOrCreate
            // race before this guard existed) so the unique index can apply.
            // For each StartDate, keep the week with the most planned meals
            // (tie-break: lowest Id) and delete the rest plus their dependents.
            migrationBuilder.Sql(@"
                CREATE TEMP TABLE _dup_losers AS
                SELECT Id FROM (
                    SELECT w.Id,
                        ROW_NUMBER() OVER (
                            PARTITION BY w.StartDate
                            ORDER BY (SELECT COUNT(*) FROM DayPlans d
                                      WHERE d.WeekId = w.Id AND TRIM(d.Meal) <> '') DESC,
                                     w.Id ASC
                        ) AS rn
                    FROM Weeks w
                ) WHERE rn > 1;

                DELETE FROM ShoppingItems WHERE WeekId IN (SELECT Id FROM _dup_losers);
                DELETE FROM Extras        WHERE WeekId IN (SELECT Id FROM _dup_losers);
                DELETE FROM DayPlans      WHERE WeekId IN (SELECT Id FROM _dup_losers);
                DELETE FROM Weeks         WHERE Id     IN (SELECT Id FROM _dup_losers);
                DROP TABLE _dup_losers;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_Weeks_StartDate",
                table: "Weeks",
                column: "StartDate",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Weeks_StartDate",
                table: "Weeks");
        }
    }
}
