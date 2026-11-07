using FinanceDashboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Data;

public class FinanceDbContext : DbContext
{
    public FinanceDbContext(DbContextOptions<FinanceDbContext> options) : base(options) { }

    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Contract> Contracts => Set<Contract>();
    public DbSet<ContractDailyBalance> ContractDailyBalances => Set<ContractDailyBalance>();
    public DbSet<EarlySettlement> EarlySettlements => Set<EarlySettlement>();
    public DbSet<SaleException> SaleExceptions => Set<SaleException>();
    public DbSet<ExcludedContract> ExcludedContracts => Set<ExcludedContract>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<UserRefreshToken> UserRefreshTokens => Set<UserRefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ImportBatch>()
            .HasIndex(b => b.FileSha256)
            .IsUnique();

        modelBuilder.Entity<Contract>()
            .HasIndex(c => new { c.BatchId, c.SignDate });

        modelBuilder.Entity<Contract>()
            .HasIndex(c => new { c.BatchId, c.ProductGroup });

        modelBuilder.Entity<Contract>()
            .HasIndex(c => new { c.BatchId, c.SaleBranch });

        modelBuilder.Entity<ContractDailyBalance>()
            .HasIndex(b => new { b.BatchId, b.BalanceDate });
    }
}
