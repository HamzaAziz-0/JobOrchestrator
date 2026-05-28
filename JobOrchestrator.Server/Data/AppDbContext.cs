using Microsoft.EntityFrameworkCore;
using JobOrchestrator.Server.Models;

namespace JobOrchestrator.Server.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<BackgroundJob> BackgroundJobs => Set<BackgroundJob>();
}