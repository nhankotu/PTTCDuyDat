import { useEffect, useRef, useState } from 'react';
import { Download, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiV1 } from '../services/apiV1';
import { ContractDetailItem, ContractFilters, DimensionFilters, ReportView } from '../types/v1';

interface Props extends ReportView, DimensionFilters {
  fromDate: string; toDate: string; datasetId?: string; asOfDate?: string; basis?: 'sales' | 'balance';
}
const money = (value: string | null) => value === null ? 'Không có quyền' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value)) + ' đ';
const statuses: Record<string, string> = { APPROVED: 'Đã duyệt', LIQUIDATED: 'Đã tất toán', PENDING: 'Chưa duyệt', ADVANCING: 'Đang ứng tiền' };
const inputClass = 'w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-900';

export function ContractsTableV1(props: Props) {
  const [contracts, setContracts] = useState<ContractDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [draft, setDraft] = useState<ContractFilters>({ sort: 'date_desc' });
  const [filters, setFilters] = useState<ContractFilters>({ sort: 'date_desc' });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<ContractDetailItem | null>(null);
  const [showSales, setShowSales] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const key = JSON.stringify([props, filters, page, pageSize, revision]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setContracts([]); setTotalCount(0);
    apiV1.getContracts({ ...props, ...filters, page, pageSize }).then(data => {
      if (!active) return;
      setContracts(data.items); setTotalCount(data.totalCount);
    }).catch(err => { if (active) setError(err.response?.data?.message || 'Không tải được danh sách hợp đồng.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [key]);
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
    setFilters({ ...draft }); setPage(1); setRevision(n => n + 1);
  };
  const exportCsv = async () => {
    setExporting(true); setExportError(null);
    try {
      const blob = await apiV1.downloadContractsCsv({ ...props, ...filters });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = `hop_dong_${props.viewEmployeeId || 'pham_vi_cua_toi'}_${props.fromDate}_${props.toDate}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { setExportError('Không xuất được báo cáo. Vui lòng thử lại.'); }
    finally { setExporting(false); }
  };
  const exportExcel = async () => {
    setExporting(true); setExportError(null);
    try {
      const blob = await apiV1.downloadContractsExcel({ ...props, ...filters });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = `hop_dong_${props.viewEmployeeId || 'pham_vi_cua_toi'}_${props.fromDate}_${props.toDate}.xls`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { setExportError('Không xuất được file Excel. Vui lòng thử lại.'); }
    finally { setExporting(false); }
  };
  const toggleGhost = async (c: ContractDetailItem) => {
    try {
      if (c.isGhost) {
        await apiV1.unmarkGhostContract(c.appendixNumber);
      } else {
        await apiV1.markGhostContract(c.appendixNumber);
      }
      setRevision(n => n + 1);
    } catch {
      setError(`Không thể cập nhật trạng thái hợp đồng ma cho ${c.appendixNumber}.`);
    }
  };
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  return <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-5">
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">Tra cứu hợp đồng</h2><p className="text-sm text-slate-500">{props.basis === 'balance' ? `Hợp đồng đóng góp số dư tại ${props.asOfDate || props.toDate}, gồm cả hợp đồng ký trước kỳ.` : 'Hợp đồng phát sinh trong kỳ. Tìm trên toàn bộ dữ liệu trong phạm vi được cấp.'}</p></div>
      <div className="flex items-center gap-2">
        <button disabled={exporting || loading || !!error} onClick={exportExcel} className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-50 shadow-xs cursor-pointer"><Download size={16} />{exporting ? 'Đang xuất…' : 'Xuất Excel (Tô vàng HĐ ma)'}</button>
        <button disabled={exporting || loading || !!error} onClick={exportCsv} className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-50 shadow-xs cursor-pointer"><Download size={16} />{exporting ? 'Đang xuất…' : 'Xuất CSV'}</button>
      </div>
    </div>
    <form onSubmit={e => { e.preventDefault(); apply(); }} className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm text-slate-600 flex-1 min-w-52">Tìm hợp đồng, khách hàng hoặc sale
          <input aria-label="Tìm hợp đồng, khách hàng hoặc sale" value={draft.search || ''} onChange={e => setDraft({ ...draft, search: e.target.value || undefined })} placeholder="Số phụ lục, mã / tên khách hàng, sale…" className={inputClass} />
        </label>
        <label className="text-sm text-slate-600">Sắp xếp
          <select className={inputClass} value={draft.sort} onChange={e => setDraft({ ...draft, sort: e.target.value })}><option value="date_desc">Ngày ký mới nhất</option><option value="date_asc">Ngày ký cũ nhất</option><option value="value_desc">Giá trị giảm dần</option><option value="value_asc">Giá trị tăng dần</option></select>
        </label>
        <button type="submit" className="inline-flex gap-2 items-center px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold"><Search size={17} />Lọc hợp đồng</button>
        <button type="button" onClick={() => { setDraft({ sort: 'date_desc' }); setFilters({ sort: 'date_desc' }); setPage(1); }} className="px-3 py-2 text-sm text-slate-600 underline">Đặt lại</button>
      </div>
      <details className="border border-slate-200 rounded-xl p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Lọc theo số tiền và sale thụ hưởng</summary>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 mt-3">
          {([['minValue', 'Giá trị gốc từ (đ)'], ['maxValue', 'Giá trị gốc đến (đ)'], ['minBalance', 'Số dư từ (đ)'], ['maxBalance', 'Số dư đến (đ)']] as const).map(([field, label]) => <label key={field} className="text-sm text-slate-600">{label}<input type="number" min="0" step="0.01" value={draft[field] || ''} onChange={e => setDraft({ ...draft, [field]: e.target.value || undefined })} className={inputClass} /></label>)}
          <label className="text-sm text-slate-600">Thay đổi sale thụ hưởng<select className={inputClass} value={draft.changedSale === undefined ? '' : String(draft.changedSale)} onChange={e => setDraft({ ...draft, changedSale: e.target.value === '' ? undefined : e.target.value === 'true' })}><option value="">Tất cả</option><option value="true">Có thay đổi</option><option value="false">Không thay đổi</option></select></label>
        </div>
      </details>
      {JSON.stringify(draft) !== JSON.stringify(filters) && <p role="status" className="text-sm text-amber-800">Điều kiện chi tiết chưa áp dụng. Bấm “Lọc hợp đồng”.</p>}
    </form>
    {Object.entries(filters).filter(([field]) => field !== 'sort').map(([field, value]) => <button key={field} onClick={() => { const next = { ...filters }; delete next[field as keyof ContractFilters]; setFilters(next); setDraft(next); setPage(1); }} className="inline-flex items-center gap-1 text-sm bg-blue-50 text-blue-800 px-3 py-1 rounded-full mr-2" aria-label={`Bỏ điều kiện ${field}`}>{({ search: 'Tìm kiếm', minValue: 'Gốc từ', maxValue: 'Gốc đến', minBalance: 'Dư từ', maxBalance: 'Dư đến', changedSale: 'Đổi sale' } as Record<string, string>)[field]}: {typeof value === 'boolean' ? value ? 'Có' : 'Không' : value}<X size={14} /></button>)}
    {error && <p role="alert" className="bg-rose-50 text-rose-800 rounded-lg p-3 text-sm">{error} <button onClick={() => setRevision(n => n + 1)} className="underline font-semibold">Thử lại</button></p>}
    {exportError && <p role="alert" className="text-rose-700 text-sm">{exportError}</p>}
    <label className="flex gap-2 items-center text-sm text-slate-600"><input type="checkbox" checked={showSales} onChange={e => setShowSales(e.target.checked)} />Hiển thị sale gốc và sale thụ hưởng</label>
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-600"><tr>{['Số phụ lục', 'Khách hàng', 'Sản phẩm / Kỳ hạn', 'Giá trị gốc', 'Đã tất toán', 'Số dư', 'Ngày ký', ...(showSales ? ['Sale gốc', 'Sale thụ hưởng'] : []), 'Trạng thái', 'HĐ ma'].map(label => <th key={label} className="px-4 py-3 whitespace-nowrap font-semibold">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={11} className="p-10 text-center text-slate-500" role="status">Đang tải hợp đồng…</td></tr>
            : contracts.length === 0 ? <tr><td colSpan={11} className="p-10 text-center text-slate-500">{error ? 'Không tải được dữ liệu.' : 'Không có hợp đồng khớp các điều kiện đã áp dụng.'}</td></tr>
            : contracts.map((c, i) => {
              const isGhost = !!c.isGhost;
              return <tr key={`${c.appendixNumber}:${i}`} className={isGhost ? 'bg-amber-100/70 hover:bg-amber-200/60 border-l-4 border-amber-500' : 'hover:bg-blue-50/40'}>
                <td className={`px-4 py-3 sticky left-0 ${isGhost ? 'bg-amber-100/90' : 'bg-white'}`}>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setDetail(c)} className={`font-semibold underline underline-offset-4 whitespace-nowrap ${isGhost ? 'text-amber-900' : 'text-blue-700'}`}>{c.appendixNumber}</button>
                    {isGhost && <span className="text-[10px] bg-amber-300 text-amber-900 px-1.5 py-0.5 rounded font-black uppercase">MA</span>}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap"><div className="font-medium">{c.customerName}</div><div className="text-xs text-slate-500">{c.customerCode}</div></td>
                <td className="px-4 py-3 whitespace-nowrap"><div>{c.productName}</div><div className="text-xs text-slate-500">{c.term}</div></td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{money(c.contractValue)}</td><td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{money(c.settledAmount)}</td><td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold text-emerald-800">{money(c.balance)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{c.signDate}</td>
                {showSales && <><td className="px-4 py-3">{c.saleId}</td><td className="px-4 py-3 font-medium">{c.effectiveSaleId}{c.effectiveSaleId !== c.saleId && <span className="text-xs text-amber-700 block">Đã điều chỉnh</span>}</td></>}
                <td className="px-4 py-3 whitespace-nowrap">{statuses[c.status] || c.status}</td>
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  <button
                    type="button"
                    onClick={() => toggleGhost(c)}
                    title={isGhost ? 'Bỏ đánh dấu hợp đồng ma' : 'Đánh dấu đây là hợp đồng ma'}
                    className={`px-2 py-1 rounded text-xs font-bold transition cursor-pointer ${
                      isGhost
                        ? 'bg-amber-300 hover:bg-amber-400 text-amber-900 border border-amber-400'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
                    }`}
                  >
                    {isGhost ? '⚠️ Bỏ ma' : 'Gán ma'}
                  </button>
                </td>
              </tr>;
            })}
        </tbody>
      </table>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <span>{loading ? 'Đang tải…' : `${totalCount.toLocaleString('vi-VN')} kết quả · Trang ${page}/${pages}`}</span>
      <div className="flex items-center gap-3"><label>Số dòng <select aria-label="Số dòng mỗi trang" className="border rounded-lg p-2" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>{[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</select></label><button aria-label="Trang trước" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)} className="p-2 border rounded-lg disabled:opacity-40"><ChevronLeft size={18} /></button><button aria-label="Trang sau" disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)} className="p-2 border rounded-lg disabled:opacity-40"><ChevronRight size={18} /></button></div>
    </div>
    {detail && <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end" onClick={() => setDetail(null)}><section role="dialog" aria-modal="true" aria-labelledby="contract-title" onClick={e => e.stopPropagation()} className="bg-white w-full max-w-lg p-6 overflow-auto shadow-xl"><div className="flex justify-between items-center"><h3 id="contract-title" className="text-lg font-bold">Hợp đồng {detail.appendixNumber}</h3><button ref={closeRef} onClick={() => setDetail(null)} aria-label="Đóng chi tiết hợp đồng" className="p-2"><X /></button></div><dl className="mt-6 space-y-4">{[['Khách hàng', `${detail.customerName} (${detail.customerCode})`], ['Sản phẩm', detail.productName], ['Kỳ hạn', detail.term], ['Ngày ký', detail.signDate], ['Ngày hết hạn', detail.expireDate || 'Chưa có'], ['Giá trị gốc', money(detail.contractValue)], ['Đã tất toán', money(detail.settledAmount)], ['Số dư', money(detail.balance)], ['Sale thụ hưởng', detail.effectiveSaleId], ['Kênh', detail.channel], ['Trạng thái', statuses[detail.status] || detail.status]].map(([label, value]) => <div key={label} className="border-b pb-3"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-900">{value}</dd></div>)}</dl></section></div>}
  </section>;
}
