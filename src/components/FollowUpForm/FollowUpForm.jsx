import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import {
  User, FastForward, Info, Paperclip, ChevronDown, Loader2, Search, X,
  Phone, TrendingUp, MessageSquare, Upload, Trash2, FileText, FileSpreadsheet,
  File as FileIcon, FileImage, Pencil, Plus, Save, CalendarClock, ClipboardList, History
} from 'lucide-react';
import { TextInput, SelectInput, TextArea, SearchableSelect, useToast } from '../Common';
import followUpService from '../../services/followUpService';
import leadService from '../../services/leadService';
import userService from '../../services/userService';
import useDebounce from '../../hooks/useDebounce';
import useClickOutside from '../../hooks/useClickOutside';
import useFloatingMenu from '../../hooks/useFloatingMenu';
import {
  normalizeMode, normalizePriority, formatINR, formatBytes, getInitials, avatarColor, attachmentType
} from '../../utils/followUpHelpers';
import {
  FOLLOWUP_MODES, FOLLOWUP_PRIORITIES, FOLLOWUP_STATUSES
} from '../../utils/followUpConstants';

/* ============================================================
   OLD.zip followup-create.html — replicated layout
   Cards are collapsed by default except the FIRST card
   (Lead Information); clicking a header toggles only that card.
   ============================================================ */

const OUTCOMES = [
  'Interested', 'Not Interested', 'Follow-up Required', 'Quotation Sent',
  'Negotiation', 'Won', 'Lost', 'No Response', 'Callback Requested'
];

const REMINDERS = [
  'No Reminder', '15 Minutes Before', '30 Minutes Before', '1 Hour Before',
  'Same Day', '1 Day Before', '2 Days Before', '1 Week Before'
];

const REMINDER_TYPES = ['Email', 'SMS', 'WhatsApp', 'Push Notification', 'Phone Call'];

const DEFAULT_VALUES = {
  followUpDate: '',
  followUpTime: '10:00',
  mode: 'Call',
  priority: 'Medium',
  status: 'Pending',
  outcome: '',
  remarks: '',
  feedback: '',
  requirement: '',
  nextFollowUpDate: '',
  assignedUser: '',
  reminder: '',
  reminderType: 'Email'
};

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const INPUT_CLASS =
  'w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-700 bg-surface outline-none placeholder:text-slate-400 transition-all focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)]';
const READONLY_CLASS =
  'w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-500 bg-slate-50 outline-none cursor-not-allowed';

/* ---- OLD-style form primitives ---- */

function FormRow({ children, full = false }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5 last:mb-0 ${full ? 'sm:col-span-2' : ''}`}>
      {children}
    </div>
  );
}

function Field({ label, required = false, error, children, full = false, className = '' }) {
  return (
    <div className={`${full ? 'sm:col-span-2' : ''} ${className}`}>
      <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] font-semibold text-red-500">{error}</p>}
    </div>
  );
}

/* OLD accordion: clicking a header toggles only that section (independent state) */
function FormCard({ icon: Icon, title, open, onToggle, children, compact = false }) {
  return (
    <div className="bg-surface border border-slate-200 rounded-xl transition-colors duration-150 hover:border-slate-300">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 border-b transition-colors cursor-pointer select-none text-left hover:bg-slate-50 ${
          open ? 'border-slate-100' : 'border-transparent'
        }`}
      >
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#0B4A3D]" />
          {title}
        </h3>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className={compact ? 'p-4' : 'p-5'}>{children}</div>}
    </div>
  );
}

function Section({ icon, title, defaultOpen, compact = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <FormCard icon={icon} title={title} open={open} onToggle={() => setOpen((v) => !v)} compact={compact}>
      {children}
    </FormCard>
  );
}

function parsePageList(response) {
  const list = Array.isArray(response) ? response : response?.content ?? response?.data ?? response?.list ?? [];
  return list;
}

function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}-${Math.random()}`;
}

function attachmentIcon(name) {
  const type = attachmentType(name);
  if (type === 'image') return FileImage;
  if (type === 'sheet') return FileSpreadsheet;
  return FileText;
}

function timeAgo(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Math.floor((Date.now() - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function formatShortDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return value;
  }
}

function normalizeLeadField(lead) {
  return {
    id: lead?.id,
    leadNo: lead?.leadNo || '',
    name: lead?.name || lead?.leadName || '',
    company: lead?.company || lead?.companyName || '',
    designation: lead?.title || lead?.designation || '',
    phone: lead?.phone || lead?.mobile || '',
    email: lead?.email || '',
    stage: lead?.stage || lead?.pipelineStage || '',
    status: lead?.status || lead?.leadStatus || '',
    source: lead?.source || lead?.leadSource || '',
    owner: lead?.owner || lead?.assignedTo || lead?.executive || '',
    industry: lead?.industry || '',
    address: lead?.address || '',
    city: lead?.city || '',
    state: lead?.state || '',
    pincode: lead?.pincode || '',
    country: lead?.country || '',
    value: lead?.value !== undefined && lead?.value !== null ? Number(lead.value) : 0,
    website: lead?.website || '',
    createdAt: lead?.createdAt || ''
  };
}

export default function FollowUpForm({ initialData, followUpId, preselectedLeadId }) {
  const navigate = useNavigate();
  const toast = useToast();

  const isEdit = Boolean(followUpId);
  const [formState] = useState(() => {
    const base = { ...DEFAULT_VALUES, ...(initialData || {}) };
    return {
      followUpDate: base.followUpDate || (isEdit ? '' : new Date().toISOString().split('T')[0]),
      followUpTime: base.followUpTime || '10:00',
      mode: normalizeMode(base.mode),
      priority: normalizePriority(base.priority),
      status: base.status || 'Pending',
      outcome: base.outcome || '',
      remarks: base.remarks || base.discussion || '',
      feedback: base.feedback || '',
      requirement: base.requirement || '',
      nextFollowUpDate: base.nextFollowUpDate || '',
      assignedUser: base.assignedUser || '',
      reminder: base.reminder || '',
      reminderType: base.reminderType || 'Email'
    };
  });

  const {
    register,
    getValues,
    trigger,
    reset,
    control,
    formState: { errors }
  } = useForm({ defaultValues: formState });

  const [selectedLead, setSelectedLead] = useState(() => {
    const raw = initialData?.lead || null;
    if (raw) return normalizeLeadField(raw);
    if (initialData?.leadId && (initialData?.leadName || initialData?.leadCompany)) {
      return {
        id: initialData.leadId,
        leadNo: initialData.leadNo || '',
        name: initialData.leadName || '',
        company: initialData.leadCompany || '',
        designation: initialData.leadDesignation || '',
        phone: initialData.leadPhone || '',
        email: initialData.leadEmail || '',
        stage: initialData.leadStage || '',
        status: initialData.leadStatus || initialData.leadStage || '',
        owner: initialData.leadOwner || '',
        industry: initialData.leadIndustry || '',
        address: initialData.leadAddress || '',
        city: initialData.leadCity || '',
        value: initialData.leadValue ?? 0,
        createdAt: initialData.leadCreatedAt || ''
      };
    }
    return null;
  });
  const [contactPerson, setContactPerson] = useState(() => {
    if (initialData?.lead) return initialData.lead.contactPerson || initialData.lead.name || '';
    return initialData?.leadContactPerson || initialData?.leadName || '';
  });
  const [leadError, setLeadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [leadLoading, setLeadLoading] = useState(Boolean(preselectedLeadId));
  const [leadFocused, setLeadFocused] = useState(false);
  const [users, setUsers] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState(() => initialData?.attachments ?? []);
  const [leadFollowUps, setLeadFollowUps] = useState([]);
  const [leadFollowUpsLoading, setLeadFollowUpsLoading] = useState(false);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  const debouncedLeadSearch = useDebounce(leadSearch, 400);
  const showLeadResults = leadFocused && !selectedLead && Boolean(leadSearch || leadResults.length > 0);
  const { triggerRef: leadMenuTriggerRef, menuRef: leadMenuRef } = useFloatingMenu({
    open: showLeadResults,
    align: 'left',
    matchWidth: true
  });
  useClickOutside([dropdownRef, leadMenuRef], () => setLeadFocused(false), showLeadResults);

  useEffect(() => {
    let cancelled = false;
    followUpService
      .getUsers()
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? data?.users ?? [];
        if (cancelled) return;
        const names = list.map((user) => user?.name ?? user?.email).filter(Boolean);
        setUsers(Array.from(new Set(names)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!debouncedLeadSearch || selectedLead) return;
    let cancelled = false;
    followUpService
      .searchLeads({ page: 0, size: 8, search: debouncedLeadSearch })
      .then((data) => {
        if (cancelled) return;
        setLeadResults(parsePageList(data));
      })
      .catch(() => {
        if (!cancelled) setLeadResults([]);
      })
      .finally(() => {
        if (!cancelled) setLeadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedLeadSearch, selectedLead]);

  /* Load the selected lead's previous follow-ups for the sidebar timeline */
  useEffect(() => {
    if (!selectedLead?.id) return;
    let cancelled = false;

    const load = async () => {
      setLeadFollowUpsLoading(true);
      try {
        const data = await leadService.getLeadFollowUps(selectedLead.id);
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setLeadFollowUps(list);
      } catch {
        if (!cancelled) setLeadFollowUps([]);
      } finally {
        if (!cancelled) setLeadFollowUpsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedLead?.id]);

  const selectLead = useCallback((lead) => {
    setSelectedLead(lead);
    setContactPerson(lead.contactPerson || lead.name || '');
    setLeadSearch('');
    setLeadResults([]);
    setLeadFocused(false);
    setLeadError('');
  }, []);

  const clearLead = useCallback(() => {
    setSelectedLead(null);
    setLeadSearch('');
    setLeadResults([]);
  }, []);

  useEffect(() => {
    if (!preselectedLeadId || selectedLead) return;
    let cancelled = false;
    followUpService
      .getLead(preselectedLeadId)
      .then((data) => {
        if (cancelled) return;
        selectLead(normalizeLeadField(data?.data ?? data));
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load the selected lead. Please choose a lead manually.');
      })
      .finally(() => {
        if (!cancelled) setLeadLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedLeadId]);

  const handleFiles = useCallback(
    (fileList) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      const accepted = [];
      files.forEach((file) => {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          toast.error(`"${file.name}" is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()}`);
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`"${file.name}" exceeds the 10MB limit`);
          return;
        }
        accepted.push({ key: makeId(), file });
      });
      if (accepted.length > 0) {
        setPendingFiles((prev) => [...prev, ...accepted]);
      }
    },
    [toast]
  );

  const removePendingFile = useCallback((key) => {
    setPendingFiles((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const removeExistingAttachment = useCallback(
    async (attachment) => {
      if (!followUpId) return;
      try {
        await followUpService.deleteFollowUpAttachment(followUpId, attachment.id);
        setExistingAttachments((prev) => prev.filter((item) => item.id !== attachment.id));
        toast.success('Attachment removed');
      } catch (err) {
        toast.error(err?.message || 'Failed to remove attachment');
      }
    },
    [followUpId, toast]
  );

  const openFilePicker = () => fileInputRef.current?.click();

  const buildPayload = (status) => {
    const values = getValues();
    return {
      leadId: selectedLead.id,
      followUpDate: values.followUpDate,
      followUpTime: values.followUpTime || null,
      mode: values.mode,
      priority: values.priority,
      status: status || values.status,
      outcome: values.outcome || null,
      remarks: values.remarks || null,
      discussion: values.remarks || null,
      feedback: values.feedback || null,
      requirement: values.requirement || null,
      nextFollowUpDate: values.nextFollowUpDate || null,
      assignedUser: values.assignedUser || null,
      reminder: values.reminder || null,
      reminderType: values.reminderType || null
    };
  };

  const uploadPendingFiles = async (id) => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    try {
      for (const item of pendingFiles) {
        await followUpService.uploadFollowUpAttachment(id, item.file);
      }
    } finally {
      setUploading(false);
    }
  };

  const onSave = async (behavior, forcedStatus) => {
    if (saving) return;
    if (!selectedLead) {
      setLeadError('Please select a lead');
      toast.error('Please select a lead');
      return;
    }
    const fields = ['followUpDate', 'mode'];
    if (forcedStatus !== 'Draft') fields.push('remarks');
    const valid = await trigger(fields);
    if (!valid) {
      toast.error('Please fill in the required fields');
      return;
    }

    setSaving(true);
    const payload = buildPayload(forcedStatus);
    try {
      let id = followUpId;
      if (isEdit) {
        await followUpService.updateFollowUp(followUpId, payload);
      } else {
        const response = await followUpService.createFollowUp(payload);
        id = response?.data?.id ?? response?.id;
      }
      await uploadPendingFiles(id);
      toast.success(isEdit ? 'Follow-up updated successfully' : 'Follow-up saved successfully');

      if (behavior === 'new' && !isEdit) {
        reset(formState);
        clearLead();
        setPendingFiles([]);
        setLeadError('');
        setSaving(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      navigate('/followups');
    } catch (err) {
      toast.error(err?.message || 'Failed to save follow-up');
      setSaving(false);
    }
  };

  const leadAutoRows = selectedLead
    ? {
        company: selectedLead.company || selectedLead.name || '',
        phone: selectedLead.phone || '',
        email: selectedLead.email || '',
        status: selectedLead.status || selectedLead.stage || '',
        source: selectedLead.source || '',
        industry: selectedLead.industry || '',
        executive: selectedLead.owner || '',
        address: [selectedLead.address, selectedLead.city, selectedLead.state, selectedLead.country]
          .filter(Boolean)
          .join(', ')
      }
    : null;

  /* ---- Sidebar timeline (mirrors OLD renderTimeline) ---- */
  const timelineItems = [];
  if (selectedLead) {
    timelineItems.push({
      kind: 'created',
      time: timeAgo(selectedLead.createdAt) || 'Just now',
      text: 'Lead Created',
      sub: [selectedLead.leadNo, selectedLead.name].filter(Boolean).join(' — ')
    });
    if (leadFollowUps.length > 0) {
      timelineItems.push({
        kind: 'history-header',
        time: `${leadFollowUps.length} previous follow-up(s)`,
        text: 'Follow-up History'
      });
      leadFollowUps.slice(0, 10).forEach((fu) => {
        timelineItems.push({
          kind: fu.status === 'Completed' ? 'completed' : 'history',
          time: `${timeAgo(fu.followUpDate)} (${formatShortDate(fu.followUpDate)})`,
          text: `${fu.mode || 'Call'} — ${fu.remarks ? fu.remarks.substring(0, 60) + (fu.remarks.length > 60 ? '...' : '') : 'No remarks'}`,
          sub: `${fu.priority || 'Medium'} | ${fu.status || 'Open'}`
        });
      });
    }
    timelineItems.push({
      kind: 'active',
      time: 'Present',
      text: 'Current Follow-up',
      sub: 'In progress'
    });
  }

  /* ---- Sidebar lead summary (mirrors OLD renderLeadSummary) ---- */
  const lastFu = leadFollowUps.length > 0 ? leadFollowUps[0] : null;
  const summaryRows = selectedLead
    ? [
        { label: 'Lead Number', value: selectedLead.leadNo || selectedLead.id || '—' },
        { label: 'Customer', value: selectedLead.name || '—' },
        { label: 'Company', value: selectedLead.company || '—' },
        { label: 'Executive', value: selectedLead.owner || '—' },
        { label: 'Status', value: selectedLead.status || selectedLead.stage || '—' },
        { label: 'Source', value: selectedLead.source || '—' },
        { label: 'Industry', value: selectedLead.industry || '—' },
        { label: 'Expected Value', value: formatINR(selectedLead.value) },
        { label: 'Total Follow-ups', value: String(leadFollowUps.length) },
        { label: 'Last Activity', value: lastFu ? formatShortDate(lastFu.followUpDate) : (selectedLead.createdAt ? formatShortDate(selectedLead.createdAt) : '—') },
        { label: 'Next Follow-up', value: lastFu?.nextFollowUpDate ? formatShortDate(lastFu.nextFollowUpDate) : '—' },
        { label: 'Phone', value: selectedLead.phone || '—' },
        { label: 'Email', value: selectedLead.email || '—' }
      ]
    : [];

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[13px] text-slate-400 mb-2 select-none">
        <button onClick={() => navigate('/dashboard')} className="text-[#0B4A3D] hover:underline font-medium cursor-pointer">VISHAK TECH</button>
        <span className="text-[10px] text-slate-300">›</span>
        <button onClick={() => navigate('/leads')} className="text-[#0B4A3D] hover:underline font-medium cursor-pointer">Leads</button>
        <span className="text-[10px] text-slate-300">›</span>
        <button onClick={() => navigate('/followups')} className="text-[#0B4A3D] hover:underline font-medium cursor-pointer">Follow-ups</button>
        <span className="text-[10px] text-slate-300">›</span>
        <span className="text-slate-600 font-medium">{isEdit ? 'Edit Follow-up' : 'Create Follow-up'}</span>
      </nav>

      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5 m-0">
          <Phone className="w-6 h-6 text-[#0B4A3D]" />
          {isEdit ? 'Edit Follow-up' : 'Create Follow-up'}
        </h1>
        <p className="text-[13px] text-slate-500 mt-1 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          Fields marked with <span className="text-red-500">*</span> are required
        </p>
      </div>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="pb-28 space-y-5"
      >
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          {/* ============================= MAIN FORM ============================= */}
          <div className="flex flex-col gap-4 min-w-0">

            {/* SECTION 1: LEAD INFORMATION (first card — open by default) */}
            <Section icon={User} title="Lead Information" defaultOpen>
              <Field label="Lead" required error={leadError}>
                <div
                  className="relative"
                  ref={(node) => {
                    dropdownRef.current = node;
                    leadMenuTriggerRef.current = node;
                  }}
                >
                  {!selectedLead ? (
                    <>
                      <div className="relative flex items-center">
                        <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={leadSearch}
                          onChange={(e) => {
                            setLeadSearch(e.target.value);
                            setLeadLoading(true);
                            setLeadFocused(true);
                          }}
                          onFocus={() => setLeadFocused(true)}
                          placeholder="Search by Lead ID, Company, Name, Phone, Email..."
                          className="w-full bg-surface border border-slate-200 rounded-lg pl-10 pr-10 py-2.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
                        />
                        {leadLoading && <Loader2 className="absolute right-3.5 w-4 h-4 text-slate-400 animate-spin" />}
                      </div>

                      {showLeadResults &&
                        createPortal(
                          <div
                            ref={leadMenuRef}
                            className="bg-surface border border-slate-200 rounded-xl shadow-lg overflow-hidden"
                          >
                            {leadLoading ? (
                              <div className="px-4 py-3 text-xs text-slate-400">Searching leads...</div>
                            ) : leadResults.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-slate-400">
                                {leadSearch ? 'No matching leads found.' : 'Type at least 1 character to search leads.'}
                              </div>
                            ) : (
                              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                                {leadResults.map((lead) => (
                                  <button
                                    key={lead.id}
                                    type="button"
                                    onClick={() => selectLead(normalizeLeadField(lead))}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-bold text-slate-800">
                                        {lead.leadNo ? `${lead.leadNo} — ` : ''}{lead.name || lead.company}
                                      </span>
                                      {lead.stage && (
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{lead.stage}</span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      {[lead.company, lead.email, lead.phone].filter(Boolean).join(' · ') || 'No contact info'}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>,
                          document.body
                        )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(selectedLead.name)}`}>
                          {getInitials(selectedLead.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">
                            {selectedLead.leadNo ? `${selectedLead.leadNo} — ` : ''}{selectedLead.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium truncate">
                            {[selectedLead.company, selectedLead.email, selectedLead.phone].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearLead}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-[#0B4A3D] hover:bg-[#E8F0EE] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        <Pencil className="w-3 h-3" /> Change
                      </button>
                    </div>
                  )}
                </div>
              </Field>

              {selectedLead && (
                <>
                  <FormRow>
                    <Field label="Customer / Company">
                      <input readOnly value={leadAutoRows.company} className={READONLY_CLASS} placeholder="Auto-filled from lead" />
                    </Field>
                    <Field label="Contact Person">
                      <input
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        className={INPUT_CLASS}
                        placeholder="Contact person name"
                      />
                    </Field>
                  </FormRow>
                  <FormRow>
                    <Field label="Phone">
                      <input readOnly value={leadAutoRows.phone} className={READONLY_CLASS} placeholder="Auto-filled from lead" />
                    </Field>
                    <Field label="Email">
                      <input readOnly value={leadAutoRows.email} className={READONLY_CLASS} placeholder="Auto-filled from lead" />
                    </Field>
                  </FormRow>
                  <FormRow>
                    <Field label="Lead Status">
                      <input readOnly value={leadAutoRows.status} className={READONLY_CLASS} placeholder="Auto-filled" />
                    </Field>
                    <Field label="Source">
                      <input readOnly value={leadAutoRows.source} className={READONLY_CLASS} placeholder="Auto-filled" />
                    </Field>
                  </FormRow>
                  <FormRow>
                    <Field label="Industry">
                      <input readOnly value={leadAutoRows.industry} className={READONLY_CLASS} placeholder="Auto-filled" />
                    </Field>
                    <Field label="Executive">
                      <input readOnly value={leadAutoRows.executive} className={READONLY_CLASS} placeholder="Auto-filled" />
                    </Field>
                  </FormRow>
                  <FormRow full>
                    <Field label="Address">
                      <textarea
                        readOnly
                        value={leadAutoRows.address}
                        className="w-full min-h-[60px] px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] text-slate-500 bg-slate-50 outline-none resize-y cursor-not-allowed"
                        placeholder="Auto-filled"
                      />
                    </Field>
                  </FormRow>
                </>
              )}
            </Section>

            {/* CPR CONVERSION BANNER (shown when a lead is selected) */}
            {selectedLead && (
              <div className="border-2 border-[#0B4A3D] bg-gradient-to-br from-[#E8F0EE] to-[#EDF7F4] rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-7 h-7 text-[#0A4F44] shrink-0" />
                  <div className="text-sm text-[#0B4A3D] font-medium">
                    Lead is ready for CPR Conversion
                    <small className="block font-normal text-xs text-[#0A4F44] mt-0.5">
                      Convert this lead into a Customer Purchase Request to move forward in the pipeline
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/cprs/new', { state: { lead: selectedLead } })}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#0a3f35] px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <ClipboardList className="w-3.5 h-3.5" /> Convert to CPR
                </button>
              </div>
            )}

            {/* SECTION 2: FOLLOW-UP DETAILS */}
            <Section icon={CalendarClock} title="Follow-up Details" defaultOpen={false}>
              <FormRow>
                <Field label="Follow-up Date" required error={errors.followUpDate?.message}>
                  <TextInput
                    type="date"
                    error={errors.followUpDate}
                    registration={register('followUpDate', { required: 'Follow-up date is required' })}
                  />
                </Field>
                <Field label="Time">
                  <TextInput type="time" registration={register('followUpTime')} />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Mode" required error={errors.mode?.message}>
                  <SelectInput registration={register('mode', { required: 'Mode is required' })}>
                    <option value="">Select Mode</option>
                    {FOLLOWUP_MODES.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Priority">
                  <SelectInput registration={register('priority')}>
                    {FOLLOWUP_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </SelectInput>
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Current Status">
                  <SelectInput registration={register('status')}>
                    {FOLLOWUP_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Outcome">
                  <SelectInput registration={register('outcome')}>
                    <option value="">-- Select Outcome --</option>
                    {OUTCOMES.map((outcome) => (
                      <option key={outcome} value={outcome}>{outcome}</option>
                    ))}
                  </SelectInput>
                </Field>
              </FormRow>
            </Section>

            {/* SECTION 3: DISCUSSION */}
            <Section icon={MessageSquare} title="Discussion" defaultOpen={false}>
              <Field label="Discussion Summary" required error={errors.remarks?.message}>
                <TextArea
                  rows={4}
                  registration={register('remarks', { required: 'Discussion summary is required' })}
                  placeholder="Summarise the discussion with the lead..."
                />
              </Field>
              <Field label="Customer Feedback" className="mt-4">
                <TextArea
                  rows={3}
                  registration={register('feedback')}
                  placeholder="Customer's feedback and response to our offerings"
                />
              </Field>
              <Field label="Requirement" className="mt-4">
                <TextArea
                  rows={3}
                  registration={register('requirement')}
                  placeholder="What are the customer's requirements?"
                />
              </Field>
            </Section>

            {/* SECTION 4: NEXT ACTION */}
            <Section icon={FastForward} title="Next Action" defaultOpen={false}>
              <FormRow>
                <Field label="Next Follow-up Date">
                  <TextInput type="date" registration={register('nextFollowUpDate')} />
                </Field>
                <Field label="Assign To">
                  <Controller
                    name="assignedUser"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        creatable
                        onCreate={async (name) => {
                          try {
                            const created = await userService.createOwner(name);
                            const ownerName = created?.name || name;
                            setUsers((prev) => (prev.includes(ownerName) ? prev : [...prev, ownerName]));
                            field.onChange(ownerName);
                          } catch (err) {
                            toast.error(err?.message || 'Failed to create owner');
                          }
                        }}
                        options={users.map((user) => ({ value: user, label: user }))}
                        placeholder="Type or select assignee..."
                      />
                    )}
                  />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Reminder">
                  <SelectInput registration={register('reminder')}>
                    {REMINDERS.map((reminder) => (
                      <option key={reminder} value={reminder}>{reminder}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Reminder Type">
                  <SelectInput registration={register('reminderType')}>
                    <option value="">Select Reminder Type</option>
                    {REMINDER_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </SelectInput>
                </Field>
              </FormRow>
            </Section>
          </div>

          {/* ============================= SIDEBAR ============================= */}
          <div className="flex flex-col gap-4 min-w-0 xl:sticky xl:top-4">

            {/* LEAD DETAILS: timeline + summary */}
            <Section icon={Info} title="Lead Details" compact defaultOpen={false}>
              {!selectedLead ? (
                <div className="text-center py-4 text-slate-400 text-[13px]">
                  <User className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                  <div className="font-medium text-slate-500 mb-1">Select a Lead to view</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    <span className="block"><TrendingUp className="inline w-3 h-3 mr-1" />Lead Summary</span>
                    <span className="block"><History className="inline w-3 h-3 mr-1" />Timeline</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Timeline */}
                  <div className="pl-2">
                    {timelineItems.map((item, index) => (
                      <div
                        key={index}
                        className={`relative pl-6 pb-4 last:pb-0 border-l-2 ${
                          item.kind === 'active' ? 'border-[#0A4F44]' : item.kind === 'completed' || item.kind === 'created' ? 'border-emerald-500' : 'border-slate-200'
                        }`}
                      >
                        <span
                          className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-surface ${
                            item.kind === 'active' ? 'bg-[#0A4F44]' : item.kind === 'completed' || item.kind === 'created' ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        />
                        <div className="text-[11px] text-slate-400 mb-0.5">{item.time}</div>
                        <div className="text-[13px] text-slate-600 font-medium">{item.text}</div>
                        {item.sub && <div className="text-xs text-slate-500 mt-0.5">{item.sub}</div>}
                      </div>
                    ))}
                    {leadFollowUpsLoading && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 py-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading timeline...
                      </div>
                    )}
                  </div>

                  {/* Lead Summary */}
                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Lead Summary</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
                      {summaryRows.map((row) => (
                        <div key={row.label} className="flex items-baseline justify-between gap-2">
                          <span className="text-slate-500">{row.label}</span>
                          <span className="font-medium text-slate-800 text-right truncate">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Section>

            {/* ATTACHMENTS */}
            <Section icon={Paperclip} title="Attachments" compact defaultOpen={false}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <label
                onClick={(e) => {
                  e.preventDefault();
                  openFilePicker();
                }}
                className="border-2 border-dashed border-slate-300 rounded-xl py-8 px-4 text-center cursor-pointer bg-slate-50 hover:border-[#0A4F44] hover:bg-[#EDF7F4] transition-all block"
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
                <p className="text-sm text-slate-600 m-0">
                  Drag &amp; drop files or <span className="text-[#0A4F44] font-medium">browse</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">PDF, DOCX, XLSX, PNG, JPG up to 10MB</p>
              </label>

              {(existingAttachments.length > 0 || pendingFiles.length > 0) && (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
                    <Paperclip className="w-3 h-3" /> Uploaded Files
                  </div>
                  <div className="space-y-1.5">
                    {existingAttachments.map((attachment) => {
                      const Icon = attachmentIcon(attachment.name);
                      return (
                        <div key={`existing-${attachment.id}`} className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
                          <Icon className="w-4 h-4 text-[#0B4A3D] shrink-0" />
                          <span className="flex-1 min-w-0 text-[11px] font-medium text-slate-700 truncate">{attachment.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{formatBytes(attachment.size)}</span>
                          <a href={attachment.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#0B4A3D] transition-colors cursor-pointer" title="View">
                            <FileIcon className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => removeExistingAttachment(attachment)}
                            className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    {pendingFiles.map((item) => {
                      const Icon = attachmentIcon(item.file.name);
                      return (
                        <div key={item.key} className="flex items-center gap-2.5 bg-[#E8F0EE]/60 border border-[#0B4A3D]/20 rounded-lg px-2.5 py-2">
                          <Icon className="w-4 h-4 text-[#0B4A3D] shrink-0" />
                          <span className="flex-1 min-w-0 text-[11px] font-medium text-slate-700 truncate">{item.file.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{formatBytes(item.file.size)}</span>
                          <button
                            type="button"
                            onClick={() => removePendingFile(item.key)}
                            className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>
          </div>
        </div>

        {/* ============================= STICKY FOOTER ============================= */}
        <div className="sticky bottom-0 z-40 bg-surface/95 backdrop-blur border border-slate-200 rounded-xl shadow-[0_-2px_12px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/followups')}
                disabled={saving || uploading}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5 text-slate-400" /> Cancel
              </button>
              <button
                type="button"
                onClick={() => onSave('list', 'Draft')}
                disabled={saving || uploading}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-slate-400" /> Save Draft
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => onSave('new')}
                  disabled={saving || uploading}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#0B4A3D] bg-surface border border-[#0B4A3D]/40 px-4 py-2.5 rounded-lg hover:bg-[#0B4A3D]/5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" /> Save &amp; Create New
                </button>
              )}
              <button
                type="button"
                onClick={() => onSave('list')}
                disabled={saving || uploading}
                className="flex items-center gap-2 bg-[#0B4A3D] hover:bg-[#0a3f35] text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {(saving || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving || uploading ? 'Saving...' : 'Save & Continue'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
