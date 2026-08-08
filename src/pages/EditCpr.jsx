import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calculator, ChevronLeft, ChevronRight, ClipboardList, ClipboardSignature,
  FileText, Info, Save, UserPlus, Users, X
} from 'lucide-react';
import CprForm, { CprSidebar } from '../components/CprForm';
import { useToast } from '../components/Common';
import cprService from '../services/cprService';
import { cprToForm, serializeCpr } from '../utils/cprHelpers';

const WORKFLOW = [
  { label: 'Lead', icon: UserPlus, state: 'done' },
  { label: 'Client', icon: Users, state: 'done' },
  { label: 'CPR', icon: ClipboardList, state: 'active' },
  { label: 'Cost Workout', icon: Calculator, state: 'pending' },
  { label: 'Quotation', icon: FileText, state: 'pending' },
  { label: 'Sales Order', icon: ClipboardSignature, state: 'pending' }
];

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

export default function EditCpr() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [items, setItems] = useState([]);
  const [files, setFiles] = useState([]);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const gridRef = useRef(null);
  // Preserve the stored backend status across edits (the ERP resets the status
  // combobox to Draft/Submitted on edit, which would demote approved/rejected
  // records — keep the original instead).
  const loadedStatusRef = useRef('draft');

  useEffect(() => {
    let cancelled = false;
    cprService
      .getCpr(id)
      .then((res) => {
        if (cancelled) return;
        const cpr = res?.data ?? res ?? {};
        loadedStatusRef.current = cpr.status || 'draft';
        setRecord(cpr);
        setForm(cprToForm(cpr));
        setItems((cpr.items || []).map((item) => ({ ...item })));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err?.message || 'Failed to load CPR');
        navigate('/cprs');
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate, toast]);

  const uploadQueued = async (cprId) => {
    if (files.length === 0) return 0;
    const results = await cprService.uploadMany(cprId, files, {});
    const ok = results.filter((r) => r.ok).length;
    const failed = results.length - ok;
    if (ok > 0) toast.success(`${ok} attachment(s) uploaded`);
    if (failed > 0) toast.error(`${failed} attachment(s) failed to upload`);
    setFiles([]);
    return ok;
  };

  const setField = (key, value) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Mirrors the ERP's validate() with one adaptation: on edit the backend
  // returns the source name (sourceLead) but not the stored source id, so a
  // restored name (or the client name) satisfies the source requirement.
  const validate = () => {
    const fieldErrors = {};
    const messages = [];
    if (!form.prNo) { fieldErrors.prNo = 'CPR Number is required'; messages.push('CPR Number is required'); }
    if (!form.department) { fieldErrors.department = 'Department is required'; messages.push('Department is required'); }
    if (!form.requestedBy) { fieldErrors.requestedBy = 'Requester is required'; messages.push('Requester is required'); }
    if (!form.prDate) { fieldErrors.prDate = 'Date is required'; messages.push('Date is required'); }
    if (!form.requiredDate) { fieldErrors.requiredDate = 'Required date is required'; messages.push('Required date is required'); }
    if (!form.priority) { fieldErrors.priority = 'Priority is required'; messages.push('Priority is required'); }
    if (!form.sourceLead && !form.clientName) {
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
    const gridRes = gridRef.current?.validate?.();
    if (gridRes && !gridRes.valid) return false;
    return true;
  };

  const saveCpr = async () => {
    if (!form) return;
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...serializeCpr(form, items), status: loadedStatusRef.current };
      const res = await cprService.updateCpr(id, payload);
      const updated = res?.data ?? {};
      await uploadQueued(id);
      toast.success(`${updated.prNo || form.prNo} updated successfully`);
      navigate(`/cprs/${id}`);
    } catch (err) {
      toast.error(err?.message || 'Failed to update CPR');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
          <span>VISHAK TECH</span>
          <span>&gt;</span>
          <span>Sales</span>
          <span>&gt;</span>
          <span>Customer Purchase Request</span>
          <span>&gt;</span>
          <span className="text-slate-600">Edit CPR</span>
        </div>
        <div className="flex items-center justify-center py-24">
          <div className="h-4 w-4 rounded-full border-2 border-slate-200 border-t-[#0B4A3D] animate-spin" />
        </div>
      </div>
    );
  }

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
        <span className="text-slate-600">Edit CPR</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-[#0B4A3D]" />
            Edit Purchase Request
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-300" />
            Updating <span className="font-semibold text-slate-500">{form.prNo}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/cprs/${id}`)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer select-none w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" /> Back to CPR
        </button>
      </div>

      {/* ===== WORKFLOW ===== */}
      <WorkflowStepper />

      {/* ===== TWO-COLUMN FORM GRID ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 min-w-0">
          <CprForm form={form} setField={setField} items={items} setItems={setItems} gridRef={gridRef} errors={errors} />
        </div>
        <div className="min-w-0">
          <CprSidebar form={form} items={items} files={files} onFilesChange={setFiles} record={record} />
        </div>
      </div>

      {/* ===== STICKY FOOTER ===== */}
      <div className="sticky bottom-0 z-30 bg-surface border-t-2 border-slate-200 px-4 sm:px-6 py-3 mt-6 flex flex-wrap items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] rounded-t-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/cprs/${id}`)}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-slate-400" /> Cancel
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={saveCpr}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#032f25] hover:bg-[#054133] px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Save Changes
          </button>
        </div>
      </div>

    </div>
  );
}
