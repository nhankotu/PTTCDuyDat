using System.Data;
using System.Text.Json;
using Dapper;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs.V1;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Models.Versioned;

namespace FinanceDashboard.Api.Services.Authorization;

public class UserAccessScope
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? EmployeeId { get; set; }
    public bool CanAccessAll { get; set; } // Admin
    public bool CanViewSubordinates { get; set; } = true;
    public HashSet<string> RevenueScope { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public HashSet<string> BalanceScope { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public HashSet<string> VerticalScope { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public bool ScopesDiffer => !RevenueScope.SetEquals(BalanceScope);
}

public partial class DataAccessScopeService
{
    private readonly DbConnectionFactory _db;
    private readonly ILogger<DataAccessScopeService> _logger;

    public DataAccessScopeService(DbConnectionFactory db, ILogger<DataAccessScopeService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task ReparentManagerAsync(
        string employeeId,
        string newManagerId,
        DateOnly effectiveDate,
        string reason,
        string actorUsername)
    {
        if (employeeId.Equals(newManagerId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Nhân sự không thể tự làm quản lý của chính mình.");
        }

        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        // Cycle check: verify employeeId is not an ancestor of newManagerId
        var isAncestor = await connection.ExecuteScalarAsync<bool>(@"
            WITH RECURSIVE ancestors AS (
                SELECT manager_employee_id
                FROM employee_history
                WHERE employee_id = @NewManagerId AND is_current = TRUE

                UNION ALL

                SELECT e.manager_employee_id
                FROM employee_history e
                INNER JOIN ancestors a ON e.employee_id = a.manager_employee_id
                WHERE e.is_current = TRUE AND e.manager_employee_id IS NOT NULL
            )
            SELECT EXISTS (SELECT 1 FROM ancestors WHERE manager_employee_id = @EmployeeId);",
            new { NewManagerId = newManagerId, EmployeeId = employeeId });

        if (isAncestor)
        {
            throw new InvalidOperationException("Không thể chuyển quản lý vì tạo thành vòng lặp phân cấp (Cycle detected).");
        }

        var currentEmp = await connection.QueryFirstOrDefaultAsync<EmployeeHistory>(@"
            SELECT * FROM employee_history
            WHERE employee_id = @EmployeeId AND is_current = TRUE;",
            new { EmployeeId = employeeId });

        if (currentEmp == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy nhân sự có mã {employeeId}.");
        }

        var newMgr = await connection.QueryFirstOrDefaultAsync<EmployeeHistory>(@"
            SELECT * FROM employee_history
            WHERE employee_id = @NewManagerId AND is_current = TRUE;",
            new { NewManagerId = newManagerId });

        if (newMgr == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy quản lý mới có mã {newManagerId}.");
        }

        using var transaction = connection.BeginTransaction();
        try
        {
            // Close old version
            await connection.ExecuteAsync(@"
                UPDATE employee_history SET
                    is_current = FALSE,
                    valid_to = @EffDate
                WHERE id = @Id;",
                new { EffDate = effectiveDate, Id = currentEmp.Id }, transaction);

            // Insert new version
            await connection.ExecuteAsync(@"
                INSERT INTO employee_history (
                    employee_id, full_name, position, source_level, department,
                    branch, region, manager_employee_id, manager_name,
                    source_account_status, employment_status, valid_from, valid_to,
                    recorded_at, recorded_by, is_current
                ) VALUES (
                    @EmployeeId, @FullName, @Position, @SourceLevel, @Department,
                    @Branch, @Region, @ManagerEmployeeId, @ManagerName,
                    @SourceAccountStatus, @EmploymentStatus, @ValidFrom, '9999-12-31',
                    now(), @Actor, TRUE
                );",
                new
                {
                    currentEmp.EmployeeId,
                    currentEmp.FullName,
                    currentEmp.Position,
                    currentEmp.SourceLevel,
                    Department = newMgr.Department ?? currentEmp.Department,
                    Branch = newMgr.Branch ?? currentEmp.Branch,
                    Region = newMgr.Region ?? currentEmp.Region,
                    ManagerEmployeeId = newMgr.EmployeeId,
                    ManagerName = newMgr.FullName,
                    currentEmp.SourceAccountStatus,
                    currentEmp.EmploymentStatus,
                    ValidFrom = effectiveDate,
                    Actor = actorUsername
                }, transaction);

            // Audit
            await connection.ExecuteAsync(@"
                INSERT INTO access_audit_log (
                    actor_username, action, target_type, target_id, details, created_at
                ) VALUES (
                    @Actor, 'REPARENT_EMPLOYEE', 'EMPLOYEE', @EmployeeId, @Details::jsonb, now()
                );",
                new
                {
                    Actor = actorUsername,
                    EmployeeId = employeeId,
                    Details = JsonSerializer.Serialize(new
                    {
                        OldManager = currentEmp.ManagerEmployeeId,
                        NewManager = newMgr.EmployeeId,
                        EffectiveDate = effectiveDate.ToString("yyyy-MM-dd"),
                        Reason = reason
                    })
                }, transaction);

            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task UpdateUserDataAccessAsync(
        int targetUserId,
        UserDataAccessUpdateRequest req,
        string actorUsername)
    {
        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        await connection.ExecuteAsync(@"
            UPDATE app_user SET
                employee_id = @EmployeeId,
                can_view_subordinates = @CanViewSubordinates,
                subordinate_view_updated_at = now(),
                subordinate_view_updated_by = @Actor
            WHERE id = @UserId;",
            new
            {
                UserId = targetUserId,
                req.EmployeeId,
                req.CanViewSubordinates,
                Actor = actorUsername
            });

        // Audit
        await connection.ExecuteAsync(@"
            INSERT INTO access_audit_log (
                actor_username, action, target_type, target_id, details, created_at
            ) VALUES (
                @Actor, 'TOGGLE_SUBORDINATE_VIEW', 'APP_USER', @UserId, @Details::jsonb, now()
            );",
            new
            {
                Actor = actorUsername,
                UserId = targetUserId.ToString(),
                Details = JsonSerializer.Serialize(new
                {
                    req.EmployeeId,
                    req.CanViewSubordinates,
                    req.Reason
                })
            });
    }

    public async Task<long> CreateAccessRequestAsync(int requestingUserId, CreateAccessRequestDto dto)
    {
        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        return await connection.ExecuteScalarAsync<long>(@"
            INSERT INTO access_request (
                requesting_user_id, target_employee_id, request_revenue,
                request_balance, reason, status, created_at
            ) VALUES (
                @UserId, @TargetEmployeeId, @ReqRevenue,
                @ReqBalance, @Reason, 'PENDING', now()
            ) RETURNING id;",
            new
            {
                UserId = requestingUserId,
                dto.TargetEmployeeId,
                ReqRevenue = dto.RequestRevenue,
                ReqBalance = dto.RequestBalance,
                dto.Reason
            });
    }

    public async Task ReviewAccessRequestAsync(
        long requestId,
        ReviewAccessRequestDto dto,
        string actorUsername)
    {
        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        var req = await connection.QueryFirstOrDefaultAsync<AccessRequest>(@"
            SELECT * FROM access_request WHERE id = @Id;", new { Id = requestId });

        if (req == null)
        {
            throw new KeyNotFoundException("Không tìm thấy đơn xin cấp quyền.");
        }

        if (req.Status != "PENDING")
        {
            throw new InvalidOperationException("Đơn này đã được xử lý trước đó.");
        }

        using var transaction = connection.BeginTransaction();
        try
        {
            long? resultingGrantId = null;

            if (dto.IsApproved)
            {
                resultingGrantId = await connection.ExecuteScalarAsync<long>(@"
                    INSERT INTO access_peer_grant (
                        user_id, target_employee_id, grant_revenue, grant_balance,
                        target_scope_type, valid_from, valid_to, status,
                        granted_by, grant_reason, created_at
                    ) VALUES (
                        @UserId, @TargetEmployeeId, @GrantRevenue, @GrantBalance,
                        'SELF', CURRENT_DATE, @ValidTo, 'ACTIVE',
                        @Actor, @Reason, now()
                    ) RETURNING id;",
                    new
                    {
                        UserId = req.RequestingUserId,
                        req.TargetEmployeeId,
                        GrantRevenue = req.RequestRevenue,
                        GrantBalance = req.RequestBalance,
                        ValidTo = dto.ValidTo ?? new DateOnly(9999, 12, 31),
                        Actor = actorUsername,
                        Reason = $"Phê duyệt đơn #{req.Id}: {dto.ReviewNotes}"
                    }, transaction);
            }

            await connection.ExecuteAsync(@"
                UPDATE access_request SET
                    status = @Status,
                    reviewed_by = @Actor,
                    reviewed_at = now(),
                    review_notes = @Notes,
                    resulting_grant_id = @GrantId
                WHERE id = @Id;",
                new
                {
                    Status = dto.IsApproved ? "APPROVED" : "REJECTED",
                    Actor = actorUsername,
                    Notes = dto.ReviewNotes,
                    GrantId = resultingGrantId,
                    Id = req.Id
                }, transaction);

            // Audit
            await connection.ExecuteAsync(@"
                INSERT INTO access_audit_log (
                    actor_username, action, target_type, target_id, details, created_at
                ) VALUES (
                    @Actor, @Action, 'ACCESS_REQUEST', @RequestId, @Details::jsonb, now()
                );",
                new
                {
                    Actor = actorUsername,
                    Action = dto.IsApproved ? "APPROVE_REQUEST" : "REJECT_REQUEST",
                    RequestId = req.Id.ToString(),
                    Details = JsonSerializer.Serialize(new
                    {
                        req.RequestingUserId,
                        req.TargetEmployeeId,
                        dto.ReviewNotes,
                        resultingGrantId
                    })
                }, transaction);

            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<long> CreatePeerGrantAsync(CreatePeerGrantDto dto, string actorUsername)
    {
        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        var grantId = await connection.ExecuteScalarAsync<long>(@"
            INSERT INTO access_peer_grant (
                user_id, target_employee_id, grant_revenue, grant_balance,
                target_scope_type, valid_from, valid_to, status,
                granted_by, grant_reason, created_at
            ) VALUES (
                @UserId, @TargetEmployeeId, @GrantRevenue, @GrantBalance,
                'SELF', @ValidFrom, @ValidTo, 'ACTIVE',
                @Actor, @GrantReason, now()
            ) RETURNING id;",
            new
            {
                dto.UserId,
                dto.TargetEmployeeId,
                dto.GrantRevenue,
                dto.GrantBalance,
                dto.ValidFrom,
                dto.ValidTo,
                Actor = actorUsername,
                dto.GrantReason
            });

        // Audit
        await connection.ExecuteAsync(@"
            INSERT INTO access_audit_log (
                actor_username, action, target_type, target_id, details, created_at
            ) VALUES (
                @Actor, 'GRANT_PEER', 'ACCESS_PEER_GRANT', @GrantId, @Details::jsonb, now()
            );",
            new
            {
                Actor = actorUsername,
                GrantId = grantId.ToString(),
                Details = JsonSerializer.Serialize(dto)
            });

        return grantId;
    }

    public async Task RevokePeerGrantAsync(long grantId, string reason, string actorUsername)
    {
        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        await connection.ExecuteAsync(@"
            UPDATE access_peer_grant SET
                status = 'REVOKED',
                revoked_by = @Actor,
                revoked_at = now(),
                revocation_reason = @Reason
            WHERE id = @GrantId;",
            new
            {
                GrantId = grantId,
                Actor = actorUsername,
                Reason = reason
            });

        // Audit
        await connection.ExecuteAsync(@"
            INSERT INTO access_audit_log (
                actor_username, action, target_type, target_id, details, created_at
            ) VALUES (
                @Actor, 'REVOKE_PEER', 'ACCESS_PEER_GRANT', @GrantId, @Details::jsonb, now()
            );",
            new
            {
                Actor = actorUsername,
                GrantId = grantId.ToString(),
                Details = JsonSerializer.Serialize(new { Reason = reason })
            });
    }
}
