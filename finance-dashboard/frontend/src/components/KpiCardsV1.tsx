import React from 'react';
import {
  BadgeDollarSign, Landmark, UserPlus, Users, FileText, BarChart3, Target, ArrowUpRight, Lock
} from 'lucide-react';
import { KpiReportResponse } from '../types/v1';

interface Props {
  kpiData: KpiReportResponse | null;
  loading: boolean;
  excludeSafeNewCust?: boolean;
  earlyLiquidationMaxDays?: number;
  onOpenDetails?: (basis: 'sales' | 'balance') => void;
}

export const KpiCardsV1: React.FC<Props> = ({
  kpiData,
  loading,
  excludeSafeNewCust,
  earlyLiquidationMaxDays = 5,
  onOpenDetails,
}) => {
  const formatMoney = (valStr: string | null | undefined, hasAccess: boolean): string => {
    if (!hasAccess) return 'Không có quyền';
    if (!valStr) return '—';
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
    if (count === null || count === undefined) return '—';
    return count.toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs animate-pulse flex items-center justify-between gap-3"
          >
            <div className="space-y-2.5 flex-1">
              <div className="h-3.5 bg-slate-200 rounded w-1/2" />
              <div className="h-7 bg-slate-200 rounded w-4/5" />
            </div>
            <div className="h-11 w-11 bg-slate-200 rounded-xl shrink-0" />
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
      tooltip: earlyLiquidationMaxDays > 0
        ? `Tổng giá trị HĐ phát sinh theo ngày ký (đã loại HĐ thanh lý sớm <= ${earlyLiquidationMaxDays} ngày). Bấm để xem chi tiết.`
        : 'Tổng giá trị HĐ phát sinh theo ngày ký. Bấm để xem chi tiết.',
      value: formatMoney(metrics?.totalSales, access.revenue),
      raw: metrics?.totalSales,
      pill: earlyLiquidationMaxDays > 0 ? `Loại <= ${earlyLiquidationMaxDays}d` : null,
      hasAccess: access.revenue,
      Icon: BadgeDollarSign,
      theme: {
        border: 'border-blue-200/80 hover:border-blue-400',
        topStripe: 'from-blue-500 to-indigo-600',
        pill: 'bg-blue-50 text-blue-700 border-blue-200',
        iconBg: 'bg-blue-100/80 text-blue-700',
        valueColor: 'text-slate-900',
      },
    },
    {
      id: 2,
      title: '2. Số dư nguồn vốn',
      tooltip: 'Tổng dư nợ gốc còn lại tại ngày chốt T (Gốc − Đã tất toán). Bấm để xem chi tiết.',
      value: formatMoney(metrics?.totalBalance, access.balance),
      raw: metrics?.totalBalance,
      pill: null,
      hasAccess: access.balance,
      Icon: Landmark,
      theme: {
        border: 'border-emerald-200/80 hover:border-emerald-400',
        topStripe: 'from-emerald-500 to-teal-600',
        pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconBg: 'bg-emerald-100/80 text-emerald-700',
        valueColor: 'text-emerald-950',
      },
    },
    {
      id: 3,
      title: excludeSafeNewCust ? '3. KH mới (Chuẩn)' : '3. Số khách hàng',
      tooltip: excludeSafeNewCust
        ? 'Khách hàng mới ngoài sản phẩm Safe, giá trị >= 1Tr lần đầu trong kỳ.'
        : 'Khách hàng phát sinh hợp đồng trong kỳ.',
      value: formatCount(excludeSafeNewCust ? (metrics?.newCustomers ?? metrics?.totalCustomers) : metrics?.totalCustomers, access.revenue),
      raw: (excludeSafeNewCust ? (metrics?.newCustomers ?? metrics?.totalCustomers) : metrics?.totalCustomers)?.toString(),
      pill: !excludeSafeNewCust && metrics?.newCustomers != null
        ? `Mới: ${metrics.newCustomers.toLocaleString('vi-VN')}`
        : excludeSafeNewCust && metrics?.totalCustomers != null
        ? `Tổng kỳ: ${metrics.totalCustomers.toLocaleString('vi-VN')}`
        : null,
      hasAccess: access.revenue,
      Icon: UserPlus,
      theme: {
        border: 'border-purple-200/80 hover:border-purple-400',
        topStripe: 'from-purple-500 to-indigo-600',
        pill: 'bg-purple-50 text-purple-700 border-purple-200',
        iconBg: 'bg-purple-100/80 text-purple-700',
        valueColor: 'text-purple-950',
      },
    },
    {
      id: 4,
      title: '4. Tổng KH lũy kế',
      tooltip: 'Tổng số khách hàng còn số dư > 0 tại ngày chốt T.',
      value: formatCount(metrics?.cumulativeCustomers, access.balance),
      raw: metrics?.cumulativeCustomers?.toString(),
      pill: null,
      hasAccess: access.balance,
      Icon: Users,
      theme: {
        border: 'border-teal-200/80 hover:border-teal-400',
        topStripe: 'from-teal-500 to-emerald-600',
        pill: 'bg-teal-50 text-teal-700 border-teal-200',
        iconBg: 'bg-teal-100/80 text-teal-700',
        valueColor: 'text-teal-950',
      },
    },
    {
      id: 5,
      title: '5. Số lượng HĐ',
      tooltip: 'Tổng số hợp đồng tính doanh số ký trong kỳ.',
      value: formatCount(metrics?.totalContracts, access.revenue),
      raw: metrics?.totalContracts?.toString(),
      pill: null,
      hasAccess: access.revenue,
      Icon: FileText,
      theme: {
        border: 'border-amber-200/80 hover:border-amber-400',
        topStripe: 'from-amber-500 to-orange-500',
        pill: 'bg-amber-50 text-amber-800 border-amber-200',
        iconBg: 'bg-amber-100/80 text-amber-700',
        valueColor: 'text-amber-950',
      },
    },
    {
      id: 6,
      title: '6. Quy mô TB / HĐ',
      tooltip: 'Doanh số trong kỳ / Số lượng HĐ.',
      value: formatMoney(metrics?.avgSizePerContract, access.revenue),
      raw: metrics?.avgSizePerContract,
      pill: null,
      hasAccess: access.revenue,
      Icon: BarChart3,
      theme: {
        border: 'border-cyan-200/80 hover:border-cyan-400',
        topStripe: 'from-cyan-500 to-blue-500',
        pill: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        iconBg: 'bg-cyan-100/80 text-cyan-700',
        valueColor: 'text-slate-900',
      },
    },
    {
      id: 7,
      title: '7. Quy mô TB / KH',
      tooltip: 'Doanh số trong kỳ / Số khách hàng.',
      value: formatMoney(metrics?.avgSizePerCustomer, access.revenue),
      raw: metrics?.avgSizePerCustomer,
      pill: null,
      hasAccess: access.revenue,
      Icon: Target,
      theme: {
        border: 'border-rose-200/80 hover:border-rose-400',
        topStripe: 'from-rose-500 to-pink-600',
        pill: 'bg-rose-50 text-rose-700 border-rose-200',
        iconBg: 'bg-rose-100/80 text-rose-700',
        valueColor: 'text-slate-900',
      },
    },
  ];

  return (
    <div className="mb-5 space-y-3">
      {access.scopesDiffer && (
        <div className="bg-amber-50/90 border border-amber-200 px-3.5 py-2.5 rounded-xl text-xs text-amber-900 flex items-center justify-between shadow-xs">
          <span className="font-medium">
            <strong>Khác phạm vi:</strong> Phạm vi Doanh số và Số dư khác nhau theo quyền ngang hàng.
          </span>
          <span className="text-[11px] bg-amber-200/80 px-2 py-0.5 rounded-md font-bold shrink-0">
            KHÁC PHẠM VI
          </span>
        </div>
      )}

      {kpiData?.dataStatus === 'UNAVAILABLE' && (
        <div className="bg-rose-50 border border-rose-200 px-3.5 py-2.5 rounded-xl text-xs text-rose-800 font-medium shadow-xs">
          Tài khoản chưa được cấp quyền truy cập dữ liệu trong kỳ báo cáo này.
        </div>
      )}

      {/* Minimalist Data-First KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {cards.map((c) => {
          const IconComp = c.Icon;
          return (
            <div
              key={c.id}
              title={c.tooltip}
              role={onOpenDetails && c.hasAccess ? 'button' : undefined}
              tabIndex={onOpenDetails && c.hasAccess ? 0 : undefined}
              onClick={() => { if (c.hasAccess) onOpenDetails?.(c.id === 2 || c.id === 4 ? 'balance' : 'sales'); }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && c.hasAccess) {
                  e.preventDefault();
                  onOpenDetails?.(c.id === 2 || c.id === 4 ? 'balance' : 'sales');
                }
              }}
              className={`group relative bg-white rounded-2xl border ${c.theme.border} px-4 py-4 shadow-xs hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer overflow-hidden`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${c.theme.topStripe}`} />

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500 truncate">{c.title}</span>
                    {onOpenDetails && c.hasAccess && (
                      <ArrowUpRight size={13} className="text-slate-300 group-hover:text-blue-600 transition shrink-0" />
                    )}
                  </div>

                  <div
                    className={`text-xl xl:text-[23px] font-black ${c.theme.valueColor} tracking-tight truncate tabular-nums leading-tight mt-1.5`}
                    title={c.raw ?? c.value}
                  >
                    {!c.hasAccess ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-200">
                        <Lock size={12} /> Không có quyền
                      </span>
                    ) : (
                      c.value
                    )}
                  </div>

                  {c.hasAccess && c.pill && (
                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${c.theme.pill}`}>
                      {c.pill}
                    </span>
                  )}
                </div>

                <div className={`w-11 h-11 rounded-xl ${c.theme.iconBg} flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform`}>
                  <IconComp size={22} strokeWidth={2.2} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
