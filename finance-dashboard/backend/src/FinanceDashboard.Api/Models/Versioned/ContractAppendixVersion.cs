namespace FinanceDashboard.Api.Models.Versioned;

public class ContractAppendixVersion
{
    public long Id { get; set; }
    public Guid EntityId { get; set; } = Guid.NewGuid();
    public string AppendixNumber { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Term { get; set; } = string.Empty;
    public decimal ContractValue { get; set; }
    public decimal LiquidatedAmount { get; set; }
    public DateOnly SignDate { get; set; }
    public DateOnly? ExpireDate { get; set; }
    public DateOnly? LiquidateDate { get; set; }
    public string SaleId { get; set; } = string.Empty;
    public string? SaleName { get; set; }
    public string Status { get; set; } = string.Empty; // APPROVED, LIQUIDATED, PENDING, ADVANCING
    public string Channel { get; set; } = string.Empty; // APP_FINRA, BO_FINRA, UPSC
    public long BatchId { get; set; }
    public int VersionNum { get; set; } = 1;
    public DateOnly ValidFrom { get; set; }
    public DateOnly ValidTo { get; set; } = new(9999, 12, 31);
    public string Fingerprint { get; set; } = string.Empty;
    public bool IsActiveVersion { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
