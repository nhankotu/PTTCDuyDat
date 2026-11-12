using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ContractsController : ControllerBase
{
    private readonly FinanceDbContext _dbContext;

    public ContractsController(FinanceDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResultDto<object>>> GetContracts([FromQuery] ContractFilterDto filter)
    {
        var query = _dbContext.Contracts.AsNoTracking();

        if (filter.BatchId > 0)
        {
            query = query.Where(c => c.BatchId == filter.BatchId);
        }

        if (!string.IsNullOrWhiteSpace(filter.Branch))
        {
            query = query.Where(c => c.SaleBranch == filter.Branch || c.TransactionOffice == filter.Branch);
        }

        if (!string.IsNullOrWhiteSpace(filter.ProductGroup))
        {
            query = query.Where(c => c.ProductGroup == filter.ProductGroup);
        }

        if (!string.IsNullOrWhiteSpace(filter.TermGroup))
        {
            query = query.Where(c => c.TermGroup == filter.TermGroup);
        }

        if (!string.IsNullOrWhiteSpace(filter.DsType))
        {
            query = query.Where(c => c.DsType == filter.DsType);
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            query = query.Where(c => c.Status == filter.Status);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim().ToLower();
            query = query.Where(c => 
                (c.CustomerName != null && c.CustomerName.ToLower().Contains(s)) ||
                (c.CustomerCode != null && c.CustomerCode.ToLower().Contains(s)) ||
                c.AppendixNumber.ToLower().Contains(s) ||
                (c.FinalSaleName != null && c.FinalSaleName.ToLower().Contains(s))
            );
        }

        var total = await query.CountAsync();

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);

        var data = await query
            .OrderByDescending(c => c.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id,
                c.Stt,
                c.AppendixNumber,
                c.ContractNumber,
                c.CustomerCode,
                c.CustomerName,
                c.ProductGroup,
                c.ProductNameRaw,
                c.TermRaw,
                c.TermGroup,
                c.ContractValue,
                c.SignDate,
                c.ExpireDate,
                c.Status,
                c.DsType,
                c.SaleBranch,
                c.FinalSaleName,
                c.BalanceCurrent
            })
            .ToListAsync();

        return Ok(new PagedResultDto<object>
        {
            Page = page,
            PageSize = pageSize,
            TotalRows = total,
            Data = data.Cast<object>().ToList()
        });
    }
}
