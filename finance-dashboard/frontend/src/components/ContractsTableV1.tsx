import { useEffect, useRef, useState } from 'react';
import {
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Ghost,
  BadgeDollarSign,
  Landmark,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { apiV1 } from '../services/apiV1';
import { ContractDetailItem, ContractFilters, DimensionFilters, ReportView } from '../types/v1';
import { GhostRegistryModal } from './GhostRegistryModal';

interface Props extends ReportView, DimensionFilters {
  fromDate: string;
  toDate: string;
  datasetId?: string;
  asOfDate?: string;
  basis?: 'sales' | 'balance';
  isAdmin?: boolean;
  refreshKey?: number;
  onBasisChange?: (basis: 'sales' | 'balance') => void;
  onGhostToggled?: () => void;
}
const money = (value: string | null) =>
  value === null ? 'Không có quyền' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value)) + ' đ';
const statuses: Record<string, string> = {
  APPROVED: 'Đã duyệt',
  LIQUIDATED: 'Đã tất toán',
  PENDING: 'Chưa duyệt',
  ADVANCING: 'Đang ứng tiền',
};
const ghostFilterLabels: Record<string, string> = {
  only_ghost: 'Chỉ HĐ ma',
  non_ghost: 'Chỉ HĐ hợp lệ',
};
const inputClass =
  'w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm text-[#0F294A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]';

export function ContractsTableV1(props: Props) {
  const {
    fromDate, toDate, datasetId, asOfDate, basis = 'sales',
    viewEmployeeId, view, products, terms, channels, statuses: dimStatuses,
    excludeTenDays, earlyLiquidationMaxDays, excludeSafeNewCust, excludeGhost,
    isAdmin = false, refreshKey = 0, onBasisChange, onGhostToggled,
  } = props;

  const [contracts, setContracts] = useState<ContractDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [draft, setDraft] = useState<ContractFilters>({ sort: 'date_desc', ghostFilter: 'all' });
  const [filters, setFilters] = useState<ContractFilters>({ sort: 'date_desc', ghostFilter: 'all' });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<ContractDetailItem | null>(null);
  const [showSales, setShowSales] = useState(true);
  const [ghostRegistryOpen, setGhostRegistryOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const apiBaseParams = {
    fromDate,
    toDate,
    datasetId,
    asOfDate,
    basis,
    viewEmployeeId,
    view,
    products,
    terms,
    channels,
    statuses: dimStatuses,
    excludeTenDays,
    earlyLiquidationMaxDays: earlyLiquidationMaxDays ?? 5,
    excludeSafeNewCust,
    excludeGhost,
  };
  const globalKey = JSON.stringify([fromDate, toDate, datasetId, asOfDate, basis, viewEmployeeId, view, products, terms, channels, dimStatuses, !!excludeTenDays, earlyLiquidationMaxDays ?? 5, !!excludeSafeNewCust, !!excludeGhost]);
  const prevGlobalKeyRef = useRef(globalKey);

  useEffect(() => {
    let active = true;
    const effectivePage = prevGlobalKeyRef.current !== globalKey ? 1 : page;
    if (prevGlobalKeyRef.current !== globalKey) {
      prevGlobalKeyRef.current = globalKey;
      if (page !== 1) setPage(1);
    }
    setLoading(true); setError(null);
    apiV1.getContracts({ ...apiBaseParams, ...filters, page: effectivePage, pageSize }).then(data => {
      if (!active) return;
      setContracts(data.items); setTotalCount(data.totalCount);
    }).catch(err => { if (active) setError(err.response?.data?.message || 'Không tải được danh sách hợp đồng.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [globalKey, JSON.stringify(filters), page, pageSize, revision, refreshKey]);

  useEffect(() => {
    if (!detail) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetail(null);
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [detail]);

  const apply = () => {
    if ((draft.minValue && draft.maxValue && Number(draft.minValue) > Number(draft.maxValue)) ||
        (draft.minBalance && draft.maxBalance && Number(draft.minBalance) > Number(draft.maxBalance))) {
      setError('Giá trị tối thiểu không được lớn hơn giá trị tối đa.'); return;
    }
    setError(null);
    setFilters({ ...draft }); setPage(1); setRevision(n => n + 1);
  };
  const exportCsv = async () => {
    setExporting(true); setExportError(null);
    try {
      const blob = await apiV1.downloadContractsCsv({ ...apiBaseParams, ...filters });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = `hop_dong_${viewEmployeeId || 'pham_vi_cua_toi'}_${fromDate}_${toDate}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { setExportError('Không xuất được báo cáo. Vui lòng thử lại.'); }
    finally { setExporting(false); }
  };
  const exportExcel = async () => {
    setExporting(true); setExportError(null);
    try {
      const blob = await apiV1.downloadContractsExcel({ ...apiBaseParams, ...filters });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = `hop_dong_${viewEmployeeId || 'pham_vi_cua_toi'}_${fromDate}_${toDate}.xls`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { setExportError('Không xuất được file Excel. Vui lòng thử lại.'); }
    finally { setExporting(false); }
  };
  const toggleGhost = async (c: ContractDetailItem) => {
    if (!isAdmin) return;
    try {
      if (c.isGhost) {
        await apiV1.unmarkGhostContract(c.appendixNumber);
      } else {
        await apiV1.markGhostContract(c.appendixNumber);
      }
      setRevision(n => n + 1);
      onGhostToggled?.();
    } catch {
      setError(`Không thể cập nhật trạng thái hợp đồng ma cho ${c.appendixNumber}.`);
    }
  };
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  return <section className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-6 space-y-5">
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-lg font-bold text-[#0F294A]">Tra cứu hợp đồng</h2>
          {onBasisChange && (
            <div className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => onBasisChange('sales')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  basis === 'sales' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600 hover:text-[#0F294A]'
                }`}
              >
                <BadgeDollarSign size={14} />
                <span>Phát sinh trong kỳ</span>
              </button>
              <button
                type="button"
                onClick={() => onBasisChange('balance')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition cursor-pointer tabular-nums ${
                  basis === 'balance' ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-slate-600 hover:text-[#0F294A]'
                }`}
              >
                <Landmark size={14} />
                <span>Còn số dư tại {asOfDate || toDate}</span>
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setGhostRegistryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold cursor-pointer transition"
            title="Tra cứu sổ lưu trữ vĩnh viễn Hợp đồng ma"
          >
            <Ghost size={14} /> Sổ HĐ ma
          </button>
        </div>
        <p className="text-sm text-slate-500">
          {basis === 'balance'
            ? `Danh sách các hợp đồng đang còn số dư (> 0 đ) tại ngày ${asOfDate || toDate}, gồm cả hợp đồng ký trước kỳ.`
            : 'Hợp đồng phát sinh theo ngày ký trong kỳ. Các hợp đồng ma được tô nền vàng để dễ đối chiếu.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={exporting || loading || !!error}
          onClick={exportExcel}
          className="inline-flex items-center gap-2 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold disabled:opacity-50 cursor-pointer transition"
        >
          <FileSpreadsheet size={16} />
          {exporting ? 'Đang xuất…' : 'Xuất Excel (Tô vàng HĐ ma)'}
        </button>
        <button
          disabled={exporting || loading || !!error}
          onClick={exportCsv}
          className="inline-flex items-center gap-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold disabled:opacity-50 shadow-xs cursor-pointer transition"
        >
          <Download size={16} />
          {exporting ? 'Đang xuất…' : 'Xuất CSV'}
        </button>
      </div>
    </div>
    <form onSubmit={e => { e.preventDefault(); apply(); }} className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-slate-600 flex-1 min-w-52">Tìm hợp đồng, khách hàng hoặc sale
          <input aria-label="Tìm hợp đồng, khách hàng hoặc sale" value={draft.search || ''} onChange={e => setDraft({ ...draft, search: e.target.value || undefined })} placeholder="Số phụ lục, mã / tên khách hàng, sale…" className={inputClass} />
        </label>
        <label className="text-xs font-semibold text-slate-600">Phân loại HĐ ma
          <select className={inputClass} value={draft.ghostFilter || 'all'} onChange={e => {
            const nextGhost = e.target.value as ContractFilters['ghostFilter'];
            const nextDraft = { ...draft, ghostFilter: nextGhost };
            setDraft(nextDraft);
            setFilters({ ...filters, ghostFilter: nextGhost });
            setPage(1);
          }}>
            <option value="all">{excludeGhost ? 'Đang ẩn HĐ ma (Theo bộ lọc chung)' : 'Tất cả (Gồm cả HĐ ma tô vàng)'}</option>
            <option value="only_ghost">Chỉ xem Hợp đồng ma (Tô vàng)</option>
            <option value="non_ghost">Chỉ xem Hợp đồng hợp lệ</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Sắp xếp
          <select className={inputClass} value={draft.sort} onChange={e => setDraft({ ...draft, sort: e.target.value })}><option value="date_desc">Ngày ký mới nhất</option><option value="date_asc">Ngày ký cũ nhất</option><option value="value_desc">Giá trị giảm dần</option><option value="value_asc">Giá trị tăng dần</option></select>
        </label>
        <button type="submit" className="inline-flex gap-2 items-center px-4 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-sm font-semibold cursor-pointer transition"><Search size={16} />Lọc hợp đồng</button>
        <button type="button" onClick={() => { setDraft({ sort: 'date_desc', ghostFilter: 'all' }); setFilters({ sort: 'date_desc', ghostFilter: 'all' }); setPage(1); }} className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-[#1D4ED8] hover:underline cursor-pointer">Đặt lại</button>
      </div>
      <details className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
        <summary className="cursor-pointer text-sm font-semibold text-[#0F294A]">Lọc theo số tiền và sale thụ hưởng</summary>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 mt-3">
          {([['minValue', 'Giá trị gốc từ (đ)'], ['maxValue', 'Giá trị gốc đến (đ)'], ['minBalance', 'Số dư từ (đ)'], ['maxBalance', 'Số dư đến (đ)']] as const).map(([field, label]) => <label key={field} className="text-xs font-semibold text-slate-600">{label}<input type="number" min="0" step="0.01" value={draft[field] || ''} onChange={e => setDraft({ ...draft, [field]: e.target.value || undefined })} className={inputClass} /></label>)}
          <label className="text-xs font-semibold text-slate-600">Thay đổi sale thụ hưởng<select className={inputClass} value={draft.changedSale === undefined ? '' : String(draft.changedSale)} onChange={e => setDraft({ ...draft, changedSale: e.target.value === '' ? undefined : e.target.value === 'true' })}><option value="">Tất cả</option><option value="true">Có thay đổi</option><option value="false">Không thay đổi</option></select></label>
        </div>
      </details>
      {JSON.stringify(draft) !== JSON.stringify(filters) && <p role="status" className="text-sm text-amber-800">Điều kiện chi tiết chưa áp dụng. Bấm “Lọc hợp đồng”.</p>}
    </form>
    {Object.entries(filters).filter(([field, val]) => field !== 'sort' && !(field === 'ghostFilter' && val === 'all') && val !== undefined).map(([field, value]) => <button key={field} onClick={() => { const next = { ...filters }; if (field === 'ghostFilter') next.ghostFilter = 'all'; else delete next[field as keyof ContractFilters]; setFilters(next); setDraft(next); setPage(1); }} className="inline-flex items-center gap-1 text-xs font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE] px-3 py-1 rounded-full mr-2 cursor-pointer" aria-label={`Bỏ điều kiện ${field}`}>{({ search: 'Tìm kiếm', minValue: 'Gốc từ', maxValue: 'Gốc đến', minBalance: 'Dư từ', maxBalance: 'Dư đến', changedSale: 'Đổi sale', ghostFilter: 'Phân loại' } as Record<string, string>)[field]}: {typeof value === 'boolean' ? value ? 'Có' : 'Không' : (ghostFilterLabels[String(value)] || value)}<X size={13} /></button>)}
    {error && <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-sm">{error} <button onClick={() => setRevision(n => n + 1)} className="underline font-semibold cursor-pointer">Thử lại</button></p>}
    {exportError && <p role="alert" className="text-rose-700 text-sm">{exportError}</p>}
    <label className="inline-flex gap-2 items-center text-sm text-slate-600 cursor-pointer"><input type="checkbox" className="accent-[#1D4ED8]" checked={showSales} onChange={e => setShowSales(e.target.checked)} />Hiển thị sale gốc và sale thụ hưởng</label>
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm text-left">
        <thead className="bg-[#F8FAFC] text-[#0F294A] border-b border-slate-200"><tr>{['Số phụ lục', 'Khách hàng', 'Sản phẩm / Kỳ hạn', 'Giá trị gốc', 'Đã tất toán', 'Số dư', 'Ngày ký', ...(showSales ? ['Sale gốc', 'Sale thụ hưởng'] : []), 'Trạng thái', isAdmin ? 'Đánh dấu HĐ ma' : 'Phân loại'].map(label => <th key={label} className={`px-4 py-3 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider ${['Giá trị gốc', 'Đã tất toán', 'Số dư'].includes(label) ? 'text-right' : ''}`}>{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={11} className="p-10 text-center text-slate-500" role="status">Đang tải hợp đồng…</td></tr>
            : contracts.length === 0 ? <tr><td colSpan={11} className="p-10 text-center text-slate-500">{error ? 'Không tải được dữ liệu.' : 'Không có hợp đồng khớp các điều kiện đã áp dụng.'}</td></tr>
            : contracts.map((c, i) => {
              const isGhost = !!c.isGhost;
              return <tr key={`${c.appendixNumber}:${i}`} className={isGhost ? 'bg-amber-50/90 hover:bg-amber-100/70 border-l-4 border-amber-400' : 'hover:bg-[#EFF6FF]/50 transition-colors'}>
                <td className={`px-4 py-3 sticky left-0 ${isGhost ? 'bg-amber-50' : 'bg-white'}`}>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setDetail(c)} className={`font-semibold underline underline-offset-4 whitespace-nowrap cursor-pointer ${isGhost ? 'text-amber-900' : 'text-[#1D4ED8]'}`}>{c.appendixNumber}</button>
                    {isGhost && <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold uppercase">MA</span>}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap"><div className="font-medium text-[#0F294A]">{c.customerName}</div><div className="text-xs text-slate-500 font-mono">{c.customerCode}</div></td>
                <td className="px-4 py-3 whitespace-nowrap"><div className="text-slate-800">{c.productName}</div><div className="text-xs text-slate-500">{c.term}</div></td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-medium text-[#0F294A]">{money(c.contractValue)}</td><td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-slate-600">{money(c.settledAmount)}</td><td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-bold text-[#0284C7]">{money(c.balance)}</td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-600">{c.signDate}</td>
                {showSales && <><td className="px-4 py-3 font-mono text-xs text-slate-600">{c.saleId}</td><td className="px-4 py-3 font-medium text-[#0F294A]">{c.effectiveSaleId}{c.effectiveSaleId !== c.saleId && <span className="text-xs text-amber-700 block">Đã điều chỉnh</span>}</td></>}
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">{statuses[c.status] || c.status}</td>
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => toggleGhost(c)}
                      title={isGhost ? 'Bỏ đánh dấu hợp đồng ma' : 'Đánh dấu đây là hợp đồng ma'}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        isGhost
                          ? 'bg-amber-200 hover:bg-amber-300 text-amber-950 border border-amber-300'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {isGhost && <AlertTriangle size={12} />}
                      <span>{isGhost ? 'Bỏ ma' : 'Gán ma'}</span>
                    </button>
                  ) : (
                    isGhost
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200"><AlertTriangle size={12} />HĐ ma</span>
                      : <span className="text-xs text-slate-400">Hợp lệ</span>
                  )}
                </td>
              </tr>;
            })}
        </tbody>
      </table>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 tabular-nums">
      <span>{loading ? 'Đang tải…' : `${totalCount.toLocaleString('vi-VN')} kết quả · Trang ${page}/${pages}`}</span>
      <div className="flex items-center gap-3"><label>Số dòng <select aria-label="Số dòng mỗi trang" className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-[#0F294A]" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>{[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</select></label><button aria-label="Trang trước" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)} className="p-2 border border-slate-200 rounded-lg hover:bg-[#EFF6FF] hover:text-[#1D4ED8] disabled:opacity-40 cursor-pointer"><ChevronLeft size={18} /></button><button aria-label="Trang sau" disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)} className="p-2 border border-slate-200 rounded-lg hover:bg-[#EFF6FF] hover:text-[#1D4ED8] disabled:opacity-40 cursor-pointer"><ChevronRight size={18} /></button></div>
    </div>
    {detail && <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex justify-end" onClick={() => setDetail(null)}><section role="dialog" aria-modal="true" aria-labelledby="contract-title" onClick={e => e.stopPropagation()} className="bg-white w-full max-w-lg p-6 overflow-auto shadow-2xl border-l border-slate-200"><div className="flex justify-between items-center pb-3 border-b border-slate-200"><h3 id="contract-title" className="text-lg font-bold text-[#0F294A]">Hợp đồng {detail.appendixNumber}</h3><button ref={closeRef} onClick={() => setDetail(null)} aria-label="Đóng chi tiết hợp đồng" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={18} /></button></div><dl className="mt-5 space-y-3.5">{[['Khách hàng', `${detail.customerName} (${detail.customerCode})`], ['Sản phẩm', detail.productName], ['Kỳ hạn', detail.term], ['Ngày ký', detail.signDate], ['Ngày hết hạn', detail.expireDate || 'Chưa có'], ['Giá trị gốc', money(detail.contractValue)], ['Đã tất toán', money(detail.settledAmount)], ['Số dư', money(detail.balance)], ['Sale thụ hưởng', detail.effectiveSaleId], ['Kênh', detail.channel], ['Trạng thái', statuses[detail.status] || detail.status]].map(([label, value]) => <div key={label} className="border-b border-slate-100 pb-2.5"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-0.5 font-semibold text-[#0F294A] tabular-nums">{value}</dd></div>)}</dl></section></div>}
    <GhostRegistryModal isOpen={ghostRegistryOpen} onClose={() => setGhostRegistryOpen(false)} />
  </section>;
}
