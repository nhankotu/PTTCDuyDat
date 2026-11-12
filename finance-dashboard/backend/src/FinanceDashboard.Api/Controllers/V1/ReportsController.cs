using System.Security.Claims;
using FinanceDashboard.Api.DTOs.V1;
using FinanceDashboard.Api.Services.Reporting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinanceDashboard.Api.Controllers.V1;

[ApiController]
[Route("api/v1/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly ReportingEngineV2Service _reportingService;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(ReportingEngineV2Service reportingService, ILogger<ReportsController> logger)
    {
        _reportingService = reportingService;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var str = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("UserId");
        return int.TryParse(str, out var id) ? id : null;
    }

    [HttpGet("kpi")]
    public async Task<ActionResult<KpiReportResponse>> GetKpi(
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate,
        [FromQuery] string? asOfDate,
        [FromQuery] Guid? datasetId,
        [FromQuery] string? employeeId,
        [FromQuery] string? product,
        [FromQuery] string? term,
        [FromQuery] string? viewEmployeeId = null, [FromQuery] string view = "subtree", [FromQuery] ReportFilters? filters = null)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var (start, end, asOf) = ParseDates(fromDate, toDate, asOfDate);

        var res = await _reportingService.GetKpiReportAsync(
            userId.Value, start, end, asOf, datasetId, employeeId, product, term, viewEmployeeId, view, filters);

        return Ok(res);
    }

    [HttpGet("trend")]
    public async Task<ActionResult<List<TrendPointDto>>> GetTrend(
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate,
        [FromQuery] string period = "week",
        [FromQuery] string? employeeId = null,
        [FromQuery] Guid? datasetId = null,
        [FromQuery] string? weekMode = "standard",
        [FromQuery] string? customIntervalsJson = null,
        [FromQuery] string? viewEmployeeId = null, [FromQuery] string view = "subtree", [FromQuery] ReportFilters? filters = null)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var (start, end, _) = ParseDates(fromDate, toDate, null);

        var list = await _reportingService.GetTrendReportAsync(
            userId.Value, start, end, period, employeeId, datasetId, weekMode, customIntervalsJson, viewEmployeeId, view, filters);
        return Ok(list);
    }

    [HttpGet("pivot")]
    public async Task<ActionResult<List<PivotItemDto>>> GetPivot(
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate,
        [FromQuery] string groupBy = "product",
        [FromQuery] string? employeeId = null,
        [FromQuery] Guid? datasetId = null,
        [FromQuery] string? viewEmployeeId = null, [FromQuery] string view = "subtree", [FromQuery] ReportFilters? filters = null)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var (start, end, _) = ParseDates(fromDate, toDate, null);

        var list = await _reportingService.GetPivotReportAsync(userId.Value, start, end, groupBy, employeeId, datasetId, viewEmployeeId, view, filters);
        return Ok(list);
    }

    private static (DateOnly Start, DateOnly End, DateOnly AsOf) ParseDates(
        string? fromDate, string? toDate, string? asOfDate)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var end = !string.IsNullOrWhiteSpace(toDate) && DateOnly.TryParse(toDate, out var td)
            ? td
            : today;

        var start = !string.IsNullOrWhiteSpace(fromDate) && DateOnly.TryParse(fromDate, out var fd)
            ? fd
            : new DateOnly(end.Year, end.Month, 1);

        var asOf = !string.IsNullOrWhiteSpace(asOfDate) && DateOnly.TryParse(asOfDate, out var ad)
            ? ad
            : end;

        return (start, end, asOf);
    }
}
