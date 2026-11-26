import React, { useState } from 'react';
import {
  Upload,
  X,
  Zap,
  FileText,
  AlertTriangle,
  FolderUp,
  Search,
  BarChart3,
  AlertCircle,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiV1 } from '../services/apiV1';
import { ImportPreviewResponse } from '../types/v1';
import { MultiFileImportPanel } from './MultiFileImportPanel';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportV2Modal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [importMode, setImportMode] = useState<'multi' | 'single'>('multi');
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<string>('APPENDIX');
  const [sourceDate, setSourceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [reason, setReason] = useState<string>('Admin nạp dữ liệu định kỳ');
  const [rowResolutions, setRowResolutions] = useState<Record<number, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  // Keep idempotency key stable for the preview session
  const idempotencyKey = preview ? `confirm_${preview.previewId}_rev${preview.expectedRevision}` : '';

  const handleRowResolution = (itemId: number, action: string) => {
    setRowResolutions((prev) => ({ ...prev, [itemId]: action }));
  };

  const hasUnresolvedAmbiguous = preview?.items.some(
    (item) =>
      item.classification === 'AMBIGUOUS' &&
      !['LINK_EXISTING', 'CREATE_NEW', 'SKIP'].includes(rowResolutions[item.id] || item.resolutionAction)
  );

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setErrorMsg(null);
      setRowResolutions({});
      setFilterType('ALL');
    }
  };

  const handleUploadPreview = async () => {
    if (!file) {
      setErrorMsg('Vui lòng chọn file Excel.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setRowResolutions({});
    setFilterType('ALL');

    try {
      const res = await apiV1.uploadImportPreview(file, sourceType, sourceDate, effectiveDate);
      setPreview(res);
      // Auto-switch to INVALID filter if there are errors so user sees them immediately
      if (res.invalidRows > 0) {
        setFilterType('INVALID');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Lỗi khi phân tích file Excel.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;

    if (hasUnresolvedAmbiguous) {
      setErrorMsg('Vui lòng giải quyết toàn bộ các dòng AMBIGUOUS (chọn liên kết đối tượng hoặc bỏ qua) trước khi xác nhận.');
      return;
    }

    if (preview.invalidRows > 0) {
      const confirmed = window.confirm(
        `File Excel có ${preview.invalidRows} dòng lỗi sẽ tự động được BỎ QUA (không nạp).\n\nHệ thống sẽ nạp ${preview.totalRows - preview.invalidRows} dòng hợp lệ vào cơ sở dữ liệu.\n\nBạn có muốn tiếp tục xác nhận nạp không?`
      );
      if (!confirmed) return;
    }

    setConfirming(true);
    setErrorMsg(null);

    try {
      await apiV1.confirmImport(preview.previewId, {
        expectedRevision: preview.expectedRevision,
        idempotencyKey,
        reason,
        rowResolutions,
      });

      alert(`Đã xác nhận nạp thành công đợt ${preview.batchId} vào hệ thống!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.response?.status === 409 || err.response?.data?.message?.includes('Stale')) {
        setErrorMsg('Dữ liệu đã bị thay đổi (Stale Preview). Vui lòng phân tích lại file.');
      } else {
        setErrorMsg(err.response?.data?.message || 'Lỗi khi xác nhận nạp dữ liệu.');
      }
    } finally {
      setConfirming(false);
    }
  };

  const displayedItems = preview?.items.filter((item) => {
    if (filterType === 'ALL') return true;
    return item.classification === filterType;
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE] flex items-center justify-center shrink-0">
              <Upload size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-[#0F294A]">
                Nạp Dữ Liệu 6 Nguồn (Lean Schema Import &amp; Preview)
              </h2>
              <p className="text-xs text-slate-500">
                Phân loại tự động, phát hiện chi tiết dòng lỗi và ngăn ngừa nạp trùng lặp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="text-slate-400 hover:text-[#0F294A] hover:bg-slate-100 rounded-xl p-1.5 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-700 bg-[#F8FAFC]/40">
          {/* Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setImportMode('multi')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                  importMode === 'multi' ? 'bg-[#1D4ED8] text-white shadow-xs' : 'text-slate-600 hover:text-[#0F294A]'
                }`}
              >
                <Zap size={13} />
                <span>Nạp nhanh 5 file (PL / TT / CK / NL / NS)</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode('single')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                  importMode === 'single' ? 'bg-[#1D4ED8] text-white shadow-xs' : 'text-slate-600 hover:text-[#0F294A]'
                }`}
              >
                <FileText size={13} />
                <span>Nạp đơn file / Hợp đồng ma</span>
              </button>
            </div>

            {importMode === 'multi' && (
              <div className="flex items-center gap-2 text-xs">
                <label className="font-semibold text-slate-600">Ngày DL:</label>
                <input
                  type="date"
                  value={sourceDate}
                  onChange={(e) => { setSourceDate(e.target.value); setEffectiveDate(e.target.value); }}
                  className="border border-slate-200 rounded-lg px-2.5 py-1 bg-white font-semibold text-[#0F294A] tabular-nums"
                />
              </div>
            )}
          </div>

          {importMode === 'multi' ? (
            <MultiFileImportPanel
              sourceDate={sourceDate}
              effectiveDate={effectiveDate}
              onAnyConfirmed={onSuccess}
            />
          ) : (
          <>
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Configuration Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-[#0F294A] mb-1.5">Loại Nguồn Excel</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-full text-xs font-semibold border-slate-200 rounded-xl focus:border-[#1D4ED8] bg-white p-2.5 border text-[#0F294A]"
              >
                <option value="APPENDIX">1. Báo cáo Phụ lục (14 trường)</option>
                <option value="SETTLEMENT">2. Báo cáo Tất toán (12 trường)</option>
                <option value="STOCK">3. Bảng HĐ Chứng khoán (9 trường)</option>
                <option value="EXCEPTION">4. Bảng Ngoại lệ (15 trường)</option>
                <option value="EMPLOYEE">5. Bảng Nhân sự (11 trường)</option>
                <option value="GHOST">6. Danh sách Hợp đồng ma (Cấu trúc Phụ lục / Số PL)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F294A] mb-1.5">Ngày Báo Cáo / Dữ Liệu</label>
              <input
                type="date"
                value={sourceDate}
                onChange={(e) => setSourceDate(e.target.value)}
                className="w-full text-xs font-semibold border-slate-200 rounded-xl focus:border-[#1D4ED8] bg-white p-2.5 border text-[#0F294A] tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F294A] mb-1.5">Ngày Bắt Đầu Hiệu Lực</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full text-xs font-semibold border-slate-200 rounded-xl focus:border-[#1D4ED8] bg-white p-2.5 border text-[#0F294A] tabular-nums"
              />
            </div>
          </div>

          {/* File Picker */}
          <div className="border-2 border-dashed border-slate-300 hover:border-[#1D4ED8] rounded-2xl p-6 text-center transition-colors bg-white">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
              <div className="w-11 h-11 rounded-2xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center mb-1">
                <FolderUp size={22} />
              </div>
              <span className="text-sm font-bold text-[#0F294A]">
                {file ? file.name : 'Nhấp để chọn file Excel mẫu (hoặc kéo thả vào đây)'}
              </span>
              <span className="text-xs text-slate-400">
                Hỗ trợ .xlsx, .xls • Tự động đối chiếu header và loại bỏ các cột dư thừa
              </span>
            </label>
          </div>

          {file && !preview && (
            <div className="flex justify-end">
              <button
                onClick={handleUploadPreview}
                disabled={uploading}
                className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl font-semibold shadow-xs flex items-center gap-2 text-xs disabled:opacity-50 transition cursor-pointer"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang phân tích cấu trúc...</span>
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    <span>Xem trước dữ liệu (Preview)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Preview Results */}
          {preview && (
            <div className="space-y-4 border-t pt-4 border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-bold text-[#0F294A] text-sm flex items-center gap-2">
                  <BarChart3 size={16} className="text-[#1D4ED8]" />
                  <span>Kết quả xem trước: {preview.fileName}</span>
                  <span className="text-xs px-2.5 py-0.5 bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE] rounded-full font-semibold">
                    {preview.sourceType}
                  </span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  SHA256: {preview.fileSha256.substring(0, 16)}...
                </span>
              </div>

              {/* Status Badges Filter Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs tabular-nums">
                <button
                  type="button"
                  onClick={() => setFilterType('ALL')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer text-left ${
                    filterType === 'ALL'
                      ? 'bg-[#0F294A] text-white border-[#0F294A]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-extrabold text-base">{preview.totalRows}</div>
                  <div className="text-[11px] font-semibold">Tất cả dòng</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('NEW')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer text-left ${
                    filterType === 'NEW'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <div className="font-extrabold text-base">{preview.newRows}</div>
                  <div className="text-[11px] font-semibold">Mới (NEW)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('UNCHANGED')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer text-left ${
                    filterType === 'UNCHANGED'
                      ? 'bg-slate-600 text-white border-slate-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-extrabold text-base">{preview.unchangedRows}</div>
                  <div className="text-[11px] font-semibold">Không đổi</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('CHANGED')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer text-left ${
                    filterType === 'CHANGED'
                      ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                      : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE] hover:bg-blue-100'
                  }`}
                >
                  <div className="font-extrabold text-base">{preview.changedRows}</div>
                  <div className="text-[11px] font-semibold">Thay đổi (Sửa)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('AMBIGUOUS')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer text-left ${
                    filterType === 'AMBIGUOUS'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <div className="font-extrabold text-base">{preview.ambiguousRows}</div>
                  <div className="text-[11px] font-semibold">Mơ hồ (Cần chọn)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('INVALID')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer text-left ${
                    filterType === 'INVALID'
                      ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-500/30'
                      : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <div className="font-extrabold text-base">{preview.invalidRows}</div>
                  <div className="text-[11px] font-semibold">Lỗi (INVALID)</div>
                </button>
              </div>

              {/* DETAILED ERROR DISPLAY SECTION */}
              {preview.invalidRows > 0 && (
                <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle size={18} className="text-rose-600 shrink-0" />
                      <div>
                        <h4 className="font-bold text-rose-900 text-sm">
                          Chi Tiết {preview.invalidRows} Dòng Lỗi Dữ Liệu Trong File Excel
                        </h4>
                        <p className="text-xs text-rose-700">
                          Đối chiếu trực tiếp số dòng dưới đây với file Excel của bạn để sửa, hoặc chọn bỏ qua (SKIP) các dòng này để tiếp tục nạp.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFilterType('INVALID')}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
                    >
                      Lọc chỉ xem dòng lỗi
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-rose-200 divide-y divide-rose-100 max-h-56 overflow-y-auto text-xs">
                    {(preview.errors && preview.errors.length > 0
                      ? preview.errors
                      : preview.items.filter((i) => i.classification === 'INVALID')
                    ).map((errItem: any, idx: number) => {
                      const reasons = errItem.validationErrors || [];
                      return (
                        <div key={idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-rose-50/50">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-mono font-bold rounded-lg text-xs">
                              Dòng {errItem.rowIndex}
                            </span>
                            <span className="font-mono text-[#0F294A] font-semibold">
                              {errItem.entityKey ? `Khóa: ${errItem.entityKey}` : '(Không có số phụ lục / khóa)'}
                            </span>
                          </div>
                          <div className="text-rose-600 font-semibold space-y-0.5 sm:text-right">
                            {reasons.length > 0 ? (
                              reasons.map((r: string, rIdx: number) => (
                                <div key={rIdx} className="flex items-center sm:justify-end gap-1">
                                  <XCircle size={13} className="shrink-0" />
                                  <span>{r}</span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center sm:justify-end gap-1">
                                <XCircle size={13} className="shrink-0" />
                                <span>Dữ liệu không hợp lệ hoặc thiếu trường bắt buộc</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* General Warnings Banner */}
              {preview.warnings.length > 0 && preview.invalidRows === 0 && (
                <div className="bg-amber-50 p-3.5 rounded-xl text-xs text-amber-800 space-y-1 border border-amber-200">
                  {preview.warnings.map((w, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Sample / Filtered Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="bg-[#F8FAFC] px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-semibold text-[#0F294A] text-xs">
                    Danh sách hiển thị: {displayedItems.length} dòng{' '}
                    {filterType !== 'ALL' && `(Đang lọc: ${filterType})`}
                  </span>
                  {filterType !== 'ALL' && (
                    <button
                      onClick={() => setFilterType('ALL')}
                      className="text-xs text-[#1D4ED8] hover:underline font-semibold cursor-pointer"
                    >
                      Bỏ lọc (Xem tất cả)
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-[#F8FAFC] sticky top-0 z-10">
                      <tr>
                        <th className="px-3.5 py-2.5 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px] w-16">
                          Dòng
                        </th>
                        <th className="px-3.5 py-2.5 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">
                          Khóa (Key)
                        </th>
                        <th className="px-3.5 py-2.5 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">
                          Phân loại &amp; Chi tiết thay đổi / Lỗi
                        </th>
                        <th className="px-3.5 py-2.5 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px] w-36">
                          Hành động xử lý
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {displayedItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-slate-400">
                            Không có dòng nào thuộc phân loại {filterType}
                          </td>
                        </tr>
                      ) : (
                        displayedItems.map((item) => {
                          const currentAction = rowResolutions[item.id] || item.resolutionAction;
                          const isInvalid = item.classification === 'INVALID';
                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${
                                isInvalid ? 'bg-rose-50/60 hover:bg-rose-50' : 'hover:bg-[#EFF6FF]/40'
                              }`}
                            >
                              <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-700 tabular-nums">{item.rowIndex}</td>
                              <td className="px-3.5 py-2.5 font-mono font-bold text-[#0F294A]">
                                {item.entityKey || <span className="text-slate-400 italic">Trống</span>}
                              </td>
                              <td className="px-3.5 py-2.5">
                                <div className="flex flex-col space-y-1">
                                  <div>
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                        item.classification === 'NEW'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : item.classification === 'UNCHANGED'
                                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                                          : item.classification === 'CHANGED'
                                          ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE]'
                                          : item.classification === 'AMBIGUOUS'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-rose-100 text-rose-800 border-rose-300'
                                      }`}
                                    >
                                      {item.classification}
                                    </span>
                                  </div>

                                  {item.diffData && (
                                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg font-mono border border-slate-200/80">
                                      {Object.entries(item.diffData).map(([k, v]: [string, any]) => (
                                        <div key={k}>
                                          <span className="font-bold text-slate-700">{k}:</span>{' '}
                                          <span className="line-through text-rose-500">{v.Old ?? 'null'}</span> →{' '}
                                          <span className="text-emerald-600 font-bold">{v.New ?? 'null'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {item.validationErrors.length > 0 && (
                                    <div className="text-[11px] text-rose-600 space-y-0.5 font-medium bg-rose-50 p-1.5 rounded-md border border-rose-200">
                                      {item.validationErrors.map((err, eIdx) => (
                                        <div key={eIdx} className="flex items-center gap-1">
                                          <XCircle size={12} className="shrink-0" />
                                          <span>{err}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-3.5 py-2.5">
                                {isInvalid ? (
                                  <span className="text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-block">
                                    Tự động Bỏ qua (SKIP)
                                  </span>
                                ) : item.classification === 'AMBIGUOUS' ? (
                                  <select
                                    value={currentAction}
                                    onChange={(e) => handleRowResolution(item.id, e.target.value)}
                                    className="w-full text-xs border border-amber-300 rounded-lg p-1.5 bg-amber-50 text-amber-900 font-semibold"
                                  >
                                    <option value="AMBIGUOUS">-- Chọn xử lý --</option>
                                    <option value="LINK_EXISTING">Gắn đối tượng cũ</option>
                                    <option value="CREATE_NEW">Tạo bản ghi mới</option>
                                    <option value="SKIP">Bỏ qua (SKIP)</option>
                                  </select>
                                ) : (
                                  <select
                                    value={currentAction}
                                    onChange={(e) => handleRowResolution(item.id, e.target.value)}
                                    className="w-full text-xs border border-slate-200 rounded-lg p-1.5 bg-white font-semibold text-[#0F294A]"
                                  >
                                    <option value="ACCEPT">Lưu thay đổi (ACCEPT)</option>
                                    <option value="SKIP">Bỏ qua (SKIP)</option>
                                  </select>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confirm Controls */}
              <div className="bg-white p-4 rounded-xl space-y-3 border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-[#0F294A] mb-1">
                    Lý do lưu thay đổi (Audit log reason):
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full text-xs font-semibold border-slate-200 rounded-xl p-2.5 border bg-white text-[#0F294A]"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-slate-500 font-medium">
                    {preview.invalidRows > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>
                          Có {preview.invalidRows} dòng lỗi sẽ được bỏ qua, chỉ nạp {preview.totalRows - preview.invalidRows} dòng hợp lệ.
                        </span>
                      </span>
                    ) : (
                      <span>Sẵn sàng nạp {preview.totalRows} dòng vào hệ thống.</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreview(null)}
                      className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                    >
                      Hủy xem trước
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={confirming || hasUnresolvedAmbiguous}
                      className={`px-5 py-2.5 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 ${
                        preview.invalidRows > 0
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-[#1D4ED8] hover:bg-[#1E40AF]'
                      }`}
                    >
                      {confirming ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Đang lưu vào hệ thống...</span>
                        </>
                      ) : (
                        <>
                          {preview.invalidRows > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                          <span>
                            {preview.invalidRows > 0
                              ? `Bỏ qua ${preview.invalidRows} dòng lỗi & Nạp ${preview.totalRows - preview.invalidRows} dòng`
                              : 'Xác nhận lưu vào CSDL'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};
