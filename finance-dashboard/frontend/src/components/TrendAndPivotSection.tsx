import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, PieChart, Columns2, Layers, Settings2, X, Save, Plus } from 'lucide-react';
import { ReportView, DimensionFilters } from '../types/v1';
import { apiV1 } from '../services/apiV1';
import { TrendPoint, PivotItem } from '../types/v1';

interface Props extends ReportView, DimensionFilters {
  fromDate: string;
  toDate: string;
  asOfDate?: string;
  datasetId?: string;
  refreshKey?: number;
  compact?: boolean;
  onDrillDown?: (groupBy: string, groupKey: string) => void;
}

function calcBalanceMin(value: { min: number; max: number }): number {
  if (!Number.isFinite(value.min) || !Number.isFinite(value.max) || value.max <= 0) return 0;
  const span = value.max - value.min;
  const pad = span > 0 ? span * 0.2 : Math.max(value.max * 0.02, 1_000_000);
  return Math.max(0, Math.floor(value.min - pad));
}

function calcBalanceMax(value: { min: number; max: number }): number {
  if (!Number.isFinite(value.min) || !Number.isFinite(value.max) || value.max <= 0) return 10_000_000;
  const span = value.max - value.min;
  const pad = span > 0 ? span * 0.2 : Math.max(value.max * 0.02, 1_000_000);
  return Math.ceil(value.max + pad);
}

export const TrendAndPivotSection: React.FC<Props> = ({
  fromDate,
  toDate,
  asOfDate,
  datasetId,
  refreshKey,
  viewEmployeeId,
  view,
  products,
  terms,
  channels,
  statuses,
  excludeTenDays,
  earlyLiquidationMaxDays,
  excludeSafeNewCust,
  excludeGhost,
  compact,
  onDrillDown,
}) => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
  const [chartViewMode, setChartViewMode] = useState<'combined' | 'split'>(() => {
    try {
      const saved = localStorage.getItem('finra_chart_view_mode');
      if (saved === 'combined' || saved === 'split') return saved;
    } catch {}
    return 'split';
  });
  const [weekMode, setWeekMode] = useState<'standard' | 'business4week' | 'custom'>(() => {
    return (localStorage.getItem('finra_week_mode') as any) || 'standard';
  });
  const [customIntervals, setCustomIntervals] = useState<Array<{ start: string; end: string; label: string }>>(() => {
    try {
      const saved = localStorage.getItem('finra_custom_week_intervals');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { start: fromDate, end: toDate, label: 'Tuần Tùy Chỉnh 1' }
    ];
  });
  const [isWeekModalOpen, setIsWeekModalOpen] = useState(false);
  const [tempIntervals, setTempIntervals] = useState<Array<{ start: string; end: string; label: string }>>([]);

  const openWeekModal = () => {
    const hasOverlap = customIntervals.some(iv => iv.end >= fromDate && iv.start <= toDate);
    setTempIntervals(hasOverlap ? [...customIntervals] : [{ start: fromDate, end: toDate, label: 'Tuần 1' }]);
    setIsWeekModalOpen(true);
  };

  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [groupBy, setGroupBy] = useState<'product' | 'term' | 'channel' | 'branch' | 'sale'>('product');
  const [pivotData, setPivotData] = useState<PivotItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    try { localStorage.setItem('finra_chart_view_mode', chartViewMode); } catch {}
  }, [chartViewMode]);

  // Save week mode
  useEffect(() => {
    try { localStorage.setItem('finra_week_mode', weekMode); } catch {}
  }, [weekMode]);

  // Save custom intervals
  const handleSaveCustomIntervals = (newIntervals: Array<{ start: string; end: string; label: string }>) => {
    const sorted = [...newIntervals].sort((a, b) => a.start.localeCompare(b.start));
    if (!sorted.length || sorted.some((interval, i) => !interval.start || !interval.end || interval.start > interval.end || interval.start < fromDate || interval.end > toDate || (i > 0 && interval.start <= sorted[i - 1].end))) {
      setError('Mốc tuần phải nằm trong kỳ báo cáo, từ ngày không sau đến ngày và các mốc không được trùng nhau.');
      return;
    }
    setError(null);
    setCustomIntervals(sorted);
    try { localStorage.setItem('finra_custom_week_intervals', JSON.stringify(sorted)); } catch {}
    setIsWeekModalOpen(false);
  };

  const dimsKey = JSON.stringify([products, terms, channels, statuses, !!excludeTenDays, earlyLiquidationMaxDays ?? 5, !!excludeSafeNewCust, !!excludeGhost]);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true); setError(null);
      try {
        const sharedParams = {
          fromDate,
          toDate,
          asOfDate: asOfDate || toDate,
          datasetId,
          viewEmployeeId,
          view,
          products,
          terms,
          channels,
          statuses,
          excludeTenDays,
          earlyLiquidationMaxDays: earlyLiquidationMaxDays ?? 5,
          excludeSafeNewCust,
          excludeGhost,
        };
        const trendPromise = apiV1.getTrend({
          ...sharedParams,
          period,
          weekMode: period === 'week' ? weekMode : undefined,
          customIntervalsJson: period === 'week' && weekMode === 'custom' ? JSON.stringify(customIntervals) : undefined,
        });
        // Skip getPivot in compact mode to cut Render Free DB load by 50%
        const pivotPromise = compact
          ? Promise.resolve<PivotItem[]>([])
          : apiV1.getPivot({ ...sharedParams, groupBy });
        const [trendRes, pivotRes] = await Promise.all([trendPromise, pivotPromise]);
        if (!active) return;
        setTrendData(trendRes);
        if (!compact) setPivotData(pivotRes);
      } catch (err: any) {
        if (active) setError(err.response?.data?.message || 'Không tải được phân tích. Vui lòng thử lại.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => { active = false; };
  }, [fromDate, toDate, asOfDate, period, groupBy, datasetId, weekMode, customIntervals, viewEmployeeId, view, dimsKey, compact, revision, refreshKey]);

  const numericBalances = trendData
    .map(t => (t.totalBalance === null ? NaN : parseFloat(t.totalBalance)))
    .filter(n => Number.isFinite(n));
  const balSpan = numericBalances.length > 1 ? Math.max(...numericBalances) - Math.min(...numericBalances) : 0;
  const formatBalanceAxisLabel = (v: number) => {
    if (v >= 1e9) {
      const decimals = balSpan > 0 && balSpan < 2e9 ? 2 : 1;
      return `${(v / 1e9).toFixed(decimals)} Tỷ`;
    }
    return `${(v / 1e6).toFixed(0)} Tr`;
  };

  // ECharts Trend Option with fast rendering & Blue/White light tooltip
  const trendOption = {
    animationDuration: 220,
    animationDurationUpdate: 150,
    textStyle: { fontFamily: "'Inter', 'Be Vietnam Pro', sans-serif" },
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(29, 78, 216, 0.06)' } },
      backgroundColor: '#ffffff',
      borderColor: '#dbeafe',
      borderWidth: 1,
      textStyle: { color: '#0f294a', fontSize: 12 },
      extraCssText: 'box-shadow: 0 10px 25px -5px rgba(15, 41, 74, 0.14); border-radius: 10px;',
      padding: [10, 14],
      formatter: (params: any) => {
        let res = `<div style="font-weight:700;margin-bottom:6px;color:#0f294a">${params[0]?.axisValue || ''}</div>`;
        params.forEach((item: any) => {
          const val = item.value === null || item.value === undefined
            ? 'Không có quyền'
            : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(item.value);
          res += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin:4px 0;font-variant-numeric:tabular-nums;">
            <span style="display:inline-flex;align-items:center;gap:6px;color:#475569;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.seriesIndex === 0 ? '#1d4ed8' : '#0284c7'}"></span>
              <span>${item.seriesName}</span>
            </span>
            <strong style="color:#0f294a">${val}</strong>
          </div>`;
        });
        return res;
      },
    },
    legend: {
      data: ['Doanh số phát sinh', 'Số dư tại cuối mốc'],
      bottom: 4,
      icon: 'circle',
      textStyle: { color: '#64748b', fontSize: 12, fontWeight: 500 },
      itemGap: 24,
    },
    grid: {
      left: '3%',
      right: '4%',
      top: '12%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: trendData.map((t) => t.periodLabel),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b', fontSize: 11, fontWeight: 500 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Doanh số',
        nameTextStyle: { color: '#64748b', fontSize: 11, padding: [0, 0, 4, 0] },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          formatter: (value: number) => (value >= 1e9 ? `${(value / 1e9).toFixed(1)} Tỷ` : `${(value / 1e6).toFixed(0)} Tr`),
        },
      },
      {
        type: 'value',
        name: 'Số dư',
        nameTextStyle: { color: '#64748b', fontSize: 11, padding: [0, 0, 4, 0] },
        axisLine: { show: false },
        splitLine: { show: false },
        scale: true,
        min: calcBalanceMin,
        max: calcBalanceMax,
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          formatter: formatBalanceAxisLabel,
        },
      },
    ],
    series: [
      {
        name: 'Doanh số phát sinh',
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#1d4ed8' },
            ],
          },
        },
        data: trendData.map((t) => t.totalSales === null ? null : parseFloat(t.totalSales)),
      },
      {
        name: 'Số dư tại cuối mốc',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: true,
        symbolSize: 8,
        lineStyle: { width: 3, color: '#0284c7' },
        itemStyle: { color: '#0284c7', borderColor: '#ffffff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(2, 132, 199, 0.18)' },
              { offset: 1, color: 'rgba(2, 132, 199, 0.0)' },
            ],
          },
        },
        data: trendData.map((t) => t.totalBalance === null ? null : parseFloat(t.totalBalance)),
      },
    ],
  };

  // Dedicated Sales Chart (when in split mode)
  const salesOption = {
    textStyle: { fontFamily: "'Inter', 'Be Vietnam Pro', sans-serif" },
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(29, 78, 216, 0.06)' } },
      backgroundColor: '#ffffff',
      borderColor: '#dbeafe',
      borderWidth: 1,
      textStyle: { color: '#0f294a', fontSize: 12 },
      extraCssText: 'box-shadow: 0 10px 25px -5px rgba(15, 41, 74, 0.14); border-radius: 10px;',
      formatter: (params: any) => {
        const item = params[0];
        const val = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(item?.value || 0);
        return `<div style="font-weight:700;margin-bottom:4px;color:#0f294a">${item?.axisValue || ''}</div><div style="color:#1d4ed8;font-weight:700;font-variant-numeric:tabular-nums">${item?.seriesName}: ${val}</div>`;
      },
    },
    grid: { left: '3%', right: '3%', top: '15%', bottom: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      data: trendData.map((t) => t.periodLabel),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b', fontSize: 11, fontWeight: 500 },
    },
    yAxis: {
      type: 'value',
      name: 'Doanh số',
      nameTextStyle: { color: '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
        formatter: (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)} Tỷ` : `${(v / 1e6).toFixed(0)} Tr`),
      },
    },
    series: [
      {
        name: 'Doanh số phát sinh',
        type: 'bar',
        barMaxWidth: 36,
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#1d4ed8' },
            ],
          },
        },
        data: trendData.map((t) => t.totalSales === null ? null : parseFloat(t.totalSales)),
      },
    ],
  };

  // Dedicated Balance Chart (when in split mode - with dynamic zoomed axis)
  const balanceOption = {
    textStyle: { fontFamily: "'Inter', 'Be Vietnam Pro', sans-serif" },
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#0284c7', type: 'dashed' } },
      backgroundColor: '#ffffff',
      borderColor: '#dbeafe',
      borderWidth: 1,
      textStyle: { color: '#0f294a', fontSize: 12 },
      extraCssText: 'box-shadow: 0 10px 25px -5px rgba(15, 41, 74, 0.14); border-radius: 10px;',
      formatter: (params: any) => {
        const item = params[0];
        const val = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(item?.value || 0);
        return `<div style="font-weight:700;margin-bottom:4px;color:#0f294a">${item?.axisValue || ''}</div><div style="color:#0284c7;font-weight:700;font-variant-numeric:tabular-nums">${item?.seriesName}: ${val}</div>`;
      },
    },
    grid: { left: '3%', right: '3%', top: '15%', bottom: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      data: trendData.map((t) => t.periodLabel),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b', fontSize: 11, fontWeight: 500 },
    },
    yAxis: {
      type: 'value',
      name: 'Số dư cuối mốc',
      scale: true,
      min: calcBalanceMin,
      max: calcBalanceMax,
      nameTextStyle: { color: '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
        formatter: formatBalanceAxisLabel,
      },
    },
    series: [
      {
        name: 'Số dư tại cuối mốc',
        type: 'line',
        smooth: true,
        showSymbol: true,
        symbolSize: 8,
        lineStyle: { width: 3, color: '#0284c7' },
        itemStyle: { color: '#0284c7', borderColor: '#ffffff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(2, 132, 199, 0.2)' },
              { offset: 1, color: 'rgba(2, 132, 199, 0.0)' },
            ],
          },
        },
        data: trendData.map((t) => t.totalBalance === null ? null : parseFloat(t.totalBalance)),
      },
    ],
  };

  const formatMoney = (valStr: string | null) => {
    if (valStr === null) return 'Không có quyền';
    const num = parseFloat(valStr);
    if (isNaN(num)) return '0 đ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(num);
  };

  // ECharts Donut Share Option
  const donutData = pivotData
    .filter(p => p.totalSales !== null)
    .map((p) => ({
      name: p.groupName || 'Chưa xác định',
      value: parseFloat(p.totalSales || '0'),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const donutOption = {
    textStyle: { fontFamily: "'Inter', 'Be Vietnam Pro', sans-serif" },
    color: ['#1d4ed8', '#0284c7', '#3b82f6', '#38bdf8', '#6366f1', '#1e40af', '#0ea5e9', '#94a3b8'],
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: '#ffffff',
      borderColor: '#dbeafe',
      borderWidth: 1,
      textStyle: { color: '#0f294a', fontSize: 12 },
      extraCssText: 'box-shadow: 0 10px 25px -5px rgba(15, 41, 74, 0.14); border-radius: 10px;',
      formatter: (params: { name: string; value: number; percent: number }) =>
        `<div style="font-weight:700;margin-bottom:2px;color:#0f294a">${params.name}</div><div style="font-variant-numeric:tabular-nums"><b>${formatMoney(String(params.value))}</b> (${params.percent}%)</div>`,
    },
    legend: {
      type: 'scroll',
      orient: 'horizontal',
      bottom: 0,
      left: 'center',
      icon: 'circle',
      textStyle: { color: '#64748b', fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
      pageIconColor: '#1d4ed8',
      pageTextStyle: { color: '#64748b', fontSize: 11 },
    },
    series: [
      {
        name: 'Tỷ trọng Doanh số',
        type: 'pie',
        radius: ['44%', '70%'],
        center: ['50%', '43%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#ffffff',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            formatter: '{b}\n{d}%',
          },
        },
        data: donutData,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="p-4 rounded-xl bg-rose-50 text-rose-800">{error} <button onClick={() => setRevision(n => n + 1)} className="underline font-semibold">Thử lại</button></p>}
      {/* 1. Trend Section */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-slate-100">
          <h3
            className="font-bold text-[#0F294A] text-sm sm:text-base flex items-center gap-2"
            title="Doanh số phát sinh trong kỳ (cột xanh dương) & Số dư lũy kế tại ngày cuối từng mốc."
          >
            <span className="w-7 h-7 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
              <TrendingUp size={16} />
            </span>
            <span>Xu hướng Doanh số &amp; Số dư</span>
          </h3>

          {/* Segmented Control */}
          <div className="flex flex-wrap items-center gap-2">
            {period === 'week' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                <select
                  aria-label="Mốc tuần"
                  value={weekMode}
                  onChange={(e) => setWeekMode(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-semibold text-[#0F294A] focus:outline-none"
                >
                  <option value="standard">T2 – CN</option>
                  <option value="business4week">4 mốc (1-7, 8-15, 16-22, 23-cuối)</option>
                  <option value="custom">Tùy chỉnh</option>
                </select>

                {weekMode === 'custom' && (
                  <button
                    type="button"
                    onClick={openWeekModal}
                    className="px-2 py-0.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Cài đặt ({customIntervals.length})
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center space-x-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
              <button
                type="button"
                onClick={() => setChartViewMode('split')}
                title="Tách riêng 2 biểu đồ Doanh số & Số dư"
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  chartViewMode === 'split'
                    ? 'bg-white text-[#1D4ED8] shadow-2xs border border-[#DBEAFE]'
                    : 'text-slate-600 hover:text-[#0F294A]'
                }`}
              >
                <Columns2 size={13} /> Tách
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('combined')}
                title="Gộp chung 2 trục Doanh số & Số dư"
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  chartViewMode === 'combined'
                    ? 'bg-white text-[#1D4ED8] shadow-2xs border border-[#DBEAFE]'
                    : 'text-slate-600 hover:text-[#0F294A]'
                }`}
              >
                <Layers size={13} /> Gộp
              </button>
            </div>

            <div className="flex items-center space-x-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
              {(['day', 'week', 'month', 'quarter'] as const).map((p) => {
                const isActive = period === p;
                const label = p === 'day' ? 'Ngày' : p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Quý';
                return (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#1D4ED8] shadow-2xs border border-[#DBEAFE]'
                        : 'text-slate-600 hover:text-[#0F294A]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-72 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <div className="w-8 h-8 border-3 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Đang tải biểu đồ...</span>
          </div>
        ) : trendData.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-slate-400">
            <span className="text-xs font-medium">Chưa có dữ liệu trong kỳ này</span>
          </div>
        ) : chartViewMode === 'split' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-[#DBEAFE] rounded-xl p-3 bg-[#F8FAFC]">
              <div className="text-xs font-bold text-[#1D4ED8] mb-1 px-2">Doanh số phát sinh</div>
              <ReactECharts option={salesOption} style={{ height: compact ? '240px' : '300px', width: '100%' }} />
            </div>
            <div className="border border-[#DBEAFE] rounded-xl p-3 bg-[#F8FAFC]">
              <div className="text-xs font-bold text-[#0284C7] mb-1 px-2">Số dư nguồn vốn</div>
              <ReactECharts option={balanceOption} style={{ height: compact ? '240px' : '300px', width: '100%' }} />
            </div>
          </div>
        ) : (
          <ReactECharts option={trendOption} style={{ height: compact ? '260px' : '340px', width: '100%' }} />
        )}
      </div>

      {!compact && <>
      {/* 2. Pivot & Shares Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-slate-100">
            <h3 className="font-bold text-[#0F294A] text-sm sm:text-base flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                <PieChart size={16} />
              </span>
              <span>Cơ cấu &amp; Tỷ trọng</span>
            </h3>

            <div className="flex items-center space-x-2">
              <select
                aria-label="Phân loại"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="text-xs font-semibold border-slate-200 rounded-lg px-3 py-1.5 border bg-slate-50 focus:bg-white text-[#0F294A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
              >
                <option value="product">Sản phẩm</option>
                <option value="term">Kỳ hạn</option>
                <option value="channel">Kênh bán</option>
                <option value="branch">Chi nhánh</option>
                <option value="sale">Nhân viên Sale</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-200/90 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    <th className="px-3.5 py-3 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">
                      Phân Nhóm
                    </th>
                    <th className="px-3.5 py-3 text-right font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">
                      Doanh Số (VND)
                    </th>
                    <th className="px-3.5 py-3 text-center font-semibold text-[#0F294A] uppercase tracking-wider text-[11px] w-28">
                      Tỷ Trọng DS
                    </th>
                    <th className="px-3.5 py-3 text-right font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">
                      Số Dư Tại T
                    </th>
                    <th className="px-3.5 py-3 text-center font-semibold text-[#0F294A] uppercase tracking-wider text-[11px] w-28">
                      Tỷ Trọng Dư
                    </th>
                    <th className="px-3.5 py-3 text-right font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">
                      Số HĐ
                    </th>
                    <th className="px-3.5 py-3 text-right font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">
                      Số KH
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {pivotData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Chưa có dữ liệu thống kê
                      </td>
                    </tr>
                  ) : (
                    pivotData.map((item) => (
                      <tr key={item.groupKey} className="hover:bg-[#EFF6FF]/60 transition-colors">
                        <td className="px-3.5 py-2.5 font-semibold text-[#0F294A]">
                          {onDrillDown && groupBy !== 'branch' ? (
                            <button
                              onClick={() => onDrillDown(groupBy, item.groupKey)}
                              className="text-[#1D4ED8] hover:underline underline-offset-4 cursor-pointer text-left"
                            >
                              {item.groupName || 'Chưa xác định'}
                            </button>
                          ) : (
                            item.groupName || 'Chưa xác định'
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-[#0F294A] tabular-nums">
                          {formatMoney(item.totalSales)}
                        </td>
                        <td className="px-3.5 py-2.5 tabular-nums">
                          <div className="flex items-center gap-1.5 justify-end">
                            <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-[#1D4ED8] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, item.salesSharePercent || 0)}%` }}
                              />
                            </div>
                            <span className="font-semibold text-[#1D4ED8] text-[11px] w-10 text-right">
                              {item.salesSharePercent === null ? '—' : item.salesSharePercent.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-[#0284C7] tabular-nums">
                          {formatMoney(item.totalBalance)}
                        </td>
                        <td className="px-3.5 py-2.5 tabular-nums">
                          <div className="flex items-center gap-1.5 justify-end">
                            <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-[#0284C7] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, item.balanceSharePercent || 0)}%` }}
                              />
                            </div>
                            <span className="font-semibold text-[#0284C7] text-[11px] w-10 text-right">
                              {item.balanceSharePercent === null ? '—' : item.balanceSharePercent.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-medium text-slate-700 tabular-nums">
                          {item.contractCount?.toLocaleString('vi-VN') ?? 'Không có quyền'}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-medium text-slate-700 tabular-nums">
                          {item.customerCount?.toLocaleString('vi-VN') ?? 'Không có quyền'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Share Donut Chart */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 flex flex-col justify-between">
          <h3 className="font-bold text-[#0F294A] text-sm flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
              <PieChart size={15} />
            </span>
            <span>Tỷ trọng Doanh số</span>
          </h3>

          <div className="my-auto py-2">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <div className="w-7 h-7 border-3 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pivotData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                Chưa có dữ liệu
              </div>
            ) : (
              <ReactECharts option={donutOption} style={{ height: '300px', width: '100%' }} />
            )}
          </div>

          <div className="text-[11px] text-slate-400 text-center border-t border-slate-100 pt-2.5 tabular-nums">
            {pivotData.length} nhóm
          </div>
        </div>
      </div>

      </>}
      {/* Modal Cài Đặt Mốc Tuần Tùy Chỉnh */}
      {isWeekModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center">
                  <Settings2 size={16} />
                </span>
                <h3 className="text-base font-bold text-[#0F294A]">Cài Đặt Mốc Tuần Theo Ngày Làm Việc</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWeekModalOpen(false)}
                aria-label="Đóng"
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F294A] hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Tùy chỉnh các khoảng thời gian (Từ ngày → Đến ngày) cho từng cột Tuần theo lịch làm việc riêng của công ty:
            </p>

            {/* List of intervals */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {tempIntervals.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Tên mốc (ví dụ: Tuần 1)"
                      value={item.label}
                      onChange={(e) => {
                        const next = [...tempIntervals];
                        next[idx].label = e.target.value;
                        setTempIntervals(next);
                      }}
                      className="font-semibold text-[#0F294A] bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs w-48 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                    />
                    {tempIntervals.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTempIntervals(tempIntervals.filter((_, i) => i !== idx));
                        }}
                        className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-semibold text-xs cursor-pointer"
                      >
                        <X size={13} />
                        <span>Xóa</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={item.start}
                      onChange={(e) => {
                        const next = [...tempIntervals];
                        next[idx].start = e.target.value;
                        setTempIntervals(next);
                      }}
                      className="bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-semibold text-[#0F294A] tabular-nums"
                    />
                    <span className="text-slate-400 font-bold">→</span>
                    <input
                      type="date"
                      value={item.end}
                      onChange={(e) => {
                        const next = [...tempIntervals];
                        next[idx].end = e.target.value;
                        setTempIntervals(next);
                      }}
                      className="bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-semibold text-[#0F294A] tabular-nums"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const last = tempIntervals[tempIntervals.length - 1];
                setTempIntervals([
                  ...tempIntervals,
                  {
                    start: last ? last.end : fromDate,
                    end: toDate,
                    label: `Tuần ${tempIntervals.length + 1}`,
                  },
                ]);
              }}
              className="w-full py-2 inline-flex items-center justify-center gap-1.5 bg-[#EFF6FF] hover:bg-blue-100 text-[#1D4ED8] border border-[#DBEAFE] rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Thêm mốc tuần mới</span>
            </button>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsWeekModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleSaveCustomIntervals(tempIntervals)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer"
              >
                <Save size={14} />
                <span>Lưu Mốc Tuần</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
