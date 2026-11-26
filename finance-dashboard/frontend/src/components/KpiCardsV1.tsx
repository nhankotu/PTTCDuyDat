import React from 'react';
import {
  BadgeDollarSign,
  Landmark,
  UserPlus,
  Users,
  FileText,
  BarChart3,
  Target,
  ArrowUpRight,
  Lock,
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
            className="bg-white rounded-xl p-4 border border-slate-200/80 animate-pulse flex items-center justify-between gap-3"
          >
            <div className="space-y-2.5 flex-1">
              <div className="h-3.5 bg-slate-200 rounded w-1/2" />
              <div className="h-7 bg-slate-200 rounded w-4/5" />
            </div>
            <div className="h-10 w-10 bg-slate-200 rounded-xl shrink-0" />
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
      tooltip:
        earlyLiquidationMaxDays > 0
          ? `Tổng giá trị HĐ phát sinh theo ngày ký (đã loại HĐ thanh lý sớm <= ${earlyLiquidationMaxDays} ngày). Bấm để xem chi tiết.`
          : 'Tổng giá trị HĐ phát sinh theo ngày ký. Bấm để xem chi tiết.',
      value: formatMoney(metrics?.totalSales, access.revenue),
      raw: metrics?.totalSales,
      pill: earlyLiquidationMaxDays > 0 ? `Loại <= ${earlyLiquidationMaxDays}d` : null,
      hasAccess: access.revenue,
      Icon: BadgeDollarSign,
      featured: true,
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
      featured: true,
    },
    {
      id: 3,
      title: excludeSafeNewCust ? '3. KH mới (Chuẩn)' : '3. Số khách hàng',
      tooltip: excludeSafeNewCust
        ? 'Khách hàng mới ngoài sản phẩm Safe, giá trị >= 1Tr lần đầu trong kỳ.'
        : 'Khách hàng phát sinh hợp đồng trong kỳ.',
      value: formatCount(
        excludeSafeNewCust ? metrics?.newCustomers ?? metrics?.totalCustomers : metrics?.totalCustomers,
        access.revenue
      ),
      raw: (excludeSafeNewCust
        ? metrics?.newCustomers ?? metrics?.totalCustomers
        : metrics?.totalCustomers
      )?.toString(),
      pill:
        !excludeSafeNewCust && metrics?.newCustomers != null
          ? `Mới: ${metrics.newCustomers.toLocaleString('vi-VN')}`
          : excludeSafeNewCust && metrics?.totalCustomers != null
          ? `Tổng kỳ: ${metrics.totalCustomers.toLocaleString('vi-VN')}`
          : null,
      hasAccess: access.revenue,
      Icon: UserPlus,
      featured: false,
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
      featured: false,
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
      featured: false,
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
      featured: false,
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
      featured: false,
    },
  ];

  return (
    <div className="mb-5 space-y-3">
      {access.scopesDiffer && (
        <div className="bg-amber-50 border border-amber-200 px-3.5 py-2.5 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
          <span className="font-medium">
            <strong>Khác phạm vi:</strong> Phạm vi Doanh số và Số dư khác nhau theo quyền ngang hàng.
          </span>
          <span className="text-[11px] bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md font-semibold shrink-0">
            KHÁC PHẠM VI
          </span>
        </div>
      )}

      {kpiData?.dataStatus === 'UNAVAILABLE' && (
        <div className="bg-rose-50 border border-rose-200 px-3.5 py-2.5 rounded-xl text-xs text-rose-800 font-medium">
          Tài khoản chưa được cấp quyền truy cập dữ liệu trong kỳ báo cáo này.
        </div>
      )}

      {/* Clean Institutional Blue & White KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {cards.map((c) => {
          const IconComp = c.Icon;
          return (
            <div
              key={c.id}
              title={c.tooltip}
              role={onOpenDetails && c.hasAccess ? 'button' : undefined}
              tabIndex={onOpenDetails && c.hasAccess ? 0 : undefined}
              onClick={() => {
                if (c.hasAccess) onOpenDetails?.(c.id === 2 || c.id === 4 ? 'balance' : 'sales');
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && c.hasAccess) {
                  e.preventDefault();
                  onOpenDetails?.(c.id === 2 || c.id === 4 ? 'balance' : 'sales');
                }
              }}
              className={`group relative bg-white rounded-xl border px-4 py-4 transition-all duration-150 cursor-pointer overflow-hidden ${
                c.featured
                  ? 'border-[#BFDBFE] hover:border-[#1D4ED8] shadow-xs hover:shadow-md'
                  : 'border-slate-200/90 hover:border-[#BFDBFE] hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500 truncate">{c.title}</span>
                    {onOpenDetails && c.hasAccess && (
                      <ArrowUpRight
                        size={13}
                        className="text-slate-300 group-hover:text-[#1D4ED8] transition-colors shrink-0"
                      />
                    )}
                  </div>

                  <div
                    className="text-xl xl:text-[22px] font-extrabold text-[#0F294A] tracking-tight truncate tabular-nums leading-tight mt-1.5"
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
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE] tabular-nums">
                      {c.pill}
                    </span>
                  )}
                </div>

                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    c.featured
                      ? 'bg-[#1D4ED8] text-white'
                      : 'bg-[#EFF6FF] text-[#1D4ED8] group-hover:bg-[#1D4ED8] group-hover:text-white'
                  }`}
                >
                  <IconComp size={20} strokeWidth={1.85} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
