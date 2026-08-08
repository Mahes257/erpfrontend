import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search, Plus, Filter, X,
  Pencil, Eye, RefreshCw, AlertTriangle,
  Trash2, Archive, RotateCcw, UserCheck, TrendingUp, Copy, Share2, Mail,
  Sparkles, Send, Trophy, XCircle, CalendarClock, AlarmClock, Columns3,
  Users, CheckCircle, FileDown, Download, FileText, FileSpreadsheet, Printer,
  UserPlus, ClipboardList, StickyNote, Paperclip, Flag, PhoneCall
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useLeads from '../hooks/useLeads';
import useDebounce from '../hooks/useDebounce';
import useLocalStorage from '../hooks/useLocalStorage';
import LeadTable from '../components/LeadTable';
import ColumnsDropdown from '../components/LeadTable/ColumnsDropdown';
import LeadFilterPanel from '../components/LeadTable/LeadFilterPanel';
import { ConfirmDialog, useToast } from '../components/Common';
import ImportButton from '../components/Common/ImportButton';
import ExportDropdown from '../components/Export';
import { EXPORT_FORMATS, exportLeads, getExportFormat } from '../services/exportService';
import {
  AssignOwnerModal,
  ChangeStageModal,
  ChangePriorityModal,
  AddNoteModal,
  UploadAttachmentModal
} from '../components/LeadModals';
import { LeadViewModal } from '../components/LeadDetail';
import { STORAGE_KEYS } from '../utils/leadConstants';
import { formatINR, formatDate, normalizeLead } from '../utils/leadHelpers';
import { shareLead, sendEmail } from '../utils/leadActions';
import leadService from '../services/leadService';

const STATUS_TABS = [
  { key: 'All', label: 'All', status: '' },
  { key: 'Active', label: 'Active', status: 'Active' },
  { key: 'Archived', label: 'Archived', status: 'Archived' },
  { key: 'Deleted', label: 'Deleted', status: 'Deleted' }
];

/* OLD.zip badge styling for the leads table */
const OLD_BADGE = 'inline-flex items-center px-2.5 py-0.5 rounded-[12px] text-[11px] font-semibold';
const OLD_STAGE_BADGES = {
  New: 'bg-slate-100 text-slate-600',
  Contacted: 'bg-teal-100 text-teal-700',
  Proposal: 'bg-amber-100 text-amber-800',
  Qualified: 'bg-emerald-100 text-emerald-800',
  Negotiation: 'bg-rose-100 text-rose-800',
  Won: 'bg-emerald-100 text-emerald-800',
  Lost: 'bg-red-100 text-red-600'
};
const OLD_PRIORITY_BADGES = {
  critical: 'bg-red-50 text-red-600',
  high: 'bg-amber-50 text-amber-700',
  medium: 'bg-slate-100 text-slate-600',
  low: 'bg-emerald-50 text-emerald-700'
};
const OLD_STATUS_BADGES = {
  Active: 'bg-emerald-100 text-emerald-800',
  Inactive: 'bg-slate-100 text-slate-600',
  Archived: 'bg-slate-100 text-slate-600',
  Deleted: 'bg-red-100 text-red-600'
};
const OLD_STATUS_BADGE_FALLBACK = 'bg-emerald-50 text-[#0B4A3D]';

const SUMMARY_CARDS = [
  { key: 'New', title: 'New', icon: Sparkles, iconBg: 'bg-teal-50', iconColor: 'text-teal-600' },
  { key: 'Qualified', title: 'Qualified', icon: UserCheck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { key: 'Proposal Sent', title: 'Proposal Sent', icon: Send, iconBg: 'bg-teal-50', iconColor: 'text-teal-700' },
  { key: 'Won', title: 'Won', icon: Trophy, iconBg: 'bg-green-50', iconColor: 'text-green-600' },
  { key: 'Lost', title: 'Lost', icon: XCircle, iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
  { key: "Today's Follow-ups", title: "Today's Follow-ups", icon: CalendarClock, iconBg: 'bg-violet-50', iconColor: 'text-violet-500' },
  { key: 'Overdue Follow-ups', title: 'Overdue Follow-ups', icon: AlarmClock, iconBg: 'bg-amber-50', iconColor: 'text-amber-500' }
];

const STATUS_SUMMARY_CARDS = [
  { key: 'Total', title: 'Total Leads', icon: Users, iconBg: 'bg-[#E8F0EE]', iconColor: 'text-[#0B4A3D]', highlight: true },
  { key: 'Active', title: 'Active Leads', icon: CheckCircle, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { key: 'Archived', title: 'Archived Leads', icon: Archive, iconBg: 'bg-teal-50', iconColor: 'text-teal-600' },
  { key: 'Deleted', title: 'Deleted Leads', icon: Trash2, iconBg: 'bg-rose-50', iconColor: 'text-rose-500' }
];

const CARD_FILTERS = {
  Total: {},
  Active: { status: 'Active' },
  Archived: { status: 'Archived' },
  Deleted: { status: 'Deleted' },
  New: { stage: 'New' },
  Qualified: { stage: 'Qualified' },
  'Proposal Sent': { stage: 'Negotiation' },
  Won: { stage: 'Won' },
  Lost: { stage: 'Lost' },
  "Today's Follow-ups": { followUp: 'today' },
  'Overdue Follow-ups': { followUp: 'overdue' }
};

// Column order + widths match OLD.zip leads.html <colgroup>
const TABLE_COLUMNS = [
  { key: 'number', label: 'Lead No', width: 160, sortable: true, visible: true, align: 'left' },
  { key: 'company', label: 'Business Name', width: 260, sortable: true, visible: true, sticky: 'left' },
  { key: 'name', label: 'Contact Person', width: 200, sortable: true, visible: true, align: 'left' },
  { key: 'phone', label: 'Phone', width: 170, sortable: true, visible: true, align: 'left' },
  { key: 'email', label: 'Email', width: 260, sortable: true, visible: true, align: 'left' },
  { key: 'industry', label: 'Industry', width: 180, sortable: true, visible: true, align: 'left' },
  { key: 'source', label: 'Lead Source', width: 160, sortable: true, visible: true, align: 'left' },
  { key: 'stage', label: 'Stage', width: 150, sortable: true, visible: true, align: 'center' },
  { key: 'owner', label: 'Owner', width: 170, sortable: true, visible: true, align: 'left' },
  { key: 'priority', label: 'Priority', width: 120, sortable: true, visible: true, align: 'center' },
  { key: 'value', label: 'Expected Value', width: 160, sortable: true, visible: true, align: 'left' },
  { key: 'lastFollowUp', label: 'Last Follow-up', width: 170, sortable: false, visible: true, align: 'left' },
  { key: 'nextFollowUp', label: 'Next Follow-up', width: 170, sortable: false, visible: true, align: 'left' },
  { key: 'status', label: 'Status', width: 120, sortable: true, visible: true, align: 'center' },
  { key: 'actions', label: 'Actions', width: 70, sortable: false, visible: true, sticky: 'right', align: 'center' }
];

const EXPORT_COLUMNS = [
  { key: 'number', label: 'Lead No' },
  { key: 'description', label: 'Description' },
  { key: 'name', label: 'Contact Name' },
  { key: 'company', label: 'Company' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'source', label: 'Source' },
  { key: 'industry', label: 'Industry' },
  { key: 'priority', label: 'Priority' },
  { key: 'stage', label: 'Stage' },
  { key: 'value', label: 'Expected Value' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created Date' },
  { key: 'owner', label: 'Assigned To' }
];

const EXPORT_ICONS = {
  'pdf-summary': FileText,
  'pdf-detailed': FileText,
  excel: FileSpreadsheet,
  csv: FileDown,
  print: Printer
};

const DOCUMENT_EXPORT_ITEMS = EXPORT_FORMATS.map((format) => ({
  key: `export:${format.key}`,
  label: format.label,
  icon: EXPORT_ICONS[format.key],
  hint: format.hint
}));

const LEAD_SECTION = [
  { header: 'Lead' },
  { key: 'view', label: 'View Lead', icon: Eye },
  { key: 'edit', label: 'Edit Lead', icon: Pencil },
  { key: 'duplicate', label: 'Duplicate', icon: Copy },
  { key: 'share', label: 'Share', icon: Share2 }
];

const COMMUNICATION_SECTION = [
  { divider: true },
  { header: 'Communication' },
  { key: 'addFollowUp', label: 'Add Follow-up', icon: CalendarClock },
  { key: 'logCall', label: 'Log Call', icon: PhoneCall },
  { key: 'sendEmail', label: 'Send Email', icon: Mail },
  { key: 'addNote', label: 'Add Note', icon: StickyNote },
  { key: 'uploadAttachment', label: 'Upload Attachment', icon: Paperclip }
];

const PIPELINE_SECTION = [
  { divider: true },
  { header: 'Pipeline' },
  { key: 'changeStage', label: 'Change Stage', icon: TrendingUp },
  { key: 'assignOwner', label: 'Assign Owner', icon: UserCheck },
  { key: 'changePriority', label: 'Change Priority', icon: Flag }
];

const DOCUMENTS_SECTION = [
  { divider: true },
  { header: 'Documents' },
  { key: 'generatePdf', label: 'Generate PDF', icon: FileDown },
  { key: 'export', label: 'Export', icon: Download, submenu: DOCUMENT_EXPORT_ITEMS }
];

const CONVERSION_SECTION = [
  { divider: true },
  { header: 'Conversion' },
  { key: 'createCpr', label: 'Create CPR', icon: ClipboardList }
];

const CONFIRM_CONFIG = {
  archive: { title: 'Archive Lead', icon: Archive, variant: 'warning', confirmLabel: 'Archive' },
  restore: { title: 'Restore Lead', icon: RotateCcw, variant: 'default', confirmLabel: 'Restore' },
  delete: { title: 'Delete Lead', icon: Trash2, variant: 'danger', confirmLabel: 'Delete' },
  deletePermanent: { title: 'Delete Permanently', icon: Trash2, variant: 'danger', confirmLabel: 'Delete Permanently' },
  bulkArchive: { title: 'Archive Selected Leads', icon: Archive, variant: 'warning', confirmLabel: 'Archive' },
  bulkRestore: { title: 'Restore Selected Leads', icon: RotateCcw, variant: 'default', confirmLabel: 'Restore' },
  bulkDelete: { title: 'Delete Selected Leads', icon: Trash2, variant: 'danger', confirmLabel: 'Delete' },
  bulkDeletePermanent: { title: 'Delete Selected Leads Permanently', icon: Trash2, variant: 'danger', confirmLabel: 'Delete Permanently' }
};

const SUCCESS_MESSAGES = {
  archive: 'Lead archived successfully',
  restore: 'Lead restored successfully',
  delete: 'Lead moved to Deleted',
  deletePermanent: 'Lead permanently deleted',
  bulkArchive: (count) => `${count} lead(s) archived`,
  bulkRestore: (count) => `${count} lead(s) restored`,
  bulkDelete: (count) => `${count} lead(s) moved to Deleted`,
  bulkDeletePermanent: (count) => `${count} lead(s) permanently deleted`
};

export default function Leads() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    leads,
    loading,
    error,
    isFallback,
    pagination,
    search,
    setSearch,
    setFilter,
    resetFilters,
    filters,
    toggleSort,
    sortKey,
    sortDirection,
    goToPage,
    changePageSize,
    refresh,
    archiveLead,
    restoreLead,
    deleteLead,
    deleteLeadPermanent,
    bulkArchive,
    bulkRestore,
    bulkDelete,
    bulkDeletePermanent,
    assignOwner,
    changeStage,
    changePriority,
    duplicateLead,
    importLeads
  } = useLeads({ pageSize: 10, persistKey: STORAGE_KEYS.listState });

  const [activeStatus, setActiveStatus] = useState('All');
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [hiddenColumns, setHiddenColumns] = useLocalStorage(STORAGE_KEYS.columns, []);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [confirmState, setConfirmState] = useState(null);
  const [ownerModal, setOwnerModal] = useState(null);
  const [stageModal, setStageModal] = useState(null);
  const [priorityModal, setPriorityModal] = useState(null);
  const [noteModal, setNoteModal] = useState(null);
  const [attachmentModal, setAttachmentModal] = useState(null);
  const [viewLead, setViewLead] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryVersion, setSummaryVersion] = useState(0);
  const [allOwners, setAllOwners] = useState([]);
  const searchRef = useRef(null);

  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(debouncedSearch), 0);
    return () => clearTimeout(timer);
  }, [debouncedSearch, setSearch]);

  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      const tag = target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      if (e.key === 'Escape') {
        if (searchInput) setSearchInput('');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      let s;
      try {
        const res = await leadService.getLeadSummary();
        s = res?.data ?? res;
      } catch {
        s = undefined;
      }
      if (cancelled) return;
      setSummary(s ? {
        cards: {
          Total: Number(s.total ?? 0),
          Active: Number(s.active ?? 0),
          Archived: Number(s.archived ?? 0),
          Deleted: Number(s.deleted ?? 0),
          New: Number(s.newLeads ?? 0),
          Qualified: Number(s.qualified ?? 0),
          'Proposal Sent': Number(s.negotiation ?? 0),
          Won: Number(s.won ?? 0),
          Lost: Number(s.lost ?? 0),
          "Today's Follow-ups": Number(s.followUpsToday ?? 0),
          'Overdue Follow-ups': Number(s.followUpsOverdue ?? 0)
        },
        tabs: {
          All: Number(s.total ?? 0),
          Active: Number(s.active ?? 0),
          Archived: Number(s.archived ?? 0),
          Deleted: Number(s.deleted ?? 0)
        }
      } : null);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [summaryVersion]);

  const bumpSummary = useCallback(() => setSummaryVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await leadService.listCrm('leads', { page: 0, size: 1000 });
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.content)
            ? res.content
            : Array.isArray(res?.data)
              ? res.data
              : Array.isArray(res?.data?.content)
                ? res.data.content
                : Array.isArray(res?.items)
                  ? res.items
                  : [];
        if (cancelled) return;
        setAllOwners(
          Array.from(new Set(list.map((item) => item.owner || item.assignedTo || item.ownerName || '').filter(Boolean))).sort()
        );
      } catch {
        // keep current owners on failure
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [summaryVersion]);

  const ownerOptions = useMemo(
    () => (allOwners.length > 0
      ? allOwners
      : Array.from(new Set(leads.map((lead) => lead.owner).filter(Boolean))).sort()),
    [allOwners, leads]
  );

  const renderers = useMemo(
    () => ({
      number: (lead) => (
        <button
          onClick={() => navigate(`/leads/${lead.id}`)}
          className="font-semibold text-[#0B4A3D] hover:underline cursor-pointer text-left"
          title="View lead details"
        >
          {lead.leadNo || '—'}
        </button>
      ),
      company: (lead) => (
        <button
          onClick={() => navigate(`/leads/${lead.id}`)}
          className="font-semibold text-[#0B4A3D] hover:underline cursor-pointer text-left"
          title="View lead details"
        >
          {lead.businessName || lead.company || '—'}
        </button>
      ),
      name: (lead) => <span className="text-slate-600">{lead.name || '—'}</span>,
      phone: (lead) => <span className="text-slate-600">{lead.phone || '—'}</span>,
      email: (lead) => <span className="text-slate-600 block truncate max-w-[240px]">{lead.email || '—'}</span>,
      industry: (lead) => <span className="text-slate-600">{lead.industry || '—'}</span>,
      source: (lead) => <span className="text-slate-600">{lead.source || '—'}</span>,
      stage: (lead) => (
        <span className={`${OLD_BADGE} ${OLD_STAGE_BADGES[lead.stage] || 'bg-slate-100 text-slate-600'}`}>
          {lead.stage}
        </span>
      ),
      owner: (lead) => <span className="text-slate-600">{lead.owner || 'Unassigned'}</span>,
      priority: (lead) => {
        const key = (lead.priority || 'medium').toLowerCase();
        return (
          <span className={`${OLD_BADGE} ${OLD_PRIORITY_BADGES[key] || OLD_PRIORITY_BADGES.medium}`}>
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </span>
        );
      },
      value: (lead) => <span className="font-semibold text-slate-700 tabular-nums">{formatINR(lead.value)}</span>,
      lastFollowUp: (lead) => {
        const d = formatDate(lead.lastFollowUp);
        return d ? <span className="text-slate-600">{d}</span> : <span className="text-slate-300">—</span>;
      },
      nextFollowUp: (lead) => {
        const d = formatDate(lead.nextFollowUp);
        return d ? <span className="text-slate-600">{d}</span> : <span className="text-slate-300">—</span>;
      },
      status: (lead) => (
        <span className={`${OLD_BADGE} ${OLD_STATUS_BADGES[lead.status] || OLD_STATUS_BADGE_FALLBACK}`}>
          {lead.status}
        </span>
      )
    }),
    [navigate]
  );

  const tableColumns = useMemo(
    () => TABLE_COLUMNS.map((col) => ({ ...col, visible: !hiddenColumns.includes(col.key) })),
    [hiddenColumns]
  );

  const toggleColumn = useCallback((key) => {
    setHiddenColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, [setHiddenColumns]);

  const handleSetHiddenColumns = useCallback((keys) => {
    setHiddenColumns(keys);
  }, [setHiddenColumns]);

  const { totalCount } = pagination;

  const isCardActive = (key) => {
    const filter = CARD_FILTERS[key] || {};
    return (filter.status ?? null) === (filters.status || null) &&
      (filter.stage ?? null) === (filters.stage || null) &&
      (filter.followUp ?? null) === (filters.followUp || null);
  };

  const handleCardFilter = (key) => {
    const filter = CARD_FILTERS[key] || {};
    setSelectedLeads([]);
    setFilter('status', filter.status || '');
    setFilter('stage', filter.stage || '');
    setFilter('followUp', filter.followUp || '');
    setActiveStatus(filter.status === 'Active' ? 'Active' : filter.status === 'Archived' ? 'Archived' : filter.status === 'Deleted' ? 'Deleted' : 'All');
  };

  const handleStatusTab = (key) => {
    setActiveStatus(key);
    setSelectedLeads([]);
    const tab = STATUS_TABS.find((t) => t.key === key);
    setFilter('status', tab ? tab.status : '');
  };

  const handleFilterChange = (key, value) => {
    setFilter(key, value);
    if (key === 'status') {
      setActiveStatus(value === 'Active' ? 'Active' : value === 'Archived' ? 'Archived' : value === 'Deleted' ? 'Deleted' : 'All');
    }
  };

  const handleClearFilters = () => {
    resetFilters();
    setSearchInput('');
    setActiveStatus('All');
  };

  const fetchAllFiltered = useCallback(async () => {
    try {
      const params = {
        page: 0,
        size: Math.max(1000, totalCount || 1000),
        search: search.trim() || undefined,
        sort: sortKey ? `${sortKey},${sortDirection}` : undefined
      };
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params[key] = value;
      });
      Object.keys(params).forEach((key) => {
        if (params[key] === undefined) delete params[key];
      });
      const res = await leadService.listCrm('leads', params);
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.content)
          ? res.content
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.data?.content)
              ? res.data.content
              : Array.isArray(res?.items)
                ? res.items
                : Array.isArray(res?.list)
                  ? res.list
                  : [];
      return list.map(normalizeLead);
    } catch {
      return leads;
    }
  }, [totalCount, search, sortKey, sortDirection, filters, leads]);

  const getRowActions = useCallback((lead) => {
    const conversion = [...CONVERSION_SECTION];
    const stage = (lead.stage || '').toLowerCase();
    const canConvertToClient =
      lead.status !== 'converted' &&
      (stage === 'qualified' || stage === 'won' || stage === 'negotiation');
    if (canConvertToClient) {
      conversion.splice(2, 0, { key: 'convertToClient', label: 'Convert to Client', icon: UserPlus });
    }
    if (lead.status === 'Deleted') {
      return [
        { header: 'Status' },
        { key: 'restore', label: 'Restore', icon: RotateCcw },
        { key: 'deletePermanent', label: 'Permanent Delete', icon: Trash2, danger: true }
      ];
    }
    if (lead.status === 'Archived') {
      return [
        { header: 'Lead' },
        { key: 'view', label: 'View Lead', icon: Eye },
        { key: 'edit', label: 'Edit Lead', icon: Pencil },
        { divider: true },
        { header: 'Status' },
        { key: 'restore', label: 'Restore to Active', icon: RotateCcw },
        { key: 'delete', label: 'Delete', icon: Trash2, danger: true }
      ];
    }
    return [
      ...LEAD_SECTION,
      ...COMMUNICATION_SECTION,
      ...PIPELINE_SECTION,
      ...DOCUMENTS_SECTION,
      ...conversion,
      { divider: true },
      { header: 'Status' },
      { key: 'archive', label: 'Archive', icon: Archive },
      { key: 'delete', label: 'Delete', icon: Trash2, danger: true }
    ];
  }, []);

  const selectedOnPage = useMemo(
    () => leads.filter((lead) => selectedLeads.includes(lead.id)),
    [leads, selectedLeads]
  );

  const bulkActions = useMemo(() => {
    if (selectedLeads.length === 0) return [];
    const anyDeleted = selectedOnPage.some((lead) => lead.status === 'Deleted');
    const anyArchived = selectedOnPage.some((lead) => lead.status === 'Archived');
    const anyActive = selectedOnPage.some((lead) => lead.status !== 'Archived' && lead.status !== 'Deleted');
    const actions = [];
    if (anyDeleted || anyArchived) actions.push({ key: 'bulkRestore', label: 'Restore', icon: RotateCcw, variant: 'default' });
    if (anyDeleted) actions.push({ key: 'bulkDeletePermanent', label: 'Permanent Delete', icon: Trash2, variant: 'danger' });
    if (anyActive || anyArchived) actions.push({ key: 'bulkDelete', label: 'Delete', icon: Trash2, variant: 'danger' });
    if (anyActive) actions.push({ key: 'bulkAssignOwner', label: 'Assign Owner', icon: UserCheck, variant: 'default' });
    if (anyActive) actions.push({ key: 'bulkChangeStage', label: 'Change Stage', icon: TrendingUp, variant: 'default' });
    if (anyActive) actions.push({ key: 'bulkArchive', label: 'Archive', icon: Archive, variant: 'default' });
    actions.push({ key: 'bulkExport', label: 'Export', icon: Download, variant: 'default' });
    return actions;
  }, [selectedLeads, selectedOnPage]);

  const handleDuplicate = useCallback(async (lead) => {
    const result = await duplicateLead(lead.id);
    if (result.ok) {
      toast.success(`${lead.name} duplicated`);
      bumpSummary();
    } else {
      toast.error(result.error?.message || 'Duplicate failed');
    }
  }, [duplicateLead, toast, bumpSummary]);

  const handleShare = useCallback(async (lead) => {
    const result = await shareLead(lead);
    if (result.ok && result.action === 'copy') toast.success('Share link copied to clipboard');
    else if (!result.ok) toast.error('Unable to share this lead');
  }, [toast]);

  const exportPrefix = useCallback((lead) => {
    const name = (lead.name || 'lead').trim().replace(/\s+/g, '_');
    return `${lead.leadNo || `lead-${lead.id}`}_${name}`;
  }, []);

  const handleGeneratePdf = useCallback(
    async (lead) => {
      try {
        await exportLeads('pdf-detailed', [lead], EXPORT_COLUMNS, exportPrefix(lead));
        toast.success(`PDF generated for ${lead.name || lead.leadNo || 'this lead'}`);
      } catch (err) {
        toast.error(err?.message || 'PDF generation failed');
      }
    },
    [toast, exportPrefix]
  );

  const handleSingleExport = useCallback(
    async (lead, format) => {
      try {
        await exportLeads(format, [lead], EXPORT_COLUMNS, exportPrefix(lead));
        const config = getExportFormat(format);
        toast.success(
          format === 'print'
            ? 'Opening printable report...'
            : `Lead exported as ${config?.label || format}`
        );
      } catch (err) {
        toast.error(err?.message || 'Export failed');
      }
    },
    [toast, exportPrefix]
  );

  const handleRowAction = useCallback((actionKey, lead) => {
    switch (actionKey) {
      case 'view':
        setViewLead(lead);
        break;
      case 'edit':
        navigate(`/leads/${lead.id}/edit`);
        break;
      case 'assignOwner':
        setOwnerModal(lead);
        break;
      case 'changeStage':
        setStageModal(lead);
        break;
      case 'changePriority':
        setPriorityModal(lead);
        break;
      case 'addFollowUp':
      case 'logCall':
        navigate(`/followups/new?leadId=${lead.id}`);
        break;
      case 'addNote':
        setNoteModal(lead);
        break;
      case 'uploadAttachment':
        setAttachmentModal(lead);
        break;
      case 'duplicate':
        handleDuplicate(lead);
        break;
      case 'share':
        handleShare(lead);
        break;
      case 'sendEmail':
        sendEmail(lead);
        break;
      case 'generatePdf':
        handleGeneratePdf(lead);
        break;
      case 'convertToClient':
        navigate('/clients/new', { state: { lead } });
        break;
      case 'createCpr':
        navigate('/cprs/new', { state: { lead } });
        break;
      case 'archive':
        setConfirmState({ type: 'archive', ids: [lead.id], label: lead.name });
        break;
      case 'restore':
        setConfirmState({ type: 'restore', ids: [lead.id], label: lead.name });
        break;
      case 'delete':
      case 'deletePermanent':
        setConfirmState({ type: actionKey, ids: [lead.id], label: lead.name });
        break;
      default:
        if (actionKey.startsWith('export:')) {
          handleSingleExport(lead, actionKey.slice('export:'.length));
        }
        break;
    }
  }, [navigate, handleDuplicate, handleShare, handleGeneratePdf, handleSingleExport]);

  const handleAssignOwner = async (owner) => {
    if (!ownerModal) return false;
    if (ownerModal._bulk) {
      let done = 0;
      for (const id of ownerModal.ids) {
        const r = await assignOwner(id, owner);
        if (r.ok) done += 1;
      }
      if (done > 0) {
        toast.success(`Owner assigned to ${done} lead(s)`);
        setOwnerModal(null);
        setSelectedLeads([]);
        bumpSummary();
        return true;
      }
      toast.error('Failed to assign owner');
      return false;
    }
    const result = await assignOwner(ownerModal.id, owner);
    if (result.ok) {
      toast.success(`Owner assigned to ${ownerModal.name}`);
      setOwnerModal(null);
      bumpSummary();
      return true;
    }
    toast.error(result.error?.message || 'Failed to assign owner');
    return false;
  };

  const handleChangeStage = async (stage) => {
    if (!stageModal) return false;
    if (stageModal._bulk) {
      let done = 0;
      for (const id of stageModal.ids) {
        const r = await changeStage(id, stage);
        if (r.ok) done += 1;
      }
      if (done > 0) {
        toast.success(`Stage changed to ${stage} for ${done} lead(s)`);
        setStageModal(null);
        setSelectedLeads([]);
        bumpSummary();
        return true;
      }
      toast.error('Failed to change stage');
      return false;
    }
    const result = await changeStage(stageModal.id, stage);
    if (result.ok) {
      toast.success(`Stage changed to ${stage} for ${stageModal.name}`);
      setStageModal(null);
      bumpSummary();
      return true;
    }
    toast.error(result.error?.message || 'Failed to change stage');
    return false;
  };

  const handleChangePriority = async (priority) => {
    if (!priorityModal) return false;
    const result = await changePriority(priorityModal.id, priority);
    if (result.ok) {
      toast.success(`Priority changed to ${priority} for ${priorityModal.name}`);
      setPriorityModal(null);
      bumpSummary();
      return true;
    }
    toast.error(result.error?.message || 'Failed to change priority');
    return false;
  };

  const handleAddNote = async (text) => {
    if (!noteModal) return false;
    try {
      await leadService.addNote(noteModal.id, { text });
      toast.success('Note added');
      setNoteModal(null);
      return true;
    } catch (err) {
      toast.error(err?.message || 'Failed to add note');
      return false;
    }
  };

  const handleUploadAttachment = async (file) => {
    if (!attachmentModal) return false;
    try {
      const formData = new FormData();
      formData.append('file', file);
      await leadService.addAttachment(attachmentModal.id, formData);
      toast.success('Attachment uploaded');
      setAttachmentModal(null);
      return true;
    } catch (err) {
      toast.error(err?.message || 'Failed to upload attachment');
      return false;
    }
  };

  const handleBulkExport = async (ids) => {
    try {
      const all = await fetchAllFiltered();
      const selected = all.filter((lead) => ids.includes(lead.id));
      await exportLeads('excel', selected, EXPORT_COLUMNS, `leads_selected_${selected.length}`);
      toast.success(`${selected.length} lead(s) exported`);
    } catch (err) {
      toast.error(err?.message || 'Export failed');
    }
  };

  const handleBulkAction = (actionKey, ids) => {
    switch (actionKey) {
      case 'bulkAssignOwner':
        setOwnerModal({ _bulk: true, ids, name: `${ids.length} lead(s) selected`, company: '' });
        break;
      case 'bulkChangeStage':
        setStageModal({ _bulk: true, ids, name: `${ids.length} lead(s) selected`, company: '' });
        break;
      case 'bulkExport':
        handleBulkExport(ids);
        break;
      default:
        setConfirmState({ type: actionKey, ids });
        break;
    }
  };

  const handleImport = async (formData) => {
    const result = await importLeads(formData);
    if (result.ok) {
      toast.success('Import completed successfully');
      bumpSummary();
    } else {
      toast.error(result.error?.message || 'Import failed');
    }
  };

  const buildConfirmMessage = (state) => {
    const count = state.ids.length;
    const label = count === 1 && state.label ? `"${state.label}"` : `${count} selected lead(s)`;
    switch (state.type) {
      case 'archive':
        return `Archive ${label}? Archived leads can be restored anytime.`;
      case 'restore':
        return `Restore ${label} to active leads?`;
      case 'delete':
        return `Move ${label} to Deleted? The lead can be restored anytime.`;
      case 'deletePermanent':
        return `Delete ${label} permanently? The lead is soft-deleted (status Deleted) and can still be restored from the Deleted tab.`;
      case 'bulkArchive':
        return `Archive ${count} selected lead(s)? Archived leads can be restored anytime.`;
      case 'bulkRestore':
        return `Restore ${count} selected lead(s) to active leads?`;
      case 'bulkDelete':
        return `Move ${count} selected lead(s) to Deleted? They can be restored anytime.`;
      case 'bulkDeletePermanent':
        return `Permanently delete ${count} selected lead(s)? This action cannot be undone and removes them from the database.`;
      default:
        return '';
    }
  };

  const executeConfirm = async () => {
    if (!confirmState) return;
    const { type, ids } = confirmState;
    setConfirmState((prev) => ({ ...prev, loading: true }));
    let result;
    switch (type) {
      case 'archive':
        result = await archiveLead(ids[0]);
        break;
      case 'restore':
        result = await restoreLead(ids[0]);
        break;
      case 'delete':
        result = await deleteLead(ids[0]);
        break;
      case 'deletePermanent':
        result = await deleteLeadPermanent(ids[0]);
        break;
      case 'bulkArchive':
        result = await bulkArchive(ids);
        break;
      case 'bulkRestore':
        result = await bulkRestore(ids);
        break;
      case 'bulkDelete':
        result = await bulkDelete(ids);
        break;
      case 'bulkDeletePermanent':
        result = await bulkDeletePermanent(ids);
        break;
      default:
        result = { ok: false, error: { message: 'Unknown operation' } };
    }

    if (result.ok) {
      const message = typeof SUCCESS_MESSAGES[type] === 'function' ? SUCCESS_MESSAGES[type](ids.length) : SUCCESS_MESSAGES[type];
      toast.success(message);
      setSelectedLeads([]);
      setConfirmState(null);
      bumpSummary();
    } else {
      toast.error(result.error?.message || 'Operation failed');
      setConfirmState((prev) => ({ ...prev, loading: false }));
    }
  };

  const confirmConfig = confirmState ? CONFIRM_CONFIG[confirmState.type] : null;

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">

      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
        <span>VISHAK TECH</span>
        <span>&gt;</span>
        <span>CRM</span>
        <span>&gt;</span>
        <span className="text-slate-600">Leads</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Leads</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => navigate('/pipeline')}
            className="flex items-center gap-2 bg-surface border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-sm cursor-pointer select-none"
          >
            <Columns3 className="w-4 h-4 text-slate-400" />
            <span>Pipeline</span>
          </button>
          <ImportButton onImport={handleImport} buttonLabel="Upload Leads" />
          <button
            onClick={() => navigate('/leads/new')}
            className="flex items-center gap-2 bg-gradient-to-r from-[#136754] to-[#0B4A3D] hover:from-[#17806A] hover:to-[#0F5C4C] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-[0_2px_8px_rgba(11,74,61,0.25)] hover:shadow-[0_6px_18px_rgba(11,74,61,0.35)] hover:-translate-y-0.5 cursor-pointer select-none"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 select-none">
        {STATUS_SUMMARY_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => handleCardFilter(card.key)}
              className={`group bg-surface rounded-xl p-4 shadow-sm flex items-center gap-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                card.highlight ? 'border-2 border-[#0B4A3D]/20 hover:border-[#0B4A3D]/40' : 'border border-slate-200 hover:border-slate-300'
              } ${isCardActive(card.key) ? 'ring-2 ring-[#0B4A3D]/30 border-[#0B4A3D]' : ''}`}
            >
              <div className={`p-2.5 rounded-lg ${card.iconBg} ${card.iconColor} shrink-0 transition-transform group-hover:scale-105`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                {summary ? (
                  <div className="text-lg font-extrabold text-slate-900 leading-none">{summary.cards[card.key]}</div>
                ) : (
                  <div className="h-5 w-8 bg-slate-200 rounded animate-pulse" />
                )}
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">{card.title}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 sm:gap-4 mb-6 select-none">
        {SUMMARY_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => handleCardFilter(card.key)}
              className={`group bg-surface border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-[#0B4A3D]/30 cursor-pointer ${isCardActive(card.key) ? 'ring-2 ring-[#0B4A3D]/30 border-[#0B4A3D]' : ''}`}
            >
              <div className={`p-2.5 rounded-lg ${card.iconBg} ${card.iconColor} shrink-0 transition-transform group-hover:scale-105`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                {summary ? (
                  <div className="text-lg font-extrabold text-slate-900 leading-none">{summary.cards[card.key]}</div>
                ) : (
                  <div className="h-5 w-8 bg-slate-200 rounded animate-pulse" />
                )}
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">{card.title}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="inline-flex items-center gap-0.5 p-1 bg-slate-50 border border-slate-200 rounded-[10px] w-full sm:w-fit mb-6 select-none overflow-x-auto no-scrollbar">
        {STATUS_TABS.map((tab) => {
          const count = summary ? summary.tabs[tab.key] : null;
          const isActive = activeStatus === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleStatusTab(tab.key)}
              className={`flex items-center gap-1.5 flex-1 sm:flex-none px-5 h-9 border rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#0B4A3D] border-[#0B4A3D] border-2 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold leading-none transition-all ${
                  isActive ? 'bg-white text-[#0B4A3D]' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {count === null ? '…' : count}
              </span>
            </button>
          );
        })}
      </div>

      {isFallback && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Unable to reach the server{error?.message ? ` (${error.message})` : ''} - showing cached data.</span>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      <div className="bg-surface border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row items-center justify-between gap-3 mb-4 shadow-sm">
        <div className="flex-1 w-full relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by Lead No, Name, Phone, Email..."
            className="w-full bg-slate-50 border border-slate-200/80 rounded-lg pl-10 pr-9 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] focus:bg-surface transition-all shadow-inner"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end select-none">
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
              Object.keys(filters).length > 0
                ? 'bg-[#0F5B4C] text-white border-[#0F5B4C]'
                : 'bg-surface border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            {Object.keys(filters).length > 0 && (
              <span className="bg-white/20 text-[10px] px-1.5 rounded-full">{Object.keys(filters).length}</span>
            )}
          </button>

          <ExportDropdown leads={leads} columns={EXPORT_COLUMNS} filename="leads" getLeads={fetchAllFiltered} />

          <ColumnsDropdown columns={tableColumns} onToggle={toggleColumn} onSetHidden={handleSetHiddenColumns} />
        </div>
      </div>

      <div className={`lead-filter-collapse ${showFilters ? 'open' : ''}`}>
        <div className="lead-filter-collapse-inner">
          <div className="mb-4">
            <LeadFilterPanel
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleClearFilters}
              ownerOptions={ownerOptions}
            />
          </div>
        </div>
      </div>

      <LeadTable
        columns={tableColumns}
        data={leads}
        loading={loading}
        error={error}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        pagination={pagination}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
        selectedIds={selectedLeads}
        onSelectionChange={setSelectedLeads}
        renderers={renderers}
        rowActions={getRowActions}
        onRowAction={handleRowAction}
        bulkActions={bulkActions}
        onBulkAction={handleBulkAction}
        selectedLabel="lead(s)"
        bulkBarExtra={
          <ExportDropdown
            leads={selectedOnPage}
            columns={EXPORT_COLUMNS}
            filename="leads-selected"
            variant="dark"
            buttonLabel="Export"
          />
        }
        onRetry={refresh}
        errorMessage="Failed to load leads. Please try again."
        emptyMessage={
          activeStatus === 'Deleted'
            ? 'No deleted leads. Records you move to Deleted will appear here.'
            : 'No leads found matching your criteria.'
        }
        emptyAction={
          Object.keys(filters).length > 0 || searchInput
            ? { label: 'Clear Filters', icon: X, onClick: handleClearFilters }
            : null
        }
      />

      {confirmState && confirmConfig && (
        <ConfirmDialog
          open={confirmState !== null}
          title={confirmConfig.title}
          message={buildConfirmMessage(confirmState)}
          confirmLabel={confirmConfig.confirmLabel}
          variant={confirmConfig.variant}
          icon={confirmConfig.icon}
          loading={confirmState.loading || false}
          onConfirm={executeConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      <AssignOwnerModal
        key={ownerModal?.id ?? (ownerModal?._bulk ? `owner-bulk-${ownerModal.ids.length}` : 'owner-modal-closed')}
        open={ownerModal !== null}
        lead={ownerModal}
        onClose={() => setOwnerModal(null)}
        onSubmit={handleAssignOwner}
      />

      <ChangeStageModal
        key={stageModal?.id ?? (stageModal?._bulk ? `stage-bulk-${stageModal.ids.length}` : 'stage-modal-closed')}
        open={stageModal !== null}
        lead={stageModal}
        onClose={() => setStageModal(null)}
        onSubmit={handleChangeStage}
      />

      <ChangePriorityModal
        key={priorityModal?.id ?? 'priority-modal-closed'}
        open={priorityModal !== null}
        lead={priorityModal}
        onClose={() => setPriorityModal(null)}
        onSubmit={handleChangePriority}
      />

      <AddNoteModal
        key={noteModal?.id ?? 'note-modal-closed'}
        open={noteModal !== null}
        lead={noteModal}
        onClose={() => setNoteModal(null)}
        onSubmit={handleAddNote}
      />

      <UploadAttachmentModal
        key={attachmentModal?.id ?? 'attachment-modal-closed'}
        open={attachmentModal !== null}
        lead={attachmentModal}
        onClose={() => setAttachmentModal(null)}
        onSubmit={handleUploadAttachment}
      />

      <LeadViewModal
        key={viewLead?.id ?? 'view-modal-closed'}
        open={viewLead !== null}
        lead={viewLead}
        onClose={() => setViewLead(null)}
      />

    </div>
  );
}
