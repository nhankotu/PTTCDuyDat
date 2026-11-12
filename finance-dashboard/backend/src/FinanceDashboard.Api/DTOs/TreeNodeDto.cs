namespace FinanceDashboard.Api.DTOs;

public class TreeNodeDto
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string? Department { get; set; }
    public string? Branch { get; set; }
    public string? Region { get; set; }
    public string? Status { get; set; }
    public int DirectSubordinatesCount { get; set; }
    public int TotalSubordinatesCount { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalBalance { get; set; }
    public List<TreeNodeDto> Children { get; set; } = new();
}

public class TreeFlatNodeDto
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string? Branch { get; set; }
    public string? Region { get; set; }
    public string? Department { get; set; }
    public string ScopeType { get; set; } = "EMPLOYEE_SUBTREE"; // ALL, REGION, BRANCH, DEPARTMENT, EMPLOYEE_SUBTREE
    public int SubordinatesCount { get; set; }
}

public class UpdateUserScopeDto
{
    public string ScopeType { get; set; } = "ALL"; // ALL, REGION, BRANCH, DEPARTMENT, EMPLOYEE_SUBTREE
    public string? ScopeNodeId { get; set; }
    public string? ScopeNodeName { get; set; }
    public string? ScopeNodeRole { get; set; }
}
