using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinanceDashboard.Api.Models;

[Table("import_batch")]
public class ImportBatch
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("file_name")]
    [MaxLength(300)]
    public string FileName { get; set; } = string.Empty;

    [Column("file_sha256")]
    [MaxLength(64)]
    public string FileSha256 { get; set; } = string.Empty;

    [Column("report_date")]
    public DateTime ReportDate { get; set; }

    [Column("storage_key")]
    [MaxLength(500)]
    public string? StorageKey { get; set; }

    [Column("total_rows")]
    public int TotalRows { get; set; }

    [Column("total_value")]
    public decimal TotalValue { get; set; }

    [Column("total_balance")]
    public decimal TotalBalance { get; set; }

    [Column("status")]
    [MaxLength(20)]
    public string Status { get; set; } = "PROCESSING";

    [Column("error_message")]
    public string? ErrorMessage { get; set; }

    [Column("uploaded_by")]
    [MaxLength(100)]
    public string UploadedBy { get; set; } = "system";

    [Column("uploaded_at")]
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
