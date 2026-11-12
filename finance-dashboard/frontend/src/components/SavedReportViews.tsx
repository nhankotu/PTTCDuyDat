import { useEffect, useState } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import { DimensionFilters, ReportView } from '../types/v1';

export interface SavedReportValue {
  fromDate: string; toDate: string; asOfDate: string; datasetId: string;
  dimensions: DimensionFilters; reportView: ReportView;
}
interface SavedView { id: string; name: string; version: 1; value: SavedReportValue }
function valid(item: SavedView) {
  const value = item?.value;
  return item?.version === 1 && typeof item.id === 'string' && typeof item.name === 'string' && value &&
    [value.fromDate, value.toDate, value.asOfDate].every(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) &&
    typeof value.datasetId === 'string' && ['self', 'subtree'].includes(value.reportView?.view) &&
    [value.dimensions?.products, value.dimensions?.terms, value.dimensions?.channels, value.dimensions?.statuses]
      .every(list => Array.isArray(list) && list.every(entry => typeof entry === 'string'));
}

export function SavedReportViews({ username, value, onLoad, embedded }: { username: string; value: SavedReportValue; onLoad: (value: SavedReportValue) => void; embedded?: boolean }) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const key = `finra_saved_reports_v1:${username}`;
  useEffect(() => {
    setSelected(''); setMessage(null);
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      setViews(Array.isArray(stored) ? stored.filter(valid) : []);
    } catch { setViews([]); }
  }, [key]);
  const persist = (next: SavedView[]) => {
    try { localStorage.setItem(key, JSON.stringify(next)); setViews(next); return true; }
    catch { setMessage('Không lưu được bộ lọc trên trình duyệt này.'); return false; }
  };

  const innerContent = (
    <div className="space-y-3">
      <div className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
        <Bookmark size={18} className="text-amber-600" />
        <span>3. Bộ lọc cá nhân đã lưu</span>
      </div>
      <p className="text-xs sm:text-sm text-slate-500">Lưu bộ lọc đã áp dụng và ngày cố định trên trình duyệt này. Quyền xem được kiểm tra lại khi mở.</p>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="saved-report-name">Tên bộ lọc mới</label>
        <input id="saved-report-name" value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Báo cáo phòng A tháng 11" className="border border-slate-300 rounded-lg p-2 text-xs sm:text-sm flex-1 min-w-40" />
        <button disabled={!name.trim() || views.length >= 30} onClick={() => {
          const entry: SavedView = { id: crypto.randomUUID(), name: name.trim(), version: 1, value };
          if (persist([...views, entry])) { setName(''); setSelected(entry.id); setMessage('Đã lưu bộ lọc đang áp dụng.'); }
        }} className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold px-3 py-2 text-xs sm:text-sm disabled:opacity-40 cursor-pointer">Lưu bộ lọc hiện tại</button>
      </div>
      {views.length > 0 && <div className="flex flex-wrap gap-2">
        <select aria-label="Bộ lọc cá nhân đã lưu" value={selected} onChange={e => setSelected(e.target.value)} className="border border-slate-300 rounded-lg p-2 text-xs sm:text-sm max-w-full"><option value="">Chọn bộ lọc đã lưu</option>{views.map(view => <option key={view.id} value={view.id}>{view.name} · {view.value.fromDate} → {view.value.toDate}</option>)}</select>
        <button disabled={!selected} onClick={() => { const entry = views.find(view => view.id === selected); if (entry) { onLoad(entry.value); setMessage('Đã mở bộ lọc. Dữ liệu được tải theo quyền hiện hành.'); } }} className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs sm:text-sm disabled:opacity-40 cursor-pointer">Mở bộ lọc</button>
        <button disabled={!selected} onClick={() => { if (persist(views.filter(view => view.id !== selected))) { setSelected(''); setMessage('Đã xóa bộ lọc đã chọn.'); } }} className="inline-flex items-center gap-1 text-xs sm:text-sm text-rose-700 hover:text-rose-900 px-3 py-2 disabled:opacity-40 cursor-pointer"><Trash2 size={15} />Xóa mẫu</button>
      </div>}
      {message && <p role="status" className="text-xs sm:text-sm text-slate-600">{message}</p>}
    </div>
  );

  if (embedded) {
    return innerContent;
  }

  return <details className="rounded-2xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer font-semibold text-slate-800"><Bookmark size={17} className="inline mr-2" />Bộ lọc cá nhân đã lưu</summary>
    <div className="pt-3">
      {innerContent}
    </div>
  </details>;
}
