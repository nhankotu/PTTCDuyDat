using System.Globalization;
using System.Security.Claims;
using System.Text;
using FinanceDashboard.Api.DTOs.V1;
using FinanceDashboard.Api.Services.Reporting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinanceDashboard.Api.Controllers.V1;

[ApiController]
[Route("api/v1/contracts")]
[Authorize]
public class ContractsV1Controller : ControllerBase
{
    private readonly ReportingEngineV2Service _reportingService;

    public ContractsV1Controller(ReportingEngineV2Service reportingService)
    {
        _reportingService = reportingService;
    }

    private int? GetCurrentUserId()
    {
        var str = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("UserId");
        return int.TryParse(str, out var id) ? id : null;
    }

    [HttpGet]
    public async Task<ActionResult<ContractPageResponse>> GetContracts(
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? employeeId = null,
        [FromQuery] string? product = null,
        [FromQuery] Guid? datasetId = null,
        [FromQuery] string? viewEmployeeId = null, [FromQuery] string view = "subtree", [FromQuery] ReportFilters? filters = null)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var today = DateOnly.FromDateTime(DateTime.Today);
        var end = !string.IsNullOrWhiteSpace(toDate) && DateOnly.TryParse(toDate, out var td) ? td : today;
        var start = !string.IsNullOrWhiteSpace(fromDate) && DateOnly.TryParse(fromDate, out var fd) ? fd : new DateOnly(end.Year, end.Month, 1);

        var list = await _reportingService.GetContractsPageAsync(userId.Value, start, end, page, pageSize, employeeId, product, datasetId, viewEmployeeId, view, filters);
        return Ok(list);
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportContracts(
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate,
        [FromQuery] string? employeeId = null,
        [FromQuery] string? product = null,
        [FromQuery] Guid? datasetId = null,
        [FromQuery] string? viewEmployeeId = null, [FromQuery] string view = "subtree", [FromQuery] ReportFilters? filters = null)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var today = DateOnly.FromDateTime(DateTime.Today);
        var end = !string.IsNullOrWhiteSpace(toDate) && DateOnly.TryParse(toDate, out var td) ? td : today;
        var start = !string.IsNullOrWhiteSpace(fromDate) && DateOnly.TryParse(fromDate, out var fd) ? fd : new DateOnly(end.Year, end.Month, 1);

        var list = new List<ContractDetailItemDto>();
        for (var exportPage = 1; ; exportPage++)
        {
            var batch = await _reportingService.GetContractsPageAsync(userId.Value, start, end, exportPage, 10000,
                employeeId, product, datasetId, viewEmployeeId, view, filters);
            list.AddRange(batch.Items);
            if ((long)exportPage * 10000 >= batch.TotalCount) break;
        }

        var sb = new StringBuilder();
        // UTF-8 BOM
        sb.Append('\uFEFF');
        sb.AppendLine("Số phụ lục,Mã KH,Tên khách hàng,Sản phẩm,Kỳ hạn,Ngày ký,Mã Sale,Sale thụ hưởng,Trạng thái,Kênh,Giá trị gốc (VNĐ),Số tiền đã tất toán (VNĐ),Số dư (VNĐ)");

        foreach (var c in list)
        {
            // Escape CSV cell and guard against formula injection
            string Escape(string? val)
            {
                if (string.IsNullOrEmpty(val)) return "\"\"";
                var clean = val.Replace("\"", "\"\"");
                if (clean.StartsWith("=") || clean.StartsWith("+") || clean.StartsWith("-") || clean.StartsWith("@"))
                {
                    clean = "'" + clean;
                }
                return $"\"{clean}\"";
            }

            sb.AppendLine(string.Join(",",
                Escape(c.AppendixNumber),
                Escape(c.CustomerCode),
                Escape(c.CustomerName),
                Escape(c.ProductName),
                Escape(c.Term),
                Escape(c.SignDate),
                Escape(c.SaleId),
                Escape(c.EffectiveSaleId),
                Escape(c.Status),
                Escape(c.Channel),
                Escape(c.ContractValue),
                Escape(c.SettledAmount),
                Escape(c.Balance)
            ));
        }

        await _reportingService.RecordExportAsync(userId.Value, viewEmployeeId, view, datasetId);
        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv; charset=utf-8", $"Hop_Dong_{start:yyyyMMdd}_{end:yyyyMMdd}.csv");
    }
}

[ApiController]
[Route("api/v1/stocks")]
[Authorize]
public class StocksV1Controller : ControllerBase
{
    private readonly ReportingEngineV2Service _reportingService;

    public StocksV1Controller(ReportingEngineV2Service reportingService)
    {
        _reportingService = reportingService;
    }

    private int? GetCurrentUserId()
    {
        var str = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("UserId");
        return int.TryParse(str, out var id) ? id : null;
    }

    [HttpGet]
    public async Task<ActionResult<StockReportResponse>> GetStocks(
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate,
        [FromQuery] Guid? datasetId = null,
        [FromQuery] string? viewEmployeeId = null, [FromQuery] string view = "subtree")
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var today = DateOnly.FromDateTime(DateTime.Today);
        var end = !string.IsNullOrWhiteSpace(toDate) && DateOnly.TryParse(toDate, out var td) ? td : today;
        var start = !string.IsNullOrWhiteSpace(fromDate) && DateOnly.TryParse(fromDate, out var fd) ? fd : new DateOnly(end.Year, end.Month, 1);

        var res = await _reportingService.GetStockReportAsync(userId.Value, start, end, datasetId, viewEmployeeId, view);
        return Ok(res);
    }
}
