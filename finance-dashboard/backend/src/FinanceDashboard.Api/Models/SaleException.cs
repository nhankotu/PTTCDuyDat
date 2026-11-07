using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinanceDashboard.Api.Models;

[Table("sale_exception")]
public class SaleException
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("batch_id")]
    public int BatchId { get; set; }

    [Column("appendix_number")]
    [MaxLength(150)]
    public string AppendixNumber { get; set; } = string.Empty;

    [Column("effective_sale_id")]
    [MaxLength(50)]
    public string EffectiveSaleId { get; set; } = string.Empty;
}
