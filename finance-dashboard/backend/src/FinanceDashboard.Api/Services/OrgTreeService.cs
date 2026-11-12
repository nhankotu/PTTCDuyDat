using Dapper;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Services;

public interface IOrgTreeService
{
    Task<List<TreeNodeDto>> GetOrgTreeAsync();
    Task<List<TreeFlatNodeDto>> GetFlatNodesAsync();
    Task<List<string>> GetSubordinateIdsAsync(string scopeType, string? scopeNodeId);
}

public class OrgTreeService : IOrgTreeService
{
    private readonly FinanceDbContext _dbContext;
    private readonly IDbConnectionFactory _dbFactory;

    public OrgTreeService(FinanceDbContext dbContext, IDbConnectionFactory dbFactory)
    {
        _dbContext = dbContext;
        _dbFactory = dbFactory;
    }

    public async Task<List<TreeNodeDto>> GetOrgTreeAsync()
    {
        var employees = await _dbContext.Employees
            .AsNoTracking()
            .OrderBy(e => e.Position)
            .ThenBy(e => e.FullName)
            .ToListAsync();

        if (employees.Count == 0)
        {
            return new List<TreeNodeDto>();
        }

        var empMap = employees.ToDictionary(e => e.Id, StringComparer.OrdinalIgnoreCase);
        var childrenMap = new Dictionary<string, List<Employee>>(StringComparer.OrdinalIgnoreCase);

        foreach (var emp in employees)
        {
            var mgrId = emp.ManagerId?.Trim();
            if (!string.IsNullOrWhiteSpace(mgrId) && empMap.ContainsKey(mgrId))
            {
                if (!childrenMap.ContainsKey(mgrId))
                {
                    childrenMap[mgrId] = new List<Employee>();
                }
                childrenMap[mgrId].Add(emp);
            }
        }

        // Roots are employees without manager or manager not in list
        var roots = employees.Where(e =>
            string.IsNullOrWhiteSpace(e.ManagerId) ||
            !empMap.ContainsKey(e.ManagerId.Trim())
        ).ToList();

        // If no root found (e.g. cycle), pick PTM or GĐCN as roots
        if (roots.Count == 0)
        {
            roots = employees.Where(e => e.Position == "PTM" || e.Position == "GĐCN").ToList();
            if (roots.Count == 0)
            {
                roots = employees.Take(3).ToList();
            }
        }

        var result = new List<TreeNodeDto>();
        foreach (var r in roots)
        {
            result.Add(BuildTreeNode(r, childrenMap));
        }

        return result;
    }

    private TreeNodeDto BuildTreeNode(Employee emp, Dictionary<string, List<Employee>> childrenMap, HashSet<string>? path = null)
    {
        path ??= new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        path.Add(emp.Id);
        var node = new TreeNodeDto
        {
            Id = emp.Id,
            Label = emp.FullName,
            Position = emp.Position ?? "CVKD",
            Department = emp.DepartmentName,
            Branch = emp.BranchName,
            Region = emp.RegionName,
            Status = emp.Status ?? (emp.IsActive ? "Đang hoạt động" : "Không hoạt động"),
            Children = new List<TreeNodeDto>()
        };

        if (childrenMap.TryGetValue(emp.Id, out var children))
        {
            foreach (var child in children)
            {
                if (path.Contains(child.Id)) continue;
                node.Children.Add(BuildTreeNode(child, childrenMap, path));
            }
            node.DirectSubordinatesCount = node.Children.Count;
            node.TotalSubordinatesCount = node.Children.Sum(child => 1 + child.TotalSubordinatesCount);
        }
        path.Remove(emp.Id);

        return node;
    }

    public async Task<List<TreeFlatNodeDto>> GetFlatNodesAsync()
    {
        var employees = await _dbContext.Employees
            .AsNoTracking()
            .ToListAsync();

        var list = new List<TreeFlatNodeDto>();

        // 1. Root option: Toàn hệ thống
        list.Add(new TreeFlatNodeDto
        {
            Id = "ALL",
            Label = "🌐 Toàn hệ thống (Xem tất cả các Miền, Chi nhánh, Phòng ban)",
            Position = "Super Admin / TGĐ",
            ScopeType = "ALL",
            SubordinatesCount = employees.Count
        });

        // 2. Cấp Miền
        var regions = employees
            .Where(e => !string.IsNullOrWhiteSpace(e.RegionName))
            .Select(e => e.RegionName!)
            .Distinct()
            .OrderBy(r => r);

        foreach (var reg in regions)
        {
            var count = employees.Count(e => e.RegionName == reg);
            list.Add(new TreeFlatNodeDto
            {
                Id = reg,
                Label = $"🌐 {reg} (Toàn bộ các Chi nhánh & Nhân sự thuộc {reg})",
                Position = "Phó Tổng Miền (PTM)",
                Region = reg,
                ScopeType = "REGION",
                SubordinatesCount = count
            });
        }

        // 3. Cấp Chi nhánh
        var branches = employees
            .Where(e => !string.IsNullOrWhiteSpace(e.BranchName))
            .GroupBy(e => e.BranchName!)
            .OrderBy(g => g.Key);

        foreach (var b in branches)
        {
            var firstEmp = b.First();
            list.Add(new TreeFlatNodeDto
            {
                Id = b.Key,
                Label = $"🏛️ {b.Key} (Toàn bộ các Phòng & Sale thuộc {b.Key})",
                Position = "Giám đốc Chi nhánh (GĐCN)",
                Branch = b.Key,
                Region = firstEmp.RegionName,
                ScopeType = "BRANCH",
                SubordinatesCount = b.Count()
            });
        }

        // 4. Cấp Phòng ban
        var depts = employees
            .Where(e => !string.IsNullOrWhiteSpace(e.DepartmentName))
            .GroupBy(e => e.DepartmentName!)
            .OrderBy(g => g.Key);

        foreach (var d in depts)
        {
            var firstEmp = d.First();
            list.Add(new TreeFlatNodeDto
            {
                Id = d.Key,
                Label = $"📑 {d.Key} ({d.Key} - {firstEmp.BranchName})",
                Position = "Trưởng phòng KD (TPKD)",
                Branch = firstEmp.BranchName,
                Region = firstEmp.RegionName,
                Department = d.Key,
                ScopeType = "DEPARTMENT",
                SubordinatesCount = d.Count()
            });
        }

        // 5. Cấp Nhân sự cụ thể (Chuyên viên / Trưởng phòng + Cây con bên dưới)
        var tree = await GetOrgTreeAsync();
        var empNodes = new List<TreeNodeDto>();
        FlattenTree(tree, empNodes);

        foreach (var empNode in empNodes.OrderByDescending(e => e.TotalSubordinatesCount).ThenBy(e => e.Label))
        {
            list.Add(new TreeFlatNodeDto
            {
                Id = empNode.Id,
                Label = $"👤 {empNode.Label} [{empNode.Position}] - {empNode.Branch ?? empNode.Department} ({empNode.TotalSubordinatesCount} cấp dưới)",
                Position = empNode.Position,
                Branch = empNode.Branch,
                Region = empNode.Region,
                Department = empNode.Department,
                ScopeType = "EMPLOYEE_SUBTREE",
                SubordinatesCount = empNode.TotalSubordinatesCount
            });
        }

        return list;
    }

    private void FlattenTree(List<TreeNodeDto> nodes, List<TreeNodeDto> flat)
    {
        foreach (var n in nodes)
        {
            flat.Add(n);
            if (n.Children != null && n.Children.Count > 0)
            {
                FlattenTree(n.Children, flat);
            }
        }
    }

    public async Task<List<string>> GetSubordinateIdsAsync(string scopeType, string? scopeNodeId)
    {
        if (string.IsNullOrWhiteSpace(scopeType) || scopeType == "ALL" || string.IsNullOrWhiteSpace(scopeNodeId))
        {
            return new List<string>(); // Empty means unrestricted
        }

        using var conn = _dbFactory.CreateConnection();

        if (scopeType == "REGION")
        {
            var ids = await conn.QueryAsync<string>(
                "SELECT id FROM employee WHERE region_name = @scopeNodeId;",
                new { scopeNodeId });
            return ids.ToList();
        }

        if (scopeType == "BRANCH")
        {
            var ids = await conn.QueryAsync<string>(
                "SELECT id FROM employee WHERE branch_name = @scopeNodeId;",
                new { scopeNodeId });
            return ids.ToList();
        }

        if (scopeType == "DEPARTMENT")
        {
            var ids = await conn.QueryAsync<string>(
                "SELECT id FROM employee WHERE department_name = @scopeNodeId;",
                new { scopeNodeId });
            return ids.ToList();
        }

        // EMPLOYEE_SUBTREE: Recursive CTE
        var sql = @"
            WITH RECURSIVE sub_tree AS (
                SELECT id FROM employee WHERE id = @scopeNodeId
                UNION
                SELECT e.id FROM employee e
                INNER JOIN sub_tree st ON e.manager_id = st.id
            )
            SELECT DISTINCT id FROM sub_tree;
        ";

        var subtreeIds = await conn.QueryAsync<string>(sql, new { scopeNodeId });
        return subtreeIds.ToList();
    }
}
