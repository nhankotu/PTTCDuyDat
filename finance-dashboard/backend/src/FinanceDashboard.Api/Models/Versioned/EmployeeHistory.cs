namespace FinanceDashboard.Api.Models.Versioned;

public class EmployeeHistory
{
    public long Id { get; set; }
    public string EmployeeId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string? SourceLevel { get; set; }
    public string? Department { get; set; }
    public string? Branch { get; set; }
    public string? Region { get; set; }
    public string? ManagerEmployeeId { get; set; }
    public string? ManagerName { get; set; }
    public string? SourceAccountStatus { get; set; }
    public string? EmploymentStatus { get; set; }
    public DateOnly ValidFrom { get; set; }
    public DateOnly ValidTo { get; set; } = new(9999, 12, 31);
    public long? BatchId { get; set; }
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public string RecordedBy { get; set; } = "system";
    public bool IsCurrent { get; set; } = true;
}
