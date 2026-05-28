using System.Threading.Channels;

namespace JobOrchestrator.Server.Services;

public class ChannelJobQueue : IBackgroundJobQueue
{
    private readonly Channel<int> _channel = Channel.CreateUnbounded<int>();

    public void Enqueue(int jobId) => _channel.Writer.TryWrite(jobId);

    public async Task<int> DequeueAsync(CancellationToken cancellationToken)
    {
        return await _channel.Reader.ReadAsync(cancellationToken);
    }
}