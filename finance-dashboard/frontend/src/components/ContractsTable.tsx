import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../services/api';

interface Props {
  batchId?: number;
  branch?: string;
}

export const ContractsTable: React.FC<Props> = ({ batchId, branch }) => {
  const [data, setData] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [productGroup, setProductGroup] = useState('');
  const [termGroup, setTermGroup] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadContracts();
  }, [batchId, branch, page, productGroup, termGroup]);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getContracts({
        batchId,
        branch,
        productGroup: productGroup || undefined,
        termGroup: termGroup || undefined,
        search: search || undefined,
        page,
        pageSize: 20,
      });
      setData(res.data);
      setTotalRows(res.totalRows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadContracts();
  };

  const formatVnd = (val: number) => {
    return (val || 0).toLocaleString('vi-VN') + ' đ';
  };

  return (
    <div className="card" style={{ padding: '20px', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase' }}>
            Tra cứu Danh sách Hợp đồng ({totalRows.toLocaleString()} hợp đồng)
          </h3>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>
            Chi tiết hợp đồng, khách hàng, số dư và trạng thái
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px' }}>
          <select
            value={productGroup}
            onChange={(e) => { setProductGroup(e.target.value); setPage(1); }}
            style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '6px 12px', fontSize: '12px' }}
          >
            <option value="">Tất cả sản phẩm</option>
            <option value="Finra Star">Finra Star</option>
            <option value="Finra Shield">Finra Shield</option>
            <option value="Finra Snap">Finra Snap</option>
            <option value="Finra Safe">Finra Safe</option>
          </select>

          <select
            value={termGroup}
            onChange={(e) => { setTermGroup(e.target.value); setPage(1); }}
            style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '6px 12px', fontSize: '12px' }}
          >
            <option value="">Tất cả kỳ hạn</option>
            <option value="Dưới 1 tháng">Dưới 1 tháng</option>
            <option value="1-3 tháng">1-3 tháng</option>
            <option value="3-6 tháng">3-6 tháng</option>
            <option value="6-12 tháng">6-12 tháng</option>
          </select>

          <input
            type="text"
            placeholder="Tìm theo tên KH, mã KH, số HĐ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', width: '220px' }}
          />

          <button type="submit" className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>
            Tìm kiếm
          </button>
        </form>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', background: '#0f1d30' }}>
              <th style={{ padding: '10px 12px' }}>Số phụ lục HĐ</th>
              <th style={{ padding: '10px 12px' }}>Sản phẩm</th>
              <th style={{ padding: '10px 12px' }}>Khách hàng</th>
              <th style={{ padding: '10px 12px' }}>Kỳ hạn</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Giá trị HĐ</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Số dư hiện tại</th>
              <th style={{ padding: '10px 12px' }}>Sale chốt</th>
              <th style={{ padding: '10px 12px' }}>Chi nhánh</th>
              <th style={{ padding: '10px 12px' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Đang tải...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Không tìm thấy hợp đồng nào.</td></tr>
            ) : (
              data.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#38bdf8' }}>{c.appendixNumber}</td>
                  <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>{c.productGroup}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{c.customerName}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{c.customerCode}</div>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{c.termRaw}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#34d399' }}>{formatVnd(c.contractValue)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>{formatVnd(c.balanceCurrent)}</td>
                  <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{c.finalSaleName || '-'}</td>
                  <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{c.saleBranch}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: c.status === 'Đã duyệt' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                      color: c.status === 'Đã duyệt' ? '#34d399' : '#94a3b8',
                    }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
        <div>
          Trang {page} / {Math.max(1, Math.ceil(totalRows / 20))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            Trước
          </button>
          <button
            className="btn-secondary"
            disabled={page * 20 >= totalRows}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
};
