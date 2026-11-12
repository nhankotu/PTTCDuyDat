namespace FinanceDashboard.Api.Models.Versioned;

public class ContractExceptionVersion
{
    public long Id { get; set; }
    public Guid EntityId { get; set; } = Guid.NewGuid();
    public string AppendixNumber { get; set; } = string.Empty;
    public string NewSaleId { get; set; } = string.Empty;
    public string? OriginalSaleId { get; set; }
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpireDate { get; set; }
    public long BatchId { get; set; }
    public int VersionNum { get; set; } = 1;
    public bool IsActiveVersion { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
