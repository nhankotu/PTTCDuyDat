import React, { useState } from 'react';
import { dashboardApi } from '../services/api';
import { AuthSession } from '../types';

interface Props {
  onLoginSuccess: (session: AuthSession) => void;
}

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const session = await dashboardApi.login(username.trim(), password);
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 30%, #172a46 0%, #0c1829 100%)',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#112240',
        border: '1px solid #233554',
        borderRadius: '12px',
        padding: '36px 32px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #00b4d8, #0077b6)',
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            color: '#ffffff',
            fontSize: '24px',
            marginBottom: '12px',
            boxShadow: '0 4px 15px rgba(0, 180, 216, 0.3)',
          }}>
            F
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.5px' }}>
            Finra Finance
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            Hệ thống Quản trị & Báo cáo Báo cáo Tài chính
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '12px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Tên đăng nhập
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập username (ví dụ: admin)"
              autoComplete="username"
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#0a192f',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#0a192f',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #0077b6, #00b4d8)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(0, 119, 182, 0.4)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
          </button>
        </form>

        {/* Quick login hint */}
        <div style={{
          marginTop: '24px',
          paddingTop: '18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '12px',
          color: '#64748b',
          textAlign: 'center',
        }}>
          <div>Tài khoản quản trị mặc định:</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'admin123')}
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid #0284c7',
                color: '#38bdf8',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              admin / admin123 (Quản trị viên)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('sale_manager', 'password123')}
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #059669',
                color: '#34d399',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              sale_manager (User chi nhánh)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
