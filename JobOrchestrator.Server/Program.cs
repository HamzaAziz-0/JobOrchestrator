using JobOrchestrator.Server.Data;
using JobOrchestrator.Server.Hubs;
using JobOrchestrator.Server.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")
    ));

builder.Services.AddSingleton<IBackgroundJobQueue, ChannelJobQueue>();
builder.Services.AddSingleton<JobCancellationStore>();

builder.Services.AddHostedService<JobProcessingService>();

builder.Services.AddSignalR();

builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Job Orchestrator API",
        Version = "v1"
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("https://localhost:59839",
                            "https://your-app.vercel.app")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint(
            "/swagger/v1/swagger.json",
            "Job Orchestrator API V1"
        );
    });
}

app.UseCors("AllowAngular");


app.MapControllers();
app.MapHub<JobHub>("/jobhub");

app.Run();