using System.Security.Claims;
using Dapper;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs.V1;
using FinanceDashboard.Api.Models.Versioned;
using FinanceDashboard.Api.Services.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinanceDashboard.Api.Controllers.V1;

[ApiController]
[Route("api/v1/permissions")]
[Authorize]
public class PermissionsController : ControllerBase
{
    private readonly DataAccessScopeService _scopeService;
    private readonly DbConnectionFactory _db;
    private readonly ILogger<PermissionsController> _logger;

    public PermissionsController(
        DataAccessScopeService scopeService,
        DbConnectionFactory db,
        ILogger<PermissionsController> logger)
    {
        _scopeService = scopeService;
        _db = db;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var str = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("UserId");
        return int.TryParse(str, out var id) ? id : null;
    }

    [HttpPut("/api/v1/users/{userId:int}/data-access")]
    public async Task<IActionResult> UpdateUserDataAccess(
        int userId,
        [FromBody] UserDataAccessUpdateRequest request)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin")
        {
            return Forbid();
        }

        var username = User.Identity?.Name ?? "system";
        await _scopeService.UpdateUserDataAccessAsync(userId, request, username);
        return Ok(new { message = $"Đã cập nhật phạm vi truy cập dữ liệu cho tài khoản #{userId} thành công." });
    }

    [HttpGet("requests")]
    public async Task<ActionResult<List<AccessRequest>>> GetRequests([FromQuery] string? status)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var role = User.FindFirstValue(ClaimTypes.Role);
        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        IEnumerable<AccessRequest> list;
        if (role == "admin")
        {
            if (!string.IsNullOrEmpty(status))
            {
                list = await connection.QueryAsync<AccessRequest>(@"
                    SELECT * FROM access_request WHERE status = @Status ORDER BY created_at DESC;",
                    new { Status = status });
            }
            else
            {
                list = await connection.QueryAsync<AccessRequest>(@"
                    SELECT * FROM access_request ORDER BY created_at DESC;");
            }
        }
        else
        {
            list = await connection.QueryAsync<AccessRequest>(@"
                SELECT * FROM access_request WHERE requesting_user_id = @UserId ORDER BY created_at DESC;",
                new { UserId = userId });
        }

        return Ok(list.ToList());
    }

    [HttpPost("requests")]
    public async Task<IActionResult> CreateRequest([FromBody] CreateAccessRequestDto dto)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.TargetEmployeeId))
        {
            return BadRequest(new { code = "INVALID_TARGET", message = "Vui lòng chọn nhân sự muốn xem số liệu." });
        }

        var reqId = await _scopeService.CreateAccessRequestAsync(userId.Value, dto);
        return Ok(new { id = reqId, message = "Đã gửi đơn yêu cầu truy cập dữ liệu thành công." });
    }

    [HttpPut("requests/{id:long}/review")]
    public async Task<IActionResult> ReviewRequest(long id, [FromBody] ReviewAccessRequestDto dto)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin")
        {
            return Forbid();
        }

        var username = User.Identity?.Name ?? "system";

        try
        {
            await _scopeService.ReviewAccessRequestAsync(id, dto, username);
            return Ok(new { message = dto.IsApproved ? "Đã phê duyệt đơn thành công." : "Đã từ chối đơn." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { code = "NOT_FOUND", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { code = "INVALID_STATE", message = ex.Message });
        }
    }

    [HttpPost("peer-grants")]
    public async Task<IActionResult> CreatePeerGrant([FromBody] CreatePeerGrantDto dto)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin")
        {
            return Forbid();
        }

        var username = User.Identity?.Name ?? "system";
        var grantId = await _scopeService.CreatePeerGrantAsync(dto, username);
        return Ok(new { id = grantId, message = "Đã cấp quyền truy cập ngang hàng thành công." });
    }

    [HttpDelete("peer-grants/{id:long}")]
    public async Task<IActionResult> RevokePeerGrant(long id, [FromQuery] string? reason)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin")
        {
            return Forbid();
        }

        var username = User.Identity?.Name ?? "system";
        await _scopeService.RevokePeerGrantAsync(id, reason ?? "Thu hồi bởi Admin", username);
        return Ok(new { message = $"Đã thu hồi quyền ngang hàng #{id} thành công." });
    }

    [HttpGet("presets")]
    public async Task<ActionResult<List<PermissionPresetDto>>> GetPresets()
    {
        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        var sql = @"
            SELECT 
                id AS Id,
                name AS Name,
                description AS Description,
                scope_type AS ScopeType,
                scope_node_id AS ScopeNodeId,
                scope_node_name AS ScopeNodeName,
                scope_node_role AS ScopeNodeRole,
                created_at AS CreatedAt,
                created_by AS CreatedBy
            FROM permission_preset
            ORDER BY id ASC;";

        var list = (await connection.QueryAsync<PermissionPresetDto>(sql)).ToList();
        return Ok(list);
    }

    [HttpPost("presets")]
    public async Task<ActionResult> CreatePreset([FromBody] CreatePermissionPresetDto dto)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin") return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Tên bộ quyền mẫu không được để trống." });
        }

        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        var exists = await connection.ExecuteScalarAsync<bool>(
            "SELECT EXISTS(SELECT 1 FROM permission_preset WHERE LOWER(name) = LOWER(@name));",
            new { name = dto.Name.Trim() });

        if (exists)
        {
            return Conflict(new { message = $"Bộ quyền mẫu '{dto.Name}' đã tồn tại." });
        }

        var username = User.Identity?.Name ?? "admin";
        var sql = @"
            INSERT INTO permission_preset (name, description, scope_type, scope_node_id, scope_node_name, scope_node_role, created_by)
            VALUES (@Name, @Description, @ScopeType, @ScopeNodeId, @ScopeNodeName, @ScopeNodeRole, @CreatedBy)
            RETURNING id;";

        var id = await connection.ExecuteScalarAsync<int>(sql, new
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            ScopeType = string.IsNullOrWhiteSpace(dto.ScopeType) ? "ALL" : dto.ScopeType.Trim(),
            ScopeNodeId = dto.ScopeNodeId?.Trim(),
            ScopeNodeName = dto.ScopeNodeName?.Trim(),
            ScopeNodeRole = dto.ScopeNodeRole?.Trim(),
            CreatedBy = username
        });

        return Ok(new { id, message = $"Đã tạo bộ quyền mẫu '{dto.Name}' thành công." });
    }

    [HttpDelete("presets/{id:int}")]
    public async Task<ActionResult> DeletePreset(int id)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin") return Forbid();

        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        var rows = await connection.ExecuteAsync("DELETE FROM permission_preset WHERE id = @id;", new { id });
        if (rows == 0) return NotFound(new { message = "Không tìm thấy bộ quyền mẫu." });

        return Ok(new { message = "Đã xóa bộ quyền mẫu thành công." });
    }

    [HttpPost("bulk-assign")]
    public async Task<ActionResult> BulkAssign([FromBody] BulkAssignScopeRequest req)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin") return Forbid();

        if (req.UserIds == null || req.UserIds.Count == 0)
        {
            return BadRequest(new { message = "Vui lòng chọn ít nhất một người dùng để phân quyền." });
        }

        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        var sql = @"
            UPDATE app_user
            SET 
                scope_type = @ScopeType,
                scope_node_id = @ScopeNodeId,
                scope_node_name = @ScopeNodeName,
                scope_node_role = @ScopeNodeRole
            WHERE id = ANY(@UserIds)
              AND LOWER(role) <> 'admin'
              AND LOWER(username) <> 'admin';";

        var count = await connection.ExecuteAsync(sql, new
        {
            ScopeType = string.IsNullOrWhiteSpace(req.ScopeType) ? "ALL" : req.ScopeType.Trim(),
            ScopeNodeId = req.ScopeNodeId?.Trim(),
            ScopeNodeName = req.ScopeNodeName?.Trim(),
            ScopeNodeRole = req.ScopeNodeRole?.Trim(),
            UserIds = req.UserIds
        });

        return Ok(new
        {
            message = $"Đã cập nhật phân quyền thành công cho {count} người dùng.",
            updatedCount = count
        });
    }

    [HttpPost("revoke-all")]
    public async Task<ActionResult> RevokeAll([FromBody] RevokeAllPermissionsRequest req)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "admin") return Forbid();

        var text = (req.ConfirmationText ?? "").Trim().ToUpperInvariant();
        if (text != "THU HOI" && text != "XAC NHAN")
        {
            return BadRequest(new { message = "Chuỗi xác nhận không chính xác. Vui lòng nhập đúng 'THU HOI' hoặc 'XAC NHAN' để thực thi." });
        }

        var currentUserId = GetCurrentUserId() ?? 0;

        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();
        using var tx = connection.BeginTransaction();

        try
        {
            // 1. Reset scope of all users except admin and current user
            var resetSql = @"
                UPDATE app_user
                SET 
                    scope_type = 'RESTRICTED',
                    scope_node_id = NULL,
                    scope_node_name = 'Đã thu hồi toàn bộ quyền',
                    scope_node_role = NULL,
                    branch_access = NULL
                WHERE LOWER(username) <> 'admin' 
                  AND LOWER(role) <> 'admin'
                  AND id <> @currentUserId;";

            var updatedUsers = await connection.ExecuteAsync(resetSql, new { currentUserId }, transaction: tx);

            // 2. Revoke all active refresh tokens for non-admin users
            var revokeTokensSql = @"
                UPDATE user_refresh_token
                SET is_revoked = TRUE, revoked_at = now()
                WHERE user_id IN (
                    SELECT id FROM app_user 
                    WHERE LOWER(username) <> 'admin' 
                      AND LOWER(role) <> 'admin'
                      AND id <> @currentUserId
                )
                AND is_revoked = FALSE;";

            var revokedTokens = await connection.ExecuteAsync(revokeTokensSql, new { currentUserId }, transaction: tx);

            tx.Commit();

            return Ok(new
            {
                message = $"Đã thu hồi thành công quyền của {updatedUsers} người dùng và hủy {revokedTokens} phiên làm việc.",
                revokedUsers = updatedUsers,
                revokedTokens = revokedTokens
            });
        }
        catch (Exception ex)
        {
            tx.Rollback();
            _logger.LogError(ex, "Lỗi khi thu hồi quyền của tất cả user");
            return StatusCode(500, new { message = "Lỗi hệ thống khi thu hồi quyền: " + ex.Message });
        }
    }
}
