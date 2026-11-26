import { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  SlidersHorizontal,
  RefreshCw,
  HelpCircle,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Check,
  Users,
  Zap,
  Landmark,
  ArrowRight,
} from 'lucide-react';
import { emptyDimensions, countActiveFilters, normalizeDimensions } from './components/ReportFilterPanel';
import { SavedReportValue } from './components/SavedReportViews';
import { UnifiedFilterScopePanel } from './components/UnifiedFilterScopePanel';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { TopContextBar } from './components/TopContextBar';
import { HomeDashboard } from './components/HomeDashboard';
import { KpiCardsV1 } from './components/KpiCardsV1';
import { TrendAndPivotSection } from './components/TrendAndPivotSection';
import { ContractsTableV1 } from './components/ContractsTableV1';
import { StocksSection } from './components/StocksSection';
import { OrgTreeSection } from './components/OrgTreeSection';
import { ImportV2Modal } from './components/ImportV2Modal';
import { LoginPage } from './components/LoginPage';
import { UserManagement } from './components/UserManagement';
import { PermissionsPage } from './components/PermissionsPage';
import { apiV1 } from './services/apiV1';
import { dashboardApi } from './services/api';
import { AuthSession } from './types';
import {
  KpiReportResponse,
  ReportView,
  ViewScopeNode,
  DimensionFilters,
  DateCoverageResponse,
} from './types/v1';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthSession | null>(() => {
    const saved = localStorage.getItem('finra_user');
    const token = localStorage.getItem('finra_token');
    if (saved && token) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('home_v1');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('finra_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('finra_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [contractBasis, setContractBasis] = useState<'sales' | 'balance'>('sales');
  const [isImportV2Open, setIsImportV2Open] = useState(false);

  // Date filters
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toLocaleDateString('en-CA'));
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toLocaleDateString('en-CA'));

  // KPI V1 state
  const [kpiData, setKpiData] = useState<KpiReportResponse | null>(null);
  const [kpiLoading, setKpiLoading] = useState<boolean>(true);

  // Branches list for user management
  const [branches, setBranches] = useState<string[]>([]);
  // Datasets list and selected dataset
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');

  const [dimensions, setDimensions] = useState<DimensionFilters>(emptyDimensions);
  const [appliedDimensions, setAppliedDimensions] = useState<DimensionFilters>(emptyDimensions);
  const [reportView, setReportView] = useState<ReportView>({ view: 'subtree' });
  const [scopeNodes, setScopeNodes] = useState<ViewScopeNode[]>([]);
  const [scopeLoading, setScopeLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [scopeRevision, setScopeRevision] = useState(0);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [applied, setApplied] = useState({ fromDate, toDate, asOfDate, datasetId: selectedDatasetId });
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateError, setDateError] = useState<string | null>(null);
  const [dateCoverage, setDateCoverage] = useState<DateCoverageResponse | null>(null);
  const [autoAdjustedNotice, setAutoAdjustedNotice] = useState<string | null>(null);
  const [filterModalTab, setFilterModalTab] = useState<'all' | 'time' | 'scope' | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const hasAutoAdjustedRef = useRef(false);
  const requestId = useRef(0);
  const selectionRequest = useRef(0);
  const reportKey = JSON.stringify([applied, appliedDimensions, reportView, refreshKey, currentUser?.username]);

  const applyFilters = () => {
    if (!fromDate || !toDate || !asOfDate || fromDate > toDate) {
      setDateError('Vui lòng chọn ngày hợp lệ; ngày bắt đầu không được sau ngày kết thúc.');
      return;
    }
    setDateError(null);
    setAppliedDimensions(dimensions);
    if (applied.datasetId !== selectedDatasetId) setReportView({ view: 'subtree' });
    setApplied({ fromDate, toDate, asOfDate, datasetId: selectedDatasetId });
    setRefreshKey((n) => n + 1);
  };

  useEffect(() => {
    let active = true;
    setScopeNodes([]);
    setScopeError(null);
    setScopeLoading(true);
    if (!currentUser) {
      setReportView({ view: 'subtree' });
      return;
    }
    apiV1
      .getViewScopes(applied.datasetId || undefined)
      .then((nodes) => {
        if (!active) return;
        setScopeNodes(nodes);
        setReportView((previous) => {
          if (previous.viewEmployeeId && !nodes.some((n) => n.id === previous.viewEmployeeId)) {
            setScopeError('Node đang xem không còn trong phạm vi được cấp. Bạn có thể quay về phạm vi của mình.');
          }
          return previous;
        });
      })
      .catch((err) => {
        if (active) setScopeError(err.response?.data?.message || 'Không tải được danh sách nhân sự được phép xem.');
      })
      .finally(() => {
        if (active) setScopeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser?.username, applied.datasetId, scopeRevision]);

  const resetSessionState = () => {
    setActiveTab('home_v1');
    setMobileNavOpen(false);
    setContractBasis('sales');
    setKpiData(null);
    setKpiError(null);
    setDimensions(emptyDimensions());
    setAppliedDimensions(emptyDimensions());
    setReportView({ view: 'subtree' });
    setSelectedDatasetId('');
    setDatasets([]);
    setBranches([]);
    setFilterModalTab(null);
    setHelpOpen(false);
    setAutoAdjustedNotice(null);
    setDateError(null);
    hasAutoAdjustedRef.current = false;
  };

  useEffect(() => {
    const handleLogoutEvent = () => {
      setCurrentUser(null);
      resetSessionState();
    };
    window.addEventListener('finra_auth_logout', handleLogoutEvent);
    return () => window.removeEventListener('finra_auth_logout', handleLogoutEvent);
  }, []);

  const loadKpiV1 = async () => {
    if (!currentUser) return;
    const id = ++requestId.current;
    setKpiLoading(true);
    setKpiData(null);
    setKpiError(null);
    try {
      const res = await apiV1.getKpi({
        ...applied,
        datasetId: applied.datasetId || undefined,
        ...reportView,
        ...appliedDimensions,
      });
      if (id === requestId.current) setKpiData(res);
    } catch (err: any) {
      if (id === requestId.current) setKpiError(err.response?.data?.message || 'Không tải được số liệu. Vui lòng thử lại.');
    } finally {
      if (id === requestId.current) setKpiLoading(false);
    }
  };

  useEffect(() => {
    loadKpiV1();
    return () => {
      requestId.current++;
    };
  }, [reportKey]);

  useEffect(() => {
    if (currentUser) {
      apiV1.getDatasets().then(setDatasets).catch(() => {});
    }
    if (currentUser?.role === 'admin') {
      dashboardApi.getBranches().then(setBranches).catch(() => {});
    }
  }, [currentUser]);

  const changeReportView = (value: ReportView) => {
    const id = ++selectionRequest.current;
    setScopeError(null);
    setReportView(value);
    apiV1.recordScopeSelection({ ...value, datasetId: applied.datasetId || undefined }).catch((err) => {
      if (id === selectionRequest.current) {
        setScopeError(err.response?.data?.message || 'Chưa xác nhận được phạm vi xem. Vui lòng thử lại.');
      }
    });
  };

  const loadSavedView = (value: SavedReportValue) => {
    const normDims = normalizeDimensions(value.dimensions);
    setFromDate(value.fromDate);
    setToDate(value.toDate);
    setAsOfDate(value.asOfDate);
    setSelectedDatasetId(value.datasetId);
    setDimensions(normDims);
    setAppliedDimensions(normDims);
    setApplied({ fromDate: value.fromDate, toDate: value.toDate, asOfDate: value.asOfDate, datasetId: value.datasetId });
    setReportView(value.reportView);
    setRefreshKey((n) => n + 1);
    setDateError(null);
    setScopeRevision((n) => n + 1);
  };

  const applyDimensionsNow = (next: DimensionFilters) => {
    const norm = normalizeDimensions(next);
    setDimensions(norm);
    setAppliedDimensions(norm);
  };

  const drillDown = (groupBy: string, groupKey: string) => {
    if (groupBy === 'sale') {
      if (!scopeNodes.some((node) => node.id === groupKey)) return;
      changeReportView({ viewEmployeeId: groupKey, view: 'self' });
    } else {
      const field = ({ product: 'products', term: 'terms', channel: 'channels' } as const)[
        groupBy as 'product' | 'term' | 'channel'
      ];
      if (!field) return;
      applyDimensionsNow({ ...appliedDimensions, [field]: [groupKey] });
    }
    setContractBasis('sales');
    setActiveTab('contracts_v1');
  };

  const handleLogout = async () => {
    await dashboardApi.logout();
    setCurrentUser(null);
    resetSessionState();
  };

  const applyPreset = (
    preset: 'today' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year',
    immediate = false
  ) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let start = '';
    let end = fmt(now);

    if (preset === 'today') {
      start = end;
    } else if (preset === 'this_month') {
      start = `${y}-${pad(m + 1)}-01`;
    } else if (preset === 'last_month') {
      const lastMonthEnd = new Date(y, m, 0);
      start = `${lastMonthEnd.getFullYear()}-${pad(lastMonthEnd.getMonth() + 1)}-01`;
      end = fmt(lastMonthEnd);
    } else if (preset === 'this_quarter') {
      const qMonth = Math.floor(m / 3) * 3;
      start = `${y}-${pad(qMonth + 1)}-01`;
    } else if (preset === 'this_year') {
      start = `${y}-01-01`;
    }

    if (immediate) {
      applyDateRangeNow(start, end, end);
    } else {
      setFromDate(start);
      setToDate(end);
      setAsOfDate(end);
      setAutoAdjustedNotice(null);
    }
  };

  const applyDateRangeNow = (start: string, end: string, asOf?: string, notice?: string | null) => {
    const targetAsOf = asOf || end;
    setDateError(null);
    setFromDate(start);
    setToDate(end);
    setAsOfDate(targetAsOf);
    setAutoAdjustedNotice(notice ?? null);
    setAppliedDimensions(dimensions);
    setApplied({ fromDate: start, toDate: end, asOfDate: targetAsOf, datasetId: selectedDatasetId });
  };

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    apiV1
      .getDateCoverage({
        datasetId: selectedDatasetId || undefined,
        ...reportView,
      })
      .then((cov) => {
        if (!active) return;
        setDateCoverage(cov);
        if (!hasAutoAdjustedRef.current && cov.months.length > 0) {
          hasAutoAdjustedRef.current = true;
          const currentMonthKey = fromDate.slice(0, 7);
          if (!cov.months.some((m) => m.monthKey === currentMonthKey)) {
            const latest = cov.months[0];
            const targetAsOf = cov.maxDate && cov.maxDate < latest.toDate ? cov.maxDate : latest.toDate;
            applyDateRangeNow(
              latest.fromDate,
              latest.toDate,
              targetAsOf,
              `Tháng hiện tại chưa có dữ liệu — đang tự động hiển thị tháng có dữ liệu gần nhất (${latest.label}).`
            );
          }
        }
      })
      .catch(() => {
        if (active) setDateCoverage(null);
      });
    return () => {
      active = false;
    };
  }, [currentUser, selectedDatasetId, reportView.viewEmployeeId, reportView.view, refreshKey]);

  useEffect(() => {
    if (!currentUser) return;
    const isReportingTab = ['home_v1', 'kpi_v1', 'trend_v1', 'contracts_v1', 'stocks_v1', 'org_tree_v1'].includes(
      activeTab
    );

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFilterModalTab(null);
        setHelpOpen(false);
        setMobileNavOpen(false);
        return;
      }
      if (!isReportingTab) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

      const k = e.key.toLowerCase();
      if (k === 'f') {
        e.preventDefault();
        setHelpOpen(false);
        setFilterModalTab((prev) => (prev ? null : 'all'));
      } else if (k === 't') {
        e.preventDefault();
        setHelpOpen(false);
        setFilterModalTab((prev) => (prev === 'time' ? null : 'time'));
      } else if (k === 's') {
        e.preventDefault();
        setHelpOpen(false);
        setFilterModalTab((prev) => (prev === 'scope' ? null : 'scope'));
      } else if (k === 'h' || e.key === '?') {
        e.preventDefault();
        setFilterModalTab(null);
        setHelpOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentUser, activeTab]);

  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(session) => {
          resetSessionState();
          setCurrentUser(session);
        }}
      />
    );
  }

  const isAdmin = currentUser.role === 'admin';
  const isReportingTab = ['home_v1', 'kpi_v1', 'trend_v1', 'contracts_v1', 'stocks_v1', 'org_tree_v1'].includes(
    activeTab
  );
  const isHome = activeTab === 'home_v1';
  const dimCount = countActiveFilters(appliedDimensions);
  const hasPending =
    (!isHome &&
      (fromDate !== applied.fromDate ||
        toDate !== applied.toDate ||
        asOfDate !== applied.asOfDate ||
        selectedDatasetId !== applied.datasetId)) ||
    JSON.stringify(dimensions) !== JSON.stringify(appliedDimensions);

  return (
    <div className="min-h-screen flex bg-[#F5F8FC] text-slate-800 antialiased font-sans">
      {/* 1. Left White & Blue Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isAdmin={isAdmin}
        currentUser={currentUser}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        onOpenImport={() => setIsImportV2Open(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onLogout={handleLogout}
      />

      {/* 2. Right Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopContextBar
          activeTab={activeTab}
          isAdmin={isAdmin}
          isReportingTab={isReportingTab}
          isHome={isHome}
          applied={applied}
          dateCoverage={dateCoverage}
          scopeNodes={scopeNodes}
          reportView={reportView}
          activeFilterCount={dimCount}
          hasPending={hasPending}
          kpiLoading={kpiLoading}
          onOpenMobileMenu={() => setMobileNavOpen(true)}
          onOpenFilterModal={(tab) => setFilterModalTab(tab)}
          onApplyFilters={applyFilters}
          onRefresh={() => setRefreshKey((n) => n + 1)}
        />

        {/* 3. Main Content Area */}
        <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 sm:p-6 space-y-5">
          {isReportingTab && (
            <>
              {JSON.stringify(dimensions) !== JSON.stringify(appliedDimensions) && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs sm:text-sm text-amber-900 font-medium"
                >
                  <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                  <span>Điều kiện nghiệp vụ đã thay đổi. Bấm “Áp dụng” để cập nhật.</span>
                </div>
              )}

              {dateError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs sm:text-sm text-rose-800 font-medium"
                >
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{dateError}</span>
                </div>
              )}

              {autoAdjustedNotice && (
                <div
                  role="status"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] px-3.5 py-2 text-xs sm:text-sm text-[#0F294A]"
                >
                  <span className="inline-flex items-center gap-2">
                    <Sparkles size={15} className="text-[#1D4ED8] shrink-0" />
                    <span>{autoAdjustedNotice}</span>
                  </span>
                  <button
                    onClick={() => setAutoAdjustedNotice(null)}
                    className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                  >
                    Đã hiểu
                  </button>
                </div>
              )}

              {!kpiLoading &&
                kpiData &&
                kpiData.metrics.totalContracts === 0 &&
                dateCoverage &&
                dateCoverage.months.length > 0 && (
                  <div
                    role="status"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs sm:text-sm text-amber-900"
                  >
                    <span>
                      Khoảng thời gian đang chọn ({applied.fromDate} → {applied.toDate}) không có hợp đồng phát sinh.
                    </span>
                    <button
                      onClick={() => {
                        const latest = dateCoverage.months[0];
                        const targetAsOf =
                          dateCoverage.maxDate && dateCoverage.maxDate < latest.toDate ? dateCoverage.maxDate : latest.toDate;
                        applyDateRangeNow(latest.fromDate, latest.toDate, targetAsOf);
                      }}
                      className="px-3 py-1 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold transition cursor-pointer"
                    >
                      Chuyển tới tháng có DL gần nhất ({dateCoverage.months[0].label})
                    </button>
                  </div>
                )}

              {(fromDate !== applied.fromDate ||
                toDate !== applied.toDate ||
                asOfDate !== applied.asOfDate ||
                selectedDatasetId !== applied.datasetId) && (
                <div
                  role="status"
                  className="flex items-center justify-between gap-2 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] px-3.5 py-2 text-xs text-[#0F294A] font-medium"
                >
                  <span>Bộ lọc thời gian hoặc bản chốt có thay đổi chưa áp dụng.</span>
                  <button
                    onClick={applyFilters}
                    className="px-3 py-1 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-semibold cursor-pointer"
                  >
                    Áp dụng
                  </button>
                </div>
              )}

              {/* Quick Smart Rules & Active Filter Chips Bar */}
              {['home_v1', 'kpi_v1', 'trend_v1', 'contracts_v1'].includes(activeTab) &&
                (() => {
                  const activeNode = scopeNodes.find((n) => n.id === reportView.viewEmployeeId);
                  const dimFields: Array<['products' | 'terms' | 'channels' | 'statuses', string]> = [
                    ['products', 'Sản phẩm'],
                    ['terms', 'Kỳ hạn'],
                    ['channels', 'Kênh'],
                    ['statuses', 'Trạng thái'],
                  ];
                  const stMap: Record<string, string> = {
                    APPROVED: 'Đã duyệt',
                    LIQUIDATED: 'Đã tất toán',
                    PENDING: 'Chưa duyệt',
                    ADVANCING: 'Đang ứng tiền',
                  };
                  const totalActive = countActiveFilters(appliedDimensions) + (reportView.viewEmployeeId ? 1 : 0);

                  return (
                    <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200/90 rounded-xl px-3.5 py-2.5 shadow-2xs text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F294A] mr-0.5">
                        <Zap size={14} className="text-[#1D4ED8]" />
                        <span>Lọc nhanh:</span>
                      </span>

                      <div
                        className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 font-semibold"
                        title="Loại trừ hợp đồng thanh lý sớm khỏi Doanh số, Số HĐ và Quy mô TB"
                      >
                        {([
                          [5, 'Loại ≤ 5 ngày'],
                          [10, 'Loại ≤ 10 ngày'],
                          [0, 'Không loại'],
                        ] as const).map(([days, lbl]) => {
                          const active = (appliedDimensions.earlyLiquidationMaxDays ?? 5) === days;
                          return (
                            <button
                              key={days}
                              type="button"
                              onClick={() =>
                                applyDimensionsNow({
                                  ...appliedDimensions,
                                  earlyLiquidationMaxDays: days,
                                  excludeTenDays: days === 10,
                                })
                              }
                              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                                active
                                  ? 'bg-[#1D4ED8] text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-[#0F294A]'
                              }`}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          applyDimensionsNow({
                            ...appliedDimensions,
                            excludeSafeNewCust: !appliedDimensions.excludeSafeNewCust,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold border transition cursor-pointer ${
                          appliedDimensions.excludeSafeNewCust
                            ? 'bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-[#EFF6FF] hover:border-[#DBEAFE] hover:text-[#1D4ED8]'
                        }`}
                        title="Chuẩn KH mới: HĐ ngoài Safe đầu tiên trong kỳ >= 1 triệu VNĐ"
                      >
                        {appliedDimensions.excludeSafeNewCust && <Check size={12} />}
                        <span>KH mới (≥ 1Tr)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          applyDimensionsNow({
                            ...appliedDimensions,
                            excludeGhost: !appliedDimensions.excludeGhost,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold border transition cursor-pointer ${
                          appliedDimensions.excludeGhost
                            ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                        title="Loại trừ các hợp đồng ma khỏi mọi chỉ số"
                      >
                        {appliedDimensions.excludeGhost && <Check size={12} className="text-amber-700" />}
                        <span>Loại HĐ ma</span>
                      </button>

                      {activeNode && (
                        <button
                          type="button"
                          onClick={() => changeReportView({ view: 'subtree' })}
                          className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] px-2.5 py-1 font-semibold cursor-pointer"
                        >
                          <Users size={12} />
                          <span>
                            {activeNode.label} ({reportView.view === 'subtree' ? 'Cả CN' : 'Cá nhân'})
                          </span>
                          <X size={12} />
                        </button>
                      )}

                      {dimFields.flatMap(([field, label]) =>
                        appliedDimensions[field].map((opt) => (
                          <button
                            key={`${field}:${opt}`}
                            type="button"
                            onClick={() =>
                              applyDimensionsNow({
                                ...appliedDimensions,
                                [field]: appliedDimensions[field].filter((x) => x !== opt),
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE] px-2.5 py-1 font-semibold cursor-pointer"
                          >
                            {label}: {stMap[opt] || opt} <X size={12} />
                          </button>
                        ))
                      )}

                      {totalActive > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            applyDimensionsNow(emptyDimensions());
                            if (reportView.viewEmployeeId) changeReportView({ view: 'subtree' });
                          }}
                          className="ml-auto text-rose-600 hover:underline font-semibold cursor-pointer"
                        >
                          Đặt lại bộ lọc
                        </button>
                      )}
                    </div>
                  );
                })()}
            </>
          )}

          {activeTab === 'home_v1' && (
            <HomeDashboard
              reportView={reportView}
              appliedDimensions={appliedDimensions}
              datasetId={applied.datasetId || undefined}
              refreshKey={refreshKey}
              onOpenContracts={(basis, from, to, asOf) => {
                setContractBasis(basis);
                applyDateRangeNow(from, to, asOf);
                setActiveTab('contracts_v1');
              }}
              onOpenOverview={() => setActiveTab('kpi_v1')}
              onDrillDown={drillDown}
            />
          )}

          {activeTab === 'kpi_v1' && (
            <div>
              {/* Section Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-sm font-bold text-[#0F294A] uppercase tracking-wide">
                    Kết quả tổng quan
                  </h2>
                  <div className="inline-flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                    {([
                      ['today', 'Hôm nay'],
                      ['this_month', 'Tháng này'],
                      ['last_month', 'Tháng trước'],
                      ['this_quarter', 'Quý này'],
                      ['this_year', 'Cả năm'],
                    ] as const).map(([preset, lbl]) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => applyPreset(preset, true)}
                        className="px-2.5 py-1 rounded-lg text-slate-600 hover:bg-[#EFF6FF] hover:text-[#1D4ED8] transition cursor-pointer"
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterModalTab('time')}
                    className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-[#EFF6FF] border border-slate-200 hover:border-[#BFDBFE] text-[#0F294A] hover:text-[#1D4ED8] font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer tabular-nums"
                    title="Chọn khoảng thời gian & ngày chốt (Phím T)"
                  >
                    <Calendar size={13} className="text-[#1D4ED8]" />
                    <span>
                      {applied.fromDate} → {applied.toDate}
                    </span>
                  </button>
                  <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold px-3 py-1.5 rounded-xl tabular-nums">
                    <Landmark size={13} />
                    <span>Chốt: {applied.asOfDate}</span>
                  </span>
                  {selectedDatasetId && (
                    <span className="text-xs bg-[#EFF6FF] border border-[#DBEAFE] text-[#1D4ED8] font-semibold px-3 py-1.5 rounded-xl">
                      Bản chốt: {selectedDatasetId.substring(0, 8)}...
                    </span>
                  )}
                </div>
              </div>

              {/* 7 Core KPI Cards */}
              {kpiError ? (
                <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
                  {kpiError}{' '}
                  <button onClick={() => setRefreshKey((n) => n + 1)} className="underline font-semibold cursor-pointer">
                    Thử lại
                  </button>
                </div>
              ) : (
                <KpiCardsV1
                  kpiData={kpiData}
                  loading={kpiLoading}
                  excludeSafeNewCust={appliedDimensions.excludeSafeNewCust}
                  earlyLiquidationMaxDays={appliedDimensions.earlyLiquidationMaxDays ?? 5}
                  onOpenDetails={(basis) => {
                    setContractBasis(basis);
                    setActiveTab('contracts_v1');
                  }}
                />
              )}

              <div className="flex justify-end mb-3">
                <button
                  onClick={() => setActiveTab('trend_v1')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                >
                  <span>Phân tích chi tiết</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Embedded Trend & Pivot */}
              <TrendAndPivotSection
                compact
                refreshKey={refreshKey}
                onDrillDown={drillDown}
                {...appliedDimensions}
                fromDate={applied.fromDate}
                toDate={applied.toDate}
                asOfDate={applied.asOfDate}
                datasetId={applied.datasetId || undefined}
                {...reportView}
              />
            </div>
          )}

          {activeTab === 'trend_v1' && (
            <TrendAndPivotSection
              refreshKey={refreshKey}
              onDrillDown={drillDown}
              {...appliedDimensions}
              fromDate={applied.fromDate}
              toDate={applied.toDate}
              asOfDate={applied.asOfDate}
              datasetId={applied.datasetId || undefined}
              {...reportView}
            />
          )}

          {activeTab === 'contracts_v1' && (
            <ContractsTableV1
              basis={contractBasis}
              isAdmin={isAdmin}
              refreshKey={refreshKey}
              onBasisChange={setContractBasis}
              onGhostToggled={() => setRefreshKey((n) => n + 1)}
              asOfDate={applied.asOfDate}
              {...appliedDimensions}
              fromDate={applied.fromDate}
              toDate={applied.toDate}
              datasetId={applied.datasetId || undefined}
              {...reportView}
            />
          )}

          {activeTab === 'stocks_v1' && (
            <StocksSection
              refreshKey={refreshKey}
              fromDate={applied.fromDate}
              toDate={applied.toDate}
              datasetId={applied.datasetId || undefined}
              {...reportView}
            />
          )}

          {activeTab === 'org_tree_v1' && (
            <OrgTreeSection
              refreshKey={refreshKey}
              asOfDate={applied.asOfDate}
              isAdmin={isAdmin}
              datasetId={applied.datasetId || undefined}
              {...reportView}
              onViewNode={(id) => {
                const node = scopeNodes.find((n) => n.id === id);
                changeReportView({ viewEmployeeId: id, view: node?.canViewSubtree ? 'subtree' : 'self' });
                setActiveTab('kpi_v1');
              }}
            />
          )}

          {activeTab === 'users' && isAdmin && <UserManagement branches={branches} />}

          {activeTab === 'permissions' && isAdmin && <PermissionsPage />}
        </main>
      </div>

      {/* 4. Setup Modal for Time, Scope & Dimension Filters */}
      {filterModalTab !== null && isReportingTab && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6"
          onClick={() => setFilterModalTab(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Thiết lập Bộ lọc và Phạm vi"
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center">
                    <SlidersHorizontal size={16} />
                  </div>
                  <span className="text-base font-bold text-[#0F294A]">Thiết lập Bộ lọc &amp; Phạm vi</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterModalTab('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      filterModalTab === 'all' ? 'bg-[#1D4ED8] text-white' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    Tất cả (F)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterModalTab('time')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      filterModalTab === 'time' ? 'bg-[#1D4ED8] text-white' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    Thời gian (T)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterModalTab('scope')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      filterModalTab === 'scope' ? 'bg-[#1D4ED8] text-white' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    Nhân sự &amp; Lọc (S)
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilterModalTab(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <span>Đóng (Esc)</span>
                <X size={14} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 bg-[#F8FAFC]/50">
              {(filterModalTab === 'all' || filterModalTab === 'time') && (
                <section className="space-y-3 bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-[#0F294A] flex items-center gap-2">
                      <Calendar size={17} className="text-[#1D4ED8]" />
                      <span>1. Thời gian &amp; Bản chốt dữ liệu</span>
                    </h3>
                    {dateCoverage?.minDate && dateCoverage?.maxDate && (
                      <span className="text-xs text-slate-500 tabular-nums">
                        Dữ liệu hiện có: <strong className="text-[#0F294A]">{dateCoverage.minDate}</strong> →{' '}
                        <strong className="text-[#0F294A]">{dateCoverage.maxDate}</strong> (
                        {dateCoverage.totalContracts.toLocaleString('vi-VN')} HĐ)
                      </span>
                    )}
                  </div>

                  {/* Quick Date Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => applyPreset('today')}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 border border-slate-200 hover:bg-[#EFF6FF] hover:border-[#BFDBFE] text-slate-700 hover:text-[#1D4ED8] transition cursor-pointer"
                    >
                      Hôm nay
                    </button>
                    <button
                      onClick={() => applyPreset('this_month')}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 border border-slate-200 hover:bg-[#EFF6FF] hover:border-[#BFDBFE] text-slate-700 hover:text-[#1D4ED8] transition cursor-pointer"
                    >
                      Tháng này
                    </button>
                    <button
                      onClick={() => applyPreset('last_month')}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 border border-slate-200 hover:bg-[#EFF6FF] hover:border-[#BFDBFE] text-slate-700 hover:text-[#1D4ED8] transition cursor-pointer"
                    >
                      Tháng trước
                    </button>
                    <button
                      onClick={() => applyPreset('this_quarter')}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 border border-slate-200 hover:bg-[#EFF6FF] hover:border-[#BFDBFE] text-slate-700 hover:text-[#1D4ED8] transition cursor-pointer"
                    >
                      Quý này
                    </button>
                    <button
                      onClick={() => applyPreset('this_year')}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 border border-slate-200 hover:bg-[#EFF6FF] hover:border-[#BFDBFE] text-slate-700 hover:text-[#1D4ED8] transition cursor-pointer"
                    >
                      Cả năm
                    </button>
                    {dateCoverage && dateCoverage.months.length > 0 && (
                      <>
                        <button
                          onClick={() => {
                            const latest = dateCoverage.months[0];
                            const targetAsOf =
                              dateCoverage.maxDate && dateCoverage.maxDate < latest.toDate ? dateCoverage.maxDate : latest.toDate;
                            applyDateRangeNow(latest.fromDate, latest.toDate, targetAsOf);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer"
                        >
                          Tháng có DL gần nhất ({dateCoverage.months[0].label})
                        </button>
                        {dateCoverage.minDate && dateCoverage.maxDate && (
                          <button
                            onClick={() => applyDateRangeNow(dateCoverage.minDate!, dateCoverage.maxDate!, dateCoverage.maxDate!)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#EFF6FF] hover:bg-blue-100 text-[#1D4ED8] border border-[#BFDBFE] transition cursor-pointer"
                          >
                            Toàn bộ DL
                          </button>
                        )}
                        <select
                          aria-label="Chọn nhanh tháng có dữ liệu"
                          value={dateCoverage.months.find((m) => m.fromDate === fromDate && m.toDate === toDate)?.monthKey || ''}
                          onChange={(e) => {
                            const m = dateCoverage.months.find((x) => x.monthKey === e.target.value);
                            if (m) {
                              const targetAsOf =
                                dateCoverage.maxDate && dateCoverage.maxDate < m.toDate ? dateCoverage.maxDate : m.toDate;
                              applyDateRangeNow(m.fromDate, m.toDate, targetAsOf);
                            }
                          }}
                          className="border border-slate-200 bg-white text-[#0F294A] rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
                        >
                          <option value="">Tháng có DL ({dateCoverage.months.length})…</option>
                          {dateCoverage.months.map((m) => (
                            <option key={m.monthKey} value={m.monthKey}>
                              Tháng {m.label} ({m.contractCount} HĐ)
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>

                  {/* Date Pickers + Dataset */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className="font-semibold text-slate-700 text-xs">Ngày ký trong kỳ:</span>
                      <input
                        type="date"
                        aria-label="Từ ngày"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-[#0F294A] font-semibold tabular-nums"
                      />
                      <span className="text-slate-400 font-bold">→</span>
                      <input
                        type="date"
                        aria-label="Đến ngày"
                        value={toDate}
                        onChange={(e) => {
                          setToDate(e.target.value);
                          setAsOfDate(e.target.value);
                        }}
                        className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-[#0F294A] font-semibold tabular-nums"
                      />
                    </div>

                    <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-2">
                      <Landmark size={14} className="text-emerald-700" />
                      <span className="font-semibold text-emerald-900 text-xs">Chốt số dư:</span>
                      <input
                        type="date"
                        aria-label="Ngày chốt số dư"
                        value={asOfDate}
                        onChange={(e) => setAsOfDate(e.target.value)}
                        className="bg-white border border-emerald-200 rounded-md px-2 py-1 text-xs text-emerald-950 font-semibold tabular-nums"
                      />
                    </div>

                    <select
                      value={selectedDatasetId}
                      onChange={(e) => setSelectedDatasetId(e.target.value)}
                      className="border border-slate-200 bg-white text-[#0F294A] rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      <option value="">Dữ liệu hiện tại</option>
                      {datasets.map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {d.datasetCode} - {d.title} (Chốt: {d.cutoffDate})
                        </option>
                      ))}
                    </select>
                  </div>
                </section>
              )}

              {(filterModalTab === 'all' || filterModalTab === 'scope') && (
                <UnifiedFilterScopePanel
                  embedded
                  nodes={scopeNodes}
                  value={reportView}
                  onChange={changeReportView}
                  loading={scopeLoading}
                  error={scopeError}
                  onRetry={() => setScopeRevision((n) => n + 1)}
                  defaultLabel={
                    isAdmin
                      ? 'Toàn bộ phạm vi được cấp'
                      : `Phạm vi của tôi${
                          currentUser.scopeNodeName || currentUser.branchAccess
                            ? ` · ${currentUser.scopeNodeName || currentUser.branchAccess}`
                            : ''
                        }`
                  }
                  showDimensions={activeTab !== 'stocks_v1' && activeTab !== 'org_tree_v1'}
                  dimensions={dimensions}
                  appliedDimensions={appliedDimensions}
                  onChangeDimensions={setDimensions}
                  datasetId={applied.datasetId || undefined}
                  toDate={applied.toDate}
                  showSavedViews={activeTab !== 'org_tree_v1'}
                  username={currentUser.username}
                  savedReportValue={{ fromDate, toDate, asOfDate, datasetId: selectedDatasetId, dimensions, reportView }}
                  onLoadSavedView={loadSavedView}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 hidden sm:inline">
                Phím tắt: <kbd className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[11px]">F</kbd>{' '}
                Bộ lọc · <kbd className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[11px]">T</kbd>{' '}
                Thời gian · <kbd className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[11px]">S</kbd>{' '}
                Nhân sự · <kbd className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[11px]">Esc</kbd>{' '}
                Đóng
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setFilterModalTab(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    applyFilters();
                    setFilterModalTab(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Áp dụng &amp; Đóng</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Help & Keyboard Shortcuts Modal */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6"
          onClick={() => setHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Hướng dẫn sử dụng nhanh"
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center">
                  <HelpCircle size={17} />
                </div>
                <h2 className="text-base font-bold text-[#0F294A]">Hướng dẫn sử dụng &amp; Phím tắt</h2>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <span>Đóng (Esc)</span>
                <X size={14} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
                <h3 className="font-bold text-[#0F294A]">1. Phím tắt trên màn hình báo cáo</h3>
                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span>Mở toàn bộ Bộ lọc &amp; Phạm vi</span>
                    <kbd className="px-2 py-0.5 font-mono font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE] rounded">
                      F
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span>Chọn Thời gian &amp; Bản chốt</span>
                    <kbd className="px-2 py-0.5 font-mono font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE] rounded">
                      T
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span>Chọn Nhân sự (HR / Sale HĐ)</span>
                    <kbd className="px-2 py-0.5 font-mono font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE] rounded">
                      S
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span>Mở Hướng dẫn / Đóng cửa sổ</span>
                    <span className="space-x-1">
                      <kbd className="px-2 py-0.5 font-mono font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE] rounded">
                        H
                      </kbd>
                      <kbd className="px-2 py-0.5 font-mono font-bold bg-slate-100 border border-slate-300 rounded">
                        Esc
                      </kbd>
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-[#EFF6FF]/70 border border-[#DBEAFE] p-3.5 space-y-1.5">
                <h3 className="font-bold text-[#0F294A]">2. Lọc Thời gian thông minh</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li>
                    <strong>Tháng có DL gần nhất</strong>: Nhảy ngay về tháng mới nhất có phát sinh hợp đồng.
                  </li>
                  <li>
                    <strong>Toàn bộ DL</strong>: Xem toàn bộ dữ liệu từ ngày đầu tiên đến ngày mới nhất trong hệ thống.
                  </li>
                  <li>
                    <strong>Dropdown Tháng có DL</strong>: Liệt kê các tháng thực sự có hợp đồng kèm số lượng.
                  </li>
                  <li>
                    <strong>Chốt số dư</strong>: Là mốc ngày tính dư nợ/số dư tích lũy (độc lập với ngày ký trong kỳ).
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5">
                <h3 className="font-bold text-[#0F294A]">3. Phân biệt Cây nhân sự (HR) &amp; Sale HĐ</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li>
                    <strong>Cây nhân sự (HR)</strong>: Nhân sự từ file Excel Nhân sự — có Chức vụ (GĐCN, TPKD, CVKD), Chi nhánh và chuyển đổi được giữa <strong>Doanh số chi nhánh / cấp dưới</strong> và <strong>Doanh số cá nhân</strong>.
                  </li>
                  <li>
                    <strong>Sale HĐ</strong>: Sale tự động nhận diện từ hợp đồng khi chưa có trong file Nhân sự — chỉ xem <strong>Doanh số cá nhân</strong>.
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3.5 space-y-1.5">
                <h3 className="font-bold text-amber-950">4. Bộ lọc nghiệp vụ thông minh &amp; Hợp đồng ma</h3>
                <ul className="list-disc pl-5 space-y-1 text-amber-900">
                  <li>
                    <strong>Loại HĐ ≤ 5 / 10 ngày</strong>: Tùy chọn loại trừ các HĐ thanh lý sớm ra khỏi doanh số.
                  </li>
                  <li>
                    <strong>KH mới (Ngoài Safe ≥ 1Tr)</strong>: Tùy chọn lọc số KH có HĐ khác Safe đầu tiên trong kỳ từ 1 triệu trở lên.
                  </li>
                  <li>
                    <strong>Hợp đồng ma</strong>: Đánh dấu trực tiếp trên bảng HĐ hoặc nạp từ Excel (nguồn số 6). Dòng HĐ ma được tô nền vàng trên UI và khi xuất Excel để đối soát.
                  </li>
                </ul>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold transition cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Import 6 Nguồn Modal */}
      {isAdmin && (
        <ImportV2Modal
          isOpen={isImportV2Open}
          onClose={() => setIsImportV2Open(false)}
          onSuccess={() => {
            setScopeRevision((n) => n + 1);
            setRefreshKey((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
