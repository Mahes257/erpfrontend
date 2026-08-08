import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, Pencil, CalendarClock, FileText, Trash2, Loader2,
  History as HistoryIcon, StickyNote, Paperclip, LayoutGrid,
  Building2, User, Tag, Calendar, IndianRupee, Clock, AlertTriangle,
  PlusCircle, Trophy, XCircle, UserCheck, CloudUpload, File, ArrowRight,
  Info as InfoIcon, AlignLeft as AlignLeftIcon, BarChart3 as BarChartIcon,
  ClipboardList as ClipboardListIcon
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog, useToast } from '../components/Common';
import { Timeline, Notes, Attachments, History as HistoryTab, FollowUps } from '../components/LeadDetail';
import { STAGE_BADGES, STAGE_BADGE_FALLBACK } from '../utils/leadConstants';
import {
  formatINR, formatDate, formatDateTime, getInitials
} from '../utils/leadHelpers';
import leadService from '../services/leadService';

const STAGE_BADGE = {
  New: 'bg-slate-100 text-slate-600',
  Contacted: 'bg-blue-50 text-blue-700',
  Qualified: 'bg-emerald-50 text-emerald-700',
  Proposal: 'bg-amber-50 text-amber-700',
  'Proposal Sent': 'bg-amber-50 text-amber-700',
  Negotiation: 'bg-purple-50 text-purple-700',
  Won: 'bg-emerald-50 text-emerald-700',
  Lost: 'bg-rose-50 text-rose-700',
  High: 'bg-red-50 text-red-700',
  Medium: 'bg-amber-50 text-amber-700',
  Low: 'bg-slate-100 text-slate-600',
  default: 'bg-slate-100 text-slate-600'
};

const STATUS_BADGE = {
  Active: 'bg-emerald-50 text-emerald-700',
  Inactive: 'bg-amber-50 text-amber-700',
  Archived: 'bg-slate-100 text-slate-600',
  Deleted: 'bg-rose-50 text-rose-700',
  Converted: 'bg-indigo-50 text-indigo-700',
  default: 'bg-[#EDF7F4] text-[#0B4A3D]'
};

const PRIORITY_BADGE = {
  low: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-rose-50 text-rose-700',
  urgent: 'bg-purple-50 text-purple-700',
  critical: 'bg-red-100 text-red-800',
  default: 'bg-slate-100 text-slate-600'
};

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'timeline', label: 'Timeline', icon: HistoryIcon },
  { key: 'followups', label: 'Follow-ups', icon: CalendarClock },
  { key: 'documents', label: 'Documents', icon: Paperclip },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'history', label: 'History', icon: HistoryIcon }
];

function LoBadge({ className = '', children }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

function MetaChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 rounded-md px-2 py-0.5 text-[12px]">
      {Icon && <Icon className="w-3 h-3 text-[#0B4A3D]" />}
      {children}
    </span>
  );
}

function LoCard({ icon: Icon, title, count, children, className = '' }) {
  return (
    <div className={`bg-surface border border-slate-200 rounded-xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${className}`}>
      <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-[#0B4A3D] uppercase tracking-wide mb-3">
        {Icon && <Icon className="w-4 h-4" />}
        <span>{title}</span>
        {count !== undefined && (
          <span className="text-[11px] font-medium text-slate-400 normal-case tracking-normal ml-1">({count})</span>
        )}
      </h3>
      {children}
    </div>
  );
}

function LoRow({ label, last = false, children }) {
  return (
    <div className={`flex py-1.5 text-[13px] ${last ? '' : 'border-b border-slate-100'}`}>
      <span className="w-[130px] shrink-0 text-[12px] font-medium text-slate-500">{label}</span>
      <span className="text-slate-700 font-medium flex-1 min-w-0 break-words">{children}</span>
    </div>
  );
}

function LinkValue({ href, external = false, children }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="text-[#0B4A3D] font-medium hover:underline break-all"
    >
      {children || '—'}
    </a>
  );
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div className="text-center py-8 text-slate-400 text-[13px]">
      {Icon && <Icon className="w-8 h-8 mx-auto mb-2 text-slate-300" />}
      <p className="font-semibold text-slate-500">{title}</p>
      {sub && <p className="text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function leadNotesText(lead) {
  if (Array.isArray(lead?.notes)) {
    const text = lead.notes
      .map((note) => (typeof note === 'string' ? note : note?.text || ''))
      .filter(Boolean)
      .join('\n\n');
    if (text) return text;
  }
  return typeof lead?.notes === 'string' ? lead.notes : lead?.description || '';
}

function buildActivityLog(lead) {
  const items = [];
  const created = lead?.createdAt || lead?.date;
  const updated = lead?.updatedAt;
  if (created) items.push({ date: created, text: 'Lead Created', icon: PlusCircle });
  if (updated && updated !== created) items.push({ date: updated, text: 'Lead Updated', icon: Pencil });
  if (lead?.stage === 'Won') items.push({ date: updated || created, text: 'Stage changed to Won', icon: Trophy });
  if (lead?.stage === 'Lost') items.push({ date: updated || created, text: 'Stage changed to Lost', icon: XCircle });
  if (lead?.owner) items.push({ date: created || updated, text: `Assigned to ${lead.owner}`, icon: UserCheck });
  items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return items;
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [convertOpen, setConvertOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [users, setUsers] = useState([]);
  const [related, setRelated] = useState({ attachments: [], timeline: [], followUps: 0 });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await leadService.getLead(id);
        if (cancelled) return;
        setLead(data?.data ?? data);
      } catch (err) {
        if (cancelled) return;
        toast.error(err?.message || 'Failed to load lead');
        navigate('/leads', { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, navigate, toast]);

  useEffect(() => {
    let cancelled = false;
    leadService
      .getUsers()
      .then((data) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        if (!cancelled) setUsers(list.map((u) => u.fullName || u.email).filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!lead?.id) return;
    let cancelled = false;

    const toList = (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.content) ? res.content : []);
    const mapAttachment = (item) => ({
      id: item.id,
      name: item.name || item.fileName || item.originalName || 'Unnamed file',
      size: item.size || item.fileSize || 0,
      type: item.type || item.mimeType || '',
      url: item.url || item.downloadUrl || item.path || '',
      date: item.at || item.date || item.createdAt || item.uploadedAt
    });
    const mapTimeline = (item) => ({
      id: item.id,
      date: item.at || item.date || item.createdAt,
      title: item.title || 'Event',
      description: item.description || item.detail || '',
      type: item.type || 'default'
    });

    Promise.allSettled([
      leadService.getAttachments(lead.id),
      leadService.getTimeline(lead.id),
      leadService.getLeadFollowUps(lead.id)
    ]).then(([attachments, timeline, followUps]) => {
      if (cancelled) return;
      const attItems = toList(attachments?.value ?? []).map(mapAttachment);
      const tlItems = toList(timeline?.value ?? []).map(mapTimeline);
      const fuItems = toList(followUps?.value ?? []);
      setRelated({
        attachments: attItems,
        timeline: tlItems,
        followUps: fuItems.length
      });
    });

    return () => {
      cancelled = true;
    };
  }, [lead?.id]);

  const leadNumber = lead?.leadNo || (lead?.id != null ? `#${String(lead.id).padStart(4, '0')}` : '');
  const stageClass = STAGE_BADGE[lead?.stage] || STAGE_BADGES[lead?.stage] || STAGE_BADGE_FALLBACK;
  const statusClass = STATUS_BADGE[lead?.status] || STATUS_BADGE.default;
  const priorityClass = PRIORITY_BADGE[(lead?.priority || '').toLowerCase()] || PRIORITY_BADGE.default;

  const handleDelete = async () => {
    setBusy('delete');
    try {
      await leadService.deleteLead(lead.id);
      toast.success('Lead moved to Deleted');
      navigate('/leads');
    } catch (err) {
      toast.error(err?.message || 'Failed to delete lead');
    } finally {
      setBusy('');
    }
  };

  const handleConvert = async () => {
    setBusy('convert');
    try {
      const result = await leadService.convertToCpr(lead.id);
      toast.success(`Converted to ${result.data?.prNo || 'CPR'}`);
      navigate(`/cprs/${result.data?.id}`, { replace: false });
    } catch (err) {
      toast.error(err?.message || 'Conversion failed');
    } finally {
      setBusy('');
    }
  };

  const activityLog = useMemo(() => buildActivityLog(lead), [lead]);
  const timelineEvents = useMemo(
    () =>
      related.timeline
        .filter((item) => item.date)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [related.timeline]
  );
  const notesText = useMemo(() => leadNotesText(lead), [lead]);

  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
      <div className="space-y-4 min-w-0 order-last lg:order-first">
        {/* Lead Information */}
        <LoCard icon={InfoIcon} title="Lead Information">
          <LoRow label="Lead Number"><strong>{leadNumber || '—'}</strong></LoRow>
          <LoRow label="Lead Name">{lead?.name || '—'}</LoRow>
          <LoRow label="Company / Business">{lead?.company || '—'}</LoRow>
          <LoRow label="Industry">{lead?.industry || '—'}</LoRow>
          <LoRow label="Lead Source">{lead?.source || '—'}</LoRow>
          <LoRow label="Stage">
            <LoBadge className={stageClass}>{lead?.stage || 'New'}</LoBadge>
          </LoRow>
          <LoRow label="Priority">
            <LoBadge className={priorityClass}>
              {lead?.priority ? lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1) : 'Medium'}
            </LoBadge>
          </LoRow>
          <LoRow label="Lead Owner">{lead?.owner || 'Unassigned'}</LoRow>
          <LoRow label="Expected Value">
            {lead?.value ? formatINR(lead.value) : '—'}
          </LoRow>
          <LoRow label="Expected Close">{lead?.expectedCloseDate ? formatDate(lead.expectedCloseDate) : '—'}</LoRow>
          <LoRow label="Created Date">{formatDate(lead?.createdAt || lead?.date) || '—'}</LoRow>
          <LoRow label="Last Updated" last>{lead?.updatedAt ? formatDate(lead.updatedAt) : '—'}</LoRow>
        </LoCard>

        {/* Contact & Address */}
        <LoCard icon={User} title="Contact & Address">
          <LoRow label="Contact Person">{lead?.name || '—'}</LoRow>
          <LoRow label="Designation">{lead?.title || '—'}</LoRow>
          <LoRow label="Phone">{lead?.phone || '—'}</LoRow>
          <LoRow label="Email">
            {lead?.email ? <LinkValue href={`mailto:${lead.email}`}>{lead.email}</LinkValue> : '—'}
          </LoRow>
          {lead?.secondaryName ? <LoRow label="Secondary Contact">{lead.secondaryName}</LoRow> : null}
          {lead?.secondaryDesignation ? <LoRow label="Secondary Designation">{lead.secondaryDesignation}</LoRow> : null}
          {lead?.secondaryPhone ? <LoRow label="Secondary Phone">{lead.secondaryPhone}</LoRow> : null}
          {lead?.secondaryEmail ? (
            <LoRow label="Secondary Email">
              <LinkValue href={`mailto:${lead.secondaryEmail}`}>{lead.secondaryEmail}</LinkValue>
            </LoRow>
          ) : null}
          {lead?.website ? (
            <LoRow label="Website">
              <LinkValue href={lead.website} external>
                {lead.website} <span className="text-[10px] align-middle">↗</span>
              </LinkValue>
            </LoRow>
          ) : null}
          <LoRow label="Address">{lead?.address || '—'}</LoRow>
          {lead?.city ? <LoRow label="City">{lead.city}</LoRow> : null}
          {lead?.state ? <LoRow label="State">{lead.state}</LoRow> : null}
          {lead?.country ? <LoRow label="Country">{lead.country}</LoRow> : null}
          <LoRow label="PIN Code" last>{lead?.pincode || '—'}</LoRow>
        </LoCard>

        {/* Business Details */}
        <LoCard icon={Building2} title="Business Details">
          <LoRow label="Business Type">{lead?.businessType || '—'}</LoRow>
          <LoRow label="Tax ID / GST">{lead?.taxId || '—'}</LoRow>
          <LoRow label="Business Name" last>{lead?.businessName || lead?.company || '—'}</LoRow>
        </LoCard>

        {/* Description & Requirements */}
        {(notesText || lead?.internalNotes) && (
          <LoCard icon={AlignLeftIcon} title="Description & Requirements">
            {notesText ? (
              <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap py-1">{notesText}</p>
            ) : (
              <EmptyState icon={FileText} title="No Description" />
            )}
            {lead?.internalNotes && (
              <>
                <hr className="border-slate-100 my-2" />
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Internal Notes
                </span>
                <p className="text-[13px] text-slate-600 italic leading-relaxed whitespace-pre-wrap py-1">
                  {lead.internalNotes}
                </p>
              </>
            )}
          </LoCard>
        )}
      </div>

      <div className="space-y-4 order-first lg:order-none">
        {/* Lead Summary */}
        <LoCard icon={BarChartIcon} title="Lead Summary">
          <LoRow label="Lead ID"><strong>{leadNumber || '—'}</strong></LoRow>
          <LoRow label="Company">{lead?.company || '—'}</LoRow>
          <LoRow label="Contact">{lead?.name || '—'}</LoRow>
          <LoRow label="Phone">{lead?.phone || '—'}</LoRow>
          <LoRow label="Email">{lead?.email || '—'}</LoRow>
          <LoRow label="Stage">
            <LoBadge className={stageClass}>{lead?.stage || 'New'}</LoBadge>
          </LoRow>
          <LoRow label="Expected Value">{lead?.value ? formatINR(lead.value) : '—'}</LoRow>
          <LoRow label="Total Follow-ups" last>{related.followUps}</LoRow>
        </LoCard>

        {/* Attachments */}
        <LoCard icon={Paperclip} title="Attachments" count={related.attachments.length}>
          {related.attachments.length === 0 ? (
            <EmptyState icon={CloudUpload} title="No Attachments" sub="No attachments uploaded." />
          ) : (
            <ul className="space-y-2">
              {related.attachments.slice(0, 5).map((file) => (
                <li key={file.id} className="flex items-center gap-2.5">
                  <File className="w-3.5 h-3.5 text-[#0B4A3D] shrink-0" />
                  <span className="flex-1 min-w-0 text-[13px] text-slate-700 truncate">{file.name}</span>
                  {file.size ? <span className="text-[11px] text-slate-400 whitespace-nowrap">{formatBytes(file.size)}</span> : null}
                </li>
              ))}
            </ul>
          )}
          {related.attachments.length > 5 && (
            <button
              onClick={() => setActiveTab('documents')}
              className="mt-2 text-center text-[12px] font-semibold text-[#0B4A3D] hover:underline cursor-pointer"
            >
              View all {related.attachments.length} files <ArrowRight className="w-3 h-3 inline" />
            </button>
          )}
        </LoCard>

        {/* Timeline Widget */}
        <LoCard icon={HistoryIcon} title="Timeline" count={timelineEvents.length}>
          {timelineEvents.length === 0 ? (
            <EmptyState icon={Clock} title="No Timeline Events" />
          ) : (
            <div className="max-h-80 overflow-y-auto pr-1">
              {timelineEvents.slice(0, 6).map((event) => (
                <div key={event.id} className="relative pl-6 pb-3.5">
                  <span className="absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-[#0B4A3D] bg-white" />
                  <p className="text-[13px] font-semibold text-slate-800">{event.title}</p>
                  {event.description && (
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      {event.description.length > 80 ? `${event.description.slice(0, 80)}...` : event.description}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(event.date)}</p>
                </div>
              ))}
              {timelineEvents.length > 6 && (
                <div className="text-center py-2">
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className="text-[12px] font-semibold text-[#0B4A3D] hover:underline cursor-pointer"
                  >
                    View all {timelineEvents.length} events <ArrowRight className="w-3 h-3 inline" />
                  </button>
                </div>
              )}
            </div>
          )}
        </LoCard>

        {/* Activity Log */}
        <LoCard icon={ClipboardListIcon} title="Activity Log">
          {activityLog.length === 0 ? (
            <EmptyState icon={ClipboardListIcon} title="No Activity" />
          ) : (
            <div>
              {activityLog.slice(0, 4).map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={`${activity.text}-${index}`} className="flex gap-2.5 py-2 border-b border-slate-100 last:border-0">
                    <span className="w-7 h-7 rounded-full bg-[#EDF7F4] text-[#0B4A3D] flex items-center justify-center shrink-0">
                      <Icon className="w-3 h-3" />
                    </span>
                    <div className="flex-1">
                      <p className="text-[13px] text-slate-700">{activity.text}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(activity.date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </LoCard>
      </div>
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'timeline':
        return (
          <LoCard icon={HistoryIcon} title="Full Timeline" count={timelineEvents.length}>
            <Timeline key={`${lead.id}-timeline`} leadId={lead.id} />
          </LoCard>
        );
      case 'followups':
        return (
          <LoCard icon={CalendarClock} title="Follow-ups" count={related.followUps}>
            <FollowUps
              key={`${lead.id}-followups`}
              leadId={lead.id}
              leadName={lead.name}
              defaultOwner={lead.owner}
              assignedUsers={Array.from(new Set([...users, lead?.owner].filter(Boolean))).sort()}
            />
          </LoCard>
        );
      case 'documents':
        return (
          <LoCard icon={Paperclip} title="Uploaded Documents & Attachments" count={related.attachments.length}>
            <Attachments key={`${lead.id}-attachments`} leadId={lead.id} />
          </LoCard>
        );
      case 'notes':
        return (
          <LoCard icon={StickyNote} title="Notes & Requirements">
            <Notes key={`${lead.id}-notes`} leadId={lead.id} />
          </LoCard>
        );
      case 'history':
        return (
          <LoCard icon={HistoryIcon} title="Lead History">
            <HistoryTab key={`${lead.id}-history`} leadId={lead.id} />
          </LoCard>
        );
      default:
        return renderOverview();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
        <div className="max-w-[1200px] mx-auto">
          <div className="h-4 w-56 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-[52px] h-[52px] rounded-xl bg-slate-200 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-2 justify-center py-6 text-xs font-semibold text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading lead details...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex-1 bg-app font-sans antialiased p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
        <div className="max-w-[1200px] mx-auto bg-surface border border-slate-200 rounded-xl shadow-sm p-16 flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-300" />
          <span className="text-sm font-bold text-slate-700">Lead not found</span>
          <button
            onClick={() => navigate('/leads')}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Leads
          </button>
        </div>
      </div>
    );
  }

  const tabCounts = {
    timeline: timelineEvents.length,
    followups: related.followUps,
    documents: related.attachments.length
  };

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
          <span>VISHAK TECH</span>
          <span>&gt;</span>
          <span>CRM</span>
          <span>&gt;</span>
          <button onClick={() => navigate('/leads')} className="hover:text-slate-600 transition-colors cursor-pointer">
            Leads
          </button>
          <span>&gt;</span>
          <span className="text-slate-600 truncate max-w-[220px]">Lead Overview · {lead.name}</span>
        </div>

        {/* Header */}
        <div className="bg-surface border border-slate-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-5 mb-3.5">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-[52px] h-[52px] rounded-xl flex items-center justify-center font-bold text-[20px] text-white bg-gradient-to-br from-[#136754] via-[#0B4A3D] to-[#003930] shrink-0">
                {getInitials(lead.name)}
              </div>
              <div className="min-w-0">
                <h1 className="text-[22px] font-bold text-slate-900 tracking-tight truncate">
                  {lead.name} <span className="font-semibold text-slate-400 text-[16px]">({leadNumber})</span>
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <MetaChip icon={Tag}>{leadNumber}</MetaChip>
                  <LoBadge className={statusClass}>{lead.status || 'Active'}</LoBadge>
                  <LoBadge className={stageClass}>{lead.stage || 'New'}</LoBadge>
                  <MetaChip icon={Calendar}>{formatDate(lead.createdAt || lead.date)}</MetaChip>
                  <MetaChip icon={User}>{lead.owner || 'Unassigned'}</MetaChip>
                  {lead?.value ? (
                    <MetaChip icon={IndianRupee}>{formatINR(lead.value)}</MetaChip>
                  ) : null}
                  {lead?.priority ? (
                    <LoBadge className={priorityClass}>
                      {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}
                    </LoBadge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/leads')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer select-none"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-slate-400" /> Back
              </button>
              <button
                onClick={() => navigate(`/leads/${lead.id}/edit`)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer select-none"
              >
                <Pencil className="w-3.5 h-3.5 text-slate-400" /> Edit
              </button>
              <button
                onClick={() => navigate(`/followups/new?leadId=${lead.id}`)}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-3 py-2 rounded-lg transition-colors cursor-pointer select-none"
              >
                <CalendarClock className="w-3.5 h-3.5" /> Follow-up
              </button>
              <button
                onClick={() => setConvertOpen(true)}
                disabled={busy === 'convert'}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] px-3 py-2 rounded-lg transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === 'convert' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                Convert to CPR
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                disabled={busy === 'delete'}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.key === activeTab;
            const count = tabCounts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] whitespace-nowrap border-b-2 -mb-[2px] transition-colors cursor-pointer ${
                  active
                    ? 'text-[#0B4A3D] border-[#0B4A3D] font-semibold'
                    : 'text-slate-500 border-transparent hover:text-[#0B4A3D]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {count !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      active ? 'bg-[#EDF7F4] text-[#0B4A3D]' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="py-4 pb-2">
          {renderTab()}
        </div>

        {convertOpen && (
          <ConfirmDialog
            open={convertOpen}
            title="Convert to CPR"
            message={`Convert "${lead.name}" (${leadNumber}) to a CPR record? All lead information will be transferred to the CPR module and cannot be converted again.`}
            confirmLabel="Convert to CPR"
            variant="default"
            icon={FileText}
            loading={busy === 'convert'}
            onConfirm={handleConvert}
            onCancel={() => setConvertOpen(false)}
          />
        )}

        {deleteOpen && (
          <ConfirmDialog
            open={deleteOpen}
            title="Delete Lead"
            message={`Move "${lead.name}" (${leadNumber}) to Deleted? The lead can be restored anytime.`}
            confirmLabel="Delete"
            variant="danger"
            icon={Trash2}
            loading={busy === 'delete'}
            onConfirm={handleDelete}
            onCancel={() => setDeleteOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
