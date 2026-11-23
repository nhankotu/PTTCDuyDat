import { useState, useEffect, useRef } from 'react';
import {
  BarChart3, TrendingUp, FileText, Landmark, GitFork, Users, ShieldCheck,
  Upload, LogOut, RefreshCw, Calendar, Wallet, RotateCcw, Check, Archive
} from 'lucide-react';
import { emptyDimensions } from './components/ReportFilterPanel';
import { SavedReportValue } from './components/SavedReportViews';
import { UnifiedFilterScopePanel } from './components/UnifiedFilterScopePanel';
import { KpiCardsV1 } from './components/KpiCardsV1';
import { TrendAndPivotSection } from './components/TrendAndPivotSection';
import { ContractsTableV1 } from './components/ContractsTableV1';
import { StocksSection } from './components/StocksSection';
import { OrgTreeSection } from './components/OrgTreeSection';
import { ImportV2Modal } from './components/ImportV2Modal';
import { CreateDatasetModal } from './components/CreateDatasetModal';
import { LoginPage } from './components/LoginPage';
import { UserManagement } from './components/UserManagement';
import { PermissionsPage } from './components/PermissionsPage';
import { apiV1 } from './services/apiV1';
import { dashboardApi } from './services/api';
import { AuthSession } from './types';
import { KpiReportResponse, ReportView, ViewScopeNode, DimensionFilters } from './types/v1';

type TabKey = 'kpi_v1' | 'trend_v1' | 'contracts_v1' | 'stocks_v1' | 'org_tree_v1' | 'users' | 'permissions';
type PresetKey = 'today' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

const VALID_TABS: TabKey[] = ['kpi_v1', 'trend_v1', 'contracts_v1', 'stocks_v1', 'org_tree_v1', 'users', 'permissions'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readInitialQuery() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as TabKey | null;
  const from = params.get('from');
  const to = params.get('to');
  const asOf = params.get('asOf');
  const dataset = params.get('dataset') || '';
  return {
    tab: tab && VALID_TABS.includes(tab) ? tab : 'kpi_v1',
    from: from && DATE_RE.test(from) ? from : null,
    to: to && DATE_RE.test(to) ? to : null,
    asOf: asOf && DATE_RE.test(asOf) ? asOf : null,
    dataset,
  };
}

function computePreviousPeriod(fromDate: string, toDate: string): { fromDate: string; toDate: string; asOfDate: string; label: string } | null {
  if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate) || fromDate > toDate) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const [sy, sm, sd] = fromDate.split('-').map(Number);
  const [ey, em, ed] = toDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const endMonthLastDay = new Date(ey, em, 0).getDate();

  if (sd === 1 && ed === endMonthLastDay) {
    const months = (ey - sy) * 12 + (em - sm) + 1;
    const prevStart = new Date(sy, sm - 1 - months, 1);
    const prevEnd = new Date(sy, sm - 1, 0);
    const label = months === 1 ? 'so với tháng trước' : months === 3 ? 'so với quý trước' : months === 12 ? 'so với năm trước' : `so với ${months} tháng trước`;
    return { fromDate: fmt(prevStart), toDate: fmt(prevEnd), asOfDate: fmt(prevEnd), label };
  }

  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (diffDays - 1) * 86400000);
  return { fromDate: fmt(prevStart), toDate: fmt(prevEnd), asOfDate: fmt(prevEnd), label: `so với ${diffDays} ngày trước` };
}

export default function App() {
  const initialQuery = useRef(readInitialQuery()).current;

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

  const [activeTab, setActiveTab] = useState<TabKey>(initialQuery.tab);

  const [contractBasis, setContractBasis] = useState<'sales' | 'balance'>('sales');
  const [isImportV2Open, setIsImportV2Open] = useState(false);
  const [isCreateDatasetOpen, setIsCreateDatasetOpen] = useState(false);

  // Date filters
  const [fromDate, setFromDate] = useState<string>(() => {
    if (initialQuery.from) return initialQuery.from;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [toDate, setToDate] = useState<string>(() => {
    return initialQuery.to || new Date().toLocaleDateString('en-CA');
  });
  const [asOfDate, setAsOfDate] = useState<string>(() => {
    return initialQuery.asOf || initialQuery.to || new Date().toLocaleDateString('en-CA');
  });
  const [activePreset, setActivePreset] = useState<PresetKey>(initialQuery.from ? 'custom' : 'this_month');

  // KPI V1 state
  const [kpiData, setKpiData] = useState<KpiReportResponse | null>(null);
  const [previousKpiData, setPreviousKpiData] = useState<KpiReportResponse | null>(null);
  const [comparisonLabel, setComparisonLabel] = useState<string>('so với kỳ trước');
  const [kpiLoading, setKpiLoading] = useState<boolean>(true);

  // Branches list for user management
  const [branches, setBranches] = useState<string[]>([]);
  // Datasets list and selected dataset
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(initialQuery.dataset);

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
  const requestId = useRef(0);
  const selectionRequest = useRef(0);
  const reportKey = JSON.stringify([applied, appliedDimensions, reportView, refreshKey, currentUser?.username]);

  // Sync tab & applied filters to URL query params so F5 preserves state
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('from', applied.fromDate);
    params.set('to', applied.toDate);
    params.set('asOf', applied.asOfDate);
    if (applied.datasetId) params.set('dataset', applied.datasetId);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', nextUrl);
  }, [activeTab, applied]);

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

  const resetPendingFilters = () => {
    setFromDate(applied.fromDate);
    setToDate(applied.toDate);
    setAsOfDate(applied.asOfDate);
    setSelectedDatasetId(applied.datasetId);
    setDimensions(appliedDimensions);
    setDateError(null);
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
    setKpiLoading(true); setKpiData(null); setPreviousKpiData(null); setKpiError(null);
    const prev = computePreviousPeriod(applied.fromDate, applied.toDate);
    setComparisonLabel(prev?.label || 'so với kỳ trước');
    try {
      const common = { datasetId: applied.datasetId || undefined, ...reportView, ...appliedDimensions };
      const [res, prevRes] = await Promise.all([
        apiV1.getKpi({ ...applied, ...common }),
        prev
          ? apiV1.getKpi({ fromDate: prev.fromDate, toDate: prev.toDate, asOfDate: prev.asOfDate, ...common }).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (id === requestId.current) {
        setKpiData(res);
        setPreviousKpiData(prevRes);
      }
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

  // Date Presets Helper (1-click apply + active highlight)
  const applyPreset = (preset: Exclude<PresetKey, 'custom'>) => {
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

    setActivePreset(preset);
    setFromDate(start);
    setToDate(end);
    setAsOfDate(end);
    setDateError(null);
    setAppliedDimensions(dimensions);
    if (applied.datasetId !== selectedDatasetId) setReportView({ view: 'subtree' });
    setApplied({ fromDate: start, toDate: end, asOfDate: end, datasetId: selectedDatasetId });
    setRefreshKey(n => n + 1);
  };

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
              <BarChart3 size={14} />
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
              <TrendingUp size={14} />
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
              <FileText size={14} />
              <span>Tra Cứu HĐ</span>
            </button>

            <button
              onClick={() => setActiveTab('stocks_v1')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'stocks_v1'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Landmark size={14} />
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
              <GitFork size={14} />
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
                <Users size={14} />
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
                <ShieldCheck size={14} />
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
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer border border-emerald-400/30 hover:scale-[1.02]"
            >
              <Upload size={14} />
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
              className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/80 hover:border-rose-500/30 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut size={13} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <label className="md:hidden block px-4 py-3 bg-slate-900 text-slate-200 text-sm">Chuyển màn hình
        <select aria-label="Chuyển màn hình" value={activeTab} onChange={e => setActiveTab(e.target.value as TabKey)} className="ml-3 p-2 rounded-lg bg-slate-800 text-white">
          <option value="kpi_v1">Tổng quan</option><option value="trend_v1">Xu hướng & Cơ cấu</option>
          <option value="contracts_v1">Hợp đồng</option><option value="stocks_v1">Chứng khoán</option><option value="org_tree_v1">Cây nhân sự</option>
          {isAdmin && <><option value="users">Người dùng</option><option value="permissions">Phân quyền</option></>}
        </select>
      </label>
      {/* 2. Global Filter & Analytics Control Bar (Chỉ hiển thị ở các tab phân tích tài chính) */}
      {['kpi_v1', 'trend_v1', 'contracts_v1', 'stocks_v1', 'org_tree_v1'].includes(activeTab) && (
      <div className="bg-white border-b border-slate-200/90 px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Kỳ:</span>
            {([
              ['today', 'Hôm nay'],
              ['this_month', 'Tháng này'],
              ['last_month', 'Tháng trước'],
              ['this_quarter', 'Quý này'],
              ['this_year', 'Cả năm'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activePreset === key
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date Pickers */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-xl px-3 py-1.5 max-w-full">
              <Calendar size={13} className="text-slate-500 shrink-0" />
              <span className="font-semibold text-slate-700 text-xs basis-full sm:basis-auto">Ngày ký:</span>
              <input
                type="date" aria-label="Từ ngày"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setActivePreset('custom'); }}
                className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-slate-400 font-bold">→</span>
              <input
                type="date" aria-label="Đến ngày"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setAsOfDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-1.5">
              <Wallet size={13} className="text-emerald-700 shrink-0" />
              <span className="font-bold text-emerald-900 text-xs">Chốt số dư:</span>
              <input
                type="date" aria-label="Ngày chốt số dư"
                value={asOfDate}
                onChange={(e) => { setAsOfDate(e.target.value); setActivePreset('custom'); }}
                className="bg-white border border-emerald-200 rounded-md px-2 py-0.5 text-xs text-emerald-950 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Dataset Selector */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="border border-slate-300 bg-white text-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
              >
                <option value="">Dữ liệu hiện tại</option>
                {datasets.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    Bản chốt: {d.datasetCode} - {d.title} ({d.cutoffDate})
                  </option>
                ))}
              </select>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsCreateDatasetOpen(true)}
                  className="inline-flex items-center gap-1 border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer"
                  title="Tạo bản chốt dữ liệu mới cho kỳ này"
                >
                  <Archive size={13} />
                  <span>Chốt kỳ</span>
                </button>
              )}

              <button
                onClick={applyFilters}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-3.5 py-1.5 font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} className={kpiLoading ? 'animate-spin' : ''} />
                <span>Áp dụng</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 3. Main Content Area */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 sm:p-6 space-y-5">
        {!['users', 'permissions'].includes(activeTab) && (() => {
          const hasPendingChanges =
            fromDate !== applied.fromDate ||
            toDate !== applied.toDate ||
            asOfDate !== applied.asOfDate ||
            selectedDatasetId !== applied.datasetId ||
            JSON.stringify(dimensions) !== JSON.stringify(appliedDimensions);
          return <>
            <UnifiedFilterScopePanel
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
            {dateError && <p role="alert" className="text-sm font-medium bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-xl">{dateError}</p>}
            {hasPendingChanges && (
              <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl text-xs sm:text-sm">
                <span className="font-medium">Bộ lọc ngày hoặc điều kiện nghiệp vụ có thay đổi chưa được áp dụng.</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={resetPendingFilters} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-xs font-semibold cursor-pointer">
                    <RotateCcw size={12} /> Hủy thay đổi
                  </button>
                  <button type="button" onClick={applyFilters} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer">
                    <Check size={12} /> Áp dụng ngay
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center gap-2 text-xs sm:text-sm text-slate-600">
              <span>Kỳ đã áp dụng: <strong>{applied.fromDate} → {applied.toDate}</strong> · Chốt số dư: <strong>{applied.asOfDate}</strong></span>
              <button onClick={() => setRefreshKey(n => n + 1)} className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold shrink-0 cursor-pointer">
                <RefreshCw size={13} /> Làm mới dữ liệu
              </button>
            </div>
          </>;
        })()}

        {activeTab === 'kpi_v1' && (
          <div>
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center">
                  <BarChart3 size={18} />
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
                  Kỳ: {applied.fromDate} → {applied.toDate}
                </span>
                <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold px-3 py-1 rounded-lg">
                  Chốt số dư: {applied.asOfDate}
                </span>
                {applied.datasetId && (
                  <span className="text-xs bg-purple-50 border border-purple-200 text-purple-800 font-bold px-3 py-1 rounded-lg">
                    Bản chốt: {applied.datasetId.substring(0, 8)}...
                  </span>
                )}
              </div>
            </div>

            {/* 6 Core KPI Cards */}
            {kpiError ? <div role="alert" className="p-4 rounded-xl bg-rose-50 text-rose-800">{kpiError} <button onClick={() => setRefreshKey(n => n + 1)} className="underline font-semibold">Thử lại</button></div> : <KpiCardsV1 kpiData={kpiData} previousKpiData={previousKpiData} comparisonLabel={comparisonLabel} loading={kpiLoading} onOpenDetails={basis => { setContractBasis(basis); setActiveTab('contracts_v1'); }} />}

            <div className="flex justify-end mb-3"><button onClick={() => setActiveTab('trend_v1')} className="text-sm font-semibold text-blue-700 hover:underline cursor-pointer">Mở phân tích chi tiết →</button></div>
            {/* Embedded Trend & Pivot (no remount on filter change) */}
            <TrendAndPivotSection compact refreshKey={refreshKey} onDrillDown={drillDown} {...appliedDimensions} fromDate={applied.fromDate} toDate={applied.toDate} datasetId={applied.datasetId || undefined} {...reportView} />
          </div>
        )}

        {activeTab === 'trend_v1' && (
          <TrendAndPivotSection refreshKey={refreshKey} onDrillDown={drillDown} {...appliedDimensions} fromDate={applied.fromDate} toDate={applied.toDate} datasetId={applied.datasetId || undefined} {...reportView} />
        )}

        {activeTab === 'contracts_v1' && (
          <ContractsTableV1 basis={contractBasis} onChangeBasis={setContractBasis} refreshKey={refreshKey} asOfDate={applied.asOfDate} {...appliedDimensions} fromDate={applied.fromDate} toDate={applied.toDate} datasetId={applied.datasetId || undefined} {...reportView} />
        )}

        {activeTab === 'stocks_v1' && (
          <StocksSection refreshKey={refreshKey} fromDate={applied.fromDate} toDate={applied.toDate} datasetId={applied.datasetId || undefined} {...reportView} />
        )}

        {activeTab === 'org_tree_v1' && (
          <OrgTreeSection refreshKey={refreshKey} isAdmin={isAdmin} datasetId={applied.datasetId || undefined} {...reportView} onViewNode={id => {
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

      {/* 4. Import 5 Nguồn Modal & Tạo Bản Chốt Modal */}
      {isAdmin && (
        <>
          <ImportV2Modal
            isOpen={isImportV2Open}
            onClose={() => setIsImportV2Open(false)}
            onSuccess={() => {
              setScopeRevision(n => n + 1);
              setRefreshKey(n => n + 1);
            }}
          />
          <CreateDatasetModal
            isOpen={isCreateDatasetOpen}
            defaultFrom={applied.fromDate}
            defaultTo={applied.toDate}
            defaultAsOf={applied.asOfDate}
            onClose={() => setIsCreateDatasetOpen(false)}
            onCreated={() => {
              apiV1.getDatasets().then(setDatasets).catch(() => {});
            }}
          />
        </>
      )}
    </div>
  );
}
