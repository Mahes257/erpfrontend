import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, FileText, GitBranch, History } from 'lucide-react';
import quotationService from '../../services/quotationService';
import SalesStatusBadge from '../../components/SalesTable/SalesStatusBadge';
import { formatDateTime, formatINR } from '../../utils/leadHelpers';
import './quotation-module.css';

function parseListResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.content)) return response.data.content;
  if (Array.isArray(response?.content)) return response.content;
  return [];
}

export default function QuotationRevision() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(searchParams.get('id') || '');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    quotationService
      .list({ page: 0, size: 500 })
      .then((res) => {
        if (cancelled) return;
        const list = parseListResponse(res).filter((q) => String(q.status || '').toLowerCase() !== 'deleted');
        setQuotations(list);
        const id = searchParams.get('id');
        if (id && list.some((q) => String(q.id) === id)) setSelectedId(id);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    quotationService
      .getHistory(selectedId)
      .then((res) => {
        if (!cancelled) setHistory(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = useMemo(
    () => quotations.find((q) => String(q.id) === selectedId) || null,
    [quotations, selectedId]
  );

  const version = selected?.revision || selected?.version || 1;
  const revisionEvents = useMemo(() => {
    const events = [];
    if (selected) {
      events.push({
        title: `Quotation ${selected.quotationNo || selected.id} Created`,
        desc: 'Version 1',
        time: selected.createdAt || selected.date || '',
        user: selected.createdBy || 'Admin'
      });
    }
    if (Array.isArray(selected?.revisionHistory)) {
      selected.revisionHistory.forEach((rev) => {
        events.push({
          title: `Revision ${rev.version}${rev.remarks ? `: ${rev.remarks}` : ' Created'}`,
          desc: rev.changes || '',
          time: rev.date || '',
          user: rev.createdBy || 'Admin'
        });
      });
    }
    if (history.length > 0) {
      history.forEach((h) => {
        events.push({
          title: `Field Changed: ${h.field || 'document'}`,
          desc: `${h.oldValue || '—'} → ${h.newValue || '—'}`,
          time: h.createdAt || '',
          user: h.changedBy || 'Admin'
        });
      });
    }
    return events.sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
  }, [selected, history]);

  return (
    <div className="qpo-page">
      <div className="qpo-breadcrumb">
        <a onClick={() => navigate('/dashboard')}>Dashboard</a>
        <span className="qpo-crumb-sep">&gt;</span>
        <a onClick={() => navigate('/quotations')}>Quotations</a>
        <span className="qpo-crumb-sep">&gt;</span>
        <span>Quotation Revision History</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <GitBranch className="w-6 h-6 text-[#0B4A3D]" />
            Revision History
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1.5">View version and revision history of a quotation</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/quotations')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" /> Quotation List
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-[#0B4A3D] animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
            <h3 className="text-[13px] font-bold text-[#0B4A3D] uppercase tracking-wider mb-4">Select Quotation</h3>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#0B4A3D] cursor-pointer"
            >
              <option value="">-- Select Quotation --</option>
              {quotations.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quotationNo || q.id} - {q.clientName || '—'} (v{q.revision || q.version || 1})
                </option>
              ))}
            </select>

            {selected && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500">Status</span>
                  <SalesStatusBadge status={selected.status} />
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500">Version</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-[11px] font-bold bg-[#E8F0EE] text-[#0B4A3D]">v{version}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Amount</span>
                  <span className="text-sm font-bold text-[#0B4A3D]">{formatINR(selected.grandTotal || 0)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* ===== TIMELINE ===== */}
            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
              <h3 className="text-[13px] font-bold text-[#0B4A3D] uppercase tracking-wider mb-4">
                <History className="w-3.5 h-3.5 inline mr-1" /> Revision Timeline
              </h3>
              {!selected ? (
                <div className="text-center py-10">
                  <GitBranch className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Select a quotation to view its revision history</p>
                </div>
              ) : revisionEvents.length === 0 && !historyLoading ? (
                <div className="text-center py-8 text-xs text-slate-400">No revision history</div>
              ) : (
                <div className="relative before:content-[''] before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-0.5 before:bg-slate-200">
                  {revisionEvents.map((e, i) => (
                    <div key={i} className="relative pl-9 pb-4 last:pb-0">
                      <span className="absolute left-[3px] top-1 w-3 h-3 rounded-full border-2 border-[#0B4A3D] bg-[#EDF7F4]" />
                      <div className="text-[13px] font-semibold text-slate-800">{e.title}</div>
                      {e.desc && <div className="text-xs text-slate-500 mt-0.5">{e.desc}</div>}
                      <div className="text-[11px] text-slate-400 mt-0.5">{e.user} · {formatDateTime(e.time)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ===== REVISION TABLE ===== */}
            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-[13px] font-bold text-[#0B4A3D] uppercase tracking-wider">Version History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 720 }}>
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-2.5 px-3 text-left text-[11px] font-bold text-slate-500">Version</th>
                      <th className="py-2.5 px-3 text-left text-[11px] font-bold text-slate-500">Date</th>
                      <th className="py-2.5 px-3 text-left text-[11px] font-bold text-slate-500">Status</th>
                      <th className="py-2.5 px-3 text-right text-[11px] font-bold text-slate-500">Amount</th>
                      <th className="py-2.5 px-3 text-center text-[11px] font-bold text-slate-500">Items</th>
                      <th className="py-2.5 px-3 text-left text-[11px] font-bold text-slate-500">Changed By</th>
                      <th className="py-2.5 px-3 text-center text-[11px] font-bold text-slate-500">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selected ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-xs text-slate-400">Select a quotation first</td>
                      </tr>
                    ) : (
                      <>
                        <tr className="border-b border-slate-100 bg-[#EDF7F4]/40">
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-[11px] font-bold bg-[#E8F0EE] text-[#0B4A3D]">v{version} (Current)</span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-600">{formatDateTime(selected.createdAt || selected.date)}</td>
                          <td className="py-2.5 px-3"><SalesStatusBadge status={selected.status} /></td>
                          <td className="py-2.5 px-3 text-right text-xs font-bold text-slate-800">{formatINR(selected.grandTotal || 0)}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-slate-600">{(selected.items || []).length}</td>
                          <td className="py-2.5 px-3 text-xs text-slate-600">{selected.createdBy || 'Admin'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => navigate(`/quotations/${selected.id}/view`)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0B4A3D] hover:underline cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                          </td>
                        </tr>
                        {history.map((h, i) => (
                          <tr key={i} className="border-b border-slate-100 opacity-70 last:border-b-0">
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-[11px] font-bold bg-slate-100 text-slate-500">v{version - 1 - i}</span>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-slate-600">{formatDateTime(h.createdAt)}</td>
                            <td className="py-2.5 px-3 text-xs text-slate-600">{h.field || '—'}</td>
                            <td className="py-2.5 px-3 text-right text-xs text-slate-600">{h.newValue || '—'}</td>
                            <td className="py-2.5 px-3 text-center text-xs text-slate-400">—</td>
                            <td className="py-2.5 px-3 text-xs text-slate-600">{h.changedBy || 'Admin'}</td>
                            <td className="py-2.5 px-3 text-center text-xs text-slate-400">—</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
