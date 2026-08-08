import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Archive, RotateCcw,
  Building2, User, Phone,
  FileText, MapPin, BarChart3, TrendingUp, StickyNote,
  Link2, Paperclip, Clock, Tag, Factory,
  ClipboardList, Folder,
  ChevronRight, Plus, Download, Eye, File
} from 'lucide-react';
import { ConfirmDialog, useToast, PageLoader } from '../components/Common';
import { formatINR, formatDate, formatDateTime, normalizeClient } from '../utils/clientHelpers';
import clientService from '../services/clientService';
import followUpService from '../services/followUpService';
import cprService from '../services/cprService';

/* ============================================================
   OLD.zip Client View page — replicated layout (lo-* design)
   ============================================================ */

const TABS = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'contacts', label: 'Contacts', icon: User },
  { id: 'followups', label: 'Follow-ups', icon: Phone },
  { id: 'purchase-requests', label: 'PRs', icon: ClipboardList },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'documents', label: 'Documents', icon: Folder }
];

function statusBadgeClasses(status) {
  const s = (status || 'active').toLowerCase();
  if (s === 'active') return 'bg-emerald-100 text-emerald-800';
  if (s === 'inactive' || s === 'archived') return 'bg-slate-100 text-slate-600';
  if (s === 'deleted') return 'bg-rose-100 text-rose-600';
  return 'bg-emerald-50 text-emerald-800';
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusBadgeClasses(status)}`}>
      {status || 'Active'}
    </span>
  );
}

/* OLD lo-card */
function Card({ icon: Icon, title, children, className = '' }) {
  return (
    <section className={`bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow duration-150 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-slate-300 mb-4 last:mb-0 ${className}`}>
      <h3 className="text-[13px] font-semibold text-[#0B4A3D] uppercase tracking-wide mb-3 flex items-center gap-1.5 m-0">
        <Icon className="w-4 h-4" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/* OLD lo-row / lo-rowIf */
function Row({ label, value }) {
  return (
    <div className="flex text-[13px] py-[5px] border-b border-slate-100 last:border-b-0">
      <span className="w-[130px] shrink-0 text-slate-500 font-medium text-xs">{label}</span>
      <span className="text-slate-700 font-medium flex-1 min-w-0 break-words">{value || '—'}</span>
    </div>
  );
}

function RowIf({ label, value }) {
  if (value === null || value === undefined || value === '' || value === '—') return null;
  return <Row label={label} value={value} />;
}

/* OLD lo-empty */
function EmptyState({ icon: Icon, title, sub, action }) {
  return (
    <div className="text-center py-10 px-5 text-slate-400 text-[13px]">
      <Icon className="w-9 h-9 text-slate-300 mx-auto mb-2" />
      <h3 className="text-[15px] font-semibold text-slate-500 mb-1">{title}</h3>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* OLD lo-tl-item */
function TimelineItem({ event }) {
  const dotColor =
    event.type === 'created'
      ? 'border-[#0B4A3D] bg-emerald-50'
      : event.type === 'followup'
        ? 'border-amber-500 bg-amber-50'
        : event.type === 'completed'
          ? 'border-emerald-600 bg-emerald-50'
          : 'border-slate-400 bg-white';
  return (
    <div className="relative pl-9 pb-4 last:pb-0">
      <span className={`absolute left-2 top-1 w-3 h-3 rounded-full border-2 ${dotColor} transition-transform duration-200 hover:scale-125`} />
      <div className="text-[13px] font-semibold text-slate-900">
        {event.tag && (
          <span className="inline-block bg-[#0B4A3D]/10 text-[#0B4A3D] px-1.5 py-px rounded text-[11px] font-semibold mr-1 align-middle">
            {event.tag}
          </span>
        )}
        {event.title}
      </div>
      {event.desc && <div className="text-xs text-slate-500 mt-0.5">{event.desc}</div>}
      <div className="text-[11px] text-slate-400 mt-0.5">{event.time}</div>
    </div>
  );
}

function Timeline({ events }) {
  return (
    <div className="relative before:content-[''] before:absolute before:left-[15px] before:top-1 before:bottom-1 before:w-[2px] before:bg-slate-200 before:rounded">
      {events.length === 0 ? (
        <EmptyState icon={Clock} title="No Timeline Events" />
      ) : (
        events.map((event, i) => <TimelineItem key={i} event={event} />)
      )}
    </div>
  );
}

/* OLD lo-doc-item */
function DocItem({ doc }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 border border-slate-100 rounded-lg mb-1.5 hover:bg-emerald-50/40 transition-colors">
      <File className="w-4 h-4 text-[#0B4A3D] shrink-0" />
      <span className="flex-1 text-[13px] text-slate-700 truncate">{doc.name || doc.filename || 'File'}</span>
      {doc.size ? <span className="text-[11px] text-slate-400">{doc.size > 1024 ? `${Math.round(doc.size / 1024)} KB` : `${doc.size} B`}</span> : null}
      <div className="flex gap-1">
        <button className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-[#0B4A3D] transition-colors cursor-pointer" title="Download" type="button">
          <Download className="w-3.5 h-3.5" />
        </button>
        <button className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-[#0B4A3D] transition-colors cursor-pointer" title="View" type="button">
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Tabs
   ============================================================ */

function OverviewTab({ client, counts, timelineEvents, onNavigate, onSwitchTab }) {
  const email = client.email;
  const addressParts = { Street: client.address, City: client.city, State: client.state, Country: client.country, Pincode: client.pincode };

  const relatedRows = [
    { label: 'Follow-ups', count: counts.followups, to: '/followups' },
    { label: 'Purchase Requests', count: counts.prs, to: '/cprs' }
  ].filter((row) => row.count > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
      {/* LEFT COLUMN */}
      <div className="min-w-0">
        <Card icon={Building2} title="General Information">
          <Row label="Business Name" value={client.company || client.name} />
          <RowIf label="Client Code" value={client.clientNo || client.clientCode} />
          <RowIf label="Industry" value={client.industry} />
          <RowIf label="Client Type" value={client.clientType} />
          <RowIf label="GSTIN" value={client.gstin} />
          <RowIf label="PAN" value={client.panNumber} />
          <RowIf label="Website" value={client.website} />
        </Card>

        <Card icon={User} title="Contact Information">
          <RowIf label="Primary Contact" value={client.name} />
          <RowIf label="Designation" value={client.designation} />
          <RowIf label="Phone" value={client.phone} />
          {email ? (
            <Row label="Email" value={<a href={`mailto:${email}`} className="text-[#0B4A3D] no-underline hover:underline">{email}</a>} />
          ) : null}
        </Card>

        <Card icon={MapPin} title="Address">
          {Object.entries(addressParts).filter(([, v]) => v).length === 0 ? (
            <p className="text-xs text-slate-400">No address on file</p>
          ) : (
            Object.entries(addressParts).map(([label, value]) => <RowIf key={label} label={label} value={value} />)
          )}
        </Card>

        {(client.creditLimit || client.paymentTerms || client.currency || client.category) && (
          <Card icon={BarChart3} title="Business Information">
            <RowIf label="Credit Limit" value={client.creditLimit ? formatINR(client.creditLimit) : ''} />
            <RowIf label="Payment Terms" value={client.paymentTerms} />
            <RowIf label="Currency" value={client.currency} />
            <RowIf label="Customer Category" value={client.category} />
          </Card>
        )}

        <Card icon={TrendingUp} title="Sales Information">
          <RowIf label="Assigned Executive" value={client.owner} />
          {client.createdAt ? <Row label="Client Since" value={formatDate(client.createdAt)} /> : null}
          {counts.lastFollowUp ? <Row label="Last Follow-up" value={formatDate(counts.lastFollowUp)} /> : null}
        </Card>

        {client.internalNotes ? (
          <Card icon={StickyNote} title="Remarks">
            <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{client.internalNotes}</p>
          </Card>
        ) : null}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="flex flex-col gap-4 order-first lg:order-none">
        {relatedRows.length > 0 && (
          <Card icon={Link2} title="Related Records">
            {relatedRows.map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={() => onNavigate(row.to)}
                className="w-full flex items-center justify-between text-[13px] py-1.5 px-1.5 rounded hover:bg-emerald-50 transition-colors cursor-pointer group"
              >
                <span className="text-slate-500 font-medium text-xs">{row.label}</span>
                <span className="flex items-center gap-1">
                  <a className="text-[#0B4A3D] font-semibold no-underline group-hover:underline">{row.count}</a>
                  <ChevronRight className="w-3 h-3 text-slate-300" />
                </span>
              </button>
            ))}
          </Card>
        )}

        {client.attachments && client.attachments.length > 0 && (
          <Card icon={Paperclip} title="Attachments">
            {client.attachments.map((doc, i) => <DocItem key={i} doc={doc} />)}
          </Card>
        )}

        <Card icon={Clock} title={`Activity Timeline (${timelineEvents.length} events)`}>
          <div className="max-h-80 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            <Timeline events={timelineEvents.slice(0, 8)} />
          </div>
          {timelineEvents.length > 8 && (
            <div className="text-center py-2">
              <button
                type="button"
                onClick={() => onSwitchTab('timeline')}
                className="text-xs text-[#0B4A3D] bg-transparent hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                View all {timelineEvents.length} events <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ContactsTab({ client }) {
  const contacts = client.linkedContacts || [];
  return (
    <Card icon={User} title="Contacts">
      {contacts.length === 0 ? (
        <EmptyState
          icon={User}
          title="No Contacts Linked"
          sub="Link contacts to this client to manage relationships"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left">
                {['Name', 'Designation', 'Phone', 'Email'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((ct, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{ct.name || '-'}</td>
                  <td className="px-3 py-2.5 text-slate-500">{ct.designation || '-'}</td>
                  <td className="px-3 py-2.5 text-slate-500">{ct.phone || '-'}</td>
                  <td className="px-3 py-2.5 text-slate-500">{ct.email || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FollowupsTab({ followups, onNavigate, clientId }) {
  return (
    <Card icon={Phone} title="Follow-ups">
      {followups.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No Follow-ups Recorded"
          sub="Log a follow-up to track client interactions"
          action={
            <button
              type="button"
              onClick={() => onNavigate(clientId != null ? `/followups/new?leadId=${clientId}` : '/followups/new')}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#136754] to-[#0B4A3D] hover:from-[#17806A] hover:to-[#0F5C4C] px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Log Follow-up
            </button>
          }
        />
      ) : (
        <div className="relative before:content-[''] before:absolute before:left-[15px] before:top-1 before:bottom-1 before:w-[2px] before:bg-slate-200 before:rounded">
          {followups.map((f, i) => (
            <div key={i} className="relative pl-9 pb-4 last:pb-0">
              <span className="absolute left-2 top-1 w-3 h-3 rounded-full border-2 border-amber-500 bg-amber-50" />
              <div className="text-[13px] font-semibold text-slate-900">
                {formatDate(f.followUpDate || f.createdAt)}
                {f.nextFollowUpDate ? (
                  <span className="text-slate-500 text-[11px] font-normal"> Next: {formatDate(f.nextFollowUpDate)}</span>
                ) : null}
              </div>
              {f.remarks ? <div className="text-xs text-slate-500 mt-0.5">{f.remarks}</div> : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DocsTab({ label, docs, createLabel, createRoute, onNavigate }) {
  return (
    <Card icon={FileText} title={label}>
      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No ${label} Found`}
          sub={`Create a ${label.toLowerCase()} for this client`}
          action={
            createRoute ? (
              <button
                type="button"
                onClick={() => onNavigate(createRoute)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#136754] to-[#0B4A3D] hover:from-[#17806A] hover:to-[#0F5C4C] px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create {createLabel || label}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left">
                {['#', 'Number', 'Date', 'Amount', 'Status'].map((h) => (
                  <th key={h} className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50 ${h === 'Amount' ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((d, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{d.number || d.prNo || d.id || '-'}</td>
                  <td className="px-3 py-2.5 text-slate-500">{formatDate(d.date || d.createdAt)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">{formatINR(d.grandTotal || d.total || 0)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusBadgeClasses(d.status)}`}>
                      {d.status || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TimelineTab({ events }) {
  return (
    <Card icon={Clock} title={`Activity Timeline (${events.length} events)`}>
      <Timeline events={events} />
    </Card>
  );
}

function DocumentsTab({ client, onSwitchTab }) {
  const docs = client.attachments || [];
  return (
    <>
      <Card icon={FileText} title={`Uploaded Documents & Attachments (${docs.length} files)`}>
        {docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Documents"
            sub="No uploaded documents. Upload attachments while creating or editing the client."
          />
        ) : (
          docs.map((doc, i) => <DocItem key={i} doc={doc} />)
        )}
      </Card>
      <Card icon={FileText} title="Related Documents" className="mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TABS.filter((t) => ['purchase-requests'].includes(t.id)).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSwitchTab(t.id)}
              className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-[10px] cursor-pointer hover:border-[#0B4A3D] transition-all group"
            >
              <span className="w-9 h-9 rounded-lg bg-emerald-50 text-[#0B4A3D] flex items-center justify-center shrink-0">
                <t.icon className="w-4 h-4" />
              </span>
              <span className="text-[13px] font-medium flex-1 text-left text-slate-700">{t.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#0B4A3D] transition-colors" />
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}

/* ============================================================
   Page
   ============================================================ */

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmState, setConfirmState] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [followups, setFollowups] = useState([]);
  const [cprs, setCprs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await clientService.getClient(id);
        if (cancelled) return;
        setClient(normalizeClient(data?.data ?? data));
      } catch (err) {
        if (cancelled) return;
        toast.error(err?.message || 'Failed to load client');
        navigate('/clients', { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, refreshKey, navigate, toast]);

  /* Related records: follow-ups matched by company/phone/email, CPRs matched by client name */
  useEffect(() => {
    let cancelled = false;
    if (!client) return undefined;
    const company = String(client.company || client.name || '').toLowerCase().trim();

    const loadRelated = async () => {
      const [fuRes, cprRes] = await Promise.allSettled([
        followUpService.listFollowUps({ size: 200 }),
        cprService.listCprs({ size: 200 })
      ]);
      if (cancelled) return;
      const fuList =
        fuRes.status === 'fulfilled'
          ? (fuRes.value?.data?.content ?? fuRes.value?.content ?? (Array.isArray(fuRes.value) ? fuRes.value : []))
          : [];
      const cprList =
        cprRes.status === 'fulfilled'
          ? (cprRes.value?.data?.content ?? cprRes.value?.content ?? (Array.isArray(cprRes.value) ? cprRes.value : []))
          : [];

      const matchedFus = fuList.filter((f) => {
        if (!company) return false;
        return String(f.leadCompany || f.company || '').toLowerCase() === company;
      });
      const matchedCprs = cprList.filter((c) => {
        if (!company) return false;
        return String(c.clientName || '').toLowerCase() === company;
      });
      setFollowups(matchedFus);
      setCprs(matchedCprs);
    };
    loadRelated();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const executeConfirm = useCallback(async () => {
    if (!confirmState) return;
    setConfirmState((prev) => ({ ...prev, loading: true }));
    const { type } = confirmState;
    try {
      if (type === 'archive') {
        await clientService.archiveClient(id);
        toast.success('Client archived successfully');
      }
      if (type === 'restore') {
        await clientService.restoreClient(id);
        toast.success('Client restored successfully');
      }
      setConfirmState(null);
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      toast.error(err?.message || 'Operation failed');
      setConfirmState((prev) => ({ ...prev, loading: false }));
    }
  }, [confirmState, id, toast]);

  const timelineEvents = useMemo(() => {
    if (!client) return [];
    const events = [];
    if (client.createdAt) {
      events.push({
        date: client.createdAt,
        time: formatDateTime(client.createdAt),
        title: `Client Created — ${client.company || client.name}`,
        tag: 'Client',
        type: 'created',
        desc: ''
      });
    }
    followups.forEach((f) => {
      events.push({
        date: f.followUpDate || f.createdAt || '',
        time: formatDateTime(f.followUpDate || f.createdAt),
        title: f.remarks ? (f.remarks.length > 80 ? `${f.remarks.slice(0, 80)}...` : f.remarks) : 'Follow-up',
        tag: 'Follow-up',
        type: 'followup',
        desc: f.remarks || ''
      });
    });
    cprs.forEach((c) => {
      events.push({
        date: c.date || c.createdAt || '',
        time: formatDateTime(c.date || c.createdAt),
        title: `${c.number || c.prNo || c.id || ''} ${c.status ? `(${c.status})` : ''}`,
        tag: 'PR',
        type: 'completed',
        desc: ''
      });
    });
    events.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return events;
  }, [client, followups, cprs]);

  const lastFollowUp = useMemo(() => {
    if (followups.length === 0) return null;
    const sorted = [...followups].sort((a, b) =>
      String(b.followUpDate || b.createdAt || '').localeCompare(String(a.followUpDate || a.createdAt || ''))
    );
    return sorted[0].followUpDate || sorted[0].createdAt || null;
  }, [followups]);

  if (loading) {
    return (
      <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full">
        <PageLoader />
      </div>
    );
  }

  if (!client) return null;

  const counts = {
    followups: followups.length,
    prs: cprs.length,
    lastFollowUp
  };
  const isArchivedOrDeleted = client.status === 'Archived' || client.status === 'Deleted';
  const initial = (client.company || client.name || 'C').charAt(0).toUpperCase();
  const displayName = client.company || client.name;
  const activeTabId = TABS.some((t) => t.id === activeTab) ? activeTab : 'overview';

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 w-full max-w-[100vw] overflow-x-hidden">
      <div className="px-5 sm:px-7 py-5 max-w-[1200px] mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[13px] text-slate-500 mb-1 select-none">
          <button onClick={() => navigate('/dashboard')} className="text-[#0B4A3D] hover:underline font-medium cursor-pointer">VISHAK TECH</button>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <button onClick={() => navigate('/clients')} className="text-[#0B4A3D] hover:underline font-medium cursor-pointer">Clients</button>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-600 font-medium">{displayName} — {TABS.find((t) => t.id === activeTabId)?.label}</span>
        </nav>

        {/* Header card */}
        <div className="bg-white border border-slate-200 rounded-2xl px-5 sm:px-6 py-5 mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-[#136754] via-[#0B4A3D] to-[#003930] text-white flex items-center justify-center text-xl font-bold shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <h1 className="text-[22px] font-bold text-slate-900 m-0 flex items-center gap-2 flex-wrap">
                  {displayName}
                  <span className="text-slate-400 font-medium text-base">({client.id})</span>
                </h1>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md">
                    <Tag className="w-3 h-3 text-[#0B4A3D]" /> {client.clientNo || client.clientCode || `#${client.id}`}
                  </span>
                  <StatusBadge status={client.status} />
                  {client.industry && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md">
                      <Factory className="w-3 h-3 text-[#0B4A3D]" /> {client.industry}
                    </span>
                  )}
                  {client.owner && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md">
                      <User className="w-3 h-3 text-[#0B4A3D]" /> {client.owner}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate('/clients')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-transparent hover:bg-slate-100 hover:text-[#0B4A3D] px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={() => navigate(`/clients/${id}/edit`)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-surface border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              {isArchivedOrDeleted ? (
                <button
                  onClick={() => setConfirmState({ type: 'restore' })}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B4A3D] bg-[#EDF7F4] hover:bg-[#dcefeb] px-3 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                </button>
              ) : (
                <button
                  onClick={() => setConfirmState({ type: 'archive' })}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 border-b-2 border-slate-200 mt-3.5 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-[2px] transition-colors cursor-pointer ${
                  activeTabId === tab.id
                    ? 'text-[#0B4A3D] border-[#0B4A3D] font-semibold'
                    : 'text-slate-500 border-transparent hover:text-[#0B4A3D]'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pane */}
        <div key={activeTabId}>
          {activeTabId === 'overview' && (
            <OverviewTab client={client} counts={counts} timelineEvents={timelineEvents} onNavigate={navigate} onSwitchTab={setActiveTab} />
          )}
          {activeTabId === 'contacts' && <ContactsTab client={client} />}
          {activeTabId === 'followups' && <FollowupsTab followups={followups} onNavigate={navigate} clientId={client.id} />}
          {activeTabId === 'purchase-requests' && (
            <DocsTab label="Purchase Requests" docs={cprs} createLabel="PR" createRoute="/cprs/new" onNavigate={navigate} />
          )}
          {activeTabId === 'timeline' && <TimelineTab events={timelineEvents} />}
          {activeTabId === 'documents' && <DocumentsTab client={client} onSwitchTab={setActiveTab} />}
        </div>
      </div>

      {confirmState && (
        <ConfirmDialog
          open={confirmState !== null}
          title={confirmState.type === 'archive' ? 'Archive Client' : 'Restore Client'}
          message={
            confirmState.type === 'archive'
              ? `Archive "${displayName}"? Archived clients can be restored anytime.`
              : `Restore "${displayName}" to active clients?`
          }
          confirmLabel={confirmState.type === 'archive' ? 'Archive' : 'Restore'}
          variant={confirmState.type === 'archive' ? 'warning' : 'default'}
          icon={confirmState.type === 'archive' ? Archive : RotateCcw}
          loading={confirmState.loading || false}
          onConfirm={executeConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
