using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinanceDashboard.Api.Models;

[Table("early_settlement")]
public class EarlySettlement
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("batch_id")]
    public int BatchId { get; set; }

    [Column("appendix_number")]
    [MaxLength(150)]
    public string AppendixNumber { get; set; } = string.Empty;

    [Column("settlement_amount")]
    public decimal SettlementAmount { get; set; }

    [Column("settlement_type")]
    [MaxLength(50)]
    public string? SettlementType { get; set; }

    [Column("settlement_date")]
    public DateTime? SettlementDate { get; set; }
}
