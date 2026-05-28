using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using JobOrchestrator.Server.Data;
using JobOrchestrator.Server.Models;
using JobOrchestrator.Server.Services;
using JobOrchestrator.Server.Hubs;

namespace JobOrchestrator.Server.Controllers;


[ApiController]
[Route("api/[controller]")]
public class JobsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBackgroundJobQueue _jobQueue;
    private readonly IHubContext<JobHub> _hubContext;
    private readonly JobCancellationStore _cancellationStore;

    public JobsController(
        AppDbContext db,
        IBackgroundJobQueue jobQueue,
        IHubContext<JobHub> hubContext,
        JobCancellationStore cancellationStore)
    {
        _db = db;
        _jobQueue = jobQueue;
        _hubContext = hubContext;
        _cancellationStore = cancellationStore;
    }

    [HttpPost]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded.");

        var extension = Path.GetExtension(file.FileName).ToLower();
        if (extension != ".csv")
            return BadRequest("Only CSV files are allowed.");

        var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "Uploads");
        Directory.CreateDirectory(uploadsFolder);
        var filePath = Path.Combine(uploadsFolder, Guid.NewGuid() + ".csv");

        using (var stream = new FileStream(filePath, FileMode.Create))
            await file.CopyToAsync(stream);

        var lineCount = System.IO.File.ReadLines(filePath).Count() - 1;

        var job = new BackgroundJob
        {
            FileName = file.FileName,
            FilePath = filePath,
            TotalRows = lineCount > 0 ? lineCount : 1,
            ProcessedRows = 0,
            FailedRows = 0,
            Status = JobStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _db.BackgroundJobs.Add(job);
        await _db.SaveChangesAsync();

        _jobQueue.Enqueue(job.Id);

        await _hubContext.Groups.AddToGroupAsync(
            HttpContext.Connection.Id,
            $"job-{job.Id}");

        return Ok(new { jobId = job.Id });
    }


    [HttpGet("{id}")]
    public async Task<IActionResult> GetStatus(int id)
    {
        var job = await _db.BackgroundJobs.FindAsync(id);
        if (job == null) return NotFound();

        return Ok(new
        {
            job.Id,
            job.FileName,
            job.TotalRows,
            job.ProcessedRows,
            job.FailedRows,
            job.Status,
            Errors = string.IsNullOrEmpty(job.Errors)
                ? new string[] { }
                : System.Text.Json.JsonSerializer.Deserialize<string[]>(job.Errors)
        });
    }

    [HttpPost("{id}/cancel")]
    public IActionResult Cancel(int id)
    {
        _cancellationStore.Cancel(id);
        return Ok(new { message = "Cancellation requested." });
    }
}