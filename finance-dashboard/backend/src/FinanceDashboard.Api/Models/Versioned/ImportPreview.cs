namespace FinanceDashboard.Api.Models.Versioned;

public class ImportPreview
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public long BatchId { get; set; }
    public int ExpectedRevision { get; set; } = 1;
    public int TotalNew { get; set; }
    public int TotalUnchanged { get; set; }
    public int TotalChanged { get; set; }
    public int TotalAmbiguous { get; set; }
    public int TotalInvalid { get; set; }
    public string? ImpactSummary { get; set; }
    public bool IsStale { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = "system";
}

public class ImportConfirmAudit
{
    public long Id { get; set; }
    public Guid PreviewId { get; set; }
    public long BatchId { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public int ExpectedRevision { get; set; }
    public int ActualRevision { get; set; }
    public string DecisionSummary { get; set; } = "{}";
    public string Reason { get; set; } = string.Empty;
    public string ConfirmedBy { get; set; } = string.Empty;
    public DateTime ConfirmedAt { get; set; } = DateTime.UtcNow;
}
