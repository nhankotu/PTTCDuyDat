import React, { useEffect, useState } from 'react';
import { Archive, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiV1 } from '../services/apiV1';
import { ConfirmedSourceBatch } from '../types/v1';

interface Props {
  isOpen: boolean;
  defaultFrom: string;
  defaultTo: string;
  defaultAsOf: string;
  onClose: () => void;
  onCreated: (newDatasetId: string) => void;
}

const SOURCE_TYPES: Array<{ code: ConfirmedSourceBatch['sourceType']; label: string }> = [
  { code: 'APPENDIX', label: '1. Báo cáo Phụ lục (APPENDIX)' },
  { code: 'SETTLEMENT', label: '2. Báo cáo Tất toán (SETTLEMENT)' },
  { code: 'STOCK', label: '3. Bảng HĐ Chứng khoán (STOCK)' },
  { code: 'EXCEPTION', label: '4. Bảng Ngoại lệ (EXCEPTION)' },
  { code: 'EMPLOYEE', label: '5. Bảng Nhân sự (EMPLOYEE)' },
];

interface ManifestRowState {
  sourceBatchId: number | '';
  isConfirmedNoMovement: boolean;
  notes: string;
}

export const CreateDatasetModal: React.FC<Props> = ({
  isOpen,
  defaultFrom,
  defaultTo,
  defaultAsOf,
  onClose,
  onCreated,
}) => {
  const [batches, setBatches] = useState<ConfirmedSourceBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [datasetCode, setDatasetCode] = useState('');
  const [title, setTitle] = useState('');
  const [cutoffDate, setCutoffDate] = useState(defaultAsOf);
  const [coverageFrom, setCoverageFrom] = useState(defaultFrom);
  const [coverageTo, setCoverageTo] = useState(defaultTo);
  const [amendmentReason, setAmendmentReason] = useState('');
  const [manifest, setManifest] = useState<Record<string, ManifestRowState>>({});

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuccess(null);
    const ym = defaultTo.slice(0, 7);
    setDatasetCode(`DS-${ym}`);
    setTitle(`Bản chốt kỳ ${ym}`);
    setCutoffDate(defaultAsOf);
    setCoverageFrom(defaultFrom);
    setCoverageTo(defaultTo);
    setAmendmentReason('');

    setLoadingBatches(true);
    apiV1
      .getConfirmedBatches()
      .then((list) => {
        setBatches(list);
        const init: Record<string, ManifestRowState> = {};
        for (const s of SOURCE_TYPES) {
          const latest = list.find((b) => b.sourceType === s.code);
          init[s.code] = {
            sourceBatchId: latest ? latest.id : '',
            isConfirmedNoMovement: !latest,
            notes: '',
          };
        }
        setManifest(init);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.message || 'Không tải được danh sách đợt nạp đã xác nhận.');
      })
      .finally(() => setLoadingBatches(false));
  }, [isOpen, defaultFrom, defaultTo, defaultAsOf]);

  if (!isOpen) return null;

  const updateRow = (code: string, patch: Partial<ManifestRowState>) => {
    setManifest((prev) => ({
      ...prev,
      [code]: { ...(prev[code] || { sourceBatchId: '', isConfirmedNoMovement: true, notes: '' }), ...patch },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datasetCode.trim() || !title.trim()) {
      setError('Vui lòng nhập Mã bản chốt và Tiêu đề.');
      return;
    }
    if (coverageFrom > coverageTo) {
      setError('Ngày bắt đầu kỳ không được sau ngày kết thúc kỳ.');
      return;
    }

    const manifestPayload = SOURCE_TYPES.map((s) => {
      const row = manifest[s.code] || { sourceBatchId: '', isConfirmedNoMovement: true, notes: '' };
      return {
        sourceType: s.code,
        sourceBatchId: row.isConfirmedNoMovement ? null : Number(row.sourceBatchId) || null,
        isConfirmedNoMovement: row.isConfirmedNoMovement,
        notes: row.notes.trim() || undefined,
      };
    });

    const invalidRow = manifestPayload.find((m) => !m.isConfirmedNoMovement && !m.sourceBatchId);
    if (invalidRow) {
      setError(`Nguồn ${invalidRow.sourceType} cần chọn một đợt nạp đã xác nhận hoặc tích "Không phát sinh".`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiV1.publishDataset({
        datasetCode: datasetCode.trim(),
        title: title.trim(),
        cutoffDate,
        coverageFrom,
        coverageTo,
        amendmentReason: amendmentReason.trim() || undefined,
        manifest: manifestPayload,
      });
      setSuccess(res.message || 'Đã tạo bản chốt dữ liệu thành công!');
      onCreated(res.id);
      setTimeout(() => onClose(), 900);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể tạo bản chốt dữ liệu.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30 flex items-center justify-center">
              <Archive size={16} />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Tạo Bản Chốt Dữ Liệu (Dataset Snapshot)</h2>
              <p className="text-xs text-slate-400">
                Đóng băng 5 nguồn dữ liệu đã xác nhận để lưu trữ và đối soát cố định theo kỳ báo cáo
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
          {error && (
            <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-center gap-2 font-semibold">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mã bản chốt *</label>
              <input
                type="text"
                required
                value={datasetCode}
                onChange={(e) => setDatasetCode(e.target.value)}
                placeholder="vd: DS-2026-11"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tiêu đề bản chốt *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="vd: Chốt số liệu tháng 11/2026"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Từ ngày kỳ *</label>
              <input type="date" required value={coverageFrom} onChange={(e) => setCoverageFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Đến ngày kỳ *</label>
              <input type="date" required value={coverageTo} onChange={(e) => setCoverageTo(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Ngày chốt số dư *</label>
              <input type="date" required value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Ghi chú / Lý do điều chỉnh (tùy chọn)</label>
            <input
              type="text"
              value={amendmentReason}
              onChange={(e) => setAmendmentReason(e.target.value)}
              placeholder="vd: Chốt báo cáo định kỳ cuối tháng"
              className={inputClass}
            />
          </div>

          {/* 5-source manifest */}
          <div className="space-y-2.5">
            <div className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
              Khai báo Manifest 5 nguồn dữ liệu (Bắt buộc đủ 5 nguồn)
            </div>
            {loadingBatches ? (
              <div className="p-6 text-center text-slate-400">Đang tải các đợt nạp đã xác nhận...</div>
            ) : (
              <div className="space-y-2">
                {SOURCE_TYPES.map((s) => {
                  const row = manifest[s.code] || { sourceBatchId: '', isConfirmedNoMovement: true, notes: '' };
                  const typeBatches = batches.filter((b) => b.sourceType === s.code);
                  return (
                    <div key={s.code} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">{s.label}</span>
                        <label className="inline-flex items-center gap-1.5 text-slate-600 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.isConfirmedNoMovement}
                            onChange={(e) => updateRow(s.code, { isConfirmedNoMovement: e.target.checked })}
                          />
                          <span>Xác nhận không phát sinh</span>
                        </label>
                      </div>
                      {!row.isConfirmedNoMovement && (
                        <select
                          value={row.sourceBatchId}
                          onChange={(e) => updateRow(s.code, { sourceBatchId: e.target.value ? Number(e.target.value) : '' })}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-900"
                        >
                          <option value="">-- Chọn đợt nạp đã xác nhận ({typeBatches.length}) --</option>
                          {typeBatches.map((b) => (
                            <option key={b.id} value={b.id}>
                              #{b.id} · {b.fileName} ({b.totalRows} dòng · ngày {b.sourceDate || 'N/A'})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || loadingBatches}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Đang công bố...' : 'Công bố bản chốt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
