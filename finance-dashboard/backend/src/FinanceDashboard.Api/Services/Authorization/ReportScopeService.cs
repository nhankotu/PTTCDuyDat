using Dapper;
using System.Text.Json;
using FinanceDashboard.Api.DTOs.V1;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Models.Versioned;

namespace FinanceDashboard.Api.Services.Authorization;

public sealed class ReportScopeNode
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Position { get; set; } = "";
    public string? ParentId { get; set; }
    public string? Branch { get; set; }
    public string? Department { get; set; }
    public bool CanViewRevenue { get; set; }
    public bool CanViewBalance { get; set; }
    public bool CanViewSubtree { get; set; }
}

public partial class DataAccessScopeService
{
    public async Task RecordViewSelectionAsync(int userId, string? nodeId, string view, Guid? datasetId, string action = "SELECT_REPORT_SCOPE")
    {
        var scope = await GetReportScopeAsync(userId, nodeId, view, datasetId);
        using var connection = _db.CreateNpgsqlConnection();
        await connection.ExecuteAsync(@"
            INSERT INTO access_audit_log(actor_username, action, target_type, target_id, details, created_at)
            VALUES (@actor, @action, 'EMPLOYEE', @target, @details::jsonb, now())",
            new { action, actor = scope.Username, target = nodeId ?? "MY_SCOPE", details = JsonSerializer.Serialize(new { view, datasetId }) });
    }

    private async Task<AppUser> ReadScopeUserAsync(int userId)
    {
        using var connection = _db.CreateNpgsqlConnection();
        var user = await connection.QuerySingleOrDefaultAsync<AppUser>(
            "SELECT * FROM app_user WHERE id = @userId", new { userId });
        if (user == null || !user.IsActive)
            throw new ScopeAccessException(401, "ACCOUNT_INACTIVE", "Phiên đăng nhập không còn hợp lệ.");
        return user;
    }

    /// <summary>
    /// Normalizes and deduplicates employee records by trimmed EmployeeId (case-insensitive)
    /// so downstream dictionary/tree builders never fail on duplicate or whitespace keys.
    /// </summary>
    public static List<EmployeeHistory> DeduplicateEmployees(IEnumerable<EmployeeHistory> raw)
    {
        var map = new Dictionary<string, EmployeeHistory>(StringComparer.OrdinalIgnoreCase);
        foreach (var emp in raw)
        {
            var id = emp.EmployeeId?.Trim();
            if (string.IsNullOrEmpty(id)) continue;

            var name = string.IsNullOrWhiteSpace(emp.FullName) ? id : emp.FullName.Trim();
            if (!map.TryGetValue(id, out var existing))
            {
                emp.EmployeeId = id;
                emp.FullName = name;
                emp.Position = string.IsNullOrWhiteSpace(emp.Position) ? "CVKD" : emp.Position.Trim();
                emp.ManagerEmployeeId = string.IsNullOrWhiteSpace(emp.ManagerEmployeeId) ? null : emp.ManagerEmployeeId.Trim();
                map[id] = emp;
            }
            else if (string.Equals(existing.FullName, existing.EmployeeId, StringComparison.OrdinalIgnoreCase)
                     && !string.Equals(name, id, StringComparison.OrdinalIgnoreCase))
            {
                existing.FullName = name;
            }
        }
        return map.Values.ToList();
    }

    public async Task<List<EmployeeHistory>> GetScopeEmployeesAsync(Guid? datasetId = null)
    {
        using var connection = _db.CreateNpgsqlConnection();
        if (datasetId.HasValue)
        {
            var dataset = await connection.QuerySingleOrDefaultAsync<ReportDataset>(
                "SELECT * FROM report_dataset WHERE id = @datasetId AND is_published = TRUE", new { datasetId });
            if (dataset == null)
                throw new ScopeAccessException(422, "DATASET_UNAVAILABLE", "Bản chốt chưa được công bố hoặc không tồn tại.");
            var batch = await connection.QueryFirstOrDefaultAsync<long?>(@"
                SELECT source_batch_id FROM dataset_source_manifest
                WHERE dataset_id = @datasetId AND source_type = 'EMPLOYEE' AND source_batch_id IS NOT NULL", new { datasetId });
            if (batch.HasValue)
            {
                // Use the pinned source, never today's organization to reconstruct a published report.
                var historical = (await connection.QueryAsync<EmployeeHistory>(@"
                    SELECT DISTINCT ON (employee_id) * FROM employee_history
                    WHERE batch_id = @batch AND valid_from <= @cutoff
                    ORDER BY employee_id, valid_from DESC, id DESC",
                    new { batch, cutoff = dataset.CutoffDate })).ToList();
                if (historical.Count > 0)
                    return DeduplicateEmployees(historical);
            }

            // Fallback when dataset has no EMPLOYEE batch: derive flat sale identities from its contract/exception batches.
            var derived = await connection.QueryAsync<EmployeeHistory>(@"
                WITH manifest_batches AS (
                    SELECT source_batch_id FROM dataset_source_manifest
                    WHERE dataset_id = @datasetId AND source_batch_id IS NOT NULL
                ),
                contract_sales AS (
                    SELECT TRIM(sale_id) AS employee_id, NULLIF(TRIM(sale_name), '') AS full_name, 0 AS prio, id
                    FROM contract_appendix_version
                    WHERE batch_id IN (SELECT source_batch_id FROM manifest_batches)
                      AND NULLIF(TRIM(sale_id), '') IS NOT NULL
                    UNION ALL
                    SELECT TRIM(new_sale_id) AS employee_id, NULL AS full_name, 1 AS prio, id
                    FROM contract_exception_version
                    WHERE batch_id IN (SELECT source_batch_id FROM manifest_batches)
                      AND NULLIF(TRIM(new_sale_id), '') IS NOT NULL
                )
                SELECT DISTINCT ON (UPPER(employee_id))
                    employee_id,
                    COALESCE(full_name, employee_id) AS full_name,
                    'CVKD' AS position,
                    NULL::varchar AS manager_employee_id,
                    NULL::varchar AS branch,
                    NULL::varchar AS department,
                    NULL::varchar AS region
                FROM contract_sales
                ORDER BY UPPER(employee_id), (CASE WHEN full_name IS NOT NULL THEN 0 ELSE 1 END), prio ASC, id DESC;",
                new { datasetId });
            return DeduplicateEmployees(derived);
        }

        // Current authoritative versions: employee_history -> legacy employee -> active contract/exception sales.
        var current = await connection.QueryAsync<EmployeeHistory>(@"
            WITH current_history AS (
                SELECT DISTINCT ON (employee_id) * FROM employee_history
                WHERE valid_from <= CURRENT_DATE AND valid_to > CURRENT_DATE
                ORDER BY employee_id, valid_from DESC, id DESC
            ),
            contract_sales AS (
                SELECT TRIM(sale_id) AS employee_id, NULLIF(TRIM(sale_name), '') AS full_name, 0 AS prio, id
                FROM contract_appendix_version
                WHERE is_active_version = TRUE
                  AND NULLIF(TRIM(sale_id), '') IS NOT NULL
                UNION ALL
                SELECT TRIM(new_sale_id) AS employee_id, NULL AS full_name, 1 AS prio, id
                FROM contract_exception_version
                WHERE is_active_version = TRUE
                  AND NULLIF(TRIM(new_sale_id), '') IS NOT NULL
            ),
            derived_sales AS (
                SELECT DISTINCT ON (UPPER(employee_id))
                    employee_id,
                    COALESCE(full_name, employee_id) AS full_name
                FROM contract_sales
                ORDER BY UPPER(employee_id), (CASE WHEN full_name IS NOT NULL THEN 0 ELSE 1 END), prio ASC, id DESC
            )
            SELECT employee_id, full_name, position, manager_employee_id, branch, department, region FROM current_history
            UNION ALL
            SELECT e.id, e.full_name, COALESCE(e.position, 'CVKD'), e.manager_id,
                   e.branch_name, e.department_name, e.region_name
            FROM employee e WHERE NOT EXISTS (
                SELECT 1 FROM current_history h WHERE UPPER(TRIM(h.employee_id)) = UPPER(TRIM(e.id)))
            UNION ALL
            SELECT d.employee_id, d.full_name, 'CVKD', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar
            FROM derived_sales d
            WHERE NOT EXISTS (SELECT 1 FROM current_history h WHERE UPPER(TRIM(h.employee_id)) = UPPER(d.employee_id))
              AND NOT EXISTS (SELECT 1 FROM employee e WHERE UPPER(TRIM(e.id)) = UPPER(d.employee_id));");
        return DeduplicateEmployees(current);
    }

    private static HashSet<string> VerticalIds(AppUser user, List<EmployeeHistory> employees)
    {
        var type = user.ScopeType?.Trim().ToUpperInvariant();
        var node = (user.ScopeNodeId ?? user.BranchAccess ?? user.EmployeeId)?.Trim();
        IEnumerable<string> seeds = type switch
        {
            "BRANCH" when !string.IsNullOrEmpty(node) => employees.Where(e => string.Equals(e.Branch, node, StringComparison.OrdinalIgnoreCase)).Select(e => e.EmployeeId),
            "REGION" when !string.IsNullOrEmpty(node) => employees.Where(e => string.Equals(e.Region, node, StringComparison.OrdinalIgnoreCase)).Select(e => e.EmployeeId),
            // Legacy name-only department scopes require a branch boundary.
            "DEPARTMENT" when !string.IsNullOrEmpty(node) && !string.IsNullOrWhiteSpace(user.BranchAccess) => employees.Where(e =>
                string.Equals(e.Department, node, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(e.Branch, user.BranchAccess, StringComparison.OrdinalIgnoreCase)).Select(e => e.EmployeeId),
            "EMPLOYEE_SUBTREE" when !string.IsNullOrEmpty(node) => new[] { node },
            // RESTRICTED is the explicit revoke-all value used by the administration screen.
            "RESTRICTED" => Array.Empty<string>(),
            null or "" when !string.IsNullOrWhiteSpace(user.EmployeeId) => new[] { user.EmployeeId! },
            _ => Array.Empty<string>()
        };
        var knownIds = employees.Select(e => e.EmployeeId).ToHashSet(StringComparer.OrdinalIgnoreCase);
        seeds = seeds.Where(knownIds.Contains).ToArray();
        if (!user.CanViewSubordinates)
            return string.IsNullOrWhiteSpace(user.EmployeeId) || !knownIds.Contains(user.EmployeeId) || type == "RESTRICTED"
                ? new(StringComparer.OrdinalIgnoreCase) : new(new[] { user.EmployeeId! }, StringComparer.OrdinalIgnoreCase);
        // An explicitly granted organizational boundary cannot leak into a different branch via bad hierarchy data.
        return type is "BRANCH" or "REGION" or "DEPARTMENT"
            ? seeds.ToHashSet(StringComparer.OrdinalIgnoreCase) : ScopeGraph.Descendants(employees, seeds);
    }

    public async Task<UserAccessScope> GetEffectiveScopeAsync(int userId, DateOnly? asOfDate = null)
        => await GetBaseReportScopeAsync(userId, null);

    private async Task<UserAccessScope> GetBaseReportScopeAsync(int userId, Guid? datasetId)
    {
        var user = await ReadScopeUserAsync(userId);
        var scope = new UserAccessScope
        {
            UserId = user.Id, Username = user.Username, Role = user.Role,
            EmployeeId = user.EmployeeId, CanViewSubordinates = user.CanViewSubordinates,
            CanAccessAll = user.Role == "admin" || string.Equals(user.ScopeType, "ALL", StringComparison.OrdinalIgnoreCase)
        };
        if (scope.CanAccessAll)
        {
            if (datasetId.HasValue) await GetScopeEmployeesAsync(datasetId);
            return scope;
        }
        var employees = await GetScopeEmployeesAsync(datasetId);
        scope.VerticalScope = VerticalIds(user, employees);
        scope.RevenueScope.UnionWith(scope.VerticalScope);
        scope.BalanceScope.UnionWith(scope.VerticalScope);
        using var connection = _db.CreateNpgsqlConnection();
        var grants = await connection.QueryAsync<AccessPeerGrant>(@"
            SELECT * FROM access_peer_grant WHERE user_id = @userId AND status = 'ACTIVE'
            AND valid_from <= CURRENT_DATE AND valid_to >= CURRENT_DATE", new { userId });
        foreach (var grant in grants)
        {
            if (grant.GrantRevenue) scope.RevenueScope.Add(grant.TargetEmployeeId);
            if (grant.GrantBalance) scope.BalanceScope.Add(grant.TargetEmployeeId);
        }
        return scope;
    }

    public async Task<UserAccessScope> GetReportScopeAsync(int userId, string? nodeId = null,
        string view = "subtree", Guid? datasetId = null)
    {
        if (view is not ("self" or "subtree"))
            throw new ScopeAccessException(400, "INVALID_VIEW", "Chế độ xem phải là cá nhân hoặc cây con.");
        var scope = await GetBaseReportScopeAsync(userId, datasetId);
        if (string.IsNullOrWhiteSpace(nodeId)) return scope;
        var employees = await GetScopeEmployeesAsync(datasetId);
        if (!employees.Any(e => string.Equals(e.EmployeeId, nodeId, StringComparison.OrdinalIgnoreCase)) ||
            (!scope.CanAccessAll && !scope.RevenueScope.Contains(nodeId) && !scope.BalanceScope.Contains(nodeId)))
            throw new ScopeAccessException(403, "SCOPE_FORBIDDEN", "Bạn không được cấp quyền xem node đã chọn.");
        var mayTraverse = scope.CanAccessAll || (scope.CanViewSubordinates && scope.VerticalScope.Contains(nodeId));
        if (view == "subtree" && !mayTraverse)
            throw new ScopeAccessException(403, "SUBTREE_FORBIDDEN", "Bạn chỉ được xem cá nhân của node này.");
        var ids = view == "subtree" ? ScopeGraph.Descendants(employees, new[] { nodeId })
            : new HashSet<string>(new[] { nodeId }, StringComparer.OrdinalIgnoreCase);
        return ScopeGraph.Narrow(scope, ids);
    }

    public async Task<List<ReportScopeNode>> GetViewNodesAsync(int userId, Guid? datasetId = null)
    {
        var scope = await GetBaseReportScopeAsync(userId, datasetId);
        var employees = await GetScopeEmployeesAsync(datasetId);
        var allowed = employees.Where(e => scope.CanAccessAll || scope.RevenueScope.Contains(e.EmployeeId) || scope.BalanceScope.Contains(e.EmployeeId)).ToList();
        var ids = allowed.Select(e => e.EmployeeId).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return allowed.Select(e => new ReportScopeNode
        {
            Id = e.EmployeeId, Label = e.FullName, Position = e.Position,
            ParentId = e.ManagerEmployeeId != null && ids.Contains(e.ManagerEmployeeId) ? e.ManagerEmployeeId : null,
            Branch = e.Branch, Department = e.Department,
            CanViewRevenue = scope.CanAccessAll || scope.RevenueScope.Contains(e.EmployeeId),
            CanViewBalance = scope.CanAccessAll || scope.BalanceScope.Contains(e.EmployeeId),
            CanViewSubtree = scope.CanAccessAll || (scope.CanViewSubordinates && scope.VerticalScope.Contains(e.EmployeeId))
        }).OrderBy(e => e.Label).ToList();
    }

    public async Task<List<OrgTreeNodeDto>> GetOrgTreeAsync(int userId, DateOnly? asOfDate = null,
        Guid? datasetId = null, string? nodeId = null, string view = "subtree")
    {
        var scope = await GetReportScopeAsync(userId, nodeId, view, datasetId);
        var employees = await GetScopeEmployeesAsync(datasetId);
        var allowed = employees.Where(e => scope.CanAccessAll || scope.RevenueScope.Contains(e.EmployeeId) || scope.BalanceScope.Contains(e.EmployeeId)).ToList();
        var map = allowed.ToDictionary(e => e.EmployeeId, e => new OrgTreeNodeDto
        {
            EmployeeId = e.EmployeeId, FullName = e.FullName, Position = e.Position,
            Department = e.Department, Branch = e.Branch, Region = e.Region,
            CanViewRevenue = scope.CanAccessAll || scope.RevenueScope.Contains(e.EmployeeId),
            CanViewBalance = scope.CanAccessAll || scope.BalanceScope.Contains(e.EmployeeId)
        }, StringComparer.OrdinalIgnoreCase);
        var roots = new List<OrgTreeNodeDto>();
        foreach (var emp in allowed)
        {
            var item = map[emp.EmployeeId];
            // Reject cyclic links rather than returning recursive JSON.
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { emp.EmployeeId };
            var parent = emp.ManagerEmployeeId;
            var cyclic = false;
            while (parent != null && map.ContainsKey(parent))
            {
                if (!seen.Add(parent)) { cyclic = true; break; }
                parent = allowed.First(e => string.Equals(e.EmployeeId, parent, StringComparison.OrdinalIgnoreCase)).ManagerEmployeeId;
            }
            if (!cyclic && emp.ManagerEmployeeId != null && map.TryGetValue(emp.ManagerEmployeeId, out var mgr))
            { item.ManagerEmployeeId = emp.ManagerEmployeeId; mgr.Subordinates.Add(item); }
            else roots.Add(item);
        }
        return roots;
    }
}
