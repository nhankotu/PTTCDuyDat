using FinanceDashboard.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly FinanceDbContext _dbContext;

    public EmployeesController(FinanceDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult> GetEmployees([FromQuery] string? branch)
    {
        var query = _dbContext.Employees.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(branch))
        {
            query = query.Where(e => e.BranchName == branch);
        }

        var employees = await query
            .OrderBy(e => e.BranchName)
            .ThenBy(e => e.FullName)
            .ToListAsync();

        return Ok(employees);
    }

    [HttpGet("branches")]
    public async Task<ActionResult> GetBranches()
    {
        var branches = await _dbContext.Contracts
            .Where(c => c.SaleBranch != null && c.SaleBranch != "")
            .Select(c => c.SaleBranch!)
            .Distinct()
            .OrderBy(b => b)
            .ToListAsync();

        return Ok(branches);
    }
}
