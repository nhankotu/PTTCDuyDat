import { useState, useMemo, useEffect } from 'react';
import { Users, SlidersHorizontal, ChevronDown, ChevronUp, CornerUpLeft, Search, Filter } from 'lucide-react';
import { ViewScopeNode, ReportView, DimensionFilters } from '../types/v1';
import { ReportFilterPanel } from './ReportFilterPanel';
import { SavedReportViews, SavedReportValue } from './SavedReportViews';

interface Props {
  // Scope props
  nodes: ViewScopeNode[];
  value: ReportView;
  onChange: (value: ReportView) => void;
  loading: boolean;
  error: string | null;
  defaultLabel: string;
  onRetry: () => void;

  // Dimensions filter props
  showDimensions?: boolean;
  dimensions: DimensionFilters;
  appliedDimensions: DimensionFilters;
  onChangeDimensions: (value: DimensionFilters) => void;
  datasetId?: string;
  toDate: string;

  // Saved report views props
  showSavedViews?: boolean;
  username: string;
  savedReportValue: SavedReportValue;
  onLoadSavedView: (value: SavedReportValue) => void;
  embedded?: boolean;
}

export function UnifiedFilterScopePanel({
  nodes,
  value,
  onChange,
  loading,
  error,
  defaultLabel,
  onRetry,
  showDimensions = true,
  dimensions,
  appliedDimensions,
  onChangeDimensions,
  datasetId,
  toDate,
  showSavedViews = true,
  username,
  savedReportValue,
  onLoadSavedView,
  embedded = false
}: Props) {
  // Collapsible state with localStorage persistence
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('finra_filter_panel_expanded');
      return saved !== null ? saved === 'true' : false; // Default collapsed for clean view
    } catch {
      return false;
    }
  });

  const toggleExpanded = () => {
    setIsExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem('finra_filter_panel_expanded', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'HR' | 'CONTRACT'>('ALL');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const selected = nodes.find(n => n.id === value.viewEmployeeId);

  const path = useMemo(() => {
    const result: string[] = [];
    const seen = new Set<string>();
    let node = selected;
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      result.unshift(node.label);
      node = nodes.find(n => n.id === node!.parentId);
    }
    return result.join(' › ');
  }, [nodes, selected]);

  const normalize = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

  const ordered = useMemo(() => {
    const result: Array<ViewScopeNode & { depth: number }> = [];
    const seen = new Set<string>();
    const visit = (node: ViewScopeNode, depth: number) => {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      result.push({ ...node, depth });
      nodes.filter(child => child.parentId === node.id).forEach(child => visit(child, depth + 1));
    };
    nodes.filter(node => !node.parentId).forEach(node => visit(node, 0));
    nodes.forEach(node => visit(node, 0));
    return result;
  }, [nodes]);

  const hrCount = useMemo(() => ordered.filter(n => n.source !== 'CONTRACT').length, [ordered]);
  const contractCount = useMemo(() => ordered.filter(n => n.source === 'CONTRACT').length, [ordered]);

  const sourceScopedNodes = useMemo(() => ordered.filter(n => {
    const nodeSource = n.source === 'CONTRACT' ? 'CONTRACT' : 'HR';
    return sourceFilter === 'ALL' || nodeSource === sourceFilter;
  }), [ordered, sourceFilter]);

  const positionOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of sourceScopedNodes) {
      const pos = (n.position || '').trim();
      if (pos) counts.set(pos, (counts.get(pos) ?? 0) + 1);
    }
    const rank = (p: string) => {
      const u = p.toUpperCase();
      if (u.includes('GĐCN') || u.includes('GDCN')) return 0;
      if (u.includes('TPKD')) return 1;
      if (u.includes('CVKD')) return 2;
      if (u.includes('SALE HĐ')) return 3;
      return 4;
    };
    return Array.from(counts.entries()).sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'vi'));
  }, [sourceScopedNodes]);

  const branchOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of sourceScopedNodes) {
      const br = (n.branch || '').trim();
      if (br) counts.set(br, (counts.get(br) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [sourceScopedNodes]);

  useEffect(() => {
    if (positionFilter !== 'ALL' && !positionOptions.some(([pos]) => pos === positionFilter)) {
      setPositionFilter('ALL');
    }
  }, [positionFilter, positionOptions]);

  useEffect(() => {
    if (branchFilter !== 'ALL' && !branchOptions.some(([br]) => br === branchFilter)) {
      setBranchFilter('ALL');
    }
  }, [branchFilter, branchOptions]);

  const matches = sourceScopedNodes.filter(n => {
    if (positionFilter !== 'ALL' && (n.position || '').trim() !== positionFilter) return false;
    if (branchFilter !== 'ALL' && (n.branch || '').trim() !== branchFilter) return false;
    return normalize(`${n.id} ${n.label} ${n.position} ${n.branch || ''} ${n.department || ''}`).includes(normalize(search));
  });
  const hrMatches = matches.filter(n => n.source !== 'CONTRACT');
  const contractMatches = matches.filter(n => n.source === 'CONTRACT');

  const activeFilterCount = useMemo(() => {
    return Object.values(appliedDimensions).reduce((sum, list) => sum + list.length, 0);
  }, [appliedDimensions]);

  const showBody = embedded || isExpanded;

  return (
    <section aria-label="Phạm vi và bộ lọc báo cáo" className={embedded ? 'space-y-5' : 'bg-white border border-slate-200 rounded-2xl shadow-sm transition-all duration-200 overflow-hidden'}>
      {/* 1. Header Bar: Always visible when not embedded */}
      {!embedded && (
      <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/40">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm sm:text-base">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Filter size={16} />
            </div>
            <span>Phạm vi & Bộ lọc</span>
          </div>

          {/* Scope Badge */}
          {selected ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-900 border border-blue-200 max-w-[280px] sm:max-w-[420px] truncate"
              title={path || selected.label}
            >
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
              <span className="truncate">
                Đang xem: <strong>{selected.label}</strong> ({selected.source === 'CONTRACT' ? 'Sale HĐ · Chỉ cá nhân' : value.view === 'subtree' ? 'Cây nhân sự · Cả cấp dưới/CN' : 'Cây nhân sự · Chỉ cá nhân'})
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 max-w-[260px] truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              <span className="truncate">{defaultLabel}</span>
            </span>
          )}

          {/* Quick toggle between Branch/Subtree vs Personal when HR node has hierarchy */}
          {selected && selected.canViewSubtree && (
            <button
              type="button"
              onClick={() => onChange({ ...value, view: value.view === 'subtree' ? 'self' : 'subtree' })}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
              title="Chuyển nhanh giữa Doanh số chi nhánh/cấp dưới và Doanh số cá nhân"
            >
              <span>{value.view === 'subtree' ? 'Đang xem: Cả CN/cấp dưới ⇄ Cá nhân' : 'Đang xem: Cá nhân ⇄ Cả CN/cấp dưới'}</span>
            </button>
          )}

          {/* Dimension Filter Badge */}
          {showDimensions && activeFilterCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
              <SlidersHorizontal size={12} />
              <span>{activeFilterCount} điều kiện lọc</span>
            </span>
          )}
        </div>

        {/* Right action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {value.viewEmployeeId && (
            <button
              type="button"
              onClick={() => onChange({ view: 'subtree' })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <CornerUpLeft size={14} />
              <span>Về phạm vi của tôi</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleExpanded}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Thu gọn' : 'Tùy chỉnh phạm vi & bộ lọc'}</span>
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>
      )}

      {/* 2. Collapsible Expanded Body */}
      {showBody && (
        <div className={embedded ? 'space-y-5 bg-white' : 'border-t border-slate-200 p-4 sm:p-5 space-y-5 bg-white'}>
          {/* Section A: Phạm vi nhân sự / đơn vị */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-900">
                <Users size={18} className="text-blue-600" />
                <h3 className="font-bold text-sm sm:text-base">1. Phạm vi đang xem</h3>
              </div>

              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Phân loại nguồn nhân sự">
                <button
                  type="button"
                  onClick={() => setSourceFilter('ALL')}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    sourceFilter === 'ALL'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Tất cả ({ordered.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSourceFilter('HR')}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    sourceFilter === 'HR'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-blue-50/60 text-blue-700 border-blue-200 hover:bg-blue-100/70'
                  }`}
                >
                  Cây nhân sự ({hrCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSourceFilter('CONTRACT')}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    sourceFilter === 'CONTRACT'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50/60 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
                  }`}
                >
                  Sale HĐ ({contractCount})
                </button>
              </div>
            </div>

            {(positionOptions.length > 1 || branchOptions.length > 0 || search.trim() !== '' || sourceFilter !== 'ALL') && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 border border-slate-200/80 rounded-xl px-3 py-2">
                <div className="flex flex-wrap items-center gap-3">
                  {positionOptions.length > 1 && (
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Chức vụ:</span>
                      <select
                        aria-label="Lọc theo chức vụ"
                        value={positionFilter}
                        onChange={e => setPositionFilter(e.target.value)}
                        className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ALL">Tất cả chức vụ ({sourceScopedNodes.length})</option>
                        {positionOptions.map(([pos, count]) => (
                          <option key={pos} value={pos}>{pos} ({count})</option>
                        ))}
                      </select>
                    </label>
                  )}

                  {branchOptions.length > 0 && (
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Chi nhánh:</span>
                      <select
                        aria-label="Lọc theo chi nhánh"
                        value={branchFilter}
                        onChange={e => setBranchFilter(e.target.value)}
                        className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ALL">Tất cả chi nhánh</option>
                        {branchOptions.map(([br, count]) => (
                          <option key={br} value={br}>{br} ({count})</option>
                        ))}
                      </select>
                    </label>
                  )}

                  <span className="text-xs text-slate-500">
                    Khớp <strong>{matches.length}</strong> / {ordered.length} nhân sự
                  </span>
                </div>

                {(search.trim() !== '' || sourceFilter !== 'ALL' || positionFilter !== 'ALL' || branchFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSourceFilter('ALL');
                      setPositionFilter('ALL');
                      setBranchFilter('ALL');
                    }}
                    className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Đặt lại lọc nhân sự
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-[1fr_2fr_1fr]">
              <label className="text-xs sm:text-sm text-slate-600">
                Tìm nhân sự / đơn vị
                <div className="relative mt-1">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Tên, mã, chức danh…"
                    className="w-full border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </label>

              <label className="text-xs sm:text-sm text-slate-600">
                Xem dữ liệu của
                <select
                  aria-label="Xem dữ liệu của"
                  disabled={loading || !!error}
                  value={value.viewEmployeeId || ''}
                  onChange={e => {
                    const node = nodes.find(n => n.id === e.target.value);
                    onChange({
                      viewEmployeeId: e.target.value || undefined,
                      view: node && !node.canViewSubtree ? 'self' : 'subtree'
                    });
                  }}
                  className="mt-1 w-full border border-slate-300 rounded-lg p-2 text-sm text-slate-900 min-h-10 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{loading ? 'Đang tải phạm vi được cấp…' : defaultLabel}</option>
                  {selected && !matches.some(n => n.id === selected.id) && (
                    <option value={selected.id}>
                      {selected.label} [{selected.position}]
                    </option>
                  )}
                  {hrMatches.length > 0 && (
                    <optgroup label="── Cây nhân sự (Có cấp bậc / Chi nhánh) ──">
                      {hrMatches.map(n => (
                        <option key={n.id} value={n.id}>
                          {'　'.repeat(n.depth)}
                          {n.depth > 0 ? '↳ ' : ''}
                          {n.label} [{n.position}] · {n.department || n.branch || n.id}
                          {!n.canViewSubtree ? ' · Chỉ cá nhân' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {contractMatches.length > 0 && (
                    <optgroup label="── Sale gắn với hợp đồng (Tự nhận diện · Chỉ cá nhân) ──">
                      {contractMatches.map(n => (
                        <option key={n.id} value={n.id}>
                          {n.label} [Sale HĐ] · Mã: {n.id} · Chỉ cá nhân
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>

              <label className="text-xs sm:text-sm text-slate-600">
                Phạm vi thống kê
                <select
                  aria-label="Phạm vi thống kê"
                  value={value.view}
                  disabled={!selected || !selected.canViewSubtree || !!error}
                  onChange={e => onChange({ ...value, view: e.target.value as ReportView['view'] })}
                  className="mt-1 w-full border border-slate-300 rounded-lg p-2 text-sm text-slate-900 min-h-10 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="subtree">Doanh số chi nhánh / cấp dưới</option>
                  <option value="self">Doanh số cá nhân</option>
                </select>
              </label>
            </div>

            {error ? (
              <div role="alert" className="text-sm text-rose-700">
                {error} <button onClick={onRetry} className="font-semibold underline">Thử lại</button>
              </div>
            ) : (
              <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-xs sm:text-sm text-blue-900">
                <strong>Đang xem: </strong>
                {path || defaultLabel}
                {selected ? ` — ${selected.source === 'CONTRACT' ? 'Sale gắn với hợp đồng (chỉ doanh số & số dư cá nhân)' : value.view === 'subtree' ? 'Cây nhân sự (gồm cả chi nhánh / cấp dưới)' : 'Cây nhân sự (chỉ cá nhân)'}` : ''}
              </p>
            )}

            {!loading && matches.length === 1 && matches[0].id !== value.viewEmployeeId && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange({
                    viewEmployeeId: matches[0].id,
                    view: matches[0].canViewSubtree ? 'subtree' : 'self'
                  })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span>Chọn nhanh kết quả duy nhất:</span>
                  <strong>{matches[0].label}</strong>
                  <span>[{matches[0].source === 'CONTRACT' ? 'Sale HĐ' : matches[0].position}]</span>
                </button>
              </div>
            )}

            {!loading && (search || positionFilter !== 'ALL' || branchFilter !== 'ALL' || sourceFilter !== 'ALL') && matches.length === 0 && (
              <p className="text-xs text-slate-500">Không có nhân sự phù hợp trong phạm vi được cấp.</p>
            )}
          </div>

          {/* Section B: Bộ lọc đa lựa chọn (nếu được bật cho tab hiện tại) */}
          {showDimensions && (
            <div className="pt-2 border-t border-slate-100">
              <ReportFilterPanel
                embedded
                value={dimensions}
                onChange={onChangeDimensions}
                context={{ ...value, datasetId: datasetId || undefined, toDate }}
              />
            </div>
          )}

          {/* Section C: Bộ lọc cá nhân đã lưu */}
          {showSavedViews && (
            <div className="pt-2 border-t border-slate-100">
              <SavedReportViews
                embedded
                username={username}
                value={savedReportValue}
                onLoad={onLoadSavedView}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
