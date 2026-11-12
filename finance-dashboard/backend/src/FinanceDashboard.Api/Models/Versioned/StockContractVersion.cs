namespace FinanceDashboard.Api.Models.Versioned;

public class StockContractVersion
{
    public long Id { get; set; }
    public Guid EntityId { get; set; } = Guid.NewGuid();
    public string AppendixNumber { get; set; } = string.Empty; // Cho phép trùng nhau
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public decimal ContractValue { get; set; }
    public decimal LiquidatedAmount { get; set; }
    public DateOnly SignDate { get; set; }
    public DateOnly? ExpireDate { get; set; }
    public DateOnly? LiquidateDate { get; set; }
    public string SaleId { get; set; } = string.Empty;
    public long BatchId { get; set; }
    public int VersionNum { get; set; } = 1;
    public string Fingerprint { get; set; } = string.Empty;
    public bool IsActiveVersion { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
