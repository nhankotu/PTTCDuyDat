import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Trash2, Play, CheckCheck, FileSpreadsheet } from 'lucide-react';
import { apiV1 } from '../services/apiV1';
import { ImportPreviewResponse } from '../types/v1';

interface Props {
  sourceDate: string;
  effectiveDate: string;
  onAnyConfirmed: () => void;
}

type MultiSourceType = 'EMPLOYEE' | 'APPENDIX' | 'SETTLEMENT' | 'STOCK' | 'EXCEPTION';

const PREFIX_MAP: Record<string, { sourceType: MultiSourceType; label: string; order: number; badge: string }> = {
  NS: { sourceType: 'EMPLOYEE', label: 'Nhân sự (NS)', order: 1, badge: 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]' },
  PL: { sourceType: 'APPENDIX', label: 'Phụ lục (PL)', order: 2, badge: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE]' },
  TT: { sourceType: 'SETTLEMENT', label: 'Tất toán (TT)', order: 3, badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CK: { sourceType: 'STOCK', label: 'Chứng khoán (CK)', order: 4, badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  NL: { sourceType: 'EXCEPTION', label: 'Ngoại lệ (NL)', order: 5, badge: 'bg-sky-50 text-sky-800 border-sky-200' },
};

interface QueuedFile {
  id: string;
  file: File;
  prefix: string;
  sourceType: MultiSourceType | null;
  label: string;
  order: number;
  badge: string;
  status: 'PENDING' | 'INVALID_NAME' | 'PREVIEWING' | 'READY' | 'CONFIRMING' | 'DONE' | 'ERROR';
  preview?: ImportPreviewResponse;
  error?: string;
}

function classifyFile(file: File): Omit<QueuedFile, 'id'> {
  const cleanName = file.name.trim();
  const prefix = cleanName.slice(0, 2).toUpperCase();
  const match = PREFIX_MAP[prefix];
  if (!/\.(xlsx|xls)$/i.test(cleanName)) {
    return {
      file,
      prefix,
      sourceType: null,
      label: 'Sai định dạng',
      order: 99,
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      status: 'INVALID_NAME',
      error: 'Chỉ hỗ trợ file Excel (.xlsx, .xls).',
    };
  }
  if (!match) {
    return {
      file,
      prefix,
      sourceType: null,
      label: 'Không nhận diện',
      order: 99,
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      status: 'INVALID_NAME',
      error: 'Tên file phải bắt đầu bằng PL, TT, CK, NL hoặc NS. Hợp đồng ma vui lòng nạp ở tab Đơn file.',
    };
  }
  return {
    file,
    prefix,
    sourceType: match.sourceType,
    label: match.label,
    order: match.order,
    badge: match.badge,
    status: 'PENDING',
  };
}

export const MultiFileImportPanel: React.FC<Props> = ({ sourceDate, effectiveDate, onAnyConfirmed }) => {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBanner(null);
    const incoming = Array.from(fileList);

    setQueue((prev) => {
      const next = [...prev];
      for (const f of incoming) {
        const info = classifyFile(f);
        // Replace existing queued file of the same valid sourceType so user can easily re-drop
        if (info.sourceType) {
          const dupIdx = next.findIndex((x) => x.sourceType === info.sourceType);
          if (dupIdx >= 0) {
            next[dupIdx] = { id: `${info.sourceType}_${Date.now()}_${Math.random()}`, ...info };
            continue;
          }
        }
        next.push({ id: `${f.name}_${Date.now()}_${Math.random()}`, ...info });
      }
      return next.sort((a, b) => a.order - b.order);
    });
  };

  const updateItem = (id: string, patch: Partial<QueuedFile>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handlePreviewAll = async () => {
    const targets = queue.filter((q) => q.sourceType && (q.status === 'PENDING' || q.status === 'ERROR'));
    if (targets.length === 0) return;
    setBusy(true);
    setBanner(null);

    for (const item of targets) {
      updateItem(item.id, { status: 'PREVIEWING', error: undefined });
      try {
        const preview = await apiV1.uploadImportPreview(item.file, item.sourceType!, sourceDate, effectiveDate);
        updateItem(item.id, { status: 'READY', preview });
      } catch (err: any) {
        updateItem(item.id, {
          status: 'ERROR',
          error: err?.response?.data?.message || 'Lỗi phân tích file Excel.',
        });
      }
    }
    setBusy(false);
  };

  const handleConfirmAll = async () => {
    const readyItems = queue.filter((q) => q.status === 'READY' && q.preview);
    if (readyItems.length === 0) return;
    setBusy(true);
    setBanner(null);

    let confirmedFiles = 0;
    for (const item of readyItems) {
      const prev = item.preview!;
      if (prev.ambiguousRows > 0) {
        updateItem(item.id, {
          status: 'ERROR',
          error: `Có ${prev.ambiguousRows} dòng mơ hồ (AMBIGUOUS) cần xử lý ở tab Đơn file.`,
        });
        continue;
      }

      updateItem(item.id, { status: 'CONFIRMING', error: undefined });
      try {
        await apiV1.confirmImport(prev.previewId, {
          expectedRevision: prev.expectedRevision,
          idempotencyKey: `batch_multi_${prev.previewId}_rev${prev.expectedRevision}`,
          reason: `Nạp nhanh đa file (${item.prefix})`,
        });
        updateItem(item.id, { status: 'DONE' });
        confirmedFiles++;
      } catch (err: any) {
        updateItem(item.id, {
          status: 'ERROR',
          error: err?.response?.data?.message || 'Lỗi khi xác nhận nạp.',
        });
      }
    }

    setBusy(false);
    if (confirmedFiles > 0) {
      setBanner({ type: 'success', text: `Đã nạp thành công ${confirmedFiles} file vào hệ thống!` });
      onAnyConfirmed();
    }
  };

  const pendingCount = queue.filter((q) => q.sourceType && (q.status === 'PENDING' || q.status === 'ERROR')).length;
  const readyCount = queue.filter((q) => q.status === 'READY').length;

  return (
    <div className="space-y-4">
      {/* Prefix Guide Pills */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="font-bold text-slate-600 mr-1">2 ký tự đầu tên file:</span>
        {Object.entries(PREFIX_MAP).map(([code, meta]) => (
          <span key={code} className={`px-2 py-0.5 rounded-md font-bold border ${meta.badge}`}>
            {code} = {meta.label.split(' (')[0]}
          </span>
        ))}
        <span className="text-slate-400 ml-1">(Không phân biệt hoa/thường · HĐ ma nạp ở tab Đơn file)</span>
      </div>

      {banner && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {banner.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Multi-file Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
          dragging ? 'border-blue-500 bg-blue-50/70' : 'border-slate-300 hover:border-blue-500 bg-white'
        }`}
      >
        <input
          type="file"
          multiple
          accept=".xlsx,.xls"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          className="hidden"
          id="multi-file-upload"
        />
        <label htmlFor="multi-file-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Upload size={22} />
          </div>
          <span className="text-sm font-bold text-slate-800">
            Chọn hoặc kéo thả cùng lúc tối đa 5 file Excel
          </span>
          <span className="text-xs text-slate-400">
            Ví dụ: PL_thang11.xlsx, TT_thang11.xlsx, CK_thang11.xlsx, NL_thang11.xlsx, ns_thang11.xlsx
          </span>
        </label>
      </div>

      {/* File Queue Table */}
      {queue.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold text-slate-600">File</th>
                <th className="px-3 py-2.5 text-left font-bold text-slate-600">Loại nguồn</th>
                <th className="px-3 py-2.5 text-left font-bold text-slate-600">Kết quả phân tích</th>
                <th className="px-3 py-2.5 text-center font-bold text-slate-600">Trạng thái</th>
                <th className="px-3 py-2.5 text-right font-bold text-slate-600">Xóa</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {queue.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <FileSpreadsheet size={14} className="text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[220px]" title={item.file.name}>{item.file.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-md font-bold border ${item.badge}`}>
                      {item.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {item.error ? (
                      <span className="text-rose-700 font-medium">{item.error}</span>
                    ) : item.preview ? (
                      <div className="flex flex-wrap gap-1.5 font-semibold">
                        <span className="text-slate-700">{item.preview.totalRows} dòng</span>
                        <span className="text-emerald-700">+{item.preview.newRows} mới</span>
                        {item.preview.changedRows > 0 && <span className="text-blue-700">~{item.preview.changedRows} sửa</span>}
                        {item.preview.invalidRows > 0 && <span className="text-rose-700">!{item.preview.invalidRows} lỗi (bỏ qua)</span>}
                      </div>
                    ) : (
                      <span className="text-slate-400">Chưa phân tích</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        item.status === 'DONE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'READY'
                          ? 'bg-blue-100 text-blue-800'
                          : item.status === 'PREVIEWING' || item.status === 'CONFIRMING'
                          ? 'bg-amber-100 text-amber-800 animate-pulse'
                          : item.status === 'ERROR' || item.status === 'INVALID_NAME'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.status === 'PENDING' && 'Chờ phân tích'}
                      {item.status === 'PREVIEWING' && 'Đang phân tích…'}
                      {item.status === 'READY' && 'Sẵn sàng nạp'}
                      {item.status === 'CONFIRMING' && 'Đang nạp…'}
                      {item.status === 'DONE' && 'Đã nạp ✓'}
                      {item.status === 'INVALID_NAME' && 'Sai tên file'}
                      {item.status === 'ERROR' && 'Lỗi'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeItem(item.id)}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer disabled:opacity-40"
                      title="Xóa khỏi hàng đợi"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Buttons */}
      {queue.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            disabled={busy}
            onClick={() => { setQueue([]); setBanner(null); }}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer disabled:opacity-40"
          >
            Xóa danh sách
          </button>

          {pendingCount > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={handlePreviewAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Play size={14} />
              <span>Phân tích tất cả ({pendingCount})</span>
            </button>
          )}

          {readyCount > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={handleConfirmAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
            >
              <CheckCheck size={14} />
              <span>Xác nhận nạp tất cả ({readyCount})</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
