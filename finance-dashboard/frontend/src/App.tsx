import { useState, useEffect } from 'react';
import { KpiCards } from './components/KpiCards';
import { WeeklyTrendChart } from './components/WeeklyTrendChart';
import { ProductSection } from './components/ProductSection';
import { TermSection } from './components/TermSection';
import { MultiDimensionSection } from './components/MultiDimensionSection';
import { ContractsTable } from './components/ContractsTable';
import { UploadModal } from './components/UploadModal';
import { LoginPage } from './components/LoginPage';
import { UserManagement } from './components/UserManagement';
import { dashboardApi } from './services/api';
import { DashboardKpi, WeeklyTrendItem, DimensionStatItem, UploadBatch, AuthSession } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthSession | null>(() => {
    const saved = localStorage.getItem('finra_user');
    const token = localStorage.getItem('finra_token');
    if (saved && token) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'statistics' | 'contracts' | 'users'>('dashboard');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(undefined);

  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrendItem[]>([]);
  const [products, setProducts] = useState<DimensionStatItem[]>([]);
  const [terms, setTerms] = useState<DimensionStatItem[]>([]);

  // Listen to logout event triggered by API interceptor
  useEffect(() => {
    const handleLogout = () => {
      setCurrentUser(null);
    };
    window.addEventListener('finra_auth_logout', handleLogout);
    return () => window.removeEventListener('finra_auth_logout', handleLogout);
  }, []);

  // When user signs in or changes, adjust branch access
  useEffect(() => {
    if (currentUser?.branchAccess) {
      setSelectedBranch(currentUser.branchAccess);
    } else {
      setSelectedBranch('');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadInitialData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
    }
  }, [selectedBatchId, selectedBranch, currentUser]);

  const loadInitialData = async () => {
    try {
      const [branchList, batchList] = await Promise.all([
        dashboardApi.getBranches().catch(() => [
          'CN Thủ Đô',
          'CN Hoàn Kiếm 1',
          'CN Hoàn Kiếm 2',
          'CN Tây Hồ 1',
          'CN Tây Hồ 2',
          'CN Hồng Hà',
          'CN Long Biên',
        ]),
        dashboardApi.getBatches().catch(() => []),
      ]);
      setBranches(branchList);
      setBatches(batchList);
      if (batchList.length > 0) {
        setSelectedBatchId(batchList[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [kpiRes, trendRes, prodRes, termRes] = await Promise.all([
        dashboardApi.getKpi(selectedBatchId, selectedBranch).catch(() => null),
        dashboardApi.getWeeklyTrend(selectedBatchId, selectedBranch).catch(() => []),
        dashboardApi.getByProduct(selectedBatchId, selectedBranch).catch(() => []),
        dashboardApi.getByTerm(selectedBatchId, selectedBranch).catch(() => []),
      ]);
      setKpi(kpiRes);
      setWeeklyTrend(trendRes);
      setProducts(prodRes);
      setTerms(termRes);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await dashboardApi.logout();
    setCurrentUser(null);
  };

  // If user is not logged in, show login page
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(session) => {
          setCurrentUser(session);
          if (session.branchAccess) {
            setSelectedBranch(session.branchAccess);
          }
        }}
      />
    );
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <header
        style={{
          background: '#0d1d33',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Logo Finra */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                background: 'linear-gradient(135deg, #00b4d8, #0077b6)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                color: '#ffffff',
                fontSize: '16px',
              }}
            >
              F
            </div>
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.5px', color: '#ffffff' }}>
              Finra
            </span>
          </div>

          <div style={{ height: '20px', width: '1px', background: '#334155' }} />

          {/* Title & Branch selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase' }}>
              TỔNG QUAN
            </span>

            {currentUser.branchAccess ? (
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid #0284c7',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {currentUser.branchAccess}
              </span>
            ) : (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                style={{
                  background: '#132238',
                  color: '#38bdf8',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
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

            <span style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginLeft: '4px' }}>
              THÁNG 10
            </span>
          </div>
        </div>

        {/* Right action controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Navigation tabs */}
          <div
            style={{
              display: 'flex',
              background: '#0a192f',
              padding: '3px',
              borderRadius: '6px',
              border: '1px solid #233554',
            }}
          >
            <button
              onClick={() => setActiveTab('dashboard')}
              style={{
                background: activeTab === 'dashboard' ? '#0077b6' : 'transparent',
                color: activeTab === 'dashboard' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              style={{
                background: activeTab === 'statistics' ? '#0077b6' : 'transparent',
                color: activeTab === 'statistics' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Thống kê đa chiều
            </button>
            <button
              onClick={() => setActiveTab('contracts')}
              style={{
                background: activeTab === 'contracts' ? '#0077b6' : 'transparent',
                color: activeTab === 'contracts' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tra cứu Hợp đồng
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                style={{
                  background: activeTab === 'users' ? '#0077b6' : 'transparent',
                  color: activeTab === 'users' ? '#ffffff' : '#fbbf24',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Quản lý Người dùng
              </button>
            )}
          </div>

          {/* Import Button (Admin only) */}
          {isAdmin && (
            <button className="btn-primary" onClick={() => setIsUploadOpen(true)}>
              Import Excel
            </button>
          )}

          {/* User profile & Logout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              paddingLeft: '12px',
              borderLeft: '1px solid #334155',
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                {currentUser.fullName || currentUser.username}
              </div>
              <div style={{ fontSize: '11px', color: isAdmin ? '#fbbf24' : '#38bdf8' }}>
                {isAdmin ? 'Quản trị viên' : `Nhân viên ${currentUser.branchAccess || ''}`}
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Đăng xuất khỏi hệ thống"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ padding: '24px', flex: 1, maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                KẾT QUẢ KINH DOANH {selectedBranch ? `- ${selectedBranch}` : ''}
              </h2>
            </div>

            {/* 6 KPI CARDS */}
            <KpiCards kpi={kpi} />

            {/* CHARTS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '20px', alignItems: 'stretch' }}>
              {/* Left Column: Weekly Trend Combo Chart */}
              <div>
                <WeeklyTrendChart data={weeklyTrend} />
              </div>

              {/* Right Column: Product & Term Charts */}
              <div>
                <ProductSection data={products} />
                <TermSection data={terms} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'statistics' && (
          <MultiDimensionSection
            batchId={selectedBatchId}
            branch={selectedBranch}
            branches={branches}
            userBranch={currentUser?.branchAccess}
          />
        )}

        {activeTab === 'contracts' && (
          <ContractsTable batchId={selectedBatchId} branch={selectedBranch} />
        )}

        {activeTab === 'users' && isAdmin && (
          <UserManagement branches={branches} />
        )}
      </main>

      {/* Upload Modal (Admin only) */}
      {isAdmin && (
        <UploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onSuccess={() => {
            loadInitialData();
            loadDashboardData();
          }}
        />
      )}
    </div>
  );
}
