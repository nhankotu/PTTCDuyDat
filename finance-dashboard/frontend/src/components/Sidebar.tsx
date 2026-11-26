import React from 'react';
import {
  Home,
  BarChart3,
  TrendingUp,
  FileText,
  Landmark,
  GitFork,
  Users,
  ShieldCheck,
  Upload,
  HelpCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { AuthSession } from '../types';

export type ActiveTab =
  | 'home_v1'
  | 'kpi_v1'
  | 'trend_v1'
  | 'contracts_v1'
  | 'stocks_v1'
  | 'org_tree_v1'
  | 'users'
  | 'permissions';

interface NavItem {
  id: ActiveTab;
  label: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

export const REPORT_NAV_ITEMS: NavItem[] = [
  { id: 'home_v1', label: 'Trang chủ', description: 'Chỉ số hôm nay & tháng hiện tại', Icon: Home },
  { id: 'kpi_v1', label: 'Tổng quan KPI', description: '7 chỉ số tài chính cốt lõi', Icon: BarChart3 },
  { id: 'trend_v1', label: 'Xu hướng & Cơ cấu', description: 'Biểu đồ & bảng pivot đa chiều', Icon: TrendingUp },
  { id: 'contracts_v1', label: 'Tra cứu hợp đồng', description: 'Danh sách hợp đồng & xuất dữ liệu', Icon: FileText },
  { id: 'stocks_v1', label: 'Chứng khoán', description: 'Hợp đồng chứng khoán độc lập', Icon: Landmark },
  { id: 'org_tree_v1', label: 'Cây nhân sự', description: 'Sơ đồ phân cấp nhân sự', Icon: GitFork },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'users', label: 'Người dùng', description: 'Quản lý tài khoản hệ thống', Icon: Users },
  { id: 'permissions', label: 'Phân quyền Scope', description: 'Thiết lập phạm vi dữ liệu', Icon: ShieldCheck },
];

interface Props {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isAdmin: boolean;
  currentUser: AuthSession;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenImport: () => void;
  onOpenHelp: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  isAdmin,
  currentUser,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onOpenImport,
  onOpenHelp,
  onLogout,
}) => {
  const userInitials = (currentUser.fullName || currentUser.username || 'AD')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const renderNavButton = (item: NavItem, compact: boolean) => {
    const isActive = activeTab === item.id;
    const Icon = item.Icon;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          onSelectTab(item.id);
          onCloseMobile();
        }}
        title={compact ? `${item.label} — ${item.description}` : item.description}
        aria-current={isActive ? 'page' : undefined}
        className={`group relative w-full flex items-center ${
          compact ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
        } rounded-xl text-[13px] transition-colors duration-150 cursor-pointer ${
          isActive
            ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold'
            : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-[#0F294A]'
        }`}
      >
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#1D4ED8]"
          />
        )}
        <Icon
          size={18}
          strokeWidth={isActive ? 2.1 : 1.75}
          className={`shrink-0 transition-colors ${
            isActive ? 'text-[#1D4ED8]' : 'text-slate-400 group-hover:text-[#1D4ED8]'
          }`}
        />
        {!compact && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  const renderSidebarBody = (compact: boolean, isMobileDrawer: boolean) => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/90 select-none">
      {/* Brand Header */}
      <div
        className={`h-14 flex items-center ${
          compact ? 'justify-center px-2' : 'justify-between px-4'
        } border-b border-slate-200/80 shrink-0`}
      >
        <div
          onClick={() => {
            onSelectTab('home_v1');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-[#1D4ED8] text-white flex items-center justify-center font-extrabold text-base shadow-xs shrink-0">
            F
          </div>
          {!compact && (
            <div className="min-w-0">
              <div className="text-base font-extrabold tracking-tight text-[#0F294A] leading-none">
                Finra
              </div>
              <div className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                Báo cáo kinh doanh
              </div>
            </div>
          )}
        </div>

        {isMobileDrawer ? (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Đóng thanh điều hướng"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0F294A] cursor-pointer"
          >
            <X size={18} />
          </button>
        ) : (
          !compact && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Thu gọn thanh điều hướng"
              aria-label="Thu gọn thanh điều hướng"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-[#1D4ED8] transition-colors cursor-pointer"
            >
              <PanelLeftClose size={17} />
            </button>
          )
        )}
      </div>

      {/* Expand button when collapsed */}
      {!isMobileDrawer && compact && (
        <div className="px-2 pt-3 pb-1 flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Mở rộng thanh điều hướng"
            aria-label="Mở rộng thanh điều hướng"
            className="w-full flex items-center justify-center py-2 rounded-xl text-slate-400 hover:bg-[#EFF6FF] hover:text-[#1D4ED8] transition-colors cursor-pointer"
          >
            <PanelLeftOpen size={18} />
          </button>
        </div>
      )}

      {/* Navigation Sections */}
      <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div className="space-y-1">
          {!compact && (
            <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Báo cáo &amp; Phân tích
            </div>
          )}
          {REPORT_NAV_ITEMS.map((item) => renderNavButton(item, compact))}
        </div>

        {isAdmin && (
          <div className="space-y-1.5 pt-4 border-t border-slate-100">
            {!compact && (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Quản trị hệ thống
              </div>
            )}
            {ADMIN_NAV_ITEMS.map((item) => renderNavButton(item, compact))}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onOpenImport();
                  onCloseMobile();
                }}
                title="Nạp dữ liệu Excel 6 nguồn"
                className={`w-full flex items-center ${
                  compact ? 'justify-center px-2 py-2.5' : 'justify-center gap-2 px-3 py-2.5'
                } rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-[13px] font-semibold shadow-xs transition-colors cursor-pointer`}
              >
                <Upload size={16} strokeWidth={2} className="shrink-0" />
                {!compact && <span>Import Dữ liệu</span>}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Footer: User & Utilities */}
      <div className="border-t border-slate-200/80 p-3 space-y-2 bg-slate-50/60 shrink-0">
        {!compact ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-white border border-slate-200/80">
            <div className="w-8 h-8 rounded-full bg-[#EFF6FF] border border-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center font-bold text-xs shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[#0F294A] truncate">
                {currentUser.fullName || currentUser.username}
              </div>
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {isAdmin ? 'Quản trị viên' : currentUser.scopeNodeName || currentUser.branchAccess || 'Nhân sự'}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="w-9 h-9 mx-auto rounded-full bg-[#EFF6FF] border border-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center font-bold text-xs"
            title={`${currentUser.fullName || currentUser.username} · ${isAdmin ? 'Quản trị viên' : currentUser.branchAccess || 'Nhân sự'}`}
          >
            {userInitials}
          </div>
        )}

        <div className={`flex ${compact ? 'flex-col gap-1' : 'items-center gap-1.5'}`}>
          <button
            type="button"
            onClick={() => {
              onOpenHelp();
              onCloseMobile();
            }}
            title="Hướng dẫn sử dụng & Phím tắt (Phím H)"
            className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-[#EFF6FF] hover:border-[#DBEAFE] text-slate-600 hover:text-[#1D4ED8] text-xs font-semibold transition-colors cursor-pointer`}
          >
            <HelpCircle size={15} strokeWidth={1.85} />
            {!compact && <span>Hướng dẫn</span>}
          </button>

          <button
            type="button"
            onClick={onLogout}
            title="Đăng xuất khỏi hệ thống"
            aria-label="Đăng xuất"
            className={`flex items-center justify-center gap-1.5 ${
              compact ? 'w-full py-2' : 'px-2.5 py-2'
            } rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-700 text-xs font-semibold transition-colors cursor-pointer`}
          >
            <LogOut size={15} strokeWidth={1.85} />
            {!compact && <span>Thoát</span>}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen z-30 transition-[width] duration-200 ${
          collapsed ? 'w-[72px]' : 'w-[252px]'
        }`}
      >
        {renderSidebarBody(collapsed, false)}
      </aside>

      {/* Mobile / Tablet Slide-over Drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu điều hướng"
        >
          <div
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-[264px] max-w-[85vw] h-full shadow-2xl">
            {renderSidebarBody(false, true)}
          </aside>
        </div>
      )}
    </>
  );
};
