import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, XCircle, ShieldPlus, Trash2, RefreshCw, AlertCircle, Clock, Send
} from 'lucide-react';
import { apiV1 } from '../services/apiV1';
import { AccessRequestItem, PeerGrantItem } from '../types/v1';
import { UserAccount, TreeFlatNode } from '../types';

interface Props {
  users: UserAccount[];
  flatNodes: TreeFlatNode[];
}

export const PeerAccessManager: React.FC<Props> = ({ users, flatNodes }) => {
  const [requests, setRequests] = useState<AccessRequestItem[]>([]);
  const [grants, setGrants] = useState<PeerGrantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reqFilter, setReqFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Review inline state
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewValidTo, setReviewValidTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toLocaleDateString('en-CA');
  });
  const [reviewBusy, setReviewBusy] = useState(false);

  // Create Peer Grant form state
  const [grantUserId, setGrantUserId] = useState<number | ''>('');
  const [grantTargetEmpId, setGrantTargetEmpId] = useState('');
  const [grantRevenue, setGrantRevenue] = useState(true);
  const [grantBalance, setGrantBalance] = useState(true);
  const [grantValidFrom, setGrantValidFrom] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [grantValidTo, setGrantValidTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toLocaleDateString('en-CA');
  });
  const [grantReason, setGrantReason] = useState('');
  const [grantSubmitting, setGrantSubmitting] = useState(false);

  // Revoke inline state
  const [revokingGrantId, setRevokingGrantId] = useState<number | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  // Quick Create Request form (for testing / submitting a new request)
  const [showNewReqForm, setShowNewReqForm] = useState(false);
  const [reqTargetEmpId, setReqTargetEmpId] = useState('');
  const [reqRevenue, setReqRevenue] = useState(true);
  const [reqBalance, setReqBalance] = useState(false);
  const [reqReason, setReqReason] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);

  const employeeNodes = flatNodes.filter((n) => n.scopeType === 'EMPLOYEE_SUBTREE');

  const userNameMap = new Map(users.map((u) => [u.id, `${u.username} (${u.fullName || 'N/A'})`]));
  const empNameMap = new Map(employeeNodes.map((n) => [n.id, `${n.label} [${n.position}]`]));

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, grs] = await Promise.all([
        apiV1.getAccessRequests(),
        apiV1.getPeerGrants(),
      ]);
      setRequests(reqs);
      setGrants(grs);
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.response?.data?.message || 'Không tải được dữ liệu yêu cầu & quyền ngang hàng.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReview = async (id: number, isApproved: boolean) => {
    setReviewBusy(true);
    setBanner(null);
    try {
      await apiV1.reviewAccessRequest(id, {
        isApproved,
        reviewNotes: reviewNotes.trim() || (isApproved ? 'Đã phê duyệt' : 'Từ chối yêu cầu'),
        validTo: isApproved && reviewValidTo ? reviewValidTo : undefined,
      });
      setBanner({
        type: 'success',
        text: isApproved ? `Đã phê duyệt đơn #${id} và tự động cấp quyền ngang hàng.` : `Đã từ chối đơn #${id}.`,
      });
      setReviewingId(null);
      setReviewNotes('');
      await loadData();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.response?.data?.message || 'Lỗi khi xử lý đơn.' });
    } finally {
      setReviewBusy(false);
    }
  };

  const handleCreatePeerGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUserId || !grantTargetEmpId || !grantReason.trim()) {
      setBanner({ type: 'error', text: 'Vui lòng chọn người dùng, nhân sự mục tiêu và nhập lý do cấp quyền.' });
      return;
    }
    if (!grantRevenue && !grantBalance) {
      setBanner({ type: 'error', text: 'Vui lòng chọn ít nhất một chỉ tiêu (Doanh số hoặc Số dư).' });
      return;
    }

    setGrantSubmitting(true);
    setBanner(null);
    try {
      await apiV1.createPeerGrant({
        userId: Number(grantUserId),
        targetEmployeeId: grantTargetEmpId,
        grantRevenue,
        grantBalance,
        validFrom: grantValidFrom,
        validTo: grantValidTo,
        grantReason: grantReason.trim(),
      });
      setBanner({ type: 'success', text: 'Đã cấp quyền xem ngang hàng thành công!' });
      setGrantUserId('');
      setGrantTargetEmpId('');
      setGrantReason('');
      await loadData();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.response?.data?.message || 'Không thể cấp quyền ngang hàng.' });
    } finally {
      setGrantSubmitting(false);
    }
  };

  const handleRevokeGrant = async (id: number) => {
    setBanner(null);
    try {
      await apiV1.revokePeerGrant(id, revokeReason.trim() || 'Thu hồi bởi Admin');
      setBanner({ type: 'success', text: `Đã thu hồi quyền ngang hàng #${id}.` });
      setRevokingGrantId(null);
      setRevokeReason('');
      await loadData();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.response?.data?.message || 'Lỗi khi thu hồi quyền.' });
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTargetEmpId || !reqReason.trim() || (!reqRevenue && !reqBalance)) {
      setBanner({ type: 'error', text: 'Vui lòng chọn nhân sự, ít nhất 1 chỉ tiêu và lý do.' });
      return;
    }
    setReqSubmitting(true);
    setBanner(null);
    try {
      await apiV1.createAccessRequest({
        targetEmployeeId: reqTargetEmpId,
        requestRevenue: reqRevenue,
        requestBalance: reqBalance,
        reason: reqReason.trim(),
      });
      setBanner({ type: 'success', text: 'Đã gửi đơn xin cấp quyền xem ngang hàng.' });
      setShowNewReqForm(false);
      setReqTargetEmpId('');
      setReqReason('');
      await loadData();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.response?.data?.message || 'Không thể gửi đơn yêu cầu.' });
    } finally {
      setReqSubmitting(false);
    }
  };

  const filteredRequests = reqFilter === 'ALL' ? requests : requests.filter((r) => r.status === reqFilter);
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  const inputClass =
    'w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20';

  return (
    <div className="space-y-6">
      {banner && (
        <div
          role={banner.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs font-semibold border ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      {/* SECTION A: ACCESS REQUESTS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Clock size={17} className="text-amber-600" />
              <span>Đơn Xin Cấp Quyền Ngang Hàng</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {pendingCount} chờ duyệt
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Phê duyệt hoặc từ chối yêu cầu xem số liệu Doanh số / Số dư của nhân sự ngoài nhánh trực thuộc.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-bold">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setReqFilter(st)}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition ${
                    reqFilter === st ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  {st === 'ALL' ? 'Tất cả' : st === 'PENDING' ? 'Chờ duyệt' : st === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowNewReqForm((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold cursor-pointer"
            >
              <Send size={13} /> Tạo đơn mới
            </button>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              title="Làm mới"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {showNewReqForm && (
          <form onSubmit={handleCreateRequest} className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 space-y-3 text-xs">
            <div className="font-bold text-purple-900">Gửi yêu cầu xin quyền truy cập ngang hàng</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nhân sự muốn xem *</label>
                <select required value={reqTargetEmpId} onChange={(e) => setReqTargetEmpId(e.target.value)} className={inputClass}>
                  <option value="">-- Chọn nhân sự --</option>
                  {employeeNodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.label} [{n.position}] (#{n.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chỉ tiêu đề nghị</label>
                <div className="flex items-center gap-4 pt-2">
                  <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                    <input type="checkbox" checked={reqRevenue} onChange={(e) => setReqRevenue(e.target.checked)} /> Doanh số
                  </label>
                  <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                    <input type="checkbox" checked={reqBalance} onChange={(e) => setReqBalance(e.target.checked)} /> Số dư
                  </label>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lý do *</label>
                <input required value={reqReason} onChange={(e) => setReqReason(e.target.value)} placeholder="vd: Hỗ trợ đối soát chéo" className={inputClass} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewReqForm(false)} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold cursor-pointer">Hủy</button>
              <button type="submit" disabled={reqSubmitting} className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer disabled:opacity-50">
                {reqSubmitting ? 'Đang gửi...' : 'Gửi đơn'}
              </button>
            </div>
          </form>
        )}

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Đơn #</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Người yêu cầu</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Nhân sự mục tiêu</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Quyền xin</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Lý do</th>
                  <th className="px-3.5 py-2.5 text-center font-bold text-slate-600">Trạng thái</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-slate-600">Xử lý</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">Đang tải danh sách đơn...</td></tr>
                ) : filteredRequests.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">Chưa có đơn yêu cầu nào.</td></tr>
                ) : (
                  filteredRequests.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-3.5 py-2.5 font-mono text-slate-500">#{r.id}</td>
                        <td className="px-3.5 py-2.5 font-semibold text-slate-800">{userNameMap.get(r.requestingUserId) || `User #${r.requestingUserId}`}</td>
                        <td className="px-3.5 py-2.5 font-semibold text-blue-800">{empNameMap.get(r.targetEmployeeId) || `#${r.targetEmployeeId}`}</td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex gap-1">
                            {r.requestRevenue && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">Doanh số</span>}
                            {r.requestBalance && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Số dư</span>}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] border ${
                            r.status === 'PENDING' ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : r.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {r.status === 'PENDING' ? 'Chờ duyệt' : r.status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {r.status === 'PENDING' ? (
                            <button
                              type="button"
                              onClick={() => { setReviewingId(reviewingId === r.id ? null : r.id); setReviewNotes(''); }}
                              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer"
                            >
                              Xét duyệt
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">{r.reviewedBy ? `Bởi ${r.reviewedBy}` : '—'}</span>
                          )}
                        </td>
                      </tr>
                      {reviewingId === r.id && (
                        <tr className="bg-purple-50/50">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <div className="flex-1 min-w-[200px]">
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Ghi chú xét duyệt</label>
                                <input value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Nhập ghi chú duyệt hoặc lý do từ chối..." className={inputClass} />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Hiệu lực đến ngày</label>
                                <input type="date" value={reviewValidTo} onChange={(e) => setReviewValidTo(e.target.value)} className={inputClass} />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={reviewBusy}
                                  onClick={() => handleReview(r.id, true)}
                                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50"
                                >
                                  <CheckCircle2 size={14} /> Phê duyệt
                                </button>
                                <button
                                  type="button"
                                  disabled={reviewBusy}
                                  onClick={() => handleReview(r.id, false)}
                                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer disabled:opacity-50"
                                >
                                  <XCircle size={14} /> Từ chối
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION B: PEER GRANTS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldPlus size={17} className="text-blue-600" />
            <span>Cấp & Quản Lý Quyền Xem Ngang Hàng (Peer Grants)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấp quyền có thời hạn cho một tài khoản xem riêng Doanh số hoặc Số dư của một nhân sự cụ thể ngoài phạm vi cây trực thuộc.
          </p>
        </div>

        {/* Direct Peer Grant Form */}
        <form onSubmit={handleCreatePeerGrant} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
          <div className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Cấp quyền ngang hàng trực tiếp</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tài khoản được cấp *</label>
              <select required value={grantUserId} onChange={(e) => setGrantUserId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
                <option value="">-- Chọn tài khoản --</option>
                {users.filter((u) => u.role !== 'admin').map((u) => (
                  <option key={u.id} value={u.id}>{u.username} ({u.fullName || 'N/A'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nhân sự mục tiêu *</label>
              <select required value={grantTargetEmpId} onChange={(e) => setGrantTargetEmpId(e.target.value)} className={inputClass}>
                <option value="">-- Chọn nhân sự --</option>
                {employeeNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.label} [{n.position}] (#{n.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Từ ngày *</label>
              <input type="date" required value={grantValidFrom} onChange={(e) => setGrantValidFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Đến ngày *</label>
              <input type="date" required value={grantValidTo} onChange={(e) => setGrantValidTo(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                <input type="checkbox" checked={grantRevenue} onChange={(e) => setGrantRevenue(e.target.checked)} /> Quyền xem Doanh số
              </label>
              <label className="inline-flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                <input type="checkbox" checked={grantBalance} onChange={(e) => setGrantBalance(e.target.checked)} /> Quyền xem Số dư
              </label>
              <input
                required
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="Lý do cấp quyền *"
                className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-900 min-w-[240px]"
              />
            </div>

            <button
              type="submit"
              disabled={grantSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer disabled:opacity-50"
            >
              <ShieldPlus size={14} />
              <span>{grantSubmitting ? 'Đang cấp...' : 'Cấp quyền ngang hàng'}</span>
            </button>
          </div>
        </form>

        {/* Grants Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">ID</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Tài khoản</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Nhân sự mục tiêu</th>
                  <th className="px-3.5 py-2.5 text-left font-bold text-slate-600">Chỉ tiêu</th>
                  <th className="px-3.5 py-2.5 text-center font-bold text-slate-600">Hiệu lực</th>
                  <th className="px-3.5 py-2.5 text-center font-bold text-slate-600">Trạng thái</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-slate-600">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">Đang tải danh sách quyền...</td></tr>
                ) : grants.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">Chưa có quyền ngang hàng nào được cấp.</td></tr>
                ) : (
                  grants.map((g) => (
                    <React.Fragment key={g.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-3.5 py-2.5 font-mono text-slate-500">#{g.id}</td>
                        <td className="px-3.5 py-2.5 font-semibold text-slate-800">{userNameMap.get(g.userId) || `User #${g.userId}`}</td>
                        <td className="px-3.5 py-2.5 font-semibold text-blue-800">{empNameMap.get(g.targetEmployeeId) || `#${g.targetEmployeeId}`}</td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex gap-1">
                            {g.grantRevenue && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">Doanh số</span>}
                            {g.grantBalance && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Số dư</span>}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-center text-slate-600 font-mono">{g.validFrom} → {g.validTo}</td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] border ${
                            g.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : g.status === 'REVOKED' ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {g.status === 'ACTIVE' ? 'Đang hiệu lực' : g.status === 'REVOKED' ? 'Đã thu hồi' : 'Hết hạn'}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {g.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              onClick={() => { setRevokingGrantId(revokingGrantId === g.id ? null : g.id); setRevokeReason(''); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer"
                            >
                              <Trash2 size={12} /> Thu hồi
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">{g.revokedBy ? `Bởi ${g.revokedBy}` : '—'}</span>
                          )}
                        </td>
                      </tr>
                      {revokingGrantId === g.id && (
                        <tr className="bg-rose-50/50">
                          <td colSpan={7} className="px-4 py-2.5">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <input
                                value={revokeReason}
                                onChange={(e) => setRevokeReason(e.target.value)}
                                placeholder="Lý do thu hồi (tùy chọn)..."
                                className="text-xs border border-rose-300 rounded-lg px-3 py-1.5 bg-white text-slate-900 min-w-[240px]"
                              />
                              <button type="button" onClick={() => setRevokingGrantId(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold cursor-pointer">Hủy</button>
                              <button type="button" onClick={() => handleRevokeGrant(g.id)} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer">Xác nhận thu hồi</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
