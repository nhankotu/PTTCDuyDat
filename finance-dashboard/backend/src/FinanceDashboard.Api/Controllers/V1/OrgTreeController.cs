using System.Security.Claims;
using FinanceDashboard.Api.DTOs.V1;
using FinanceDashboard.Api.Services.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinanceDashboard.Api.Controllers.V1;

[ApiController]
[Route("api/v1/org-tree")]
[Authorize]
public class OrgTreeController : ControllerBase
{
    private readonly DataAccessScopeService _scopeService;
    private readonly ILogger<OrgTreeController> _logger;

    public OrgTreeController(DataAccessScopeService scopeService, ILogger<OrgTreeController> logger)
    {
        _scopeService = scopeService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<OrgTreeNodeDto>>> GetOrgTree([FromQuery] string? asOfDate,
        [FromQuery] Guid? datasetId = null, [FromQuery] string? viewEmployeeId = null,
        [FromQuery] string view = "subtree")
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("UserId");
        if (!int.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        DateOnly? targetDate = null;
        if (!string.IsNullOrWhiteSpace(asOfDate) && DateOnly.TryParse(asOfDate, out var d))
        {
            targetDate = d;
        }

        var tree = await _scopeService.GetOrgTreeAsync(userId, targetDate, datasetId, viewEmployeeId, view);
        return Ok(tree);
    }

    [HttpPut("{employeeId}/manager")]
    public async Task<IActionResult> ReparentManager(
        string employeeId,
        [FromBody] ReparentManagerRequest request)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin")
        {
            return Forbid();
        }

        var username = User.Identity?.Name ?? "system";

        try
        {
            await _scopeService.ReparentManagerAsync(
                employeeId,
                request.NewManagerEmployeeId,
                request.EffectiveDate,
                request.Reason,
                username);

            return Ok(new { message = $"Đã cập nhật quản lý mới cho nhân sự {employeeId} thành công." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { code = "INVALID_ARGUMENT", message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { code = "NOT_FOUND", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { code = "CYCLE_DETECTED", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi reparent nhân sự {EmployeeId}", employeeId);
            return StatusCode(500, new { code = "INTERNAL_SERVER_ERROR", message = "Lỗi khi cập nhật cây nhân sự." });
        }
    }
}
