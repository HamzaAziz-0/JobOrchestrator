using Microsoft.AspNetCore.SignalR;

namespace JobOrchestrator.Server.Hubs;

public class JobHub : Hub
{
    public async Task JoinJobGroup(int jobId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"job-{jobId}");
    }

    public async Task LeaveJobGroup(int jobId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"job-{jobId}");
    }
}