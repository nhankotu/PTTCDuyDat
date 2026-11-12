namespace FinanceDashboard.Api.Models.Versioned;

public class ImportStagingRecord
{
    public long Id { get; set; }
    public long BatchId { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string? SheetName { get; set; }
    public int RowIndex { get; set; }
    public string? EntityKey { get; set; }
    public string Fingerprint { get; set; } = string.Empty;
    public string Classification { get; set; } = "NEW"; // NEW, UNCHANGED, CHANGED, AMBIGUOUS, INVALID
    public string ParsedJson { get; set; } = "{}";
    public string? RawSelectedJson { get; set; }
    public string? DiffJson { get; set; }
    public string? ValidationErrors { get; set; }
    public string ResolutionAction { get; set; } = "PENDING"; // ACCEPT, SKIP, CREATE_NEW, LINK_EXISTING
    public string? ResolutionNotes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
