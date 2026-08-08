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
import { ConfirmDialog, useToast } from '../Common';
import SalesStatusBadge from '../SalesTable/SalesStatusBadge';
import SalesAttachments from './SalesAttachments';
import { formatDate, formatDateTime, formatINR } from '../../utils/leadHelpers';
import { computeTotals, docNumber, emailDocument, shareDocument, whatsappDocument } from '../../utils/salesHelpers';

function initialOf(name = '') {
  return (name || 'D').charAt(0).toUpperCase();
}

function Row({ label, children }) {
  return (
    <div className="flex py-1.5 text-[13px] border-b border-slate-100 last:border-b-0">
      <span className="w-[130px] shrink-0 text-slate-500 font-medium text-xs">{label}</span>
      <span className="text-slate-700 font-medium flex-1">{children}</span>
    </div>
  );
}

function CardHeader({ icon: Icon, title, count }) {
  return (
    <h3 className="flex items-center gap-2 text-[13px] font-bold text-[#0B4A3D] uppercase tracking-wider mb-3">
      <Icon className="w-4 h-4" />
      {title}
      {count != null && <span className="normal-case font-semibold text-slate-400 text-xs">({count})</span>}
    </h3>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="text-center py-10">
      <Icon className="w-9 h-9 text-slate-300 mx-auto mb-3" />
      <h4 className="text-[15px] font-bold text-slate-600 mb-1">{title}</h4>
      {subtitle && <p className="text-[13px] text-slate-400">{subtitle}</p>}
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
    <div className="relative pl-9 pb-4 last:pb-0 group">
      <span className={`absolute left-[3px] top-1 w-3 h-3 rounded-full border-2 ${TL_DOT_COLORS[event.type] || TL_DOT_COLORS.default} group-hover:scale-125 transition-transform`} />
      <div className="text-[13px] font-semibold text-slate-800">{event.title}</div>
      {event.desc && <div className="text-xs text-slate-500 mt-0.5">{event.desc}</div>}
      <div className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(event.date)}</div>
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
    events.push({ title: 'Archived', desc: `Document was archived.`, date: doc.archivedAt, type: 'archived' });
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
 * Generic view page for a Sales Execution module.
 * config:
 *  - service, moduleKey, title, label, listRoute, editRoute
 *  - normalize(row)
 *  - generalRows(doc) -> [[label, node], ...]
 *  - headerInfo(doc) -> [tag, ...] rendered next to the badge
 *  - linkedDocs(doc) -> [{ label, value, onClick }]
 *  - printHtml(doc) / exportPdf(doc)  (optional document renderers)
 */
export default function SalesViewPage({ config }) {
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
      <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
        <div className="flex items-center justify-center py-24">
          <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-[#0B4A3D] animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
          <span>VISHAK TECH</span>
          <span>&gt;</span>
          <span>Sales Execution</span>
          <span>&gt;</span>
          <span>{config.title}</span>
        </div>
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-10 text-center">
          <Info className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-700 mb-1">{config.title} Not Found</h2>
          <p className="text-xs text-slate-400 mb-5">The {config.title.toLowerCase()} you are looking for does not exist.</p>
          <button
            type="button"
            onClick={() => navigate(config.listRoute)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to {config.title} List
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
    // quotation freight + insurance are part of the grand total (backend recalcTotals adds them)
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
    primary: 'bg-[#0B4A3D] hover:bg-[#083D34] text-white',
    green: 'bg-[#059669] hover:bg-[#047857] text-white',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    ghost: 'bg-surface border border-slate-200 hover:bg-slate-50 text-slate-600',
    approve: 'bg-[#16a34a] hover:bg-[#15803d] text-white',
    reject: 'bg-[#dc2626] hover:bg-[#b91c1c] text-white',
    danger: 'bg-surface border border-rose-200 hover:bg-rose-50 text-rose-600'
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
    config.viewTabs || [
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

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
      {/* ===== BREADCRUMB ===== */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
        <span>VISHAK TECH</span>
        <span>&gt;</span>
        <span>Sales Execution</span>
        <span>&gt;</span>
        <span>{config.title}</span>
        <span>&gt;</span>
        <span className="text-slate-600">{no || doc.id}</span>
      </div>

      {/* ===== STICKY HEADER ===== */}
      <div className="sticky top-0 z-20 bg-app">
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-[#0B4A3D] to-[#083D34] text-white flex items-center justify-center text-xl font-bold shrink-0">
                {initialOf(doc.clientName || doc.client)}
              </div>
              <div className="min-w-0">
                <h1 className="text-[22px] font-bold text-slate-900 leading-tight truncate">
                  {doc.clientName || doc.client || config.title}{' '}
                  <span className="text-slate-400 font-semibold">({no || doc.id})</span>
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Tag className="w-3 h-3 text-[#0B4A3D]" /> {no || doc.id}
                  </span>
                  <SalesStatusBadge status={doc.status} />
                  {config.headerInfo ? config.headerInfo(doc) : null}
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="w-3 h-3 text-[#0B4A3D]" /> {formatDate(doc[config.dateKey] || doc.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => navigate(config.listRoute)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              {headerActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={action.action}
                  disabled={actionLoading}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${ACTION_STYLES[action.style]}`}
                >
                  <action.icon className="w-3.5 h-3.5" /> {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ===== TABS ===== */}
        <div className="flex items-center gap-1 border-b-2 border-slate-200 mt-3 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-0.5 transition-colors cursor-pointer ${
                  active ? 'border-[#0B4A3D] text-[#0B4A3D] font-semibold' : 'border-transparent text-slate-500 hover:text-[#0B4A3D]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {t.count != null && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                      active ? 'bg-[#EDF7F4] text-[#0B4A3D]' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== OVERVIEW PANE ===== */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start mt-4">
          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
              <CardHeader icon={Info} title="General Information" />
              {generalRows.map(([label, value]) => (
                <Row key={label} label={label}>{value}</Row>
              ))}
              <Row label="Status"><SalesStatusBadge status={doc.status} /></Row>
              {doc.createdAt && <Row label="Created Date">{formatDate(doc.createdAt)}</Row>}
              {doc.updatedAt && <Row label="Last Updated">{formatDate(doc.updatedAt)}</Row>}
            </div>

            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
              <CardHeader icon={User} title="Customer Details" />
              <Row label="Client">{doc.clientName || '—'}</Row>
              <Row label="Contact Person">{doc.contactPerson || '—'}</Row>
              <Row label="Phone">{doc.phone || '—'}</Row>
              <Row label="Email">
                {doc.email ? (
                  <a href={`mailto:${doc.email}`} className="text-[#0B4A3D] font-medium hover:underline">{doc.email}</a>
                ) : (
                  '—'
                )}
              </Row>
              <Row label="GSTIN">{doc.gstin || '—'}</Row>
              {doc.pan && <Row label="PAN">{doc.pan}</Row>}
            </div>

            {(config.addressCards && (doc.billingAddress || doc.shippingAddress)) && (
              <>
                {doc.billingAddress && (
                  <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
                    <CardHeader icon={MapPin} title="Billing Address" />
                    <div className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {doc.billingAddress}
                      {[doc.billingCity, doc.billingState, doc.billingPin].filter(Boolean).join(', ') && (
                        <span className="block mt-1 text-slate-500">
                          {[doc.billingCity, doc.billingState, doc.billingPin].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {doc.shippingAddress && (
                  <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
                    <CardHeader icon={Truck} title="Shipping Address" />
                    <div className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {doc.shippingAddress}
                      {[doc.shippingCity, doc.shippingState, doc.shippingPin].filter(Boolean).join(', ') && (
                        <span className="block mt-1 text-slate-500">
                          {[doc.shippingCity, doc.shippingState, doc.shippingPin].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {config.showItemsInOverview && items.length > 0 && (
              <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
                <CardHeader icon={Package} title="Items" count={`${items.length} items`} />
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full border-collapse" style={{ minWidth: 760 }}>
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="py-2 px-2 text-center text-[11px] font-bold text-slate-500 w-8">#</th>
                        <th className="py-2 px-2 text-left text-[11px] font-bold text-slate-500">Item</th>
                        <th className="py-2 px-2 text-center text-[11px] font-bold text-slate-500">Qty</th>
                        <th className="py-2 px-2 text-center text-[11px] font-bold text-slate-500">Unit</th>
                        <th className="py-2 px-2 text-right text-[11px] font-bold text-slate-500">Rate</th>
                        <th className="py-2 px-2 text-right text-[11px] font-bold text-slate-500">Tax %</th>
                        <th className="py-2 px-2 text-right text-[11px] font-bold text-slate-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-2 text-center text-xs text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-2 text-xs text-slate-700">
                            {it.description || it.productName || '—'}
                            {it.hsn && <span className="block text-[10px] text-slate-400">HSN: {it.hsn}</span>}
                          </td>
                          <td className="py-2 px-2 text-center text-xs text-slate-600">{it.qty ?? '—'}</td>
                          <td className="py-2 px-2 text-center text-xs text-slate-600">{it.uom || it.unit || '—'}</td>
                          <td className="py-2 px-2 text-right text-xs text-slate-600">{formatINR(Number(it.rate) || 0)}</td>
                          <td className="py-2 px-2 text-right text-xs text-slate-600">{it.gstRate ?? it.tax ?? 0}%</td>
                          <td className="py-2 px-2 text-right text-xs font-semibold text-slate-700">
                            {formatINR(Number(it.amount) || Number(it.total) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(doc.terms || doc.notes || doc.remarks) && (
              <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
                <CardHeader icon={StickyNote} title="Terms & Notes" />
                {doc.terms && <div className="text-[13px] text-slate-500 leading-relaxed whitespace-pre-wrap mb-2"><span className="font-bold text-slate-700">Terms &amp; Conditions</span> — {doc.terms}</div>}
                {doc.notes && <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap mb-2">{doc.notes}</div>}
                {doc.remarks && <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{doc.remarks}</div>}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-40">
            {config.showItems !== false && (
              <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
                <CardHeader icon={Package} title="Totals" />
                <div className="flex flex-col">
                  <Row label="Sub Total"><strong>{formatINR(totals.subTotal)}</strong></Row>
                  {Number(totals.discount) > 0 && <Row label="Discount">− {formatINR(totals.discount)}</Row>}
                  {Number(totals.cgstTotal) > 0 && <Row label="CGST">{formatINR(totals.cgstTotal)}</Row>}
                  {Number(totals.sgstTotal) > 0 && <Row label="SGST">{formatINR(totals.sgstTotal)}</Row>}
                  {Number(totals.charges) > 0 && <Row label="Charges">{formatINR(totals.charges)}</Row>}
                  <div className="flex justify-between py-2 mt-1 border-t-2 border-[#0B4A3D] text-[13px]">
                    <span className="font-bold text-slate-800">Grand Total</span>
                    <span className="font-extrabold text-[#0B4A3D]">{formatINR(totals.grandTotal)}</span>
                  </div>
                </div>
                {config.summaryRows ? config.summaryRows(doc, totals) : null}
              </div>
            )}

            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
              <CardHeader icon={Link2} title="Linked Documents" />
              {linkedDocs.length > 0 ? (
                linkedDocs.map((link) => (
                  <Row key={link.label} label={link.label}>
                    {link.onClick ? (
                      <button
                        type="button"
                        onClick={link.onClick}
                        className="inline-flex items-center gap-1 text-[#0B4A3D] font-medium hover:underline cursor-pointer"
                      >
                        {link.value} <FileText className="w-3 h-3" />
                      </button>
                    ) : (
                      link.value || '—'
                    )}
                  </Row>
                ))
              ) : (
                <EmptyState icon={Link2} title="No Linked Documents" />
              )}
            </div>

            {!config.showItemsInOverview && (doc.remarks || doc.notes || doc.terms) && (
              <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
                <CardHeader icon={StickyNote} title="Notes & Terms" />
                {doc.remarks && <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap mb-2">{doc.remarks}</div>}
                {doc.notes && <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap mb-2">{doc.notes}</div>}
                {doc.terms && <div className="text-[13px] text-slate-500 leading-relaxed whitespace-pre-wrap">{doc.terms}</div>}
              </div>
            )}

            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
              <CardHeader icon={History} title="Timeline" count={`${timelineEvents.length} events`} />
              <div className="relative before:content-[''] before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-0.5 before:bg-slate-200 max-h-80 overflow-y-auto pr-1">
                {timelineEvents.length === 0 ? (
                  <EmptyState icon={Clock} title="No Timeline Events" />
                ) : (
                  <>
                    {timelineEvents.slice(0, 6).map((event) => (
                      <TimelineEvent key={`${event.title}-${event.date}`} event={event} />
                    ))}
                    {timelineEvents.length > 6 && (
                      <div className="text-center py-2">
                        <button
                          type="button"
                          onClick={() => setTab('timeline')}
                          className="text-xs font-semibold text-[#0B4A3D] hover:underline cursor-pointer"
                        >
                          View all {timelineEvents.length} events →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
              <CardHeader icon={ClipboardList} title="Activity Log" />
              {activityEvents.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No Activity" />
              ) : (
                <>
                  {activityEvents.slice(0, 4).map((a, i) => {
                    const Icon = ACTIVITY_ICONS[a.icon] || ACTIVITY_ICONS.default;
                    return (
                      <div key={`${a.text}-${a.date}-${i}`} className="flex items-start gap-2.5 py-2 border-b border-slate-100 last:border-b-0">
                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] text-slate-700">{a.text}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(a.date)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {activityEvents.length > 4 && (
                    <div className="text-center py-1.5">
                      <button
                        type="button"
                        onClick={() => setTab('activities')}
                        className="text-xs font-semibold text-slate-400 hover:text-[#0B4A3D] cursor-pointer"
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
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5 mt-4">
          <CardHeader icon={Layers} title="Item Details" count={`${items.length} records`} />
          {items.length === 0 ? (
            <EmptyState icon={Package} title="No Items" />
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full border-collapse" style={{ minWidth: 900 }}>
                <thead>
                  <tr className="bg-slate-50">
                    <th className="py-2 px-2 text-center text-[11px] font-bold text-slate-500 w-10">#</th>
                    <th className="py-2 px-2 text-left text-[11px] font-bold text-slate-500">Product</th>
                    <th className="py-2 px-2 text-left text-[11px] font-bold text-slate-500">Description</th>
                    <th className="py-2 px-2 text-left text-[11px] font-bold text-slate-500">HSN</th>
                    <th className="py-2 px-2 text-center text-[11px] font-bold text-slate-500">Unit</th>
                    <th className="py-2 px-2 text-center text-[11px] font-bold text-slate-500">Qty</th>
                    <th className="py-2 px-2 text-right text-[11px] font-bold text-slate-500">Rate</th>
                    <th className="py-2 px-2 text-right text-[11px] font-bold text-slate-500">Disc %</th>
                    <th className="py-2 px-2 text-right text-[11px] font-bold text-slate-500">GST %</th>
                    <th className="py-2 px-2 text-right text-[11px] font-bold text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-2 text-center text-xs text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2 text-xs font-medium text-slate-700">{it.productName || it.product || '—'}</td>
                      <td className="py-2 px-2 text-xs text-slate-600">{it.description || '—'}</td>
                      <td className="py-2 px-2 text-xs text-slate-600">{it.hsn || '—'}</td>
                      <td className="py-2 px-2 text-center text-xs text-slate-600">{it.unit || '—'}</td>
                      <td className="py-2 px-2 text-center text-xs text-slate-600">{it.qty ?? '—'}</td>
                      <td className="py-2 px-2 text-right text-xs text-slate-600">{formatINR(Number(it.rate) || 0)}</td>
                      <td className="py-2 px-2 text-right text-xs text-slate-600">{it.discountPct ?? 0}%</td>
                      <td className="py-2 px-2 text-right text-xs text-slate-600">{it.gstRate ?? 0}%</td>
                      <td className="py-2 px-2 text-right text-xs font-semibold text-slate-700">
                        {formatINR(Number(it.amount) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                    <td colSpan={9} className="py-2.5 px-2 text-right text-[13px] font-semibold text-slate-500">
                      Sub Total
                    </td>
                    <td className="py-2.5 px-2 text-right text-[13px] font-bold text-slate-800">{formatINR(totals.subTotal)}</td>
                  </tr>
                  <tr className="border-t border-slate-100 bg-slate-50/60">
                    <td colSpan={9} className="py-2.5 px-2 text-right text-[13px] font-semibold text-slate-500">
                      Discount
                    </td>
                    <td className="py-2.5 px-2 text-right text-[13px] font-bold text-slate-800">{formatINR(totals.discount)}</td>
                  </tr>
                  <tr className="border-t border-slate-100 bg-slate-50/60">
                    <td colSpan={9} className="py-2.5 px-2 text-right text-[13px] font-semibold text-slate-500">
                      Tax Total (CGST + SGST)
                    </td>
                    <td className="py-2.5 px-2 text-right text-[13px] font-bold text-slate-800">{formatINR(totals.taxTotal)}</td>
                  </tr>
                  {Number(totals.charges) > 0 && (
                    <tr className="border-t border-slate-100 bg-slate-50/60">
                      <td colSpan={9} className="py-2.5 px-2 text-right text-[13px] font-semibold text-slate-500">
                        Charges
                      </td>
                      <td className="py-2.5 px-2 text-right text-[13px] font-bold text-slate-800">{formatINR(totals.charges)}</td>
                    </tr>
                  )}
                  <tr className="bg-[#0B4A3D]">
                    <td colSpan={9} className="py-2.5 px-2 text-right text-[13px] font-bold text-white">
                      Grand Total
                    </td>
                    <td className="py-2.5 px-2 text-right text-sm font-extrabold text-white">
                      {formatINR(totals.grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== ATTACHMENTS PANE ===== */}
      {tab === 'attachments' && (
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5 mt-4">
          <CardHeader icon={Paperclip} title="Attachments" count={`${attachments.length} files`} />
          <SalesAttachments service={config.service} docId={id} attachments={attachments} onChanged={load} />
        </div>
      )}

      {/* ===== TIMELINE PANE ===== */}
      {tab === 'timeline' && (
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5 mt-4">
          <CardHeader icon={History} title="Full Timeline" count={`${timelineEvents.length} events`} />
          {timelineEvents.length === 0 ? (
            <EmptyState icon={Clock} title="No Timeline Events" />
          ) : (
            <div className="relative before:content-[''] before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-0.5 before:bg-slate-200">
              {timelineEvents.map((event) => (
                <TimelineEvent key={`${event.title}-${event.date}`} event={event} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== ACTIVITY LOG PANE ===== */}
      {tab === 'activities' && (
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5 mt-4">
          <CardHeader icon={ClipboardList} title="Activity Log" count={`${activityEvents.length} records`} />
          {activityEvents.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No Activity Recorded" />
          ) : (
            <div>
              {activityEvents.map((a, i) => {
                const Icon = ACTIVITY_ICONS[a.icon] || ACTIVITY_ICONS.default;
                return (
                  <div key={`${a.text}-${a.date}-${i}`} className="flex items-start gap-2.5 py-2.5 border-b border-slate-100 last:border-b-0">
                    <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] text-slate-700">{a.text}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(a.date)}</div>
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
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5 mt-4">
          <CardHeader icon={Link2} title="Linked Documents" count={`${linkedDocs.length} links`} />
          {linkedDocs.length === 0 ? (
            <EmptyState icon={Link2} title="No Linked Documents" />
          ) : (
            <div className="flex flex-col gap-2">
              {linkedDocs.map((link) => (
                <div key={link.label} className="flex items-center justify-between px-4 py-3 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <Link2 className="w-3.5 h-3.5 text-[#0B4A3D]" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide w-36 shrink-0">
                      {link.label}
                    </span>
                    {link.onClick ? (
                      <button
                        type="button"
                        onClick={link.onClick}
                        className="text-[13px] font-semibold text-[#0B4A3D] hover:underline cursor-pointer"
                      >
                        {link.value}
                      </button>
                    ) : (
                      <span className="text-[13px] font-semibold text-slate-700">{link.value}</span>
                    )}
                  </div>
                  {link.onClick && <FileText className="w-3.5 h-3.5 text-slate-300" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== VERSION HISTORY PANE ===== */}
      {tab === 'version-history' && (
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5 mt-4">
          <CardHeader icon={GitBranch} title="Version History" count={`${versionHistory.length} records`} />
          {versionHistory.length === 0 ? (
            <EmptyState icon={GitBranch} title="No Revision History" subtitle="This is the original version of the document." />
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full border-collapse" style={{ minWidth: 640 }}>
                <thead>
                  <tr className="bg-slate-50">
                    <th className="py-2.5 px-3 text-left text-[11px] font-bold text-slate-500">Version</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-bold text-slate-500">Date</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-bold text-slate-500">Field</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-bold text-slate-500">Changed By</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-bold text-slate-500">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {versionHistory.map((h, i) => (
                    <tr key={`${h.createdAt}-${i}`} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-xs font-bold text-slate-700">v{versionHistory.length - i}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{formatDateTime(h.createdAt)}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">
                        {h.field || '—'}
                        {h.oldValue && <span className="text-slate-400">: {h.oldValue} → {h.newValue}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{h.changedBy || 'Admin'}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{h.newValue || '—'}</td>
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
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5 mt-4">
          <CardHeader icon={CheckCheck} title="Approval Status" />
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {approvalSteps.map((step, i) => {
              const done = approvalIdx >= 0 && i <= approvalIdx;
              return (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${
                      done ? 'bg-[#0B4A3D] text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {i < approvalIdx ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {step.charAt(0).toUpperCase() + step.slice(1)}
                  </div>
                  {i < approvalSteps.length - 1 && <div className={`w-6 h-0.5 ${done && approvalIdx > i ? 'bg-[#0B4A3D]' : 'bg-slate-200'}`} />}
                </div>
              );
            })}
          </div>
          <CardHeader icon={History} title="Approval History" count={`${activityEvents.length} records`} />
          {activityEvents.length === 0 ? (
            <EmptyState icon={History} title="No Approval Activity" />
          ) : (
            <div className="flex flex-col">
              {activityEvents.map((a, i) => (
                <div key={`${a.text}-${a.date}-${i}`} className="flex items-start gap-2.5 py-2.5 border-b border-slate-100 last:border-b-0">
                  <div className="p-1.5 rounded-lg bg-[#EDF7F4] text-[#0B4A3D] shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] text-slate-700">{a.text}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(a.date)}</div>
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
    </div>
  );
}

