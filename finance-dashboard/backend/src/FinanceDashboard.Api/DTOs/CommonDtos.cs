namespace FinanceDashboard.Api.DTOs;

public class UploadResultDto
{
    public int BatchId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public DateTime ReportDate { get; set; }
    public int TotalRows { get; set; }
    public decimal TotalValue { get; set; }
    public decimal TotalBalance { get; set; }
    public int TotalEmployees { get; set; }
    public int TotalEarlySettlements { get; set; }
    public int TotalExceptions { get; set; }
    public int TotalExcluded { get; set; }
    public string Status { get; set; } = "SUCCESS";
    public string Message { get; set; } = string.Empty;
    public double ElapsedSeconds { get; set; }
}

public class ContractFilterDto
{
    public int BatchId { get; set; }
    public string? Branch { get; set; }
    public string? ProductGroup { get; set; }
    public string? TermGroup { get; set; }
    public string? DsType { get; set; }
    public string? Status { get; set; }
    public string? Search { get; set; }
    public DateTime? SignDateFrom { get; set; }
    public DateTime? SignDateTo { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
    public string? SortBy { get; set; }
    public string SortDir { get; set; } = "asc";
}

public class PagedResultDto<T>
{
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalRows { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalRows / PageSize);
    public List<T> Data { get; set; } = new();
}

public class LoginRequestDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? BranchAccess { get; set; }
    public string? Permissions { get; set; }
}

public class RefreshTokenRequestDto
{
    public string RefreshToken { get; set; } = string.Empty;
}

public class UserDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = "user";
    public string? BranchAccess { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateUserDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = "user"; // admin, user
    public string? BranchAccess { get; set; }   // null = all branches
}

public class ChangePasswordDto
{
    public string NewPassword { get; set; } = string.Empty;
}
