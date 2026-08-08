import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, X, ChevronLeft, Calendar, Filter,
  RefreshCw, AlertTriangle, Inbox, IndianRupee,
  MoreVertical, ChevronRight,
  Eye, Pencil, CalendarClock, PhoneCall, Mail, StickyNote, Paperclip,
  TrendingUp, UserCheck, Flag, FileDown, Download, Copy, ClipboardList,
  FileText, FileSpreadsheet, Printer, Archive, Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useLeads from '../hooks/useLeads';
import useDebounce from '../hooks/useDebounce';
import useClickOutside from '../hooks/useClickOutside';
import { ConfirmDialog, useToast } from '../components/Common';
import {
  AssignOwnerModal,
  ChangeStageModal,
  ChangePriorityModal,
  AddNoteModal,
  UploadAttachmentModal
} from '../components/LeadModals';
import { EXPORT_FORMATS, exportLeads, getExportFormat } from '../services/exportService';
import { sendEmail } from '../utils/leadActions';
import { STAGES, STAGE_BADGES, STAGE_BADGE_FALLBACK } from '../utils/leadConstants';
import { formatINR, getInitials, avatarColor } from '../utils/leadHelpers';
import leadService from '../services/leadService';

const COLUMN_STYLE = 'bg-slate-100/70 border border-slate-200 rounded-xl flex flex-col w-[270px] shrink-0';

const EXPORT_COLUMNS = [
  { key: 'number', label: 'Lead No' },
  { key: 'businessName', label: 'Business Name' },
  { key: 'name', label: 'Contact Person' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'industry', label: 'Industry' },
  { key: 'source', label: 'Lead Source' },
  { key: 'stage', label: 'Stage' },
  { key: 'owner', label: 'Owner' }
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

const MENU_WIDTH = 190;
const MENU_MAX_HEIGHT = 450;

function buildMenuActions() {
  return [
    { header: 'Lead' },
    { key: 'view', label: 'View Lead', icon: Eye },
    { key: 'edit', label: 'Edit Lead', icon: Pencil },
    { divider: true },
    { header: 'Communication' },
    { key: 'addFollowUp', label: 'Add Follow-up', icon: CalendarClock },
    { key: 'logCall', label: 'Log Call', icon: PhoneCall, comingSoon: true },
    { key: 'sendEmail', label: 'Send Email', icon: Mail },
    { key: 'addNote', label: 'Add Note', icon: StickyNote },
    { key: 'uploadAttachment', label: 'Upload Attachment', icon: Paperclip },
    { divider: true },
    { header: 'Pipeline' },
    { key: 'moveStage', label: 'Move Stage', icon: TrendingUp },
    { key: 'assignOwner', label: 'Assign Owner', icon: UserCheck },
    { key: 'changePriority', label: 'Change Priority', icon: Flag },
    { divider: true },
    { header: 'Documents' },
    { key: 'generatePdf', label: 'Generate PDF', icon: FileDown },
    { key: 'export', label: 'Export', icon: Download, submenu: DOCUMENT_EXPORT_ITEMS },
    { key: 'duplicate', label: 'Duplicate', icon: Copy },
    { divider: true },
    { header: 'Conversion' },
    { key: 'createCpr', label: 'Create CPR', icon: ClipboardList },
    { divider: true },
    { header: 'Status' },
    { key: 'archive', label: 'Archive', icon: Archive },
    { key: 'delete', label: 'Delete', icon: Trash2, danger: true }
  ];
}

function CardActionsMenu({ lead, anchorEl, onClose, onAction }) {
  const [submenu, setSubmenu] = useState(null);
  const [pos, setPos] = useState(() => {
    const rect = anchorEl.getBoundingClientRect();
    return {
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
      maxHeight: Math.max(180, Math.min(MENU_MAX_HEIGHT, window.innerHeight - rect.bottom - 12))
    };
  });
  const menuRef = useRef(null);

  const canFitRight = pos.left + MENU_WIDTH * 2 + 12 <= window.innerWidth;
  const submenuPos = {
    top: pos.top,
    left: canFitRight ? pos.left + MENU_WIDTH + 4 : Math.max(8, pos.left - MENU_WIDTH - 4)
  };

  useEffect(() => {
    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
        maxHeight: Math.max(180, Math.min(MENU_MAX_HEIGHT, window.innerHeight - rect.bottom - 12))
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorEl]);

  useClickOutside(menuRef, onClose, true);

  return createPortal(
    <div
      ref={menuRef}
      style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
      className="fixed z-[70] w-[190px] bg-surface border border-slate-200 rounded-lg shadow-lg py-1 font-medium text-left overflow-x-hidden overflow-y-auto overscroll-contain"
    >
      {buildMenuActions().map((action, index) => {
        if (action.divider) {
          return <div key={`divider-${index}`} className="my-0.5 border-t border-slate-100" />;
        }
        if (action.header) {
          return (
            <div
              key={`header-${index}`}
              className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none"
            >
              {action.header}
            </div>
          );
        }
        const Icon = action.icon;
        if (action.comingSoon) {
          return (
            <button
              key={action.key}
              type="button"
              disabled
              title="Coming Soon"
              className="w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-slate-300 cursor-not-allowed select-none"
            >
              <Icon className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span className="flex-1">{action.label}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300 bg-slate-100 rounded-full px-1.5 py-0.5">Soon</span>
            </button>
          );
        }
        if (action.submenu) {
          return (
            <div key={action.key} className="relative">
              <button
                type="button"
                onClick={() => setSubmenu(submenu === action.submenu ? null : action.submenu)}
                className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 flex items-center gap-2 transition-colors ${
                  action.danger ? 'text-rose-600' : 'text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="flex-1">{action.label}</span>
                <ChevronRight
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${submenu === action.submenu ? 'rotate-90' : ''}`}
                />
              </button>
              {submenu === action.submenu && (
                <div
                  style={{ top: submenuPos.top, left: submenuPos.left, maxHeight: pos.maxHeight }}
                  className="fixed z-[71] w-[190px] bg-surface border border-slate-200 rounded-lg shadow-lg py-1 font-medium text-left overflow-x-hidden overflow-y-auto overscroll-contain"
                >
                  {action.submenu.map((item) => {
                    const SubIcon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onAction(item.key, lead)}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 flex items-center gap-2 transition-colors text-slate-700"
                      >
                        {SubIcon && <SubIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        <span className="flex-1">
                          <span className="block text-xs font-semibold">{item.label}</span>
                          {item.hint && (
                            <span className="block text-[10px] text-slate-400 font-normal">{item.hint}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }
        return (
          <button
            key={action.key}
            type="button"
            onClick={() => onAction(action.key, lead)}
            className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 flex items-center gap-2 transition-colors ${
              action.danger ? 'text-rose-600' : 'text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {action.label}
          </button>
        );
      })}
    </div>,
    document.body
  );
}

export default function LeadPipeline() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    leads,
    loading,
    error,
    filters,
    setSearch,
    setFilter,
    resetFilters,
    refresh,
    archiveLead,
    deleteLead,
    assignOwner,
    changeStage,
    changePriority,
    duplicateLead
  } = useLeads({ pageSize: 500 });

  const [searchInput, setSearchInput] = useState('');
  const [menuState, setMenuState] = useState({ id: null, anchor: null });
  const [ownerModal, setOwnerModal] = useState(null);
  const [stageModal, setStageModal] = useState(null);
  const [priorityModal, setPriorityModal] = useState(null);
  const [noteModal, setNoteModal] = useState(null);
  const [attachmentModal, setAttachmentModal] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(debouncedSearch), 0);
    return () => clearTimeout(timer);
  }, [debouncedSearch, setSearch]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.owner).filter(Boolean))).sort(),
    [leads]
  );

  const hasActiveFilters = Object.keys(filters).length > 0 || Boolean(searchInput);

  const handleClear = () => {
    resetFilters();
    setSearchInput('');
  };

  const handleBackToList = () => {
    handleClear();
    navigate('/leads');
  };

  const handleMenuToggle = (e, lead) => {
    e.stopPropagation();
    if (menuState.id === lead.id) {
      setMenuState({ id: null, anchor: null });
    } else {
      setMenuState({ id: lead.id, anchor: e.currentTarget });
    }
  };

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

  const handleDuplicate = useCallback(
    async (lead) => {
      const result = await duplicateLead(lead.id);
      if (result.ok) toast.success(`${lead.name} duplicated`);
      else toast.error(result.error?.message || 'Duplicate failed');
    },
    [duplicateLead, toast]
  );

  const handleMenuAction = useCallback(
    (actionKey, lead) => {
      setMenuState({ id: null, anchor: null });
      switch (actionKey) {
        case 'view':
          navigate(`/leads/${lead.id}`);
          break;
        case 'edit':
          navigate(`/leads/${lead.id}/edit`);
          break;
        case 'addFollowUp':
          navigate(`/followups/new?leadId=${lead.id}`);
          break;
        case 'sendEmail':
          sendEmail(lead);
          break;
        case 'addNote':
          setNoteModal(lead);
          break;
        case 'uploadAttachment':
          setAttachmentModal(lead);
          break;
        case 'moveStage':
          setStageModal(lead);
          break;
        case 'assignOwner':
          setOwnerModal(lead);
          break;
        case 'changePriority':
          setPriorityModal(lead);
          break;
        case 'generatePdf':
          handleGeneratePdf(lead);
          break;
        case 'duplicate':
          handleDuplicate(lead);
          break;
        case 'createCpr':
          navigate('/cprs/new', { state: { lead } });
          break;
        case 'archive':
          setConfirmState({ type: 'archive', lead });
          break;
        case 'delete':
          setConfirmState({ type: 'delete', lead });
          break;
        default:
          if (actionKey.startsWith('export:')) {
            handleSingleExport(lead, actionKey.slice('export:'.length));
          }
          break;
      }
    },
    [navigate, handleDuplicate, handleGeneratePdf, handleSingleExport]
  );

  const handleAssignOwner = async (owner) => {
    if (!ownerModal) return false;
    const result = await assignOwner(ownerModal.id, owner);
    if (result.ok) {
      toast.success(`Owner assigned to ${ownerModal.name}`);
      setOwnerModal(null);
      refresh();
      return true;
    }
    toast.error(result.error?.message || 'Failed to assign owner');
    return false;
  };

  const handleChangeStage = async (stage) => {
    if (!stageModal) return false;
    const result = await changeStage(stageModal.id, stage);
    if (result.ok) {
      toast.success(`Stage changed to ${stage} for ${stageModal.name}`);
      setStageModal(null);
      refresh();
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
      refresh();
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
      refresh();
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
      refresh();
      return true;
    } catch (err) {
      toast.error(err?.message || 'Failed to upload attachment');
      return false;
    }
  };

  const executeConfirm = async () => {
    if (!confirmState) return;
    const { type, lead } = confirmState;
    setConfirmState((prev) => ({ ...prev, loading: true }));
    const result = type === 'archive' ? await archiveLead(lead.id) : await deleteLead(lead.id);
    if (result.ok) {
      toast.success(type === 'archive' ? 'Lead archived successfully' : 'Lead moved to Deleted');
      setConfirmState(null);
      refresh();
    } else {
      toast.error(result.error?.message || 'Operation failed');
      setConfirmState((prev) => ({ ...prev, loading: false }));
    }
  };

  const confirmConfig = confirmState
    ? confirmState.type === 'archive'
      ? {
          title: 'Archive Lead',
          icon: Archive,
          variant: 'warning',
          confirmLabel: 'Archive',
          message: `Archive "${confirmState.lead.name}"? Archived leads can be restored anytime.`
        }
      : {
          title: 'Delete Lead',
          icon: Trash2,
          variant: 'danger',
          confirmLabel: 'Delete',
          message: `Move "${confirmState.lead.name}" to Deleted? The lead can be restored anytime.`
        }
    : null;

  const columns = useMemo(() => {
    const buckets = new Map(STAGES.map((stage) => [stage.value, []]));
    let unknown = [];
    for (const lead of leads) {
      const stage = lead.stage || 'New';
      if (buckets.has(stage)) buckets.get(stage).push(lead);
      else unknown.push(lead);
    }
    return STAGES.map((stage) => ({ key: stage.value, label: stage.label, leads: buckets.get(stage.value) || [] }))
      .concat(unknown.length ? [{ key: 'Other', label: 'Other', leads: unknown }] : []);
  }, [leads]);

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">

      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
        <span>VISHAK TECH</span>
        <span>&gt;</span>
        <span>CRM</span>
        <span>&gt;</span>
        <span>Leads</span>
        <span>&gt;</span>
        <span className="text-slate-600">Pipeline</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lead Pipeline</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Visualize and manage leads across every pipeline stage.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => navigate('/followups')}
            className="flex items-center gap-2 bg-surface border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-sm cursor-pointer select-none"
          >
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Calendar</span>
          </button>
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 bg-surface border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-sm cursor-pointer select-none"
          >
            <ChevronLeft className="w-4 h-4 text-slate-400" />
            <span>Back to List</span>
          </button>
        </div>
      </div>

      <div className="bg-surface border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row items-center justify-between gap-3 mb-4 shadow-sm">
        <div className="flex-1 w-full relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search Pipeline by Lead No, Name, Phone, Email..."
            className="w-full bg-slate-50 border border-slate-200/80 rounded-lg pl-10 pr-9 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-blue-500/60 focus:bg-surface transition-all shadow-inner"
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
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end select-none flex-wrap">
          <div className="space-y-1">
            <select
              value={filters.stage || ''}
              onChange={(e) => setFilter('stage', e.target.value)}
              className="w-full lg:w-auto bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500/60 cursor-pointer"
              aria-label="Priority filter"
            >
              <option value="">All Priorities</option>
              {STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>{stage.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <select
              value={filters.owner || ''}
              onChange={(e) => setFilter('owner', e.target.value)}
              className="w-full lg:w-auto bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500/60 cursor-pointer"
              aria-label="Owner filter"
            >
              <option value="">All Owners</option>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleClear}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
              hasActiveFilters
                ? 'bg-[#2563eb] text-white border-[#2563eb] hover:bg-[#1d4ed8]'
                : 'bg-surface border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            disabled={!hasActiveFilters}
          >
            <Filter className="w-3.5 h-3.5" /> <span>Clear Filters</span>
            {hasActiveFilters && (
              <span className="bg-white/20 text-[10px] px-1.5 rounded-full">{Object.keys(filters).length + (searchInput ? 1 : 0)}</span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Unable to load pipeline data{error?.message ? ` (${error.message})` : ''}.</span>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {columns.map((col) => (
            <div key={col.key} className={COLUMN_STYLE}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STAGE_BADGES[col.key] || STAGE_BADGE_FALLBACK}`}>
                    {col.label}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">{col.leads.length}</span>
                </div>
              </div>
              <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[70vh]">
                {col.leads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 rounded-lg py-8 text-center">
                    <Inbox className="w-4 h-4 text-slate-300" />
                    <span className="text-[10px] font-semibold text-slate-400">No leads</span>
                  </div>
                ) : (
                  col.leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="relative w-full bg-surface border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className="block w-full text-left"
                        title="View lead details"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5 pr-7">
                          <span className="font-mono text-[10px] font-semibold text-slate-500">{lead.leadNo || `#${String(lead.id).padStart(4, '0')}`}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${STAGE_BADGES[lead.stage] || STAGE_BADGE_FALLBACK}`}>
                            {lead.stage}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 text-xs truncate pr-5">{lead.name || '—'}</div>
                        <div className="text-[10px] text-slate-400 font-medium truncate mb-2 pr-5">{lead.businessName || lead.company || '—'}</div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-800">
                            <IndianRupee className="w-3 h-3 text-slate-400" />
                            {formatINR(lead.value)}
                          </span>
                          {lead.owner && (
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[8px] shrink-0 ${avatarColor(lead.owner)}`}>
                                {getInitials(lead.owner)}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium truncate max-w-[90px]">{lead.owner}</span>
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => handleMenuToggle(e, lead)}
                        className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        aria-label={`Actions for ${lead.name || lead.leadNo || 'this lead'}`}
                        title="Lead actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuState.id === lead.id && menuState.anchor && (
                        <CardActionsMenu
                          lead={lead}
                          anchorEl={menuState.anchor}
                          onClose={() => setMenuState({ id: null, anchor: null })}
                          onAction={handleMenuAction}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmLabel={confirmConfig?.confirmLabel}
        variant={confirmConfig?.variant}
        icon={confirmConfig?.icon}
        loading={confirmState?.loading || false}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState(null)}
      />

      <AssignOwnerModal
        key={ownerModal?.id ?? 'owner-modal-closed'}
        open={ownerModal !== null}
        lead={ownerModal}
        onClose={() => setOwnerModal(null)}
        onSubmit={handleAssignOwner}
      />

      <ChangeStageModal
        key={stageModal?.id ?? 'stage-modal-closed'}
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

    </div>
  );
}
