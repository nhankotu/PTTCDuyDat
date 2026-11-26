import React, { useEffect, useState, useRef } from 'react';
import {
  BadgeDollarSign,
  Landmark,
  FileText,
  Users,
  CalendarDays,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { apiV1 } from '../services/apiV1';
import { DimensionFilters, KpiReportResponse, ReportView } from '../types/v1';
import { KpiCardsV1 } from './KpiCardsV1';
import { TrendAndPivotSection } from './TrendAndPivotSection';

interface Props {
  reportView: ReportView;
  appliedDimensions: DimensionFilters;
  datasetId?: string;
  refreshKey: number;
  onOpenContracts: (basis: 'sales' | 'balance', from: string, to: string, asOf: string) => void;
  onOpenOverview: () => void;
  onDrillDown: (groupBy: string, groupKey: string) => void;
}

function getCurrentDates() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const today = `${y}-${m}-${d}`;
  const monthStart = `${y}-${m}-01`;
  const monthLabel = `Tháng ${Number(m)}/${y}`;
  const todayLabel = `${d}/${m}/${y}`;
  return { today, monthStart, monthLabel, todayLabel };
}

export const HomeDashboard: React.FC<Props> = ({
  reportView,
  appliedDimensions,
  datasetId,
  refreshKey,
  onOpenContracts,
  onOpenOverview,
  onDrillDown,
}) => {
  const { today, monthStart, monthLabel, todayLabel } = getCurrentDates();

  const [todayKpi, setTodayKpi] = useState<KpiReportResponse | null>(null);
  const [monthKpi, setMonthKpi] = useState<KpiReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const fetchKey = JSON.stringify([reportView, appliedDimensions, datasetId, refreshKey, today]);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);

    const common = {
      datasetId,
      ...reportView,
      ...appliedDimensions,
    };

    Promise.all([
      apiV1.getKpi({ fromDate: today, toDate: today, asOfDate: today, ...common }),
      apiV1.getKpi({ fromDate: monthStart, toDate: today, asOfDate: today, ...common }),
    ])
      .then(([tRes, mRes]) => {
        if (id !== reqId.current) return;
        setTodayKpi(tRes);
        setMonthKpi(mRes);
      })
      .catch((err: any) => {
        if (id !== reqId.current) return;
        setError(err?.response?.data?.message || 'Không tải được chỉ số hiện tại.');
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });

    return () => {
      reqId.current++;
    };
  }, [fetchKey]);

  const fmtMoney = (val: string | null | undefined, ok: boolean) => {
    if (!ok) return 'Không có quyền';
    if (!val) return '0 đ';
    const n = parseFloat(val);
    if (isNaN(n)) return '0 đ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(n);
  };

  const fmtCount = (val: number | null | undefined, ok: boolean) => {
    if (!ok) return 'Không có quyền';
    return (val ?? 0).toLocaleString('vi-VN');
  };

  const tAccess = todayKpi?.access ?? { revenue: true, balance: true, scopesDiffer: false };
  const tMetrics = todayKpi?.metrics;

  const todayCards = [
    {
      id: 'today_sales',
      title: 'Doanh số hôm nay',
      value: fmtMoney(tMetrics?.totalSales, tAccess.revenue),
      hasAccess: tAccess.revenue,
      basis: 'sales' as const,
      Icon: BadgeDollarSign,
      featured: true,
    },
    {
      id: 'today_contracts',
      title: 'Hợp đồng hôm nay',
      value: fmtCount(tMetrics?.totalContracts, tAccess.revenue),
      hasAccess: tAccess.revenue,
      basis: 'sales' as const,
      Icon: FileText,
      featured: false,
    },
    {
      id: 'today_customers',
      title: 'Khách hàng hôm nay',
      value: fmtCount(tMetrics?.totalCustomers, tAccess.revenue),
      hasAccess: tAccess.revenue,
      basis: 'sales' as const,
      Icon: Users,
      featured: false,
    },
    {
      id: 'today_balance',
      title: 'Số dư hiện tại',
      value: fmtMoney(tMetrics?.totalBalance, tAccess.balance),
      hasAccess: tAccess.balance,
      basis: 'balance' as const,
      Icon: Landmark,
      featured: true,
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
        >
          <AlertCircle size={15} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Hôm nay */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1D4ED8]" />
            <h2 className="text-sm font-bold text-[#0F294A] uppercase tracking-wide tabular-nums">
              Hôm nay · {todayLabel}
            </h2>
          </div>

          <button
            type="button"
            onClick={onOpenOverview}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] hover:underline cursor-pointer"
          >
            <span>Xem theo khoảng ngày tùy chọn</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 animate-pulse h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {todayCards.map((c) => {
              const IconComp = c.Icon;
              return (
                <div
                  key={c.id}
                  role={c.hasAccess ? 'button' : undefined}
                  tabIndex={c.hasAccess ? 0 : undefined}
                  onClick={() => c.hasAccess && onOpenContracts(c.basis, today, today, today)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && c.hasAccess) {
                      e.preventDefault();
                      onOpenContracts(c.basis, today, today, today);
                    }
                  }}
                  className={`group bg-white rounded-xl border px-4 py-3.5 transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                    c.featured
                      ? 'border-[#BFDBFE] hover:border-[#1D4ED8] shadow-xs hover:shadow-sm'
                      : 'border-slate-200/90 hover:border-[#BFDBFE] hover:shadow-xs'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-500 truncate">{c.title}</div>
                    <div className="text-xl font-extrabold text-[#0F294A] tabular-nums truncate mt-1">
                      {c.value}
                    </div>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      c.featured
                        ? 'bg-[#1D4ED8] text-white'
                        : 'bg-[#EFF6FF] text-[#1D4ED8] group-hover:bg-[#1D4ED8] group-hover:text-white'
                    }`}
                  >
                    <IconComp size={19} strokeWidth={1.9} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Tháng hiện tại (7 Chỉ Số KPI + Xu hướng tháng hiện tại) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[#1D4ED8]" />
            <h2 className="text-sm font-bold text-[#0F294A] uppercase tracking-wide tabular-nums">
              {monthLabel} (01/{today.slice(5, 7)} → {todayLabel})
            </h2>
          </div>
        </div>

        <KpiCardsV1
          kpiData={monthKpi}
          loading={loading}
          excludeSafeNewCust={appliedDimensions.excludeSafeNewCust}
          earlyLiquidationMaxDays={appliedDimensions.earlyLiquidationMaxDays ?? 5}
          onOpenDetails={(basis) => onOpenContracts(basis, monthStart, today, today)}
        />

        <TrendAndPivotSection
          compact
          refreshKey={refreshKey}
          onDrillDown={onDrillDown}
          {...appliedDimensions}
          fromDate={monthStart}
          toDate={today}
          asOfDate={today}
          datasetId={datasetId}
          {...reportView}
        />
      </section>
    </div>
  );
};
