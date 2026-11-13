import { useEffect, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { apiV1 } from '../services/apiV1';
import { DimensionFilters, ReportView } from '../types/v1';

export const emptyDimensions = (): DimensionFilters => ({
  products: [],
  terms: [],
  channels: [],
  statuses: [],
  excludeTenDays: false,
  excludeSafeNewCust: false,
  excludeGhost: false,
});
type DimensionKey = 'products' | 'terms' | 'channels' | 'statuses';
const labels: Record<DimensionKey, string> = { products: 'Sản phẩm', terms: 'Kỳ hạn', channels: 'Kênh bán', statuses: 'Trạng thái hợp đồng' };
const statusLabels: Record<string, string> = { APPROVED: 'Đã duyệt', LIQUIDATED: 'Đã tất toán', PENDING: 'Chưa duyệt', ADVANCING: 'Đang ứng tiền' };

export function ReportFilterPanel({ value, onChange, context, embedded }: {
  value: DimensionFilters; onChange: (value: DimensionFilters) => void;
  context: ReportView & { datasetId?: string; toDate: string };
  embedded?: boolean;
}) {
  const [options, setOptions] = useState<DimensionFilters>(emptyDimensions);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(context);
  useEffect(() => {
    let active = true;
    setError(null); setOptions(emptyDimensions()); setLoading(true);
    apiV1.getFilterOptions(context).then(data => { if (active) setOptions(data); })
      .catch(err => { if (active) setError(err.response?.data?.message || 'Không tải được danh mục lọc.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [key, revision]);
  const fields = Object.keys(labels) as DimensionKey[];
  const count = fields.reduce((sum, field) => sum + (value[field]?.length || 0), 0);

  const innerContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-purple-600" />
          <span>2. Bộ lọc đa lựa chọn {count > 0 ? `(${count} lựa chọn)` : ''}</span>
        </div>
        {count > 0 && (
          <button onClick={() => onChange(emptyDimensions())} className="text-xs text-rose-600 hover:underline cursor-pointer">
            Xóa điều kiện lọc
          </button>
        )}
      </div>
      <p className="text-xs sm:text-sm text-slate-500">Áp dụng cho KPI, xu hướng, cơ cấu và hợp đồng. Chọn nhiều giá trị trong mỗi nhóm, rồi bấm “Áp dụng”.</p>
      {loading && <p role="status" className="text-xs text-slate-500">Đang tải danh mục trong phạm vi được cấp…</p>}
      {error && <p role="alert" className="text-xs text-rose-700">{error} <button onClick={() => setRevision(n => n + 1)} className="underline cursor-pointer">Thử lại</button></p>}
      {/* Smart business rules toggles */}
      <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-3.5 space-y-2">
        <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
          <span>⚡</span>
          <span>Quy tắc lọc dữ liệu thông minh (Tùy chọn linh hoạt)</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 pt-1">
          <label className="flex items-start gap-2 text-xs text-slate-700 font-medium cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300">
            <input
              type="checkbox"
              checked={!!value.excludeTenDays}
              onChange={e => onChange({ ...value, excludeTenDays: e.target.checked })}
              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="font-bold text-slate-900 block">Loại trừ HĐ ≤ 10 ngày</span>
              <span className="text-[11px] text-slate-500">Không tính doanh số HĐ duy trì thực tế ≤ 10 ngày</span>
            </div>
          </label>

          <label className="flex items-start gap-2 text-xs text-slate-700 font-medium cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300">
            <input
              type="checkbox"
              checked={!!value.excludeSafeNewCust}
              onChange={e => onChange({ ...value, excludeSafeNewCust: e.target.checked })}
              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="font-bold text-slate-900 block">Lọc KH mới (Non-Safe ≥ 1Tr)</span>
              <span className="text-[11px] text-slate-500">Chỉ tính KH có HĐ khác Safe ≥ 1Tr lần đầu</span>
            </div>
          </label>

          <label className="flex items-start gap-2 text-xs text-slate-700 font-medium cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300">
            <input
              type="checkbox"
              checked={!!value.excludeGhost}
              onChange={e => onChange({ ...value, excludeGhost: e.target.checked })}
              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="font-bold text-slate-900 block">Loại trừ hợp đồng ma</span>
              <span className="text-[11px] text-slate-500">Bỏ qua các HĐ được đánh dấu ma khỏi mọi chỉ số</span>
            </div>
          </label>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {fields.map(field => <fieldset key={field} className="border border-slate-200 rounded-xl p-3 min-w-0 bg-slate-50/50"><legend className="text-xs font-semibold px-1 text-slate-700">{labels[field]}</legend>
          <div className="max-h-40 overflow-auto space-y-2">
            {[...new Set([...options[field], ...value[field]])].sort().map(option => <label key={option} className="flex gap-2 items-center text-xs sm:text-sm cursor-pointer hover:text-blue-600"><input type="checkbox" checked={value[field].includes(option)} onChange={e => onChange({ ...value, [field]: e.target.checked ? [...value[field], option] : value[field].filter(v => v !== option) })} />{statusLabels[option] || option || 'Chưa xác định'}</label>)}
            {!loading && options[field].length === 0 && <p className="text-xs text-slate-400">Chưa có danh mục.</p>}
          </div>
        </fieldset>)}
      </div>
      {count > 0 && <div className="flex flex-wrap gap-2">{fields.flatMap(field => value[field].map(option => <button key={`${field}:${option}`} onClick={() => onChange({ ...value, [field]: value[field].filter(v => v !== option) })} className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-800 px-3 py-1 text-xs cursor-pointer" aria-label={`Bỏ ${labels[field]} ${statusLabels[option] || option}`}>{labels[field]}: {statusLabels[option] || option}<X size={12} /></button>))}</div>}
    </div>
  );

  if (embedded) {
    return innerContent;
  }

  return <details className="bg-white border border-slate-200 rounded-2xl p-4">
    <summary className="cursor-pointer font-semibold text-slate-800"><SlidersHorizontal size={18} className="inline mr-2" />Bộ lọc đa lựa chọn {count > 0 ? `(${count} lựa chọn)` : ''}</summary>
    <div className="pt-4">
      {innerContent}
    </div>
  </details>;
}
