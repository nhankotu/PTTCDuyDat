using System.Text.Json;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly FinanceDbContext _dbContext;

    public UsersController(FinanceDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    private bool IsAdmin()
    {
        var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        return role == "admin";
    }

    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> GetUsers()
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var users = await _dbContext.AppUsers
            .OrderByDescending(u => u.Id)
            .Select(u => new UserDto
            {
                Id = u.Id,
                Username = u.Username,
                FullName = u.FullName,
                Role = u.Role,
                BranchAccess = u.BranchAccess,
                ScopeType = u.ScopeType,
                ScopeNodeId = u.ScopeNodeId,
                ScopeNodeName = u.ScopeNodeName,
                ScopeNodeRole = u.ScopeNodeRole,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserDto req)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
        {
            return BadRequest(new { message = "Vui lòng nhập tên đăng nhập và mật khẩu." });
        }

        var normalizedUsername = req.Username.Trim().ToLowerInvariant();

        var exists = await _dbContext.AppUsers.AnyAsync(u => u.Username.ToLower() == normalizedUsername);
        if (exists || normalizedUsername == "admin")
        {
            return Conflict(new { message = $"Tên đăng nhập '{req.Username}' đã tồn tại trong hệ thống." });
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);

        var newUser = new AppUser
        {
            Username = normalizedUsername,
            PasswordHash = passwordHash,
            FullName = string.IsNullOrWhiteSpace(req.FullName) ? req.Username : req.FullName.Trim(),
            Role = req.Role == "admin" ? "admin" : "user",
            BranchAccess = string.IsNullOrWhiteSpace(req.BranchAccess) ? null : req.BranchAccess.Trim(),
            ScopeType = string.IsNullOrWhiteSpace(req.ScopeType) ? "ALL" : req.ScopeType.Trim(),
            ScopeNodeId = string.IsNullOrWhiteSpace(req.ScopeNodeId) ? null : req.ScopeNodeId.Trim(),
            ScopeNodeName = string.IsNullOrWhiteSpace(req.ScopeNodeName) ? null : req.ScopeNodeName.Trim(),
            ScopeNodeRole = string.IsNullOrWhiteSpace(req.ScopeNodeRole) ? null : req.ScopeNodeRole.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.AppUsers.Add(newUser);
        await _dbContext.SaveChangesAsync();

        return Ok(new UserDto
        {
            Id = newUser.Id,
            Username = newUser.Username,
            FullName = newUser.FullName,
            Role = newUser.Role,
            BranchAccess = newUser.BranchAccess,
            ScopeType = newUser.ScopeType,
            ScopeNodeId = newUser.ScopeNodeId,
            ScopeNodeName = newUser.ScopeNodeName,
            ScopeNodeRole = newUser.ScopeNodeRole,
            CreatedAt = newUser.CreatedAt
        });
    }

    [HttpPut("{id:int}/permission-scope")]
    public async Task<ActionResult> UpdatePermissionScope(int id, [FromBody] UpdateUserScopeDto req)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var user = await _dbContext.AppUsers.FindAsync(id);
        if (user == null)
        {
            return NotFound(new { message = "Không tìm thấy người dùng." });
        }

        user.ScopeType = string.IsNullOrWhiteSpace(req.ScopeType) ? "ALL" : req.ScopeType.Trim();
        user.ScopeNodeId = string.IsNullOrWhiteSpace(req.ScopeNodeId) ? null : req.ScopeNodeId.Trim();
        user.ScopeNodeName = string.IsNullOrWhiteSpace(req.ScopeNodeName) ? null : req.ScopeNodeName.Trim();
        user.ScopeNodeRole = string.IsNullOrWhiteSpace(req.ScopeNodeRole) ? null : req.ScopeNodeRole.Trim();

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Cập nhật quyền truy cập thành công.",
            user = new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                FullName = user.FullName,
                Role = user.Role,
                BranchAccess = user.BranchAccess,
                ScopeType = user.ScopeType,
                ScopeNodeId = user.ScopeNodeId,
                ScopeNodeName = user.ScopeNodeName,
                ScopeNodeRole = user.ScopeNodeRole,
                CreatedAt = user.CreatedAt
            }
        });
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult> DeleteUser(int id)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var user = await _dbContext.AppUsers.FindAsync(id);
        if (user == null)
        {
            return NotFound(new { message = "Không tìm thấy người dùng." });
        }

        if (user.Username.ToLower() == "admin")
        {
            return BadRequest(new { message = "Không thể xóa tài khoản Quản trị viên gốc (admin)." });
        }

        var currentUsername = User.Identity?.Name;
        if (user.Username.Equals(currentUsername, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Bạn không thể tự xóa tài khoản của chính mình." });
        }

        _dbContext.AppUsers.Remove(user);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = $"Đã xóa tài khoản {user.Username} thành công." });
    }

    [HttpPut("{id:int}/password")]
    public async Task<ActionResult> ChangePassword(int id, [FromBody] ChangePasswordDto req)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "Mật khẩu mới phải có tối thiểu 6 ký tự." });
        }

        var user = await _dbContext.AppUsers.FindAsync(id);
        if (user == null)
        {
            return NotFound(new { message = "Không tìm thấy người dùng." });
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        
        // Revoke all refresh tokens for this user so they must re-login
        var tokens = await _dbContext.UserRefreshTokens.Where(t => t.UserId == user.Id && !t.IsRevoked).ToListAsync();
        foreach (var t in tokens)
        {
            t.IsRevoked = true;
            t.RevokedAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new { message = $"Đã đổi mật khẩu cho tài khoản {user.Username} thành công." });
    }

    [HttpPut("{id:int}/toggle-status")]
    public async Task<ActionResult> ToggleUserStatus(int id)
    {
        if (!IsAdmin()) return Forbid();

        var user = await _dbContext.AppUsers.FindAsync(id);
        if (user == null) return NotFound(new { message = "Không tìm thấy người dùng." });

        if (user.Username.ToLower() == "admin")
        {
            return BadRequest(new { message = "Không thể khóa tài khoản admin gốc." });
        }

        user.IsActive = !user.IsActive;

        if (!user.IsActive)
        {
            // Revoke all active tokens immediately
            var tokens = await _dbContext.UserRefreshTokens.Where(t => t.UserId == user.Id && !t.IsRevoked).ToListAsync();
            foreach (var t in tokens)
            {
                t.IsRevoked = true;
                t.RevokedAt = DateTime.UtcNow;
            }
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new { message = $"Tài khoản {user.Username} hiện đang {(user.IsActive ? "hoạt động" : "bị khóa")}." });
    }
}
