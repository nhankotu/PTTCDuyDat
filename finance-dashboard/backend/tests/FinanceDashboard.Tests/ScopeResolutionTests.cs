using FinanceDashboard.Api.Models.Versioned;
using FinanceDashboard.Api.Services.Authorization;
using FinanceDashboard.Api.Services.Reporting;
using FinanceDashboard.Api.DTOs.V1;

namespace FinanceDashboard.Tests;

public class ScopeResolutionTests
{
    private static List<EmployeeHistory> Organization() => [
        new() { EmployeeId = "director" },
        new() { EmployeeId = "manager", ManagerEmployeeId = "director" },
        new() { EmployeeId = "sale", ManagerEmployeeId = "manager" },
        new() { EmployeeId = "ctv", ManagerEmployeeId = "sale" },
        new() { EmployeeId = "other" }
    ];

    [Fact]
    public void ManagerSelectionIncludesAllGenerationsButNotOtherBranches()
    {
        var ids = ScopeGraph.Descendants(Organization(), ["manager"]);
        Assert.True(ids.SetEquals(["manager", "sale", "ctv"]));
    }

    [Fact]
    public void InvalidOrganizationCycleTerminatesAndDeduplicates()
    {
        var employees = Organization();
        employees[0].ManagerEmployeeId = "ctv";
        Assert.Equal(4, ScopeGraph.Descendants(employees, ["director", "manager"]).Count);
    }

    [Fact]
    public void AdministratorIsNarrowedInsteadOfBypassingSelectedNode()
    {
        var selected = ScopeGraph.Narrow(new UserAccessScope { CanAccessAll = true }, ["manager", "sale"]);
        Assert.False(selected.CanAccessAll);
        Assert.True(selected.RevenueScope.SetEquals(["manager", "sale"]));
        Assert.True(selected.BalanceScope.SetEquals(["manager", "sale"]));
    }

    [Fact]
    public void SelectionNeverEscalatesIndependentMetricGrants()
    {
        var original = new UserAccessScope
        {
            RevenueScope = new(["manager", "sale"], StringComparer.OrdinalIgnoreCase),
            BalanceScope = new(["manager", "peer"], StringComparer.OrdinalIgnoreCase)
        };
        var selected = ScopeGraph.Narrow(original, ["manager", "sale", "ctv"]);
        Assert.True(selected.RevenueScope.SetEquals(["manager", "sale"]));
        Assert.True(selected.BalanceScope.SetEquals(["manager"]));
        Assert.True(selected.ScopesDiffer);
        Assert.Contains("peer", original.BalanceScope);
    }

    [Fact]
    public void SelfSelectionDoesNotIncludeDescendants()
    {
        var scope = new UserAccessScope { CanAccessAll = true };
        Assert.True(ScopeGraph.Narrow(scope, ["manager"]).RevenueScope.SetEquals(["manager"]));
    }

    [Fact]
    public void InvalidMonetaryRangesAndSqlSortAreRejected()
    {
        Assert.Throws<ScopeAccessException>(() => new ReportFilters { MinValue = 20, MaxValue = 10 }.Validate(true));
        Assert.Throws<ScopeAccessException>(() => new ReportFilters { Sort = "value; DROP TABLE employee" }.Validate(true));
        Assert.Throws<ScopeAccessException>(() => new ReportFilters { MinBalance = 20 }.Validate());
    }

    [Fact]
    public void DeduplicateEmployeesHandlesBlankDuplicatesAndMissingNames()
    {
        var raw = new List<EmployeeHistory>
        {
            new() { EmployeeId = "  ", FullName = "Invalid" },
            new() { EmployeeId = "nv01 ", FullName = "" },
            new() { EmployeeId = "NV01", FullName = "Nguyen Van A" },
            new() { EmployeeId = "nv02", FullName = "Tran Thi B" },
            new() { EmployeeId = "NV02", FullName = "Duplicate Should Be Ignored" }
        };

        var result = DataAccessScopeService.DeduplicateEmployees(raw);
        Assert.Equal(2, result.Count);
        Assert.Equal("Nguyen Van A", result.First(x => x.EmployeeId.Equals("nv01", StringComparison.OrdinalIgnoreCase)).FullName);
        Assert.Equal("Tran Thi B", result.First(x => x.EmployeeId.Equals("nv02", StringComparison.OrdinalIgnoreCase)).FullName);
    }

    [Fact]
    public void SmartFiltersAndGhostFilterValidationWorkCorrectly()
    {
        // Smart boolean toggles are allowed on all report endpoints (KPI, Trend, Pivot, Contracts)
        var smart = new ReportFilters
        {
            ExcludeTenDays = true,
            ExcludeSafeNewCust = true,
            ExcludeGhost = true
        };
        smart.Validate(contracts: false);

        // GhostFilter != "all" is contract-list specific
        Assert.Throws<ScopeAccessException>(() => new ReportFilters { GhostFilter = "only_ghost" }.Validate(contracts: false));
        new ReportFilters { GhostFilter = "only_ghost" }.Validate(contracts: true);
        Assert.Throws<ScopeAccessException>(() => new ReportFilters { GhostFilter = "invalid" }.Validate(contracts: true));

        // OnlyPositiveBalance parameter reflects Basis == "balance"
        var scope = new UserAccessScope { CanAccessAll = true };
        var balBound = new ReportFilters { Basis = "balance" }.Bind(new { }, scope);
        Assert.True(balBound.Get<bool>("OnlyPositiveBalance"));

        var salesBound = new ReportFilters { Basis = "sales" }.Bind(new { }, scope);
        Assert.False(salesBound.Get<bool>("OnlyPositiveBalance"));
    }

    [Fact]
    public void CustomWeekIntervalsOutsidePeriodFallBackAndOverlappingOnesClipCleanly()
    {
        var novStart = new DateOnly(2026, 11, 1);
        var novEnd = new DateOnly(2026, 11, 14);

        // Stale October custom intervals stored in localStorage must NOT freeze November chart on October
        var staleOctJson = "[{\"start\":\"2026-10-01\",\"end\":\"2026-10-07\",\"label\":\"Tuần T10\"}]";
        var fallback = ReportingEngineV2Service.GenerateTimeIntervals(novStart, novEnd, "week", "custom", staleOctJson);
        Assert.NotEmpty(fallback);
        Assert.All(fallback, iv =>
        {
            Assert.True(iv.Start >= novStart);
            Assert.True(iv.End <= novEnd);
        });

        // Partially overlapping custom intervals clip cleanly to [novStart, novEnd]
        var partialJson = "[{\"start\":\"2026-10-28\",\"end\":\"2026-11-05\",\"label\":\"W1\"},{\"start\":\"2026-11-06\",\"end\":\"2026-11-20\",\"label\":\"W2\"}]";
        var clipped = ReportingEngineV2Service.GenerateTimeIntervals(novStart, novEnd, "week", "custom", partialJson);
        Assert.Equal(2, clipped.Count);
        Assert.Equal(new DateOnly(2026, 11, 1), clipped[0].Start);
        Assert.Equal(new DateOnly(2026, 11, 5), clipped[0].End);
        Assert.Equal(new DateOnly(2026, 11, 6), clipped[1].Start);
        Assert.Equal(new DateOnly(2026, 11, 14), clipped[1].End);
    }
}
