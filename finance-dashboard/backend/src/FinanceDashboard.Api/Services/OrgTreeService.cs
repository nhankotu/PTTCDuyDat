using Dapper;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models.Versioned;
using FinanceDashboard.Api.Services.Authorization;

namespace FinanceDashboard.Api.Services;

public interface IOrgTreeService
{
    Task<List<TreeNodeDto>> GetOrgTreeAsync();
    Task<List<TreeFlatNodeDto>> GetFlatNodesAsync();
    Task<List<string>> GetSubordinateIdsAsync(string scopeType, string? scopeNodeId);
}

public class OrgTreeService : IOrgTreeService
{
    private readonly DataAccessScopeService _scopeService;

    public OrgTreeService(DataAccessScopeService scopeService)
    {
        _scopeService = scopeService;
    }

    public async Task<List<TreeNodeDto>> GetOrgTreeAsync()
    {
        var employees = (await _scopeService.GetScopeEmployeesAsync())
            .OrderBy(e => e.Position)
            .ThenBy(e => e.FullName)
            .ToList();

        if (employees.Count == 0)
        {
            return new List<TreeNodeDto>();
        }

        var empMap = employees.ToDictionary(e => e.EmployeeId, StringComparer.OrdinalIgnoreCase);
        var childrenMap = new Dictionary<string, List<EmployeeHistory>>(StringComparer.OrdinalIgnoreCase);

        foreach (var emp in employees)
        {
            var mgrId = emp.ManagerEmployeeId?.Trim();
            if (!string.IsNullOrWhiteSpace(mgrId) && empMap.ContainsKey(mgrId))
            {
                if (!childrenMap.ContainsKey(mgrId))
                {
                    childrenMap[mgrId] = new List<EmployeeHistory>();
                }
                childrenMap[mgrId].Add(emp);
            }
        }

        // Roots are employees without manager or manager not in list
        var roots = employees.Where(e =>
            string.IsNullOrWhiteSpace(e.ManagerEmployeeId) ||
            !empMap.ContainsKey(e.ManagerEmployeeId.Trim())
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

    private TreeNodeDto BuildTreeNode(EmployeeHistory emp, Dictionary<string, List<EmployeeHistory>> childrenMap, HashSet<string>? path = null)
    {
        path ??= new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        path.Add(emp.EmployeeId);
        var isContractDerived = string.Equals(emp.SourceLevel, "CONTRACT", StringComparison.OrdinalIgnoreCase);
        var node = new TreeNodeDto
        {
            Id = emp.EmployeeId,
            Label = emp.FullName,
            Position = isContractDerived ? "Sale HĐ" : (emp.Position ?? "CVKD"),
            Department = emp.Department,
            Branch = emp.Branch,
            Region = emp.Region,
            Status = emp.EmploymentStatus ?? "Đang hoạt động",
            Children = new List<TreeNodeDto>()
        };

        if (childrenMap.TryGetValue(emp.EmployeeId, out var children))
        {
            foreach (var child in children)
            {
                if (path.Contains(child.EmployeeId)) continue;
                node.Children.Add(BuildTreeNode(child, childrenMap, path));
            }
            node.DirectSubordinatesCount = node.Children.Count;
            node.TotalSubordinatesCount = node.Children.Sum(child => 1 + child.TotalSubordinatesCount);
        }
        path.Remove(emp.EmployeeId);

        return node;
    }

    public async Task<List<TreeFlatNodeDto>> GetFlatNodesAsync()
    {
        var employees = await _scopeService.GetScopeEmployeesAsync();
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
            .Where(e => !string.IsNullOrWhiteSpace(e.Region))
            .Select(e => e.Region!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(r => r);

        foreach (var reg in regions)
        {
            var count = employees.Count(e => string.Equals(e.Region?.Trim(), reg, StringComparison.OrdinalIgnoreCase));
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
            .Where(e => !string.IsNullOrWhiteSpace(e.Branch))
            .GroupBy(e => e.Branch!.Trim(), StringComparer.OrdinalIgnoreCase)
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
                Region = firstEmp.Region,
                ScopeType = "BRANCH",
                SubordinatesCount = b.Count()
            });
        }

        // 4. Cấp Phòng ban (gắn với Chi nhánh để tránh trùng tên phòng giữa các chi nhánh)
        var depts = employees
            .Where(e => !string.IsNullOrWhiteSpace(e.Department))
            .GroupBy(e => new
            {
                Branch = (e.Branch ?? "").Trim(),
                Dept = e.Department!.Trim()
            })
            .OrderBy(g => g.Key.Branch)
            .ThenBy(g => g.Key.Dept);

        foreach (var d in depts)
        {
            var firstEmp = d.First();
            var id = !string.IsNullOrEmpty(d.Key.Branch) ? $"{d.Key.Branch}::{d.Key.Dept}" : d.Key.Dept;
            var branchSuffix = !string.IsNullOrEmpty(d.Key.Branch) ? $" - {d.Key.Branch}" : "";
            list.Add(new TreeFlatNodeDto
            {
                Id = id,
                Label = $"📑 {d.Key.Dept}{branchSuffix}",
                Position = "Trưởng phòng KD (TPKD)",
                Branch = firstEmp.Branch,
                Region = firstEmp.Region,
                Department = d.Key.Dept,
                ScopeType = "DEPARTMENT",
                SubordinatesCount = d.Count()
            });
        }

        // 5. Cấp Nhân sự cụ thể (Chuyên viên / Trưởng phòng + Cây con bên dưới + Sale HĐ)
        var tree = await GetOrgTreeAsync();
        var empNodes = new List<TreeNodeDto>();
        FlattenTree(tree, empNodes);

        foreach (var empNode in empNodes.OrderByDescending(e => e.TotalSubordinatesCount).ThenBy(e => e.Label))
        {
            var unit = empNode.Branch ?? empNode.Department ?? empNode.Id;
            list.Add(new TreeFlatNodeDto
            {
                Id = empNode.Id,
                Label = $"👤 {empNode.Label} [{empNode.Position}] - {unit} ({empNode.TotalSubordinatesCount} cấp dưới)",
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

        var employees = await _scopeService.GetScopeEmployeesAsync();
        var node = scopeNodeId.Trim();

        if (scopeType == "REGION")
        {
            return employees
                .Where(e => string.Equals(e.Region?.Trim(), node, StringComparison.OrdinalIgnoreCase))
                .Select(e => e.EmployeeId)
                .ToList();
        }

        if (scopeType == "BRANCH")
        {
            return employees
                .Where(e => string.Equals(e.Branch?.Trim(), node, StringComparison.OrdinalIgnoreCase))
                .Select(e => e.EmployeeId)
                .ToList();
        }

        if (scopeType == "DEPARTMENT")
        {
            var sepIdx = node.IndexOf("::", StringComparison.Ordinal);
            if (sepIdx > 0)
            {
                var br = node[..sepIdx].Trim();
                var dep = node[(sepIdx + 2)..].Trim();
                return employees
                    .Where(e => string.Equals(e.Branch?.Trim(), br, StringComparison.OrdinalIgnoreCase) &&
                                string.Equals(e.Department?.Trim(), dep, StringComparison.OrdinalIgnoreCase))
                    .Select(e => e.EmployeeId)
                    .ToList();
            }
            return employees
                .Where(e => string.Equals(e.Department?.Trim(), node, StringComparison.OrdinalIgnoreCase))
                .Select(e => e.EmployeeId)
                .ToList();
        }

        return ScopeGraph.Descendants(employees, new[] { node }).ToList();
    }
}
