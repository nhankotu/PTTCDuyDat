import React, { useEffect, useState } from 'react';
import { Ghost, Search, Lock, X, RefreshCw } from 'lucide-react';
import { apiV1 } from '../services/apiV1';
import { GhostRegistryItem } from '../types/v1';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const fmtMoney = (v?: number) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);

export const GhostRegistryModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<GhostRegistryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async (q?: string) => {
    setLoading(true);
    try {
      const data = await apiV1.getGhostRegistry(q);
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center">
              <Ghost size={17} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold">Sổ Lưu Trữ Hợp Đồng Ma (Bất Biến)</h2>
              <p className="text-[11px] text-slate-400">
                Lưu độc lập tại bảng <code>ghost_contract_registry</code> để tra cứu lâu dài
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <form
            onSubmit={(e) => { e.preventDefault(); load(search); }}
            className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md"
          >
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm số phụ lục, mã KH, tên KH, sale..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
              />
            </div>
            <button type="submit" className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer">
              Tìm
            </button>
          </form>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Tổng: <strong>{items.length.toLocaleString('vi-VN')}</strong> HĐ ma</span>
            <button onClick={() => load(search)} className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 cursor-pointer" title="Làm mới">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Số phụ lục</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Khách hàng</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Sản phẩm</th>
                <th className="px-3.5 py-2.5 text-right font-bold text-slate-600">Giá trị gốc</th>
                <th className="px-3.5 py-2.5 text-center font-bold text-slate-600">Ngày ký</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Sale</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Người đánh dấu</th>
                <th className="px-3.5 py-2.5 text-center font-bold text-slate-600">Khóa</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400">Đang tải sổ hợp đồng ma...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400">Chưa có hợp đồng ma nào được lưu.</td></tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="hover:bg-amber-50/40">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900">{it.appendixNumber}</td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-slate-800">{it.customerName || '—'}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{it.customerCode || ''}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700">{it.productName || '—'}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 tabular-nums">{fmtMoney(it.contractValue)}</td>
                    <td className="px-3.5 py-2.5 text-center text-slate-600">{it.signDate || '—'}</td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-700">{it.saleId || '—'}</td>
                    <td className="px-3.5 py-2.5 text-slate-600">
                      <div>{it.markedBy}</div>
                      <div className="text-[10px] text-slate-400">{new Date(it.markedAt).toLocaleDateString('vi-VN')}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      {it.isLocked && <span title="Đã khóa bảo vệ"><Lock size={13} className="inline text-amber-600" /></span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
