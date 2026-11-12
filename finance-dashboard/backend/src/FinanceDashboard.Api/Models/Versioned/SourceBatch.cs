namespace FinanceDashboard.Api.Models.Versioned;

public class SourceBatch
{
    public long Id { get; set; }
    public string SourceType { get; set; } = string.Empty; // APPENDIX, SETTLEMENT, STOCK, EXCEPTION, EMPLOYEE
    public string FileName { get; set; } = string.Empty;
    public string FileSha256 { get; set; } = string.Empty;
    public DateOnly? SourceDate { get; set; }
    public DateOnly? EffectiveDate { get; set; }
    public string? StorageKey { get; set; }
    public string MappingVersion { get; set; } = "v1";
    public string Status { get; set; } = "STAGING"; // STAGING, VALIDATED, PREVIEWED, CONFIRMED, FAILED
    public int TotalRows { get; set; }
    public int NewRows { get; set; }
    public int UnchangedRows { get; set; }
    public int ChangedRows { get; set; }
    public int AmbiguousRows { get; set; }
    public int InvalidRows { get; set; }
    public string? ErrorSummary { get; set; }
    public string UploadedBy { get; set; } = "system";
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public string? ConfirmedBy { get; set; }
    public DateTime? ConfirmedAt { get; set; }
}
