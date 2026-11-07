using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace FinanceDashboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("kpi")]
    public async Task<ActionResult<DashboardKpiDto>> GetKpi([FromQuery] int? batchId, [FromQuery] string? branch)
    {
        var kpi = await _dashboardService.GetKpiSummaryAsync(batchId, branch);
        return Ok(kpi);
    }

    [HttpGet("weekly-trend")]
    public async Task<ActionResult<List<WeeklyTrendItemDto>>> GetWeeklyTrend([FromQuery] int? batchId, [FromQuery] string? branch)
    {
        var trend = await _dashboardService.GetWeeklyTrendAsync(batchId, branch);
        return Ok(trend);
    }

    [HttpGet("by-product")]
    public async Task<ActionResult<List<DimensionStatItemDto>>> GetByProduct([FromQuery] int? batchId, [FromQuery] string? branch)
    {
        var stats = await _dashboardService.GetDimensionStatsAsync(batchId, "product", branch);
        return Ok(stats);
    }

    [HttpGet("by-term")]
    public async Task<ActionResult<List<DimensionStatItemDto>>> GetByTerm([FromQuery] int? batchId, [FromQuery] string? branch)
    {
        var stats = await _dashboardService.GetDimensionStatsAsync(batchId, "term", branch);
        return Ok(stats);
    }

    [HttpGet("by-branch")]
    public async Task<ActionResult<List<DimensionStatItemDto>>> GetByBranch([FromQuery] int? batchId)
    {
        var stats = await _dashboardService.GetDimensionStatsAsync(batchId, "branch", null);
        return Ok(stats);
    }

    [HttpGet("statistics")]
    public async Task<ActionResult<List<PeriodGroupStatDto>>> GetMultiDimensionStatistics([FromQuery] MultiDimensionQueryDto query)
    {
        var result = await _dashboardService.GetMultiDimensionStatsAsync(query);
        return Ok(result);
    }
}
