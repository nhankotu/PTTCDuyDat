namespace FinanceDashboard.Api.Models.Versioned;

public class AccessPeerGrant
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public string TargetEmployeeId { get; set; } = string.Empty;
    public bool GrantRevenue { get; set; } = false;
    public bool GrantBalance { get; set; } = false;
    public string TargetScopeType { get; set; } = "SELF"; // SELF
    public DateOnly ValidFrom { get; set; }
    public DateOnly ValidTo { get; set; } = new(9999, 12, 31);
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, REVOKED, EXPIRED
    public string GrantedBy { get; set; } = string.Empty;
    public string GrantReason { get; set; } = string.Empty;
    public string? RevokedBy { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? RevocationReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AccessRequest
{
    public long Id { get; set; }
    public int RequestingUserId { get; set; }
    public string TargetEmployeeId { get; set; } = string.Empty;
    public bool RequestRevenue { get; set; } = false;
    public bool RequestBalance { get; set; } = false;
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNotes { get; set; }
    public long? ResultingGrantId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AccessAuditLog
{
    public long Id { get; set; }
    public string ActorUsername { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string Details { get; set; } = "{}";
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
