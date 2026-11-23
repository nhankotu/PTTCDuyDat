import React, { useState, useEffect, useMemo } from 'react';
import { Download, RefreshCw, Search, ChevronLeft, ChevronRight, Landmark } from 'lucide-react';
import { ReportView, StockReportResponse } from '../types/v1';
import { apiV1 } from '../services/apiV1';

interface Props extends ReportView {
  fromDate: string;
  toDate: string;
  datasetId?: string;
  refreshKey?: number;
}

export const StocksSection: React.FC<Props> = ({ fromDate, toDate, datasetId, viewEmployeeId, view, refreshKey }) => {
  const [data, setData] = useState<StockReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const fetchStocks = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiV1.getStocks({ fromDate, toDate, datasetId, viewEmployeeId, view });
      setData(res);
      setPage(1);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Lỗi khi tải báo cáo hợp đồng chứng khoán.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, [fromDate, toDate, datasetId, viewEmployeeId, view, refreshKey]);

  const filteredItems = useMemo(() => {
    const items = data?.items || [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        (item.appendixNumber || '').toLowerCase().includes(q) ||
        (item.customerCode || '').toLowerCase().includes(q) ||
        (item.customerName || '').toLowerCase().includes(q) ||
        (item.saleId || '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const formatCurrency = (valStr: string | null | undefined) => {
    if (valStr === null) return 'Không có quyền';
    if (valStr === undefined) return 'Chưa có dữ liệu';
    const num = parseFloat(valStr);
    if (isNaN(num)) return '0 đ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleExportCsv = () => {
    if (!filteredItems.length) return;
    const headers = ['Số Phụ Lục', 'Mã KH', 'Tên Khách Hàng', 'Giá Trị Gốc', 'Đã Thanh Lý', 'Số Dư Còn Lại', 'Ngày Ký', 'ID Sale'];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filteredItems.map((item) => [
      item.appendixNumber,
      item.customerCode,
      item.customerName,
      item.contractValue ?? '',
      item.liquidatedAmount ?? '',
      item.balance ?? '',
      item.signDate,
      item.saleId,
    ].map(escape).join(','));
    const csv = '\uFEFF' + [headers.map(escape).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chung_khoan_${fromDate}_${toDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-100">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <Landmark size={18} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Báo Cáo Hợp Đồng Chứng Khoán (Báo Cáo Độc Lập)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Quản lý độc lập theo khóa nhận diện riêng (cho phép trùng số phụ lục như dòng BOND).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCsv}
            disabled={loading || filteredItems.length === 0}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download size={14} />
            <span>Xuất CSV</span>
          </button>
          <button
            onClick={fetchStocks}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* KPI 3 Cards for Stocks */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-blue-200/80 p-4 rounded-2xl shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            Tổng Giá Trị Gốc HĐ CK
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            {formatCurrency(data?.totalContractValue)}
          </div>
          <div className="text-[11px] text-blue-600 font-semibold mt-1">
            {data?.totalContracts ?? '—'} hợp đồng phát sinh
          </div>
        </div>

        <div className="bg-white border border-purple-200/80 p-4 rounded-2xl shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-600" />
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            Đã Thanh Lý CK
          </div>
          <div className="text-xl font-black text-purple-950 tracking-tight">
            {formatCurrency(data?.totalLiquidated)}
          </div>
          <div className="text-[11px] text-purple-600 font-semibold mt-1">
            {data?.totalCustomers ?? '—'} khách hàng liên quan
          </div>
        </div>

        <div className="bg-white border border-emerald-200/80 p-4 rounded-2xl shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            Số Dư Chứng Khoán Còn Lại
          </div>
          <div className="text-xl font-black text-emerald-950 tracking-tight">
            {formatCurrency(data?.totalBalance)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            Gốc − Đã thanh lý
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm theo số phụ lục, mã KH, tên khách hàng, ID Sale..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Hiển thị <strong>{filteredItems.length.toLocaleString('vi-VN')}</strong> hợp đồng
        </span>
      </div>

      {/* Table */}
      <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-3.5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Số Phụ Lục</th>
                <th className="px-3.5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Mã KH</th>
                <th className="px-3.5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">Tên Khách Hàng</th>
                <th className="px-3.5 py-3 text-right font-bold text-slate-600 uppercase tracking-wider text-[11px]">Giá Trị Gốc</th>
                <th className="px-3.5 py-3 text-right font-bold text-slate-600 uppercase tracking-wider text-[11px]">Đã Thanh Lý</th>
                <th className="px-3.5 py-3 text-right font-bold text-slate-600 uppercase tracking-wider text-[11px]">Số Dư Còn Lại</th>
                <th className="px-3.5 py-3 text-center font-bold text-slate-600 uppercase tracking-wider text-[11px]">Ngày Ký</th>
                <th className="px-3.5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider text-[11px]">ID Sale</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-7 h-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium">Đang tải báo cáo chứng khoán...</span>
                    </div>
                  </td>
                </tr>
              ) : pagedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                    Chưa có dữ liệu hợp đồng chứng khoán phù hợp trong kỳ này.
                  </td>
                </tr>
              ) : (
                pagedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900">{item.appendixNumber}</td>
                    <td className="px-3.5 py-2.5 text-slate-600 font-mono">{item.customerCode}</td>
                    <td className="px-3.5 py-2.5 text-slate-900 font-semibold">{item.customerName}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-blue-900 tabular-nums">{formatCurrency(item.contractValue)}</td>
                    <td className="px-3.5 py-2.5 text-right text-slate-600 font-medium tabular-nums">{formatCurrency(item.liquidatedAmount)}</td>
                    <td className="px-3.5 py-2.5 text-right font-extrabold text-emerald-800 tabular-nums">{formatCurrency(item.balance)}</td>
                    <td className="px-3.5 py-2.5 text-center text-slate-500">{item.signDate}</td>
                    <td className="px-3.5 py-2.5 text-slate-600 font-mono">{item.saleId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
          <span>
            {filteredItems.length.toLocaleString('vi-VN')} kết quả · Trang {page}/{totalPages}
          </span>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5">
              <span>Số dòng</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border border-slate-300 rounded-lg px-2 py-1 bg-white"
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 border border-slate-300 rounded-lg disabled:opacity-40 cursor-pointer"
              aria-label="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 border border-slate-300 rounded-lg disabled:opacity-40 cursor-pointer"
              aria-label="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
