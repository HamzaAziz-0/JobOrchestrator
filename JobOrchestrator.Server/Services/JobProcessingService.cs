using CsvHelper;
using JobOrchestrator.Server.Data;
using JobOrchestrator.Server.Hubs;
using JobOrchestrator.Server.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;

namespace JobOrchestrator.Server.Services;

public class JobProcessingService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<JobHub> _hubContext;
    private readonly IBackgroundJobQueue _jobQueue;
    private readonly JobCancellationStore _cancellationStore;

    public JobProcessingService(
        IServiceScopeFactory scopeFactory,
        IHubContext<JobHub> hubContext,
        IBackgroundJobQueue jobQueue,
        JobCancellationStore cancellationStore)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _jobQueue = jobQueue;
        _cancellationStore = cancellationStore;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            int jobId;
            try { jobId = await _jobQueue.DequeueAsync(stoppingToken); }
            catch (OperationCanceledException) { break; }

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var job = await db.BackgroundJobs.FindAsync(jobId);
            if (job == null || job.Status != JobStatus.Pending) continue;

            job.Status = JobStatus.Running;
            await db.SaveChangesAsync(stoppingToken);

            var cancelToken = _cancellationStore.GetToken(job.Id);
            var errors = new List<string>();
            int processed = 0;
            int failed = 0;
            var startTime = DateTime.UtcNow;

            try
            {
                cancelToken.ThrowIfCancellationRequested();

                if (!System.IO.File.Exists(job.FilePath))
                {
                    job.Status = JobStatus.Failed;
                    errors.Add("File not found on server");
                    await db.SaveChangesAsync(stoppingToken);
                    continue;
                }

                using var reader = new StreamReader(job.FilePath, Encoding.UTF8);
                using var csv = new CsvReader(reader, CultureInfo.InvariantCulture);
                int rowNumber = 0;

                // stream CSV row by row
                foreach (var record in csv.GetRecords<dynamic>())
                {
                    cancelToken.ThrowIfCancellationRequested();
                    rowNumber++;

                    var rowDict = (IDictionary<string, object>)record;
                    var rowErrors = ValidateRow(rowDict);
                    bool success = !rowErrors.Any();

                    if (success)
                    {
                        processed++;
                    }
                    else
                    {
                        failed++;
                        errors.Add($"Row {rowNumber}: {string.Join(", ", rowErrors)}");
                    }

                    job.ProcessedRows = processed;
                    job.FailedRows = failed;

                    // Batch SaveChanges every 50 rows
                    if (rowNumber % 50 == 0)
                    {
                        await db.SaveChangesAsync(cancelToken);
                    }

                    // Sending  only current error , not full list
                    await _hubContext.Clients.Group($"job-{job.Id}").SendAsync(
                        "RowProcessed",
                        new
                        {
                            JobId = job.Id,
                            Processed = processed,
                            Failed = failed,
                            Total = job.TotalRows,
                            Status = job.Status.ToString(),
                            LastRow = rowNumber,
                            Success = success,
                            Message = success
                                ? $"Row {rowNumber} processed successfully"
                                : $"Row {rowNumber} failed validation",
                            Timestamp = DateTime.UtcNow,
                            RecentError = success ? null : string.Join(", ", rowErrors)
                        }
                    );
                }

                // Final save after all rows
                await db.SaveChangesAsync(cancelToken);

                job.Status = failed > 0 ? JobStatus.Failed : JobStatus.Completed;
                job.Errors = errors.Count > 0
                    ? System.Text.Json.JsonSerializer.Serialize(errors)
                    : null;
            }
            catch (OperationCanceledException)
            {
                job.Status = JobStatus.Cancelled;
                job.Errors = System.Text.Json.JsonSerializer.Serialize(errors);
            }
            catch (Exception ex)
            {
                job.Status = JobStatus.Failed;
                errors.Add($"Processing error: {ex.Message}");
                job.Errors = System.Text.Json.JsonSerializer.Serialize(errors);
            }
            finally
            {
                _cancellationStore.Remove(job.Id);
                await db.SaveChangesAsync(stoppingToken);

                var endTime = DateTime.UtcNow;
                var duration = endTime - startTime;

                //Final summary with full error list
                await _hubContext.Clients.Group($"job-{job.Id}").SendAsync(
                    "JobCompleted",
                    new
                    {
                        JobId = job.Id,
                        Status = job.Status.ToString(),
                        Processed = processed,
                        Failed = failed,
                        Total = job.TotalRows,
                        Duration = duration.TotalSeconds,
                        Errors = errors.ToList()
                    }
                );
            }
        }
    }

    private List<string> ValidateRow(IDictionary<string, object> row)
    {
        var errors = new List<string>();

        if (row.TryGetValue("email", out var email) && !IsValidEmail(email?.ToString()))
        {
            errors.Add("Invalid email");
        }

        if (row.TryGetValue("age", out var age) && age != null)
        {
            if (!int.TryParse(age.ToString(), out var ageValue))
            {
                errors.Add("Age must be a number");
            }
            else if (ageValue < 0 || ageValue > 150)
            {
                errors.Add("Age must be 0-150");
            }
        }

        if (row.TryGetValue("name", out var name) && string.IsNullOrWhiteSpace(name?.ToString()))
        {
            errors.Add("Name required");
        }

        return errors;
    }

    private bool IsValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email;
        }
        catch
        {
            return false;
        }
    }
}