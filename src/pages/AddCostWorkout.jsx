import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  ChevronLeft,
  Layers,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  X
} from 'lucide-react';
import { ConfirmDialog, EditableMasterDropdown, useToast } from '../components/Common';
import CwSidebar from '../components/CostWorkout/CwSidebar';
import useClickOutside from '../hooks/useClickOutside';
import costWorkoutService from '../services/costWorkoutService';
import leadService from '../services/leadService';
import cprService from '../services/cprService';
import { normalizeCpr } from '../utils/cprHelpers';
import { normalizeCw, serializeCw, cwToForm, calcCwTotals, isLeadTimeCategory } from '../utils/costWorkoutHelpers';
import { CW_FORM_STATUSES, CW_SYSTEM_CATEGORIES } from '../utils/costWorkoutConstants';
import { formatINR, todayISO } from '../utils/leadHelpers';

const WORKFLOW_STEPS = [
  { label: 'Lead', icon: 'user-plus' },
  { label: 'Client', icon: 'user-tie' },
  { label: 'CPR', icon: 'clipboard-list' },
  { label: 'Cost Workout', icon: 'calculator', active: true },
  { label: 'Quotation', icon: 'file-invoice' },
  { label: 'Sales Order', icon: 'file-signature' }
];

const WfIcon = {
  'user-plus': '👤',
  'user-tie': '🤝',
  'clipboard-list': '📋',
  calculator: '🧮',
  'file-invoice': '📄',
  'file-signature': '✍️'
};

let itemIdCounter = 100;
let catIdCounter = 1000;

function newItem(description = '', categories = null) {
  itemIdCounter += 1;
  return {
    key: itemIdCounter,
    description,
    qty: 1,
    unit: 'Nos',
    categories: categories || [{ key: (catIdCounter += 1), category: 'Material Cost', qty: 1, unit: 'Nos', rate: 0, notes: '' }]
  };
}

function newCategoryRow(category = 'Material Cost') {
  catIdCounter += 1;
  return { key: catIdCounter, category, qty: 1, unit: 'Nos', rate: 0, notes: '' };
}

function parsePageList(response) {
  if (Array.isArray(response)) return response;
  if (response?.content) return response.content;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

export default function AddCostWorkout() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const cprParam = searchParams.get('cpr');
  const editing = Boolean(id);
  const toast = useToast();

  const [form, setForm] = useState({
    cwNo: '',
    cwDate: todayISO(),
    status: 'draft',
    preparedBy: '',
    contactPerson: '',
    department: '',
    sourceLead: '',
    customerName: '',
    cprRef: '',
    cprId: '',
    phone: '',
    email: '',
    company: '',
    gst: '',
    pan: '',
    linkedCpr: '',
    billingAddress: '',
    shippingAddress: '',
    remarks: '',
    profitPct: '0',
    discountPct: '0',
    gstPct: '18',
    attachments: []
  });
  const [items, setItems] = useState(() => [newItem()]);
  const [leadSources, setLeadSources] = useState([]);
  const [clientSources, setClientSources] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [timeline, setTimeline] = useState([]);
  const [autosaveText, setAutosaveText] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [record, setRecord] = useState(null);

  // Source combobox state
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceHighlight, setSourceHighlight] = useState(-1);
  const [sourceSelected, setSourceSelected] = useState(null);
  const sourceWrapRef = useRef(null);

  const savedIdRef = useRef(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const formRef = useRef(form);
  const itemsRef = useRef(items);
  const timelineInitRef = useRef(false);

  const sourceItems = useMemo(() => {
    const leads = leadSources.map((l) => ({
      type: 'lead',
      id: l.id,
      code: l.leadNo || l.id,
      name: l.company || l.businessName || l.name || l.customerName || '',
      data: l,
      searchText: `${l.company || ''} ${l.businessName || ''} ${l.name || ''} ${l.leadNo || ''} ${l.id || ''}`.toLowerCase()
    }));
    const clients = clientSources.map((c) => ({
      type: 'client',
      id: c.id,
      code: c.clientCode || c.leadNo || c.id,
      name: c.businessName || c.companyName || c.clientName || c.name || '',
      data: c,
      searchText: `${c.businessName || ''} ${c.companyName || ''} ${c.clientName || ''} ${c.name || ''} ${c.clientCode || c.leadNo || ''} ${c.id || ''}`.toLowerCase()
    }));
    return [...leads, ...clients];
  }, [leadSources, clientSources]);

  const sourceFiltered = useMemo(() => {
    const q = sourceQuery.trim().toLowerCase();
    if (!q) return sourceItems;
    return sourceItems.filter((i) => i.searchText.includes(q));
  }, [sourceItems, sourceQuery]);

  useClickOutside(sourceWrapRef, () => setSourceOpen(false), sourceOpen);

  const markDirty = () => {
    dirtyRef.current = true;
    setAutosaveText('Unsaved changes');
  };

  const clearDirty = () => {
    dirtyRef.current = false;
    setAutosaveText('');
  };

  const addTimeline = (action, detail) => {
    const now = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    setTimeline((prev) => [{ action, detail, time: now }, ...prev]);
  };

  const setField = (key, value, dirty = true) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (dirty) markDirty();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [leadsRes, clientsRes] = await Promise.all([
          leadService.listLeads({ page: 0, size: 200 }),
          leadService.listClients({ page: 0, size: 200 })
        ]);
        if (cancelled) return;
        setLeadSources(parsePageList(leadsRes));
        setClientSources(parsePageList(clientsRes));
      } catch {
        // lookups are optional; the form still works with manual entry
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (editing) {
        setLoading(true);
        try {
          const res = await costWorkoutService.getCw(id);
          if (cancelled) return;
          const data = normalizeCw(res?.data ?? res);
          setRecord(data);
          const f = cwToForm(data);
          setForm(f);
          const itemsList = (Array.isArray(data.items) ? data.items : []).map((it) => {
            itemIdCounter += 1;
            return {
              key: itemIdCounter,
              description: it.description || '',
              qty: it.qty ?? 1,
              unit: it.unit || 'Nos',
              categories: (Array.isArray(it.categories) ? it.categories : []).map((c) => ({
                key: (catIdCounter += 1),
                category: c.category || 'Material Cost',
                qty: c.qty ?? 1,
                unit: c.unit || 'Nos',
                rate: c.rate ?? 0,
                notes: c.notes || ''
              }))
            };
          });
          setItems(itemsList.length > 0 ? itemsList : [newItem()]);
          try {
            const attRes = await costWorkoutService.getAttachments(id);
            if (!cancelled && Array.isArray(attRes)) {
              setForm((prev) => ({ ...prev, attachments: attRes }));
            }
          } catch {
            // attachments optional
          }
        } catch (err) {
          toast.error(err?.message || 'Failed to load Cost Workout');
          navigate('/cost-workouts');
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        try {
          const res = await costWorkoutService.getNextNumber();
          if (cancelled) return;
          const data = res?.data ?? res ?? {};
          setForm((prev) => ({ ...prev, cwNo: data.cwNo || prev.cwNo }));
        } catch {
          // number can be entered manually
        }
        if (cprParam) {
          try {
            const cprRes = await cprService.getCpr(cprParam);
            if (cancelled) return;
            const cpr = normalizeCpr(cprRes?.data ?? cprRes ?? {});
            setForm((prev) => ({
              ...prev,
              cprRef: cpr.prNo || prev.cprRef,
              linkedCpr: cpr.prNo || prev.linkedCpr,
              cprId: cpr.id != null ? String(cpr.id) : prev.cprId,
              customerName: cpr.clientName || cpr.client || prev.customerName,
              contactPerson: cpr.contactPerson || prev.contactPerson,
              phone: cpr.phone || prev.phone,
              email: cpr.email || prev.email,
              company: cpr.company || prev.company,
              gst: cpr.gst || prev.gst,
              pan: cpr.pan || prev.pan,
              billingAddress: cpr.billingAddress || prev.billingAddress,
              shippingAddress: cpr.shippingAddress || prev.shippingAddress
            }));
          } catch {
            // prefill is optional; the form still works with manual entry
          }
        }
      }
      if (!timelineInitRef.current) {
        timelineInitRef.current = true;
        addTimeline('created', 'Form opened');
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [editing, id, navigate, toast, cprParam]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // 30-second auto-save after the first manual save (matches ERP CWCreate._autoSave)
  useEffect(() => {
    const timer = setInterval(() => {
      if (savingRef.current) return;
      if (!dirtyRef.current) return;
      const existingId = editing ? id : savedIdRef.current;
      if (!existingId) return;
      const payload = serializeCw({ ...formRef.current, status: 'draft' }, itemsRef.current);
      costWorkoutService
        .updateCw(existingId, payload)
        .then(() => {
          dirtyRef.current = false;
          setAutosaveText('');
        })
        .catch(() => {
          // keep dirty; retry next cycle
        });
    }, 30000);
    return () => clearInterval(timer);
  }, [editing, id]);

  const totals = useMemo(
    () => calcCwTotals(items, form.profitPct, form.discountPct, form.gstPct),
    [items, form.profitPct, form.discountPct, form.gstPct]
  );

  const catCount = useMemo(
    () => items.reduce((sum, item) => sum + (Array.isArray(item.categories) ? item.categories.length : 0), 0),
    [items]
  );

  // Individual category/unit cells use the backend-driven EditableMasterDropdown
  // (cw_categories / cw_units) for search, add, edit and delete. The system
  // category list still powers the "All Categories" batch action below.

  // ---- Lead / Client source combobox ----
  const autofillFromSource = (item) => {
    const d = item.data || {};
    const isClient = item.type === 'client';
    const customerName = isClient
      ? d.businessName || d.companyName || d.clientName || d.name || ''
      : d.company || d.businessName || d.name || d.customerName || '';
    const company = isClient ? d.businessName || d.companyName || '' : d.company || d.businessName || '';
    const contactPerson = d.contactPerson || d.primaryContact || d.contactName || d.title || d.name || '';
    const addr = [d.address, d.city, d.state, d.country].filter(Boolean).join(', ');
    setForm((prev) => ({
      ...prev,
      sourceLead: item.label,
      customerName,
      contactPerson,
      phone: d.phone || d.mobile || '',
      email: d.email || '',
      company,
      gst: d.gst || d.gstin || d.taxId || '',
      pan: d.pan || d.panNumber || '',
      billingAddress: addr,
      shippingAddress: addr
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.sourceLead;
      return next;
    });
    markDirty();
  };

  const selectSource = (item) => {
    const codeLabel = item.type === 'lead' ? `Lead No: ${item.code}` : `Client Code: ${item.code}`;
    const label = `${item.name} (${codeLabel})`;
    setSourceSelected({ type: item.type, id: item.id, label });
    setSourceQuery('');
    setSourceOpen(false);
    setSourceHighlight(-1);
    autofillFromSource({ ...item, label });
  };

  const clearSourceSelection = () => {
    setSourceSelected(null);
    setSourceQuery('');
    setForm((prev) => ({
      ...prev,
      sourceLead: '',
      customerName: '',
      contactPerson: '',
      phone: '',
      email: '',
      company: '',
      gst: '',
      pan: '',
      billingAddress: '',
      shippingAddress: ''
    }));
    markDirty();
  };

  const handleSourceInput = (v) => {
    setSourceQuery(v);
    if (!v && sourceSelected) clearSourceSelection();
  };

  const handleSourceKeyDown = (e) => {
    if (!sourceOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSourceOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSourceHighlight((h) => (h < sourceFiltered.length - 1 ? h + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSourceHighlight((h) => (h > 0 ? h - 1 : sourceFiltered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sourceHighlight >= 0 && sourceFiltered[sourceHighlight]) selectSource(sourceFiltered[sourceHighlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSourceOpen(false);
    }
  };

  // ---- Item grid ----
  const updateItem = (itemKey, patch) => {
    setItems((prev) => prev.map((item) => (item.key === itemKey ? { ...item, ...patch } : item)));
    markDirty();
  };

  const updateCategory = (itemKey, catKey, patch) => {
    setItems((prev) =>
      prev.map((item) =>
        item.key === itemKey
          ? { ...item, categories: item.categories.map((cat) => (cat.key === catKey ? { ...cat, ...patch } : cat)) }
          : item
      )
    );
    markDirty();
  };

  const addItem = () => {
    setItems((prev) => [...prev, newItem()]);
    markDirty();
  };

  const removeItem = (itemKey) => {
    if (items.length <= 1) {
      toast.warning('At least one item is required');
      return;
    }
    setItems((prev) => prev.filter((item) => item.key !== itemKey));
    markDirty();
  };

  const addCategory = (itemKey) => {
    setItems((prev) =>
      prev.map((item) => (item.key === itemKey ? { ...item, categories: [...item.categories, newCategoryRow()] } : item))
    );
    markDirty();
  };

  const removeCategory = (itemKey, catKey) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== itemKey) return item;
        const categories = item.categories.filter((cat) => cat.key !== catKey);
        return { ...item, categories: categories.length === 0 ? [newCategoryRow()] : categories };
      })
    );
    markDirty();
  };

  // When a category is deleted from the master list, reset any rows that still
  // reference it back to 'Material Cost' (mirrors the ERP delete behavior).
  const handleCategoryDeleted = (name) => {
    if (!name) return;
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        categories: item.categories.map((cat) =>
          cat.category === name ? { ...cat, category: 'Material Cost', unit: 'Nos' } : cat
        )
      }))
    );
    markDirty();
  };

  // ERP cwAddBatch: adds a NEW item populated with every system category
  const addBatchCategories = () => {
    const item = newItem('', CW_SYSTEM_CATEGORIES.map((name) => newCategoryRow(name)));
    setItems((prev) => [...prev, item]);
    markDirty();
  };

  const clearAllItems = () => {
    setItems([newItem()]);
    markDirty();
  };

  // ERP cwOnCategoryChange: switching to Lead Time sets unit Days & zeroes rate; away resets unit to Nos
  const handleCategoryChange = (itemKey, catKey, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== itemKey) return item;
        return {
          ...item,
          categories: item.categories.map((cat) => {
            if (cat.key !== catKey) return cat;
            const oldCat = cat.category;
            const patch = { category: value };
            if (isLeadTimeCategory(value) && !isLeadTimeCategory(oldCat)) {
              patch.unit = 'Days';
              patch.rate = 0;
            }
            if (!isLeadTimeCategory(value) && isLeadTimeCategory(oldCat)) {
              patch.unit = 'Nos';
            }
            return { ...cat, ...patch };
          })
        };
      })
    );
    markDirty();
  };

  // ---- Attachments (ERP upload zone, 10MB limit) ----
  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    const accepted = [];
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.warning(`File "${file.name}" exceeds 10MB limit`);
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) return;
    accepted.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setForm((prev) => ({
          ...prev,
          attachments: [...(prev.attachments || []), { name: file.name, size: file.size, type: file.type, data: e.target.result }]
        }));
        markDirty();
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (idx) => {
    setForm((prev) => ({ ...prev, attachments: (prev.attachments || []).filter((_, i) => i !== idx) }));
    markDirty();
  };

  // ---- Validation ----
  const validate = () => {
    const next = {};
    if (!form.cwDate) next.cwDate = 'Date is required';
    if (!form.preparedBy) next.preparedBy = 'Prepared By is required';
    if (!form.department) next.department = 'Department is required';
    if (!form.sourceLead) next.sourceLead = 'Please select a Lead or Client';
    if (form.remarks && form.remarks.length > 500) next.remarks = 'Remarks exceed maximum length of 500 characters';
    const hasContent = items.some((item) => {
      const hasCat = (Array.isArray(item.categories) ? item.categories : []).some(
        (cat) => Number(cat.qty) > 0 || Number(cat.rate) > 0 || isLeadTimeCategory(cat.category)
      );
      return Boolean(item.description) || hasCat;
    });
    if (!hasContent) next.items = 'Add at least one cost item with a description or quantity/rate';
    for (const item of items) {
      for (const cat of item.categories || []) {
        if (Number(cat.qty) < 0) {
          next.items = 'Quantity cannot be negative';
          break;
        }
        if (Number(cat.rate) < 0) {
          next.items = 'Rate cannot be negative';
          break;
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetForm = async () => {
    setForm({
      cwNo: '',
      cwDate: todayISO(),
      status: 'draft',
      preparedBy: '',
      contactPerson: '',
      department: '',
      sourceLead: '',
      customerName: '',
      cprRef: '',
      cprId: '',
      phone: '',
      email: '',
      company: '',
      gst: '',
      pan: '',
      linkedCpr: '',
      billingAddress: '',
      shippingAddress: '',
      remarks: '',
      profitPct: '0',
      discountPct: '0',
      gstPct: '18',
      attachments: []
    });
    setItems([newItem()]);
    setErrors({});
    setSourceSelected(null);
    clearDirty();
    try {
      const res = await costWorkoutService.getNextNumber();
      const data = res?.data ?? res ?? {};
      setForm((prev) => ({ ...prev, cwNo: data.cwNo || prev.cwNo }));
    } catch {
      // number can be entered manually
    }
  };

  // ---- Save semantics (matches ERP CWCreate.save / submitForApproval) ----
  const saveAs = async (action) => {
    if (action !== 'draft' && !validate()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    setSaving(true);
    savingRef.current = true;
    // Only "Save Draft" persists Draft; "Save & New", "Save" and
    // "Submit for Approval" persist Completed (Status dropdown overridden).
    const status = action === 'draft' ? 'draft' : 'completed';
    const payload = serializeCw({ ...form, status }, items);
    try {
      const existingId = editing ? id : savedIdRef.current;
      const res = existingId
        ? await costWorkoutService.updateCw(existingId, payload)
        : await costWorkoutService.createCw(payload, action === 'draft');
      const data = res?.data ?? res ?? {};
      const savedId = data.id || existingId;
      if (!existingId) savedIdRef.current = savedId;
      if (data.cwNo) setForm((prev) => ({ ...prev, cwNo: data.cwNo }));
      clearDirty();
      if (action === 'draft') {
        addTimeline('saved', 'Cost Workout saved');
        toast.success('Draft saved');
      } else if (action === 'new') {
        addTimeline('saved', 'Cost Workout saved');
        toast.success('Cost Workout saved');
        savedIdRef.current = null;
        await resetForm();
      } else if (action === 'submit') {
        let submitId = savedId;
        if (data?.id) {
          const subRes = await costWorkoutService.submitCw(data.id);
          submitId = subRes?.data?.id ?? data.id;
        }
        addTimeline('submitted', 'Submitted for approval');
        toast.success('Cost Workout submitted for approval');
        navigate(`/cost-workouts/${submitId}`);
      } else {
        addTimeline('saved', 'Cost Workout saved');
        toast.success(editing ? 'Cost Workout updated' : 'Cost Workout saved');
        savedIdRef.current = null;
        navigate('/cost-workouts');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to save Cost Workout');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const handleCancel = () => {
    if (dirtyRef.current) {
      setConfirmLeave(true);
      return;
    }
    navigate('/cost-workouts');
  };

  const fieldError = (key) =>
    errors[key] ? <div className="text-[10px] font-semibold text-rose-600 mt-1">{errors[key]}</div> : null;

  const inputCls = (hasError) =>
    `w-full bg-slate-50 border ${hasError ? 'border-rose-400' : 'border-slate-200'} rounded-lg px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-emerald-600/50 transition-all`;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <Loader2 className="w-6 h-6 text-[#0B4A3D] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
        <span>VISHAK TECH</span>
        <span>&gt;</span>
        <span>Sales</span>
        <span>&gt;</span>
        <span>Customer Purchase Request</span>
        <span>&gt;</span>
        <button type="button" onClick={() => navigate('/cost-workouts')} className="hover:text-slate-600 cursor-pointer">
          Cost Workouts
        </button>
        <span>&gt;</span>
        <span className="text-slate-600">{editing ? 'Edit Cost Workout' : 'New Cost Workout'}</span>
      </div>

      {/* ===== HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 tracking-tight">
            <Calculator className="w-6 h-6 text-[#0B4A3D]" />
            {editing ? 'Edit Cost Workout' : 'Create Cost Workout'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">Cost calculation for quotations.</p>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer w-fit select-none"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to List
        </button>
      </div>

      {/* ===== WORKFLOW STEPPER ===== */}
      <div className="flex items-center gap-1.5 flex-wrap mb-6 p-3 bg-surface border border-slate-200 rounded-xl select-none">
        {WORKFLOW_STEPS.map((step, index) => (
          <div key={step.label} className="flex items-center gap-1.5">
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                step.active ? 'bg-[#0B4A3D] text-white' : index < 3 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'
              }`}
            >
              <span aria-hidden="true">{WfIcon[step.icon]}</span>
              {step.label}
            </span>
            {index < WORKFLOW_STEPS.length - 1 && <ChevronLeft className="w-3 h-3 text-slate-300 rotate-180" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="space-y-5">
          {/* ===== CARD 1: GENERAL INFORMATION ===== */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0B4A3D]" />
              <h2 className="text-sm font-bold text-slate-800">General Information</h2>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">CW Number</label>
                <input
                  type="text"
                  value={form.cwNo}
                  onChange={(e) => setField('cwNo', e.target.value)}
                  placeholder="Auto-generated or enter manually"
                  className={inputCls(false)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Date <span className="text-rose-500">*</span>
                </label>
                <input type="date" value={form.cwDate} onChange={(e) => setField('cwDate', e.target.value)} className={inputCls(errors.cwDate)} />
                {fieldError('cwDate')}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  className={`${inputCls(false)} cursor-pointer`}
                >
                  {CW_FORM_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Prepared By <span className="text-rose-500">*</span>
                </label>
                <EditableMasterDropdown
                  masterKey="pr_requested_by"
                  value={form.preparedBy}
                  onChange={(v) => setField('preparedBy', v)}
                  placeholder="Select Preparer"
                  invalid={Boolean(errors.preparedBy)}
                  inputClassName={`${inputCls(errors.preparedBy)} cursor-text`}
                />
                {fieldError('preparedBy')}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Contact Person</label>
                <input
                  type="text"
                  value={form.contactPerson}
                  onChange={(e) => setField('contactPerson', e.target.value)}
                  placeholder="Contact person name"
                  className={inputCls(false)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Department <span className="text-rose-500">*</span>
                </label>
                <EditableMasterDropdown
                  masterKey="cw_departments"
                  value={form.department}
                  onChange={(v) => setField('department', v)}
                  placeholder="Select Department"
                  invalid={Boolean(errors.department)}
                  inputClassName={`${inputCls(errors.department)} cursor-text`}
                />
                {fieldError('department')}
              </div>
            </div>
          </div>

          {/* ===== CARD 2: CUSTOMER INFORMATION ===== */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0B4A3D]" />
              <h2 className="text-sm font-bold text-slate-800">Customer Information</h2>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Lead / Client <span className="text-rose-500">*</span>
                </label>
                <div ref={sourceWrapRef} className="relative">
                  <input
                    type="text"
                    value={sourceOpen ? sourceQuery : sourceSelected ? sourceSelected.label : ''}
                    onChange={(e) => handleSourceInput(e.target.value)}
                    onFocus={() => setSourceOpen(true)}
                    onKeyDown={handleSourceKeyDown}
                    placeholder="Search Lead or Client..."
                    autoComplete="off"
                    className={`${inputCls(errors.sourceLead)} cursor-text`}
                  />
                  {sourceOpen && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {sourceFiltered.length === 0 && (
                        <div className="px-3 py-2.5 text-[11px] text-slate-400">No matches found</div>
                      )}
                      {sourceFiltered.map((item, i) => (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSource(item);
                          }}
                          onMouseEnter={() => setSourceHighlight(i)}
                          className={`w-full text-left px-3 py-2 border-b border-slate-50 transition-colors cursor-pointer ${
                            i === sourceHighlight ? 'bg-[#E8F0EE] text-[#0B4A3D]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="text-xs font-semibold text-slate-700">{item.name || '(No Name)'}</div>
                          <div className="text-[10px] text-slate-400">
                            {item.type === 'lead' ? `Lead No: ${item.code}` : `Client Code: ${item.code}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {fieldError('sourceLead')}
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400">
                  <span>Select an existing Lead or Client to auto-fill details below</span>
                  {sourceSelected && (
                    <button
                      type="button"
                      onClick={clearSourceSelection}
                      className="ml-auto text-rose-500 hover:underline font-semibold cursor-pointer"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Customer Name</label>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => setField('customerName', e.target.value)}
                  readOnly
                  placeholder="Auto-filled from lead/client"
                  className={`${inputCls(false)} bg-slate-100`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">CPR Reference</label>
                <input
                  type="text"
                  value={form.cprRef}
                  onChange={(e) => setField('cprRef', e.target.value)}
                  placeholder="CPR-XXXX"
                  className={inputCls(false)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  readOnly
                  placeholder="Auto-filled"
                  className={`${inputCls(false)} bg-slate-100`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="Email address" className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Company</label>
                <input type="text" value={form.company} onChange={(e) => setField('company', e.target.value)} placeholder="Company name" className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">GST</label>
                <input type="text" value={form.gst} onChange={(e) => setField('gst', e.target.value)} placeholder="GST number" className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">PAN</label>
                <input type="text" value={form.pan} onChange={(e) => setField('pan', e.target.value)} placeholder="PAN number" className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Linked CPR</label>
                <input
                  type="text"
                  value={form.linkedCpr}
                  onChange={(e) => setField('linkedCpr', e.target.value)}
                  readOnly
                  placeholder="Auto-filled from selected CPR"
                  className={`${inputCls(false)} bg-slate-100`}
                />
                <span className="text-[9px] text-slate-400 mt-0.5 block">Auto-filled from selected CPR</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Billing Address</label>
                <textarea rows={2} value={form.billingAddress} onChange={(e) => setField('billingAddress', e.target.value)} placeholder="Billing address" className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Shipping Address</label>
                <textarea rows={2} value={form.shippingAddress} onChange={(e) => setField('shippingAddress', e.target.value)} placeholder="Shipping address" className={inputCls(false)} />
              </div>
            </div>
          </div>

          {/* ===== CARD 3: COST ITEMS ===== */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0B4A3D]" />
                <h2 className="text-sm font-bold text-slate-800">Cost Items Breakdown</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={addItem} className="flex items-center gap-1 text-[11px] font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
                <button type="button" onClick={addBatchCategories} className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-surface border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                  <Layers className="w-3.5 h-3.5" /> All Categories
                </button>
                <button type="button" onClick={clearAllItems} className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-surface border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" /> Clear All
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 60 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 85 }} />
                  <col style={{ width: 175 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 50 }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-100/80 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="py-2 px-3 text-center">#</th>
                    <th className="py-2 px-3 text-left">Description</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 px-3 text-left">Category</th>
                    <th className="py-2 px-3 text-center">Unit</th>
                    <th className="py-2 px-3 text-right">Rate</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3 text-left">Remarks</th>
                    <th className="py-2 px-3 text-center" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, itemIndex) => {
                    const cats = item.categories || [];
                    const itemTotal = cats.reduce(
                      (sum, c) => sum + (isLeadTimeCategory(c.category) ? 0 : (Number(c.qty) || 0) * (Number(c.rate) || 0)),
                      0
                    );
                    return (
                      <Fragment key={item.key}>
                        {cats.map((cat, catIndex) => {
                          const isLeadTime = isLeadTimeCategory(cat.category);
                          return (
                            <tr key={cat.key} className="border-b border-slate-100">
                              {catIndex === 0 && (
                                <>
                                  <td className="px-3 py-2 text-xs text-slate-400 text-center align-middle" rowSpan={cats.length}>
                                    {itemIndex + 1}
                                  </td>
                                  <td className="px-3 py-2 align-middle" rowSpan={cats.length}>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateItem(item.key, { description: e.target.value })}
                                        placeholder="Enter description"
                                        className="flex-1 min-w-0 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-600/50 rounded px-2 py-1.5 text-xs outline-none transition-colors"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeItem(item.key)}
                                        aria-label="Delete item"
                                        title="Delete item"
                                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 align-middle" rowSpan={cats.length}>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={item.qty}
                                      onChange={(e) => updateItem(item.key, { qty: e.target.value })}
                                      className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-600/50 rounded px-2 py-1.5 text-xs text-center outline-none transition-colors"
                                    />
                                  </td>
                                </>
                              )}
                              <td className="px-3 py-2">
                                <EditableMasterDropdown
                                  masterKey="cw_categories"
                                  value={cat.category}
                                  onChange={(v) => handleCategoryChange(item.key, cat.key, v)}
                                  onDeleted={handleCategoryDeleted}
                                  placeholder="Select category"
                                  portal
                                  inputClassName="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-600/50 rounded px-2 py-1.5 text-xs outline-none cursor-text transition-colors"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <EditableMasterDropdown
                                  masterKey="cw_units"
                                  value={cat.unit}
                                  onChange={(u) => updateCategory(item.key, cat.key, { unit: u })}
                                  placeholder="Select unit..."
                                  portal
                                  inputClassName="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-600/50 rounded px-2 py-1.5 pr-6 text-xs outline-none cursor-text transition-colors"
                                />
                              </td>
                              {isLeadTime ? (
                                <td className="px-3 py-2 text-center text-slate-300 text-xs">—</td>
                              ) : (
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={cat.rate}
                                    onChange={(e) => updateCategory(item.key, cat.key, { rate: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-600/50 rounded px-2 py-1.5 text-xs text-right outline-none transition-colors"
                                  />
                                </td>
                              )}
                              {isLeadTime ? (
                                <td className="px-3 py-2 text-center text-slate-300 text-xs">—</td>
                              ) : (
                                <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700">
                                  {formatINR((Number(cat.qty) || 0) * (Number(cat.rate) || 0))}
                                </td>
                              )}
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={cat.notes}
                                  onChange={(e) => updateCategory(item.key, cat.key, { notes: e.target.value })}
                                  placeholder="Notes"
                                  className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-600/50 rounded px-2 py-1.5 text-xs outline-none transition-colors"
                                />
                              </td>
                              <td className="px-2 py-2 text-center">
                                {cats.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeCategory(item.key, cat.key)}
                                    aria-label="Remove category row"
                                    title="Remove category"
                                    className="p-1 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Per-item action row (ERP cwRenderAll): Add Category + Item Total */}
                        <tr className="border-b border-slate-200">
                          <td colSpan={9} className="px-3 py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() => addCategory(item.key)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0B4A3D] hover:underline cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Add Category
                            </button>
                            <span className="ml-4 text-xs font-semibold text-slate-700">
                              Item Total: <span className="font-bold text-slate-900">₹{itemTotal.toFixed(2)}</span>
                            </span>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span>
                <span className="font-bold text-slate-700">{items.length}</span> Items
              </span>
              <span>
                <span className="font-bold text-slate-700">{catCount}</span> Categories
              </span>
              <span className="font-bold text-slate-700 ml-auto">
                Subtotal: <span className="text-[#0B4A3D]">{formatINR(totals.subtotal)}</span>
              </span>
            </div>
            {errors.items && <div className="px-5 pb-3 text-[10px] font-semibold text-rose-600">{errors.items}</div>}

            {/* COST BREAKDOWN & PRICING (ERP prg-cost-summary cw-breakdown inside the Cost Items card) */}
            <div className="mx-3.5 mb-3.5 p-3.5 border border-slate-200 rounded-[10px] bg-white">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800 mb-2.5 pb-2 border-b border-slate-100">
                <Calculator className="w-3.5 h-3.5 text-[#0B4A3D]" /> Cost Breakdown &amp; Pricing
              </div>
              <div className="max-w-xl">
                <div className="flex items-center justify-between py-[5px] text-xs">
                  <span className="text-slate-700">Subtotal</span>
                  <span className="font-semibold text-slate-800">{formatINR(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between py-[5px] text-xs">
                  <span className="text-slate-700">Profit %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.profitPct}
                    onChange={(e) => setField('profitPct', e.target.value)}
                    className="w-20 h-7 bg-slate-50 border border-slate-200 rounded-md px-2 text-xs text-right outline-none focus:border-emerald-600/50"
                  />
                </div>
                <div className="flex items-center justify-between py-[5px] text-xs">
                  <span className="text-slate-700">Profit Amount</span>
                  <span className="font-semibold text-slate-800">{formatINR(totals.profitAmt)}</span>
                </div>
                <div className="flex items-center justify-between py-[5px] text-xs">
                  <span className="text-slate-700">Selling Price</span>
                  <span className="font-semibold text-slate-800">{formatINR(totals.sellingPrice)}</span>
                </div>
                <div className="flex items-center justify-between py-[5px] text-xs">
                  <span className="text-slate-700">Discount %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.discountPct}
                    onChange={(e) => setField('discountPct', e.target.value)}
                    className="w-20 h-7 bg-slate-50 border border-slate-200 rounded-md px-2 text-xs text-right outline-none focus:border-emerald-600/50"
                  />
                </div>
                <div className="flex items-center justify-between py-[5px] text-xs">
                  <span className="text-slate-700">Discount Amount</span>
                  <span className="font-semibold text-slate-800">{formatINR(totals.discountAmt)}</span>
                </div>
                <div className="flex items-center justify-between py-[5px] text-xs">
                  <span className="text-slate-700">GST %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.gstPct}
                    onChange={(e) => setField('gstPct', e.target.value)}
                    className="w-20 h-7 bg-slate-50 border border-slate-200 rounded-md px-2 text-xs text-right outline-none focus:border-emerald-600/50"
                  />
                </div>
                <div className="flex items-center justify-between py-[5px] text-xs">
                  <span className="text-slate-700">GST Amount</span>
                  <span className="font-semibold text-slate-800">{formatINR(totals.gstAmt)}</span>
                </div>
                <div className="flex items-center justify-between py-[5px] text-xs border-t border-slate-200 mt-1.5 pt-2 font-bold">
                  <span className="text-slate-800">Grand Total</span>
                  <span className="font-bold text-[#0A4F44] text-[13px]">{formatINR(totals.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ===== CARD 5: REMARKS ===== */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0B4A3D]" />
              <h2 className="text-sm font-bold text-slate-800">Remarks</h2>
            </div>
            <div className="p-5">
              <textarea
                rows={4}
                maxLength={500}
                value={form.remarks}
                onChange={(e) => setField('remarks', e.target.value)}
                placeholder="Additional notes or remarks..."
                className={`w-full bg-slate-50 border ${errors.remarks ? 'border-rose-400' : 'border-slate-200'} rounded-lg px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-emerald-600/50 transition-all`}
              />
              <div className="flex items-center justify-between mt-1">
                {fieldError('remarks')}
                <span className="text-[10px] text-slate-400 ml-auto">{form.remarks.length} / 500</span>
              </div>
            </div>
          </div>

        </div>

        {/* ===== SIDEBAR (ERP create-cost-workout.html 5-card replica) ===== */}
        <CwSidebar
          form={form}
          items={items}
          catCount={catCount}
          totals={totals}
          timeline={timeline}
          files={form.attachments}
          record={record}
          onAddFiles={handleFiles}
          onRemoveFile={removeAttachment}
        />
      </div>

      {/* ===== STICKY FOOTER (matches original ERP create/edit footer) ===== */}
      <div className="sticky bottom-0 z-30 bg-surface border-t-2 border-slate-200 px-4 sm:px-6 py-3 mt-6 flex flex-wrap items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] rounded-t-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
            <X className="w-3.5 h-3.5 text-slate-400" /> Cancel
          </button>
          <button
            type="button"
            onClick={() => saveAs('draft')}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Draft
          </button>
          <span id="autosaveIndicator" className="text-[10px] font-semibold text-amber-600">
            {autosaveText}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => saveAs('new')}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" /> Save &amp; New
          </button>
          <button
            type="button"
            onClick={() => saveAs('exit')}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
          </button>
          <button
            type="button"
            onClick={() => saveAs('submit')}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Submit for Approval
          </button>
        </div>
      </div>

      {/* ===== DIRTY LEAVE CONFIRM (ERP goBack) ===== */}
      <ConfirmDialog
        open={confirmLeave}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to leave?"
        confirmLabel="Leave"
        variant="warning"
        icon={X}
        onConfirm={() => {
          setConfirmLeave(false);
          navigate('/cost-workouts');
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
