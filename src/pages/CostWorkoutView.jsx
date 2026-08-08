import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  Ban,
  Calculator,
  Check,
  CheckCircle,
  Copy,
  Download,
  FileDown,
  FileText,
  Loader2,
  Mail,
  Pencil,
  Printer,
  RotateCcw,
  Send,
  Share2,
  Trash2
} from 'lucide-react';
import { ConfirmDialog, Modal, useToast } from '../components/Common';
import useCostWorkouts from '../hooks/useCostWorkouts';
import costWorkoutService from '../services/costWorkoutService';
import { normalizeCw, cwStatusMeta, cwDocument, shareCw, emailCw } from '../utils/costWorkoutHelpers';
import { formatDate, formatINR, formatRelativeTime } from '../utils/leadHelpers';

export default function CostWorkoutView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const { submitCw, approveCw, rejectCw, duplicateCw, archiveCw, deleteCw, restoreCw } = useCostWorkouts({ autoLoad: false });

  const [cw, setCw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [confirm, setConfirm] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [actionModal, setActionModal] = useState(null); // 'approve' | 'reject'
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [itemsRows, setItemsRows] = useState(null);
  const [timelineRows, setTimelineRows] = useState(null);

  // Lazy-load items from the dedicated endpoint when the tab is opened.
  useEffect(() => {
    if (tab !== 'items') return;
    let cancelled = false;
    costWorkoutService
      .getItems(id)
      .then((res) => {
        if (!cancelled && Array.isArray(res)) setItemsRows(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, id]);

  // Lazy-load the persisted activity timeline from the dedicated endpoint.
  useEffect(() => {
    if (tab !== 'timeline') return;
    let cancelled = false;
    costWorkoutService
      .getTimeline(id)
      .then((res) => {
        if (!cancelled && Array.isArray(res)) setTimelineRows(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, id]);

  // Lazy-load attachments when the tab is opened (ERP lazyLoadAttachments)
  useEffect(() => {
    if (tab !== 'attachments') return;
    let cancelled = false;
    const loadAttachments = async () => {
      setAttachmentsLoading(true);
      try {
        const res = await costWorkoutService.getAttachments(id);
        if (!cancelled) setAttachments(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setAttachments([]);
      } finally {
        if (!cancelled) setAttachmentsLoading(false);
      }
    };
    loadAttachments();
    return () => {
      cancelled = true;
    };
  }, [tab, id]);

  const load = async () => {
    const res = await costWorkoutService.getCw(id);
    setCw(normalizeCw(res?.data ?? res));
    setError(null);
  };

  useEffect(() => {
    let cancelled = false;
    costWorkoutService
      .getCw(id)
      .then((res) => {
        if (cancelled) return;
        setCw(normalizeCw(res?.data ?? res));
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load Cost Workout');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const doc = useMemo(() => (cw ? cwDocument(cw) : null), [cw]);

  const status = String(cw?.status || 'draft').toLowerCase();
  const meta = cwStatusMeta(cw?.status);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <Loader2 className="w-6 h-6 text-[#0B4A3D] animate-spin" />
      </div>
    );
  }

  if (error || !cw) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
        <Calculator className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-base font-bold text-slate-700 mb-1.5">Cost Workout not found</h3>
        <p className="text-xs text-slate-400 mb-5">{error || 'The requested Cost Workout does not exist.'}</p>
        <button
          type="button"
          onClick={() => navigate('/cost-workouts')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          Back to Cost Workouts
        </button>
      </div>
    );
  }

  const canEdit = ['draft', 'completed', 'rejected'].includes(status);
  const canSubmit = ['draft', 'completed', 'rejected'].includes(status);
  const canApprove = status === 'submitted';
  const canDuplicate = status !== 'deleted';

  const runAction = async (fn, successMsg) => {
    setBusy(true);
    const res = await fn(cw.id);
    setBusy(false);
    if (res.ok) {
      toast.success(successMsg);
      setConfirm(null);
      load();
    } else {
      toast.error(res.error?.message || 'Operation failed');
    }
  };

  const openApprove = () => {
    setRemarks('');
    setActionModal('approve');
  };

  const openReject = () => {
    setRemarks('');
    setActionModal('reject');
  };

  const executeApproval = async () => {
    setBusy(true);
    const res = actionModal === 'approve' ? await approveCw(cw.id, remarks) : await rejectCw(cw.id, remarks);
    setBusy(false);
    if (res.ok) {
      toast.success(actionModal === 'approve' ? 'Cost Workout approved' : 'Cost Workout rejected');
      setActionModal(null);
      load();
    } else {
      toast.error(res.error?.message || 'Operation failed');
    }
  };

  const handleShare = async () => {
    const res = await shareCw(cw);
    if (res.ok) {
      toast.success(res.action === 'copy' ? 'Link copied to clipboard' : 'Shared successfully');
    } else {
      toast.error(res.error?.message || 'Failed to share');
    }
  };

  const handleEmail = () => {
    const res = emailCw(cw);
    if (!res.ok) toast.error(res.error || 'Failed to open email client');
  };

  const handlePrint = () => window.print();

  const handleDuplicate = async () => {
    setBusy(true);
    const res = await duplicateCw(cw.id);
    setBusy(false);
    if (res.ok) {
      const data = res.data?.data ?? {};
      toast.success(`Duplicated as ${data.cwNo || cw.cwNo}`);
      load();
    } else {
      toast.error(res.error?.message || 'Failed to duplicate Cost Workout');
    }
  };

  const itemsSource = itemsRows ?? cw.items;
  const itemRows = [];
  (Array.isArray(itemsSource) ? itemsSource : []).forEach((item) => {
    const cats = Array.isArray(item.categories) && item.categories.length > 0 ? item.categories : [];
    cats.forEach((cat, index) => {
      const leadTime = String(cat.category || '').toLowerCase() === 'lead time';
      const amount = leadTime ? 0 : (Number(cat.qty) || 0) * (Number(cat.rate) || 0);
      itemRows.push({ item, cat, leadTime, amount, first: index === 0, count: cats.length });
    });
  });

  const confirmConfigs = {
    submit: { title: 'Submit Cost Workout', message: `Submit ${cw.cwNo} for approval?`, confirmLabel: 'Submit', variant: 'default', icon: Send },
    archive: { title: 'Archive Cost Workout', message: `Archive ${cw.cwNo}?`, confirmLabel: 'Archive', variant: 'warning', icon: Archive },
    restore: { title: 'Restore Cost Workout', message: `Restore ${cw.cwNo} to active?`, confirmLabel: 'Restore', variant: 'default', icon: RotateCcw },
    delete: { title: 'Delete Cost Workout', message: `Move ${cw.cwNo} to trash?`, confirmLabel: 'Delete', variant: 'danger', icon: Trash2 }
  };

  const actionBtnCls = 'flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer select-none';

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
      {/* ===== BREADCRUMB ===== */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
        <span>VISHAK TECH</span>
        <span>&gt;</span>
        <span>Sales</span>
        <span>&gt;</span>
        <button type="button" onClick={() => navigate('/cost-workouts')} className="hover:text-slate-600 cursor-pointer">
          Cost Workouts
        </button>
        <span>&gt;</span>
        <span className="text-slate-600">{cw.cwNo}</span>
      </div>

      {/* ===== HEADER ===== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 tracking-tight">
            <Calculator className="w-6 h-6 text-[#0B4A3D]" />
            <span>{cw.cwNo}</span>
            <span className={`cpr-badge ${meta.className} inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-[11px] font-semibold`}>
              {meta.label}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">
            {cw.customerName ? `${cw.customerName} · ` : ''}
            {cw.cprRef ? `CPR ${cw.cprRef} · ` : ''}
            {formatDate(cw.cwDate)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <button type="button" onClick={() => navigate(`/cost-workouts/${cw.id}/edit`)} className={actionBtnCls}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {canSubmit && (
            <button type="button" onClick={() => setConfirm({ type: 'submit' })} className={actionBtnCls}>
              <Send className="w-3.5 h-3.5" /> Submit
            </button>
          )}
          {canApprove && (
            <>
              <button type="button" onClick={openApprove} className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-lg transition-colors cursor-pointer select-none">
                <CheckCircle className="w-3.5 h-3.5" /> Approve
              </button>
              <button type="button" onClick={openReject} className="flex items-center gap-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-2 rounded-lg transition-colors cursor-pointer select-none">
                <Ban className="w-3.5 h-3.5" /> Reject
              </button>
            </>
          )}
          {canDuplicate && (
            <button type="button" onClick={handleDuplicate} className={actionBtnCls}>
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </button>
          )}
          <button type="button" onClick={handleShare} className={actionBtnCls}>
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
          <button type="button" onClick={handleEmail} className={actionBtnCls}>
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
          <button type="button" onClick={handlePrint} className={actionBtnCls}>
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          {status === 'archived' ? (
            <button type="button" onClick={() => setConfirm({ type: 'restore' })} className={actionBtnCls}>
              <RotateCcw className="w-3.5 h-3.5" /> Restore
            </button>
          ) : status !== 'deleted' ? (
            <>
              <button type="button" onClick={() => setConfirm({ type: 'archive' })} className={actionBtnCls}>
                <Archive className="w-3.5 h-3.5" /> Archive
              </button>
              <button type="button" onClick={() => setConfirm({ type: 'delete' })} className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-surface border border-rose-200 px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer select-none">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex items-center gap-1 border-b border-slate-200 mb-5 select-none">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'items', label: 'Items' },
          { key: 'timeline', label: 'Timeline' },
          { key: 'attachments', label: 'Attachments' }
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors cursor-pointer ${
              tab === t.key ? 'border-[#0B4A3D] text-[#0B4A3D]' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="space-y-5">
            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Document</div>
                <div className="space-y-1.5 text-xs">
                  <Row label="CW Number" value={cw.cwNo} />
                  <Row label="Date" value={formatDate(cw.cwDate)} />
                  <Row label="CPR Reference" value={cw.cprRef || '—'} />
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 shrink-0">Linked CPR</span>
                    {cw.cprId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/cprs/${cw.cprId}`)}
                        className="text-right font-semibold text-[#0B4A3D] hover:underline cursor-pointer"
                      >
                        {cw.linkedCpr || cw.cprRef || `CPR-${cw.cprId}`}
                      </button>
                    ) : (
                      <span className="text-right font-semibold text-slate-700">{cw.linkedCpr || '—'}</span>
                    )}
                  </div>
                  <Row label="Status" value={meta.label} />
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">People</div>
                <div className="space-y-1.5 text-xs">
                  <Row label="Prepared By" value={cw.preparedBy} />
                  <Row label="Contact Person" value={cw.contactPerson || '—'} />
                  <Row label="Customer" value={cw.customerName || '—'} />
                  <Row label="Company" value={cw.company || '—'} />
                  <Row label="Phone" value={cw.phone || '—'} />
                  <Row label="Email" value={cw.email || '—'} />
                  <Row label="GST" value={cw.gst || '—'} />
                  <Row label="PAN" value={cw.pan || '—'} />
                </div>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Billing Address</div>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{cw.billingAddress || '—'}</p>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Shipping Address</div>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{cw.shippingAddress || '—'}</p>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Remarks</div>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{cw.remarks || '—'}</p>
            </div>
          </div>

          {/* Cost summary sidebar */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-4 space-y-3 sticky top-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Cost Summary</div>
            <div className="space-y-2 text-xs">
              <Row label="Items" value={String(Array.isArray(cw.items) ? cw.items.length : 0)} />
              <Row label="Subtotal" value={formatINR(doc.subtotal)} strong />
              <Row label={`Profit ${doc.profitPct}%`} value={formatINR(doc.profitAmt)} />
              <Row label="Selling Price" value={formatINR(doc.sellingPrice)} />
              <Row label={`Discount ${doc.discountPct}%`} value={`−${formatINR(doc.discountAmt)}`} />
              <Row label={`GST ${doc.gstPct}%`} value={formatINR(doc.gstAmt)} />
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                <span className="text-sm font-bold text-slate-700">Grand Total</span>
                <span className="text-lg font-extrabold text-[#0B4A3D]">{formatINR(doc.grandTotal)}</span>
              </div>
            </div>
            {status === 'approved' && cw.approvedBy && (
              <div className="border-t border-slate-100 pt-3 flex items-center gap-2 text-[11px] text-emerald-700">
                <Check className="w-3.5 h-3.5" /> Approved by {cw.approvedBy}
              </div>
            )}
            {status === 'rejected' && (
              <div className="border-t border-slate-100 pt-3 text-[11px] text-rose-600">
                {cw.rejectionReason ? `Rejected: ${cw.rejectionReason}` : 'Rejected'}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'items' && (
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 60 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 180 }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-100/80 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="py-2.5 px-3 text-center">#</th>
                  <th className="py-2.5 px-3 text-left">Description</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-left">Category</th>
                  <th className="py-2.5 px-3 text-center">Unit</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-xs text-slate-400">
                      No cost items in this Cost Workout.
                    </td>
                  </tr>
                )}
                {itemRows.map((row, index) => (
                  <tr key={`${row.item.id}-${index}`} className="border-b border-slate-100">
                    {row.first && (
                      <>
                        <td className="px-3 py-2.5 text-xs text-slate-400 text-center align-middle" rowSpan={row.count}>
                          {index + 1}
                        </td>
                        <td className="px-3 py-2.5 align-middle" rowSpan={row.count}>
                          <span className="text-xs font-semibold text-slate-700">{row.item.description || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5 align-middle" rowSpan={row.count}>
                          <span className="text-xs text-slate-600">
                            {row.item.qty ?? 1} {row.item.unit ? ` ${row.item.unit}` : ''}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2.5 text-xs text-slate-600">{row.cat.category || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-center text-slate-500">{row.cat.unit || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-right text-slate-600">{formatINR(row.cat.rate)}</td>
                    <td className="px-3 py-2.5 text-xs text-right font-semibold text-slate-700">{formatINR(row.amount)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{row.cat.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center gap-5 text-xs">
            <span><span className="font-bold text-slate-700">{Array.isArray(cw.items) ? cw.items.length : 0}</span> Items</span>
            <span><span className="font-bold text-slate-700">{itemRows.length}</span> Categories</span>
            <span className="ml-auto font-bold text-[#0B4A3D]">Subtotal: {formatINR(doc.subtotal)}</span>
            <span className="font-bold text-[#0B4A3D]">Grand Total: {formatINR(doc.grandTotal)}</span>
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
          {Array.isArray(cw.timeline) && cw.timeline.length > 0 ? (
            <div className="space-y-4">
              {(timelineRows ?? cw.timeline).map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="mt-0.5 w-7 h-7 rounded-full bg-[#0B4A3D]/10 text-[#0B4A3D] flex items-center justify-center shrink-0">
                    {entry.type === 'approved' ? <Check className="w-3.5 h-3.5" /> : <FileDown className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-700">{entry.title}</div>
                    {entry.detail && <div className="text-[11px] text-slate-500 mt-0.5">{entry.detail}</div>}
                    <div className="text-[10px] text-slate-400 mt-0.5">{formatRelativeTime(entry.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <FileDown className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-xs text-slate-400">No activity recorded for this Cost Workout.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'attachments' && (
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
          {attachmentsLoading ? (
            <div className="flex items-center justify-center py-10 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 text-[#0B4A3D] animate-spin mr-2" /> Loading attachments...
            </div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-xs text-slate-400">No attachments for this Cost Workout.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {attachments.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                  {f.type && f.type.startsWith('image/') ? (
                    <img src={f.data} alt={f.name} className="w-11 h-11 rounded object-cover shrink-0" />
                  ) : (
                    <FileText className="w-6 h-6 text-[#0B4A3D] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700 truncate" title={f.name}>
                      {f.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {f.size ? `${(Number(f.size) / 1024).toFixed(1)} KB` : ''}
                    </div>
                  </div>
                  <a
                    href={f.data}
                    download={f.name}
                    aria-label={`Download ${f.name}`}
                    className="p-1.5 text-slate-400 hover:text-[#0B4A3D] hover:bg-slate-100 rounded-md transition-colors shrink-0"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== CONFIRM ===== */}
      {confirm && (
        <ConfirmDialog
          open
          title={confirmConfigs[confirm.type].title}
          message={confirmConfigs[confirm.type].message}
          confirmLabel={confirmConfigs[confirm.type].confirmLabel}
          variant={confirmConfigs[confirm.type].variant}
          icon={confirmConfigs[confirm.type].icon}
          loading={busy}
          onConfirm={() =>
            runAction(
              confirm.type === 'submit' ? submitCw : confirm.type === 'archive' ? archiveCw : confirm.type === 'restore' ? restoreCw : deleteCw,
              confirm.type === 'submit' ? `${cw.cwNo} submitted for approval` : confirm.type === 'archive' ? `${cw.cwNo} archived` : confirm.type === 'restore' ? `${cw.cwNo} restored` : `${cw.cwNo} moved to trash`
            )
          }
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ===== APPROVE / REJECT MODAL ===== */}
      <Modal open={actionModal !== null} onClose={() => setActionModal(null)} title={actionModal === 'approve' ? 'Approve Cost Workout' : 'Reject Cost Workout'}>
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            {actionModal === 'approve' ? `Approve ${cw.cwNo} (${formatINR(doc.grandTotal)})?` : `Reject ${cw.cwNo} (${formatINR(doc.grandTotal)})?`}
          </p>
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={actionModal === 'approve' ? 'Approval remarks (optional)' : 'Rejection reason (required for reject)'}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:border-emerald-600/50"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActionModal(null)}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={executeApproval}
              disabled={busy || (actionModal === 'reject' && !remarks.trim())}
              className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                actionModal === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {actionModal === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`text-right ${strong ? 'font-bold text-slate-800' : 'font-semibold text-slate-700'}`}>{value}</span>
    </div>
  );
}
