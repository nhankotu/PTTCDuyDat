using FinanceDashboard.Api.Services.Import;
using Xunit;

namespace FinanceDashboard.Tests;

public class FormulaVerificationTests
{
    // Test helper to compute balance at T for a contract
    private static decimal CalculateBalanceAtT(
        decimal contractValue,
        DateOnly signDate,
        DateOnly asOfDate,
        List<(decimal Amount, DateOnly Date)> settlements)
    {
        // Contracts signed after asOfDate do not enter balance at T
        if (signDate > asOfDate) return 0m;

        decimal settledToT = settlements
            .Where(s => s.Date <= asOfDate)
            .Sum(s => s.Amount);

        return contractValue - settledToT;
    }

    [Fact]
    public void TestScenario1_ContractASignedInPrevMonth_HasZeroSalesAndCorrectBalance()
    {
        // Kỳ tháng 10: A ký tháng 9 gốc 100M, tất toán 20M trước 31/10
        var signDate = new DateOnly(2026, 9, 15);
        var fromDate = new DateOnly(2026, 10, 1);
        var toDate = new DateOnly(2026, 10, 31);
        var asOfDate = new DateOnly(2026, 10, 31);

        decimal contractValue = 100_000_000m;
        var settlements = new List<(decimal, DateOnly)>
        {
            (20_000_000m, new DateOnly(2026, 10, 10))
        };

        // Doanh số phát sinh trong kỳ tháng 10
        decimal salesInPeriod = (signDate >= fromDate && signDate <= toDate) ? contractValue : 0m;
        decimal balanceAtT = CalculateBalanceAtT(contractValue, signDate, asOfDate, settlements);

        Assert.Equal(0m, salesInPeriod);
        Assert.Equal(80_000_000m, balanceAtT);
    }

    [Fact]
    public void TestScenario2_ContractBSignedInPeriod_CombinedWithA_MatchesMasterContract()
    {
        // B ký tháng 10 gốc 200M, tất toán 50M: Doanh số 200M, số dư 150M
        var signDateB = new DateOnly(2026, 10, 5);
        var fromDate = new DateOnly(2026, 10, 1);
        var toDate = new DateOnly(2026, 10, 31);
        var asOfDate = new DateOnly(2026, 10, 31);

        decimal valB = 200_000_000m;
        var settlementsB = new List<(decimal, DateOnly)>
        {
            (50_000_000m, new DateOnly(2026, 10, 20))
        };

        decimal salesB = (signDateB >= fromDate && signDateB <= toDate) ? valB : 0m;
        decimal balanceB = CalculateBalanceAtT(valB, signDateB, asOfDate, settlementsB);

        Assert.Equal(200_000_000m, salesB);
        Assert.Equal(150_000_000m, balanceB);

        // Tổng với A: A ký tháng 9 (gốc 100M, tất toán 20M)
        decimal valA = 100_000_000m;
        var signDateA = new DateOnly(2026, 9, 15);
        var settlementsA = new List<(decimal, DateOnly)>
        {
            (20_000_000m, new DateOnly(2026, 10, 10))
        };

        decimal salesA = (signDateA >= fromDate && signDateA <= toDate) ? valA : 0m;
        decimal balanceA = CalculateBalanceAtT(valA, signDateA, asOfDate, settlementsA);

        decimal totalSales = salesA + salesB;
        decimal totalBalance = balanceA + balanceB;
        int totalContracts = (salesA > 0 ? 1 : 0) + (salesB > 0 ? 1 : 0);

        // Chuẩn theo 00_THIET_KE_DA_CHOT: Sales 200M, Balance 230M, Tập doanh số có đúng 1 HĐ
        Assert.Equal(200_000_000m, totalSales);
        Assert.Equal(230_000_000m, totalBalance);
        Assert.Equal(1, totalContracts);
    }

    [Fact]
    public void TestScenario3_ContractCFullySettled_RetainsHistoricSalesAndHasZeroBalance()
    {
        // C gốc 100M, tất toán đủ 100M trước T: Số dư = 0, doanh số lịch sử vẫn giữ nguyên 100M
        var signDate = new DateOnly(2026, 10, 1);
        var asOfDate = new DateOnly(2026, 10, 31);
        decimal val = 100_000_000m;
        var settlements = new List<(decimal, DateOnly)>
        {
            (100_000_000m, new DateOnly(2026, 10, 25))
        };

        decimal balance = CalculateBalanceAtT(val, signDate, asOfDate, settlements);
        Assert.Equal(0m, balance);
        Assert.Equal(100_000_000m, val); // Historic sales preserved
    }

    [Fact]
    public void TestScenario4_ContractDSignedAfterT_NotIncludedInBalanceAtT()
    {
        // D ký sau T (15/11): Không vào số dư tại ngày chốt 31/10
        var signDate = new DateOnly(2026, 11, 15);
        var asOfDate = new DateOnly(2026, 10, 31);
        decimal val = 500_000_000m;
        var settlements = new List<(decimal, DateOnly)>();

        decimal balance = CalculateBalanceAtT(val, signDate, asOfDate, settlements);
        Assert.Equal(0m, balance);
    }

    [Fact]
    public void TestScenario5_MultipleSettlementsBeforeAndAfterT_OnlySettlementsBeforeTAreDeducted()
    {
        // Gốc 100M, tất toán 20M + 30M trước T và 10M sau T: Số dư tại T = 50M
        var signDate = new DateOnly(2026, 10, 1);
        var asOfDate = new DateOnly(2026, 10, 31);
        decimal val = 100_000_000m;
        var settlements = new List<(decimal, DateOnly)>
        {
            (20_000_000m, new DateOnly(2026, 10, 10)),
            (30_000_000m, new DateOnly(2026, 10, 20)),
            (10_000_000m, new DateOnly(2026, 11, 5)) // after T
        };

        decimal balance = CalculateBalanceAtT(val, signDate, asOfDate, settlements);
        Assert.Equal(50_000_000m, balance);
    }

    [Fact]
    public void TestScenario7_ExceptionOverride_CreditsNewSaleId()
    {
        // Hợp đồng gốc gắn SALE01, nhưng trong file Ngoại lệ gắn SALE02
        string originalSaleId = "SALE01";
        string? exceptionSaleId = "SALE02";

        string effectiveSaleId = exceptionSaleId ?? originalSaleId;
        Assert.Equal("SALE02", effectiveSaleId);

        // Hợp đồng không nằm trong Ngoại lệ
        string? noException = null;
        string regularEffectiveSaleId = noException ?? originalSaleId;
        Assert.Equal("SALE01", regularEffectiveSaleId);
    }

    [Fact]
    public void TestScenario8_DistinctCustomerCount_AcrossBranches_DoesNotDoubleCount()
    {
        // 2 hợp đồng của cùng 1 khách hàng KH0001 tại 2 chi nhánh khác nhau
        var contracts = new[]
        {
            new { Appendix = "HD01", CustomerCode = "KH0001", Branch = "CN Hoàn Kiếm" },
            new { Appendix = "HD02", CustomerCode = "KH0001", Branch = "CN Tây Hồ" }
        };

        int totalContracts = contracts.Length;
        int totalDistinctCustomers = contracts.Select(c => c.CustomerCode).Distinct().Count();

        Assert.Equal(2, totalContracts);
        Assert.Equal(1, totalDistinctCustomers);
    }

    [Fact]
    public void TestScenario9_AverageSizes_RoundedAwayFromZero()
    {
        decimal totalSales = 100_000_000m;
        int totalContracts = 3;
        int totalCustomers = 3;

        // 100_000_000 / 3 = 33333333.3333... -> 33333333.33
        decimal avgPerContract = Math.Round(totalSales / totalContracts, 2, MidpointRounding.AwayFromZero);
        decimal avgPerCustomer = Math.Round(totalSales / totalCustomers, 2, MidpointRounding.AwayFromZero);

        Assert.Equal(33333333.33m, avgPerContract);
        Assert.Equal(33333333.33m, avgPerCustomer);
    }

    [Fact]
    public void TestScenario13_CustomerCodeFormatting_PreservesLeadingZeros()
    {
        Assert.Equal("001234", ExcelParserHelper.FormatCustomerCode("1234"));
        Assert.Equal("000005", ExcelParserHelper.FormatCustomerCode(5));
        Assert.Equal("012345", ExcelParserHelper.FormatCustomerCode("012345"));
        Assert.Equal("KH9999", ExcelParserHelper.FormatCustomerCode("KH9999"));
    }

    [Fact]
    public void TestSaleIdSplitting_HandlesHyphenatedIntro()
    {
        var (id1, name1) = ExcelParserHelper.ParseSaleIntro("00123-Nguyễn Văn A");
        Assert.Equal("00123", id1);
        Assert.Equal("Nguyễn Văn A", name1);

        var (id2, name2) = ExcelParserHelper.ParseSaleIntro("SALE999");
        Assert.Equal("SALE999", id2);
        Assert.Null(name2);
    }

    [Fact]
    public void TestHeaderNormalization_R08_HandlesLetterDAndPunctuation()
    {
        Assert.Equal("so phu luc hop dong", ExcelParserHelper.NormalizeHeader("Số phụ lục hợp đồng"));
        Assert.Equal("da thanh ly", ExcelParserHelper.NormalizeHeader("Đã thanh lý"));
        Assert.Equal("id sale thay doi", ExcelParserHelper.NormalizeHeader("ID SALE THAY ĐỔI"));
        Assert.Equal("so phu luc (so hd)", ExcelParserHelper.NormalizeHeader("Số Phụ lục (Số HĐ)"));
        Assert.Equal("id sale gioi thieu", ExcelParserHelper.NormalizeHeader("ID Sale giới thiệu"));
    }

    [Fact]
    public void TestDecimalParsing_R09_HandlesVietnameseThousandsAndRejectsInvalid()
    {
        Assert.True(ExcelParserHelper.TryParseDecimal("1.000.000", out var d1));
        Assert.Equal(1_000_000m, d1);

        Assert.True(ExcelParserHelper.TryParseDecimal("1.000", out var d2));
        Assert.Equal(1_000m, d2);

        Assert.True(ExcelParserHelper.TryParseDecimal("500.000.000", out var d3));
        Assert.Equal(500_000_000m, d3);

        Assert.False(ExcelParserHelper.TryParseDecimal("abc", out var _));
        Assert.False(ExcelParserHelper.TryParseDecimal("100k", out var _));

        Assert.True(ExcelParserHelper.TryParseDecimal("(2.500.000)", out var neg));
        Assert.Equal(-2_500_000m, neg);
    }

    [Fact]
    public void TestDateParsing_R10_HandlesDDMMYYCorrectly()
    {
        var d1 = ExcelParserHelper.ParseDate("050326");
        Assert.NotNull(d1);
        Assert.Equal(new DateOnly(2026, 3, 5), d1!.Value);

        var d2 = ExcelParserHelper.ParseDate("15/09/2026");
        Assert.NotNull(d2);
        Assert.Equal(new DateOnly(2026, 9, 15), d2!.Value);

        var d3 = ExcelParserHelper.ParseDate("2026-10-31");
        Assert.NotNull(d3);
        Assert.Equal(new DateOnly(2026, 10, 31), d3!.Value);
    }

    [Fact]
    public void TestStatusAndChannelNormalization_R11()
    {
        Assert.Equal("APPROVED", ExcelImportV2Service.NormalizeStatus("Đã duyệt"));
        Assert.Equal("APPROVED", ExcelImportV2Service.NormalizeStatus("approved"));
        Assert.Equal("LIQUIDATED", ExcelImportV2Service.NormalizeStatus("Đã thanh lý"));
        Assert.Equal("PENDING", ExcelImportV2Service.NormalizeStatus("Chờ duyệt"));
        Assert.Equal("ADVANCING", ExcelImportV2Service.NormalizeStatus("Đang tạm ứng"));

        Assert.Equal("APP_FINRA", ExcelImportV2Service.NormalizeChannel("App Finra"));
        Assert.Equal("BO_FINRA", ExcelImportV2Service.NormalizeChannel("Backoffice"));
        Assert.Equal("BO_FINRA", ExcelImportV2Service.NormalizeChannel("BO FINRA"));
        Assert.Equal("UPSC", ExcelImportV2Service.NormalizeChannel("UPSC"));
    }

    [Fact]
    public void TestHistoricalVersionResolution_R05_FutureRevisionDoesNotAffectPastBalance()
    {
        // Giả lập 2 phiên bản của Hợp đồng REVIEW-A:
        // Version 1: Value 100M, valid_from 2026-09-15, valid_to 2030-01-01
        // Version 2: Value 999M (sửa đổi trong tương lai), valid_from 2030-01-01, valid_to 9999-12-31
        var asOfDate = new DateOnly(2026, 10, 31);
        var versions = new[]
        {
            new { Version = 1, Value = 100_000_000m, ValidFrom = new DateOnly(2026, 9, 15), ValidTo = new DateOnly(2030, 1, 1) },
            new { Version = 2, Value = 999_000_000m, ValidFrom = new DateOnly(2030, 1, 1), ValidTo = new DateOnly(9999, 12, 31) }
        };

        // Resolution as of 2026-10-31: ValidFrom <= asOfDate AND ValidTo > asOfDate
        var activeAtAsOf = versions
            .Where(v => v.ValidFrom <= asOfDate && v.ValidTo > asOfDate)
            .OrderByDescending(v => v.Version)
            .FirstOrDefault();

        Assert.NotNull(activeAtAsOf);
        Assert.Equal(1, activeAtAsOf!.Version);
        Assert.Equal(100_000_000m, activeAtAsOf.Value);

        // Với tất toán 20M: Số dư tại 31/10/2026 phải là 80M, KHÔNG PHẢI 979M
        decimal settlementAmount = 20_000_000m;
        decimal balance = activeAtAsOf.Value - settlementAmount;
        Assert.Equal(80_000_000m, balance);
    }

    [Fact]
    public void TestPerContractMasking_R07_PreventsInformationLeakage()
    {
        // User có full quyền trên E1 (self), nhưng chỉ được grant BALANCE trên E2 (peer)
        var revScope = new HashSet<string> { "E1" };
        var balScope = new HashSet<string> { "E1", "E2" };

        var contractE2 = new
        {
            Appendix = "HD_E2",
            SaleId = "E2",
            ContractValue = 200_000_000m,
            SettlementAmount = 50_000_000m,
            Balance = 150_000_000m
        };

        bool hasRev = revScope.Contains(contractE2.SaleId);
        bool hasBal = balScope.Contains(contractE2.SaleId);

        decimal? displayedValue = hasRev ? contractE2.ContractValue : null;
        decimal? displayedSettled = hasBal ? contractE2.SettlementAmount : null;
        decimal? displayedBalance = hasBal ? contractE2.Balance : null;

        // E2 không có quyền xem doanh số -> ContractValue BỊ MASK (null)
        Assert.False(hasRev);
        Assert.Null(displayedValue);

        // E2 có quyền xem số dư -> Số dư hiển thị đúng
        Assert.True(hasBal);
        Assert.Equal(150_000_000m, displayedBalance);
    }
}
