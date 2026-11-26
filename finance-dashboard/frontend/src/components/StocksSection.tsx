import React, { useState, useEffect } from 'react';
import { Landmark, RefreshCw, AlertTriangle } from 'lucide-react';
import { ReportView } from '../types/v1';
import { apiV1 } from '../services/apiV1';
import { StockReportResponse } from '../types/v1';

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

  const fetchStocks = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiV1.getStocks({ fromDate, toDate, datasetId, viewEmployeeId, view });
      setData(res);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Lỗi khi tải báo cáo hợp đồng chứng khoán.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, [fromDate, toDate, datasetId, viewEmployeeId, view, refreshKey]);

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

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-100">
        <div>
          <h2 className="text-base font-bold text-[#0F294A] flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center">
              <Landmark size={17} />
            </span>
            <span>Báo Cáo Hợp Đồng Chứng Khoán (Báo Cáo Độc Lập)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Quản lý độc lập theo khóa nhận diện riêng (cho phép trùng số phụ lục như dòng BOND).
          </p>
        </div>

        <button
          onClick={fetchStocks}
          className="px-3.5 py-1.5 bg-[#EFF6FF] hover:bg-blue-100 text-[#1D4ED8] border border-[#DBEAFE] rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI 3 Cards for Stocks */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#BFDBFE] p-4 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Tổng Giá Trị Gốc HĐ CK
          </div>
          <div className="text-xl font-extrabold text-[#0F294A] tracking-tight tabular-nums">
            {formatCurrency(data?.totalContractValue)}
          </div>
          <div className="text-[11px] text-[#1D4ED8] font-semibold mt-1 tabular-nums">
            {data?.totalContracts ?? '—'} hợp đồng phát sinh
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Đã Thanh Lý CK
          </div>
          <div className="text-xl font-extrabold text-[#0F294A] tracking-tight tabular-nums">
            {formatCurrency(data?.totalLiquidated)}
          </div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1 tabular-nums">
            {data?.totalCustomers ?? '—'} khách hàng liên quan
          </div>
        </div>

        <div className="bg-white border border-[#BFDBFE] p-4 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Số Dư Chứng Khoán Còn Lại
          </div>
          <div className="text-xl font-extrabold text-[#0284C7] tracking-tight tabular-nums">
            {formatCurrency(data?.totalBalance)}
          </div>
          <div className="text-[11px] text-[#1D4ED8] font-semibold mt-1">
            Gốc − Đã thanh lý
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200/90 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-[#F8FAFC]">
              <tr>
                <th className="px-3.5 py-3 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Số Phụ Lục</th>
                <th className="px-3.5 py-3 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Mã KH</th>
                <th className="px-3.5 py-3 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Tên Khách Hàng</th>
                <th className="px-3.5 py-3 text-right font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Giá Trị Gốc</th>
                <th className="px-3.5 py-3 text-right font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Đã Thanh Lý</th>
                <th className="px-3.5 py-3 text-right font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Số Dư Còn Lại</th>
                <th className="px-3.5 py-3 text-center font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">Ngày Ký</th>
                <th className="px-3.5 py-3 text-left font-semibold text-[#0F294A] uppercase tracking-wider text-[11px]">ID Sale</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-7 h-7 border-3 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium">Đang tải báo cáo chứng khoán...</span>
                    </div>
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Landmark size={24} className="text-slate-300" />
                      <span>Chưa có dữ liệu hợp đồng chứng khoán trong kỳ này.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#EFF6FF]/50 transition-colors">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-[#0F294A]">{item.appendixNumber}</td>
                    <td className="px-3.5 py-2.5 text-slate-600 font-mono">{item.customerCode}</td>
                    <td className="px-3.5 py-2.5 text-[#0F294A] font-semibold">{item.customerName}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-[#0F294A] tabular-nums">{formatCurrency(item.contractValue)}</td>
                    <td className="px-3.5 py-2.5 text-right text-slate-600 font-medium tabular-nums">{formatCurrency(item.liquidatedAmount)}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-[#0284C7] tabular-nums">{formatCurrency(item.balance)}</td>
                    <td className="px-3.5 py-2.5 text-center text-slate-500 tabular-nums">{item.signDate}</td>
                    <td className="px-3.5 py-2.5 text-slate-600 font-mono">{item.saleId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
