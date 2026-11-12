using System.Security.Claims;
using FinanceDashboard.Api.DTOs.V1;
using FinanceDashboard.Api.Services.Import;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinanceDashboard.Api.Controllers.V1;

[ApiController]
[Route("api/v1/imports")]
[Authorize]
public class ImportsController : ControllerBase
{
    private readonly ExcelImportV2Service _importService;
    private readonly ILogger<ImportsController> _logger;

    public ImportsController(ExcelImportV2Service importService, ILogger<ImportsController> logger)
    {
        _importService = importService;
        _logger = logger;
    }

    [HttpPost("preview")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ImportPreviewResponse>> Preview(
        IFormFile file,
        [FromForm] string? sourceType,
        [FromForm] string? sourceDate,
        [FromForm] string? effectiveDate)
    {
        // Admin-only check
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin")
        {
            return Forbid();
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { code = "FILE_EMPTY", message = "Vui lòng chọn file Excel để tải lên." });
        }

        var username = User.Identity?.Name ?? "system";
        DateOnly? parsedSourceDate = null;
        if (!string.IsNullOrWhiteSpace(sourceDate) && DateOnly.TryParse(sourceDate, out var sd))
        {
            parsedSourceDate = sd;
        }

        DateOnly? parsedEffectiveDate = null;
        if (!string.IsNullOrWhiteSpace(effectiveDate) && DateOnly.TryParse(effectiveDate, out var ed))
        {
            parsedEffectiveDate = ed;
        }

        try
        {
            using var stream = file.OpenReadStream();
            var req = new ImportPreviewRequest
            {
                SourceType = sourceType,
                SourceDate = parsedSourceDate,
                EffectiveDate = parsedEffectiveDate
            };

            var preview = await _importService.GeneratePreviewAsync(stream, file.FileName, req, username);
            return Ok(preview);
        }
        catch (InvalidOperationException ex)
        {
            return UnprocessableEntity(new { code = "INVALID_EXCEL_STRUCTURE", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi xử lý preview file {FileName}", file.FileName);
            return StatusCode(500, new { code = "INTERNAL_SERVER_ERROR", message = "Đã xảy ra lỗi khi phân tích file Excel." });
        }
    }

    [HttpGet("{previewId:guid}")]
    public async Task<ActionResult<ImportPreviewResponse>> GetPreview(
        Guid previewId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin")
        {
            return Forbid();
        }

        var preview = await _importService.GetPreviewAsync(previewId, page, pageSize);
        if (preview == null)
        {
            return NotFound(new { code = "PREVIEW_NOT_FOUND", message = "Không tìm thấy dữ liệu xem trước." });
        }

        return Ok(preview);
    }

    [HttpPost("{previewId:guid}/confirm")]
    public async Task<ActionResult<ImportConfirmResponse>> Confirm(
        Guid previewId,
        [FromBody] ImportConfirmRequest request)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin")
        {
            return Forbid();
        }

        var username = User.Identity?.Name ?? "system";

        try
        {
            var res = await _importService.ConfirmImportAsync(previewId, request, username);
            return Ok(res);
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
            return Conflict(new { code = "STALE_PREVIEW_OR_CONFLICT", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi confirm preview {PreviewId}", previewId);
            return StatusCode(500, new { code = "CONFIRM_FAILED", message = "Đã xảy ra lỗi khi xác nhận lưu dữ liệu." });
        }
    }
}
