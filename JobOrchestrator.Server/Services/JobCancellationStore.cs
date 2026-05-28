using System.Collections.Concurrent;

namespace JobOrchestrator.Server.Services;

public class JobCancellationStore
{
    private readonly ConcurrentDictionary<int, CancellationTokenSource> _tokens = new();

    public CancellationToken GetToken(int jobId)
    {
        var cts = _tokens.GetOrAdd(jobId, _ => new CancellationTokenSource());
        return cts.Token;
    }

    public void Cancel(int jobId)
    {
        if (_tokens.TryGetValue(jobId, out var cts))
        {
            cts.Cancel();
        }
    }

    public void Remove(int jobId)
    {
        _tokens.TryRemove(jobId, out _);
    }
}