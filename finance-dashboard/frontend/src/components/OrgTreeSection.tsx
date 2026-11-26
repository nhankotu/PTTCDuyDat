import React, { useState, useEffect, useMemo } from 'react';
import {
  GitFork,
  Building2,
  Users,
  Search,
  ZoomIn,
  ZoomOut,
  Plus,
  Minus,
  RefreshCw,
  ListTree,
  Network,
  X,
  FolderOpen,
} from 'lucide-react';
import { apiV1 } from '../services/apiV1';
import { OrgTreeNode, ReportView } from '../types/v1';
import { TreeNode } from '../types';

interface Props extends ReportView {
  datasetId?: string;
  asOfDate?: string;
  refreshKey?: number;
  onViewNode: (id: string) => void;
  isAdmin?: boolean;
}

export const OrgTreeSection: React.FC<Props> = ({
  datasetId,
  asOfDate,
  refreshKey,
  viewEmployeeId,
  view,
  onViewNode,
}) => {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [viewMode, setViewMode] = useState<'pyramid' | 'list'>('pyramid');
  const [zoom, setZoom] = useState<number>(0.95);

  useEffect(() => {
    loadTree();
  }, [datasetId, asOfDate, viewEmployeeId, view, refreshKey]);

  const loadTree = async () => {
    setLoading(true);
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
      const data = (await apiV1.getOrgTree(asOfDate, { datasetId, viewEmployeeId, view })).map(adapt);
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
    } catch (err) {
      console.error('Lỗi khi tải cây tổ chức:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        allIds.add(n.id);
        if (n.children && n.children.length > 0) {
          collectIds(n.children);
        }
      });
    };
    collectIds(treeData);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const stats = useMemo(() => {
    let total = 0;
    let ptm = 0;
    let gdcn = 0;
    let tpkd = 0;
    let cvkd = 0;
    let ctv = 0;

    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        total++;
        const pos = (n.position || '').toUpperCase();
        if (pos.includes('PTM') || pos.includes('TGĐ')) ptm++;
        else if (pos.includes('GĐCN') || pos.includes('GDCN')) gdcn++;
        else if (pos.includes('TPKD') || pos.includes('TRƯỞNG PHÒNG')) tpkd++;
        else if (pos.includes('CVKD') || pos.includes('SALE')) cvkd++;
        else if (pos.includes('CTV')) ctv++;
        else cvkd++;

        if (n.children && n.children.length > 0) {
          traverse(n.children);
        }
      });
    };
    traverse(treeData);

    return { total, ptm, gdcn, tpkd, cvkd, ctv };
  }, [treeData]);

  // Disciplined Blue & Slate Hierarchy Styles per Position
  const getBadgeStyle = (pos: string) => {
    const p = (pos || '').toUpperCase();
    if (p.includes('PTM') || p.includes('TGĐ')) {
      return {
        bg: '#1E3A8A',
        border: '#1D4ED8',
        text: '#FFFFFF',
        cardBorder: '#93C5FD',
        accent: '#1E3A8A',
      };
    }
    if (p.includes('GĐCN') || p.includes('GDCN')) {
      return {
        bg: '#DBEAFE',
        border: '#93C5FD',
        text: '#1E40AF',
        cardBorder: '#BFDBFE',
        accent: '#1D4ED8',
      };
    }
    if (p.includes('TPKD') || p.includes('TRƯỞNG PHÒNG')) {
      return {
        bg: '#E0F2FE',
        border: '#BAE6FD',
        text: '#0369A1',
        cardBorder: '#BAE6FD',
        accent: '#0284C7',
      };
    }
    if (p.includes('CTV')) {
      return {
        bg: '#F8FAFC',
        border: '#CBD5E1',
        text: '#475569',
        cardBorder: '#CBD5E1',
        accent: '#64748B',
      };
    }
    return {
      bg: '#F1F5F9',
      border: '#CBD5E1',
      text: '#0F294A',
      cardBorder: '#E2E8F0',
      accent: '#334155',
    };
  };

  const nodeMatchesSearch = (node: TreeNode, term: string): boolean => {
    if (!term) return true;
    const lower = term.toLowerCase();
    const matchThis =
      node.label.toLowerCase().includes(lower) ||
      node.id.toLowerCase().includes(lower) ||
      (node.department && node.department.toLowerCase().includes(lower)) ||
      (node.branch && node.branch.toLowerCase().includes(lower));

    if (matchThis) return true;
    return (node.children || []).some((child) => nodeMatchesSearch(child, term));
  };

  /* 1. PYRAMID / ORG CHART NODE */
  const renderPyramidNode = (node: TreeNode): React.ReactNode => {
    if (searchTerm && !nodeMatchesSearch(node, searchTerm)) {
      return null;
    }

    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const badge = getBadgeStyle(node.position);
    const isMatching =
      searchTerm &&
      (node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.id.toLowerCase().includes(searchTerm.toLowerCase()));

    const filteredChildren = (node.children || []).filter((c) =>
      searchTerm ? nodeMatchesSearch(c, searchTerm) : true
    );

    return (
      <div
        key={node.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          padding: '0 10px',
        }}
      >
        {/* Node Card */}
        <div
          onClick={() => setSelectedNode(node)}
          className="hover:shadow-md transition-all"
          style={{
            width: '232px',
            background: isMatching ? '#FEF9C3' : '#FFFFFF',
            border: isMatching ? '2px solid #D97706' : `1.5px solid ${badge.cardBorder}`,
            borderRadius: '12px',
            padding: '12px 14px',
            boxShadow: '0 2px 8px rgba(15, 41, 74, 0.06)',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 10,
          }}
        >
          {/* Top header badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              style={{
                background: badge.bg,
                color: badge.text,
                border: `1px solid ${badge.border}`,
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
              }}
            >
              {node.position || 'CVKD'}
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#64748B',
                background: '#F1F5F9',
                padding: '1px 6px',
                borderRadius: '4px',
              }}
            >
              #{node.id}
            </span>
          </div>

          {/* Name */}
          <div
            style={{
              color: '#0F294A',
              fontSize: '13.5px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={node.label}
          >
            {node.label}
          </div>

          {/* Branch / Dept */}
          <div
            style={{
              fontSize: '11px',
              color: '#64748B',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={`${node.branch || ''} - ${node.department || ''}`}
          >
            <Building2 size={12} style={{ flexShrink: 0, color: '#94A3B8' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {node.branch || node.department || 'Đơn vị kinh doanh'}
            </span>
          </div>

          {/* Bottom footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid #F1F5F9',
            }}
          >
            <span
              className="tabular-nums"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: badge.accent,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Users size={12} />
              <span>{node.totalSubordinatesCount} cấp dưới</span>
            </span>

            {hasChildren && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node.id);
                }}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: isExpanded ? '#1D4ED8' : '#EFF6FF',
                  color: isExpanded ? '#FFFFFF' : '#1D4ED8',
                  border: isExpanded ? 'none' : '1px solid #DBEAFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                title={isExpanded ? 'Thu gọn nhánh' : 'Mở rộng nhánh'}
              >
                {isExpanded ? <Minus size={13} /> : <Plus size={13} />}
              </button>
            )}
          </div>
        </div>

        {/* Vertical trunk line */}
        {hasChildren && isExpanded && filteredChildren.length > 0 && (
          <div
            style={{
              width: '2px',
              height: '26px',
              background: '#93C5FD',
              margin: '0 auto',
            }}
          />
        )}

        {/* Children Row */}
        {hasChildren && isExpanded && filteredChildren.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              position: 'relative',
              paddingTop: '12px',
            }}
          >
            {filteredChildren.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '0px',
                  left: '116px',
                  right: '116px',
                  height: '2px',
                  background: '#93C5FD',
                }}
              />
            )}

            {filteredChildren.map((child) => (
              <div
                key={child.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-12px',
                    width: '2px',
                    height: '12px',
                    background: '#93C5FD',
                  }}
                />
                {renderPyramidNode(child)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* 2. TREE LIST NODE */
  const renderListNode = (node: TreeNode, depth: number = 0) => {
    if (searchTerm && !nodeMatchesSearch(node, searchTerm)) {
      return null;
    }

    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const badge = getBadgeStyle(node.position);
    const isMatching =
      searchTerm &&
      (node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.id.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
      <div key={node.id} style={{ marginLeft: depth > 0 ? '24px' : '0px', marginTop: '8px' }}>
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 transition-colors"
          style={{
            background: isMatching ? '#FEF9C3' : '#FFFFFF',
            border: isMatching ? '1.5px solid #D97706' : '1px solid #E2E8F0',
          }}
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleNode(node.id)}
                className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-colors shrink-0"
                style={{
                  background: isExpanded ? '#1D4ED8' : '#EFF6FF',
                  color: isExpanded ? '#FFFFFF' : '#1D4ED8',
                  border: isExpanded ? 'none' : '1px solid #DBEAFE',
                }}
              >
                {isExpanded ? <Minus size={13} /> : <Plus size={13} />}
              </button>
            ) : (
              <div className="w-6 text-center text-slate-300 shrink-0">•</div>
            )}

            <span
              className="px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0"
              style={{
                background: badge.bg,
                border: `1px solid ${badge.border}`,
                color: badge.text,
              }}
            >
              {node.position || 'CVKD'}
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedNode(node)}
                  className="text-sm font-semibold text-[#0F294A] hover:text-[#1D4ED8] cursor-pointer text-left truncate"
                >
                  {node.label}
                </button>
                <span className="bg-slate-100 text-slate-500 text-[11px] px-1.5 py-0.5 rounded font-mono">
                  {node.id}
                </span>
              </div>
              {(node.branch || node.department) && (
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                  {node.branch && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 size={11} className="text-slate-400" />
                      {node.branch}
                    </span>
                  )}
                  {node.department && (
                    <span className="inline-flex items-center gap-1">
                      <FolderOpen size={11} className="text-slate-400" />
                      {node.department}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasChildren && (
              <span className="inline-flex items-center gap-1 bg-[#EFF6FF] border border-[#DBEAFE] text-[#1D4ED8] px-2.5 py-1 rounded-full text-[11px] font-semibold tabular-nums">
                <Users size={12} />
                {node.directSubordinatesCount} trực tiếp / {node.totalSubordinatesCount} toàn nhánh
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelectedNode(node)}
              className="bg-slate-50 hover:bg-[#EFF6FF] border border-slate-200 hover:border-[#BFDBFE] text-slate-700 hover:text-[#1D4ED8] px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Chi tiết
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div style={{ borderLeft: '2px dashed #BFDBFE', marginLeft: '12px', paddingLeft: '6px' }}>
            {node.children.map((child) => renderListNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls Card */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
              <GitFork size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F294A]">
                Sơ Đồ Cây Phân Cấp &amp; Cấp Quản Lý
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Phân cấp đa tầng: Ban Giám đốc Miền → Giám đốc Chi nhánh → Trưởng phòng KD → Chuyên viên Sale → Cộng tác viên.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('pyramid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  viewMode === 'pyramid' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600 hover:text-[#0F294A]'
                }`}
              >
                <Network size={14} />
                <span>Kim tự tháp</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600 hover:text-[#0F294A]'
                }`}
              >
                <ListTree size={14} />
                <span>Danh sách</span>
              </button>
            </div>

            {viewMode === 'pyramid' && (
              <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-1 gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                  className="p-1 text-slate-500 hover:text-[#1D4ED8] cursor-pointer"
                  title="Thu nhỏ"
                  aria-label="Thu nhỏ"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="text-[11px] font-bold text-[#1D4ED8] min-w-[36px] text-center tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
                  className="p-1 text-slate-500 hover:text-[#1D4ED8] cursor-pointer"
                  title="Phóng to"
                  aria-label="Phóng to"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(0.95)}
                  className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-[#1D4ED8] cursor-pointer"
                  title="Đặt lại tỷ lệ"
                >
                  Reset
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={expandAll}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold cursor-pointer transition"
            >
              <Plus size={13} />
              <span>Mở rộng</span>
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition"
            >
              <Minus size={13} />
              <span>Thu gọn</span>
            </button>
            <button
              type="button"
              onClick={loadTree}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-blue-100 border border-[#DBEAFE] text-[#1D4ED8] text-xs font-semibold cursor-pointer transition"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Tải lại</span>
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { label: 'Tổng nhân sự', value: stats.total, featured: true },
            { label: 'GĐ Miền (PTM)', value: stats.ptm, featured: false },
            { label: 'GĐ Chi nhánh', value: stats.gdcn, featured: false },
            { label: 'Trưởng phòng KD', value: stats.tpkd, featured: false },
            { label: 'Chuyên viên Sale', value: stats.cvkd, featured: false },
            { label: 'Cộng tác viên', value: stats.ctv, featured: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border px-3.5 py-2.5 ${
                item.featured ? 'bg-[#EFF6FF] border-[#BFDBFE]' : 'bg-[#F8FAFC] border-slate-200'
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {item.label}
              </div>
              <div
                className={`text-xl font-extrabold mt-0.5 tabular-nums ${
                  item.featured ? 'text-[#1D4ED8]' : 'text-[#0F294A]'
                }`}
              >
                {item.value.toLocaleString('vi-VN')}
              </div>
            </div>
          ))}
        </div>

        {/* Search bar & Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo Tên, Mã nhân viên, Phòng ban, Chi nhánh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50/70 border border-slate-200 text-[#0F294A] pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-semibold">
            <span className="text-slate-500 mr-1">Cấp bậc:</span>
            <span className="px-2 py-0.5 rounded bg-[#1E3A8A] text-white">PTM (Miền)</span>
            <span className="px-2 py-0.5 rounded bg-[#DBEAFE] text-[#1E40AF] border border-[#93C5FD]">GĐCN</span>
            <span className="px-2 py-0.5 rounded bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">TPKD</span>
            <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#0F294A] border border-[#CBD5E1]">CVKD</span>
            <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-600 border border-slate-200">CTV</span>
          </div>
        </div>
      </div>

      {/* Main Tree Container */}
      <div className="bg-[#F8FAFC] border border-slate-200/90 rounded-xl p-6 min-h-[500px] overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <div className="w-8 h-8 border-3 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Đang tải sơ đồ cây tổ chức...</span>
          </div>
        ) : treeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <GitFork size={32} className="text-slate-300" />
            <span className="text-sm">Chưa có dữ liệu nhân sự. Vui lòng nạp file Excel nhân sự.</span>
          </div>
        ) : viewMode === 'pyramid' ? (
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '100%',
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
              padding: '16px 0',
            }}
          >
            <div style={{ display: 'flex', gap: '48px', justifyContent: 'center' }}>
              {treeData.map((rootNode) => renderPyramidNode(rootNode))}
            </div>
          </div>
        ) : (
          <div>{treeData.map((rootNode) => renderListNode(rootNode, 0))}</div>
        )}
      </div>

      {/* Node Detail Modal */}
      {selectedNode && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setSelectedNode(null)}
        >
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#0F294A]">Chi Tiết Nhân Sự &amp; Cấp Quản Lý</h3>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                aria-label="Đóng"
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F294A] hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs sm:text-sm">
              {[
                ['Họ và tên', selectedNode.label, 'font-semibold text-[#0F294A]'],
                ['Mã nhân viên (ID)', selectedNode.id, 'font-mono font-semibold text-[#1D4ED8]'],
                ['Chức danh', selectedNode.position, 'font-semibold text-[#0F294A]'],
                ['Chi nhánh', selectedNode.branch || '—', 'text-slate-700'],
                ['Phòng ban', selectedNode.department || '—', 'text-slate-700'],
                ['Khu vực / Miền', selectedNode.region || '—', 'text-slate-700'],
                [
                  'Cấp dưới trực tiếp',
                  `${selectedNode.directSubordinatesCount} nhân sự`,
                  'font-semibold text-[#1D4ED8] tabular-nums',
                ],
                [
                  'Tổng nhân sự toàn cây con',
                  `${selectedNode.totalSubordinatesCount} nhân sự`,
                  'font-bold text-[#0284C7] tabular-nums',
                ],
              ].map(([label, val, cls]) => (
                <div key={label} className="flex justify-between items-center py-2.5 gap-4">
                  <span className="text-slate-500">{label}:</span>
                  <span className={cls}>{val}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => onViewNode(selectedNode.id)}
                className="px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-semibold text-xs cursor-pointer transition"
              >
                Xem thống kê node này
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
