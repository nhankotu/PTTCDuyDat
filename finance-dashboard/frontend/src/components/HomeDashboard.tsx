import React, { useEffect, useState, useRef } from 'react';
import {
  BadgeDollarSign, Landmark, FileText, Users, CalendarDays, ArrowRight
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
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
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
      iconCls: 'bg-blue-100/80 text-blue-700',
      borderCls: 'border-blue-200/80 hover:border-blue-400',
    },
    {
      id: 'today_contracts',
      title: 'Hợp đồng hôm nay',
      value: fmtCount(tMetrics?.totalContracts, tAccess.revenue),
      hasAccess: tAccess.revenue,
      basis: 'sales' as const,
      Icon: FileText,
      iconCls: 'bg-amber-100/80 text-amber-700',
      borderCls: 'border-amber-200/80 hover:border-amber-400',
    },
    {
      id: 'today_customers',
      title: 'Khách hàng hôm nay',
      value: fmtCount(tMetrics?.totalCustomers, tAccess.revenue),
      hasAccess: tAccess.revenue,
      basis: 'sales' as const,
      Icon: Users,
      iconCls: 'bg-purple-100/80 text-purple-700',
      borderCls: 'border-purple-200/80 hover:border-purple-400',
    },
    {
      id: 'today_balance',
      title: 'Số dư hiện tại',
      value: fmtMoney(tMetrics?.totalBalance, tAccess.balance),
      hasAccess: tAccess.balance,
      basis: 'balance' as const,
      Icon: Landmark,
      iconCls: 'bg-emerald-100/80 text-emerald-700',
      borderCls: 'border-emerald-200/80 hover:border-emerald-400',
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      {/* 1. Hôm nay */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
              Hôm nay · {todayLabel}
            </h2>
          </div>

          <button
            type="button"
            onClick={onOpenOverview}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
          >
            <span>Xem theo khoảng ngày tùy chọn</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200 animate-pulse h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {todayCards.map((c) => {
              const IconComp = c.Icon;
              return (
                <div
                  key={c.id}
                  onClick={() => c.hasAccess && onOpenContracts(c.basis, today, today, today)}
                  className={`bg-white rounded-2xl border ${c.borderCls} px-4 py-3.5 shadow-xs hover:shadow-md transition cursor-pointer flex items-center justify-between gap-3`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-500 truncate">{c.title}</div>
                    <div className="text-xl font-black text-slate-900 tabular-nums truncate mt-1">
                      {c.value}
                    </div>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${c.iconCls} flex items-center justify-center shrink-0`}>
                    <IconComp size={20} strokeWidth={2.2} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Tháng hiện tại (7 Chỉ Số KPI + Xu hướng tháng hiện tại) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-blue-600" />
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
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
