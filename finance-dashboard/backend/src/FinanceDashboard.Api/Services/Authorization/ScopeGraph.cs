using FinanceDashboard.Api.Models.Versioned;

namespace FinanceDashboard.Api.Services.Authorization;

/// <summary>Cycle-safe traversal shared by permissions, the picker and reports.</summary>
public static class ScopeGraph
{
    public static HashSet<string> Descendants(IEnumerable<EmployeeHistory> employees, IEnumerable<string> roots)
    {
        var children = employees.Where(e => !string.IsNullOrWhiteSpace(e.ManagerEmployeeId))
            .GroupBy(e => e.ManagerEmployeeId!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Select(e => e.EmployeeId).ToArray(), StringComparer.OrdinalIgnoreCase);
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var queue = new Queue<string>(roots);
        while (queue.TryDequeue(out var id))
        {
            if (!result.Add(id)) continue;
            if (children.TryGetValue(id, out var ids)) foreach (var child in ids) queue.Enqueue(child);
        }
        return result;
    }

    public static UserAccessScope Narrow(UserAccessScope original, IEnumerable<string> ids)
    {
        var target = ids.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return new UserAccessScope
        {
            UserId = original.UserId, Username = original.Username, Role = original.Role,
            EmployeeId = original.EmployeeId, CanViewSubordinates = original.CanViewSubordinates,
            // Even an administrator must apply the selected node to SQL.
            CanAccessAll = false,
            RevenueScope = original.CanAccessAll ? new(target, StringComparer.OrdinalIgnoreCase)
                : original.RevenueScope.Intersect(target, StringComparer.OrdinalIgnoreCase).ToHashSet(StringComparer.OrdinalIgnoreCase),
            BalanceScope = original.CanAccessAll ? new(target, StringComparer.OrdinalIgnoreCase)
                : original.BalanceScope.Intersect(target, StringComparer.OrdinalIgnoreCase).ToHashSet(StringComparer.OrdinalIgnoreCase),
            VerticalScope = original.VerticalScope.Intersect(target, StringComparer.OrdinalIgnoreCase).ToHashSet(StringComparer.OrdinalIgnoreCase)
        };
    }
}

public sealed class ScopeAccessException(int statusCode, string code, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
}
