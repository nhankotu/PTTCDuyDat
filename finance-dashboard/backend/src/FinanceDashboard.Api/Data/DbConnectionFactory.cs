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
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
    }

    public IDbConnection CreateConnection() => new NpgsqlConnection(_connectionString);
    public NpgsqlConnection CreateNpgsqlConnection() => new NpgsqlConnection(_connectionString);
}
