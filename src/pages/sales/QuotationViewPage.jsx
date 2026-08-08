import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Calendar,
  Check,
  CheckCheck,
  ClipboardList,
  Clock,
  Copy,
  Eye,
  FileDown,
  FileText,
  GitBranch,
  History,
  Info,
  Layers,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Paperclip,
  Pencil,
  Printer,
  RotateCcw,
  Share2,
  StickyNote,
  Tag,
  Trash2,
  Truck,
  User
} from 'lucide-react';
import { ConfirmDialog, useToast } from '../../components/Common';
import SalesStatusBadge from '../../components/SalesTable/SalesStatusBadge';
import SalesAttachments from '../../components/SalesDetail/SalesAttachments';
import { formatDate, formatDateTime, formatINR } from '../../utils/leadHelpers';
import { computeTotals, docNumber, emailDocument, shareDocument, whatsappDocument } from '../../utils/salesHelpers';
import { quotationViewConfig } from '../../config/salesPageConfigs';
import './quotation-module.css';

function initialOf(name = '') {
  return (name || 'D').charAt(0).toUpperCase();
}

function Field({ label, children }) {
  return (
    <div className="qpo-view-field">
      <label>{label}</label>
      <span>{children}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count }) {
  return (
    <h3>
      <Icon /> {title}
      {count != null && <span className="qpo-count">({count})</span>}
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

const TL_DOT_COLORS = {
  created: 'border-[#0B4A3D] bg-[#EDF7F4]',
  completed: 'border-[#059669] bg-[#f0fdf4]',
  approved: 'border-[#059669] bg-[#f0fdf4]',
  submitted: 'border-[#f59e0b] bg-[#fffbeb]',
  rejected: 'border-[#dc2626] bg-[#fee2e2]',
  danger: 'border-[#dc2626] bg-[#fee2e2]',
  default: 'border-[#9ca3af] bg-white'
};

function TimelineEvent({ event }) {
  return (
    <div className="qpo-audit-item">
      <span className={`qpo-audit-dot ${TL_DOT_COLORS[event.type] === TL_DOT_COLORS.completed || event.type === 'created' ? 'green' : event.type === 'approved' ? 'green' : event.type === 'submitted' ? 'amber' : event.type === 'rejected' ? 'red' : 'gray'}`} />
      <div className="qpo-audit-action">{event.title}</div>
      {event.desc && <div className="qpo-audit-detail">{event.desc}</div>}
      <div className="qpo-audit-date">{formatDateTime(event.date)}</div>
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
  if (doc.sentAt) {
    events.push({ title: 'Sent to Client', desc: `Sent by ${doc.sentBy || 'Admin'}`, date: doc.sentAt, type: 'submitted' });
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
  if (doc.sentAt) {
    activities.push({ text: 'Document sent to the client.', date: doc.sentAt, icon: 'send' });
  }
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
 * Quotation View page — visual 1:1 with the ERP Purchase module's view
 * layout (po-view-grid / po-view-section) while keeping every Quotation
 * view action intact (edit, print, email, archive, send, convert,
 * recalc rates, PDF, share, WhatsApp + full tab set).
 */
export default function QuotationViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('tab') || 'overview');
  const [confirm, setConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const config = quotationViewConfig;

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
      <div className="qpo-page">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%', border: '2px solid #e5e7eb', borderTopColor: '#0b4a3d', animation: 'qpo-spin 0.8s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div className="qpo-page">
        <div className="qpo-breadcrumb">
          <a onClick={() => navigate('/dashboard')}>Dashboard</a>
          <FileText style={{ width: 10, height: 10 }} />
          <a onClick={() => navigate('/quotations')}>Quotations</a>
        </div>
        <div className="qpo-view-section" style={{ textAlign: 'center', padding: '40px' }}>
          <Info style={{ width: 40, height: 40, color: '#cbd5e1', margin: '0 auto 12px', display: 'block' }} />
          <h4 style={{ fontSize: 16, fontWeight: 700, color: '#64748b', margin: '0 0 6px' }}>{config.title} Not Found</h4>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>The {config.title.toLowerCase()} you are looking for does not exist.</p>
          <button type="button" className="qpo-btn qpo-btn-primary" onClick={() => navigate(config.listRoute)}>
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

  const headerActions = [];
  if (want('edit') && status !== 'deleted' && status !== 'archived' && status !== 'cancelled' && status !== 'converted' && status !== 'completed') {
    headerActions.push({ key: 'edit', label: 'Edit', icon: Pencil, style: 'secondary', action: () => navigate(config.editRoute(doc)) });
  }
  if (want('duplicate') && status !== 'deleted') {
    headerActions.push({ key: 'duplicate', label: 'Duplicate', icon: Copy, style: 'ghost', action: () => runAction(() => config.service.duplicate(id), `${config.title} duplicated`) });
  }
  if (config.headerActions) {
    headerActions.push(...config.headerActions(doc, { runAction, navigate, toast }));
  }
  if (want('preview')) headerActions.push({ key: 'preview', label: 'Preview', icon: Eye, style: 'ghost', action: handlePrint });
  if (want('print')) headerActions.push({ key: 'print', label: 'Print', icon: Printer, style: 'ghost', action: handlePrint });
  if (want('pdf')) headerActions.push({ key: 'pdf', label: 'Download PDF', icon: FileDown, style: 'ghost', action: handlePdf });
  if (want('share')) headerActions.push({ key: 'share', label: 'Share', icon: Share2, style: 'ghost', action: handleShare });
  if (want('email')) headerActions.push({ key: 'email', label: 'Email', icon: Mail, style: 'ghost', action: handleEmail });
  if (want('whatsapp')) headerActions.push({ key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, style: 'ghost', action: handleWhatsApp });
  if (status !== 'deleted') {
    if (want('archive')) {
      headerActions.push({
        key: 'archive',
        label: status === 'archived' ? 'Restore' : 'Archive',
        icon: status === 'archived' ? RotateCcw : Archive,
        style: 'ghost',
        action: () => setConfirm(status === 'archived' ? 'restore' : 'archive')
      });
    }
    if (want('delete')) headerActions.push({ key: 'delete', label: 'Delete', icon: Trash2, style: 'danger', action: () => setConfirm('delete') });
  }

  const ACTION_STYLES = {
    primary: 'qpo-btn-primary',
    green: 'qpo-btn-primary',
    secondary: 'qpo-btn-ghost',
    ghost: 'qpo-btn-ghost',
    approve: 'qpo-btn-primary',
    reject: 'qpo-btn-primary',
    danger: 'qpo-btn-ghost'
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

  const TABS =
    config.viewTabs ||
    [
      { key: 'overview', label: 'Overview', icon: Layers, count: null },
      ...(config.showItems !== false ? [{ key: 'items', label: 'Items', icon: Package, count: items.length }] : []),
      { key: 'attachments', label: 'Attachments', icon: Paperclip, count: attachments.length },
      { key: 'timeline', label: 'Timeline', icon: History, count: timelineEvents.length },
      { key: 'activities', label: 'Activity Log', icon: ClipboardList, count: null }
    ];

  const linkedDocs = config.linkedDocs ? config.linkedDocs(doc) : [];
  const versionHistory = Array.isArray(doc.history) ? doc.history : [];
  const approvalSteps = ['draft', 'sent', 'accepted', 'rejected', 'converted'];
  const approvalStatus = String(doc.status || 'draft').toLowerCase();
  const approvalIdx = approvalSteps.indexOf(approvalStatus);

  const generalRows = config.generalRows ? config.generalRows(doc) : [];

  const backBtn = (
    <button type="button" className="qpo-btn qpo-btn-ghost" onClick={() => navigate(config.listRoute)}>
      <ArrowLeft /> Back
    </button>
  );

  return (
    <div className="qpo-page">
      {/* ===== BREADCRUMB ===== */}
      <div className="qpo-breadcrumb">
        <a onClick={() => navigate('/dashboard')}>Dashboard</a>
        <FileText style={{ width: 10, height: 10 }} />
        <a onClick={() => navigate('/quotations')}>Quotations</a>
        <FileText style={{ width: 10, height: 10 }} />
        <span>{no || doc.id}</span>
      </div>

      {/* ===== HEADER ===== */}
      <div className="qpo-view-section" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
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
                fontSize: 18,
                fontWeight: 700,
                flexShrink: 0
              }}
            >
              {initialOf(doc.clientName || doc.client)}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.3 }}>
                {doc.clientName || doc.client || config.title}{' '}
                <span style={{ color: '#9ca3af', fontWeight: 600 }}>({no || doc.id})</span>
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                  <Tag style={{ width: 12, height: 12, color: '#0b4a3d' }} /> {no || doc.id}
                </span>
                <SalesStatusBadge status={doc.status} />
                {config.headerInfo ? config.headerInfo(doc) : null}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                  <Calendar style={{ width: 12, height: 12, color: '#0b4a3d' }} /> {formatDate(doc[config.dateKey] || doc.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {backBtn}
            {headerActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.action}
                disabled={actionLoading}
                className={`qpo-btn ${ACTION_STYLES[action.style] || 'qpo-btn-ghost'}`}
                style={action.style === 'danger' ? { borderColor: '#fecaca', color: '#dc2626' } : undefined}
              >
                <action.icon /> {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="qpo-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`qpo-tab${active ? ' active' : ''}`}>
              <Icon /> {t.label}
              {t.count != null && (
                <span className="qpo-badge qpo-badge-gray" style={{ padding: '0px 7px', fontSize: 10 }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ===== OVERVIEW PANE ===== */}
      {tab === 'overview' && (
        <div className="qpo-view-grid">
          <div>
            <div className="qpo-view-section">
              <SectionHeader icon={Info} title="General Information" />
              {generalRows.map(([label, value]) => (
                <Field key={label} label={label}>{value}</Field>
              ))}
              <Field label="Status"><SalesStatusBadge status={doc.status} /></Field>
              {doc.createdAt && <Field label="Created Date">{formatDate(doc.createdAt)}</Field>}
              {doc.updatedAt && <Field label="Last Updated">{formatDate(doc.updatedAt)}</Field>}
            </div>

            <div className="qpo-view-section">
              <SectionHeader icon={User} title="Customer Details" />
              <Field label="Client">{doc.clientName || '—'}</Field>
              <Field label="Contact Person">{doc.contactPerson || '—'}</Field>
              <Field label="Phone">{doc.phone || '—'}</Field>
              <Field label="Email">
                {doc.email ? (
                  <a href={`mailto:${doc.email}`} style={{ color: '#0b4a3d', fontWeight: 500, textDecoration: 'none' }}>{doc.email}</a>
                ) : (
                  '—'
                )}
              </Field>
              <Field label="GSTIN">{doc.gstin || '—'}</Field>
              {doc.pan && <Field label="PAN">{doc.pan}</Field>}
            </div>

            {(config.addressCards && (doc.billingAddress || doc.shippingAddress)) && (
              <>
                {doc.billingAddress && (
                  <div className="qpo-view-section">
                    <SectionHeader icon={MapPin} title="Billing Address" />
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {doc.billingAddress}
                      {[doc.billingCity, doc.billingState, doc.billingPin].filter(Boolean).join(', ') && (
                        <span style={{ display: 'block', marginTop: 4, color: '#6b7280' }}>
                          {[doc.billingCity, doc.billingState, doc.billingPin].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {doc.shippingAddress && (
                  <div className="qpo-view-section">
                    <SectionHeader icon={Truck} title="Shipping Address" />
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {doc.shippingAddress}
                      {[doc.shippingCity, doc.shippingState, doc.shippingPin].filter(Boolean).join(', ') && (
                        <span style={{ display: 'block', marginTop: 4, color: '#6b7280' }}>
                          {[doc.shippingCity, doc.shippingState, doc.shippingPin].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {config.showItemsInOverview && items.length > 0 && (
              <div className="qpo-view-section" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '20px 20px 12px' }}>
                  <SectionHeader icon={Package} title="Items" count={`${items.length} items`} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="qpo-table" style={{ minWidth: 760 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40, textAlign: 'center' }}>#</th>
                        <th>Item</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        <th style={{ textAlign: 'center' }}>Unit</th>
                        <th className="qpo-th-right">Rate</th>
                        <th className="qpo-th-right">Tax %</th>
                        <th className="qpo-th-right">Amount</th>
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
                          <td style={{ textAlign: 'center' }}>{it.uom || it.unit || '—'}</td>
                          <td className="qpo-th-right">{formatINR(Number(it.rate) || 0)}</td>
                          <td className="qpo-th-right">{it.gstRate ?? it.tax ?? 0}%</td>
                          <td className="qpo-th-right"><strong>{formatINR(Number(it.amount) || Number(it.total) || 0)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(doc.terms || doc.notes || doc.remarks) && (
              <div className="qpo-view-section">
                <SectionHeader icon={StickyNote} title="Terms & Notes" />
                {doc.terms && <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 8 }}><strong style={{ color: '#374151' }}>Terms &amp; Conditions</strong> — {doc.terms}</div>}
                {doc.notes && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{doc.notes}</div>}
                {doc.remarks && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{doc.remarks}</div>}
              </div>
            )}
          </div>

          <div>
            {config.showItems !== false && (
              <div className="qpo-view-section">
                <SectionHeader icon={Package} title="Totals" />
                <Field label="Sub Total"><strong>{formatINR(totals.subTotal)}</strong></Field>
                {Number(totals.discount) > 0 && <Field label="Discount">− {formatINR(totals.discount)}</Field>}
                {Number(totals.cgstTotal) > 0 && <Field label="CGST">{formatINR(totals.cgstTotal)}</Field>}
                {Number(totals.sgstTotal) > 0 && <Field label="SGST">{formatINR(totals.sgstTotal)}</Field>}
                {Number(totals.charges) > 0 && <Field label="Charges">{formatINR(totals.charges)}</Field>}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 2px', marginTop: 8, borderTop: '2px solid #0b4a3d', fontSize: 14 }}>
                  <span style={{ fontWeight: 700, color: '#1f2937' }}>Grand Total</span>
                  <span style={{ fontWeight: 800, color: '#0b4a3d' }}>{formatINR(totals.grandTotal)}</span>
                </div>
                {config.summaryRows ? config.summaryRows(doc, totals) : null}
              </div>
            )}

            <div className="qpo-view-section">
              <SectionHeader icon={Link2} title="Linked Documents" />
              {linkedDocs.length > 0 ? (
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
              ) : (
                <EmptyState icon={Link2} title="No Linked Documents" />
              )}
            </div>

            <div className="qpo-view-section">
              <SectionHeader icon={History} title="Timeline" count={`${timelineEvents.length} events`} />
              <div className="qpo-audit-timeline" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {timelineEvents.length === 0 ? (
                  <EmptyState icon={Clock} title="No Timeline Events" />
                ) : (
                  <>
                    {timelineEvents.slice(0, 6).map((event) => (
                      <TimelineEvent key={`${event.title}-${event.date}`} event={event} />
                    ))}
                    {timelineEvents.length > 6 && (
                      <div style={{ textAlign: 'center', paddingTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => setTab('timeline')}
                          style={{ fontSize: 12, fontWeight: 600, color: '#0b4a3d', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                        >
                          View all {timelineEvents.length} events →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="qpo-view-section">
              <SectionHeader icon={ClipboardList} title="Activity Log" />
              {activityEvents.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No Activity" />
              ) : (
                <>
                  {activityEvents.slice(0, 4).map((a, i) => {
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
                  {activityEvents.length > 4 && (
                    <div style={{ textAlign: 'center', paddingTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => setTab('activities')}
                        style={{ fontSize: 12, fontWeight: 600, color: '#0b4a3d', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                      >
                        +{activityEvents.length - 4} more
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== ITEMS PANE ===== */}
      {tab === 'items' && config.showItems !== false && (
        <div className="qpo-view-section" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 12px' }}>
            <SectionHeader icon={Layers} title="Item Details" count={`${items.length} records`} />
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '0 20px 20px' }}>
              <EmptyState icon={Package} title="No Items" />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="qpo-table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center' }}>#</th>
                    <th>Product</th>
                    <th>Description</th>
                    <th>HSN</th>
                    <th style={{ textAlign: 'center' }}>Unit</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th className="qpo-th-right">Rate</th>
                    <th className="qpo-th-right">Disc %</th>
                    <th className="qpo-th-right">GST %</th>
                    <th className="qpo-th-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: '#6b7280' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 500 }}>{it.productName || it.product || '—'}</td>
                      <td>{it.description || '—'}</td>
                      <td>{it.hsn || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{it.unit || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{it.qty ?? '—'}</td>
                      <td className="qpo-th-right">{formatINR(Number(it.rate) || 0)}</td>
                      <td className="qpo-th-right">{it.discountPct ?? 0}%</td>
                      <td className="qpo-th-right">{it.gstRate ?? 0}%</td>
                      <td className="qpo-th-right"><strong>{formatINR(Number(it.amount) || 0)}</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f8fafc' }}>
                    <td colSpan={9} style={{ textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Sub Total</td>
                    <td className="qpo-th-right" style={{ fontWeight: 700 }}>{formatINR(totals.subTotal)}</td>
                  </tr>
                  <tr style={{ background: '#f8fafc' }}>
                    <td colSpan={9} style={{ textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Discount</td>
                    <td className="qpo-th-right" style={{ fontWeight: 700 }}>{formatINR(totals.discount)}</td>
                  </tr>
                  <tr style={{ background: '#f8fafc' }}>
                    <td colSpan={9} style={{ textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Tax Total (CGST + SGST)</td>
                    <td className="qpo-th-right" style={{ fontWeight: 700 }}>{formatINR(totals.taxTotal)}</td>
                  </tr>
                  {Number(totals.charges) > 0 && (
                    <tr style={{ background: '#f8fafc' }}>
                      <td colSpan={9} style={{ textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Charges</td>
                      <td className="qpo-th-right" style={{ fontWeight: 700 }}>{formatINR(totals.charges)}</td>
                    </tr>
                  )}
                  <tr style={{ background: '#0b4a3d' }}>
                    <td colSpan={9} style={{ textAlign: 'right', fontWeight: 700, color: '#fff' }}>Grand Total</td>
                    <td className="qpo-th-right" style={{ fontWeight: 800, color: '#fff' }}>{formatINR(totals.grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== ATTACHMENTS PANE ===== */}
      {tab === 'attachments' && (
        <div className="qpo-view-section">
          <SectionHeader icon={Paperclip} title="Attachments" count={`${attachments.length} files`} />
          <SalesAttachments service={config.service} docId={id} attachments={attachments} onChanged={load} />
        </div>
      )}

      {/* ===== TIMELINE PANE ===== */}
      {tab === 'timeline' && (
        <div className="qpo-view-section">
          <SectionHeader icon={History} title="Full Timeline" count={`${timelineEvents.length} events`} />
          {timelineEvents.length === 0 ? (
            <EmptyState icon={Clock} title="No Timeline Events" />
          ) : (
            <div className="qpo-audit-timeline">
              {timelineEvents.map((event) => (
                <TimelineEvent key={`${event.title}-${event.date}`} event={event} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== ACTIVITY LOG PANE ===== */}
      {tab === 'activities' && (
        <div className="qpo-view-section">
          <SectionHeader icon={ClipboardList} title="Activity Log" count={`${activityEvents.length} records`} />
          {activityEvents.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No Activity Recorded" />
          ) : (
            <div>
              {activityEvents.map((a, i) => {
                const Icon = ACTIVITY_ICONS[a.icon] || ACTIVITY_ICONS.default;
                return (
                  <div key={`${a.text}-${a.date}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
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
      )}

      {/* ===== LINKED DOCUMENTS PANE ===== */}
      {tab === 'linked-documents' && (
        <div className="qpo-view-section">
          <SectionHeader icon={Link2} title="Linked Documents" count={`${linkedDocs.length} links`} />
          {linkedDocs.length === 0 ? (
            <EmptyState icon={Link2} title="No Linked Documents" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {linkedDocs.map((link) => (
                <div key={link.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Link2 style={{ width: 14, height: 14, color: '#0b4a3d' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, width: 140 }}>{link.label}</span>
                    {link.onClick ? (
                      <button type="button" onClick={link.onClick} style={{ fontSize: 13, fontWeight: 600, color: '#0b4a3d', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                        {link.value}
                      </button>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{link.value}</span>
                    )}
                  </div>
                  {link.onClick && <FileText style={{ width: 14, height: 14, color: '#cbd5e1' }} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== VERSION HISTORY PANE ===== */}
      {tab === 'version-history' && (
        <div className="qpo-view-section" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 12px' }}>
            <SectionHeader icon={GitBranch} title="Version History" count={`${versionHistory.length} records`} />
          </div>
          {versionHistory.length === 0 ? (
            <div style={{ padding: '0 20px 20px' }}>
              <EmptyState icon={GitBranch} title="No Revision History" subtitle="This is the original version of the document." />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="qpo-table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Date</th>
                    <th>Field</th>
                    <th>Changed By</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {versionHistory.map((h, i) => (
                    <tr key={`${h.createdAt}-${i}`}>
                      <td style={{ fontWeight: 700 }}>v{versionHistory.length - i}</td>
                      <td>{formatDateTime(h.createdAt)}</td>
                      <td>
                        {h.field || '—'}
                        {h.oldValue && <span style={{ color: '#9ca3af' }}>: {h.oldValue} → {h.newValue}</span>}
                      </td>
                      <td>{h.changedBy || 'Admin'}</td>
                      <td>{h.newValue || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== APPROVAL HISTORY PANE ===== */}
      {tab === 'approval-history' && (
        <div className="qpo-view-section">
          <SectionHeader icon={CheckCheck} title="Approval Status" />
          <div className="qpo-workflow" style={{ marginBottom: 20 }}>
            {approvalSteps.map((step, i) => {
              const done = approvalIdx >= 0 && i <= approvalIdx;
              return (
                <div key={step} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div className={`qpo-workflow-node${done ? ' completed' : ''}`} title={step}>
                    {i < approvalIdx ? <Check style={{ width: 13, height: 13 }} /> : i + 1}
                  </div>
                  {i < approvalSteps.length - 1 && <div className="qpo-workflow-connector" />}
                </div>
              );
            })}
          </div>
          <SectionHeader icon={History} title="Approval History" count={`${activityEvents.length} records`} />
          {activityEvents.length === 0 ? (
            <EmptyState icon={History} title="No Approval Activity" />
          ) : (
            <div>
              {activityEvents.map((a, i) => (
                <div key={`${a.text}-${a.date}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
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
      )}

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
      <style>{`@keyframes qpo-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
