using System.Security.Claims;
using Dapper;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs.V1;
using FinanceDashboard.Api.Models.Versioned;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinanceDashboard.Api.Controllers.V1;

[ApiController]
[Route("api/v1/datasets")]
[Authorize]
public class DatasetsV1Controller : ControllerBase
{
    private readonly DbConnectionFactory _db;
    private readonly ILogger<DatasetsV1Controller> _logger;

    public DatasetsV1Controller(DbConnectionFactory db, ILogger<DatasetsV1Controller> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<ReportDataset>>> GetDatasets()
    {
        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        var datasets = (await connection.QueryAsync<ReportDataset>(@"
            SELECT * FROM report_dataset
            WHERE is_published = TRUE
            ORDER BY cutoff_date DESC, created_at DESC;")).ToList();

        return Ok(datasets);
    }

    [HttpPost]
    public async Task<IActionResult> PublishDataset([FromBody] CreateDatasetRequest req)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin")
        {
            return Forbid();
        }

        var username = User.Identity?.Name ?? "system";

        // Validate manifest declaration (R19)
        var requiredTypes = new[] { "APPENDIX", "SETTLEMENT", "STOCK", "EXCEPTION", "EMPLOYEE" };
        var declaredTypes = req.Manifest.Select(m => m.SourceType.ToUpperInvariant()).ToHashSet();
        var missingTypes = requiredTypes.Where(t => !declaredTypes.Contains(t)).ToList();
        if (missingTypes.Count > 0)
        {
            return BadRequest(new
            {
                code = "MANIFEST_INCOMPLETE",
                message = $"Manifest phải khai báo đủ 5 nguồn dữ liệu (hoặc xác nhận không phát sinh). Thiếu: {string.Join(", ", missingTypes)}"
            });
        }

        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        // Validate batches exist and confirmed
        foreach (var m in req.Manifest)
        {
            if (!m.IsConfirmedNoMovement)
            {
                if (!m.SourceBatchId.HasValue || m.SourceBatchId.Value <= 0)
                {
                    return BadRequest(new
                    {
                        code = "INVALID_BATCH_ID",
                        message = $"Nguồn {m.SourceType} không phát sinh phải bật cờ IsConfirmedNoMovement hoặc chỉ định SourceBatchId hợp lệ."
                    });
                }

                var batch = await connection.QueryFirstOrDefaultAsync<SourceBatch>(@"
                    SELECT * FROM source_batch WHERE id = @Id AND source_type = @Type;",
                    new { Id = m.SourceBatchId.Value, Type = m.SourceType.ToUpperInvariant() });

                if (batch == null || batch.Status != "CONFIRMED")
                {
                    return BadRequest(new
                    {
                        code = "BATCH_NOT_CONFIRMED",
                        message = $"Đợt nạp {m.SourceBatchId} của nguồn {m.SourceType} không tồn tại hoặc chưa được xác nhận (CONFIRMED)."
                    });
                }
            }
        }

        using var transaction = connection.BeginTransaction();
        try
        {
            var datasetId = Guid.NewGuid();

            await connection.ExecuteAsync(@"
                INSERT INTO report_dataset (
                    id, dataset_code, title, cutoff_date, coverage_from,
                    coverage_to, is_published, published_at, published_by,
                    previous_dataset_id, amendment_reason, created_at, created_by
                ) VALUES (
                    @Id, @DatasetCode, @Title, @CutoffDate, @CoverageFrom,
                    @CoverageTo, TRUE, now(), @PublishedBy,
                    @PreviousDatasetId, @AmendmentReason, now(), @PublishedBy
                );",
                new
                {
                    Id = datasetId,
                    req.DatasetCode,
                    req.Title,
                    req.CutoffDate,
                    req.CoverageFrom,
                    req.CoverageTo,
                    PublishedBy = username,
                    req.PreviousDatasetId,
                    req.AmendmentReason
                }, transaction);

            foreach (var m in req.Manifest)
            {
                await connection.ExecuteAsync(@"
                    INSERT INTO dataset_source_manifest (
                        dataset_id, source_type, source_batch_id,
                        is_confirmed_no_movement, notes
                    ) VALUES (
                        @DatasetId, @SourceType, @SourceBatchId,
                        @IsConfirmedNoMovement, @Notes
                    );",
                    new
                    {
                        DatasetId = datasetId,
                        m.SourceType,
                        m.SourceBatchId,
                        m.IsConfirmedNoMovement,
                        m.Notes
                    }, transaction);
            }

            transaction.Commit();
            return Ok(new { id = datasetId, message = $"Đã công bố dataset {req.DatasetCode} thành công." });
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            _logger.LogError(ex, "Lỗi khi công bố dataset {Code}", req.DatasetCode);
            return StatusCode(500, new { code = "PUBLISH_FAILED", message = "Không thể công bố dataset: " + ex.Message });
        }
    }
}
