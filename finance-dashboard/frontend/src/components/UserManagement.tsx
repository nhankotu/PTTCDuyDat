import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, KeyRound, Lock, Unlock, Trash2, Settings2, Search, X, CheckCircle2, AlertCircle
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { UserAccount, TreeFlatNode } from '../types';

interface Props {
  branches: string[];
}

export const UserManagement: React.FC<Props> = () => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [flatNodes, setFlatNodes] = useState<TreeFlatNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create User modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [scopeType, setScopeType] = useState<string>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Scope Edit modal
  const [scopeEditUser, setScopeEditUser] = useState<UserAccount | null>(null);
  const [editScopeType, setEditScopeType] = useState<string>('ALL');
  const [editSelectedNodeId, setEditSelectedNodeId] = useState<string>('');
  const [scopeModalError, setScopeModalError] = useState<string | null>(null);

  // Change Password modal
  const [passwordUser, setPasswordUser] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Delete Confirm modal
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  useEffect(() => {
    loadUsers();
    loadFlatNodes();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await dashboardApi.getUsers();
      setUsers(list);
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.response?.data?.message || 'Không tải được danh sách người dùng.' });
    } finally {
      setLoading(false);
    }
  };

  const loadFlatNodes = async () => {
    try {
      const nodes = await dashboardApi.getFlatNodes();
      setFlatNodes(nodes);
    } catch {
      // ignore
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.scopeNodeName || '').toLowerCase().includes(q) ||
        (u.branchAccess || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setFormError('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }
    if (password.length < 6) {
      setFormError('Mật khẩu khởi tạo phải có tối thiểu 6 ký tự.');
      return;
    }

    setFormError(null);
    const chosenNode = flatNodes.find((n) => n.id === selectedNodeId && n.scopeType === scopeType);
    const branchAccess = scopeType === 'BRANCH' ? selectedNodeId : undefined;

    try {
      await dashboardApi.createUser({
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        role,
        branchAccess,
        scopeType,
        scopeNodeId: scopeType !== 'ALL' ? selectedNodeId : undefined,
        scopeNodeName: chosenNode?.label,
        scopeNodeRole: chosenNode?.position,
      });

      setBanner({ type: 'success', text: `Đã tạo tài khoản '${username.trim()}' thành công.` });
      setUsername('');
      setPassword('');
      setFullName('');
      setScopeType('ALL');
      setSelectedNodeId('');
      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Không thể tạo tài khoản.');
    }
  };

  const handleOpenScopeModal = (user: UserAccount) => {
    setScopeEditUser(user);
    setEditScopeType(user.scopeType || 'ALL');
    setEditSelectedNodeId(user.scopeNodeId || '');
    setScopeModalError(null);
  };

  const handleSaveScope = async () => {
    if (!scopeEditUser) return;
    const chosenNode = flatNodes.find((n) => n.id === editSelectedNodeId && n.scopeType === editScopeType);

    try {
      await dashboardApi.updateUserScope(scopeEditUser.id, {
        scopeType: editScopeType,
        scopeNodeId: editScopeType !== 'ALL' ? editSelectedNodeId : undefined,
        scopeNodeName: chosenNode?.label,
        scopeNodeRole: chosenNode?.position,
      });

      setBanner({ type: 'success', text: `Đã cập nhật phân quyền cho '${scopeEditUser.username}'.` });
      setScopeEditUser(null);
      loadUsers();
    } catch (err: any) {
      setScopeModalError(err?.response?.data?.message || 'Lỗi khi cập nhật quyền.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    try {
      const res = await dashboardApi.changeUserPassword(passwordUser.id, newPassword);
      setBanner({ type: 'success', text: res.message || `Đã đổi mật khẩu cho '${passwordUser.username}'.` });
      setPasswordUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err?.response?.data?.message || 'Không thể đổi mật khẩu.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    setActionBusyId(user.id);
    setBanner(null);
    try {
      const res = await dashboardApi.toggleUserStatus(user.id);
      setBanner({ type: 'success', text: res.message });
      await loadUsers();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.response?.data?.message || 'Không thể thay đổi trạng thái tài khoản.' });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setActionBusyId(deleteTarget.id);
    try {
      await dashboardApi.deleteUser(deleteTarget.id);
      setBanner({ type: 'success', text: `Đã xóa tài khoản '${deleteTarget.username}'.` });
      setDeleteTarget(null);
      await loadUsers();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.response?.data?.message || 'Lỗi khi xóa tài khoản.' });
    } finally {
      setActionBusyId(null);
    }
  };

  const getFilteredNodes = (type: string) => {
    if (type === 'ALL') return [];
    return flatNodes.filter((n) => n.scopeType === type);
  };

  const renderScopeBadge = (user: UserAccount) => {
    const type = user.scopeType || (user.branchAccess ? 'BRANCH' : 'ALL');
    const nodeName = user.scopeNodeName || user.branchAccess || user.scopeNodeId;

    const styles: Record<string, string> = {
      ALL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      REGION: 'bg-purple-50 text-purple-700 border-purple-200',
      BRANCH: 'bg-blue-50 text-blue-700 border-blue-200',
      DEPARTMENT: 'bg-teal-50 text-teal-700 border-teal-200',
      EMPLOYEE_SUBTREE: 'bg-amber-50 text-amber-800 border-amber-200',
    };

    const label =
      type === 'ALL'
        ? 'Toàn hệ thống'
        : type === 'REGION'
        ? `Miền: ${nodeName}`
        : type === 'BRANCH'
        ? `Chi nhánh: ${nodeName}`
        : type === 'DEPARTMENT'
        ? `Phòng: ${nodeName}`
        : `Cây con: ${nodeName}`;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[type] || styles.EMPLOYEE_SUBTREE}`}>
        {label}
      </span>
    );
  };

  const inputClass =
    'w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">
              Quản Trị Người Dùng & Trạng Thái Tài Khoản
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Tạo tài khoản, phân quyền theo Node cây nhân sự, đổi mật khẩu và khóa/mở khóa truy cập tức thì.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true);
            setFormError(null);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition inline-flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <UserPlus size={15} />
          <span>Tạo tài khoản mới</span>
        </button>
      </div>

      {/* Status Banner */}
      {banner && (
        <div
          role={banner.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs font-medium border ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo username, họ tên, chi nhánh..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Hiển thị <strong>{filteredUsers.length}</strong> / {users.length} tài khoản
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs font-medium">Đang tải danh sách người dùng...</span>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">ID</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Tài khoản</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Vai trò</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Trạng thái</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Phạm vi quyền xem</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-600 uppercase tracking-wider text-[11px]">Ngày tạo</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-600 uppercase tracking-wider text-[11px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      Không tìm thấy tài khoản phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isRootAdmin = u.username.toLowerCase() === 'admin';
                    const active = u.isActive !== false;
                    return (
                      <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors ${!active ? 'bg-rose-50/30' : ''}`}>
                        <td className="px-4 py-3 text-slate-500 font-mono">#{u.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{u.username}</div>
                          <div className="text-[11px] text-slate-500">{u.fullName || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              u.role === 'admin'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {u.role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'NGƯỜI DÙNG'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {active ? 'Hoạt động' : 'Đang khóa'}
                          </span>
                        </td>
                        <td className="px-4 py-3">{renderScopeBadge(u)}</td>
                        <td className="px-4 py-3 text-center text-slate-500">
                          {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenScopeModal(u)}
                              className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                              title="Chỉnh sửa phạm vi phân quyền"
                            >
                              <Settings2 size={13} />
                              <span>Scope</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPasswordUser(u);
                                setNewPassword('');
                                setConfirmPassword('');
                                setPasswordError(null);
                              }}
                              className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                              title="Đổi mật khẩu tài khoản"
                            >
                              <KeyRound size={13} />
                              <span>Mật khẩu</span>
                            </button>

                            {!isRootAdmin && (
                              <>
                                <button
                                  type="button"
                                  disabled={actionBusyId === u.id}
                                  onClick={() => handleToggleStatus(u)}
                                  className={`inline-flex items-center gap-1 border px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                                    active
                                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                                      : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                                  }`}
                                  title={active ? 'Khóa tài khoản ngay lập tức' : 'Mở khóa tài khoản'}
                                >
                                  {active ? <Lock size={13} /> : <Unlock size={13} />}
                                  <span>{active ? 'Khóa' : 'Mở'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(u)}
                                  className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                                  title="Xóa tài khoản"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Tạo tài khoản mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">Tạo Tài Khoản & Cấp Quyền</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tên đăng nhập *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="vd: sale_nguyenvana"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu khởi tạo *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vai trò hệ thống</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'user')} className={inputClass}>
                    <option value="user">Người dùng (User)</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="font-bold text-xs text-blue-700 uppercase tracking-wide">
                  Phân Quyền Phạm Vi Dữ Liệu (Scope)
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">1. Cấp độ phân quyền</label>
                  <select
                    value={scopeType}
                    onChange={(e) => {
                      setScopeType(e.target.value);
                      setSelectedNodeId('');
                    }}
                    className={inputClass}
                  >
                    <option value="ALL">Toàn hệ thống</option>
                    <option value="REGION">Cấp Miền (PTM)</option>
                    <option value="BRANCH">Cấp Chi nhánh (GĐCN)</option>
                    <option value="DEPARTMENT">Cấp Phòng ban (TPKD)</option>
                    <option value="EMPLOYEE_SUBTREE">Cây con của Nhân sự cụ thể</option>
                  </select>
                </div>

                {scopeType !== 'ALL' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">2. Chọn Node mục tiêu</label>
                    <select
                      value={selectedNodeId}
                      onChange={(e) => setSelectedNodeId(e.target.value)}
                      required
                      className={inputClass}
                    >
                      <option value="">-- Chọn Node tương ứng --</option>
                      {getFilteredNodes(scopeType).map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Lưu & Cấp tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Cập nhật Scope */}
      {scopeEditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Cập Nhật Phạm Vi Phân Quyền</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tài khoản: <strong className="text-blue-700">{scopeEditUser.username}</strong> ({scopeEditUser.fullName})
                </p>
              </div>
              <button onClick={() => setScopeEditUser(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {scopeModalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs">
                {scopeModalError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">1. Cấp độ phạm vi</label>
                <select
                  value={editScopeType}
                  onChange={(e) => {
                    setEditScopeType(e.target.value);
                    setEditSelectedNodeId('');
                  }}
                  className={inputClass}
                >
                  <option value="ALL">Toàn hệ thống</option>
                  <option value="REGION">Cấp Miền (PTM)</option>
                  <option value="BRANCH">Cấp Chi nhánh (GĐCN)</option>
                  <option value="DEPARTMENT">Cấp Phòng ban (TPKD)</option>
                  <option value="EMPLOYEE_SUBTREE">Cây con của Nhân sự cụ thể</option>
                </select>
              </div>

              {editScopeType !== 'ALL' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">2. Chọn Node mục tiêu</label>
                  <select
                    value={editSelectedNodeId}
                    onChange={(e) => setEditSelectedNodeId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- Chọn Node tương ứng --</option>
                    {getFilteredNodes(editScopeType).map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setScopeEditUser(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveScope}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Đổi mật khẩu */}
      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Đổi Mật Khẩu Tài Khoản</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tài khoản: <strong className="text-blue-700">{passwordUser.username}</strong> — các phiên cũ sẽ tự đăng xuất.
                </p>
              </div>
              <button onClick={() => setPasswordUser(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {passwordError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPasswordUser(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {passwordSaving ? 'Đang lưu...' : 'Xác nhận đổi mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Xác nhận xóa tài khoản */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200">
            <h3 className="font-extrabold text-slate-900 text-base">Xác nhận xóa tài khoản</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản <strong className="text-rose-700">{deleteTarget.username}</strong> ({deleteTarget.fullName || 'Chưa có tên'})? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={actionBusyId === deleteTarget.id}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                Xóa tài khoản
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
