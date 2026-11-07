import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../services/api';
import { UserAccount } from '../types';

interface Props {
  branches: string[];
}

export const UserManagement: React.FC<Props> = ({ branches }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [branchAccess, setBranchAccess] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await dashboardApi.getUsers();
      setUsers(list);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setFormError('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }

    setFormError(null);
    try {
      await dashboardApi.createUser({
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        role,
        branchAccess: branchAccess || undefined,
      });

      setFormSuccess(`Đã tạo tài khoản '${username}' thành công!`);
      setUsername('');
      setPassword('');
      setFullName('');
      setBranchAccess('');
      loadUsers();
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
      }, 1200);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Không thể tạo tài khoản.');
    }
  };

  const handleDeleteUser = async (id: number, uName: string) => {
    if (uName.toLowerCase() === 'admin') {
      alert('Không thể xóa tài khoản Quản trị viên gốc.');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản '${uName}' không?`)) {
      return;
    }

    try {
      await dashboardApi.deleteUser(id);
      loadUsers();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Lỗi khi xóa tài khoản.');
    }
  };

  return (
    <div className="card" style={{ padding: '24px', marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase' }}>
            Quản trị & Phân quyền Người dùng
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            Chỉ Quản trị viên (Admin) mới có quyền tạo và cấp quyền truy cập chi nhánh cho nhân viên.
          </p>
        </div>

        <button className="btn-primary" onClick={() => { setIsModalOpen(true); setFormError(null); }}>
          + Tạo tài khoản mới
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Đang tải danh sách người dùng...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', background: '#0f1d30' }}>
                <th style={{ padding: '12px 16px' }}>ID</th>
                <th style={{ padding: '12px 16px' }}>Tên đăng nhập</th>
                <th style={{ padding: '12px 16px' }}>Họ và tên</th>
                <th style={{ padding: '12px 16px' }}>Vai trò</th>
                <th style={{ padding: '12px 16px' }}>Phạm vi Chi nhánh</th>
                <th style={{ padding: '12px 16px' }}>Ngày tạo</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>#{u.id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#38bdf8' }}>{u.username}</td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontWeight: 500 }}>{u.fullName}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: u.role === 'admin' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: u.role === 'admin' ? '#38bdf8' : '#34d399',
                      border: `1px solid ${u.role === 'admin' ? '#0284c7' : '#059669'}`,
                    }}>
                      {u.role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'NGƯỜI DÙNG'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                    {u.branchAccess ? (
                      <span style={{ background: '#1e293b', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
                        📍 {u.branchAccess}
                      </span>
                    ) : (
                      <span style={{ color: '#34d399', fontWeight: 600 }}>🌐 Toàn bộ chi nhánh</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {u.username.toLowerCase() !== 'admin' && (
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid #dc2626',
                          color: '#f87171',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tạo tài khoản mới */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{ width: '480px', padding: '28px', background: '#112240', border: '1px solid #233554' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc' }}>
                Tạo Tài khoản & Cấp quyền User
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {formError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', marginBottom: '16px' }}>
                {formError}
              </div>
            )}

            {formSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', color: '#6ee7b7', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', marginBottom: '16px' }}>
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Tên đăng nhập (Username) *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ví dụ: user_hoankiem"
                  style={{ width: '100%', padding: '8px 12px', background: '#0a192f', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Mật khẩu khởi tạo *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  style={{ width: '100%', padding: '8px 12px', background: '#0a192f', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Họ và tên nhân viên
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ví dụ: Nguyễn Văn A"
                  style={{ width: '100%', padding: '8px 12px', background: '#0a192f', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Vai trò
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', background: '#0a192f', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  >
                    <option value="user">Người dùng (User)</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Phân quyền Chi nhánh
                  </label>
                  <select
                    value={branchAccess}
                    onChange={(e) => setBranchAccess(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#0a192f', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  >
                    <option value="">Toàn bộ chi nhánh</option>
                    {branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Lưu & Cấp tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
