using System.Security.Claims;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Services;
using FinanceDashboard.Api.Services.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinanceDashboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrgTreeController : ControllerBase
{
    private readonly IOrgTreeService _orgTreeService;
    private readonly DataAccessScopeService _scopeService;

    public OrgTreeController(IOrgTreeService orgTreeService, DataAccessScopeService scopeService)
    {
        _orgTreeService = orgTreeService;
        _scopeService = scopeService;
    }

    [HttpGet]
    public async Task<ActionResult<List<TreeNodeDto>>> GetOrgTree()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("UserId");
        if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();
        var roots = await _scopeService.GetOrgTreeAsync(userId);
        TreeNodeDto Adapt(FinanceDashboard.Api.DTOs.V1.OrgTreeNodeDto item)
        {
            var children = item.Subordinates.Select(Adapt).ToList();
            return new TreeNodeDto
            {
                Id = item.EmployeeId, Label = item.FullName, Position = item.Position,
                Branch = item.Branch, Department = item.Department, Region = item.Region,
                Children = children, DirectSubordinatesCount = children.Count,
                TotalSubordinatesCount = children.Sum(child => child.TotalSubordinatesCount + 1)
            };
        }
        return Ok(roots.Select(Adapt).ToList());
    }

    [Authorize(Roles = "admin")]
    [HttpGet("nodes")]
    public async Task<ActionResult<List<TreeFlatNodeDto>>> GetFlatNodes()
    {
        var nodes = await _orgTreeService.GetFlatNodesAsync();
        return Ok(nodes);
    }

    [Authorize(Roles = "admin")]
    [HttpGet("subordinates")]
    public async Task<ActionResult<List<string>>> GetSubordinates(
        [FromQuery] string scopeType, 
        [FromQuery] string? scopeNodeId)
    {
        var ids = await _orgTreeService.GetSubordinateIdsAsync(scopeType, scopeNodeId);
        return Ok(ids);
    }
}
