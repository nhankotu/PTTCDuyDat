using Dapper;
using FinanceDashboard.Api.Services.Authorization;

namespace FinanceDashboard.Api.DTOs.V1;

public class ReportFilters
{
    public string[] Products { get; set; } = [];
    public string[] Terms { get; set; } = [];
    public string[] Channels { get; set; } = [];
    public string[] Statuses { get; set; } = [];
    public string? Search { get; set; }
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    public decimal? MinBalance { get; set; }
    public decimal? MaxBalance { get; set; }
    public bool? ChangedSale { get; set; }
    public DateOnly? AsOfDate { get; set; }
    public string Basis { get; set; } = "sales";
    public string Sort { get; set; } = "date_desc";

    public void Validate(bool contracts = false)
    {
        if (MinValue > MaxValue || MinBalance > MaxBalance ||
            MinValue < 0 || MaxValue < 0 || MinBalance < 0 || MaxBalance < 0 ||
            (Search?.Length ?? 0) > 200 || Products.Length + Terms.Length + Channels.Length + Statuses.Length > 200)
            throw new ScopeAccessException(400, "INVALID_FILTER", "Khoảng tiền hoặc số lượng điều kiện lọc không hợp lệ.");
        if (!contracts && (Search != null || MinValue != null || MaxValue != null || MinBalance != null || MaxBalance != null || ChangedSale != null))
            throw new ScopeAccessException(400, "UNSUPPORTED_FILTER", "Điều kiện chi tiết chỉ áp dụng cho danh sách hợp đồng.");
        if (Basis is not ("sales" or "balance"))
            throw new ScopeAccessException(400, "INVALID_BASIS", "Loại danh sách hợp đồng không hợp lệ.");
        if (Sort is not ("date_desc" or "date_asc" or "value_desc" or "value_asc"))
            throw new ScopeAccessException(400, "INVALID_SORT", "Thứ tự sắp xếp không hợp lệ.");
    }

    public static string Clause => @"
        AND (cardinality(@Products) = 0 OR c.product_name = ANY(@Products))
        AND (cardinality(@Terms) = 0 OR c.term = ANY(@Terms))
        AND (cardinality(@Channels) = 0 OR c.channel = ANY(@Channels))
        AND (cardinality(@Statuses) = 0 OR c.status = ANY(@Statuses))";

    public static string ContractClause => @"
        AND (@Search::text IS NULL OR c.appendix_number ILIKE @Search OR c.customer_code ILIKE @Search
             OR c.customer_name ILIKE @Search OR c.sale_id ILIKE @Search OR c.sale_name ILIKE @Search
             OR COALESCE(e.new_sale_id, c.sale_id) ILIKE @Search)
        AND (NOT @SortByValue OR @FilterAll OR COALESCE(e.new_sale_id,c.sale_id) = ANY(@FilterRevenueScope))
        AND (@MinValue::numeric IS NULL OR c.contract_value >= @MinValue)
        AND (@MaxValue::numeric IS NULL OR c.contract_value <= @MaxValue)
        AND (@ChangedSale::boolean IS NULL OR (COALESCE(e.new_sale_id, c.sale_id) <> c.sale_id) = @ChangedSale)
        AND ((@MinValue::numeric IS NULL AND @MaxValue::numeric IS NULL) OR @FilterAll
             OR COALESCE(e.new_sale_id, c.sale_id) = ANY(@FilterRevenueScope))";

    public static string SettledExpr(string rc = "rc", string s = "s") =>
        $"(CASE WHEN {rc}.liquidate_date IS NULL OR {rc}.liquidate_date <= @AsOfDate THEN GREATEST(COALESCE({s}.total_settled, 0), COALESCE({rc}.liquidated_amount, 0)) ELSE COALESCE({s}.total_settled, 0) END)";

    public static string BalanceExpr(string rc = "rc", string s = "s") =>
        $"GREATEST(0, {rc}.contract_value - {SettledExpr(rc, s)})";

    public static string BalanceClause => $@"
        WHERE (@MinBalance::numeric IS NULL OR {BalanceExpr("r", "s")} >= @MinBalance)
          AND (@MaxBalance::numeric IS NULL OR {BalanceExpr("r", "s")} <= @MaxBalance)
          AND ((@MinBalance::numeric IS NULL AND @MaxBalance::numeric IS NULL) OR @FilterAll
               OR r.effective_sale_id = ANY(@FilterBalanceScope))";

    public DynamicParameters Bind(object values, UserAccessScope scope)
    {
        var args = new DynamicParameters(values);
        args.Add("Products", Products); args.Add("Terms", Terms); args.Add("Channels", Channels); args.Add("Statuses", Statuses);
        var escaped = Search?.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
        args.Add("Search", string.IsNullOrWhiteSpace(escaped) ? null : $"%{escaped}%");
        args.Add("MinValue", MinValue); args.Add("MaxValue", MaxValue);
        args.Add("MinBalance", MinBalance); args.Add("MaxBalance", MaxBalance); args.Add("ChangedSale", ChangedSale);
        args.Add("FilterAll", scope.CanAccessAll);
        args.Add("SortByValue", Sort.StartsWith("value_", StringComparison.Ordinal));
        args.Add("FilterRevenueScope", scope.RevenueScope.ToArray()); args.Add("FilterBalanceScope", scope.BalanceScope.ToArray());
        return args;
    }

    public string OrderBy => Sort switch
    {
        "date_asc" => "r.sign_date ASC, r.appendix_number",
        "value_desc" => "r.contract_value DESC, r.appendix_number",
        "value_asc" => "r.contract_value ASC, r.appendix_number",
        _ => "r.sign_date DESC, r.appendix_number"
    };
}

public class ContractPageResponse
{
    public List<ContractDetailItemDto> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public long TotalCount { get; set; }
}
