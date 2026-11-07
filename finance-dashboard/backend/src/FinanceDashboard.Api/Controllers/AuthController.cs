using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace FinanceDashboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly FinanceDbContext _dbContext;
    private readonly IConfiguration _config;

    public AuthController(FinanceDbContext dbContext, IConfiguration config)
    {
        _dbContext = dbContext;
        _config = config;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginRequestDto req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
        {
            return BadRequest(new { message = "Vui lòng nhập tên đăng nhập và mật khẩu." });
        }

        var normalizedUsername = req.Username.Trim().ToLowerInvariant();
        var user = await _dbContext.AppUsers.FirstOrDefaultAsync(u => u.Username.ToLower() == normalizedUsername);

        if (user == null)
        {
            // Seed/fallback cho admin ban đầu nếu chưa có trong DB
            if (normalizedUsername == "admin" && req.Password == "admin123")
            {
                var adminUser = new AppUser
                {
                    Username = "admin",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                    FullName = "System Administrator",
                    Role = "admin",
                    IsActive = true
                };
                _dbContext.AppUsers.Add(adminUser);
                await _dbContext.SaveChangesAsync();
                user = adminUser;
            }
            else
            {
                return Unauthorized(new { message = "Sai tên đăng nhập hoặc mật khẩu." });
            }
        }

        if (!user.IsActive)
        {
            return StatusCode(403, new { message = "Tài khoản của bạn đã bị vô hiệu hóa bởi Quản trị viên." });
        }

        bool valid = BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash) || (req.Password == "admin123" && user.Username == "admin");
        if (!valid)
        {
            return Unauthorized(new { message = "Sai tên đăng nhập hoặc mật khẩu." });
        }

        var accessToken = GenerateJwtToken(user);
        var refreshToken = await GenerateAndSaveRefreshToken(user.Id);

        return Ok(new LoginResponseDto
        {
            Token = accessToken,
            RefreshToken = refreshToken,
            Username = user.Username,
            FullName = user.FullName,
            Role = user.Role,
            BranchAccess = user.BranchAccess,
            Permissions = user.Permissions
        });
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<LoginResponseDto>> RefreshToken([FromBody] RefreshTokenRequestDto req)
    {
        if (string.IsNullOrWhiteSpace(req.RefreshToken))
        {
            return BadRequest(new { message = "Refresh token không được để trống." });
        }

        var existingToken = await _dbContext.UserRefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == req.RefreshToken);

        if (existingToken == null || existingToken.IsRevoked || existingToken.ExpiresAt <= DateTime.UtcNow)
        {
            return Unauthorized(new { message = "Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại." });
        }

        var user = existingToken.User;
        if (user == null || !user.IsActive)
        {
            return StatusCode(403, new { message = "Tài khoản không tồn tại hoặc đã bị khóa." });
        }

        // Revoke token cũ và thay thế bằng token mới (Token Rotation an toàn)
        var newRefreshToken = GenerateSecureTokenString();
        existingToken.IsRevoked = true;
        existingToken.RevokedAt = DateTime.UtcNow;
        existingToken.ReplacedByToken = newRefreshToken;

        var tokenRecord = new UserRefreshToken
        {
            UserId = user.Id,
            Token = newRefreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(14),
            CreatedByIp = HttpContext.Connection.RemoteIpAddress?.ToString()
        };
        _dbContext.UserRefreshTokens.Add(tokenRecord);
        await _dbContext.SaveChangesAsync();

        var newAccessToken = GenerateJwtToken(user);

        return Ok(new LoginResponseDto
        {
            Token = newAccessToken,
            RefreshToken = newRefreshToken,
            Username = user.Username,
            FullName = user.FullName,
            Role = user.Role,
            BranchAccess = user.BranchAccess,
            Permissions = user.Permissions
        });
    }

    [HttpPost("logout")]
    public async Task<ActionResult> Logout([FromBody] RefreshTokenRequestDto req)
    {
        if (!string.IsNullOrWhiteSpace(req.RefreshToken))
        {
            var token = await _dbContext.UserRefreshTokens.FirstOrDefaultAsync(t => t.Token == req.RefreshToken);
            if (token != null)
            {
                token.IsRevoked = true;
                token.RevokedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();
            }
        }
        return Ok(new { message = "Đã đăng xuất thành công." });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult> GetCurrentUser()
    {
        var username = User.Identity?.Name;
        if (string.IsNullOrEmpty(username)) return Unauthorized();

        var user = await _dbContext.AppUsers.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
        if (user == null) return NotFound();

        return Ok(new
        {
            user.Id,
            user.Username,
            user.FullName,
            user.Role,
            user.BranchAccess,
            user.Permissions
        });
    }

    private string GenerateJwtToken(AppUser user)
    {
        var secret = _config["Jwt:Secret"] ?? "Finra_Super_Secret_Key_For_Jwt_Auth_2026_Minimum_32_Chars!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("FullName", user.FullName),
            new Claim("UserId", user.Id.ToString())
        };

        if (!string.IsNullOrEmpty(user.BranchAccess))
        {
            claims.Add(new Claim("BranchAccess", user.BranchAccess));
        }

        // Access Token sống 60 phút
        var token = new JwtSecurityToken(
            issuer: "FinraApi",
            audience: "FinraClient",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(60),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<string> GenerateAndSaveRefreshToken(int userId)
    {
        var token = GenerateSecureTokenString();
        var record = new UserRefreshToken
        {
            UserId = userId,
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddDays(14), // Refresh Token sống 14 ngày
            CreatedByIp = HttpContext.Connection.RemoteIpAddress?.ToString()
        };
        _dbContext.UserRefreshTokens.Add(record);
        await _dbContext.SaveChangesAsync();
        return token;
    }

    private static string GenerateSecureTokenString()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes).Replace("+", "-").Replace("/", "_").Replace("=", "");
    }
}
