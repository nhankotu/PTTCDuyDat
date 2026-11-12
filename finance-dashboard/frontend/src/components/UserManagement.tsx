import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../services/api';
import { UserAccount, TreeFlatNode } from '../types';

interface Props {
  branches: string[];
}

export const UserManagement: React.FC<Props> = ({ branches }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [flatNodes, setFlatNodes] = useState<TreeFlatNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

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

    // Resolve node details
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

  // Filter flat nodes by chosen scope type
  const getFilteredNodes = (type: string) => {
    if (type === 'ALL') return [];
    return flatNodes.filter((n) => n.scopeType === type);
  };

  const renderScopeBadge = (user: UserAccount) => {
    const type = user.scopeType || (user.branchAccess ? 'BRANCH' : 'ALL');
    const nodeName = user.scopeNodeName || user.branchAccess || user.scopeNodeId;

    if (type === 'ALL') {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">
          <span>🌐</span>
          <span>Toàn hệ thống (Toàn quốc)</span>
        </span>
      );
    }

    if (type === 'REGION') {
      return (
        <span className="inline-flex items-center gap-1 bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">
          <span>🌐</span>
          <span>Miền: {nodeName}</span>
        </span>
      );
    }

    if (type === 'BRANCH') {
      return (
        <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">
          <span>🏛️</span>
          <span>Chi nhánh: {nodeName}</span>
        </span>
      );
    }

    if (type === 'DEPARTMENT') {
      return (
        <span className="inline-flex items-center gap-1 bg-teal-500/15 text-teal-300 border border-teal-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">
          <span>📑</span>
          <span>Phòng: {nodeName}</span>
        </span>
      );
    }

    // EMPLOYEE_SUBTREE
    return (
      <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">
        <span>👤</span>
        <span>Cây con: {nodeName}</span>
      </span>
    );
  };

  return (
    <div className="bg-[#112240] rounded-2xl shadow-xl border border-[#233554] p-6 space-y-6 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-base font-extrabold text-white uppercase tracking-wide flex items-center space-x-2">
            <span className="p-1 rounded-md bg-amber-500/20 text-amber-400">👥</span>
            <span>Quản Trị Người Dùng & Phân Quyền Theo Node Cây Con</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Admin có thể cấp quyền cho từng tài khoản xem dữ liệu của toàn bộ Node (Toàn quốc, Miền, Chi nhánh, Phòng ban, hoặc Cây con của Chuyên viên/Trưởng phòng).
          </p>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true);
            setFormError(null);
            setFormSuccess(null);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <span>＋</span>
          <span>Tạo tài khoản mới</span>
        </button>
      </div>

      {/* Users List Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs font-medium">Đang tải danh sách người dùng...</span>
        </div>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-xs">
              <thead className="bg-[#0a192f]">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[11px]">ID</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[11px]">Tên Đăng Nhập</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[11px]">Họ Và Tên</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[11px]">Vai Trò</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[11px]">Phạm Vi Quyền Xem (Subtree Scope)</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase tracking-wider text-[11px]">Ngày Tạo</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase tracking-wider text-[11px]">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="bg-[#112240] divide-y divide-white/5">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono">#{u.id}</td>
                    <td className="px-4 py-3 font-bold text-blue-400">{u.username}</td>
                    <td className="px-4 py-3 font-semibold text-white">{u.fullName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                          u.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {u.role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'NGƯỜI DÙNG'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {renderScopeBadge(u)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenScopeModal(u)}
                          className="bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                          title="Chỉnh sửa phạm vi phân quyền theo node"
                        >
                          ⚙️ Phân quyền
                        </button>

                        {u.username.toLowerCase() !== 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            Xóa
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

      {/* Modal Tạo tài khoản mới kèm Phân quyền theo Node */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-[#112240] rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-[#233554] text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-white text-base">
                Tạo Tài Khoản & Cấp Quyền Theo Cây Node
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/20 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs flex items-center space-x-2">
                <span>⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs flex items-center space-x-2">
                <span>✓</span>
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tên đăng nhập (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ví dụ: sale_vudinhtrang"
                    className="w-full text-xs border border-white/15 rounded-xl p-2.5 bg-[#0a192f] text-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mật khẩu khởi tạo *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full text-xs border border-white/15 rounded-xl p-2.5 bg-[#0a192f] text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Họ và tên nhân viên
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="ví dụ: Vũ Đình Thắng"
                    className="w-full text-xs border border-white/15 rounded-xl p-2.5 bg-[#0a192f] text-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Vai trò hệ thống
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full text-xs border border-white/15 rounded-xl p-2.5 bg-[#0a192f] text-white focus:border-blue-500 outline-none"
                  >
                    <option value="user">Người dùng thông thường (User)</option>
                    <option value="admin">Quản trị viên (Admin - Toàn quyền)</option>
                  </select>
                </div>
              </div>

              {/* Scope Selection Box */}
              <div className="bg-[#0a192f] border border-white/15 rounded-xl p-4 space-y-3">
                <div className="font-bold text-xs text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                  <span>🎯</span>
                  <span>Phân Quyền Phạm Vi Dữ Liệu (Scope)</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    1. Cấp độ phân quyền
                  </label>
                  <select
                    value={scopeType}
                    onChange={(e) => {
                      setScopeType(e.target.value);
                      setSelectedNodeId('');
                    }}
                    className="w-full text-xs border border-white/15 rounded-xl p-2.5 bg-[#112240] text-white focus:border-blue-500 outline-none"
                  >
                    <option value="ALL">🌐 Toàn hệ thống (Toàn bộ các Miền & Chi nhánh)</option>
                    <option value="REGION">🌐 Cấp Miền (Phó Tổng Miền - PTM)</option>
                    <option value="BRANCH">🏛️ Cấp Chi nhánh (Giám đốc Chi nhánh - GĐCN)</option>
                    <option value="DEPARTMENT">📑 Cấp Phòng ban (Trưởng phòng KD - TPKD)</option>
                    <option value="EMPLOYEE_SUBTREE">👤 Cây con của Nhân sự cụ thể (Chuyên viên / CTV)</option>
                  </select>
                </div>

                {scopeType !== 'ALL' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      2. Chọn Node cụ thể muốn gán quyền
                    </label>
                    <select
                      value={selectedNodeId}
                      onChange={(e) => setSelectedNodeId(e.target.value)}
                      required
                      className="w-full text-xs border border-white/15 rounded-xl p-2.5 bg-[#112240] text-white focus:border-blue-500 outline-none"
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

                {/* Scope Preview Note */}
                <div className="text-[11px] text-slate-400 bg-white/5 p-2.5 rounded-lg border border-white/5">
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

              <div className="flex justify-end space-x-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/15 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  Lưu & Cấp tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh sửa nhanh Phân Quyền cho User hiện có */}
      {isScopeModalOpen && scopeEditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-[#112240] rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-[#233554] text-slate-100">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-base">
                  Cập Nhật Phân Quyền Theo Node
                </h3>
                <p className="text-xs text-blue-400 mt-0.5">
                  Tài khoản: <b>{scopeEditUser.username}</b> ({scopeEditUser.fullName})
                </p>
              </div>
              <button
                onClick={() => setIsScopeModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {scopeModalError && (
              <div className="bg-rose-500/20 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs">
                ⚠️ {scopeModalError}
              </div>
            )}

            {scopeModalSuccess && (
              <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs">
                ✓ {scopeModalSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  1. Cấp độ phạm vi phân quyền
                </label>
                <select
                  value={editScopeType}
                  onChange={(e) => {
                    setEditScopeType(e.target.value);
                    setEditSelectedNodeId('');
                  }}
                  className="w-full text-xs border border-white/15 rounded-xl p-2.5 bg-[#0a192f] text-white focus:border-blue-500 outline-none"
                >
                  <option value="ALL">🌐 Toàn hệ thống (Toàn bộ các Miền & Chi nhánh)</option>
                  <option value="REGION">🌐 Cấp Miền (Phó Tổng Miền - PTM)</option>
                  <option value="BRANCH">🏛️ Cấp Chi nhánh (Giám đốc Chi nhánh - GĐCN)</option>
                  <option value="DEPARTMENT">📑 Cấp Phòng ban (Trưởng phòng KD - TPKD)</option>
                  <option value="EMPLOYEE_SUBTREE">👤 Cây con của Nhân sự cụ thể (Chuyên viên / CTV)</option>
                </select>
              </div>

              {editScopeType !== 'ALL' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    2. Chọn Node cụ thể muốn gán quyền
                  </label>
                  <select
                    value={editSelectedNodeId}
                    onChange={(e) => setEditSelectedNodeId(e.target.value)}
                    className="w-full text-xs border border-white/15 rounded-xl p-2.5 bg-[#0a192f] text-white focus:border-blue-500 outline-none"
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

            <div className="flex justify-end space-x-2 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsScopeModalOpen(false)}
                className="px-4 py-2 border border-white/15 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveScope}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
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
