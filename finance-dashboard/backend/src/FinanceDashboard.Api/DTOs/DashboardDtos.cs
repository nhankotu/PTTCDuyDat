namespace FinanceDashboard.Api.DTOs;

public class DashboardKpiDto
{
    public int BatchId { get; set; }
    public DateTime ReportDate { get; set; }
    public string? Branch { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal RevenueUpsc { get; set; }
    public decimal RevenueFinra { get; set; }
    public decimal TotalBalanceCurrent { get; set; }
    public decimal NetGrowth { get; set; }
    public int NewCustomers { get; set; }
    public decimal TargetAmount { get; set; } = 138600000000m; // Chỉ tiêu tháng mẫu
    public decimal CompletionRate => TargetAmount > 0 ? Math.Round(TotalRevenue / TargetAmount * 100, 1) : 0;
    public decimal BookRate { get; set; } = 112.0m;
    public int TotalContracts { get; set; }
    public int ActiveContracts { get; set; }
}

public class WeeklyTrendItemDto
{
    public string WeekLabel { get; set; } = string.Empty;
    public string DateRange { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public decimal EndBalance { get; set; }
}

public class DimensionStatItemDto
{
    public string Name { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public decimal Balance { get; set; }
    public int ContractCount { get; set; }
    public double RevenuePercentage { get; set; }
    public double BalancePercentage { get; set; }
}

public class MultiDimensionQueryDto
{
    public int BatchId { get; set; }
    public string Dimension { get; set; } = "product"; // product, term, branch, sale, channel
    public string Period { get; set; } = "month";      // day, week, month, quarter
    public string? Branch { get; set; }
    public string? Product { get; set; }
    public string? Term { get; set; }
    public string? Channel { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
}

public class PeriodGroupStatDto
{
    public string PeriodLabel { get; set; } = string.Empty;
    public string PeriodKey { get; set; } = string.Empty;
    public decimal TotalRevenue { get; set; }
    public decimal TotalBalance { get; set; }
    public List<DimensionStatItemDto> Items { get; set; } = new();
}
