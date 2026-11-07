import React from 'react';
import ReactECharts from 'echarts-for-react';
import { DimensionStatItem } from '../types';

interface Props {
  data: DimensionStatItem[];
}

export const ProductSection: React.FC<Props> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Chưa có dữ liệu sản phẩm</div>
      </div>
    );
  }

  const displayItems = data;

  // Bar chart options
  const barOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '14%', bottom: '5%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLabel: { color: '#94a3b8' },
    },
    yAxis: {
      type: 'category',
      data: [...displayItems].reverse().map(d => d.name),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    series: [
      {
        name: 'Doanh số (tỷ)',
        type: 'bar',
        barWidth: 16,
        data: [...displayItems].reverse().map(d => Number((d.revenue / 1_000_000_000).toFixed(1))),
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: 'right',
          color: '#ffffff',
          fontWeight: 'bold',
        },
      },
    ],
  };

  // Donut chart options
  const donutColors = ['#2563eb', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
  const donutOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
    legend: {
      bottom: 0,
      textStyle: { color: '#94a3b8', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        name: 'Số dư theo sản phẩm',
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'outside',
          formatter: '{d}%',
          color: '#ffffff',
          fontWeight: 'bold',
        },
        data: displayItems.map((d, idx) => ({
          name: d.name,
          value: d.balance,
          itemStyle: { color: donutColors[idx % donutColors.length] },
        })),
      },
    ],
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px', textTransform: 'uppercase' }}>
          Doanh số theo sản phẩm
        </div>
        <ReactECharts option={barOption} style={{ height: '180px' }} />
      </div>

      <div className="card" style={{ padding: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px', textTransform: 'uppercase' }}>
          Số dư theo sản phẩm
        </div>
        <ReactECharts option={donutOption} style={{ height: '180px' }} />
      </div>
    </div>
  );
};
