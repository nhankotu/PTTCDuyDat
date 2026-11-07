import React from 'react';
import { DashboardKpi } from '../types';

interface Props {
  kpi?: DashboardKpi | null;
}

export const KpiCards: React.FC<Props> = ({ kpi }) => {
  const formatTy = (amount?: number) => {
    if (amount === undefined || amount === null) return '0.0';
    return (amount / 1_000_000_000).toFixed(1);
  };

  const hasData = (kpi?.totalContracts ?? 0) > 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' }}>
      {/* 1. DOANH SỐ THÁNG */}
      <div className="kpi-card">
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Doanh số tháng 10
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '8px 0 4px 0' }}>
          {formatTy(kpi?.totalRevenue)} <span style={{ fontSize: '18px', fontWeight: 600 }}>tỷ</span>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          UPSC {formatTy(kpi?.revenueUpsc)} | FINRA {formatTy(kpi?.revenueFinra)}
        </div>
      </div>

      {/* 2. SỐ DƯ LŨY KẾ */}
      <div className="kpi-card">
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Số dư lũy kế
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '8px 0 4px 0' }}>
          {formatTy(kpi?.totalBalanceCurrent)} <span style={{ fontSize: '18px', fontWeight: 600 }}>tỷ</span>
        </div>
        <div style={{ fontSize: '11px', color: '#38bdf8' }}>
          {kpi?.totalContracts.toLocaleString() ?? 0} hợp đồng
        </div>
      </div>

      {/* 3. TĂNG NET */}
      <div className="kpi-card">
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Tăng Net
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: (kpi?.netGrowth ?? 0) >= 0 ? '#34d399' : '#f87171', margin: '8px 0 4px 0' }}>
          {(kpi?.netGrowth ?? 0) >= 0 ? '+ ' : ''}{formatTy(kpi?.netGrowth)} <span style={{ fontSize: '18px', fontWeight: 600 }}>tỷ</span>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          So với cuối tháng trước
        </div>
      </div>

      {/* 4. SỐ KHÁCH HÀNG MỚI */}
      <div className="kpi-card">
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Số khách hàng mới
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '8px 0 4px 0' }}>
          {kpi?.newCustomers ?? 0}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          Khách hàng phát sinh mới
        </div>
      </div>

      {/* 5. % HT TM */}
      <div className="kpi-card">
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          % HT TM
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '8px 0 4px 0' }}>
          {hasData ? (kpi?.completionRate ?? 0) : 0}%
        </div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          Chỉ tiêu {formatTy(kpi?.targetAmount)} tỷ
        </div>
      </div>

      {/* 6. % BOOK */}
      <div className="kpi-card">
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          % Book
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '8px 0 4px 0' }}>
          {hasData ? (kpi?.bookRate ?? 0) : 0}%
        </div>
        <div style={{ fontSize: '11px', color: '#34d399' }}>
          {hasData ? 'Đạt tiến độ kế hoạch' : 'Chưa có dữ liệu'}
        </div>
      </div>
    </div>
  );
};
