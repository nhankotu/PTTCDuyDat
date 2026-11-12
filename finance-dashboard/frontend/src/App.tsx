import { useState, useEffect, useRef } from 'react';
import { ReportFilterPanel, emptyDimensions } from './components/ReportFilterPanel';
import { SavedReportViews, SavedReportValue } from './components/SavedReportViews';
import { ScopeSelector } from './components/ScopeSelector';
import { UnifiedFilterScopePanel } from './components/UnifiedFilterScopePanel';
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
import { KpiReportResponse, ReportView, ViewScopeNode, DimensionFilters, DateCoverageResponse } from './types/v1';

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

  const [activeTab, setActiveTab] = useState<
    'kpi_v1' | 'trend_v1' | 'contracts_v1' | 'stocks_v1' | 'org_tree_v1' | 'users' | 'permissions'
  >('kpi_v1');

  const [contractBasis, setContractBasis] = useState<'sales' | 'balance'>('sales');
  const [isImportV2Open, setIsImportV2Open] = useState(false);

  // Date filters
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [toDate, setToDate] = useState<string>(() => {
    return new Date().toLocaleDateString('en-CA');
  });
  const [asOfDate, setAsOfDate] = useState<string>(() => {
    return new Date().toLocaleDateString('en-CA');
  });

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
    setRefreshKey(n => n + 1);
  };

  useEffect(() => {
    let active = true;
    setScopeNodes([]); setScopeError(null); setScopeLoading(true);
    if (!currentUser) { setReportView({ view: 'subtree' }); return; }
    apiV1.getViewScopes(applied.datasetId || undefined).then(nodes => {
      if (!active) return;
      setScopeNodes(nodes);
      setReportView(previous => {
        if (previous.viewEmployeeId && !nodes.some(n => n.id === previous.viewEmployeeId))
          setScopeError('Node đang xem không còn trong phạm vi được cấp. Bạn có thể quay về phạm vi của mình.');
        return previous;
      });
    }).catch(err => {
      if (active) setScopeError(err.response?.data?.message || 'Không tải được danh sách nhân sự được phép xem.');
    }).finally(() => { if (active) setScopeLoading(false); });
    return () => { active = false; };
  }, [currentUser?.username, applied.datasetId, scopeRevision]);

  useEffect(() => {
    const handleLogout = () => {
      setCurrentUser(null);
      setReportView({ view: 'subtree' });
    };
    window.addEventListener('finra_auth_logout', handleLogout);
    return () => window.removeEventListener('finra_auth_logout', handleLogout);
  }, []);

  const loadKpiV1 = async () => {
    if (!currentUser) return;
    const id = ++requestId.current;
    setKpiLoading(true); setKpiData(null); setKpiError(null);
    try {
      const res = await apiV1.getKpi({ ...applied, datasetId: applied.datasetId || undefined, ...reportView, ...appliedDimensions });
      if (id === requestId.current) setKpiData(res);
    } catch (err: any) {
      if (id === requestId.current) setKpiError(err.response?.data?.message || 'Không tải được số liệu. Vui lòng thử lại.');
    } finally {
      if (id === requestId.current) setKpiLoading(false);
    }
  };

  useEffect(() => {
    loadKpiV1();
    return () => { requestId.current++; };
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
    setScopeError(null); setReportView(value);
    apiV1.recordScopeSelection({ ...value, datasetId: applied.datasetId || undefined }).catch(err => {
      if (id === selectionRequest.current)
        setScopeError(err.response?.data?.message || 'Chưa xác nhận được phạm vi xem. Vui lòng thử lại.');
    });
  };

  const loadSavedView = (value: SavedReportValue) => {
    setFromDate(value.fromDate); setToDate(value.toDate); setAsOfDate(value.asOfDate);
    setSelectedDatasetId(value.datasetId);
    setDimensions(value.dimensions); setAppliedDimensions(value.dimensions);
    setApplied({ fromDate: value.fromDate, toDate: value.toDate, asOfDate: value.asOfDate, datasetId: value.datasetId });
    setReportView(value.reportView); setRefreshKey(n => n + 1); setDateError(null);
    setScopeRevision(n => n + 1);
  };
  const drillDown = (groupBy: string, groupKey: string) => {
    if (groupBy === 'sale') {
      if (!scopeNodes.some(node => node.id === groupKey)) return;
      setReportView({ viewEmployeeId: groupKey, view: 'self' });
    } else {
      const field = ({ product: 'products', term: 'terms', channel: 'channels' } as const)[groupBy as 'product' | 'term' | 'channel'];
      if (!field) return;
      const next = { ...appliedDimensions, [field]: [groupKey] };
      setDimensions(next); setAppliedDimensions(next);
    }
    setContractBasis('sales'); setActiveTab('contracts_v1');
  };

  const handleLogout = async () => {
    await dashboardApi.logout();
    setCurrentUser(null);
  };

  // Date Presets Helper
  const applyPreset = (preset: 'today' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year') => {
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

    setFromDate(start);
    setToDate(end);
    setAsOfDate(end);
    setAutoAdjustedNotice(null);
  };

  const applyDateRangeNow = (start: string, end: string, asOf?: string, notice?: string | null) => {
    const targetAsOf = asOf || end;
    setDateError(null);
    setFromDate(start);
    setToDate(end);
    setAsOfDate(targetAsOf);
    setAutoAdjustedNotice(notice ?? null);
    setApplied({ fromDate: start, toDate: end, asOfDate: targetAsOf, datasetId: selectedDatasetId });
  };

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    apiV1.getDateCoverage({
      datasetId: selectedDatasetId || undefined,
      ...reportView
    }).then(cov => {
      if (!active) return;
      setDateCoverage(cov);
      if (!hasAutoAdjustedRef.current && cov.months.length > 0) {
        hasAutoAdjustedRef.current = true;
        const currentMonthKey = fromDate.slice(0, 7);
        if (!cov.months.some(m => m.monthKey === currentMonthKey)) {
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
    }).catch(() => {
      if (active) setDateCoverage(null);
    });
    return () => { active = false; };
  }, [currentUser, selectedDatasetId, reportView.viewEmployeeId, reportView.view, refreshKey]);

  useEffect(() => {
    const isReportingTab = ['kpi_v1', 'trend_v1', 'contracts_v1', 'stocks_v1', 'org_tree_v1'].includes(activeTab);
    if (!currentUser || !isReportingTab) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFilterModalTab(null);
        setHelpOpen(false);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

      const k = e.key.toLowerCase();
      if (k === 'f') {
        e.preventDefault();
        setHelpOpen(false);
        setFilterModalTab(prev => (prev ? null : 'all'));
      } else if (k === 't') {
        e.preventDefault();
        setHelpOpen(false);
        setFilterModalTab(prev => (prev === 'time' ? null : 'time'));
      } else if (k === 's') {
        e.preventDefault();
        setHelpOpen(false);
        setFilterModalTab(prev => (prev === 'scope' ? null : 'scope'));
      } else if (k === 'h' || e.key === '?') {
        e.preventDefault();
        setFilterModalTab(null);
        setHelpOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentUser, activeTab]);

  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(session) => {
          setCurrentUser(session);
        }}
      />
    );
  }

  const isAdmin = currentUser.role === 'admin';
  const userInitials = (currentUser.fullName || currentUser.username || 'AD')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased font-sans">
      {/* 1. Top Navigation Bar (Deep Slate Fintech Style) */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-2.5 flex flex-wrap gap-3 items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-6">
          {/* Logo Finra */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center font-black text-white text-base shadow-sm ring-1 ring-white/20">
              F
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white">
                Finra
              </span>
              <span className="text-[10px] font-bold bg-blue-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Báo cáo kinh doanh
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-700/80 hidden md:block" />

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('kpi_v1')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'kpi_v1'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>📊</span>
              <span>6 Chỉ Số KPI</span>
            </button>

            <button
              onClick={() => setActiveTab('trend_v1')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'trend_v1'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>📈</span>
              <span>Xu Hướng & Cơ Cấu</span>
            </button>

            <button
              onClick={() => { setContractBasis('sales'); setActiveTab('contracts_v1'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'contracts_v1'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>📋</span>
              <span>Tra Cứu HĐ (CSV)</span>
            </button>

            <button
              onClick={() => setActiveTab('stocks_v1')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'stocks_v1'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>📜</span>
              <span>Chứng Khoán</span>
            </button>

            <button
              onClick={() => setActiveTab('org_tree_v1')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'org_tree_v1'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>🌳</span>
              <span>Cây Nhân Sự</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'users'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/10'
                }`}
              >
                <span>👥</span>
                <span>Người Dùng</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setActiveTab('permissions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'permissions'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-purple-400/90 hover:text-purple-300 hover:bg-purple-500/10'
                }`}
              >
                <span>🔐</span>
                <span>Phân Quyền Scope</span>
              </button>
            )}
          </nav>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3.5">
          {isAdmin && (
            <button
              onClick={() => setIsImportV2Open(true)}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-emerald-400/30 hover:scale-[1.02]"
            >
              <span className="text-sm">📥</span>
              <span>Import Data</span>
            </button>
          )}

          {/* User profile & Logout */}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200 shadow-inner">
                {userInitials}
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-white leading-tight">
                  {currentUser.fullName || currentUser.username}
                </div>
                <div className="text-[10px] font-semibold text-slate-400">
                  {isAdmin ? 'Quản trị viên' : `Nhân viên ${currentUser.branchAccess || ''}`}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/80 hover:border-rose-500/30 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer"
              title="Đăng xuất khỏi hệ thống"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <label className="md:hidden block px-4 py-3 bg-slate-900 text-slate-200 text-sm">Chuyển màn hình
        <select aria-label="Chuyển màn hình" value={activeTab} onChange={e => setActiveTab(e.target.value as typeof activeTab)} className="ml-3 p-2 rounded-lg bg-slate-800 text-white">
          <option value="kpi_v1">Tổng quan</option><option value="trend_v1">Xu hướng & Cơ cấu</option>
          <option value="contracts_v1">Hợp đồng</option><option value="stocks_v1">Chứng khoán</option><option value="org_tree_v1">Cây nhân sự</option>
          {isAdmin && <><option value="users">Người dùng</option><option value="permissions">Phân quyền</option></>}
        </select>
      </label>
      {/* 3. Main Content Area */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 sm:p-6 pb-24 space-y-5">
        {!['users', 'permissions'].includes(activeTab) && <>
          {JSON.stringify(dimensions) !== JSON.stringify(appliedDimensions) && (
            <p role="status" className="text-xs sm:text-sm text-amber-800 font-medium">
              ⚠️ Điều kiện nghiệp vụ đã thay đổi. Bấm “Áp dụng” để cập nhật.
            </p>
          )}
          {dateError && <p role="alert" className="text-rose-700">{dateError}</p>}
          {autoAdjustedNotice && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs sm:text-sm text-emerald-900">
              <span>✨ {autoAdjustedNotice}</span>
              <button onClick={() => setAutoAdjustedNotice(null)} className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer">Đã hiểu</button>
            </div>
          )}
          {!kpiLoading && kpiData && kpiData.metrics.totalContracts === 0 && dateCoverage && dateCoverage.months.length > 0 && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs sm:text-sm text-amber-900">
              <span>Khoảng thời gian đang chọn ({applied.fromDate} → {applied.toDate}) không có hợp đồng phát sinh.</span>
              <button
                onClick={() => {
                  const latest = dateCoverage.months[0];
                  const targetAsOf = dateCoverage.maxDate && dateCoverage.maxDate < latest.toDate ? dateCoverage.maxDate : latest.toDate;
                  applyDateRangeNow(latest.fromDate, latest.toDate, targetAsOf);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                Chuyển tới tháng có DL gần nhất ({dateCoverage.months[0].label})
              </button>
            </div>
          )}
          {(fromDate !== applied.fromDate || toDate !== applied.toDate || asOfDate !== applied.asOfDate || selectedDatasetId !== applied.datasetId) && <p role="status" className="text-sm text-amber-800">Bộ lọc có thay đổi chưa áp dụng. Bấm “Áp dụng” để cập nhật báo cáo.</p>}
          <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-600">
            <span>
              Kỳ đã áp dụng: {applied.fromDate} → {applied.toDate} · Chốt số dư: {applied.asOfDate}
              {dateCoverage?.minDate && dateCoverage?.maxDate && (
                <span className="ml-2 text-xs text-slate-500">
                  (Dữ liệu hiện có: <strong>{dateCoverage.minDate}</strong> → <strong>{dateCoverage.maxDate}</strong> · {dateCoverage.totalContracts} HĐ)
                </span>
              )}
            </span>
            <button onClick={() => setRefreshKey(n => n + 1)} className="text-blue-700 font-semibold shrink-0 cursor-pointer">Làm mới dữ liệu</button>
          </div>
        </>}

        {activeTab === 'kpi_v1' && (
          <div>
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-base">
                  🎯
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">
                    Bộ 6 Chỉ Số Tài Chính Cốt Lõi
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Số liệu theo phạm vi đang xem. Chọn một chỉ tiêu để tra cứu các hợp đồng liên quan.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <span className="text-xs bg-slate-100 border border-slate-200/90 text-slate-700 font-bold px-3 py-1 rounded-lg">
                  Kỳ: {applied.fromDate} ➔ {applied.toDate}
                </span>
                <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold px-3 py-1 rounded-lg">
                  Chốt số dư: {applied.asOfDate}
                </span>
                {selectedDatasetId && (
                  <span className="text-xs bg-purple-50 border border-purple-200 text-purple-800 font-bold px-3 py-1 rounded-lg">
                    Bản chốt: {selectedDatasetId.substring(0, 8)}...
                  </span>
                )}
              </div>
            </div>

            {/* 6 Core KPI Cards */}
            {kpiError ? <div role="alert" className="p-4 rounded-xl bg-rose-50 text-rose-800">{kpiError} <button onClick={() => setRefreshKey(n => n + 1)} className="underline font-semibold">Thử lại</button></div> : <KpiCardsV1 kpiData={kpiData} loading={kpiLoading} onOpenDetails={basis => { setContractBasis(basis); setActiveTab('contracts_v1'); }} />}

            <div className="flex justify-end mb-3"><button onClick={() => setActiveTab('trend_v1')} className="text-sm font-semibold text-blue-700">Mở phân tích chi tiết →</button></div>
            {/* Embedded Trend & Pivot */}
            <TrendAndPivotSection compact onDrillDown={drillDown} {...appliedDimensions} key={reportKey} fromDate={applied.fromDate} toDate={applied.toDate} datasetId={applied.datasetId || undefined} {...reportView} />
          </div>
        )}

        {activeTab === 'trend_v1' && (
          <TrendAndPivotSection onDrillDown={drillDown} {...appliedDimensions} key={reportKey} fromDate={applied.fromDate} toDate={applied.toDate} datasetId={applied.datasetId || undefined} {...reportView} />
        )}

        {activeTab === 'contracts_v1' && (
          <ContractsTableV1 basis={contractBasis} asOfDate={applied.asOfDate} {...appliedDimensions} key={reportKey} fromDate={applied.fromDate} toDate={applied.toDate} datasetId={applied.datasetId || undefined} {...reportView} />
        )}

        {activeTab === 'stocks_v1' && (
          <StocksSection key={reportKey} fromDate={applied.fromDate} toDate={applied.toDate} datasetId={applied.datasetId || undefined} {...reportView} />
        )}

        {activeTab === 'org_tree_v1' && (
          <OrgTreeSection key={reportKey} isAdmin={isAdmin} datasetId={applied.datasetId || undefined} {...reportView} onViewNode={id => {
            const node = scopeNodes.find(n => n.id === id);
            changeReportView({ viewEmployeeId: id, view: node?.canViewSubtree ? 'subtree' : 'self' });
            setActiveTab('kpi_v1');
          }} />
        )}

        {activeTab === 'users' && isAdmin && (
          <UserManagement branches={branches} />
        )}

        {activeTab === 'permissions' && isAdmin && (
          <PermissionsPage />
        )}
      </main>

      {/* 3b. Floating Bottom Taskbar Dock (Phím tắt: F / T / S / Esc) */}
      {['kpi_v1', 'trend_v1', 'contracts_v1', 'stocks_v1', 'org_tree_v1'].includes(activeTab) && (() => {
        const selectedNode = scopeNodes.find(n => n.id === reportView.viewEmployeeId);
        const dimCount = Object.values(appliedDimensions).reduce((sum, list) => sum + list.length, 0);
        const hasPending =
          fromDate !== applied.fromDate ||
          toDate !== applied.toDate ||
          asOfDate !== applied.asOfDate ||
          selectedDatasetId !== applied.datasetId ||
          JSON.stringify(dimensions) !== JSON.stringify(appliedDimensions);

        return (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[96vw]">
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-2xl bg-slate-900/95 text-white shadow-2xl border border-slate-700/80 backdrop-blur-md text-xs">
              <button
                type="button"
                onClick={() => setFilterModalTab('time')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold transition cursor-pointer"
                title="Mở cài đặt Thời gian & Bản chốt (Phím T)"
              >
                <span>📅</span>
                <span className="truncate max-w-[170px] sm:max-w-none">{applied.fromDate} → {applied.toDate}</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-700 text-slate-300 rounded">T</kbd>
              </button>

              <button
                type="button"
                onClick={() => setFilterModalTab('scope')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold transition cursor-pointer"
                title="Mở cài đặt Phạm vi nhân sự & Sale HĐ (Phím S)"
              >
                <span>👥</span>
                <span className="truncate max-w-[160px] sm:max-w-[220px]">
                  {selectedNode
                    ? `${selectedNode.label} (${selectedNode.source === 'CONTRACT' ? 'Sale HĐ' : reportView.view === 'subtree' ? 'Cả CN' : 'Cá nhân'})`
                    : (isAdmin ? 'Toàn hệ thống' : 'Phạm vi của tôi')}
                </span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-700 text-slate-300 rounded">S</kbd>
              </button>

              <button
                type="button"
                onClick={() => setFilterModalTab('all')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition cursor-pointer shadow-xs"
                title="Mở cửa sổ Setup Bộ lọc & Phạm vi đầy đủ (Phím F)"
              >
                <span>🎛️ Bộ lọc{dimCount > 0 ? ` (${dimCount})` : ''}</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-blue-700 text-blue-100 rounded">F</kbd>
              </button>

              {hasPending && (
                <button
                  type="button"
                  onClick={applyFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer animate-pulse"
                >
                  <span>🔄 Áp dụng</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setRefreshKey(n => n + 1)}
                className="inline-flex items-center justify-center px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                title="Làm mới dữ liệu"
                aria-label="Làm mới dữ liệu"
              >
                {kpiLoading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '↻'}
              </button>

              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition cursor-pointer"
                title="Hướng dẫn sử dụng & Phím tắt (Phím H hoặc ?)"
                aria-label="Hướng dẫn sử dụng"
              >
                <span>❓</span>
                <span className="hidden md:inline">Hướng dẫn</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-700 text-slate-300 rounded">H</kbd>
              </button>
            </div>
          </div>
        );
      })()}

      {/* 3c. Setup Modal for Time, Scope & Dimension Filters */}
      {filterModalTab !== null && ['kpi_v1', 'trend_v1', 'contracts_v1', 'stocks_v1', 'org_tree_v1'].includes(activeTab) && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
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
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-extrabold text-slate-900">🎛️ Thiết lập Bộ lọc & Phạm vi</span>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterModalTab('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${filterModalTab === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    Tất cả (F)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterModalTab('time')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${filterModalTab === 'time' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    Thời gian (T)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterModalTab('scope')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${filterModalTab === 'scope' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    Nhân sự & Lọc (S)
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilterModalTab(null)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Đóng (Esc) ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6">
              {(filterModalTab === 'all' || filterModalTab === 'time') && (
                <section className="space-y-3 bg-slate-50/70 border border-slate-200 rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900">📅 1. Thời gian & Bản chốt dữ liệu</h3>
                    {dateCoverage?.minDate && dateCoverage?.maxDate && (
                      <span className="text-xs text-slate-500">
                        Dữ liệu hiện có: <strong>{dateCoverage.minDate}</strong> → <strong>{dateCoverage.maxDate}</strong> ({dateCoverage.totalContracts} HĐ)
                      </span>
                    )}
                  </div>

                  {/* Quick Date Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button onClick={() => applyPreset('today')} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer">Hôm nay</button>
                    <button onClick={() => applyPreset('this_month')} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer">Tháng này</button>
                    <button onClick={() => applyPreset('last_month')} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer">Tháng trước</button>
                    <button onClick={() => applyPreset('this_quarter')} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer">Quý này</button>
                    <button onClick={() => applyPreset('this_year')} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer">Cả năm</button>
                    {dateCoverage && dateCoverage.months.length > 0 && (
                      <>
                        <button
                          onClick={() => {
                            const latest = dateCoverage.months[0];
                            const targetAsOf = dateCoverage.maxDate && dateCoverage.maxDate < latest.toDate ? dateCoverage.maxDate : latest.toDate;
                            applyDateRangeNow(latest.fromDate, latest.toDate, targetAsOf);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer"
                        >
                          Tháng có DL gần nhất ({dateCoverage.months[0].label})
                        </button>
                        {dateCoverage.minDate && dateCoverage.maxDate && (
                          <button
                            onClick={() => applyDateRangeNow(dateCoverage.minDate!, dateCoverage.maxDate!, dateCoverage.maxDate!)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition cursor-pointer"
                          >
                            Toàn bộ DL
                          </button>
                        )}
                        <select
                          aria-label="Chọn nhanh tháng có dữ liệu"
                          value={dateCoverage.months.find(m => m.fromDate === fromDate && m.toDate === toDate)?.monthKey || ''}
                          onChange={(e) => {
                            const m = dateCoverage.months.find(x => x.monthKey === e.target.value);
                            if (m) {
                              const targetAsOf = dateCoverage.maxDate && dateCoverage.maxDate < m.toDate ? dateCoverage.maxDate : m.toDate;
                              applyDateRangeNow(m.fromDate, m.toDate, targetAsOf);
                            }
                          }}
                          className="border border-emerald-200 bg-white text-emerald-900 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        >
                          <option value="">Tháng có DL ({dateCoverage.months.length})…</option>
                          {dateCoverage.months.map(m => (
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
                    <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                      <span className="font-semibold text-slate-700 text-xs">Ngày ký trong kỳ:</span>
                      <input
                        type="date" aria-label="Từ ngày"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 font-semibold"
                      />
                      <span className="text-slate-400 font-bold">➔</span>
                      <input
                        type="date" aria-label="Đến ngày"
                        value={toDate}
                        onChange={(e) => {
                          setToDate(e.target.value);
                          setAsOfDate(e.target.value);
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 font-semibold"
                      />
                    </div>

                    <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-2">
                      <span className="font-bold text-emerald-900 text-xs">🏦 Chốt số dư:</span>
                      <input
                        type="date" aria-label="Ngày chốt số dư"
                        value={asOfDate}
                        onChange={(e) => setAsOfDate(e.target.value)}
                        className="bg-white border border-emerald-200 rounded-md px-2 py-1 text-xs text-emerald-950 font-bold"
                      />
                    </div>

                    <select
                      value={selectedDatasetId}
                      onChange={(e) => setSelectedDatasetId(e.target.value)}
                      className="border border-slate-300 bg-white text-slate-800 rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      <option value="">Dữ liệu hiện tại</option>
                      {datasets.map((d: any) => (
                        <option key={d.id} value={d.id}>
                          📦 {d.datasetCode} - {d.title} (Chốt: {d.cutoffDate})
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
                  onRetry={() => setScopeRevision(n => n + 1)}
                  defaultLabel={isAdmin ? 'Toàn bộ phạm vi được cấp' : `Phạm vi của tôi${currentUser.scopeNodeName || currentUser.branchAccess ? ` · ${currentUser.scopeNodeName || currentUser.branchAccess}` : ''}`}
                  showDimensions={activeTab !== 'stocks_v1' && activeTab !== 'org_tree_v1'}
                  dimensions={dimensions}
                  appliedDimensions={appliedDimensions}
                  onChangeDimensions={setDimensions}
                  datasetId={applied.datasetId || undefined}
                  toDate={applied.toDate}
                  showSavedViews={activeTab !== 'org_tree_v1'}
                  username={currentUser.username}
                  savedReportValue={{ ...applied, dimensions: appliedDimensions, reportView }}
                  onLoadSavedView={loadSavedView}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 hidden sm:inline">
                Phím tắt: <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px]">F</kbd> Bộ lọc · <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px]">T</kbd> Thời gian · <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px]">S</kbd> Nhân sự · <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px]">Esc</kbd> Đóng
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setFilterModalTab(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    applyFilters();
                    setFilterModalTab(null);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  🔄 Áp dụng & Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3d. Help & Keyboard Shortcuts Modal */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
          onClick={() => setHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Hướng dẫn sử dụng nhanh"
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900">❓ Hướng dẫn sử dụng & Phím tắt</h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Đóng (Esc) ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
                <h3 className="font-bold text-slate-900">1. Phím tắt trên màn hình báo cáo</h3>
                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span>Mở toàn bộ Bộ lọc & Phạm vi</span>
                    <kbd className="px-2 py-0.5 font-mono font-bold bg-slate-100 border border-slate-300 rounded">F</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span>Chọn Thời gian & Bản chốt</span>
                    <kbd className="px-2 py-0.5 font-mono font-bold bg-slate-100 border border-slate-300 rounded">T</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span>Chọn Nhân sự (HR / Sale HĐ)</span>
                    <kbd className="px-2 py-0.5 font-mono font-bold bg-slate-100 border border-slate-300 rounded">S</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span>Mở Hướng dẫn / Đóng cửa sổ</span>
                    <span className="space-x-1">
                      <kbd className="px-2 py-0.5 font-mono font-bold bg-slate-100 border border-slate-300 rounded">H</kbd>
                      <kbd className="px-2 py-0.5 font-mono font-bold bg-slate-100 border border-slate-300 rounded">Esc</kbd>
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-1.5">
                <h3 className="font-bold text-emerald-950">2. Lọc Thời gian thông minh (không cần tự mò ngày)</h3>
                <ul className="list-disc pl-5 space-y-1 text-emerald-900">
                  <li><strong>Tháng có DL gần nhất</strong>: Nhảy ngay về tháng mới nhất có phát sinh hợp đồng.</li>
                  <li><strong>Toàn bộ DL</strong>: Xem toàn bộ dữ liệu từ ngày đầu tiên đến ngày mới nhất trong hệ thống.</li>
                  <li><strong>Dropdown Tháng có DL</strong>: Liệt kê các tháng thực sự có hợp đồng kèm số lượng (VD: <em>Tháng 11/2026 (358 HĐ)</em>).</li>
                  <li><strong>Chốt số dư</strong>: Là mốc ngày tính dư nợ/số dư tích lũy (độc lập với ngày ký trong kỳ).</li>
                </ul>
              </div>

              <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-3.5 space-y-1.5">
                <h3 className="font-bold text-blue-950">3. Phân biệt Cây nhân sự (HR) & Sale HĐ</h3>
                <ul className="list-disc pl-5 space-y-1 text-blue-900">
                  <li><strong>Cây nhân sự (HR)</strong>: Nhân sự từ file Excel Nhân sự — có Chức vụ (GĐCN, TPKD, CVKD), Chi nhánh và chuyển đổi được giữa <strong>Doanh số chi nhánh / cấp dưới</strong> và <strong>Doanh số cá nhân</strong>.</li>
                  <li><strong>Sale HĐ</strong>: Sale tự động nhận diện từ hợp đồng khi chưa có trong file Nhân sự — chỉ xem <strong>Doanh số cá nhân</strong>. Khi import file Nhân sự khớp mã, hệ thống tự nâng cấp sang <strong>Cây nhân sự</strong>.</li>
                </ul>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Import 5 Nguồn Modal */}
      {isAdmin && (
        <ImportV2Modal
          isOpen={isImportV2Open}
          onClose={() => setIsImportV2Open(false)}
          onSuccess={() => {
            setScopeRevision(n => n + 1);
            setRefreshKey(n => n + 1);
          }}
        />
      )}
    </div>
  );
}
