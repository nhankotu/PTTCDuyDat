import { useMemo, useState } from 'react';
import { Search, Users, CornerUpLeft } from 'lucide-react';
import { ViewScopeNode, ReportView } from '../types/v1';

interface Props {
  nodes: ViewScopeNode[];
  value: ReportView;
  onChange: (value: ReportView) => void;
  loading: boolean;
  error: string | null;
  defaultLabel: string;
  onRetry: () => void;
}

export function ScopeSelector({ nodes, value, onChange, loading, error, defaultLabel, onRetry }: Props) {
  const [search, setSearch] = useState('');
  const selected = nodes.find(n => n.id === value.viewEmployeeId);
  const path = useMemo(() => {
    const result: string[] = [];
    const seen = new Set<string>();
    let node = selected;
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      result.unshift(node.label);
      node = nodes.find(n => n.id === node!.parentId);
    }
    return result.join(' › ');
  }, [nodes, selected]);
  const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const ordered = useMemo(() => {
    const result: Array<ViewScopeNode & { depth: number }> = [];
    const seen = new Set<string>();
    const visit = (node: ViewScopeNode, depth: number) => {
      if (seen.has(node.id)) return;
      seen.add(node.id); result.push({ ...node, depth });
      nodes.filter(child => child.parentId === node.id).forEach(child => visit(child, depth + 1));
    };
    nodes.filter(node => !node.parentId).forEach(node => visit(node, 0));
    nodes.forEach(node => visit(node, 0));
    return result;
  }, [nodes]);
  const matches = ordered.filter(n => normalize(`${n.id} ${n.label} ${n.position} ${n.branch || ''} ${n.department || ''}`).includes(normalize(search)));
  return <section aria-label="Chọn phạm vi xem báo cáo" className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-slate-900"><Users size={20} className="text-blue-600" /><h2 className="font-bold">Phạm vi đang xem</h2></div>
      {value.viewEmployeeId && <button type="button" onClick={() => onChange({ view: 'subtree' })} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"><CornerUpLeft size={16} />Về phạm vi của tôi</button>}
    </div>
    <div className="grid gap-3 md:grid-cols-[1fr_2fr_1fr]">
      <label className="text-sm text-slate-600">Tìm nhân sự / đơn vị
        <div className="relative mt-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tên, mã, chức danh…" className="w-full border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-slate-900" /></div>
      </label>
      <label className="text-sm text-slate-600">Xem dữ liệu của
        <select aria-label="Xem dữ liệu của" disabled={loading || !!error} value={value.viewEmployeeId || ''} onChange={e => {
          const node = nodes.find(n => n.id === e.target.value);
          onChange({ viewEmployeeId: e.target.value || undefined, view: node && !node.canViewSubtree ? 'self' : 'subtree' });
        }} className="mt-1 w-full border border-slate-300 rounded-lg p-2 text-slate-900 min-h-10 disabled:opacity-60">
          <option value="">{loading ? 'Đang tải phạm vi được cấp…' : defaultLabel}</option>
          {selected && !matches.some(n => n.id === selected.id) && <option value={selected.id}>{selected.label} [{selected.position}]</option>}
          {matches.map(n => <option key={n.id} value={n.id}>{'　'.repeat(n.depth)}{n.depth > 0 ? '↳ ' : ''}{n.label} [{n.position}] · {n.department || n.branch || n.id}{!n.canViewSubtree ? ' · Cá nhân' : ''}</option>)}
        </select>
      </label>
      <label className="text-sm text-slate-600">Phạm vi thống kê
        <select aria-label="Phạm vi thống kê" value={value.view} disabled={!selected || !selected.canViewSubtree || !!error} onChange={e => onChange({ ...value, view: e.target.value as ReportView['view'] })} className="mt-1 w-full border border-slate-300 rounded-lg p-2 text-slate-900 min-h-10 disabled:opacity-60">
          <option value="subtree">Gồm cả cấp dưới</option><option value="self">Chỉ cá nhân</option>
        </select>
      </label>
    </div>
    {error ? <div role="alert" className="text-sm text-rose-700">{error} <button onClick={onRetry} className="font-semibold underline">Thử lại</button></div>
      : <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900"><strong>Đang xem: </strong>{path || defaultLabel}{selected ? ` — ${value.view === 'subtree' ? 'nhân sự và cây con trong quyền được cấp' : 'chỉ cá nhân'}` : ''}</p>}
    {!loading && search && matches.length === 0 && <p className="text-sm text-slate-500">Không có nhân sự phù hợp trong phạm vi được cấp.</p>}
  </section>;
}
