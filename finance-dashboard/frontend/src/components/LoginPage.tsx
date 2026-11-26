import React, { useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Eye,
  EyeOff,
  Layers,
  Lock,
  ShieldCheck,
  User,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { AuthSession } from '../types';

interface Props {
  onLoginSuccess: (session: AuthSession) => void;
}

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      console.error('Login error:', err);
      const msg =
        err?.response?.data?.message ||
        (err.code === 'ERR_NETWORK' || err.response?.status === 502
          ? 'Không thể kết nối đến máy chủ Backend (Port 8080). Vui lòng kiểm tra lại dịch vụ.'
          : 'Tên đăng nhập hoặc mật khẩu không chính xác.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-[#F5F8FC] antialiased">
      {/* Left Institutional Blue Brand Panel */}
      <div className="lg:col-span-5 bg-gradient-to-br from-[#0F3D7A] via-[#1D4ED8] to-[#2563EB] text-white p-8 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-sky-300/15 blur-3xl pointer-events-none" />

        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white text-[#1D4ED8] flex items-center justify-center font-extrabold text-xl shadow-sm">
              F
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight text-white">Finra</div>
              <div className="text-xs font-medium text-blue-100">Hệ thống Quản trị Tài chính</div>
            </div>
          </div>

          <div className="space-y-3 pt-2 lg:pt-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug text-white">
              Quản trị dữ liệu &amp; phân tích hiệu quả kinh doanh tập trung
            </h1>
            <p className="text-sm text-blue-100 leading-relaxed max-w-md">
              Theo dõi doanh số, dư nợ nguồn vốn, cơ cấu hợp đồng và hiệu suất từng đơn vị theo thời gian thực với phân quyền bảo mật theo cấp bậc.
            </p>
          </div>
        </div>

        <div className="relative hidden lg:grid gap-3.5 pt-10">
          <div className="flex items-start gap-3 rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <BarChart3 size={17} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Báo cáo KPI &amp; Xu hướng tức thì</div>
              <div className="text-[11px] text-blue-100 mt-0.5">
                Phân tách doanh số theo ngày ký và dư nợ chốt tại mốc thời gian.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Layers size={17} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Phân tích đa chiều &amp; Đối soát</div>
              <div className="text-[11px] text-blue-100 mt-0.5">
                Tùy biến lọc sản phẩm, kỳ hạn, kênh bán và kiểm soát hợp đồng ma.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <ShieldCheck size={17} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Phân quyền dữ liệu cấp dòng</div>
              <div className="text-[11px] text-blue-100 mt-0.5">
                Kiểm soát phạm vi xem theo cây nhân sự và chi nhánh trực thuộc.
              </div>
            </div>
          </div>
        </div>

        <div className="relative hidden lg:block text-[11px] text-blue-100/80 pt-6">
          © Finra Financial Reporting · PTTC Duy Đạt
        </div>
      </div>

      {/* Right White Login Form Panel */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-9 shadow-sm">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-[#0F294A] tracking-tight">Đăng nhập hệ thống</h2>
            <p className="text-sm text-slate-500 mt-1">
              Sử dụng tài khoản nội bộ được cấp để truy cập bảng điều khiển.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-medium flex items-start gap-2.5 mb-6"
            >
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-[#0F294A] mb-1.5"
              >
                Tên đăng nhập
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  id="login-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-[#0F294A] text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8] transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#0F294A] mb-1.5"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-[#0F294A] text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#1D4ED8] cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl font-semibold text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <span>Đăng nhập</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
