using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JobOrchestrator.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddCancelAndErrors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Errors",
                table: "BackgroundJobs",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FailedRows",
                table: "BackgroundJobs",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Errors",
                table: "BackgroundJobs");

            migrationBuilder.DropColumn(
                name: "FailedRows",
                table: "BackgroundJobs");
        }
    }
}
