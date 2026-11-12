namespace FinanceDashboard.Api.DTOs.V1;

public class ImportPreviewRequest
{
    public string? SourceType { get; set; } // APPENDIX, SETTLEMENT, STOCK, EXCEPTION, EMPLOYEE (optional, auto-detect if null)
    public DateOnly? SourceDate { get; set; }
    public DateOnly? EffectiveDate { get; set; }
}

public class ImportPreviewResponse
{
    public Guid PreviewId { get; set; }
    public long BatchId { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FileSha256 { get; set; } = string.Empty;
    public int ExpectedRevision { get; set; } = 1;
    public int TotalRows { get; set; }
    public int NewRows { get; set; }
    public int UnchangedRows { get; set; }
    public int ChangedRows { get; set; }
    public int AmbiguousRows { get; set; }
    public int InvalidRows { get; set; }
    public List<ImportRowErrorDto> Errors { get; set; } = new();
    public List<StagingRecordDto> Items { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public bool IsStale { get; set; }
}

public class ImportRowErrorDto
{
    public int RowIndex { get; set; }
    public string? EntityKey { get; set; }
    public List<string> ValidationErrors { get; set; } = new();
}

public class StagingRecordDto
{
    public long Id { get; set; }
    public int RowIndex { get; set; }
    public string? SheetName { get; set; }
    public string? EntityKey { get; set; }
    public string Classification { get; set; } = string.Empty; // NEW, UNCHANGED, CHANGED, AMBIGUOUS, INVALID
    public object? ParsedData { get; set; }
    public object? DiffData { get; set; }
    public List<string> ValidationErrors { get; set; } = new();
    public string ResolutionAction { get; set; } = "PENDING";
    public string? ResolutionNotes { get; set; }
}

public class ImportConfirmRequest
{
    public int ExpectedRevision { get; set; } = 1;
    public string IdempotencyKey { get; set; } = string.Empty;
    public string Reason { get; set; } = "Import confirmed by Admin";
    public Dictionary<long, string>? RowResolutions { get; set; } // StagingRecordId -> ACCEPT, SKIP, CREATE_NEW, LINK_EXISTING
}

public class ImportConfirmResponse
{
    public long BatchId { get; set; }
    public Guid PreviewId { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public int ConfirmedRows { get; set; }
    public int SkippedRows { get; set; }
    public string Status { get; set; } = "CONFIRMED";
    public string Message { get; set; } = string.Empty;
}
