using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinanceDashboard.Api.Models;

[Table("excluded_contract")]
public class ExcludedContract
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("batch_id")]
    public int? BatchId { get; set; }

    [Column("source_batch_id")]
    public long? SourceBatchId { get; set; }

    [Column("appendix_number")]
    [MaxLength(150)]
    public string AppendixNumber { get; set; } = string.Empty;

    [Column("marked_by")]
    [MaxLength(100)]
    public string? MarkedBy { get; set; }

    [Column("marked_at")]
    public DateTime? MarkedAt { get; set; }
}
