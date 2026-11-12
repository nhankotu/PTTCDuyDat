import React, { useState, useEffect, useMemo } from 'react';
import { apiV1 } from '../services/apiV1';
import { OrgTreeNode, ReportView } from '../types/v1';
import { TreeNode } from '../types';

interface Props extends ReportView {
  datasetId?: string;
  onViewNode: (id: string) => void;
  isAdmin?: boolean;
}

export const OrgTreeSection: React.FC<Props> = ({ isAdmin, datasetId, viewEmployeeId, view, onViewNode }) => {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [viewMode, setViewMode] = useState<'pyramid' | 'list'>('pyramid');
  const [zoom, setZoom] = useState<number>(0.95);

  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    setLoading(true);
    try {
      const adapt = (node: OrgTreeNode): TreeNode => {
        const children = node.subordinates.map(adapt);
        return { id: node.employeeId, label: node.fullName, position: node.position,
          department: node.department, branch: node.branch, region: node.region,
          directSubordinatesCount: children.length,
          totalSubordinatesCount: children.reduce((sum, child) => sum + child.totalSubordinatesCount + 1, 0),
          totalRevenue: 0, totalBalance: 0, children };
      };
      const data = (await apiV1.getOrgTree(undefined, { datasetId, viewEmployeeId, view })).map(adapt);
      setTreeData(data);

      // Auto-expand top 2 levels initially
      const initialExpanded = new Set<string>();
      data.forEach(root => {
        initialExpanded.add(root.id);
        root.children?.forEach(child => initialExpanded.add(child.id));
      });
      setExpandedNodes(initialExpanded);
    } catch (err) {
      console.error('Lỗi khi tải cây tổ chức:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
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
      nodes.forEach(n => {
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

  // Statistics calculation
  const stats = useMemo(() => {
    let total = 0;
    let ptm = 0;
    let gdcn = 0;
    let tpkd = 0;
    let cvkd = 0;
    let ctv = 0;

    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
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

  // Color styles per position
  const getBadgeStyle = (pos: string) => {
    const p = (pos || '').toUpperCase();
    if (p.includes('PTM') || p.includes('TGĐ')) {
      return { bg: '#581c87', border: '#a855f7', text: '#e9d5ff', label: 'GĐ Miền (PTM)', accent: '#c084fc' };
    }
    if (p.includes('GĐCN') || p.includes('GDCN')) {
      return { bg: '#1e3a8a', border: '#3b82f6', text: '#bfdbfe', label: 'GĐ Chi nhánh', accent: '#60a5fa' };
    }
    if (p.includes('TPKD') || p.includes('TRƯỞNG PHÒNG')) {
      return { bg: '#064e3b', border: '#10b981', text: '#a7f3d0', label: 'Trưởng phòng KD', accent: '#34d399' };
    }
    if (p.includes('CTV')) {
      return { bg: '#334155', border: '#64748b', text: '#cbd5e1', label: 'Cộng tác viên', accent: '#94a3b8' };
    }
    return { bg: '#78350f', border: '#f59e0b', text: '#fde68a', label: 'Chuyên viên KD', accent: '#fbbf24' };
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
    return (node.children || []).some(child => nodeMatchesSearch(child, term));
  };

  /* -------------------------------------------------------------
   * 1. PYRAMID / ORG CHART NODE COMPONENT
   * ----------------------------------------------------------- */
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

    const filteredChildren = (node.children || []).filter(c =>
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
          padding: '0 12px',
        }}
      >
        {/* The Node Card */}
        <div
          onClick={() => setSelectedNode(node)}
          style={{
            width: '230px',
            background: isMatching ? 'rgba(234, 179, 8, 0.15)' : '#0f172a',
            border: isMatching ? '2px solid #eab308' : `1.5px solid ${badge.border}`,
            borderRadius: '12px',
            padding: '12px 14px',
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
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
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
              }}
            >
              {node.position || 'CVKD'}
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#94a3b8',
                background: 'rgba(255, 255, 255, 0.08)',
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
              color: '#ffffff',
              fontSize: '14px',
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
              color: '#94a3b8',
              marginTop: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={`${node.branch || ''} - ${node.department || ''}`}
          >
            🏛️ {node.branch || node.department || 'Đơn vị kinh doanh'}
          </div>

          {/* Bottom footer: Subordinate count + expand/collapse button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: badge.accent,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              👥 {node.totalSubordinatesCount} cấp dưới
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
                  background: isExpanded ? '#0284c7' : 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                title={isExpanded ? 'Thu gọn nhánh' : 'Mở rộng nhánh'}
              >
                {isExpanded ? '−' : '+'}
              </button>
            )}
          </div>
        </div>

        {/* Vertical trunk line from card to children connector */}
        {hasChildren && isExpanded && filteredChildren.length > 0 && (
          <div
            style={{
              width: '2px',
              height: '28px',
              background: 'rgba(56, 189, 248, 0.5)',
              margin: '0 auto',
            }}
          />
        )}

        {/* Children Row with Branch Lines */}
        {hasChildren && isExpanded && filteredChildren.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              position: 'relative',
              paddingTop: '12px',
            }}
          >
            {/* Horizontal connector line spanning across all children */}
            {filteredChildren.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '0px',
                  left: '115px', // half card width
                  right: '115px',
                  height: '2px',
                  background: 'rgba(56, 189, 248, 0.5)',
                }}
              />
            )}

            {filteredChildren.map((child, index) => (
              <div
                key={child.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                {/* Drop line from horizontal connector down to child node */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-12px',
                    width: '2px',
                    height: '12px',
                    background: 'rgba(56, 189, 248, 0.5)',
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

  /* -------------------------------------------------------------
   * 2. TREE LIST / FOLDER NODE COMPONENT
   * ----------------------------------------------------------- */
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
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isMatching
              ? 'rgba(234, 179, 8, 0.15)'
              : 'rgba(23, 42, 69, 0.7)',
            border: isMatching
              ? '1.5px solid #eab308'
              : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleNode(node.id)}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: isExpanded ? '#0284c7' : 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {isExpanded ? '−' : '+'}
              </button>
            ) : (
              <div style={{ width: '26px', textAlign: 'center', color: '#64748b' }}>•</div>
            )}

            <span
              style={{
                background: badge.bg,
                border: `1px solid ${badge.border}`,
                color: badge.text,
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
              }}
            >
              {node.position || 'CVKD'}
            </span>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setSelectedNode(node)}
                >
                  {node.label}
                </span>
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#94a3b8',
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                  }}
                >
                  {node.id}
                </span>
              </div>
              {(node.branch || node.department) && (
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {node.branch && <span>🏛️ {node.branch}</span>}
                  {node.branch && node.department && <span> • </span>}
                  {node.department && <span>📑 {node.department}</span>}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {hasChildren && (
              <div
                style={{
                  background: 'rgba(14, 165, 233, 0.12)',
                  border: '1px solid rgba(14, 165, 233, 0.3)',
                  color: '#38bdf8',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                👥 {node.directSubordinatesCount} trực tiếp / {node.totalSubordinatesCount} toàn nhánh
              </div>
            )}
            <button
              type="button"
              onClick={() => setSelectedNode(node)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Chi tiết
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div style={{ borderLeft: '2px dashed rgba(255, 255, 255, 0.15)', marginLeft: '12px', paddingLeft: '6px' }}>
            {node.children.map(child => renderListNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header bar */}
      <div
        style={{
          background: '#112240',
          border: '1px solid #233554',
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🌳 Sơ Đồ Cây Phân Cấp Kim Tự Tháp & Cấp Quản Lý</span>
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Phân cấp đa tầng: Ban Giám đốc Miền → Giám đốc Chi nhánh → Trưởng phòng KD → Chuyên viên Sale → Cộng tác viên.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* View Mode Toggle Button */}
            <div
              style={{
                display: 'flex',
                background: '#0a192f',
                border: '1px solid #233554',
                borderRadius: '8px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('pyramid')}
                style={{
                  background: viewMode === 'pyramid' ? '#0284c7' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.2s',
                }}
              >
                <span>🏛️</span>
                <span>Kim tự tháp</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  background: viewMode === 'list' ? '#0284c7' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.2s',
                }}
              >
                <span>📋</span>
                <span>Danh sách</span>
              </button>
            </div>

            {/* Zoom Controls for Pyramid mode */}
            {viewMode === 'pyramid' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#0a192f',
                  border: '1px solid #233554',
                  borderRadius: '8px',
                  padding: '2px 6px',
                  gap: '4px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', padding: '2px 6px' }}
                  title="Thu nhỏ"
                >
                  🔍−
                </button>
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600, minWidth: '35px', textAlign: 'center' }}>
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', padding: '2px 6px' }}
                  title="Phóng to"
                >
                  🔍+
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(0.95)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '10px', cursor: 'pointer', padding: '2px 4px' }}
                  title="Đặt lại"
                >
                  100%
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={expandAll}
              style={{
                background: '#0284c7',
                border: 'none',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ➕ Mở rộng
            </button>
            <button
              type="button"
              onClick={collapseAll}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ➖ Thu gọn
            </button>
            <button
              type="button"
              onClick={loadTree}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔄 Tải lại
            </button>
          </div>
        </div>

        {/* Statistics cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <div style={{ background: '#0a192f', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Tổng nhân sự</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>{stats.total}</div>
          </div>
          <div style={{ background: '#0a192f', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#c084fc', fontWeight: 600, textTransform: 'uppercase' }}>GĐ Miền (PTM)</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#c084fc', marginTop: '2px' }}>{stats.ptm}</div>
          </div>
          <div style={{ background: '#0a192f', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 600, textTransform: 'uppercase' }}>GĐ Chi nhánh</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#60a5fa', marginTop: '2px' }}>{stats.gdcn}</div>
          </div>
          <div style={{ background: '#0a192f', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 600, textTransform: 'uppercase' }}>Trưởng phòng KD</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>{stats.tpkd}</div>
          </div>
          <div style={{ background: '#0a192f', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase' }}>Chuyên viên Sale</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24', marginTop: '2px' }}>{stats.cvkd}</div>
          </div>
          <div style={{ background: '#0a192f', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Cộng tác viên</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#cbd5e1', marginTop: '2px' }}>{stats.ctv}</div>
          </div>
        </div>

        {/* Search bar & Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <input
              type="text"
              placeholder="🔍 Tìm kiếm theo Tên, Mã nhân viên, Phòng ban, Chi nhánh..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: '#0a192f',
                border: '1px solid #233554',
                color: '#ffffff',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '11px' }}>
            <span style={{ color: '#94a3b8' }}>Ký hiệu cấp bậc:</span>
            <span style={{ background: '#581c87', color: '#e9d5ff', padding: '2px 8px', borderRadius: '4px' }}>PTM (Miền)</span>
            <span style={{ background: '#1e3a8a', color: '#bfdbfe', padding: '2px 8px', borderRadius: '4px' }}>GĐCN (Chi nhánh)</span>
            <span style={{ background: '#064e3b', color: '#a7f3d0', padding: '2px 8px', borderRadius: '4px' }}>TPKD (Phòng KD)</span>
            <span style={{ background: '#78350f', color: '#fde68a', padding: '2px 8px', borderRadius: '4px' }}>CVKD (Sale)</span>
            <span style={{ background: '#334155', color: '#cbd5e1', padding: '2px 8px', borderRadius: '4px' }}>CTV</span>
          </div>
        </div>
      </div>

      {/* Main tree view container */}
      <div
        style={{
          background: '#112240',
          border: '1px solid #233554',
          borderRadius: '12px',
          padding: '24px',
          minHeight: '500px',
          overflowX: 'auto',
          overflowY: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔄</div>
            <div>Đang tải sơ đồ cây tổ chức...</div>
          </div>
        ) : treeData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#64748b' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🌳</div>
            <div>Chưa có dữ liệu nhân sự. Vui lòng nạp file Excel nhân sự.</div>
          </div>
        ) : viewMode === 'pyramid' ? (
          /* SƠ ĐỒ KIM TỰ THÁP (ORG CHART) */
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '100%',
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
              padding: '20px 0',
            }}
          >
            <div style={{ display: 'flex', gap: '60px', justifyContent: 'center' }}>
              {treeData.map(rootNode => renderPyramidNode(rootNode))}
            </div>
          </div>
        ) : (
          /* DANH SÁCH THỤT LẦN (TREE LIST) */
          <div>
            {treeData.map(rootNode => renderListNode(rootNode, 0))}
          </div>
        )}
      </div>

      {/* Node detail Modal */}
      {selectedNode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setSelectedNode(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#112240',
              border: '1px solid #233554',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#ffffff', fontSize: '16px', fontWeight: 700 }}>
                Chi Tiết Nhân Sự & Cấp Quản Lý
              </h3>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#64748b' }}>Họ và tên:</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{selectedNode.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#64748b' }}>Mã nhân viên (ID):</span>
                <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>{selectedNode.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#64748b' }}>Chức danh:</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{selectedNode.position}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#64748b' }}>Chi nhánh:</span>
                <span style={{ color: '#ffffff' }}>{selectedNode.branch || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#64748b' }}>Phòng ban:</span>
                <span style={{ color: '#ffffff' }}>{selectedNode.department || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#64748b' }}>Khu vực / Miền:</span>
                <span style={{ color: '#ffffff' }}>{selectedNode.region || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#64748b' }}>Cấp dưới trực tiếp:</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedNode.directSubordinatesCount} nhân sự</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#64748b' }}>Tổng nhân sự toàn cây con:</span>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>{selectedNode.totalSubordinatesCount} nhân sự</span>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => onViewNode(selectedNode.id)} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-sm">Xem thống kê node này</button>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                style={{
                  background: '#0284c7',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
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
