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

    [HttpGet("export-excel")]
    public async Task<IActionResult> ExportContractsExcel(
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
        sb.AppendLine("<!DOCTYPE html>");
        sb.AppendLine("<html><head><meta charset=\"utf-8\"><style>");
        sb.AppendLine("table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11pt; }");
        sb.AppendLine("th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px; text-align: left; }");
        sb.AppendLine("td { border: 1px solid #cbd5e1; padding: 6px 8px; }");
        sb.AppendLine(".ghost { background-color: #FEF08A !important; }"); // Yellow highlight for ghost contract
        sb.AppendLine(".text-right { text-align: right; }");
        sb.AppendLine(".text-center { text-align: center; }");
        sb.AppendLine("</style></head><body>");
        sb.AppendLine("<table>");
        sb.AppendLine("<thead><tr>");
        sb.AppendLine("<th>Số phụ lục</th><th>Phân loại</th><th>Mã KH</th><th>Tên khách hàng</th><th>Sản phẩm</th><th>Kỳ hạn</th><th>Ngày ký</th><th>Mã Sale</th><th>Sale thụ hưởng</th><th>Trạng thái</th><th>Kênh</th><th class=\"text-right\">Giá trị gốc (VNĐ)</th><th class=\"text-right\">Đã tất toán (VNĐ)</th><th class=\"text-right\">Số dư (VNĐ)</th>");
        sb.AppendLine("</tr></thead><tbody>");

        foreach (var c in list)
        {
            var rowClass = c.IsGhost ? " class=\"ghost\"" : "";
            var ghostLabel = c.IsGhost ? "HỢP ĐỒNG MA" : "Hợp lệ";
            sb.AppendLine($"<tr{rowClass}>");
            sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(c.AppendixNumber)}</td>");
            sb.AppendLine($"<td><b>{System.Net.WebUtility.HtmlEncode(ghostLabel)}</b></td>");
            sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(c.CustomerCode)}</td>");
            sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(c.CustomerName)}</td>");
            sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(c.ProductName)}</td>");
            sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(c.Term)}</td>");
            sb.AppendLine($"<td class=\"text-center\">{System.Net.WebUtility.HtmlEncode(c.SignDate)}</td>");
            sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(c.SaleId)}</td>");
            sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(c.EffectiveSaleId)}</td>");
            sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(c.Status)}</td>");
            sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(c.Channel)}</td>");
            sb.AppendLine($"<td class=\"text-right\">{System.Net.WebUtility.HtmlEncode(c.ContractValue ?? "-")}</td>");
            sb.AppendLine($"<td class=\"text-right\">{System.Net.WebUtility.HtmlEncode(c.SettledAmount ?? "-")}</td>");
            sb.AppendLine($"<td class=\"text-right\">{System.Net.WebUtility.HtmlEncode(c.Balance ?? "-")}</td>");
            sb.AppendLine("</tr>");
        }

        sb.AppendLine("</tbody></table></body></html>");

        await _reportingService.RecordExportAsync(userId.Value, viewEmployeeId, view, datasetId);
        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "application/vnd.ms-excel; charset=utf-8", $"Hop_Dong_{start:yyyyMMdd}_{end:yyyyMMdd}.xls");
    }

    [HttpPost("mark-ghost")]
    public async Task<IActionResult> MarkGhost([FromBody] GhostContractRequest req)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin") return Forbid();

        if (string.IsNullOrWhiteSpace(req.AppendixNumber))
            return BadRequest(new { message = "Số phụ lục không được để trống." });

        var success = await _reportingService.MarkGhostContractAsync(req.AppendixNumber);
        return Ok(new { success, message = $"Đã đánh dấu hợp đồng {req.AppendixNumber} là hợp đồng ma." });
    }

    [HttpPost("unmark-ghost")]
    public async Task<IActionResult> UnmarkGhost([FromBody] GhostContractRequest req)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin") return Forbid();

        if (string.IsNullOrWhiteSpace(req.AppendixNumber))
            return BadRequest(new { message = "Số phụ lục không được để trống." });

        var success = await _reportingService.UnmarkGhostContractAsync(req.AppendixNumber);
        return Ok(new { success, message = $"Đã bỏ đánh dấu hợp đồng ma cho {req.AppendixNumber}." });
    }
}

public class GhostContractRequest
{
    public string AppendixNumber { get; set; } = string.Empty;
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
