using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinanceDashboard.Api.Models;

[Table("app_user")]
public class AppUser
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("username")]
    [MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [Column("password_hash")]
    [MaxLength(255)]
    public string PasswordHash { get; set; } = string.Empty;

    [Column("full_name")]
    [MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Column("role")]
    [MaxLength(20)]
    public string Role { get; set; } = "user";

    [Column("branch_access")]
    [MaxLength(150)]
    public string? BranchAccess { get; set; }

    [Column("permissions", TypeName = "jsonb")]
    public string? Permissions { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("employee_id")]
    [MaxLength(50)]
    public string? EmployeeId { get; set; }

    [Column("can_view_subordinates")]
    public bool CanViewSubordinates { get; set; } = true;

    [Column("subordinate_view_updated_at")]
    public DateTime? SubordinateViewUpdatedAt { get; set; }

    [Column("subordinate_view_updated_by")]
    [MaxLength(50)]
    public string? SubordinateViewUpdatedBy { get; set; }

    [Column("scope_type")]
    [MaxLength(50)]
    public string ScopeType { get; set; } = "ALL";

    [Column("scope_node_id")]
    [MaxLength(100)]
    public string? ScopeNodeId { get; set; }

    [Column("scope_node_name")]
    [MaxLength(255)]
    public string? ScopeNodeName { get; set; }

    [Column("scope_node_role")]
    [MaxLength(100)]
    public string? ScopeNodeRole { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
