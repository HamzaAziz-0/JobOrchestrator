namespace JobOrchestrator.Server.Models;

public enum JobStatus
{
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled
}

public class BackgroundJob
{
    public int Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public int TotalRows { get; set; }
    public int ProcessedRows { get; set; }
    public int FailedRows { get; set; }
    public string? Errors { get; set; }
    public JobStatus Status { get; set; } = JobStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}