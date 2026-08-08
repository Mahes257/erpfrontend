import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Clock,
  FileDown,
  FileText,
  GitBranch,
  History,
  Info,
  Link2,
  Mail,
  MessageCircle,
  Package,
  Paperclip,
  Pencil,
  Printer,
  RotateCcw,
  Share2,
  StickyNote,
  Trash2
} from 'lucide-react';
import { ConfirmDialog, useToast } from '../../components/Common';
import SalesStatusBadge from '../../components/SalesTable/SalesStatusBadge';
import SalesAttachments from '../../components/SalesDetail/SalesAttachments';
import useClickOutside from '../../hooks/useClickOutside';
import { formatDate, formatDateTime, formatINR } from '../../utils/leadHelpers';
import { computeTotals, docNumber, emailDocument, shareDocument, whatsappDocument } from '../../utils/salesHelpers';
import { salesContractViewConfig } from '../../config/salesPageConfigs';
import './sales-contract-module.css';

function Field({ label, children }) {
  return (
    <div className="scp-info-row">
      <label>{label}</label>
      <span>{children}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count }) {
  return (
    <h3>
      <Icon /> {title}
      {count != null && <span className="scp-count">({count})</span>}
    </h3>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <Icon style={{ width: 36, height: 36, color: '#cbd5e1', margin: '0 auto 12px', display: 'block' }} />
      <h4 style={{ fontSize: 15, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>{title}</h4>
      {subtitle && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>{subtitle}</p>}
    </div>
  );
}

function TimelineEvent({ event }) {
  return (
    <div className="scp-audit-item">
      <span className={`scp-audit-dot ${event.type === 'created' ? 'green' : event.type === 'approved' ? 'green' : event.type === 'submitted' ? 'amber' : event.type === 'rejected' ? 'red' : 'gray'}`} />
      <div className="scp-audit-action">{event.title}</div>
      {event.desc && <div className="scp-audit-detail">{event.desc}</div>}
      <div className="scp-audit-date">{formatDateTime(event.date)}</div>
    </div>
  );
}

function buildTimelineEvents(doc, no, label) {
  const events = [];
  const createdAt = doc.createdAt || doc.date;
  if (createdAt) {
    events.push({ title: `${label} Created`, desc: `${no || doc.id} was created.`, date: createdAt, type: 'created' });
  }
  if (doc.updatedAt && doc.updatedAt !== createdAt) {
    events.push({ title: `${label} Updated`, desc: 'Document was updated.', date: doc.updatedAt, type: 'edited' });
  }
  if (doc.approvalDate && String(doc.approvalStatus || '').toLowerCase() === 'approved') {
    events.push({ title: 'Approved', desc: `Approved by ${doc.approvedBy || 'Admin'}`, date: doc.approvalDate, type: 'approved' });
  }
  if (doc.archivedAt) {
    events.push({ title: 'Archived', desc: 'Document was archived.', date: doc.archivedAt, type: 'archived' });
  }
  return events.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function buildActivityEvents(doc, no) {
  const activities = [];
  activities.push({ text: `Document ${no || doc.id} was created.`, date: doc.createdAt || doc.date || new Date().toISOString(), icon: 'plus' });
  if (Array.isArray(doc.history)) {
    doc.history.forEach((h) => {
      activities.push({
        text: `${h.field}: ${h.oldValue || '—'} → ${h.newValue || '—'}${h.changedBy ? ` by ${h.changedBy}` : ''}`,
        date: h.createdAt,
        icon: 'check'
      });
    });
  }
  return activities.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

const ACTIVITY_ICONS = {
  plus: Check,
  send: Check,
  check: ClipboardList,
  default: Clock
};

/**
 * Sales Contract View page — visual 1:1 with the ERP reference page
 * (sales-contract-view.html): breadcrumb → view header (SC logo + number +
 * date/status + actions) → summary grid (Total Amount / Status / Client /
 * PO Reference) → Contract Details → Contract Terms → Items → Revision
 * History → Notes. Every Sales Contract view action stays intact (edit,
 * approve, convert to SO, print, email, share, archive, PDF, WhatsApp +
 * attachments / timeline / activity / version / approval panels).
 */
export default function SalesContractViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  const config = salesContractViewConfig;

  useClickOutside(moreRef, () => setMoreOpen(false), moreOpen);

  useEffect(() => {
    let cancelled = false;
    config.service
      .get(id)
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data ?? res ?? {};
        if (!raw?.id) {
          setNotFound(true);
        } else {
          setNotFound(false);
          setDoc(config.normalize(raw));
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, config]);

  // List page "Activity Log" row action navigates with ?tab=activities —
  // scroll to the activity panel once the document is loaded.
  useEffect(() => {
    const param = new URLSearchParams(location.search).get('tab');
    if (param === 'activities' && doc) {
      const t = setTimeout(() => {
        document.getElementById('scp-activity')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [location.search, doc]);

  const scrollTo = (sectionId) => {
    setMoreOpen(false);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const load = async () => {
    const res = await config.service.get(id);
    setDoc(config.normalize(res?.data ?? res ?? {}));
  };

  const runAction = async (fn, successMsg, navigateBack = false) => {
    setActionLoading(true);
    try {
      await fn();
      toast.success(successMsg);
      if (navigateBack) {
        navigate(config.listRoute);
        return;
      }
      await load();
    } catch (err) {
      toast.error(err?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const timelineEvents = useMemo(() => {
    if (!doc) return [];
    if (Array.isArray(doc.timeline) && doc.timeline.length > 0) {
      return doc.timeline
        .map((t) => ({ title: t.title, desc: t.detail, date: t.createdAt, type: t.type }))
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }
    return buildTimelineEvents(doc, docNumber(doc, config.moduleKey), config.title);
  }, [doc, config]);

  const activityEvents = useMemo(() => {
    if (!doc) return [];
    return buildActivityEvents(doc, docNumber(doc, config.moduleKey));
  }, [doc, config]);

  if (loading) {
    return (
      <div className="scp-page">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%', border: '2px solid #e5e7eb', borderTopColor: '#0b4a3d', animation: 'scp-spin 0.8s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div className="scp-page">
        <div className="scp-breadcrumb">
          <a onClick={() => navigate('/dashboard')}>Dashboard</a>
          <FileText style={{ width: 10, height: 10 }} />
          <a onClick={() => navigate('/sales-contracts')}>Sales Contracts</a>
        </div>
        <div className="scp-view-section" style={{ textAlign: 'center', padding: '40px' }}>
          <Info style={{ width: 40, height: 40, color: '#cbd5e1', margin: '0 auto 12px', display: 'block' }} />
          <h4 style={{ fontSize: 16, fontWeight: 700, color: '#64748b', margin: '0 0 6px' }}>{config.title} Not Found</h4>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>The {config.title.toLowerCase()} you are looking for does not exist.</p>
          <button type="button" className="scp-btn scp-btn-primary" onClick={() => navigate(config.listRoute)}>
            <ArrowLeft /> Back to {config.title} List
          </button>
        </div>
      </div>
    );
  }

  const status = String(doc.status || 'draft').toLowerCase();
  const items = Array.isArray(doc.items) ? doc.items : [];
  const attachments = Array.isArray(doc.attachments) ? doc.attachments : [];
  const no = docNumber(doc, config.moduleKey);
  const totals = computeTotals(items, {
    discountPct: doc.discountPct ?? doc.discount ?? 0,
    charges: (doc.charges ?? 0) + (doc.freight ?? 0) + (doc.insurance ?? 0),
    roundOffEnabled: config.moduleKey === 'invoice'
  });
  const grandTotal = doc.grandTotal != null ? doc.grandTotal : totals.grandTotal;

  const handlePrint = () => {
    if (config.printHtml) {
      const win = window.open('', '_blank', 'width=900,height=1100');
      if (!win) {
        toast.error('Popup blocked. Allow popups to print.');
        return;
      }
      win.document.write(config.printHtml(doc));
      win.document.close();
      win.focus();
      win.print();
    } else {
      toast.info('Print view is available from the PDF export');
    }
  };

  const handlePdf = async () => {
    if (!config.exportPdf) {
      toast.info('PDF export is available from the list export');
      return;
    }
    await runAction(() => config.exportPdf(doc), 'PDF downloaded');
  };

  const handleShare = async () => {
    const res = await shareDocument(doc, config.moduleKey, config.title);
    if (res?.ok) {
      toast.success(res.action === 'share' ? `${config.title} shared` : `${config.title} link copied to clipboard`);
    } else if (res?.error) {
      toast.error(res.error);
    }
  };

  const handleEmail = () => {
    const res = emailDocument(doc, config.moduleKey, config.title);
    if (res?.error) toast.error(res.error);
  };

  const handleWhatsApp = () => {
    const res = whatsappDocument(doc, config.moduleKey, config.title);
    if (res?.error) toast.error(res.error);
  };

  const allowedHeader = config.viewHeaderActions || ['edit', 'duplicate', 'preview', 'print', 'pdf', 'share', 'email', 'whatsapp', 'archive', 'delete'];
  const want = (key) => allowedHeader.includes(key);

  // Primary actions in ERP order: Edit, PDF, Print, [Approve/Convert], More, Back
  const headerActions = [];
  if (want('edit') && status !== 'deleted' && status !== 'archived' && status !== 'cancelled' && status !== 'converted' && status !== 'completed') {
    headerActions.push({ key: 'edit', label: 'Edit', icon: Pencil, style: 'secondary', action: () => navigate(config.editRoute(doc)) });
  }
  if (want('pdf')) headerActions.push({ key: 'pdf', label: 'PDF', icon: FileDown, style: 'ghost', action: handlePdf });
  if (want('print')) headerActions.push({ key: 'print', label: 'Print', icon: Printer, style: 'ghost', action: handlePrint });
  if (config.headerActions) {
    headerActions.push(...config.headerActions(doc, { runAction, navigate, toast }));
  }

  const overflowActions = [];
  if (want('share')) overflowActions.push({ key: 'share', label: 'Share', icon: Share2, action: handleShare });
  if (want('email')) overflowActions.push({ key: 'email', label: 'Email', icon: Mail, action: handleEmail });
  if (want('whatsapp')) overflowActions.push({ key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, action: handleWhatsApp });
  overflowActions.push({ divider: true });
  overflowActions.push({ key: 'linked', label: 'Linked Documents', icon: Link2, action: () => scrollTo('scp-linked') });
  overflowActions.push({ key: 'activity', label: 'Activity Timeline', icon: History, action: () => scrollTo('scp-activity') });
  if (status !== 'deleted') {
    if (want('archive')) {
      overflowActions.push({
        key: 'archive',
        label: status === 'archived' ? 'Restore' : 'Archive',
        icon: status === 'archived' ? RotateCcw : Archive,
        action: () => setConfirm(status === 'archived' ? 'restore' : 'archive')
      });
    }
    if (want('delete')) overflowActions.push({ key: 'delete', label: 'Delete', icon: Trash2, danger: true, action: () => setConfirm('delete') });
  }

  const ACTION_STYLES = {
    primary: 'scp-btn-primary',
    green: 'scp-btn-primary',
    secondary: 'scp-btn-ghost',
    ghost: 'scp-btn-ghost',
    approve: 'scp-btn-primary',
    reject: 'scp-btn-primary',
    danger: 'scp-btn-ghost'
  };

  const confirmConfigs = {
    archive: {
      title: `Archive ${config.title}`,
      message: 'Archive this document? It can be restored later.',
      confirmLabel: 'Archive',
      variant: 'warning',
      icon: Archive,
      onConfirm: async () => {
        await runAction(() => config.service.archive(id), `${no} archived`);
        setConfirm(null);
      }
    },
    restore: {
      title: `Restore ${config.title}`,
      message: 'Restore this document from archive?',
      confirmLabel: 'Restore',
      variant: 'default',
      icon: RotateCcw,
      onConfirm: async () => {
        await runAction(() => config.service.restore(id), `${no} restored`);
        setConfirm(null);
      }
    },
    delete: {
      title: `Delete ${config.title}`,
      message: 'This document will be moved to trash.',
      confirmLabel: 'Delete',
      variant: 'danger',
      icon: Trash2,
      onConfirm: async () => {
        await runAction(() => config.service.delete(id), `${no} moved to trash`, true);
        setConfirm(null);
      }
    }
  };

  const linkedDocs = config.linkedDocs ? config.linkedDocs(doc) : [];
  const versionHistory = Array.isArray(doc.history) ? doc.history : [];
  const generalRows = config.generalRows ? config.generalRows(doc) : [];

  // Split general rows into Contract Details + Contract Terms like the ERP view.
  const termKeys = ['Payment Terms', 'Delivery Terms', 'Contract Validity', 'Contract Duration', 'Warranty Terms'];
  const detailsRows = generalRows.filter(([label]) => !termKeys.includes(label));
  const termsRows = generalRows.filter(([label]) => termKeys.includes(label));

  return (
    <div className="scp-page">
      {/* ===== BREADCRUMB ===== */}
      <div className="scp-breadcrumb">
        <a onClick={() => navigate('/dashboard')}>Dashboard</a>
        <FileText style={{ width: 10, height: 10 }} />
        <a onClick={() => navigate('/sales-contracts')}>Sales Contracts</a>
        <FileText style={{ width: 10, height: 10 }} />
        <span>{no || doc.id}</span>
      </div>

      {/* ===== VIEW HEADER (SC logo + number + meta + actions) ===== */}
      <div className="scp-view-section" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #0B4A3D, #083D34)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: 0.5,
                flexShrink: 0
              }}
            >
              SC
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.3 }}>
                {no || doc.id}
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                  <Calendar style={{ width: 12, height: 12, color: '#0b4a3d' }} /> {formatDate(doc[config.dateKey] || doc.createdAt)}
                </span>
                <SalesStatusBadge status={doc.status} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {headerActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.action}
                disabled={actionLoading}
                className={`scp-btn ${ACTION_STYLES[action.style] || 'scp-btn-ghost'}`}
                style={action.style === 'danger' ? { borderColor: '#fecaca', color: '#dc2626' } : undefined}
              >
                <action.icon /> {action.label}
              </button>
            ))}
            {overflowActions.length > 0 && (
              <div style={{ position: 'relative' }} ref={moreRef}>
                <button type="button" className="scp-btn scp-btn-ghost" onClick={() => setMoreOpen((prev) => !prev)}>
                  More <ChevronDown style={{ width: 10, height: 10 }} />
                </button>
                {moreOpen && (
                  <div className="scp-export-menu" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 15px 40px rgba(0,0,0,0.12)', minWidth: 210, padding: 6, marginTop: 4 }}>
                    {overflowActions.map((item, i) =>
                      item.divider ? (
                        <div key={`div-${i}`} style={{ height: 1, background: '#e5e7eb', margin: '4px 8px' }} />
                      ) : (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setMoreOpen(false);
                            item.action();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '9px 14px',
                            fontSize: 13,
                            color: item.danger ? '#dc2626' : '#374151',
                            width: '100%',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontFamily: 'Inter, sans-serif'
                          }}
                        >
                          <item.icon style={{ width: 14, height: 14, color: item.danger ? '#dc2626' : '#64748b' }} /> {item.label}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
            <button type="button" className="scp-btn scp-btn-ghost" onClick={() => navigate(config.listRoute)}>
              <ArrowLeft /> Back
            </button>
          </div>
        </div>
      </div>

      {/* ===== SUMMARY GRID (Total Amount / Status / Client / PO Reference) ===== */}
      <div className="scp-summary-grid">
        <div className="scp-summary-card">
          <div className="scp-fin-value">{formatINR(Number(grandTotal) || 0)}</div>
          <div className="scp-fin-label">Total Amount</div>
        </div>
        <div className="scp-summary-card">
          <div className="scp-fin-value" style={{ fontSize: 16 }}><SalesStatusBadge status={doc.status} /></div>
          <div className="scp-fin-label">Status</div>
        </div>
        <div className="scp-summary-card">
          <div className="scp-fin-value" style={{ fontSize: 16 }}>{doc.clientName || doc.client || '—'}</div>
          <div className="scp-fin-label">Client</div>
        </div>
        <div className="scp-summary-card">
          <div className="scp-fin-value" style={{ fontSize: 16 }}>{doc.poRef || '—'}</div>
          <div className="scp-fin-label">PO Reference</div>
        </div>
      </div>

      {/* ===== CONTRACT DETAILS ===== */}
      <div className="scp-view-card">
        <SectionHeader icon={Info} title="Contract Details" />
        {detailsRows.map(([label, value]) => (
          <Field key={label} label={label}>{value}</Field>
        ))}
        <Field label="Status"><SalesStatusBadge status={doc.status} /></Field>
        {doc.createdAt && <Field label="Created Date">{formatDate(doc.createdAt)}</Field>}
        {doc.updatedAt && <Field label="Last Updated">{formatDate(doc.updatedAt)}</Field>}
      </div>

      {/* ===== CONTRACT TERMS ===== */}
      {(termsRows.length > 0 || doc.terms) && (
        <div className="scp-view-card">
          <SectionHeader icon={Calendar} title="Contract Terms" />
          {termsRows.map(([label, value]) => (
            <Field key={label} label={label}>{value}</Field>
          ))}
          {doc.terms && (
            <div className="scp-info-row">
              <label>Terms &amp; Conditions</label>
              <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#374151' }}>{doc.terms}</span>
            </div>
          )}
        </div>
      )}

      {/* ===== ITEMS ===== */}
      {items.length > 0 && (
        <div className="scp-view-card">
          <SectionHeader icon={Package} title="Items" count={`${items.length} items`} />
          <div style={{ overflowX: 'auto' }}>
            <table className="scp-table" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>#</th>
                  <th>Item</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th className="scp-th-right">Rate</th>
                  <th className="scp-th-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center', color: '#6b7280' }}>{idx + 1}</td>
                    <td>
                      {it.description || it.productName || '—'}
                      {it.hsn && <span style={{ display: 'block', fontSize: 10, color: '#9ca3af' }}>HSN: {it.hsn}</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>{it.qty ?? '—'}</td>
                    <td className="scp-th-right">{formatINR(Number(it.rate) || 0)}</td>
                    <td className="scp-th-right"><strong>{formatINR(Number(it.amount) || Number(it.total) || 0)}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #e5e7eb' }}>
                  <td colSpan={4} style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 700, color: '#64748b' }}>Grand Total</td>
                  <td className="scp-th-right" style={{ padding: '10px 20px', fontWeight: 800, color: '#0b4a3d' }}>{formatINR(Number(grandTotal) || 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ===== REVISION HISTORY ===== */}
      {versionHistory.length > 0 && (
        <div className="scp-view-card">
          <SectionHeader icon={GitBranch} title="Revision History" count={`${versionHistory.length} records`} />
          <div style={{ overflowX: 'auto' }}>
            <table className="scp-table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Rev</th>
                  <th>Date</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Changed By</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {versionHistory.slice().reverse().map((h, i) => (
                  <tr key={`${h.createdAt}-${i}`}>
                    <td style={{ fontWeight: 700 }}>v{versionHistory.length - i}</td>
                    <td>{formatDateTime(h.createdAt)}</td>
                    <td>{h.oldValue || '—'}</td>
                    <td>{h.newValue || '—'}</td>
                    <td>{h.changedBy || 'Admin'}</td>
                    <td>{h.field || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== NOTES ===== */}
      {(doc.notes || doc.remarks) && (
        <div className="scp-view-card">
          <SectionHeader icon={StickyNote} title="Notes" />
          {doc.notes && (
            <div className="scp-info-row">
              <label>Notes</label>
              <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#374151' }}>{doc.notes}</span>
            </div>
          )}
          {doc.remarks && (
            <div className="scp-info-row">
              <label>Remarks</label>
              <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#374151' }}>{doc.remarks}</span>
            </div>
          )}
        </div>
      )}

      {/* ===== LINKED DOCUMENTS ===== */}
      <div className="scp-view-card" id="scp-linked">
        <SectionHeader icon={Link2} title="Linked Documents" />
        {linkedDocs.length === 0 ? (
          <div style={{ padding: '0 24px' }}>
            <EmptyState icon={Link2} title="No Linked Documents" />
          </div>
        ) : (
          linkedDocs.map((link) => (
            <Field key={link.label} label={link.label}>
              {link.onClick ? (
                <button
                  type="button"
                  onClick={link.onClick}
                  style={{ color: '#0b4a3d', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}
                >
                  {link.value} <FileText style={{ width: 12, height: 12, verticalAlign: 'middle' }} />
                </button>
              ) : (
                link.value || '—'
              )}
            </Field>
          ))
        )}
      </div>

      {/* ===== TIMELINE ===== */}
      <div className="scp-view-card">
        <SectionHeader icon={History} title="Timeline" count={`${timelineEvents.length} events`} />
        {timelineEvents.length === 0 ? (
          <div style={{ padding: '0 24px' }}>
            <EmptyState icon={Clock} title="No Timeline Events" />
          </div>
        ) : (
          <div style={{ padding: '20px 24px' }}>
            <div className="scp-audit-timeline" style={{ maxHeight: 320, overflowY: 'auto' }}>
              {timelineEvents.slice(0, 6).map((event) => (
                <TimelineEvent key={`${event.title}-${event.date}`} event={event} />
              ))}
              {timelineEvents.length > 6 && (
                <div style={{ textAlign: 'center', paddingTop: 8, fontSize: 12, color: '#0b4a3d', fontWeight: 600 }}>
                  +{timelineEvents.length - 6} more events
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== ACTIVITY LOG ===== */}
      <div className="scp-view-card" id="scp-activity">
        <SectionHeader icon={ClipboardList} title="Activity Log" count={`${activityEvents.length} records`} />
        {activityEvents.length === 0 ? (
          <div style={{ padding: '0 24px' }}>
            <EmptyState icon={ClipboardList} title="No Activity Recorded" />
          </div>
        ) : (
          <div style={{ padding: '8px 24px' }}>
            {activityEvents.slice(0, 8).map((a, i) => {
              const Icon = ACTIVITY_ICONS[a.icon] || ACTIVITY_ICONS.default;
              return (
                <div key={`${a.text}-${a.date}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: '#f3f4f6', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 13, height: 13 }} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#374151' }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{formatDateTime(a.date)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== ATTACHMENTS ===== */}
      <div className="scp-view-card">
        <SectionHeader icon={Paperclip} title="Attachments" count={`${attachments.length} files`} />
        <div style={{ padding: '16px 24px' }}>
          <SalesAttachments service={config.service} docId={id} attachments={attachments} onChanged={load} />
        </div>
      </div>

      {/* ===== APPROVAL HISTORY ===== */}
      <div className="scp-view-card">
        <SectionHeader icon={CheckCheck} title="Approval History" count={`${activityEvents.length} records`} />
        {activityEvents.length === 0 ? (
          <div style={{ padding: '0 24px' }}>
            <EmptyState icon={History} title="No Approval Activity" />
          </div>
        ) : (
          <div style={{ padding: '8px 24px' }}>
            {activityEvents.slice(0, 5).map((a, i) => (
              <div key={`${a.text}-${a.date}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: '#edf7f4', color: '#0b4a3d', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check style={{ width: 13, height: 13 }} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#374151' }}>{a.text}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{formatDateTime(a.date)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== CONFIRM DIALOG ===== */}
      {confirm && (
        <ConfirmDialog
          open
          title={confirmConfigs[confirm].title}
          message={confirmConfigs[confirm].message}
          confirmLabel={confirmConfigs[confirm].confirmLabel}
          variant={confirmConfigs[confirm].variant}
          icon={confirmConfigs[confirm].icon}
          loading={actionLoading}
          onConfirm={confirmConfigs[confirm].onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <style>{`@keyframes scp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
