using System.Text;
using Dapper;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

// Configure Dapper Underscore matching and DateOnly handlers (R03, R04)
DefaultTypeMap.MatchNamesWithUnderscores = true;
SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());
SqlMapper.AddTypeHandler(new NullableDateOnlyTypeHandler());

var builder = WebApplication.CreateBuilder(args);

// Add Database Context
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=5432;Database=finra_finance;Username=finra_admin;Password=finra_secret_pass_2026";

builder.Services.AddDbContext<FinanceDbContext>(options =>
    options.UseNpgsql(connectionString));

// Add Dapper DB Factory
builder.Services.AddSingleton<DbConnectionFactory>();
builder.Services.AddSingleton<IDbConnectionFactory>(sp => sp.GetRequiredService<DbConnectionFactory>());

// Add Application Services
builder.Services.AddScoped<IExcelImportService, ExcelImportService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IOrgTreeService, OrgTreeService>();
builder.Services.AddSingleton<IStorageService, LocalStorageService>();

// Add V1 Versioned Services
builder.Services.AddScoped<FinanceDashboard.Api.Services.Import.ExcelImportV2Service>();
builder.Services.AddScoped<FinanceDashboard.Api.Services.Authorization.DataAccessScopeService>();
builder.Services.AddScoped<FinanceDashboard.Api.Services.Reporting.ReportingEngineV2Service>();

// Add CORS for Frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Add Controllers
builder.Services.AddControllers(options => options.Filters.Add<FinanceDashboard.Api.Controllers.V1.ScopeExceptionFilter>());

// Add JWT Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "Finra_Super_Secret_Key_For_Jwt_Auth_2026_Minimum_32_Chars!";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        };
    });

// Enforce authentication by default on all endpoints (R01)
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// Add Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Finra Financial Dashboard API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Nhập JWT token theo dạng: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Enable Swagger in both Dev and Prod for local Docker
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Finra API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Health check endpoint (AllowAnonymous)
app.MapGet("/api/health", () => Results.Ok(new { status = "Healthy", time = DateTime.UtcNow }))
   .AllowAnonymous();

app.Run();
