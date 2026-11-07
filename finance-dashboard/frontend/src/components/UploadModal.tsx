import React, { useState } from 'react';
import { dashboardApi } from '../services/api';
import { UploadResult } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: UploadResult) => void;
}

export const UploadModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Vui lòng chọn file Excel.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.uploadExcel(file);
      setResult(res);
      onSuccess(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Upload thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="card" style={{ width: '560px', padding: '24px', background: '#112240', border: '1px solid #233554' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
            Import File Excel Báo cáo Tài chính
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>
            &times;
          </button>
        </div>

        <div style={{
          border: '2px dashed #334155',
          borderRadius: '8px',
          padding: '32px',
          textAlign: 'center',
          backgroundColor: '#0a192f',
          marginBottom: '20px',
        }}>
          <input
            type="file"
            id="excel-file-input"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <label htmlFor="excel-file-input" style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📁</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#38bdf8', marginBottom: '4px' }}>
              {file ? file.name : 'Nhấp để chọn file Excel hoặc kéo thả vào đây'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Hỗ trợ file .xlsx chứa 6 sheet (Tối đa 50MB)
            </div>
          </label>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#6ee7b7', padding: '16px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>✓ {result.message}</div>
            <div style={{ fontSize: '12px', color: '#a7f3d0', lineHeight: 1.6 }}>
              • Số hợp đồng nạp: <b>{result.totalRows.toLocaleString()}</b><br />
              • Nhân sự nạp: <b>{result.totalEmployees}</b> | Tất toán: <b>{result.totalEarlySettlements}</b><br />
              • Thời gian xử lý: <b>{result.elapsedSeconds} giây</b>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            Đóng
          </button>
          <button className="btn-primary" onClick={handleUpload} disabled={loading || !file}>
            {loading ? 'Đang phân tích & import...' : 'Tiến hành Import'}
          </button>
        </div>
      </div>
    </div>
  );
};
