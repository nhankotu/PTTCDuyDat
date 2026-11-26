import React from 'react';
import {
  Menu,
  Calendar,
  Users,
  SlidersHorizontal,
  RefreshCw,
  Landmark,
  Database,
  Check,
} from 'lucide-react';
import { ActiveTab, ADMIN_NAV_ITEMS, REPORT_NAV_ITEMS } from './Sidebar';
import { DateCoverageResponse, ReportView, ViewScopeNode } from '../types/v1';

interface Props {
  activeTab: ActiveTab;
  isAdmin: boolean;
  isReportingTab: boolean;
  isHome: boolean;
  applied: {
    fromDate: string;
    toDate: string;
    asOfDate: string;
    datasetId: string;
  };
  dateCoverage: DateCoverageResponse | null;
  scopeNodes: ViewScopeNode[];
  reportView: ReportView;
  activeFilterCount: number;
  hasPending: boolean;
  kpiLoading: boolean;
  onOpenMobileMenu: () => void;
  onOpenFilterModal: (tab: 'all' | 'time' | 'scope') => void;
  onApplyFilters: () => void;
  onRefresh: () => void;
}

const fmtShortDate = (iso: string) => {
  const parts = iso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso;
};

const fmtFullDate = (iso: string) => {
  const parts = iso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
};

export const TopContextBar: React.FC<Props> = ({
  activeTab,
  isAdmin,
  isReportingTab,
  isHome,
  applied,
  dateCoverage,
  scopeNodes,
  reportView,
  activeFilterCount,
  hasPending,
  kpiLoading,
  onOpenMobileMenu,
  onOpenFilterModal,
  onApplyFilters,
  onRefresh,
}) => {
  const navMeta = [...REPORT_NAV_ITEMS, ...ADMIN_NAV_ITEMS].find((item) => item.id === activeTab);
  const selectedNode = scopeNodes.find((n) => n.id === reportView.viewEmployeeId);

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200/90 px-4 sm:px-6 min-h-14 py-2 flex flex-wrap items-center justify-between gap-3">
      {/* Left: Mobile drawer button + Active screen title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Mở thanh điều hướng"
          className="lg:hidden p-2 -ml-1 rounded-xl border border-slate-200 bg-white hover:bg-[#EFF6FF] text-slate-700 hover:text-[#1D4ED8] transition-colors cursor-pointer"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0F294A] truncate">
              {navMeta?.label || 'Finra Dashboard'}
            </h1>
            {isReportingTab && !isHome && (
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EFF6FF] border border-[#DBEAFE] text-[11px] font-semibold text-[#1D4ED8] tabular-nums">
                <Landmark size={11} />
                Chốt: {fmtFullDate(applied.asOfDate)}
              </span>
            )}
            {isReportingTab && dateCoverage?.minDate && dateCoverage?.maxDate && (
              <span
                className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600 tabular-nums"
                title={`Dữ liệu hiện có: ${fmtFullDate(dateCoverage.minDate)} → ${fmtFullDate(dateCoverage.maxDate)}`}
              >
                <Database size={11} className="text-slate-400" />
                {dateCoverage.totalContracts.toLocaleString('vi-VN')} HĐ
              </span>
            )}
          </div>
          {navMeta?.description && (
            <p className="hidden sm:block text-[11px] text-slate-500 truncate">
              {navMeta.description}
            </p>
          )}
        </div>
      </div>

      {/* Right: Context Filter Controls (Reporting tabs) or Admin Pill */}
      {isReportingTab ? (
        <div className="flex flex-wrap items-center gap-2 text-xs ml-auto">
          {!isHome && (
            <button
              type="button"
              onClick={() => onOpenFilterModal('time')}
              title={`Khoảng thời gian đang xem: ${applied.fromDate} → ${applied.toDate} (Phím T)`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-[#EFF6FF] border border-slate-200 hover:border-[#BFDBFE] text-slate-700 hover:text-[#1D4ED8] font-semibold transition-colors cursor-pointer tabular-nums"
            >
              <Calendar size={14} className="text-[#1D4ED8]" />
              <span>
                {fmtShortDate(applied.fromDate)} → {fmtShortDate(applied.toDate)}
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 text-slate-500 rounded">
                T
              </kbd>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenFilterModal('scope')}
            title="Phạm vi nhân sự & chi nhánh (Phím S)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-[#EFF6FF] border border-slate-200 hover:border-[#BFDBFE] text-slate-700 hover:text-[#1D4ED8] font-semibold transition-colors cursor-pointer"
          >
            <Users size={14} className="text-[#1D4ED8]" />
            <span className="truncate max-w-[140px] sm:max-w-[210px]">
              {selectedNode
                ? `${selectedNode.label} (${selectedNode.source === 'CONTRACT' ? 'Sale HĐ' : reportView.view === 'subtree' ? 'Cả CN' : 'Cá nhân'})`
                : isAdmin
                ? 'Toàn hệ thống'
                : 'Phạm vi của tôi'}
            </span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 text-slate-500 rounded">
              S
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => onOpenFilterModal('all')}
            title="Mở toàn bộ Bộ lọc & Phạm vi (Phím F)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-blue-100 border border-[#BFDBFE] text-[#1D4ED8] font-semibold transition-colors cursor-pointer"
          >
            <SlidersHorizontal size={14} />
            <span>Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white border border-[#BFDBFE] text-[#1D4ED8] rounded">
              F
            </kbd>
          </button>

          {hasPending && (
            <button
              type="button"
              onClick={onApplyFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Check size={14} />
              <span>Áp dụng</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            title="Làm mới dữ liệu"
            aria-label="Làm mới dữ liệu"
            className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-[#1D4ED8] transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={kpiLoading ? 'animate-spin text-[#1D4ED8]' : ''} />
          </button>
        </div>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EFF6FF] border border-[#DBEAFE] text-xs font-semibold text-[#1D4ED8]">
          Quản trị hệ thống
        </span>
      )}
    </header>
  );
};
