namespace FinanceDashboard.Api.Models.Versioned;

public class ContractSettlementTransaction
{
    public long Id { get; set; }
    public Guid TransactionEntityId { get; set; } = Guid.NewGuid();
    public string AppendixNumber { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public DateOnly TransactionDate { get; set; }
    public DateOnly SettlementDate { get; set; }
    public decimal PrincipalAmount { get; set; }
    public string? Term { get; set; }
    public decimal SettlementAmount { get; set; }
    public string SaleId { get; set; } = string.Empty; // ID Sale gắn HĐ
    public string? SaleName { get; set; }
    public string? Channel { get; set; }
    public long BatchId { get; set; }
    public int VersionNum { get; set; } = 1;
    public string Fingerprint { get; set; } = string.Empty;
    public bool IsActiveVersion { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
