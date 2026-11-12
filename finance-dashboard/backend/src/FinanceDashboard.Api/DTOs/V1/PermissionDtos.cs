namespace FinanceDashboard.Api.DTOs.V1;

public class OrgTreeNodeDto
{
    public string EmployeeId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string? Department { get; set; }
    public string? Branch { get; set; }
    public string? Region { get; set; }
    public string? ManagerEmployeeId { get; set; }
    public bool CanViewRevenue { get; set; }
    public bool CanViewBalance { get; set; }
    public List<OrgTreeNodeDto> Subordinates { get; set; } = new();
}

public class ReparentManagerRequest
{
    public string NewManagerEmployeeId { get; set; } = string.Empty;
    public DateOnly EffectiveDate { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class UserDataAccessUpdateRequest
{
    public string? EmployeeId { get; set; }
    public bool CanViewSubordinates { get; set; }
    public string? Reason { get; set; }
}

public class CreateAccessRequestDto
{
    public string TargetEmployeeId { get; set; } = string.Empty;
    public bool RequestRevenue { get; set; }
    public bool RequestBalance { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class ReviewAccessRequestDto
{
    public bool IsApproved { get; set; }
    public string ReviewNotes { get; set; } = string.Empty;
    public DateOnly? ValidTo { get; set; }
}

public class CreatePeerGrantDto
{
    public int UserId { get; set; }
    public string TargetEmployeeId { get; set; } = string.Empty;
    public bool GrantRevenue { get; set; }
    public bool GrantBalance { get; set; }
    public DateOnly ValidFrom { get; set; }
    public DateOnly ValidTo { get; set; } = new(9999, 12, 31);
    public string GrantReason { get; set; } = string.Empty;
}

public class PermissionPresetDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ScopeType { get; set; } = "ALL";
    public string? ScopeNodeId { get; set; }
    public string? ScopeNodeName { get; set; }
    public string? ScopeNodeRole { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
}

public class CreatePermissionPresetDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ScopeType { get; set; } = "ALL";
    public string? ScopeNodeId { get; set; }
    public string? ScopeNodeName { get; set; }
    public string? ScopeNodeRole { get; set; }
}

public class BulkAssignScopeRequest
{
    public List<int> UserIds { get; set; } = new();
    public string ScopeType { get; set; } = "ALL";
    public string? ScopeNodeId { get; set; }
    public string? ScopeNodeName { get; set; }
    public string? ScopeNodeRole { get; set; }
}

public class RevokeAllPermissionsRequest
{
    public string ConfirmationText { get; set; } = string.Empty;
}
