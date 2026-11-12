import React, { useState, useEffect } from 'react';
import { ReportView } from '../types/v1';
import { apiV1 } from '../services/apiV1';
import { StockReportResponse } from '../types/v1';

interface Props extends ReportView {
  fromDate: string;
  toDate: string;
  datasetId?: string;
}

export const StocksSection: React.FC<Props> = ({ fromDate, toDate, datasetId, viewEmployeeId, view }) => {
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
  }, [fromDate, toDate, datasetId]);

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
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-100">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
            <span className="p-1 rounded-md bg-amber-50 text-amber-600">📜</span>
            <span>Báo Cáo Hợp Đồng Chứng Khoán (Báo Cáo Độc Lập)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Quản lý độc lập theo khóa nhận diện riêng (cho phép trùng số phụ lục như dòng BOND).
          </p>
        </div>

        <button
          onClick={fetchStocks}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <span>🔄</span>
          <span>Làm mới</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center space-x-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
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
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                    <span className="text-2xl block mb-1">📜</span>
                    <span>Chưa có dữ liệu hợp đồng chứng khoán trong kỳ này.</span>
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900">{item.appendixNumber}</td>
                    <td className="px-3.5 py-2.5 text-slate-600 font-mono">{item.customerCode}</td>
                    <td className="px-3.5 py-2.5 text-slate-900 font-semibold">{item.customerName}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-blue-900">{formatCurrency(item.contractValue)}</td>
                    <td className="px-3.5 py-2.5 text-right text-slate-600 font-medium">{formatCurrency(item.liquidatedAmount)}</td>
                    <td className="px-3.5 py-2.5 text-right font-extrabold text-emerald-800">{formatCurrency(item.balance)}</td>
                    <td className="px-3.5 py-2.5 text-center text-slate-500">{item.signDate}</td>
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
