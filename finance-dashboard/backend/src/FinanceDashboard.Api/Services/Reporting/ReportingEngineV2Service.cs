using System.Data;
using System.Globalization;
using Dapper;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs.V1;
using FinanceDashboard.Api.Models.Versioned;
using FinanceDashboard.Api.Services.Authorization;

namespace FinanceDashboard.Api.Services.Reporting;

public class ReportingEngineV2Service
{
    private readonly DbConnectionFactory _db;
    private readonly DataAccessScopeService _scopeService;
    private readonly ILogger<ReportingEngineV2Service> _logger;

    public ReportingEngineV2Service(
        DbConnectionFactory db,
        DataAccessScopeService scopeService,
        ILogger<ReportingEngineV2Service> logger)
    {
        _db = db;
        _scopeService = scopeService;
        _logger = logger;
    }

    private static string? FormatDate(object? val)
    {
        if (val == null) return null;
        if (val is DateOnly d) return d.ToString("yyyy-MM-dd");
        if (val is DateTime dt) return dt.ToString("yyyy-MM-dd");
        if (DateOnly.TryParse(val.ToString(), out var parsed)) return parsed.ToString("yyyy-MM-dd");
        return val.ToString();
    }

    public async Task<KpiReportResponse> GetKpiReportAsync(
        int userId,
        DateOnly fromDate,
        DateOnly toDate,
        DateOnly? asOfDate = null,
        Guid? datasetId = null,
        string? filterEmployeeId = null,
        string? filterProduct = null,
        string? filterTerm = null,
        string? viewEmployeeId = null, string view = "subtree", ReportFilters? filters = null)
    {
        filters ??= new();
        filters.Validate();
        var targetAsOf = asOfDate ?? toDate;
        var scope = await _scopeService.GetReportScopeAsync(userId, viewEmployeeId, view, datasetId);

        // Check if user has zero access
        if (!scope.CanAccessAll && scope.RevenueScope.Count == 0 && scope.BalanceScope.Count == 0)
        {
            return new KpiReportResponse
            {
                DatasetId = datasetId?.ToString(),
                Period = new ReportPeriodDto
                {
                    FromDate = fromDate.ToString("yyyy-MM-dd"),
                    ToDate = toDate.ToString("yyyy-MM-dd"),
                    AsOfDate = targetAsOf.ToString("yyyy-MM-dd")
                },
                Metrics = new KpiMetricsDto(),
                Access = new AccessInfoDto { Revenue = false, Balance = false, ScopesDiffer = false },
                DataStatus = "UNAVAILABLE",
                Warnings = new List<string> { "Tài khoản hiện không được cấp quyền truy cập dữ liệu kinh doanh." }
            };
        }

        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        // R05 & R19: Check dataset manifest if datasetId is supplied
        List<long> manifestBatches = new();
        if (datasetId.HasValue)
        {
            var dataset = await connection.QueryFirstOrDefaultAsync<ReportDataset>(@"
                SELECT * FROM report_dataset WHERE id = @DatasetId;", new { DatasetId = datasetId.Value });

            if (dataset == null || !dataset.IsPublished)
            {
                return new KpiReportResponse
                {
                    DatasetId = datasetId.Value.ToString(),
                    Period = new ReportPeriodDto
                    {
                        FromDate = fromDate.ToString("yyyy-MM-dd"),
                        ToDate = toDate.ToString("yyyy-MM-dd"),
                        AsOfDate = targetAsOf.ToString("yyyy-MM-dd")
                    },
                    Metrics = new KpiMetricsDto(),
                    Access = new AccessInfoDto { Revenue = false, Balance = false, ScopesDiffer = false },
                    DataStatus = "UNAVAILABLE",
                    Warnings = new List<string> { "Dataset chưa được công bố hoặc không tồn tại." }
                };
            }

            var batchIds = (await connection.QueryAsync<long?>(@"
                SELECT source_batch_id FROM dataset_source_manifest 
                WHERE dataset_id = @DatasetId AND source_batch_id IS NOT NULL;", 
                new { DatasetId = datasetId.Value })).Where(b => b.HasValue).Select(b => b!.Value).ToList();

            manifestBatches.AddRange(batchIds);
        }

        // Build scope parameters
        var (revScopeList, balScopeList) = ResolveScopes(scope, filterEmployeeId);

        // Scope filters for SQL (R17: apply filterEmployeeId unconditionally when specified)
        string scopeRevClause;
        if (!string.IsNullOrEmpty(filterEmployeeId) && scope.CanAccessAll)
        {
            scopeRevClause = "AND COALESCE(e.new_sale_id, c.sale_id) = @FilterEmployeeId ";
        }
        else if (!scope.CanAccessAll)
        {
            scopeRevClause = "AND COALESCE(e.new_sale_id, c.sale_id) = ANY(@RevScope) ";
        }
        else
        {
            scopeRevClause = "";
        }

        string scopeBalClause;
        if (!string.IsNullOrEmpty(filterEmployeeId) && scope.CanAccessAll)
        {
            scopeBalClause = "AND COALESCE(e.new_sale_id, c.sale_id) = @FilterEmployeeId ";
        }
        else if (!scope.CanAccessAll)
        {
            scopeBalClause = "AND COALESCE(e.new_sale_id, c.sale_id) = ANY(@BalScope) ";
        }
        else
        {
            scopeBalClause = "";
        }

        string manifestClause = datasetId.HasValue 
            ? "AND c.batch_id = ANY(@ManifestBatches) " 
            : "";
        string manifestSettleClause = datasetId.HasValue 
            ? "AND batch_id = ANY(@ManifestBatches) " 
            : "";

        // 1. Total Sales & Sales Metrics (Scope = RevenueScope)
        decimal totalSales = 0m;
        int totalContracts = 0;
        int totalCustomers = 0;

        bool hasRevAccess = scope.CanAccessAll || revScopeList.Count > 0;
        if (hasRevAccess)
        {
            var salesSql = $@"
                WITH resolved_contracts AS (
                    SELECT DISTINCT ON (c.appendix_number)
                        c.appendix_number,
                        c.customer_code,
                        c.contract_value,
                        c.sign_date,
                        COALESCE(e.new_sale_id, c.sale_id) AS effective_sale_id
                    FROM contract_appendix_version c
                    LEFT JOIN contract_exception_version e 
                           ON e.appendix_number = c.appendix_number 
                          AND e.effective_date <= @ToDate
                          AND (e.expire_date IS NULL OR e.expire_date > @ToDate)
                    WHERE c.status IN ('APPROVED', 'LIQUIDATED')
                      AND c.sign_date >= @FromDate AND c.sign_date <= @ToDate
                      AND c.valid_from <= @ToDate AND c.valid_to > @FromDate
                      AND c.appendix_number NOT IN (SELECT appendix_number FROM excluded_contract)
                      {manifestClause}
                      {ReportFilters.Clause}
                      {(string.IsNullOrEmpty(filterProduct) ? "" : "AND c.product_name = @FilterProduct ")}
                      {(string.IsNullOrEmpty(filterTerm) ? "" : "AND c.term = @FilterTerm ")}
                      {scopeRevClause}
                    ORDER BY c.appendix_number, c.version_num DESC
                )
                SELECT 
                    COALESCE(SUM(contract_value), 0) AS TotalSales,
                    COUNT(appendix_number) AS TotalContracts,
                    COUNT(DISTINCT customer_code) AS TotalCustomers
                FROM resolved_contracts;";

            var salesResult = await connection.QueryFirstOrDefaultAsync<dynamic>(salesSql, filters.Bind(new
            {
                FromDate = fromDate,
                ToDate = toDate,
                FilterProduct = filterProduct,
                FilterTerm = filterTerm,
                FilterEmployeeId = filterEmployeeId,
                RevScope = revScopeList.ToArray(),
                ManifestBatches = manifestBatches.ToArray()
            }, scope));

            if (salesResult != null)
            {
                totalSales = (decimal)salesResult.totalsales;
                totalContracts = (int)salesResult.totalcontracts;
                totalCustomers = (int)salesResult.totalcustomers;
            }
        }

        // 2. Total Balance (Scope = BalanceScope, as of targetAsOf - R05: Immutability via valid_from / valid_to)
        decimal totalBalance = 0m;
        bool hasBalAccess = scope.CanAccessAll || balScopeList.Count > 0;

        if (hasBalAccess)
        {
            var balanceSql = $@"
                WITH resolved_contracts AS (
                    SELECT DISTINCT ON (c.appendix_number)
                        c.appendix_number,
                        c.contract_value,
                        c.liquidated_amount,
                        c.liquidate_date,
                        COALESCE(e.new_sale_id, c.sale_id) AS effective_sale_id
                    FROM contract_appendix_version c
                    LEFT JOIN contract_exception_version e 
                           ON e.appendix_number = c.appendix_number 
                          AND e.effective_date <= @AsOfDate
                          AND (e.expire_date IS NULL OR e.expire_date > @AsOfDate)
                    WHERE c.status IN ('APPROVED', 'LIQUIDATED')
                      AND c.sign_date <= @AsOfDate
                      AND c.valid_from <= @AsOfDate AND c.valid_to > @AsOfDate
                      {manifestClause}
                      {ReportFilters.Clause}
                      {(string.IsNullOrEmpty(filterProduct) ? "" : "AND c.product_name = @FilterProduct ")}
                      {(string.IsNullOrEmpty(filterTerm) ? "" : "AND c.term = @FilterTerm ")}
                      {scopeBalClause}
                    ORDER BY c.appendix_number, c.version_num DESC
                ),
                settlements AS (
                    SELECT 
                        appendix_number,
                        SUM(settlement_amount) AS total_settled
                    FROM contract_settlement_transaction
                    WHERE is_active_version = TRUE
                      AND settlement_date <= @AsOfDate
                      {manifestSettleClause}
                    GROUP BY appendix_number
                )
                SELECT 
                    COALESCE(SUM({ReportFilters.BalanceExpr("rc", "s")}), 0) AS TotalBalance
                FROM resolved_contracts rc
                LEFT JOIN settlements s ON s.appendix_number = rc.appendix_number;";

            totalBalance = await connection.ExecuteScalarAsync<decimal>(balanceSql, filters.Bind(new
            {
                AsOfDate = targetAsOf,
                FilterProduct = filterProduct,
                FilterTerm = filterTerm,
                FilterEmployeeId = filterEmployeeId,
                BalScope = balScopeList.ToArray(),
                ManifestBatches = manifestBatches.ToArray()
            }, scope));
        }

        // Calculate averages with AwayFromZero
        decimal avgPerContract = totalContracts > 0
            ? Math.Round(totalSales / totalContracts, 2, MidpointRounding.AwayFromZero)
            : 0m;

        decimal avgPerCustomer = totalCustomers > 0
            ? Math.Round(totalSales / totalCustomers, 2, MidpointRounding.AwayFromZero)
            : 0m;

        return new KpiReportResponse
        {
            DatasetId = datasetId?.ToString(),
            Period = new ReportPeriodDto
            {
                FromDate = fromDate.ToString("yyyy-MM-dd"),
                ToDate = toDate.ToString("yyyy-MM-dd"),
                AsOfDate = targetAsOf.ToString("yyyy-MM-dd")
            },
            Metrics = new KpiMetricsDto
            {
                TotalSales = hasRevAccess ? totalSales.ToString("F2", CultureInfo.InvariantCulture) : null,
                TotalBalance = hasBalAccess ? totalBalance.ToString("F2", CultureInfo.InvariantCulture) : null,
                TotalContracts = hasRevAccess ? totalContracts : null,
                TotalCustomers = hasRevAccess ? totalCustomers : null,
                AvgSizePerContract = hasRevAccess ? avgPerContract.ToString("F2", CultureInfo.InvariantCulture) : null,
                AvgSizePerCustomer = hasRevAccess ? avgPerCustomer.ToString("F2", CultureInfo.InvariantCulture) : null
            },
            Access = new AccessInfoDto
            {
                Revenue = hasRevAccess,
                Balance = hasBalAccess,
                ScopesDiffer = scope.ScopesDiffer
            },
            DataStatus = "COMPLETE",
            Warnings = new List<string>()
        };
    }

    public async Task<List<TrendPointDto>> GetTrendReportAsync(
        int userId,
        DateOnly fromDate,
        DateOnly toDate,
        string period = "week",
        string? filterEmployeeId = null,
        Guid? datasetId = null,
        string? weekMode = "standard",
        string? customIntervalsJson = null,
        string? viewEmployeeId = null, string view = "subtree", ReportFilters? filters = null)
    {
        filters ??= new();
        filters.Validate();
        var points = new List<TrendPointDto>();
        var intervals = GenerateTimeIntervals(fromDate, toDate, period, weekMode, customIntervalsJson);

        foreach (var (pStart, pEnd, label) in intervals)
        {
            var kpi = await GetKpiReportAsync(userId, pStart, pEnd, asOfDate: pEnd, filterEmployeeId: filterEmployeeId, datasetId: datasetId, viewEmployeeId: viewEmployeeId, view: view, filters: filters);

            points.Add(new TrendPointDto
            {
                PeriodLabel = label,
                FromDate = pStart.ToString("yyyy-MM-dd"),
                ToDate = pEnd.ToString("yyyy-MM-dd"),
                TotalSales = kpi.Metrics.TotalSales,
                TotalBalance = kpi.Metrics.TotalBalance,
                ContractCount = kpi.Metrics.TotalContracts,
                CustomerCount = kpi.Metrics.TotalCustomers
            });
        }

        return points;
    }

    public async Task<List<PivotItemDto>> GetPivotReportAsync(
        int userId,
        DateOnly fromDate,
        DateOnly toDate,
        string groupBy = "product",
        string? filterEmployeeId = null,
        Guid? datasetId = null,
        string? viewEmployeeId = null, string view = "subtree", ReportFilters? filters = null)
    {
        filters ??= new();
        filters.Validate();
        var asOfDate = toDate;
        var scope = await _scopeService.GetReportScopeAsync(userId, viewEmployeeId, view, datasetId);
        var (revScopeList, balScopeList) = ResolveScopes(scope, filterEmployeeId);

        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        List<long> manifestBatches = new();
        if (datasetId.HasValue)
        {
            var batchIds = (await connection.QueryAsync<long?>(@"
                SELECT source_batch_id FROM dataset_source_manifest 
                WHERE dataset_id = @DatasetId AND source_batch_id IS NOT NULL;", 
                new { DatasetId = datasetId.Value })).Where(b => b.HasValue).Select(b => b!.Value).ToList();
            manifestBatches.AddRange(batchIds);
        }

        string groupExpr;
        string joinExtra = "";

        switch (groupBy.ToLowerInvariant())
        {
            case "term":
                groupExpr = "rc.term";
                break;
            case "channel":
                groupExpr = "rc.channel";
                break;
            case "sale":
                groupExpr = "rc.effective_sale_id";
                break;
            case "branch":
                joinExtra = "LEFT JOIN employee_history emp ON emp.employee_id = rc.effective_sale_id AND emp.valid_from <= @AsOfDate AND emp.valid_to > @AsOfDate ";
                groupExpr = "COALESCE(emp.branch, 'Chưa gán CN')";
                break;
            default:
                groupExpr = "rc.product_name";
                break;
        }

        string revFilter = scope.CanAccessAll && !string.IsNullOrEmpty(filterEmployeeId)
            ? "AND rc.effective_sale_id = @FilterEmployeeId "
            : (scope.CanAccessAll ? "" : "AND rc.effective_sale_id = ANY(@RevScope) ");

        string balFilter = scope.CanAccessAll && !string.IsNullOrEmpty(filterEmployeeId)
            ? "AND rc.effective_sale_id = @FilterEmployeeId "
            : (scope.CanAccessAll ? "" : "AND rc.effective_sale_id = ANY(@BalScope) ");

        string manifestClause = datasetId.HasValue 
            ? "AND c.batch_id = ANY(@ManifestBatches) " 
            : "";
        string manifestSettleClause = datasetId.HasValue 
            ? "AND batch_id = ANY(@ManifestBatches) " 
            : "";

        var sql = $@"
            WITH resolved_contracts AS (
                SELECT DISTINCT ON (c.appendix_number)
                    c.appendix_number,
                    c.customer_code,
                    c.contract_value,
                    c.liquidated_amount,
                    c.liquidate_date,
                    c.sign_date,
                    c.product_name,
                    c.term,
                    c.channel,
                    COALESCE(e.new_sale_id, c.sale_id) AS effective_sale_id
                FROM contract_appendix_version c
                LEFT JOIN contract_exception_version e 
                       ON e.appendix_number = c.appendix_number 
                      AND e.effective_date <= @ToDate
                      AND (e.expire_date IS NULL OR e.expire_date > @ToDate)
                WHERE c.status IN ('APPROVED', 'LIQUIDATED')
                  AND c.valid_from <= @ToDate AND c.valid_to > @FromDate
                  {manifestClause}
                  {ReportFilters.Clause}
                ORDER BY c.appendix_number, c.version_num DESC
            ),
            settlements AS (
                SELECT 
                    appendix_number,
                    SUM(settlement_amount) AS total_settled
                FROM contract_settlement_transaction
                WHERE is_active_version = TRUE
                  AND settlement_date <= @AsOfDate
                  {manifestSettleClause}
                GROUP BY appendix_number
            )
            SELECT 
                {groupExpr} AS GroupKey,
                BOOL_OR(@AllAccess OR rc.effective_sale_id = ANY(@RevScope)) AS HasRevenueAccess,
                BOOL_OR(@AllAccess OR rc.effective_sale_id = ANY(@BalScope)) AS HasBalanceAccess,
                COALESCE(SUM(CASE WHEN rc.sign_date >= @FromDate AND rc.sign_date <= @ToDate {revFilter}
                                  THEN rc.contract_value ELSE 0 END), 0) AS TotalSales,
                COALESCE(SUM(CASE WHEN rc.sign_date <= @AsOfDate {balFilter}
                                  THEN {ReportFilters.BalanceExpr("rc", "s")} ELSE 0 END), 0) AS TotalBalance,
                COUNT(DISTINCT CASE WHEN rc.sign_date >= @FromDate AND rc.sign_date <= @ToDate {revFilter}
                                    THEN rc.appendix_number END) AS ContractCount,
                COUNT(DISTINCT CASE WHEN rc.sign_date >= @FromDate AND rc.sign_date <= @ToDate {revFilter}
                                    THEN rc.customer_code END) AS CustomerCount
            FROM resolved_contracts rc
            LEFT JOIN settlements s ON s.appendix_number = rc.appendix_number
            {joinExtra}
            WHERE (@AllAccess OR rc.effective_sale_id = ANY(@RevScope) OR rc.effective_sale_id = ANY(@BalScope))
            GROUP BY {groupExpr}
            ORDER BY TotalSales DESC;";

        var rows = (await connection.QueryAsync<dynamic>(sql, filters.Bind(new
        {
            FromDate = fromDate,
            ToDate = toDate,
            AsOfDate = asOfDate,
            AllAccess = scope.CanAccessAll,
            FilterEmployeeId = filterEmployeeId,
            RevScope = revScopeList.ToArray(),
            BalScope = balScopeList.ToArray(),
            ManifestBatches = manifestBatches.ToArray()
        }, scope))).ToList();

        decimal grandTotalSales = rows.Sum(r => (decimal)r.totalsales);
        decimal grandTotalBalance = rows.Sum(r => (decimal)r.totalbalance);

        var items = new List<PivotItemDto>();
        foreach (var r in rows)
        {
            decimal sales = (decimal)r.totalsales;
            decimal bal = (decimal)r.totalbalance;
            string key = r.groupkey?.ToString() ?? "Chưa xác định";

            items.Add(new PivotItemDto
            {
                GroupKey = key,
                GroupName = key,
                TotalSales = (bool)r.hasrevenueaccess ? sales.ToString("F2", CultureInfo.InvariantCulture) : null,
                TotalBalance = (bool)r.hasbalanceaccess ? bal.ToString("F2", CultureInfo.InvariantCulture) : null,
                ContractCount = (bool)r.hasrevenueaccess ? (int)r.contractcount : null,
                CustomerCount = (bool)r.hasrevenueaccess ? (int)r.customercount : null,
                SalesSharePercent = !(bool)r.hasrevenueaccess ? null : grandTotalSales > 0 ? Math.Round((sales / grandTotalSales) * 100, 2) : 0m,
                BalanceSharePercent = !(bool)r.hasbalanceaccess ? null : grandTotalBalance > 0 ? Math.Round((bal / grandTotalBalance) * 100, 2) : 0m
            });
        }

        return items;
    }

    public async Task<ContractPageResponse> GetContractsPageAsync(
        int userId,
        DateOnly fromDate,
        DateOnly toDate,
        int page = 1,
        int pageSize = 50,
        string? filterEmployeeId = null,
        string? filterProduct = null,
        Guid? datasetId = null,
        string? viewEmployeeId = null, string view = "subtree", ReportFilters? filters = null)
    {
        filters ??= new();
        filters.Validate(contracts: true);
        if (page < 1 || pageSize < 1 || pageSize > 10000)
            throw new ScopeAccessException(400, "INVALID_PAGE", "Trang và số dòng không hợp lệ.");
        var asOfDate = filters.AsOfDate ?? toDate;
        var scope = await _scopeService.GetReportScopeAsync(userId, viewEmployeeId, view, datasetId);
        var (revScopeList, balScopeList) = ResolveScopes(scope, filterEmployeeId);

        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        List<long> manifestBatches = new();
        if (datasetId.HasValue)
        {
            var batchIds = (await connection.QueryAsync<long?>(@"
                SELECT source_batch_id FROM dataset_source_manifest 
                WHERE dataset_id = @DatasetId AND source_batch_id IS NOT NULL;", 
                new { DatasetId = datasetId.Value })).Where(b => b.HasValue).Select(b => b!.Value).ToList();
            manifestBatches.AddRange(batchIds);
        }

        long offset = ((long)page - 1) * pageSize;

        string scopeFilter;
        if (!string.IsNullOrEmpty(filterEmployeeId) && scope.CanAccessAll)
        {
            scopeFilter = "AND COALESCE(e.new_sale_id, c.sale_id) = @FilterEmployeeId ";
        }
        else if (!scope.CanAccessAll)
        {
            scopeFilter = "AND (COALESCE(e.new_sale_id, c.sale_id) = ANY(@RevScope) OR COALESCE(e.new_sale_id, c.sale_id) = ANY(@BalScope)) ";
        }
        else
        {
            scopeFilter = "";
        }

        string manifestClause = datasetId.HasValue 
            ? "AND c.batch_id = ANY(@ManifestBatches) " 
            : "";
        string manifestSettleClause = datasetId.HasValue 
            ? "AND batch_id = ANY(@ManifestBatches) " 
            : "";

        var sql = $@"
            WITH resolved AS (
                SELECT DISTINCT ON (c.appendix_number)
                    c.appendix_number,
                    c.customer_code,
                    c.customer_name,
                    c.product_name,
                    c.term,
                    c.sign_date,
                    c.expire_date,
                    c.liquidate_date,
                    c.sale_id,
                    c.sale_name,
                    c.status,
                    c.channel,
                    c.contract_value,
                    c.liquidated_amount,
                    COALESCE(e.new_sale_id, c.sale_id) AS effective_sale_id
                FROM contract_appendix_version c
                LEFT JOIN contract_exception_version e 
                       ON e.appendix_number = c.appendix_number 
                      AND e.effective_date <= @AsOfDate
                      AND (e.expire_date IS NULL OR e.expire_date > @AsOfDate)
                WHERE c.status IN ('APPROVED', 'LIQUIDATED')
                  {(filters.Basis == "balance" ? "AND c.sign_date <= @AsOfDate" : "AND c.sign_date >= @FromDate AND c.sign_date <= @ToDate AND c.appendix_number NOT IN (SELECT appendix_number FROM excluded_contract)")}
                  AND c.valid_from <= @AsOfDate AND c.valid_to > @AsOfDate
                  {manifestClause}
                  {ReportFilters.Clause}
                  {(string.IsNullOrEmpty(filterProduct) ? "" : "AND c.product_name = @FilterProduct ")}
                  {scopeFilter}
                  {ReportFilters.ContractClause}
                ORDER BY c.appendix_number, c.version_num DESC
            ),
            settlements AS (
                SELECT 
                    appendix_number,
                    SUM(settlement_amount) AS total_settled
                FROM contract_settlement_transaction
                WHERE is_active_version = TRUE
                  AND settlement_date <= @AsOfDate
                  {manifestSettleClause}
                GROUP BY appendix_number
            )
            /* contract_page */ SELECT 
                r.*,
                {ReportFilters.SettledExpr("r", "s")} AS settled_amount,
                {ReportFilters.BalanceExpr("r", "s")} AS balance
            FROM resolved r
            LEFT JOIN settlements s ON s.appendix_number = r.appendix_number
            {ReportFilters.BalanceClause}
            ORDER BY {filters.OrderBy}
            OFFSET @Offset LIMIT @Limit;";

        var args = filters.Bind(new
        {
            FromDate = fromDate,
            ToDate = toDate,
            AsOfDate = asOfDate,
            FilterProduct = filterProduct,
            AllAccess = scope.CanAccessAll,
            FilterEmployeeId = filterEmployeeId,
            RevScope = revScopeList.ToArray(),
            BalScope = balScopeList.ToArray(),
            ManifestBatches = manifestBatches.ToArray(),
            Offset = offset,
            Limit = pageSize
        }, scope);
        var countSql = sql[..sql.IndexOf("/* contract_page */", StringComparison.Ordinal)] +
            $"SELECT COUNT(*) FROM resolved r LEFT JOIN settlements s ON s.appendix_number = r.appendix_number {ReportFilters.BalanceClause};";
        var totalCount = await connection.ExecuteScalarAsync<long>(countSql, args);
        var rows = (await connection.QueryAsync<dynamic>(sql, args)).ToList();

        var result = new List<ContractDetailItemDto>();
        foreach (var r in rows)
        {
            string effSale = r.effective_sale_id?.ToString() ?? string.Empty;
            bool rowHasRev = scope.CanAccessAll || scope.RevenueScope.Contains(effSale);
            bool rowHasBal = scope.CanAccessAll || scope.BalanceScope.Contains(effSale);

            if (!rowHasRev && !rowHasBal)
            {
                continue; // User has neither revenue nor balance scope on this row
            }

            decimal val = (decimal)r.contract_value;
            decimal settled = (decimal)r.settled_amount;
            decimal bal = (decimal)r.balance;

            result.Add(new ContractDetailItemDto
            {
                AppendixNumber = r.appendix_number,
                CustomerCode = r.customer_code,
                CustomerName = r.customer_name,
                ProductName = r.product_name,
                Term = r.term,
                SignDate = FormatDate(r.sign_date) ?? "",
                ExpireDate = FormatDate(r.expire_date),
                LiquidateDate = FormatDate(r.liquidate_date),
                SaleId = r.sale_id,
                SaleName = r.sale_name,
                EffectiveSaleId = r.effective_sale_id,
                Status = r.status,
                Channel = r.channel,
                // R07: Mask per individual row access
                ContractValue = rowHasRev ? val.ToString("F2", CultureInfo.InvariantCulture) : null,
                SettledAmount = rowHasRev && rowHasBal ? settled.ToString("F2", CultureInfo.InvariantCulture) : null,
                Balance = rowHasBal ? bal.ToString("F2", CultureInfo.InvariantCulture) : null
            });
        }

        return new ContractPageResponse { Items = result, Page = page, PageSize = pageSize, TotalCount = totalCount };
    }

    public async Task<List<ContractDetailItemDto>> GetContractsAsync(int userId, DateOnly fromDate, DateOnly toDate,
        int page = 1, int pageSize = 50, string? filterEmployeeId = null, string? filterProduct = null,
        Guid? datasetId = null, string? viewEmployeeId = null, string view = "subtree", ReportFilters? filters = null)
        => (await GetContractsPageAsync(userId, fromDate, toDate, page, pageSize, filterEmployeeId,
            filterProduct, datasetId, viewEmployeeId, view, filters)).Items;

    public async Task<StockReportResponse> GetStockReportAsync(
        int userId,
        DateOnly fromDate,
        DateOnly toDate,
        Guid? datasetId = null,
        string? viewEmployeeId = null, string view = "subtree")
    {
        // R06: Apply scope check to Stock report
        var scope = await _scopeService.GetReportScopeAsync(userId, viewEmployeeId, view, datasetId);

        if (!scope.CanAccessAll && scope.RevenueScope.Count == 0 && scope.BalanceScope.Count == 0)
        {
            return new StockReportResponse
            {
                TotalContractValue = null,
                TotalLiquidated = null,
                TotalBalance = null,
                TotalContracts = null,
                TotalCustomers = null,
                Items = new()
            };
        }

        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        List<long> manifestBatches = new();
        if (datasetId.HasValue)
        {
            var batchIds = (await connection.QueryAsync<long?>(@"
                SELECT source_batch_id FROM dataset_source_manifest 
                WHERE dataset_id = @DatasetId AND source_batch_id IS NOT NULL;", 
                new { DatasetId = datasetId.Value })).Where(b => b.HasValue).Select(b => b!.Value).ToList();
            manifestBatches.AddRange(batchIds);
        }

        var allowedSales = scope.RevenueScope.Union(scope.BalanceScope).ToArray();
        string scopeClause = scope.CanAccessAll ? "" : "AND sale_id = ANY(@AllowedSales)";
        string manifestClause = datasetId.HasValue 
            ? "AND batch_id = ANY(@ManifestBatches) " 
            : "";

        var sql = $@"
            SELECT 
                id,
                appendix_number,
                customer_code,
                customer_name,
                contract_value,
                liquidated_amount,
                sign_date,
                expire_date,
                liquidate_date,
                sale_id
            FROM stock_contract_version
            WHERE is_active_version = TRUE
              AND sign_date >= @FromDate AND sign_date <= @ToDate
              {scopeClause}
              {manifestClause}
            ORDER BY sign_date DESC;";

        var rows = (await connection.QueryAsync<StockContractVersion>(sql, new 
        { 
            FromDate = fromDate, 
            ToDate = toDate,
            AllowedSales = allowedSales,
            ManifestBatches = manifestBatches.ToArray()
        })).ToList();

        bool Revenue(string id) => scope.CanAccessAll || scope.RevenueScope.Contains(id);
        bool Balance(string id) => scope.CanAccessAll || scope.BalanceScope.Contains(id);
        bool hasRevenue = scope.CanAccessAll || scope.RevenueScope.Count > 0;
        bool hasBalance = scope.CanAccessAll || scope.BalanceScope.Count > 0;
        decimal totalVal = rows.Where(r => Revenue(r.SaleId)).Sum(r => r.ContractValue);
        decimal totalLiq = rows.Where(r => Revenue(r.SaleId) && Balance(r.SaleId)).Sum(r => r.LiquidatedAmount);
        decimal totalBal = rows.Where(r => Balance(r.SaleId)).Sum(r => r.ContractValue - r.LiquidatedAmount);

        return new StockReportResponse
        {
            TotalContractValue = hasRevenue ? totalVal.ToString("F2", CultureInfo.InvariantCulture) : null,
            TotalLiquidated = hasRevenue && hasBalance && !scope.ScopesDiffer ? totalLiq.ToString("F2", CultureInfo.InvariantCulture) : null,
            TotalBalance = hasBalance ? totalBal.ToString("F2", CultureInfo.InvariantCulture) : null,
            TotalContracts = hasRevenue ? rows.Count(r => Revenue(r.SaleId)) : null,
            TotalCustomers = hasRevenue ? rows.Where(r => Revenue(r.SaleId)).Select(r => r.CustomerCode).Distinct().Count() : null,
            Items = rows.Select(r => new StockContractItemDto
            {
                Id = r.Id,
                AppendixNumber = r.AppendixNumber,
                CustomerCode = r.CustomerCode,
                CustomerName = r.CustomerName,
                ContractValue = Revenue(r.SaleId) ? r.ContractValue.ToString("F2", CultureInfo.InvariantCulture) : null,
                LiquidatedAmount = Revenue(r.SaleId) && Balance(r.SaleId) ? r.LiquidatedAmount.ToString("F2", CultureInfo.InvariantCulture) : null,
                Balance = Balance(r.SaleId) ? (r.ContractValue - r.LiquidatedAmount).ToString("F2", CultureInfo.InvariantCulture) : null,
                SignDate = r.SignDate.ToString("yyyy-MM-dd"),
                ExpireDate = r.ExpireDate?.ToString("yyyy-MM-dd"),
                LiquidateDate = r.LiquidateDate?.ToString("yyyy-MM-dd"),
                SaleId = r.SaleId
            }).ToList()
        };
    }

    public Task RecordExportAsync(int userId, string? nodeId, string view, Guid? datasetId)
        => _scopeService.RecordViewSelectionAsync(userId, nodeId, view, datasetId, "EXPORT_REPORT");

    public async Task<object> GetFilterOptionsAsync(int userId, DateOnly toDate, Guid? datasetId,
        string? viewEmployeeId, string view)
    {
        var scope = await _scopeService.GetReportScopeAsync(userId, viewEmployeeId, view, datasetId);
        using var connection = _db.CreateNpgsqlConnection();
        var rows = (await connection.QueryAsync<dynamic>(@"
            SELECT DISTINCT c.product_name, c.term, c.channel, c.status
            FROM contract_appendix_version c
            LEFT JOIN contract_exception_version e ON e.appendix_number = c.appendix_number
                AND e.effective_date <= @toDate AND (e.expire_date IS NULL OR e.expire_date > @toDate)
            WHERE c.valid_from <= @toDate AND c.valid_to > @toDate
              AND (@allAccess OR COALESCE(e.new_sale_id,c.sale_id) = ANY(@ids))
              AND (@datasetId::uuid IS NULL OR c.batch_id IN (
                SELECT source_batch_id FROM dataset_source_manifest WHERE dataset_id = @datasetId))",
            new { toDate, datasetId, allAccess = scope.CanAccessAll,
                ids = scope.RevenueScope.Union(scope.BalanceScope).ToArray() })).ToList();
        string[] Values(Func<dynamic, object?> pick) => rows.Select(r => (string)(pick(r)?.ToString() ?? ""))
            .Distinct().OrderBy(v => v).ToArray();
        return new { products = Values(r => r.product_name), terms = Values(r => r.term),
            channels = Values(r => r.channel), statuses = Values(r => r.status) };
    }

    private (List<string> RevScope, List<string> BalScope) ResolveScopes(
        UserAccessScope scope,
        string? filterEmployeeId)
    {
        if (scope.CanAccessAll)
        {
            if (!string.IsNullOrEmpty(filterEmployeeId))
            {
                return (new List<string> { filterEmployeeId }, new List<string> { filterEmployeeId });
            }
            return (new List<string>(), new List<string>());
        }

        var rev = new List<string>(scope.RevenueScope);
        var bal = new List<string>(scope.BalanceScope);

        if (!string.IsNullOrEmpty(filterEmployeeId))
        {
            rev = rev.Where(e => e.Equals(filterEmployeeId, StringComparison.OrdinalIgnoreCase)).ToList();
            bal = bal.Where(e => e.Equals(filterEmployeeId, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return (rev, bal);
    }

    private List<(DateOnly Start, DateOnly End, string Label)> GenerateTimeIntervals(
        DateOnly fromDate,
        DateOnly toDate,
        string period,
        string? weekMode = "standard",
        string? customIntervalsJson = null)
    {
        var list = new List<(DateOnly, DateOnly, string)>();
        var curr = fromDate;

        switch (period.ToLowerInvariant())
        {
            case "day":
                while (curr <= toDate)
                {
                    list.Add((curr, curr, curr.ToString("dd/MM/yyyy")));
                    curr = curr.AddDays(1);
                }
                break;

            case "month":
                while (curr <= toDate)
                {
                    var endOfMonth = new DateOnly(curr.Year, curr.Month, DateTime.DaysInMonth(curr.Year, curr.Month));
                    var pEnd = endOfMonth < toDate ? endOfMonth : toDate;
                    list.Add((curr, pEnd, $"Tháng {curr.Month}/{curr.Year}"));
                    curr = endOfMonth.AddDays(1);
                }
                break;

            case "quarter":
                while (curr <= toDate)
                {
                    int q = (curr.Month - 1) / 3 + 1;
                    int endMonth = q * 3;
                    var endOfQ = new DateOnly(curr.Year, endMonth, DateTime.DaysInMonth(curr.Year, endMonth));
                    var pEnd = endOfQ < toDate ? endOfQ : toDate;
                    list.Add((curr, pEnd, $"Quý {q}/{curr.Year}"));
                    curr = endOfQ.AddDays(1);
                }
                break;

            case "week":
            default:
                // Check if custom intervals provided
                if (!string.IsNullOrWhiteSpace(customIntervalsJson))
                {
                    try
                    {
                        var parsed = System.Text.Json.JsonSerializer.Deserialize<List<FinanceDashboard.Api.DTOs.V1.CustomIntervalDto>>(
                            customIntervalsJson,
                            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                        if (parsed != null && parsed.Count > 0)
                        {
                            foreach (var item in parsed)
                            {
                                if (DateOnly.TryParse(item.Start, out var s) && DateOnly.TryParse(item.End, out var e))
                                {
                                    list.Add((s, e, string.IsNullOrWhiteSpace(item.Label) ? $"{s:dd/MM} - {e:dd/MM}" : item.Label));
                                }
                            }
                            if (list.Count > 0) return list;
                        }
                    }
                    catch
                    {
                        // Fallback if parse fails
                    }
                }

                if (weekMode == "business4week")
                {
                    // 4 business cutoffs per month: 1-7, 8-15, 16-22, 23-end
                    var monthStart = new DateOnly(fromDate.Year, fromDate.Month, 1);
                    while (monthStart <= toDate)
                    {
                        int daysInM = DateTime.DaysInMonth(monthStart.Year, monthStart.Month);
                        var cutoffs = new (int StartDay, int EndDay, string Label)[]
                        {
                            (1, 7, $"T1 ({monthStart.Month:D2})"),
                            (8, 15, $"T2 ({monthStart.Month:D2})"),
                            (16, 22, $"T3 ({monthStart.Month:D2})"),
                            (23, daysInM, $"T4 ({monthStart.Month:D2})")
                        };

                        foreach (var (sDay, eDay, lbl) in cutoffs)
                        {
                            var sDate = new DateOnly(monthStart.Year, monthStart.Month, sDay);
                            var eDate = new DateOnly(monthStart.Year, monthStart.Month, eDay);

                            if (eDate < fromDate || sDate > toDate) continue;

                            var actualStart = sDate < fromDate ? fromDate : sDate;
                            var actualEnd = eDate > toDate ? toDate : eDate;
                            list.Add((actualStart, actualEnd, $"{lbl}: {actualStart:dd/MM}-{actualEnd:dd/MM}"));
                        }

                        monthStart = monthStart.AddMonths(1);
                    }
                }
                else
                {
                    // Standard calendar week
                    while (curr <= toDate)
                    {
                        int daysToSun = ((int)DayOfWeek.Sunday - (int)curr.DayOfWeek + 7) % 7;
                        var endOfWeek = curr.AddDays(daysToSun == 0 ? 0 : daysToSun);
                        var pEnd = endOfWeek < toDate ? endOfWeek : toDate;
                        list.Add((curr, pEnd, $"{curr:dd/MM} - {pEnd:dd/MM}"));
                        curr = pEnd.AddDays(1);
                    }
                }
                break;
        }

        return list;
    }
}
