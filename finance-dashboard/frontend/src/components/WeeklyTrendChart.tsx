import React from 'react';
import ReactECharts from 'echarts-for-react';
import { WeeklyTrendItem } from '../types';

interface Props {
  data: WeeklyTrendItem[];
}

export const WeeklyTrendChart: React.FC<Props> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '380px' }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>📊</div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', marginBottom: '6px' }}>
          Chưa có dữ liệu xu hướng tuần
        </div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Dữ liệu sẽ hiển thị sau khi import file Excel vào hệ thống.
        </div>
      </div>
    );
  }

  const categories = data.map(d => `${d.weekLabel}\n${d.dateRange}`);
  const revenues = data.map(d => Number((d.revenue / 1_000_000_000).toFixed(1)));
  const balances = data.map(d => Number((d.endBalance / 1_000_000_000).toFixed(1)));

  const maxRev = Math.max(...revenues, 10);
  const minBal = Math.min(...balances, 100);
  const maxBal = Math.max(...balances, 200);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc' },
    },
    legend: {
      data: ['Doanh số (tỷ đồng)', 'Số dư cuối tuần (tỷ đồng)'],
      bottom: 0,
      textStyle: { color: '#94a3b8' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '12%',
      containLabel: true,
    },
    xAxis: [
      {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
    ],
    yAxis: [
      {
        type: 'value',
        name: 'Doanh số (tỷ đồng)',
        min: 0,
        max: Math.ceil(maxRev * 1.2),
        axisLine: { lineStyle: { color: '#64748b' } },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
        axisLabel: { color: '#94a3b8' },
        nameTextStyle: { color: '#94a3b8' },
      },
      {
        type: 'value',
        name: 'Số dư (tỷ đồng)',
        min: Math.floor(minBal * 0.9),
        max: Math.ceil(maxBal * 1.1),
        axisLine: { lineStyle: { color: '#64748b' } },
        splitLine: { show: false },
        axisLabel: { color: '#94a3b8' },
        nameTextStyle: { color: '#94a3b8' },
      },
    ],
    series: [
      {
        name: 'Doanh số (tỷ đồng)',
        type: 'bar',
        barWidth: '40%',
        data: revenues,
        itemStyle: {
          color: '#2563eb',
          borderRadius: [4, 4, 0, 0],
        },
        label: {
          show: true,
          position: 'top',
          color: '#ffffff',
          fontWeight: 'bold',
        },
      },
      {
        name: 'Số dư cuối tuần (tỷ đồng)',
        type: 'line',
        yAxisIndex: 1,
        data: balances,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: '#10b981',
        },
        lineStyle: {
          width: 3,
          color: '#10b981',
        },
        label: {
          show: true,
          position: 'bottom',
          color: '#34d399',
          fontWeight: 'bold',
        },
      },
    ],
  };

  return (
    <div className="card" style={{ padding: '20px', height: '100%' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px', textTransform: 'uppercase' }}>
        Xu hướng doanh số & số dư theo tuần
      </div>
      <ReactECharts option={option} style={{ height: '350px', width: '100%' }} />
    </div>
  );
};
