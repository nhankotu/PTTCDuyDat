namespace FinanceDashboard.Api.DTOs.V1;

public class ReportPeriodDto
{
    public string FromDate { get; set; } = string.Empty;
    public string ToDate { get; set; } = string.Empty;
    public string AsOfDate { get; set; } = string.Empty;
}

public class KpiMetricsDto
{
    public string? TotalSales { get; set; }
    public string? TotalBalance { get; set; }
    public int? TotalCustomers { get; set; }
    public int? TotalContracts { get; set; }
    public string? AvgSizePerContract { get; set; }
    public string? AvgSizePerCustomer { get; set; }
}

public class AccessInfoDto
{
    public bool Revenue { get; set; }
    public bool Balance { get; set; }
    public bool ScopesDiffer { get; set; }
}

public class KpiReportResponse
{
    public string? DatasetId { get; set; }
    public ReportPeriodDto Period { get; set; } = new();
    public KpiMetricsDto Metrics { get; set; } = new();
    public AccessInfoDto Access { get; set; } = new();
    public string DataStatus { get; set; } = "COMPLETE"; // COMPLETE, PARTIAL, UNAVAILABLE
    public List<string> Warnings { get; set; } = new();
}

public class CustomIntervalDto
{
    public string Start { get; set; } = string.Empty;
    public string End { get; set; } = string.Empty;
    public string? Label { get; set; }
}

public class TrendPointDto
{
    public string PeriodLabel { get; set; } = string.Empty;
    public string FromDate { get; set; } = string.Empty;
    public string ToDate { get; set; } = string.Empty;
    public string? TotalSales { get; set; } = "0.00";
    public string? TotalBalance { get; set; } = "0.00";
    public int? ContractCount { get; set; }
    public int? CustomerCount { get; set; }
}

public class PivotItemDto
{
    public string GroupKey { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string? TotalSales { get; set; } = "0.00";
    public string? TotalBalance { get; set; } = "0.00";
    public int? ContractCount { get; set; }
    public int? CustomerCount { get; set; }
    public decimal? SalesSharePercent { get; set; }
    public decimal? BalanceSharePercent { get; set; }
}

public class ContractDetailItemDto
{
    public string AppendixNumber { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Term { get; set; } = string.Empty;
    public string SignDate { get; set; } = string.Empty;
    public string? ExpireDate { get; set; }
    public string? LiquidateDate { get; set; }
    public string SaleId { get; set; } = string.Empty;
    public string? SaleName { get; set; }
    public string EffectiveSaleId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
    public string? ContractValue { get; set; }
    public string? SettledAmount { get; set; }
    public string? Balance { get; set; }
}

public class StockReportResponse
{
    public string? TotalContractValue { get; set; } = "0.00";
    public string? TotalLiquidated { get; set; } = "0.00";
    public string? TotalBalance { get; set; } = "0.00";
    public int? TotalContracts { get; set; }
    public int? TotalCustomers { get; set; }
    public List<StockContractItemDto> Items { get; set; } = new();
}

public class StockContractItemDto
{
    public long Id { get; set; }
    public string AppendixNumber { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string? ContractValue { get; set; } = "0.00";
    public string? LiquidatedAmount { get; set; } = "0.00";
    public string? Balance { get; set; } = "0.00";
    public string SignDate { get; set; } = string.Empty;
    public string? ExpireDate { get; set; }
    public string? LiquidateDate { get; set; }
    public string SaleId { get; set; } = string.Empty;
}

public class CreateDatasetRequest
{
    public string DatasetCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateOnly CutoffDate { get; set; }
    public DateOnly CoverageFrom { get; set; }
    public DateOnly CoverageTo { get; set; }
    public List<ManifestItemRequest> Manifest { get; set; } = new();
    public Guid? PreviousDatasetId { get; set; }
    public string? AmendmentReason { get; set; }
}

public class ManifestItemRequest
{
    public string SourceType { get; set; } = string.Empty;
    public long? SourceBatchId { get; set; }
    public bool IsConfirmedNoMovement { get; set; }
    public string? Notes { get; set; }
}
