namespace FinanceDashboard.Api.Models.Versioned;

public class ReportDataset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string DatasetCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateOnly CutoffDate { get; set; }
    public DateOnly CoverageFrom { get; set; }
    public DateOnly CoverageTo { get; set; }
    public bool IsPublished { get; set; } = false;
    public DateTime? PublishedAt { get; set; }
    public string? PublishedBy { get; set; }
    public Guid? PreviousDatasetId { get; set; }
    public string? AmendmentReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = "system";
}

public class DatasetSourceManifest
{
    public long Id { get; set; }
    public Guid DatasetId { get; set; }
    public string SourceType { get; set; } = string.Empty; // APPENDIX, SETTLEMENT, STOCK, EXCEPTION, EMPLOYEE
    public long? SourceBatchId { get; set; }
    public bool IsConfirmedNoMovement { get; set; } = false;
    public string? Notes { get; set; }
}
