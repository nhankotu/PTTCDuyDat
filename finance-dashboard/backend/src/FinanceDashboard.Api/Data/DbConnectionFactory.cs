using System.Data;
using Npgsql;

namespace FinanceDashboard.Api.Data;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
    NpgsqlConnection CreateNpgsqlConnection();
}

public class DbConnectionFactory : IDbConnectionFactory
{
    private const string DefaultLocalConnectionString =
        "Host=localhost;Port=5432;Database=finra_finance;Username=finra_admin;Password=finra_secret_pass_2026";

    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString = ResolveConnectionString(configuration);
    }

    /// <summary>
    /// Resolves PostgreSQL connection string from configuration/DATABASE_URL and converts
    /// postgres:// or postgresql:// URIs (used by Render) into Npgsql key-value format.
    /// </summary>
    public static string ResolveConnectionString(IConfiguration configuration)
    {
        var raw = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(raw))
        {
            raw = configuration["DATABASE_URL"];
        }
        if (string.IsNullOrWhiteSpace(raw))
        {
            return DefaultLocalConnectionString;
        }

        if (!raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return raw;
        }

        var uri = new Uri(raw);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : string.Empty,
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty,
            SslMode = SslMode.Prefer,
        };

        return builder.ConnectionString;
    }

    public IDbConnection CreateConnection() => new NpgsqlConnection(_connectionString);
    public NpgsqlConnection CreateNpgsqlConnection() => new NpgsqlConnection(_connectionString);
}
