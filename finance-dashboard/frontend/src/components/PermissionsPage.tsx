import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  X,
  Users,
  Search,
  Shield,
  Globe,
  Map,
  Building2,
  FolderOpen,
  GitFork,
  Lock,
  Target,
  Zap,
  SlidersHorizontal,
  Save,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { UserAccount, TreeFlatNode, PermissionPreset } from '../types';

export const PermissionsPage: React.FC = () => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [flatNodes, setFlatNodes] = useState<TreeFlatNode[]>([]);
  const [presets, setPresets] = useState<PermissionPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search & Filter users
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [hideAdminUsers, setHideAdminUsers] = useState<boolean>(true);

  const isAdminUser = (u: UserAccount) => u.role === 'admin' || u.username.toLowerCase() === 'admin';

  // Selected user IDs
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // Assignment Mode: 'preset' or 'custom'
  const [assignMode, setAssignMode] = useState<'preset' | 'custom'>('preset');

  // Selected Preset
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  // Custom Scope Configuration
  const [customScopeType, setCustomScopeType] = useState<string>('BRANCH');
  const [nodeSearch, setNodeSearch] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  // Status banners
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Preset Management Modal
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [newPresetScopeType, setNewPresetScopeType] = useState('BRANCH');
  const [newPresetNodeSearch, setNewPresetNodeSearch] = useState('');
  const [newPresetNodeId, setNewPresetNodeId] = useState('');
  const [presetModalError, setPresetModalError] = useState<string | null>(null);

  // Revoke All Safety Modal
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [revokeConfirmInput, setRevokeConfirmInput] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [usersData, nodesData, presetsData] = await Promise.all([
        dashboardApi.getUsers(),
        dashboardApi.getFlatNodes(),
        dashboardApi.getPermissionPresets(),
      ]);
      setUsers(usersData);
      setFlatNodes(nodesData);
      setPresets(presetsData);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu phân quyền:', err);
      setStatusMessage({ type: 'error', text: 'Không thể tải dữ liệu: ' + (err.message || 'Lỗi mạng') });
    } finally {
      setLoading(false);
    }
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = userSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.username.toLowerCase().includes(q) ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.branchAccess && u.branchAccess.toLowerCase().includes(q)) ||
        (u.scopeNodeName && u.scopeNodeName.toLowerCase().includes(q));

      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchScope = scopeFilter === 'ALL' || (u.scopeType || 'ALL') === scopeFilter;
      const matchAdmin = !hideAdminUsers || !isAdminUser(u);

      return matchSearch && matchRole && matchScope && matchAdmin;
    });
  }, [users, userSearch, roleFilter, scopeFilter, hideAdminUsers]);

  // Filtered flat nodes for custom assignment
  const filteredNodes = useMemo(() => {
    return flatNodes.filter((n) => {
      if (customScopeType === 'ALL') return false;
      const matchScope = n.scopeType === customScopeType;
      const q = nodeSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        n.label.toLowerCase().includes(q) ||
        (n.position && n.position.toLowerCase().includes(q)) ||
        (n.branch && n.branch.toLowerCase().includes(q)) ||
        (n.region && n.region.toLowerCase().includes(q));
      return matchScope && matchSearch;
    });
  }, [flatNodes, customScopeType, nodeSearch]);

  // Filtered flat nodes for new preset modal
  const filteredPresetNodes = useMemo(() => {
    return flatNodes.filter((n) => {
      if (newPresetScopeType === 'ALL') return false;
      const matchScope = n.scopeType === newPresetScopeType;
      const q = newPresetNodeSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        n.label.toLowerCase().includes(q) ||
        (n.position && n.position.toLowerCase().includes(q)) ||
        (n.branch && n.branch.toLowerCase().includes(q)) ||
        (n.region && n.region.toLowerCase().includes(q));
      return matchScope && matchSearch;
    });
  }, [flatNodes, newPresetScopeType, newPresetNodeSearch]);

  // Toggle user selection
  const handleToggleUser = (id: number) => {
    const target = users.find((u) => u.id === id);
    if (target && isAdminUser(target)) {
      return; // Protected: Cannot select admin user
    }
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle select all filtered users (excludes admin users)
  const handleToggleSelectAll = () => {
    const assignableIds = filteredUsers.filter((u) => !isAdminUser(u)).map((u) => u.id);
    const allSelected = assignableIds.length > 0 && assignableIds.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !assignableIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedUserIds, ...assignableIds]));
      setSelectedUserIds(merged);
    }
  };

  // Apply Scope or Preset
  const handleApplyPermissions = async () => {
    // Filter out any admin users from selection
    const targetUserIds = selectedUserIds.filter((id) => {
      const u = users.find((x) => x.id === id);
      return u && !isAdminUser(u);
    });

    if (targetUserIds.length === 0) {
      setStatusMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 người dùng thông thường để phân quyền (tài khoản Admin được bảo vệ toàn quyền).' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      if (assignMode === 'preset') {
        const preset = presets.find((p) => p.id === selectedPresetId);
        if (!preset) {
          setStatusMessage({ type: 'error', text: 'Vui lòng chọn một Bộ quyền mẫu hợp lệ.' });
          setSaving(false);
          return;
        }

        await dashboardApi.bulkAssignScope({
          userIds: targetUserIds,
          scopeType: preset.scopeType,
          scopeNodeId: preset.scopeNodeId,
          scopeNodeName: preset.scopeNodeName,
          scopeNodeRole: preset.scopeNodeRole,
        });

        setStatusMessage({
          type: 'success',
          text: `Đã áp dụng thành công bộ quyền "${preset.name}" cho ${targetUserIds.length} người dùng!`,
        });
      } else {
        // Custom Scope
        let nodeName: string | undefined = undefined;
        let nodeRole: string | undefined = undefined;

        if (customScopeType !== 'ALL') {
          const node = flatNodes.find((n) => n.id === selectedNodeId && n.scopeType === customScopeType);
          if (!node) {
            setStatusMessage({ type: 'error', text: 'Vui lòng chọn Node mục tiêu trong cây phân cấp.' });
            setSaving(false);
            return;
          }
          nodeName = node.label;
          nodeRole = node.position;
        }

        await dashboardApi.bulkAssignScope({
          userIds: targetUserIds,
          scopeType: customScopeType,
          scopeNodeId: customScopeType === 'ALL' ? undefined : selectedNodeId,
          scopeNodeName: nodeName,
          scopeNodeRole: nodeRole,
        });

        setStatusMessage({
          type: 'success',
          text: `Đã cập nhật phạm vi truy cập dữ liệu (${customScopeType}) cho ${targetUserIds.length} người dùng!`,
        });
      }

      // Refresh list
      const updatedUsers = await dashboardApi.getUsers();
      setUsers(updatedUsers);
    } catch (err: any) {
      console.error('Lỗi khi phân quyền:', err);
      setStatusMessage({
        type: 'error',
        text: 'Có lỗi xảy ra: ' + (err.response?.data?.message || err.message || 'Lỗi không xác định'),
      });
    } finally {
      setSaving(false);
    }
  };

  // Revoke All Permissions
  const handleRevokeAll = async () => {
    if (revokeConfirmInput.trim() !== 'THU HOI' && revokeConfirmInput.trim() !== 'XAC NHAN') {
      alert('Vui lòng gõ chính xác "THU HOI" hoặc "XAC NHAN" để tiếp tục.');
      return;
    }

    setRevokeLoading(true);
    try {
      const res = await dashboardApi.revokeAllPermissions(revokeConfirmInput.trim());
      setIsRevokeModalOpen(false);
      setRevokeConfirmInput('');
      setStatusMessage({
        type: 'success',
        text: `Đã thu hồi thành công phạm vi dữ liệu của ${res.revokedCount} người dùng!`,
      });
      // Refresh list
      const updatedUsers = await dashboardApi.getUsers();
      setUsers(updatedUsers);
      setSelectedUserIds([]);
    } catch (err: any) {
      alert('Lỗi thu hồi quyền: ' + (err.response?.data?.message || err.message));
    } finally {
      setRevokeLoading(false);
    }
  };

  // Create new preset
  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) {
      setPresetModalError('Vui lòng nhập tên bộ quyền.');
      return;
    }

    setPresetModalError(null);
    let nodeName: string | undefined = undefined;
    let nodeRole: string | undefined = undefined;

    if (newPresetScopeType !== 'ALL') {
      const node = flatNodes.find((n) => n.id === newPresetNodeId && n.scopeType === newPresetScopeType);
      if (!node) {
        setPresetModalError('Vui lòng chọn một Node mục tiêu trong cây phân cấp.');
        return;
      }
      nodeName = node.label;
      nodeRole = node.position;
    }

    try {
      await dashboardApi.createPermissionPreset({
        name: newPresetName.trim(),
        description: newPresetDesc.trim() || undefined,
        scopeType: newPresetScopeType,
        scopeNodeId: newPresetScopeType === 'ALL' ? undefined : newPresetNodeId,
        scopeNodeName: nodeName,
        scopeNodeRole: nodeRole,
      });

      // Reload presets
      const updatedPresets = await dashboardApi.getPermissionPresets();
      setPresets(updatedPresets);

      // Reset form
      setNewPresetName('');
      setNewPresetDesc('');
      setNewPresetNodeId('');
      alert('Tạo bộ quyền mẫu thành công!');
    } catch (err: any) {
      setPresetModalError(err.response?.data?.message || err.message || 'Lỗi khi tạo bộ quyền mẫu');
    }
  };

  // Delete preset
  const handleDeletePreset = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bộ quyền mẫu này?')) return;
    try {
      await dashboardApi.deletePermissionPreset(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
      if (selectedPresetId === id) setSelectedPresetId(null);
    } catch (err: any) {
      alert('Lỗi xóa bộ quyền: ' + (err.response?.data?.message || err.message));
    }
  };

  const getScopeBadge = (scopeType?: string, nodeName?: string) => {
    switch (scopeType) {
      case 'ALL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE]">
            <Globe size={11} /> Toàn Hệ Thống
          </span>
        );
      case 'REGION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
            <Map size={11} /> Vùng: {nodeName || 'Miền'}
          </span>
        );
      case 'BRANCH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]">
            <Building2 size={11} /> Chi nhánh: {nodeName || 'CN'}
          </span>
        );
      case 'DEPARTMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-[#0F294A] border border-slate-200">
            <FolderOpen size={11} /> Phòng ban: {nodeName || 'Phòng'}
          </span>
        );
      case 'EMPLOYEE_SUBTREE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
            <GitFork size={11} /> Cây con: {nodeName || 'Cá nhân'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
            <Lock size={11} /> Chưa phân quyền
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#0F294A] tracking-tight">
              Chuyên Trang Quản Lý Phân Quyền &amp; Phạm Vi Dữ Liệu
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Cấp quyền theo Cụm/Miền, Chi nhánh, Phòng ban, Cây con cá nhân hoặc sử dụng Bộ Quyền Mẫu (Preset).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsPresetModalOpen(true)}
            className="px-3.5 py-2 bg-[#EFF6FF] hover:bg-blue-100 text-[#1D4ED8] border border-[#DBEAFE] rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ClipboardList size={14} />
            <span>Bộ Quyền Mẫu ({presets.length})</span>
          </button>

          <button
            onClick={() => setIsRevokeModalOpen(true)}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <AlertTriangle size={14} />
            <span>Thu Hồi Toàn Bộ Quyền</span>
          </button>

          <button
            onClick={loadAllData}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#1D4ED8]' : ''} />
            <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <XCircle size={16} className="text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            aria-label="Đóng thông báo"
            className="text-slate-400 hover:text-slate-600 ml-4 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 2. Main 2-Column Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: User Selection & Filters (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-[750px]">
          {/* Top filter controls */}
          <div className="p-4 border-b border-slate-100 bg-[#F8FAFC] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F294A] inline-flex items-center gap-1.5">
                <Users size={14} className="text-[#1D4ED8]" /> Danh Sách Tài Khoản ({filteredUsers.length})
              </span>
              <span className="text-[11px] font-semibold text-[#1D4ED8] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#DBEAFE] tabular-nums">
                Đã chọn: {selectedUserIds.length}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm tên tài khoản, họ tên, chi nhánh..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-[#0F294A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
              />
              {userSearch && (
                <button
                  onClick={() => setUserSearch('')}
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Loại tài khoản:</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-[#0F294A] focus:outline-none focus:border-[#1D4ED8]"
                >
                  <option value="ALL">Tất cả vai trò</option>
                  <option value="admin">Quản trị (admin)</option>
                  <option value="user">Người dùng (user)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phạm vi Scope:</label>
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-[#0F294A] focus:outline-none focus:border-[#1D4ED8]"
                >
                  <option value="ALL">Tất cả Scope</option>
                  <option value="REGION">Cụm / Miền (REGION)</option>
                  <option value="BRANCH">Chi nhánh (BRANCH)</option>
                  <option value="DEPARTMENT">Phòng ban (DEPARTMENT)</option>
                  <option value="EMPLOYEE_SUBTREE">Cây con (EMPLOYEE_SUBTREE)</option>
                </select>
              </div>
            </div>

            {/* Admin Auto-hide toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-[#0F294A] bg-[#EFF6FF] px-2.5 py-1 rounded-lg border border-[#DBEAFE]">
                <input
                  type="checkbox"
                  checked={hideAdminUsers}
                  onChange={(e) => setHideAdminUsers(e.target.checked)}
                  className="rounded accent-[#1D4ED8] w-3.5 h-3.5 cursor-pointer"
                />
                <Shield size={13} className="text-[#1D4ED8]" />
                <span>Ẩn tài khoản Quản trị viên (Khuyên dùng)</span>
              </label>

              <span className="text-[11px] text-slate-400 tabular-nums">
                {users.filter(isAdminUser).length} Admin
              </span>
            </div>

            {/* Quick multi-select toolbar */}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={
                    filteredUsers.filter((u) => !isAdminUser(u)).length > 0 &&
                    filteredUsers
                      .filter((u) => !isAdminUser(u))
                      .every((u) => selectedUserIds.includes(u.id))
                  }
                  onChange={handleToggleSelectAll}
                  className="rounded accent-[#1D4ED8] w-4 h-4 cursor-pointer"
                />
                <span>Chọn tất cả ({filteredUsers.filter((u) => !isAdminUser(u)).length})</span>
              </label>

              {selectedUserIds.length > 0 && (
                <button
                  onClick={() => setSelectedUserIds([])}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Bỏ chọn tất cả
                </button>
              )}
            </div>
          </div>

          {/* User scrollable list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Không tìm thấy tài khoản nào phù hợp bộ lọc.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isAdmin = isAdminUser(user);
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => !isAdmin && handleToggleUser(user.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition border ${
                      isAdmin
                        ? 'bg-slate-50/70 border-slate-200/70 cursor-not-allowed opacity-80'
                        : isSelected
                        ? 'bg-[#EFF6FF] border-[#BFDBFE] cursor-pointer'
                        : 'bg-white border-transparent hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={isAdmin}
                      checked={!isAdmin && isSelected}
                      onChange={() => {}}
                      className={`rounded w-4 h-4 accent-[#1D4ED8] ${
                        isAdmin ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    />

                    <div className="w-8 h-8 rounded-full bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center font-bold text-xs text-[#1D4ED8] shrink-0">
                      {user.username.substring(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-[#0F294A] truncate">
                          {user.fullName || user.username}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          @{user.username}
                        </span>
                        {isAdmin && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-0.5">
                            <Shield size={10} /> Admin
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE]">
                            <Globe size={11} /> Toàn Hệ Thống (Không hạn chế)
                          </span>
                        ) : (
                          getScopeBadge(user.scopeType, user.scopeNodeName || user.branchAccess)
                        )}
                        {user.scopeNodeRole && !isAdmin && (
                          <span className="text-[10px] text-slate-500 italic">
                            ({user.scopeNodeRole})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Permission Assignment Workspace (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 flex flex-col h-[750px] overflow-hidden">
          {/* Header & Target Summary */}
          <div className="pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F294A] inline-flex items-center gap-1.5">
                <Target size={15} className="text-[#1D4ED8]" /> Thiết Lập Phạm Vi Quyền Truy Cập
              </span>

              {selectedUserIds.length > 0 && (
                <span className="text-xs font-semibold px-3 py-1 bg-[#1D4ED8] text-white rounded-full tabular-nums">
                  {selectedUserIds.length === 1
                    ? '1 Người Dùng Đã Chọn'
                    : `${selectedUserIds.length} Người Dùng Được Chọn`}
                </span>
              )}
            </div>

            {selectedUserIds.length === 0 ? (
              <div className="bg-[#EFF6FF] border border-[#DBEAFE] text-[#0F294A] rounded-xl p-3 text-xs flex items-center gap-2">
                <ArrowLeft size={15} className="text-[#1D4ED8] shrink-0" />
                <span>Vui lòng tích chọn một hoặc nhiều tài khoản ở cột bên trái để bắt đầu gán quyền.</span>
              </div>
            ) : (
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3 text-xs text-[#0F294A]">
                <span className="font-bold">Đang gán quyền cho: </span>
                <span className="font-semibold text-[#1D4ED8]">
                  {selectedUserIds.length === 1
                    ? users.find((u) => u.id === selectedUserIds[0])?.fullName ||
                      users.find((u) => u.id === selectedUserIds[0])?.username
                    : `${selectedUserIds.length} tài khoản (Hàng loạt)`}
                </span>
              </div>
            )}

            {/* Mode Selector Tabs */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setAssignMode('preset')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  assignMode === 'preset'
                    ? 'bg-[#1D4ED8] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Zap size={14} />
                <span>Theo Bộ Quyền Mẫu (Preset)</span>
              </button>

              <button
                onClick={() => setAssignMode('custom')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  assignMode === 'custom'
                    ? 'bg-[#1D4ED8] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <SlidersHorizontal size={14} />
                <span>Tùy Chỉnh Scope Thủ Công</span>
              </button>
            </div>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* MODE 1: PRESET SELECTION */}
            {assignMode === 'preset' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-600 flex items-center justify-between">
                  <span>Chọn 1 Bộ Quyền Mẫu để áp dụng:</span>
                  <button
                    onClick={() => setIsPresetModalOpen(true)}
                    className="text-[#1D4ED8] hover:underline text-[11px] font-semibold cursor-pointer"
                  >
                    + Tạo mẫu mới
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {presets.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => setSelectedPresetId(preset.id)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer relative ${
                          isSelected
                            ? 'bg-[#EFF6FF] border-[#1D4ED8] ring-2 ring-[#1D4ED8]/15'
                            : 'bg-white border-slate-200 hover:border-[#BFDBFE] hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-xs text-[#0F294A] leading-snug">
                            {preset.name}
                          </div>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center shrink-0">
                              <Check size={12} />
                            </span>
                          )}
                        </div>

                        {preset.description && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                            {preset.description}
                          </p>
                        )}

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                          {getScopeBadge(preset.scopeType, preset.scopeNodeName)}
                          {preset.scopeNodeRole && (
                            <span className="text-[10px] text-slate-400">• {preset.scopeNodeRole}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedPresetId && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    <span className="font-bold">Đã chọn: </span>
                    <span>{presets.find((p) => p.id === selectedPresetId)?.name}</span>
                    <p className="text-[11px] text-emerald-700 mt-1">
                      Khi bấm nút Lưu phía dưới, tất cả người dùng được chọn sẽ được gán phạm vi theo bộ mẫu này.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* MODE 2: CUSTOM SCOPE CONFIGURATION */}
            {assignMode === 'custom' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F294A] uppercase tracking-wider mb-1.5">
                    1. Chọn Cấp Độ Quyền Hạn (Scope Type):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { type: 'ALL', label: 'Toàn Hệ Thống', Icon: Globe, desc: 'Xem tất cả số liệu' },
                      { type: 'REGION', label: 'Cụm / Miền', Icon: Map, desc: 'Xem vùng miền' },
                      { type: 'BRANCH', label: 'Chi Nhánh', Icon: Building2, desc: 'Xem 1 chi nhánh' },
                      { type: 'DEPARTMENT', label: 'Phòng Ban', Icon: FolderOpen, desc: 'Xem phòng ban' },
                      { type: 'EMPLOYEE_SUBTREE', label: 'Cây Con Cá Nhân', Icon: GitFork, desc: 'Nhân viên & cấp dưới' },
                    ].map((item) => {
                      const ScopeIcon = item.Icon;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => {
                            setCustomScopeType(item.type);
                            setSelectedNodeId('');
                          }}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            customScopeType === item.type
                              ? 'bg-[#EFF6FF] border-[#1D4ED8] ring-2 ring-[#1D4ED8]/15'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs text-[#0F294A]">
                            <ScopeIcon size={14} className="text-[#1D4ED8]" />
                            <span>{item.label}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {customScopeType !== 'ALL' && (
                  <div>
                    <label className="block text-xs font-bold text-[#0F294A] uppercase tracking-wider mb-1.5">
                      2. Chọn Node Mục Tiêu Trong Cây Phân Cấp:
                    </label>

                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder={`Lọc theo tên node, chi nhánh, chức vụ (${customScopeType})...`}
                        value={nodeSearch}
                        onChange={(e) => setNodeSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#0F294A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                      {filteredNodes.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          Không có node nào phù hợp cấp độ {customScopeType} hoặc từ khóa tìm kiếm.
                        </div>
                      ) : (
                        filteredNodes.map((node) => {
                          const isNodeSelected = selectedNodeId === node.id;
                          return (
                            <div
                              key={node.id}
                              onClick={() => setSelectedNodeId(node.id)}
                              className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition ${
                                isNodeSelected
                                  ? 'bg-[#EFF6FF] font-bold text-[#1D4ED8]'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div>
                                <div className="font-bold flex items-center gap-1.5">
                                  <span>{node.label}</span>
                                  {node.position && (
                                    <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                      {node.position}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {node.branch ? `Chi nhánh: ${node.branch}` : ''}
                                  {node.region ? ` | Vùng: ${node.region}` : ''}
                                </div>
                              </div>

                              <div className="text-right tabular-nums">
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                  {node.subordinatesCount} cấp dưới
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Execution Bar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {selectedUserIds.length === 0 ? (
                <span>Chưa chọn tài khoản</span>
              ) : (
                <span>
                  Sẽ áp dụng cho <strong className="text-[#1D4ED8] tabular-nums">{selectedUserIds.length}</strong> tài khoản
                </span>
              )}
            </div>

            <button
              onClick={handleApplyPermissions}
              disabled={
                saving ||
                selectedUserIds.length === 0 ||
                (assignMode === 'preset' && !selectedPresetId) ||
                (assignMode === 'custom' && customScopeType !== 'ALL' && !selectedNodeId)
              }
              className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>
                    {selectedUserIds.length > 1
                      ? `Áp Dụng Cho ${selectedUserIds.length} Người Dùng`
                      : 'Lưu Phân Quyền'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Modal Quản Lý Bộ Quyền Mẫu */}
      {isPresetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center">
                  <ClipboardList size={16} />
                </span>
                <h3 className="text-base font-bold text-[#0F294A]">Quản Lý Bộ Quyền Mẫu (Presets)</h3>
              </div>
              <button
                onClick={() => setIsPresetModalOpen(false)}
                aria-label="Đóng"
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F294A] hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-56">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Các Bộ Quyền Hiện Có ({presets.length}):
              </span>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {presets.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between text-xs bg-white hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-[#0F294A]">{p.name}</div>
                      <div className="text-[11px] text-slate-500">{p.description}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        {getScopeBadge(p.scopeType, p.scopeNodeName)}
                        {p.scopeNodeRole && <span className="text-[10px] text-slate-400">({p.scopeNodeRole})</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePreset(p.id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreatePreset} className="pt-3 border-t border-slate-100 space-y-3">
              <span className="text-xs font-bold text-[#0F294A] uppercase tracking-wider block">
                + Thêm Bộ Quyền Mẫu Mới:
              </span>

              {presetModalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {presetModalError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tên bộ quyền (*):</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Giám Đốc Chi Nhánh HN"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-[#0F294A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Cấp độ Scope:</label>
                  <select
                    value={newPresetScopeType}
                    onChange={(e) => {
                      setNewPresetScopeType(e.target.value);
                      setNewPresetNodeId('');
                    }}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-[#0F294A]"
                  >
                    <option value="ALL">Toàn Hệ Thống (ALL)</option>
                    <option value="REGION">Cụm / Miền (REGION)</option>
                    <option value="BRANCH">Chi Nhánh (BRANCH)</option>
                    <option value="DEPARTMENT">Phòng Ban (DEPARTMENT)</option>
                    <option value="EMPLOYEE_SUBTREE">Cây Con (EMPLOYEE_SUBTREE)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Mô tả / Ghi chú:</label>
                <input
                  type="text"
                  placeholder="Ghi chú chi tiết cho bộ quyền..."
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-[#0F294A]"
                />
              </div>

              {newPresetScopeType !== 'ALL' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Chọn Node tương ứng ({newPresetScopeType}):
                  </label>
                  <input
                    type="text"
                    placeholder="Tìm kiếm node..."
                    value={newPresetNodeSearch}
                    onChange={(e) => setNewPresetNodeSearch(e.target.value)}
                    className="w-full px-3 py-1 border border-slate-200 rounded-lg text-xs mb-1.5"
                  />
                  <select
                    value={newPresetNodeId}
                    onChange={(e) => setNewPresetNodeId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-[#0F294A]"
                  >
                    <option value="">-- Chọn Node mục tiêu --</option>
                    {filteredPresetNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label} ({n.position || n.scopeType}) {n.branch ? `- CN: ${n.branch}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPresetModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Tạo Bộ Quyền Mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Thu Hồi Toàn Bộ Quyền */}
      {isRevokeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 pb-3 border-b border-rose-100">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F294A]">Xác Nhận Thu Hồi Toàn Bộ Quyền</h3>
                <p className="text-xs text-rose-600 font-semibold">Hành động nhạy cảm - Cần xác nhận an toàn</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Thao tác này sẽ <strong className="text-rose-600">xóa toàn bộ phạm vi truy cập dữ liệu (Scope)</strong> của tất cả người dùng thông thường trong hệ thống.
            </p>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <Shield size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Cơ chế bảo vệ an toàn:</strong> Tài khoản Quản trị viên (admin) và tài khoản đang đăng nhập của bạn được bảo vệ tuyệt đối và sẽ <strong>KHÔNG</strong> bị thu hồi quyền.
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Để tiếp tục, vui lòng gõ chính xác từ khóa <strong className="text-[#0F294A] font-mono">THU HOI</strong> hoặc <strong className="text-[#0F294A] font-mono">XAC NHAN</strong> vào ô bên dưới:
            </p>

            <div>
              <input
                type="text"
                placeholder="Nhập THU HOI hoặc XAC NHAN"
                value={revokeConfirmInput}
                onChange={(e) => setRevokeConfirmInput(e.target.value)}
                className="w-full px-4 py-2 border-2 border-rose-200 focus:border-rose-500 rounded-xl text-center text-sm font-bold tracking-wider text-[#0F294A] uppercase focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRevokeModalOpen(false);
                  setRevokeConfirmInput('');
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleRevokeAll}
                disabled={
                  revokeLoading ||
                  (revokeConfirmInput.trim() !== 'THU HOI' && revokeConfirmInput.trim() !== 'XAC NHAN')
                }
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5"
              >
                <AlertTriangle size={14} />
                <span>{revokeLoading ? 'Đang thực hiện...' : 'Xác Nhận Thu Hồi'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
