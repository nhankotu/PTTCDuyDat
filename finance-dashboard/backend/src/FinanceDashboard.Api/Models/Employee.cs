using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinanceDashboard.Api.Models;

[Table("employee")]
public class Employee
{
    [Key]
    [Column("id")]
    [MaxLength(50)]
    public string Id { get; set; } = string.Empty;

    [Column("full_name")]
    [MaxLength(200)]
    public string FullName { get; set; } = string.Empty;

    [Column("branch_name")]
    [MaxLength(150)]
    public string? BranchName { get; set; }

    [Column("department_name")]
    [MaxLength(150)]
    public string? DepartmentName { get; set; }

    [Column("manager_id")]
    [MaxLength(50)]
    public string? ManagerId { get; set; }

    [Column("batch_id")]
    public int? BatchId { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
