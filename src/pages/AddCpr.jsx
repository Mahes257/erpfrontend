import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Calculator, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, ClipboardSignature,
  FileText, Info, Plus, Save, Send, UserPlus, Users, X
} from 'lucide-react';
import CprForm, { CprSidebar } from '../components/CprForm';
import { useToast } from '../components/Common';
import cprService from '../services/cprService';
import { serializeCpr } from '../utils/cprHelpers';

// ERP _updateAutosaveIndicator: 'just now' | 'N min ago' | 'Nh ago'.
function relativeTimeLabel(iso) {
  const minAgo = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minAgo < 1) return 'just now';
  if (minAgo < 60) return `${minAgo} min ago`;
  return `${Math.floor(minAgo / 60)}h ago`;
}

const WORKFLOW = [
  { label: 'Lead', icon: UserPlus, state: 'done' },
  { label: 'Client', icon: Users, state: 'done' },
  { label: 'CPR', icon: ClipboardList, state: 'active' },
  { label: 'Cost Workout', icon: Calculator, state: 'pending' },
  { label: 'Quotation', icon: FileText, state: 'pending' },
  { label: 'Sales Order', icon: ClipboardSignature, state: 'pending' }
];

const INITIAL_FORM = {
  prNo: '',
  prDate: new Date().toISOString().split('T')[0],
  department: '',
  requestedBy: '',
  requiredDate: '',
  priority: '',
  status: 'Draft',
  sourceLead: '',
  sourceType: '',
  sourceId: '',
  clientName: '',
  contactPerson: '',
  phone: '',
  email: '',
  company: '',
  gst: '',
  project: '',
  leadNo: '',
  pan: '',
  vendor: '',
  billingAddress: '',
  shippingAddress: '',
  remarks: '',
  description: '',
  costWorkout: '',
  profitPercent: ''
};

/**
 * Lead → CPR frontend prefill (mirrors the source CRM): when the Follow-up
 * form (or any caller) navigates here with `state: { lead }`, the lead's
 * details auto-fill the required CPR fields. Clients are WON-stage leads in
 * the backend, so the same mapping covers both entry points.
 *
 * Mapping note: the "Lead / Client" combobox shows the DISPLAY NAME only
 * (company/business name), never the lead number — the number belongs
 * exclusively in the "Lead No" field (mirrors leadService.convertToCpr).
 */
function buildCprPrefill(lead) {
  if (!lead) return undefined;
  const company = lead.company || lead.businessName || lead.name || '';
  return {
    sourceLead: company,
    leadNo: lead.leadNo || '',
    clientName: company,
    company,
    contactPerson: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    gst: lead.taxId || ''
  };
}

function WorkflowStepper() {
  return (
    <div className="flex items-center justify-center flex-wrap gap-1 px-4 py-3 bg-surface border border-slate-200 rounded-xl shadow-sm mb-5">
      {WORKFLOW.map((step, index) => (
        <span key={step.label} className="flex items-center">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${
              step.state === 'active'
                ? 'bg-[#032f25] text-white'
                : step.state === 'done'
                  ? 'text-emerald-700'
                  : 'text-slate-400'
            }`}
          >
            <step.icon className="w-3 h-3" />
            {step.label}
          </span>
          {index < WORKFLOW.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 mx-0.5" />}
        </span>
      ))}
    </div>
  );
}

export default function AddCpr() {
  const navigate = useNavigate();
  const location = useLocation();
  const lead = location.state?.lead;
  const prefill = useMemo(() => buildCprPrefill(lead), [lead]);
  const toast = useToast();
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM, ...prefill }));
  const [items, setItems] = useState([]);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const gridRef = useRef(null);
  // Tracks the id of the record created by a previous Save Draft so subsequent
  // saves update the same CPR (mirrors the ERP's editingId after save('draft')).
  const savedIdRef = useRef(null);
  // ERP _dirty flag: set by user input, consumed by the 30s autosave timer.
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const saveCprRef = useRef(null);
  const [autosavedAt, setAutosavedAt] = useState(null);
  // Ticks every 15s so the autosave indicator shows an accurate relative time
  // (mirrors the ERP's _indicatorTimer).
  const [, setTick] = useState(0);

  const setField = (key, value) => {
    dirtyRef.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Wraps setItems so grid edits mark the form dirty (ERP input listener).
  const handleSetItems = (updater) => {
    dirtyRef.current = true;
    setItems(updater);
  };

  const uploadQueued = async (cprId) => {
    if (files.length === 0) return 0;
    const results = await cprService.uploadMany(cprId, files, {});
    const ok = results.filter((r) => r.ok).length;
    const failed = results.length - ok;
    if (ok > 0) toast.success(`${ok} attachment(s) uploaded to ${cprId}`);
    if (failed > 0) toast.error(`${failed} attachment(s) failed to upload`);
    // Uploaded files are now persisted on the server; clear the queue so a
    // follow-up Save Draft / Submit does not re-upload duplicates.
    setFiles([]);
    return ok;
  };

  useEffect(() => {
    let cancelled = false;
    cprService
      .getNextNumber()
      .then((res) => {
        if (!cancelled && res?.data?.prNo) {
          setForm((prev) => ({ ...prev, prNo: res.data.prNo }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ERP _startAutoSave: while the form is dirty and nothing is saving, persist a
  // draft every 30 seconds (visible via the footer autosave indicator).
  useEffect(() => {
    const timer = setInterval(() => {
      if (dirtyRef.current && !savingRef.current) {
        saveCprRef.current({ draft: true });
      }
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // ERP _indicatorTimer: refresh the "Draft saved X min ago" label every 15s.
  useEffect(() => {
    const timer = setInterval(() => setTick((x) => x + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  // Mirrors the ERP's validate(): prNo, department, requester, date, priority,
  // required date, a real source selection, date ordering, and per-item rules.
  const validate = () => {
    const fieldErrors = {};
    const messages = [];

    if (!form.prNo) { fieldErrors.prNo = 'CPR Number is required'; messages.push('CPR Number is required'); }
    if (!form.department) { fieldErrors.department = 'Department is required'; messages.push('Department is required'); }
    if (!form.requestedBy) { fieldErrors.requestedBy = 'Requester is required'; messages.push('Requester is required'); }
    if (!form.prDate) { fieldErrors.prDate = 'Date is required'; messages.push('Date is required'); }
    if (!form.requiredDate) { fieldErrors.requiredDate = 'Required date is required'; messages.push('Required date is required'); }
    if (!form.priority) { fieldErrors.priority = 'Priority is required'; messages.push('Priority is required'); }

    // The ERP requires a real Lead/Client selection (stored id), not free text.
    const hasSource = Boolean(form.sourceType && form.sourceId);
    if (!hasSource) {
      fieldErrors.sourceLead = 'Please select a Lead or Client';
      messages.push('Please select a Lead or Client');
    }

    if (form.prDate && form.requiredDate && new Date(form.requiredDate) < new Date(form.prDate)) {
      fieldErrors.requiredDate = 'Required date cannot be before the PR date';
      messages.push('Required date cannot be before the PR date');
    }

    if (items.length === 0) {
      messages.push('Please add at least one item');
    }

    setErrors(fieldErrors);
    if (messages.length > 0) {
      toast.warning(messages.join('; '));
      return false;
    }

    // Per-item validation handled by the grid (highlights + warning toast).
    // Only reached when there are no header/field errors, so no double toast.
    const gridRes = gridRef.current?.validate?.();
    if (gridRes && !gridRes.valid) return false;
    return true;
  };

  const resetForm = async () => {
    setForm({ ...INITIAL_FORM, prDate: new Date().toISOString().split('T')[0] });
    setItems([]);
    setFiles([]);
    setErrors({});
    savedIdRef.current = null;
    dirtyRef.current = false;
    setAutosavedAt(null);
    gridRef.current?.clearErrors?.();
    const next = await cprService.getNextNumber();
    if (next?.data?.prNo) setForm((prev) => ({ ...prev, prNo: next.data.prNo }));
  };

  const saveCpr = async ({ draft = false, submit = false, stay = false } = {}) => {
    // Save Draft skips validation entirely (mirrors the ERP save('draft')).
    if (!draft && !validate()) return;
    savingRef.current = true;
    setSaving(true);
    try {
      // Always create/update with a Draft status; the submit transition is
      // applied via the submit endpoint (which records who/when).
      const payload = { ...serializeCpr(form, items), status: 'draft' };
      const existingId = savedIdRef.current;
      const res = existingId
        ? await cprService.updateCpr(existingId, payload)
        : await cprService.createCpr(payload, draft);
      const created = res?.data ?? {};
      const id = created?.id || existingId;
      if (id) savedIdRef.current = id;
      if (submit && id) {
        await cprService.submitCpr(id);
      }
      await uploadQueued(id);

      if (draft) {
        // ERP save('draft'): 'Draft saved' (info) + footer autosave indicator.
        dirtyRef.current = false;
        setAutosavedAt(new Date());
        toast.info('Draft saved');
        return;
      }

      dirtyRef.current = false;
      setAutosavedAt(null);
      toast.success(
        submit
          ? `${created.prNo || form.prNo} submitted for approval`
          : `${created.prNo || form.prNo} saved successfully`
      );
      if (stay) {
        // Save & New: fresh form (ERP reloads the page).
        await resetForm();
      } else {
        // Save / Submit: return to the CPR list (ERP navigates to pr-list.html).
        navigate('/cprs');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to save CPR');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  // Keep the autosave timer on the latest saveCpr closure (runs every render).
  useEffect(() => {
    saveCprRef.current = saveCpr;
  });

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">

      {/* ===== BREADCRUMB ===== */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
        <span>VISHAK TECH</span>
        <span>&gt;</span>
        <span>Sales</span>
        <span>&gt;</span>
        <span>Customer Purchase Request</span>
        <span>&gt;</span>
        <span className="text-slate-600">New CPR</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-[#0B4A3D]" />
            Create Purchase Request
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-300" />
            Fields marked with <span className="text-rose-500">*</span> are required
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/cprs')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer select-none w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" /> Back to List
        </button>
      </div>

      {/* ===== WORKFLOW ===== */}
      <WorkflowStepper />

      {/* ===== TWO-COLUMN FORM GRID ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 min-w-0">
          <CprForm form={form} setField={setField} items={items} setItems={handleSetItems} gridRef={gridRef} errors={errors} />
        </div>
        <div className="min-w-0">
          <CprSidebar form={form} items={items} files={files} onFilesChange={setFiles} />
        </div>
      </div>

      {/* ===== STICKY FOOTER ===== */}
      <div className="sticky bottom-0 z-30 bg-surface border-t-2 border-slate-200 px-4 sm:px-6 py-3 mt-6 flex flex-wrap items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] rounded-t-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/cprs')}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-slate-400" /> Cancel
          </button>
          <button
            type="button"
            onClick={() => saveCpr({ draft: true })}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-slate-400" /> Save Draft
          </button>
          {autosavedAt && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#6b7280] whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3 text-[#059669]" />
              Draft saved {relativeTimeLabel(autosavedAt)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => saveCpr({ stay: true })}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" /> Save &amp; New
          </button>
          <button
            type="button"
            onClick={() => saveCpr({})}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#032f25] hover:bg-[#054133] px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button
            type="button"
            onClick={() => saveCpr({ submit: true })}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> Submit for Approval
          </button>
        </div>
      </div>

    </div>
  );
}
