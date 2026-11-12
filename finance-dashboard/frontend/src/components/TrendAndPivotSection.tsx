import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { ReportView, DimensionFilters } from '../types/v1';
import { apiV1 } from '../services/apiV1';
import { TrendPoint, PivotItem } from '../types/v1';

interface Props extends ReportView, DimensionFilters {
  fromDate: string;
  toDate: string;
  datasetId?: string;
  compact?: boolean;
  onDrillDown?: (groupBy: string, groupKey: string) => void;
}

export const TrendAndPivotSection: React.FC<Props> = ({ fromDate, toDate, datasetId, viewEmployeeId, view, products, terms, channels, statuses, compact, onDrillDown }) => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
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
    setTempIntervals([...customIntervals]);
    setIsWeekModalOpen(true);
  };

  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [groupBy, setGroupBy] = useState<'product' | 'term' | 'channel' | 'branch' | 'sale'>('product');
  const [pivotData, setPivotData] = useState<PivotItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Save week mode
  useEffect(() => {
    localStorage.setItem('finra_week_mode', weekMode);
  }, [weekMode]);

  // Save custom intervals
  const handleSaveCustomIntervals = (newIntervals: Array<{ start: string; end: string; label: string }>) => {
    const sorted = [...newIntervals].sort((a, b) => a.start.localeCompare(b.start));
    if (!sorted.length || sorted.some((interval, i) => !interval.start || !interval.end || interval.start > interval.end || interval.start < fromDate || interval.end > toDate || (i > 0 && interval.start <= sorted[i - 1].end))) {
      setError('Mốc tuần phải nằm trong kỳ báo cáo, từ ngày không sau đến ngày và các mốc không được trùng nhau.');
      return;
    }
    setError(null);
    setCustomIntervals(newIntervals);
    localStorage.setItem('finra_custom_week_intervals', JSON.stringify(newIntervals));
    setIsWeekModalOpen(false);
  };

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true); setError(null); setTrendData([]); setPivotData([]);
      try {
        const [trendRes, pivotRes] = await Promise.all([
          apiV1.getTrend({
            fromDate,
            toDate,
            period,
            datasetId,
        viewEmployeeId, view, products, terms, channels, statuses,
            weekMode: period === 'week' ? weekMode : undefined,
            customIntervalsJson: period === 'week' && weekMode === 'custom' ? JSON.stringify(customIntervals) : undefined,
          }),
          apiV1.getPivot({ fromDate, toDate, groupBy, datasetId, viewEmployeeId, view, products, terms, channels, statuses }),
        ]);
        if (!active) return;
        setTrendData(trendRes);
        setPivotData(pivotRes);
      } catch (err: any) {
        if (active) setError(err.response?.data?.message || 'Không tải được phân tích. Vui lòng thử lại.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => { active = false; };
  }, [fromDate, toDate, period, groupBy, datasetId, weekMode, customIntervals, viewEmployeeId, view, products, terms, channels, statuses, revision]);

  // ECharts Trend Option with modern aesthetics
  const trendOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(59, 130, 246, 0.05)' } },
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      padding: [10, 14],
      borderRadius: 8,
      formatter: (params: any) => {
        let res = `<div style="font-weight:700;margin-bottom:6px;color:#94a3b8">${params[0]?.axisValue || ''}</div>`;
        params.forEach((item: any) => {
          const val = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(item.value || 0);
          res += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin:4px 0;">
            <span style="display:inline-flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color}"></span>
              <span>${item.seriesName}</span>
            </span>
            <strong style="color:#ffffff">${val}</strong>
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
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          formatter: (value: number) => (value >= 1e9 ? `${(value / 1e9).toFixed(1)} Tỷ` : `${(value / 1e6).toFixed(0)} Tr`),
        },
      },
    ],
    series: [
      {
        name: 'Doanh số phát sinh',
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
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
        lineStyle: { width: 3.5, color: '#10b981' },
        itemStyle: { color: '#10b981', borderColor: '#ffffff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.25)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
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
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: { name: string; value: number; percent: number }) =>
        `<div style="font-weight:700;margin-bottom:2px">${params.name}</div><div><b>${formatMoney(String(params.value))}</b> (${params.percent}%)</div>`,
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
      pageIconColor: '#4f46e5',
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
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <span className="p-1 rounded-md bg-blue-50 text-blue-600">📈</span>
              <span>Xu Hướng Doanh Số & Số Dư Theo Thời Gian</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Doanh số phát sinh trong kỳ (cột xanh) & Số dư lũy kế tại ngày cuối của từng mốc thời gian (đường xanh ngọc).
            </p>
          </div>

          {/* Segmented Control */}
          <div className="flex flex-wrap items-center gap-3">
            {period === 'week' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Mốc Tuần:</span>
                <select
                  value={weekMode}
                  onChange={(e) => setWeekMode(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700 focus:outline-none shadow-2xs"
                >
                  <option value="standard">📅 Thứ 2 - CN (Lịch chuẩn)</option>
                  <option value="business4week">🏢 4 Mốc Kinh Doanh (1-7, 8-15, 16-22, 23-Cuối)</option>
                  <option value="custom">⚙️ Mốc Tùy Chỉnh Theo Ngày Làm Việc</option>
                </select>

                {weekMode === 'custom' && (
                  <button
                    type="button"
                    onClick={openWeekModal}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>✏️ Cài Đặt ({customIntervals.length})</span>
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center space-x-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 self-start sm:self-auto">
              {(['day', 'week', 'month', 'quarter'] as const).map((p) => {
                const isActive = period === p;
                const label = p === 'day' ? 'Ngày' : p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Quý';
                return (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-white text-blue-600 shadow-xs border border-slate-200/50'
                        : 'text-slate-600 hover:text-slate-900'
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
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Đang kết xuất biểu đồ xu hướng...</span>
          </div>
        ) : trendData.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-slate-400">
            <span className="text-2xl mb-2">📊</span>
            <span className="text-xs font-medium">Chưa có phát sinh dữ liệu trong kỳ này</span>
          </div>
        ) : (
          <ReactECharts option={trendOption} style={{ height: compact ? '260px' : '340px', width: '100%' }} />
        )}
      </div>

      {!compact && <>
      {/* 2. Pivot & Shares Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                <span className="p-1 rounded-md bg-purple-50 text-purple-600">🥧</span>
                <span>Bảng Tổng Hợp Cơ Cấu & Tỷ Trọng Đa Chiều</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Phân tích tỷ trọng doanh số và số dư theo từng phân loại quản lý.
              </p>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <span className="text-xs font-semibold text-slate-600">Phân loại:</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="text-xs font-semibold border-slate-300 rounded-lg px-3 py-1.5 border bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="product">Sản phẩm đầu tư</option>
                <option value="term">Kỳ hạn hợp đồng</option>
                <option value="channel">Kênh bán</option>
                <option value="branch">Chi nhánh kinh doanh</option>
                <option value="sale">Mã nhân viên Sale</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-3.5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                      Phân Nhóm
                    </th>
                    <th className="px-3.5 py-3 text-right font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                      Doanh Số (VND)
                    </th>
                    <th className="px-3.5 py-3 text-center font-bold text-slate-600 uppercase tracking-wider text-[11px] w-28">
                      Tỷ Trọng DS
                    </th>
                    <th className="px-3.5 py-3 text-right font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                      Số Dư Tại T
                    </th>
                    <th className="px-3.5 py-3 text-center font-bold text-slate-600 uppercase tracking-wider text-[11px] w-28">
                      Tỷ Trọng Dư
                    </th>
                    <th className="px-3.5 py-3 text-right font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                      Số HĐ
                    </th>
                    <th className="px-3.5 py-3 text-right font-bold text-slate-600 uppercase tracking-wider text-[11px]">
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
                      <tr key={item.groupKey} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                          {onDrillDown && groupBy !== 'branch' ? <button onClick={() => onDrillDown(groupBy, item.groupKey)} className="text-blue-700 underline underline-offset-4">{item.groupName || 'Chưa xác định'}</button> : item.groupName || 'Chưa xác định'}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-blue-900">
                          {formatMoney(item.totalSales)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, item.salesSharePercent || 0)}%` }}
                              />
                            </div>
                            <span className="font-bold text-blue-600 text-[11px] w-10 text-right">
                              {item.salesSharePercent === null ? '—' : item.salesSharePercent.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-emerald-900">
                          {formatMoney(item.totalBalance)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, item.balanceSharePercent || 0)}%` }}
                              />
                            </div>
                            <span className="font-bold text-emerald-600 text-[11px] w-10 text-right">
                              {item.balanceSharePercent === null ? '—' : item.balanceSharePercent.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-medium text-slate-700">
                          {item.contractCount?.toLocaleString('vi-VN') ?? 'Không có quyền'}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-medium text-slate-700">
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
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <span className="p-1 rounded-md bg-indigo-50 text-indigo-600">🍩</span>
              <span>Cơ Cấu Tỷ Trọng Doanh Số</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Tỷ trọng phần trăm đóng góp theo từng nhóm.
            </p>
          </div>

          <div className="my-auto py-2">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <div className="w-7 h-7 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium">Đang phân tích tỷ trọng...</span>
              </div>
            ) : pivotData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                Chưa có dữ liệu
              </div>
            ) : (
              <ReactECharts option={donutOption} style={{ height: '300px', width: '100%' }} />
            )}
          </div>

          <div className="text-[11px] text-slate-400 text-center border-t border-slate-100 pt-3">
            Tổng cộng: {pivotData.length} phân nhóm được ghi nhận
          </div>
        </div>
      </div>

      </>}
      {/* Modal Cài Đặt Mốc Tuần Tùy Chỉnh */}
      {isWeekModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚙️</span>
                <h3 className="text-base font-extrabold text-slate-900">Cài Đặt Mốc Tuần Theo Ngày Làm Việc</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWeekModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Tùy chỉnh các khoảng thời gian (Từ ngày ➔ Đến ngày) cho từng cột Tuần theo lịch làm việc riêng của công ty:
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
                      className="font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {tempIntervals.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTempIntervals(tempIntervals.filter((_, i) => i !== idx));
                        }}
                        className="text-rose-500 hover:text-rose-700 font-bold text-xs cursor-pointer"
                      >
                        ✕ Xóa
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
                      className="bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-semibold text-slate-700"
                    />
                    <span className="text-slate-400 font-bold">➔</span>
                    <input
                      type="date"
                      value={item.end}
                      onChange={(e) => {
                        const next = [...tempIntervals];
                        next[idx].end = e.target.value;
                        setTempIntervals(next);
                      }}
                      className="bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-semibold text-slate-700"
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
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              + Thêm mốc tuần mới
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                💾 Lưu Mốc Tuần
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
