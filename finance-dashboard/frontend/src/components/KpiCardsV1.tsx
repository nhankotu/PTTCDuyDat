import React from 'react';
import { KpiReportResponse } from '../types/v1';

interface Props {
  kpiData: KpiReportResponse | null;
  loading: boolean;
  onOpenDetails?: (basis: 'sales' | 'balance') => void;
}

export const KpiCardsV1: React.FC<Props> = ({ kpiData, loading, onOpenDetails }) => {
  const formatMoney = (valStr: string | null | undefined, hasAccess: boolean): string => {
    if (!hasAccess) return 'Không có quyền';
    if (!valStr) return 'Chưa đủ dữ liệu';
    const num = parseFloat(valStr);
    if (isNaN(num)) return '0 đ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatCount = (count: number | null | undefined, hasAccess: boolean): string => {
    if (!hasAccess) return 'Không có quyền';
    if (count === null || count === undefined) return 'Chưa đủ dữ liệu';
    return count.toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3 gap-4 mb-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs animate-pulse space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-3.5 bg-slate-200 rounded w-1/2"></div>
              <div className="h-7 w-7 bg-slate-200 rounded-lg"></div>
            </div>
            <div className="h-7 bg-slate-200 rounded w-4/5"></div>
            <div className="h-3 bg-slate-100 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  const metrics = kpiData?.metrics;
  const access = kpiData?.access ?? { revenue: true, balance: true, scopesDiffer: false };

  const cards = [
    {
      id: 1,
      title: '1. Doanh số trong kỳ',
      subtitle: 'Phát sinh theo ngày ký',
      value: formatMoney(metrics?.totalSales, access.revenue),
      raw: metrics?.totalSales,
      hasAccess: access.revenue,
      icon: '💰',
      theme: {
        border: 'border-blue-200/80 hover:border-blue-400',
        topStripe: 'from-blue-500 to-indigo-600',
        badgeBg: 'bg-blue-50 text-blue-700 border-blue-100',
        iconBg: 'bg-blue-100/70 text-blue-700',
        valueColor: 'text-slate-900',
        glow: 'hover:shadow-blue-500/10',
      },
    },
    {
      id: 2,
      title: '2. Số dư nguồn vốn',
      subtitle: 'Gốc − Đã tất toán tại T',
      value: formatMoney(metrics?.totalBalance, access.balance),
      raw: metrics?.totalBalance,
      hasAccess: access.balance,
      icon: '🏦',
      theme: {
        border: 'border-emerald-200/80 hover:border-emerald-400',
        topStripe: 'from-emerald-500 to-teal-600',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        iconBg: 'bg-emerald-100/70 text-emerald-700',
        valueColor: 'text-emerald-950',
        glow: 'hover:shadow-emerald-500/10',
      },
    },
    {
      id: 3,
      title: '3. Số khách hàng',
      subtitle: 'Khách hàng phát sinh kỳ',
      value: formatCount(metrics?.totalCustomers, access.revenue),
      raw: metrics?.totalCustomers?.toString(),
      hasAccess: access.revenue,
      icon: '👥',
      theme: {
        border: 'border-purple-200/80 hover:border-purple-400',
        topStripe: 'from-purple-500 to-indigo-600',
        badgeBg: 'bg-purple-50 text-purple-700 border-purple-100',
        iconBg: 'bg-purple-100/70 text-purple-700',
        valueColor: 'text-purple-950',
        glow: 'hover:shadow-purple-500/10',
      },
    },
    {
      id: 4,
      title: '4. Số lượng HĐ',
      subtitle: 'Hợp đồng ký trong kỳ',
      value: formatCount(metrics?.totalContracts, access.revenue),
      raw: metrics?.totalContracts?.toString(),
      hasAccess: access.revenue,
      icon: '📄',
      theme: {
        border: 'border-amber-200/80 hover:border-amber-400',
        topStripe: 'from-amber-500 to-orange-500',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-100',
        iconBg: 'bg-amber-100/70 text-amber-700',
        valueColor: 'text-amber-950',
        glow: 'hover:shadow-amber-500/10',
      },
    },
    {
      id: 5,
      title: '5. Quy mô TB / HĐ',
      subtitle: 'Doanh số / Số HĐ',
      value: formatMoney(metrics?.avgSizePerContract, access.revenue),
      raw: metrics?.avgSizePerContract,
      hasAccess: access.revenue,
      icon: '📊',
      theme: {
        border: 'border-cyan-200/80 hover:border-cyan-400',
        topStripe: 'from-cyan-500 to-blue-500',
        badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-100',
        iconBg: 'bg-cyan-100/70 text-cyan-700',
        valueColor: 'text-slate-900',
        glow: 'hover:shadow-cyan-500/10',
      },
    },
    {
      id: 6,
      title: '6. Quy mô TB / KH',
      subtitle: 'Doanh số / Số KH',
      value: formatMoney(metrics?.avgSizePerCustomer, access.revenue),
      raw: metrics?.avgSizePerCustomer,
      hasAccess: access.revenue,
      icon: '🎯',
      theme: {
        border: 'border-rose-200/80 hover:border-rose-400',
        topStripe: 'from-rose-500 to-pink-600',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-100',
        iconBg: 'bg-rose-100/70 text-rose-700',
        valueColor: 'text-slate-900',
        glow: 'hover:shadow-rose-500/10',
      },
    },
  ];

  return (
    <div className="mb-6 space-y-3">
      {access.scopesDiffer && (
        <div className="bg-amber-50/90 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <span className="text-base">⚠️</span>
            <span className="font-medium">
              <strong>Phạm vi chỉ tiêu:</strong> Phạm vi xem Doanh số và Số dư của bạn đang khác nhau do quyền ngang hàng được cấp riêng biệt.
            </span>
          </div>
          <span className="text-[11px] bg-amber-200/80 border border-amber-300/80 px-2.5 py-0.5 rounded-md font-bold tracking-wide">
            KHÁC PHẠM VI
          </span>
        </div>
      )}

      {kpiData?.dataStatus === 'UNAVAILABLE' && (
        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs text-rose-800 flex items-center space-x-2 shadow-xs">
          <span className="text-base">🚫</span>
          <span>Tài khoản chưa được gán mã nhân sự hợp lệ hoặc không có quyền truy cập dữ liệu trong kỳ báo cáo này.</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3 gap-3.5">
        {cards.map((c) => (
          <div
            key={c.id}
            role={onOpenDetails && c.hasAccess ? 'button' : undefined}
            tabIndex={onOpenDetails && c.hasAccess ? 0 : undefined}
            onClick={() => { if (c.hasAccess) onOpenDetails?.(c.id === 2 ? 'balance' : 'sales'); }}
            onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && c.hasAccess) { e.preventDefault(); onOpenDetails?.(c.id === 2 ? 'balance' : 'sales'); } }}
            className={`group relative bg-white rounded-2xl border ${c.theme.border} p-4 shadow-xs hover:shadow-lg transition-all duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer flex flex-col justify-between overflow-hidden`}
          >
            {/* Top gradient stripe */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${c.theme.topStripe}`} />

            <div>
              {/* Header inside card */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-slate-600">
                  {c.title}
                </span>
                <span className={`w-7 h-7 rounded-lg ${c.theme.iconBg} flex items-center justify-center text-xs shrink-0 shadow-xs`}>
                  {c.icon}
                </span>
              </div>

              {/* Main value */}
              <div
                className={`text-xl xl:text-[22px] font-black ${c.theme.valueColor} tracking-tight truncate leading-tight my-1`}
                title={c.raw ?? c.value}
              >
                {!c.hasAccess ? (
                  <span className="text-xs font-semibold text-rose-500 bg-rose-50 px-2 py-1 rounded-md border border-rose-200">
                    🔒 Không có quyền
                  </span>
                ) : (
                  c.value
                )}
              </div>
            </div>

            {/* Subtitle / Formula helper */}
            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>{c.subtitle}{onOpenDetails && c.hasAccess && <span className="block text-blue-700 font-medium mt-1">Xem hợp đồng →</span>}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
