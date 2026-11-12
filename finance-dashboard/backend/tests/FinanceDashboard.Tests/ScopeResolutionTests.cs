using FinanceDashboard.Api.Models.Versioned;
using FinanceDashboard.Api.Services.Authorization;
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
}
