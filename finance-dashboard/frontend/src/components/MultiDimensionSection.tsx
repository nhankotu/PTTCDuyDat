import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { dashboardApi } from '../services/api';
import { PeriodGroupStat } from '../types';

interface Props {
  batchId?: number;
  branch?: string;
  branches?: string[];
  userBranch?: string;
}

export const MultiDimensionSection: React.FC<Props> = ({
  batchId,
  branch,
  branches = [],
  userBranch,
}) => {
  // Filter states
  const [dimension, setDimension] = useState<string>('product');
  const [period, setPeriod] = useState<string>('month');
  const [selectedBranch, setSelectedBranch] = useState<string>(userBranch || branch || '');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // View state: 'table' | 'bar' | 'pie' | 'line'
  const [activeView, setActiveView] = useState<'table' | 'bar' | 'pie' | 'line'>('table');

  const [stats, setStats] = useState<PeriodGroupStat[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Sync selectedBranch if parent branch or userBranch updates
  useEffect(() => {
    if (userBranch) {
      setSelectedBranch(userBranch);
    } else if (branch !== undefined) {
      setSelectedBranch(branch);
    }
  }, [branch, userBranch]);

  useEffect(() => {
    loadData();
  }, [batchId, dimension, period, selectedBranch, selectedProduct, dateFrom, dateTo]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getMultiDimensionStats({
        batchId,
        dimension,
        period,
        branch: selectedBranch || undefined,
        product: selectedProduct || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setStats(res);
    } catch (err) {
      console.error('Failed to load multi-dimension stats', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilter = () => {
    setDimension('product');
    setPeriod('month');
    if (!userBranch) {
      setSelectedBranch('');
    }
    setSelectedProduct('');
    setDateFrom('');
    setDateTo('');
  };

  const formatTy = (amt: number) => {
    return (amt / 1_000_000_000).toLocaleString('vi-VN', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }) + ' tỷ';
  };

  const formatVND = (amt: number) => {
    return amt.toLocaleString('vi-VN') + ' đ';
  };

  // 1. Prepare Bar Chart Option
  const barChartOption = useMemo(() => {
    if (!stats || stats.length === 0) return {};

    // Collect all unique item names
    const itemMap = new Map<string, { revenue: number; balance: number; count: number }>();
    stats.forEach((g) => {
      g.items.forEach((item) => {
        const cur = itemMap.get(item.name) || { revenue: 0, balance: 0, count: 0 };
        cur.revenue += item.revenue;
        cur.balance += item.balance;
        cur.count += item.contractCount;
        itemMap.set(item.name, cur);
      });
    });

    const categories = Array.from(itemMap.keys());
    const revenueData = categories.map((c) => Math.round(((itemMap.get(c)?.revenue || 0) / 1_000_000_000) * 100) / 100);
    const balanceData = categories.map((c) => Math.round(((itemMap.get(c)?.balance || 0) / 1_000_000_000) * 100) / 100);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          let str = `<div style="font-weight:700;margin-bottom:4px;color:#f8fafc">${params[0]?.name}</div>`;
          params.forEach((p) => {
            str += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;color:#cbd5e1">
              <span>${p.marker} ${p.seriesName}:</span>
              <b style="color:${p.color}">${p.value} tỷ VNĐ</b>
            </div>`;
          });
          return str;
        },
      },
      legend: {
        data: ['Doanh số phát sinh', 'Số dư hiện tại'],
        textStyle: { color: '#94a3b8' },
        top: 0,
        right: 10,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '16%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#94a3b8', interval: 0, rotate: categories.length > 6 ? 25 : 0 },
      },
      yAxis: {
        type: 'value',
        name: 'Tỷ VNĐ',
        nameTextStyle: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#94a3b8' },
      },
      series: [
        {
          name: 'Doanh số phát sinh',
          type: 'bar',
          data: revenueData,
          itemStyle: {
            color: '#10b981',
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: 'Số dư hiện tại',
          type: 'bar',
          data: balanceData,
          itemStyle: {
            color: '#0284c7',
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }, [stats]);

  // 2. Prepare Pie / Donut Chart Option
  const pieChartOption = useMemo(() => {
    if (!stats || stats.length === 0) return {};

    const itemMap = new Map<string, number>();
    stats.forEach((g) => {
      g.items.forEach((item) => {
        itemMap.set(item.name, (itemMap.get(item.name) || 0) + item.revenue);
      });
    });

    const pieData = Array.from(itemMap.entries()).map(([name, val]) => ({
      name,
      value: Math.round((val / 1_000_000_000) * 100) / 100,
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          return `<div style="font-weight:700;color:#f8fafc;margin-bottom:4px">${params.name}</div>
            <div style="font-size:12px;color:#cbd5e1">Doanh số: <b>${params.value} tỷ VNĐ</b></div>
            <div style="font-size:12px;color:#38bdf8">Tỷ trọng: <b>${params.percent}%</b></div>`;
        },
      },
      legend: {
        orient: 'vertical',
        right: 20,
        top: 'middle',
        textStyle: { color: '#94a3b8', fontSize: 12 },
      },
      series: [
        {
          name: 'Cơ cấu Doanh số',
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#0b192e',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}: {d}%',
            color: '#cbd5e1',
            fontSize: 11,
          },
          data: pieData,
        },
      ],
    };
  }, [stats]);

  // 3. Prepare Line Trend Option
  const lineChartOption = useMemo(() => {
    if (!stats || stats.length === 0) return {};

    const periods = stats.map((s) => s.periodLabel);
    const revenuePoints = stats.map((s) => Math.round((s.totalRevenue / 1_000_000_000) * 100) / 100);
    const balancePoints = stats.map((s) => Math.round((s.totalBalance / 1_000_000_000) * 100) / 100);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter: (params: any[]) => {
          let str = `<div style="font-weight:700;margin-bottom:4px;color:#f8fafc">${params[0]?.name}</div>`;
          params.forEach((p) => {
            str += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;color:#cbd5e1">
              <span>${p.marker} ${p.seriesName}:</span>
              <b style="color:${p.color}">${p.value} tỷ VNĐ</b>
            </div>`;
          });
          return str;
        },
      },
      legend: {
        data: ['Xu hướng Doanh số', 'Xu hướng Số dư'],
        textStyle: { color: '#94a3b8' },
        top: 0,
        right: 10,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '16%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: periods,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#94a3b8' },
      },
      yAxis: {
        type: 'value',
        name: 'Tỷ VNĐ',
        nameTextStyle: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#94a3b8' },
      },
      series: [
        {
          name: 'Xu hướng Doanh số',
          type: 'line',
          smooth: true,
          data: revenuePoints,
          lineStyle: { width: 3, color: '#10b981' },
          itemStyle: { color: '#10b981' },
          areaStyle: {
            color: 'rgba(16, 185, 129, 0.15)',
          },
        },
        {
          name: 'Xu hướng Số dư',
          type: 'line',
          smooth: true,
          data: balancePoints,
          lineStyle: { width: 3, color: '#0284c7' },
          itemStyle: { color: '#0284c7' },
          areaStyle: {
            color: 'rgba(2, 132, 199, 0.15)',
          },
        },
      ],
    };
  }, [stats]);

  // Export CSV handler
  const handleExportCSV = () => {
    if (!stats || stats.length === 0) {
      alert('Không có dữ liệu để xuất file.');
      return;
    }

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += 'Kỳ thời gian,Nhóm phân loại,Số lượng HĐ,Doanh số (VNĐ),Tỷ trọng Doanh số (%),Số dư (VNĐ),Tỷ trọng Số dư (%)\n';

    stats.forEach((g) => {
      g.items.forEach((item) => {
        const row = [
          `"${g.periodLabel}"`,
          `"${item.name}"`,
          item.contractCount,
          item.revenue,
          item.revenuePercentage,
          item.balance,
          item.balancePercentage,
        ];
        csvContent += row.join(',') + '\n';
      });
      // Group total
      csvContent += `"TỔNG ${g.periodLabel}","--",${g.items.reduce((s, i) => s + i.contractCount, 0)},${g.totalRevenue},100%,${g.totalBalance},100%\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Thong_Ke_${dimension}_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card" style={{ padding: '24px', marginTop: '20px' }}>
      {/* HEADER & VIEW SWITCHER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase' }}>
            Phân Tích Thống Kê Đa Chiều & Chế Độ Xem (Self-Service BI)
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            Lựa chọn linh hoạt chiều gom nhóm, chu kỳ thời gian và chuyển đổi tức thì giữa các dạng trực quan hóa.
          </p>
        </div>

        {/* View Mode Switcher + Export button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              background: '#091424',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #1e3a5f',
            }}
          >
            {[
              { id: 'table', label: '📋 Bảng tổng hợp' },
              { id: 'bar', label: '📊 Biểu đồ Cột' },
              { id: 'pie', label: '🥧 Biểu đồ Tròn' },
              { id: 'line', label: '📈 Biểu đồ Đường' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id as any)}
                style={{
                  background: activeView === v.id ? '#0284c7' : 'transparent',
                  color: activeView === v.id ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '5px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid #059669',
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            📥 Xuất CSV
          </button>
        </div>
      </div>

      {/* ADVANCED FILTER BAR */}
      <div
        style={{
          background: '#0b192e',
          border: '1px solid #1e293b',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '24px',
        }}
      >
        {/* Row 1: Dimension & Period Selection */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
          {/* Dimension Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
              Chiều gom nhóm:
            </span>
            <div style={{ display: 'flex', background: '#07101e', padding: '2px', borderRadius: '6px', border: '1px solid #1e293b' }}>
              {[
                { id: 'product', label: 'Sản phẩm' },
                { id: 'term', label: 'Kỳ hạn' },
                { id: 'branch', label: 'Chi nhánh' },
                { id: 'channel', label: 'Kênh bán' },
                { id: 'sale', label: 'Nhân viên Sale' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDimension(d.id)}
                  style={{
                    background: dimension === d.id ? '#0284c7' : 'transparent',
                    color: dimension === d.id ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Period Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
              Chu kỳ thời gian:
            </span>
            <div style={{ display: 'flex', background: '#07101e', padding: '2px', borderRadius: '6px', border: '1px solid #1e293b' }}>
              {[
                { id: 'day', label: 'Theo Ngày' },
                { id: 'week', label: 'Theo Tuần' },
                { id: 'month', label: 'Theo Tháng' },
                { id: 'quarter', label: 'Theo Quý' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  style={{
                    background: period === p.id ? '#059669' : 'transparent',
                    color: period === p.id ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Secondary Dropdown Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Branch filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Chi nhánh:</label>
            {userBranch ? (
              <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700 }}>{userBranch}</span>
            ) : (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                style={{
                  background: '#07101e',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="">Tất cả chi nhánh</option>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Product group filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Nhóm Sản phẩm:</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              style={{
                background: '#07101e',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '12px',
                outline: 'none',
              }}
            >
              <option value="">Tất cả sản phẩm</option>
              <option value="UPS">Sản phẩm UPS</option>
              <option value="FINRA">Sản phẩm FINRA</option>
              <option value="KHÁC">Khác</option>
            </select>
          </div>

          {/* Date range filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Từ ngày:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                background: '#07101e',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Đến ngày:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                background: '#07101e',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          {/* Reset filter button */}
          <button
            onClick={handleResetFilter}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            ↺ Đặt lại bộ lọc
          </button>
        </div>
      </div>

      {/* CONTENT AREA: RENDER ACTIVE VIEW */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          Đang truy vấn số liệu phân tích...
        </div>
      ) : stats.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          Chưa có dữ liệu thống kê phù hợp với điều kiện lọc hiện tại.
        </div>
      ) : (
        <div>
          {/* VIEW 1: TABLE VIEW */}
          {activeView === 'table' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', background: '#0a1728' }}>
                    <th style={{ padding: '12px 16px' }}>Kỳ thời gian</th>
                    <th style={{ padding: '12px 16px' }}>Nhóm phân loại</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Số lượng HĐ</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Doanh số phát sinh</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Tỷ trọng Doanh số</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Số dư hiện tại</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Tỷ trọng Số dư</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((group) => (
                    <React.Fragment key={group.periodKey}>
                      {/* Period Header Row */}
                      <tr style={{ background: 'rgba(2, 132, 199, 0.12)', borderBottom: '1px solid #1e293b' }}>
                        <td colSpan={2} style={{ padding: '10px 16px', fontWeight: 800, color: '#38bdf8' }}>
                          📅 {group.periodLabel}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#cbd5e1' }}>
                          {group.items.reduce((s, i) => s + i.contractCount, 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: '#34d399' }}>
                          {formatTy(group.totalRevenue)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                          100%
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: '#38bdf8' }}>
                          {formatTy(group.totalBalance)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                          100%
                        </td>
                      </tr>

                      {/* Detail Rows */}
                      {group.items.map((item, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            transition: 'background 0.2s',
                          }}
                        >
                          <td style={{ padding: '8px 16px', color: '#64748b' }}></td>
                          <td style={{ padding: '8px 16px', color: '#f1f5f9', fontWeight: 600 }}>
                            • {item.name}
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', color: '#94a3b8' }}>
                            {item.contractCount.toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>
                            {formatTy(item.revenue)}
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', color: '#34d399', fontWeight: 600 }}>
                            {item.revenuePercentage}%
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', color: '#94a3b8' }}>
                            {formatTy(item.balance)}
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', color: '#38bdf8', fontWeight: 600 }}>
                            {item.balancePercentage}%
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 2: BAR CHART */}
          {activeView === 'bar' && (
            <div style={{ padding: '10px 0' }}>
              <div style={{ marginBottom: '10px', fontSize: '13px', color: '#94a3b8' }}>
                So sánh Doanh số phát sinh và Số dư hiện tại theo từng nhóm phân loại:
              </div>
              <ReactECharts option={barChartOption} style={{ height: '450px', width: '100%' }} />
            </div>
          )}

          {/* VIEW 3: PIE CHART */}
          {activeView === 'pie' && (
            <div style={{ padding: '10px 0' }}>
              <div style={{ marginBottom: '10px', fontSize: '13px', color: '#94a3b8' }}>
                Cơ cấu tỷ trọng Doanh số (%) theo chiều {dimension}:
              </div>
              <ReactECharts option={pieChartOption} style={{ height: '450px', width: '100%' }} />
            </div>
          )}

          {/* VIEW 4: LINE TREND */}
          {activeView === 'line' && (
            <div style={{ padding: '10px 0' }}>
              <div style={{ marginBottom: '10px', fontSize: '13px', color: '#94a3b8' }}>
                Đường biến động xu hướng Doanh số & Số dư qua các kỳ thời gian:
              </div>
              <ReactECharts option={lineChartOption} style={{ height: '450px', width: '100%' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
