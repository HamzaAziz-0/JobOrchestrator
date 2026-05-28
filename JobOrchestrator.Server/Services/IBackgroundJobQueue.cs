namespace JobOrchestrator.Server.Services;

public interface IBackgroundJobQueue
{
    void Enqueue(int jobId);
    Task<int> DequeueAsync(CancellationToken cancellationToken);
}