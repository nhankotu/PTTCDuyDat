using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "admin")]
public class UploadsController : ControllerBase
{
    private readonly IExcelImportService _importService;
    private readonly FinanceDbContext _dbContext;
    private readonly ILogger<UploadsController> _logger;

    public UploadsController(
        IExcelImportService importService,
        FinanceDbContext dbContext,
        ILogger<UploadsController> logger)
    {
        _importService = importService;
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpPost]
    [RequestSizeLimit(100 * 1024 * 1024)] // 100 MB max
    public async Task<ActionResult<UploadResultDto>> UploadExcel(IFormFile file)
    {
        var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (!string.IsNullOrEmpty(role) && role != "admin")
        {
            return StatusCode(403, new { message = "Chỉ Quản trị viên (admin) mới có quyền upload dữ liệu Excel." });
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Vui lòng chọn file Excel để upload." });
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
        {
            return BadRequest(new { message = "Định dạng file không hợp lệ. Chỉ chấp nhận .xlsx hoặc .xls." });
        }

        try
        {
            using var stream = file.OpenReadStream();
            var result = await _importService.ImportExcelAsync(stream, file.FileName, User.Identity?.Name ?? "system");
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing upload for {FileName}", file.FileName);
            return StatusCode(500, new { message = $"Đã xảy ra lỗi khi xử lý file: {ex.Message}" });
        }
    }

    [HttpGet]
    public async Task<ActionResult> GetBatches()
    {
        var batches = await _dbContext.ImportBatches
            .OrderByDescending(b => b.Id)
            .Select(b => new
            {
                b.Id,
                b.FileName,
                b.ReportDate,
                b.TotalRows,
                b.TotalValue,
                b.TotalBalance,
                b.Status,
                b.ErrorMessage,
                b.UploadedBy,
                b.UploadedAt
            })
            .ToListAsync();

        return Ok(batches);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult> GetBatchDetail(int id)
    {
        var batch = await _dbContext.ImportBatches.FindAsync(id);
        if (batch == null) return NotFound(new { message = "Không tìm thấy đợt import này." });
        return Ok(batch);
    }
}
