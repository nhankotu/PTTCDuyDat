using System.Security.Claims;
using FinanceDashboard.Api.Services.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using FinanceDashboard.Api.Services.Reporting;

namespace FinanceDashboard.Api.Controllers.V1;

public sealed class ScopeExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not ScopeAccessException ex) return;
        context.Result = new ObjectResult(new { code = ex.Code, message = ex.Message }) { StatusCode = ex.StatusCode };
        context.ExceptionHandled = true;
    }
}

[ApiController, Authorize, Route("api/v1/report-filters")]
public class ReportFiltersController(ReportingEngineV2Service reporting) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] DateOnly toDate, [FromQuery] Guid? datasetId = null,
        [FromQuery] string? viewEmployeeId = null, [FromQuery] string view = "subtree")
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return Unauthorized();
        return Ok(await reporting.GetFilterOptionsAsync(id, toDate, datasetId, viewEmployeeId, view));
    }
}

[ApiController, Authorize, Route("api/v1/view-scopes")]
public class ViewScopesController(DataAccessScopeService scopes) : ControllerBase
{
    public class Selection
    {
        public string? ViewEmployeeId { get; set; }
        public string View { get; set; } = "subtree";
        public Guid? DatasetId { get; set; }
    }

    [HttpPost("selection")]
    public async Task<IActionResult> Select([FromBody] Selection selection)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return Unauthorized();
        await scopes.RecordViewSelectionAsync(id, selection.ViewEmployeeId, selection.View, selection.DatasetId);
        return NoContent();
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] Guid? datasetId = null)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return Unauthorized();
        return Ok(await scopes.GetViewNodesAsync(id, datasetId));
    }
}
