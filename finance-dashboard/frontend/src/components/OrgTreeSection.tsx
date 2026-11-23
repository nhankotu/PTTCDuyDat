import React, { useState, useEffect, useMemo } from 'react';
import {
  GitFork, ListTree, Search, ZoomIn, ZoomOut, RotateCcw, Expand, Minimize2, Users, Building2, UserCog, X, CheckCircle2, AlertCircle
} from 'lucide-react';
import { apiV1 } from '../services/apiV1';
import { OrgTreeNode, ReportView } from '../types/v1';
import { TreeNode } from '../types';

interface Props extends ReportView {
  datasetId?: string;
  refreshKey?: number;
  onViewNode: (id: string) => void;
  isAdmin?: boolean;
}

export const OrgTreeSection: React.FC<Props> = ({ isAdmin, datasetId, viewEmployeeId, view, refreshKey, onViewNode }) => {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [viewMode, setViewMode] = useState<'pyramid' | 'list'>('pyramid');
  const [zoom, setZoom] = useState<number>(0.95);

  // Reparent manager state (Admin only)
  const [showReparent, setShowReparent] = useState(false);
  const [newManagerId, setNewManagerId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [reparentReason, setReparentReason] = useState('');
  const [reparentBusy, setReparentBusy] = useState(false);
  const [reparentFeedback, setReparentFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadTree = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const adapt = (node: OrgTreeNode): TreeNode => {
        const children = node.subordinates.map(adapt);
        return {
          id: node.employeeId,
          label: node.fullName,
          position: node.position,
          department: node.department,
          branch: node.branch,
          region: node.region,
          directSubordinatesCount: children.length,
          totalSubordinatesCount: children.reduce((sum, child) => sum + child.totalSubordinatesCount + 1, 0),
          totalRevenue: 0,
          totalBalance: 0,
          children,
        };
      };
      const data = (await apiV1.getOrgTree(undefined, { datasetId, viewEmployeeId, view })).map(adapt);
      setTreeData(data);

      setExpandedNodes((prev) => {
        if (prev.size > 0) return prev;
        const initialExpanded = new Set<string>();
        data.forEach((root) => {
          initialExpanded.add(root.id);
          root.children?.forEach((child) => initialExpanded.add(child.id));
        });
        return initialExpanded;
      });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Không tải được sơ đồ cây tổ chức.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, [datasetId, viewEmployeeId, view, refreshKey]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        allIds.add(n.id);
        if (n.children?.length) collectIds(n.children);
      });
    };
    collectIds(treeData);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => setExpandedNodes(new Set());

  // Flatten all nodes for manager dropdown
  const allFlatEmployees = useMemo(() => {
    const list: Array<{ id: string; label: string; position: string; branch?: string }> = [];
    const seen = new Set<string>();
    const walk = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        if (!seen.has(n.id)) {
          seen.add(n.id);
          list.push({ id: n.id, label: n.label, position: n.position, branch: n.branch });
        }
        if (n.children?.length) walk(n.children);
      });
    };
    walk(treeData);
    return list.sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [treeData]);

  // Statistics calculation
  const stats = useMemo(() => {
    let total = 0, ptm = 0, gdcn = 0, tpkd = 0, cvkd = 0, ctv = 0;
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        total++;
        const pos = (n.position || '').toUpperCase();
        if (pos.includes('PTM') || pos.includes('TGĐ')) ptm++;
        else if (pos.includes('GĐCN') || pos.includes('GDCN')) gdcn++;
        else if (pos.includes('TPKD') || pos.includes('TRƯỞNG PHÒNG')) tpkd++;
        else if (pos.includes('CTV')) ctv++;
        else cvkd++;
        if (n.children?.length) traverse(n.children);
      });
    };
    traverse(treeData);
    return { total, ptm, gdcn, tpkd, cvkd, ctv };
  }, [treeData]);

  const getBadgeStyle = (pos: string) => {
    const p = (pos || '').toUpperCase();
    if (p.includes('PTM') || p.includes('TGĐ')) {
      return { badge: 'bg-purple-100 text-purple-800 border-purple-200', border: 'border-purple-300', accent: 'text-purple-700' };
    }
    if (p.includes('GĐCN') || p.includes('GDCN')) {
      return { badge: 'bg-blue-100 text-blue-800 border-blue-200', border: 'border-blue-300', accent: 'text-blue-700' };
    }
    if (p.includes('TPKD') || p.includes('TRƯỞNG PHÒNG')) {
      return { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', border: 'border-emerald-300', accent: 'text-emerald-700' };
    }
    if (p.includes('CTV')) {
      return { badge: 'bg-slate-100 text-slate-700 border-slate-200', border: 'border-slate-300', accent: 'text-slate-600' };
    }
    return { badge: 'bg-amber-100 text-amber-800 border-amber-200', border: 'border-amber-300', accent: 'text-amber-700' };
  };

  const nodeMatchesSearch = (node: TreeNode, term: string): boolean => {
    if (!term) return true;
    const lower = term.toLowerCase();
    const matchThis =
      node.label.toLowerCase().includes(lower) ||
      node.id.toLowerCase().includes(lower) ||
      (node.department?.toLowerCase().includes(lower) ?? false) ||
      (node.branch?.toLowerCase().includes(lower) ?? false);
    if (matchThis) return true;
    return (node.children || []).some((child) => nodeMatchesSearch(child, term));
  };

  const openNodeModal = (node: TreeNode) => {
    setSelectedNode(node);
    setShowReparent(false);
    setNewManagerId('');
    setReparentReason('');
    setReparentFeedback(null);
  };

  const handleReparentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !newManagerId || !reparentReason.trim()) {
      setReparentFeedback({ type: 'error', text: 'Vui lòng chọn quản lý mới và nhập lý do điều chuyển.' });
      return;
    }
    setReparentBusy(true);
    setReparentFeedback(null);
    try {
      await apiV1.reparentManager(selectedNode.id, {
        newManagerEmployeeId: newManagerId,
        effectiveDate,
        reason: reparentReason.trim(),
      });
      setReparentFeedback({ type: 'success', text: `Đã cập nhật quản lý mới cho ${selectedNode.label}.` });
      setShowReparent(false);
      await loadTree();
    } catch (err: any) {
      setReparentFeedback({
        type: 'error',
        text: err?.response?.data?.message || 'Không thể cập nhật quản lý trực tiếp.',
      });
    } finally {
      setReparentBusy(false);
    }
  };

  const renderPyramidNode = (node: TreeNode): React.ReactNode => {
    if (searchTerm && !nodeMatchesSearch(node, searchTerm)) return null;

    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const style = getBadgeStyle(node.position);
    const isMatching =
      searchTerm &&
      (node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.id.toLowerCase().includes(searchTerm.toLowerCase()));

    const filteredChildren = (node.children || []).filter((c) =>
      searchTerm ? nodeMatchesSearch(c, searchTerm) : true
    );

    return (
      <div key={node.id} className="flex flex-col items-center relative px-3">
        <div
          onClick={() => openNodeModal(node)}
          className={`w-[230px] rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer relative z-10 border-2 ${
            isMatching ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/50' : `bg-white ${style.border}`
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${style.badge}`}>
              {node.position || 'CVKD'}
            </span>
            <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              #{node.id}
            </span>
          </div>

          <div className="text-sm font-bold text-slate-900 truncate" title={node.label}>
            {node.label}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1 truncate" title={`${node.branch || ''} - ${node.department || ''}`}>
            <Building2 size={11} className="shrink-0" />
            <span className="truncate">{node.branch || node.department || 'Đơn vị kinh doanh'}</span>
          </div>

          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
            <span className={`text-[11px] font-semibold inline-flex items-center gap-1 ${style.accent}`}>
              <Users size={12} />
              {node.totalSubordinatesCount} cấp dưới
            </span>

            {hasChildren && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node.id);
                }}
                className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center cursor-pointer transition ${
                  isExpanded
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title={isExpanded ? 'Thu gọn nhánh' : 'Mở rộng nhánh'}
              >
                {isExpanded ? '−' : '+'}
              </button>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && filteredChildren.length > 0 && (
          <div className="w-0.5 h-7 bg-slate-300 mx-auto" />
        )}

        {hasChildren && isExpanded && filteredChildren.length > 0 && (
          <div className="flex justify-center relative pt-3">
            {filteredChildren.length > 1 && (
              <div className="absolute top-0 left-[115px] right-[115px] h-0.5 bg-slate-300" />
            )}

            {filteredChildren.map((child) => (
              <div key={child.id} className="flex flex-col items-center relative">
                <div className="absolute -top-3 w-0.5 h-3 bg-slate-300" />
                {renderPyramidNode(child)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderListNode = (node: TreeNode, depth = 0) => {
    if (searchTerm && !nodeMatchesSearch(node, searchTerm)) return null;

    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const style = getBadgeStyle(node.position);
    const isMatching =
      searchTerm &&
      (node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.id.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
      <div key={node.id} style={{ marginLeft: depth > 0 ? '24px' : '0px' }} className="mt-2">
        <div
          onClick={() => openNodeModal(node)}
          className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border cursor-pointer transition ${
            isMatching ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node.id);
                }}
                className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer shrink-0"
              >
                {isExpanded ? '−' : '+'}
              </button>
            ) : (
              <span className="w-6 h-6 inline-block shrink-0" />
            )}
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border shrink-0 ${style.badge}`}>
              {node.position || 'CVKD'}
            </span>
            <span className="font-bold text-sm text-slate-900 truncate">{node.label}</span>
            <span className="font-mono text-xs text-slate-500">#{node.id}</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{node.branch || node.department || '—'}</span>
            <span className={`font-semibold ${style.accent}`}>{node.totalSubordinatesCount} cấp dưới</span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l-2 border-slate-200 ml-3 pl-1">
            {node.children.map((child) => renderListNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header & Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
              <GitFork size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">
                Sơ Đồ Cây Tổ Chức Nhân Sự
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Bấm vào từng nhân sự để xem thông tin chi tiết, xem báo cáo nhánh hoặc điều chuyển cấp quản lý.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('pyramid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                  viewMode === 'pyramid' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GitFork size={13} /> Sơ đồ nhánh
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                  viewMode === 'list' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListTree size={13} /> Danh sách cây
              </button>
            </div>

            {viewMode === 'pyramid' && (
              <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl px-2 py-1 text-xs">
                <button type="button" onClick={() => setZoom((z) => Math.max(0.45, +(z - 0.1).toFixed(2)))} className="p-1 hover:bg-white rounded cursor-pointer" title="Thu nhỏ">
                  <ZoomOut size={14} />
                </button>
                <span className="font-mono font-bold text-slate-700 w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} className="p-1 hover:bg-white rounded cursor-pointer" title="Phóng to">
                  <ZoomIn size={14} />
                </button>
                <button type="button" onClick={() => setZoom(0.95)} className="p-1 hover:bg-white rounded cursor-pointer" title="Mặc định">
                  <RotateCcw size={13} />
                </button>
              </div>
            )}

            <button type="button" onClick={expandAll} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
              <Expand size={13} /> Mở tất cả
            </button>
            <button type="button" onClick={collapseAll} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
              <Minimize2 size={13} /> Thu gọn
            </button>
          </div>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {[
            { label: 'Tổng nhân sự', value: stats.total, color: 'bg-slate-50 border-slate-200 text-slate-900' },
            { label: 'GĐ Miền (PTM)', value: stats.ptm, color: 'bg-purple-50 border-purple-200 text-purple-900' },
            { label: 'GĐ Chi nhánh', value: stats.gdcn, color: 'bg-blue-50 border-blue-200 text-blue-900' },
            { label: 'Trưởng phòng', value: stats.tpkd, color: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
            { label: 'Chuyên viên KD', value: stats.cvkd, color: 'bg-amber-50 border-amber-200 text-amber-900' },
            { label: 'Cộng tác viên', value: stats.ctv, color: 'bg-slate-100 border-slate-200 text-slate-800' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border px-3 py-2 ${s.color}`}>
              <div className="text-[11px] font-semibold opacity-80">{s.label}</div>
              <div className="text-lg font-black">{s.value.toLocaleString('vi-VN')}</div>
            </div>
          ))}
        </div>

        {/* Search & Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm nhân sự theo tên, mã NV, chi nhánh, phòng ban..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="text-slate-500">Cấp bậc:</span>
            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded">PTM (Miền)</span>
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">GĐCN</span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">TPKD</span>
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded">CVKD</span>
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">CTV</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* Main tree container */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-6 min-h-[480px] overflow-auto shadow-inner">
        {loading ? (
          <div className="py-20 text-center text-slate-500">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <div className="text-xs font-medium">Đang tải sơ đồ cây tổ chức...</div>
          </div>
        ) : treeData.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-sm">
            Chưa có dữ liệu nhân sự. Vui lòng nạp file Excel nhân sự.
          </div>
        ) : viewMode === 'pyramid' ? (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            className="inline-flex flex-col items-center min-w-full transition-transform duration-150 py-4"
          >
            <div className="flex gap-14 justify-center">
              {treeData.map((rootNode) => renderPyramidNode(rootNode))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {treeData.map((rootNode) => renderListNode(rootNode, 0))}
          </div>
        )}
      </div>

      {/* Node detail modal */}
      {selectedNode && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedNode(null)}
        >
          <div
            className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Chi Tiết Nhân Sự & Cấp Quản Lý</h3>
              <button type="button" onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {reparentFeedback && (
              <div
                className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium border ${
                  reparentFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {reparentFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{reparentFeedback.text}</span>
              </div>
            )}

            <dl className="divide-y divide-slate-100 text-xs sm:text-sm">
              {[
                ['Họ và tên', selectedNode.label],
                ['Mã nhân viên', `#${selectedNode.id}`],
                ['Chức danh', selectedNode.position || '—'],
                ['Chi nhánh', selectedNode.branch || '—'],
                ['Phòng ban', selectedNode.department || '—'],
                ['Khu vực / Miền', selectedNode.region || '—'],
                ['Cấp dưới trực tiếp', `${selectedNode.directSubordinatesCount} nhân sự`],
                ['Tổng nhân sự cây con', `${selectedNode.totalSubordinatesCount} nhân sự`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5 gap-4">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-semibold text-slate-900 text-right">{v}</dd>
                </div>
              ))}
            </dl>

            {/* Admin Reparent Manager Form */}
            {isAdmin && showReparent && (
              <form onSubmit={handleReparentSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <UserCog size={14} className="text-blue-600" />
                  <span>Điều chuyển quản lý trực tiếp</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quản lý trực tiếp mới *</label>
                  <select
                    required
                    value={newManagerId}
                    onChange={(e) => setNewManagerId(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                  >
                    <option value="">-- Chọn nhân sự quản lý mới --</option>
                    {allFlatEmployees
                      .filter((emp) => emp.id !== selectedNode.id)
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.label} [{emp.position}] (#{emp.id})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày hiệu lực *</label>
                    <input
                      type="date"
                      required
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lý do điều chuyển *</label>
                    <input
                      type="text"
                      required
                      value={reparentReason}
                      onChange={(e) => setReparentReason(e.target.value)}
                      placeholder="vd: Điều chuyển phòng KD"
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowReparent(false)}
                    className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-700 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={reparentBusy}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
                  >
                    {reparentBusy ? 'Đang lưu...' : 'Lưu điều chuyển'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200">
              {isAdmin && !showReparent && (
                <button
                  type="button"
                  onClick={() => setShowReparent(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-xs cursor-pointer"
                >
                  <UserCog size={14} /> Đổi quản lý
                </button>
              )}
              <button
                type="button"
                onClick={() => onViewNode(selectedNode.id)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
              >
                Xem thống kê node này
              </button>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
