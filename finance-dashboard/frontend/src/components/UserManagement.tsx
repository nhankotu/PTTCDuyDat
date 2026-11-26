import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Settings,
  Trash2,
  Globe,
  Building2,
  FolderOpen,
  User,
  MapPin,
  X,
  AlertTriangle,
  Check,
  Target,
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states for Create User
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [scopeType, setScopeType] = useState<string>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Quick Scope Edit Modal states
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [scopeEditUser, setScopeEditUser] = useState<UserAccount | null>(null);
  const [editScopeType, setEditScopeType] = useState<string>('ALL');
  const [editSelectedNodeId, setEditSelectedNodeId] = useState<string>('');
  const [scopeModalError, setScopeModalError] = useState<string | null>(null);
  const [scopeModalSuccess, setScopeModalSuccess] = useState<string | null>(null);

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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFlatNodes = async () => {
    try {
      const nodes = await dashboardApi.getFlatNodes();
      setFlatNodes(nodes);
    } catch (err) {
      console.error('Lỗi khi tải danh sách Node cây phân cấp:', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setFormError('Vui lòng nhập tên đăng nhập và mật khẩu.');
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

      setFormSuccess(`Đã tạo tài khoản '${username}' thành công!`);
      setUsername('');
      setPassword('');
      setFullName('');
      setScopeType('ALL');
      setSelectedNodeId('');
      loadUsers();
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
      }, 1200);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Không thể tạo tài khoản.');
    }
  };

  const handleOpenScopeModal = (user: UserAccount) => {
    setScopeEditUser(user);
    setEditScopeType(user.scopeType || 'ALL');
    setEditSelectedNodeId(user.scopeNodeId || '');
    setScopeModalError(null);
    setScopeModalSuccess(null);
    setIsScopeModalOpen(true);
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

      setScopeModalSuccess(`Đã cập nhật phân quyền cho '${scopeEditUser.username}' thành công!`);
      loadUsers();
      setTimeout(() => {
        setIsScopeModalOpen(false);
        setScopeModalSuccess(null);
      }, 1000);
    } catch (err: any) {
      setScopeModalError(err?.response?.data?.message || 'Lỗi khi cập nhật quyền.');
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

  const getFilteredNodes = (type: string) => {
    if (type === 'ALL') return [];
    return flatNodes.filter((n) => n.scopeType === type);
  };

  const renderScopeBadge = (user: UserAccount) => {
    const type = user.scopeType || (user.branchAccess ? 'BRANCH' : 'ALL');
    const nodeName = user.scopeNodeName || user.branchAccess || user.scopeNodeId;

    if (type === 'ALL') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE] px-2.5 py-1 rounded-lg text-xs font-semibold">
          <Globe size={13} />
          <span>Toàn hệ thống</span>
        </span>
      );
    }

    if (type === 'REGION') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD] px-2.5 py-1 rounded-lg text-xs font-semibold">
          <MapPin size={13} />
          <span>Miền: {nodeName}</span>
        </span>
      );
    }

    if (type === 'BRANCH') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE] px-2.5 py-1 rounded-lg text-xs font-semibold">
          <Building2 size={13} />
          <span>Chi nhánh: {nodeName}</span>
        </span>
      );
    }

    if (type === 'DEPARTMENT') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-[#0F294A] border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
          <FolderOpen size={13} />
          <span>Phòng: {nodeName}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
        <User size={13} />
        <span>Cây con: {nodeName}</span>
      </span>
    );
  };

  const inputCls =
    'w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white text-[#0F294A] focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 outline-none';

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0 mt-0.5">
            <Users size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#0F294A]">
              Quản Trị Người Dùng &amp; Phân Quyền Theo Node Cây Con
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cấp quyền từng tài khoản xem dữ liệu theo Toàn quốc, Miền, Chi nhánh, Phòng ban hoặc Cây con nhân sự.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true);
            setFormError(null);
            setFormSuccess(null);
          }}
          className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition inline-flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Tạo tài khoản mới</span>
        </button>
      </div>

      {/* Users List Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-[#1D4ED8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs font-medium">Đang tải danh sách người dùng...</span>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Tên Đăng Nhập</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Họ Và Tên</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Vai Trò</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Phạm Vi Quyền Xem</th>
                  <th className="px-4 py-3 text-center font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Ngày Tạo</th>
                  <th className="px-4 py-3 text-center font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#EFF6FF]/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono tabular-nums">#{u.id}</td>
                    <td className="px-4 py-3 font-bold text-[#1D4ED8]">{u.username}</td>
                    <td className="px-4 py-3 font-semibold text-[#0F294A]">{u.fullName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                          u.role === 'admin'
                            ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {u.role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'NGƯỜI DÙNG'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{renderScopeBadge(u)}</td>
                    <td className="px-4 py-3 text-center text-slate-500 tabular-nums">
                      {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenScopeModal(u)}
                          className="inline-flex items-center gap-1 bg-[#EFF6FF] hover:bg-blue-100 border border-[#DBEAFE] text-[#1D4ED8] px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                          title="Chỉnh sửa phạm vi phân quyền theo node"
                        >
                          <Settings size={12} />
                          <span>Phân quyền</span>
                        </button>

                        {u.username.toLowerCase() !== 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            <Trash2 size={12} />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tạo tài khoản mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#0F294A] text-base">
                Tạo Tài Khoản &amp; Cấp Quyền Theo Cây Node
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label="Đóng"
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F294A] hover:bg-slate-100 cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2">
                <Check size={15} className="text-emerald-600 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F294A] mb-1">
                    Tên đăng nhập (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ví dụ: sale_nguyenvana"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F294A] mb-1">
                    Mật khẩu khởi tạo *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F294A] mb-1">
                    Họ và tên nhân viên
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="ví dụ: Nguyễn Văn A"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F294A] mb-1">
                    Vai trò hệ thống
                  </label>
                  <select value={role} onChange={(e) => setRole(e.target.value as any)} className={inputCls}>
                    <option value="user">Người dùng thông thường (User)</option>
                    <option value="admin">Quản trị viên (Admin - Toàn quyền)</option>
                  </select>
                </div>
              </div>

              {/* Scope Selection Box */}
              <div className="bg-[#F8FAFC] border border-[#DBEAFE] rounded-xl p-4 space-y-3">
                <div className="font-bold text-xs text-[#1D4ED8] uppercase tracking-wide flex items-center gap-1.5">
                  <Target size={14} />
                  <span>Phân Quyền Phạm Vi Dữ Liệu (Scope)</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    1. Cấp độ phân quyền
                  </label>
                  <select
                    value={scopeType}
                    onChange={(e) => {
                      setScopeType(e.target.value);
                      setSelectedNodeId('');
                    }}
                    className={inputCls}
                  >
                    <option value="ALL">Toàn hệ thống (Toàn bộ các Miền &amp; Chi nhánh)</option>
                    <option value="REGION">Cấp Miền (Phó Tổng Miền - PTM)</option>
                    <option value="BRANCH">Cấp Chi nhánh (Giám đốc Chi nhánh - GĐCN)</option>
                    <option value="DEPARTMENT">Cấp Phòng ban (Trưởng phòng KD - TPKD)</option>
                    <option value="EMPLOYEE_SUBTREE">Cây con của Nhân sự cụ thể (Chuyên viên / CTV)</option>
                  </select>
                </div>

                {scopeType !== 'ALL' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      2. Chọn Node cụ thể muốn gán quyền
                    </label>
                    <select
                      value={selectedNodeId}
                      onChange={(e) => setSelectedNodeId(e.target.value)}
                      required
                      className={inputCls}
                    >
                      <option value="">-- Vui lòng chọn Node tương ứng --</option>
                      {getFilteredNodes(scopeType).map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                  {scopeType === 'ALL' && (
                    <span>Tài khoản này sẽ xem được toàn bộ hợp đồng, doanh số và nhân sự trên toàn hệ thống.</span>
                  )}
                  {scopeType === 'REGION' && selectedNodeId && (
                    <span>Tài khoản sẽ xem được tất cả các Chi nhánh, Phòng ban, Sale và CTV thuộc khu vực <b>{selectedNodeId}</b>.</span>
                  )}
                  {scopeType === 'BRANCH' && selectedNodeId && (
                    <span>Tài khoản sẽ xem được toàn bộ các Phòng ban, Sale và CTV thuộc Chi nhánh <b>{selectedNodeId}</b>.</span>
                  )}
                  {scopeType === 'DEPARTMENT' && selectedNodeId && (
                    <span>Tài khoản sẽ xem được Trưởng phòng và toàn bộ các Chuyên viên KD, CTV trong phòng <b>{selectedNodeId}</b>.</span>
                  )}
                  {scopeType === 'EMPLOYEE_SUBTREE' && selectedNodeId && (
                    <span>Tài khoản sẽ xem được doanh số của nhân sự <b>{selectedNodeId}</b> và toàn bộ các cấp dưới trực thuộc trên cây.</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Lưu &amp; Cấp tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh sửa nhanh Phân Quyền */}
      {isScopeModalOpen && scopeEditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-[#0F294A] text-base">Cập Nhật Phân Quyền Theo Node</h3>
                <p className="text-xs text-[#1D4ED8] mt-0.5">
                  Tài khoản: <b>{scopeEditUser.username}</b> ({scopeEditUser.fullName})
                </p>
              </div>
              <button
                onClick={() => setIsScopeModalOpen(false)}
                aria-label="Đóng"
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F294A] hover:bg-slate-100 cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {scopeModalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{scopeModalError}</span>
              </div>
            )}

            {scopeModalSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2">
                <Check size={14} className="shrink-0" />
                <span>{scopeModalSuccess}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F294A] mb-1">
                  1. Cấp độ phạm vi phân quyền
                </label>
                <select
                  value={editScopeType}
                  onChange={(e) => {
                    setEditScopeType(e.target.value);
                    setEditSelectedNodeId('');
                  }}
                  className={inputCls}
                >
                  <option value="ALL">Toàn hệ thống (Toàn bộ các Miền &amp; Chi nhánh)</option>
                  <option value="REGION">Cấp Miền (Phó Tổng Miền - PTM)</option>
                  <option value="BRANCH">Cấp Chi nhánh (Giám đốc Chi nhánh - GĐCN)</option>
                  <option value="DEPARTMENT">Cấp Phòng ban (Trưởng phòng KD - TPKD)</option>
                  <option value="EMPLOYEE_SUBTREE">Cây con của Nhân sự cụ thể (Chuyên viên / CTV)</option>
                </select>
              </div>

              {editScopeType !== 'ALL' && (
                <div>
                  <label className="block text-xs font-semibold text-[#0F294A] mb-1">
                    2. Chọn Node cụ thể muốn gán quyền
                  </label>
                  <select
                    value={editSelectedNodeId}
                    onChange={(e) => setEditSelectedNodeId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">-- Vui lòng chọn Node tương ứng --</option>
                    {getFilteredNodes(editScopeType).map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsScopeModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveScope}
                className="px-4 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
