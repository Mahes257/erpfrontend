import { useMemo, useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  Info, FileText, MapPin, Users, Truck, Settings, Paperclip, Landmark,
  ChevronDown, Plus, X, Trash2, Link2, Save, Loader2, Copy, Upload, Search
} from 'lucide-react';
import { Modal, useToast } from '../Common';
import clientService from '../../services/clientService';
import { serializeClient } from '../../utils/clientHelpers';
import { readMeta, writeMeta } from '../../utils/leadMeta';
import {
  CLIENT_STATUSES, INDUSTRIES, CLIENT_TYPES, TAX_TREATMENTS,
  CLIENT_CATEGORIES, PAYMENT_TERMS, CURRENCIES, COUNTRIES
} from '../../utils/clientConstants';

/* ============================================================
   OLD.zip Create Client page — replicated layout
   ============================================================ */

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const DEFAULT_VALUES = {
  clientNo: '',
  company: '',
  name: '',
  industry: '',
  website: '',
  gstin: '',
  panNumber: '',
  clientType: '',
  taxTreatment: '',
  country: 'India',
  state: '',
  city: '',
  pincode: '',
  mapNo: '',
  address: '',
  alias: '',
  owner: 'Admin User',
  category: '',
  status: 'Active',
  currency: 'INR',
  paymentTerms: '',
  creditLimit: '',
  email: '',
  phone: '',
  internalNotes: '',
  bankName: '',
  accountHolderName: '',
  accountNumber: '',
  ifscCode: '',
  branch: '',
  upiId: '',
  openingBalance: ''
};

const INPUT_CLASS =
  'w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-700 bg-surface outline-none placeholder:text-slate-400 transition-all focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)]';
const TEXTAREA_CLASS =
  'w-full min-h-[80px] px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] text-slate-700 bg-surface outline-none placeholder:text-slate-400 transition-all focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] resize-y';
const GHOST_BTN =
  'inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-transparent hover:bg-slate-100 hover:text-[#0B4A3D] px-2 py-1 rounded-md transition-colors cursor-pointer';

/* ---- OLD-style form primitives ---- */

function FormRow({ children, full = false }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5 last:mb-0 ${full ? 'sm:col-span-2' : ''}`}>
      {children}
    </div>
  );
}

function Field({ label, required = false, error, actions, children, full = false }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {actions && <div className="flex gap-1 mt-1">{actions}</div>}
      {error && <p className="mt-1 text-[11px] font-semibold text-red-500">{error}</p>}
    </div>
  );
}

function ManageButtons({ onAdd, onManage }) {
  return (
    <>
      <button type="button" className={GHOST_BTN} onClick={onAdd}><Plus className="w-3 h-3" /> Add</button>
      <button type="button" className={GHOST_BTN} onClick={onManage}><FileText className="w-3 h-3" /> Manage</button>
    </>
  );
}

/* OLD/Lead-style accordion: clicking a header toggles only that section (independent state) */
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

/* ---- Master-data Add / Manage modal (local, persisted per field) ---- */

const MASTER_STORAGE = 'vishak:client:master-options';

function loadMasterOptions() {
  try {
    return JSON.parse(localStorage.getItem(MASTER_STORAGE)) || {};
  } catch {
    return {};
  }
}

function MasterDataModal({ open, title, options, onAdd, onRemove, onClose }) {
  const [value, setValue] = useState('');
  const [filter, setFilter] = useState('');

  const filtered = useMemo(
    () => options.filter((opt) => opt.toLowerCase().includes(filter.trim().toLowerCase())),
    [options, filter]
  );

  const handleAdd = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Done
          </button>
          <button
            onClick={handleAdd}
            disabled={!value.trim()}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#136754] to-[#0B4A3D] px-4 py-2 rounded-lg hover:from-[#17806A] hover:to-[#0F5C4C] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add Option
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search options..."
            className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-lg text-[13px] text-slate-700 bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
          />
        </div>
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Type a new option"
            className="flex-1 h-10 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-700 bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
          />
          <button
            onClick={handleAdd}
            disabled={!value.trim()}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#136754] to-[#0B4A3D] px-3.5 rounded-lg hover:from-[#17806A] hover:to-[#0F5C4C] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-400">No options found</p>
          ) : (
            filtered.map((opt) => (
              <div key={opt} className="flex items-center justify-between px-3 py-2">
                <span className="text-[13px] text-slate-700">{opt}</span>
                <button
                  onClick={() => onRemove(opt)}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                  aria-label={`Remove ${opt}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---- Linked contacts & shipping (client-side collections) ---- */

const EMPTY_CONTACT = { name: '', email: '', phone: '', designation: '' };
const EMPTY_SHIPPING = { country: '', state: '', city: '', postal: '', street: '' };

/* ============================================================
   Main form
   ============================================================ */

export default function ClientForm({ initialData, clientId }) {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors }
  } = useForm({
    defaultValues: { ...DEFAULT_VALUES, ...initialData },
    mode: 'onTouched'
  });

  const [submitting, setSubmitting] = useState(false);
  const [saveMode, setSaveMode] = useState(null);
  const [users, setUsers] = useState(() =>
    initialData?.owner ? [{ id: 'current', name: initialData.owner }] : []
  );
  const [linkedContacts, setLinkedContacts] = useState(() =>
    Array.isArray(initialData?.linkedContacts) ? initialData.linkedContacts : []
  );
  const [shippingRows, setShippingRows] = useState(() =>
    Array.isArray(initialData?.shippingDetails)
      ? initialData.shippingDetails.map((row) => ({ ...row, id: row.id || `ship_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }))
      : []
  );
  const [files, setFiles] = useState([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [newContact, setNewContact] = useState(EMPTY_CONTACT);
  const [masterModal, setMasterModal] = useState(null); // { fieldKey, label, value }

  /* Custom master-data options (from constants + localStorage additions) */
  const [customOptions, setCustomOptions] = useState(loadMasterOptions);

  const masterBase = useMemo(
    () => ({
      industry: INDUSTRIES,
      clientType: CLIENT_TYPES,
      taxTreatment: TAX_TREATMENTS,
      category: CLIENT_CATEGORIES,
      paymentTerms: PAYMENT_TERMS,
      country: COUNTRIES,
      owner: []
    }),
    []
  );

  const masterOptions = useCallback(
    (fieldKey) => [...(masterBase[fieldKey] || []), ...(customOptions[fieldKey] || [])],
    [masterBase, customOptions]
  );

  const saveMasterOptions = (next) => {
    setCustomOptions(next);
    try {
      localStorage.setItem(MASTER_STORAGE, JSON.stringify(next));
    } catch { /* ignore storage failure */ }
  };

  const handleMasterAdd = (fieldKey, value) => {
    const current = customOptions[fieldKey] || [];
    if (current.includes(value)) return;
    saveMasterOptions({ ...customOptions, [fieldKey]: [...current, value] });
    toast.success(`"${value}" added`);
  };

  const handleMasterRemove = (fieldKey, value) => {
    const current = customOptions[fieldKey] || [];
    saveMasterOptions({ ...customOptions, [fieldKey]: current.filter((opt) => opt !== value) });
  };

  const openMaster = (fieldKey, label) => setMasterModal({ fieldKey, label });

  /* Load real users for the Sales Person select */
  useEffect(() => {
    let cancelled = false;
    clientService
      .getUsers()
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? data?.users ?? [];
        if (cancelled) return;
        setUsers((prev) => {
          const seen = new Set(prev.map((u) => u?.name ?? u?.email));
          const merged = [...prev];
          list.forEach((user) => {
            const name = user?.name ?? user?.email;
            if (name && !seen.has(name)) {
              seen.add(name);
              merged.push(user);
            }
          });
          return merged;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const ownerOptions = useMemo(() => {
    const fromUsers = users.map((u) => u?.name ?? u?.email ?? '').filter(Boolean);
    return [...new Set([...fromUsers, ...masterOptions('owner')])];
  }, [users, masterOptions]);

  const isEdit = Boolean(clientId);
  const hasValue = (...keys) => keys.some((key) => Boolean(initialData?.[key]));

  /* ---- Submit flows (mirrors OLD footer: Save Draft / Save & Create New / Save & Continue) ---- */

  const persist = async (values, mode) => {
    setSubmitting(true);
    setSaveMode(mode);
    try {
      // Uniqueness: reject a Client Number already used by another client.
      const clientNoValue = String(values.clientNo || '').trim();
      if (clientNoValue) {
        const taken = await clientService.clientNoExists(clientNoValue, clientId);
        if (taken) {
          toast.error(`Client number already exists: ${clientNoValue}`);
          setSubmitting(false);
          setSaveMode(null);
          return;
        }
      }
      const rawInternalNotes =
        typeof initialData?._rawInternalNotes === 'string' ? initialData._rawInternalNotes : '';
      // Preserve the meta blob (clientNo, banking details) that the form
      // displays stripped: re-attach the original meta to the edited text.
      const mergedNotes = values.internalNotes
        ? writeMeta(values.internalNotes || '', readMeta(rawInternalNotes))
        : rawInternalNotes;
      const payload = serializeClient({ ...values, internalNotes: mergedNotes });
      // Linked contacts & shipping rows are collected locally and persisted as JSON
      payload.linkedContacts = JSON.stringify(
        linkedContacts.map(({ name: n, email: e, phone: p, designation: d }) => ({ name: n, email: e, phone: p, designation: d }))
      );
      payload.shippingDetails = JSON.stringify(
        shippingRows.map(({ country, state, city, postal, street }) => ({ country, state, city, postal, street }))
      );
      // Business Name is the primary identity; default the person/contact name to it
      if (!payload.name) payload.name = payload.company;
      if (!payload.owner) payload.owner = 'Admin User';

      let result;
      if (clientId) {
        result = await clientService.updateClient(clientId, payload);
      } else {
        result = await clientService.createClient(payload);
      }
      const created = result?.data ?? result;
      const id = created?.id ?? clientId;

      if (mode === 'create-new') {
        toast.success('Client created — you can create another');
        reset({ ...DEFAULT_VALUES, country: 'India', owner: values.owner || 'Admin User', currency: 'INR' });
        setLinkedContacts([]);
        setShippingRows([]);
        setFiles([]);
        // Allocate the next client number for the fresh form.
        clientService
          .getNextNumber()
          .then((res) => {
            if (res?.clientNo) {
              reset((prev) => ({ ...prev, clientNo: res.clientNo }));
            }
          })
          .catch(() => {});
        return;
      }

      if (mode === 'continue') {
        toast.success(clientId ? 'Client updated successfully' : 'Client created successfully');
        navigate(id ? `/clients/${id}` : '/clients');
        return;
      }

      // mode === 'draft' (or fallback save)
      toast.success(clientId ? 'Client updated successfully' : 'Client created successfully');
      if (!clientId) navigate('/clients');
    } catch (err) {
      toast.error(err?.message || (clientId ? 'Failed to update client' : 'Failed to create client'));
    } finally {
      setSubmitting(false);
      setSaveMode(null);
    }
  };

  const onSubmit = (values) => persist(values, 'continue');

  const handleSaveDraft = () =>
    handleSubmit(
      (values) => persist(values, 'draft'),
      () => toast.error('Please fill the required fields before saving')
    )();
  const handleSaveCreateNew = () =>
    handleSubmit(
      (values) => persist(values, 'create-new'),
      () => toast.error('Please fill the required fields before saving')
    )();
  const handleCancel = () => navigate('/clients');

  const linkContact = () => {
    const name = newContact.name.trim();
    const email = newContact.email.trim();
    const phone = newContact.phone.trim();
    if (!name && !email && !phone) {
      toast.error('Enter at least one of Name, Email or Phone');
      return;
    }
    setLinkedContacts((prev) => [...prev, { ...newContact, name, email, phone }]);
    setNewContact(EMPTY_CONTACT);
    setLinkModalOpen(false);
  };

  const addShippingRow = (billing) => {
    const base = billing
      ? { country: billing.country, state: billing.state, city: billing.city, postal: billing.pincode, street: billing.address }
      : EMPTY_SHIPPING;
    setShippingRows((prev) => [...prev, { ...base, id: `ship_${Date.now()}` }]);
  };

  const updateShippingRow = (id, key, value) => {
    setShippingRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addFiles = (list) => {
    const picked = Array.from(list).map((file) => ({
      name: file.name,
      size: file.size,
      id: `${file.name}_${file.lastModified}`
    }));
    setFiles((prev) => [...prev, ...picked]);
  };

  const masterTitle = masterModal
    ? `${masterModal.label} — Add / Manage Options`
    : '';

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[13px] text-slate-400 mb-2 select-none">
        <button onClick={() => navigate('/dashboard')} className="text-[#0B4A3D] hover:underline font-medium cursor-pointer">VISHAK TECH</button>
        <span className="text-[10px] text-slate-300">›</span>
        <button onClick={() => navigate('/clients')} className="text-[#0B4A3D] hover:underline font-medium cursor-pointer">Clients</button>
        <span className="text-[10px] text-slate-300">›</span>
        <span className="text-slate-600 font-medium">{isEdit ? 'Edit' : 'New'}</span>
      </nav>

      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5 m-0">
          {isEdit ? 'Edit Client' : 'Create New Client'}
        </h1>
        <p className="text-[13px] text-slate-500 mt-1 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          Fields marked with <span className="text-red-500">*</span> are required
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="pb-28 space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          {/* ============ MAIN FORM ============ */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Business Information */}
            <Section icon={Info} title="Business Information" defaultOpen>
              <FormRow>
                <Field label="Business Name" required error={errors.company?.message}>
                  <input
                    {...register('company', { required: 'Business name is required' })}
                    className={`${INPUT_CLASS} ${errors.company ? 'border-red-400' : ''}`}
                    placeholder="Enter business name"
                  />
                </Field>
                <Field label="Contact Person">
                  <input {...register('name')} className={INPUT_CLASS} placeholder="Primary contact person" />
                </Field>
              </FormRow>
              <FormRow>
                <Field
                  label="Client Industry"
                  actions={<ManageButtons onAdd={() => openMaster('industry', 'Industry')} onManage={() => openMaster('industry', 'Industry')} />}
                >
                  <select {...register('industry')} className={`${INPUT_CLASS} cursor-pointer`}>
                    <option value="">Select Industry</option>
                    {masterOptions('industry').map((industry) => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Website">
                  <input {...register('website')} className={INPUT_CLASS} placeholder="https://example.com" />
                </Field>
              </FormRow>
            </Section>

            {/* Tax Information */}
            <Section
              icon={FileText}
              title="Tax Information"
              defaultOpen={isEdit && hasValue('gstin', 'panNumber', 'clientType', 'taxTreatment')}
            >
              <FormRow>
                <Field label="Business GSTIN">
                  <input {...register('gstin')} className={INPUT_CLASS} placeholder="Enter GSTIN (e.g. 27AABCU1234D1Z5)" />
                </Field>
                <Field label="Business PAN Number">
                  <input {...register('panNumber')} className={INPUT_CLASS} placeholder="Enter PAN number" />
                </Field>
              </FormRow>
              <FormRow>
                <Field
                  label="Client Type"
                  actions={<ManageButtons onAdd={() => openMaster('clientType', 'Client Type')} onManage={() => openMaster('clientType', 'Client Type')} />}
                >
                  <select {...register('clientType')} className={`${INPUT_CLASS} cursor-pointer`}>
                    <option value="">Select Client Type</option>
                    {masterOptions('clientType').map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Tax Treatment"
                  actions={<ManageButtons onAdd={() => openMaster('taxTreatment', 'Tax Treatment')} onManage={() => openMaster('taxTreatment', 'Tax Treatment')} />}
                >
                  <select {...register('taxTreatment')} className={`${INPUT_CLASS} cursor-pointer`}>
                    <option value="">Select Tax Treatment</option>
                    {masterOptions('taxTreatment').map((treatment) => (
                      <option key={treatment} value={treatment}>{treatment}</option>
                    ))}
                  </select>
                </Field>
              </FormRow>
            </Section>

            {/* Address */}
            <Section
              icon={MapPin}
              title="Address"
              defaultOpen={isEdit && hasValue('address', 'city', 'state', 'pincode', 'mapNo')}
            >
              <FormRow>
                <Field
                  label="Country"
                  actions={<ManageButtons onAdd={() => openMaster('country', 'Country')} onManage={() => openMaster('country', 'Country')} />}
                >
                  <select {...register('country')} className={`${INPUT_CLASS} cursor-pointer`}>
                    {masterOptions('country').map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </Field>
                <Field label="State / Province">
                  <input {...register('state')} className={INPUT_CLASS} placeholder="State" />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="City/Town">
                  <input {...register('city')} className={INPUT_CLASS} placeholder="City" />
                </Field>
                <Field label="Postal Code / Zip Code">
                  <input {...register('pincode')} className={INPUT_CLASS} placeholder="Enter postal code" />
                </Field>
              </FormRow>
              <FormRow full>
                <Field label="Map No">
                  <input {...register('mapNo')} className={INPUT_CLASS} placeholder="Enter Map Number" />
                </Field>
              </FormRow>
              <FormRow full>
                <Field label="Street Address">
                  <textarea {...register('address')} className={TEXTAREA_CLASS} placeholder="Enter street address" />
                </Field>
              </FormRow>
            </Section>

            {/* Linked Contacts */}
            <Section
              icon={Users}
              title="Linked Contacts"
              defaultOpen={isEdit && (initialData?.linkedContacts?.length > 0)}
            >
              <button
                type="button"
                onClick={() => setLinkModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-dashed border-[#0A4F44] rounded-lg text-[13px] text-[#0A4F44] bg-transparent hover:bg-[#E8F0EE] transition-colors cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" /> Link Contact
              </button>
              <div className="overflow-x-auto mt-3">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      {['Name', 'Email', 'Phone', 'Designation', 'Action'].map((head) => (
                        <th key={head} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linkedContacts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-5 text-center text-sm text-slate-400">No contacts linked</td>
                      </tr>
                    ) : (
                      linkedContacts.map((contact, index) => (
                        <tr key={`${contact.email}_${index}`} className="border-b border-slate-100">
                          <td className="px-3 py-2.5 font-medium text-slate-700">{contact.name || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-500">{contact.email || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-500">{contact.phone || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-500">{contact.designation || '—'}</td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => setLinkedContacts((prev) => prev.filter((_, i) => i !== index))}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              aria-label={`Remove ${contact.name || 'contact'}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Shipping Details */}
            <Section
              icon={Truck}
              title="Shipping Details"
              defaultOpen={isEdit && (initialData?.shippingDetails?.length > 0)}
            >
              {shippingRows.length === 0 && (
                <p className="text-sm text-slate-400 mb-3">No shipping addresses added yet.</p>
              )}
              <div className="space-y-2.5">
                {shippingRows.map((row, index) => (
                  <div key={row.id} className="border border-slate-200 rounded-[10px] p-3.5 relative">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[13px] font-semibold text-slate-700">Shipping Address #{index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            updateShippingRow(row.id, 'country', getValues('country') || 'India');
                            updateShippingRow(row.id, 'state', getValues('state') || '');
                            updateShippingRow(row.id, 'city', getValues('city') || '');
                            updateShippingRow(row.id, 'postal', getValues('pincode') || '');
                            updateShippingRow(row.id, 'street', getValues('address') || '');
                            toast.success('Billing address copied');
                          }}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#0B4A3D] hover:bg-slate-100 px-2 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Copy Billing
                        </button>
                        <button
                          type="button"
                          onClick={() => setShippingRows((prev) => prev.filter((r) => r.id !== row.id))}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          aria-label="Remove shipping address"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <FormRow>
                      <Field label="Country">
                        <input value={row.country} onChange={(e) => updateShippingRow(row.id, 'country', e.target.value)} className={INPUT_CLASS} placeholder="Country" />
                      </Field>
                      <Field label="State">
                        <input value={row.state} onChange={(e) => updateShippingRow(row.id, 'state', e.target.value)} className={INPUT_CLASS} placeholder="State" />
                      </Field>
                    </FormRow>
                    <FormRow>
                      <Field label="City">
                        <input value={row.city} onChange={(e) => updateShippingRow(row.id, 'city', e.target.value)} className={INPUT_CLASS} placeholder="City" />
                      </Field>
                      <Field label="Postal Code">
                        <input value={row.postal} onChange={(e) => updateShippingRow(row.id, 'postal', e.target.value)} className={INPUT_CLASS} placeholder="Postal code" />
                      </Field>
                    </FormRow>
                    <FormRow full>
                      <Field label="Street Address">
                        <textarea value={row.street} onChange={(e) => updateShippingRow(row.id, 'street', e.target.value)} className={`${TEXTAREA_CLASS} min-h-[50px]`} placeholder="Street address" />
                      </Field>
                    </FormRow>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addShippingRow(null)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-slate-200 bg-surface hover:bg-slate-50 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Shipping Detail
              </button>
            </Section>

            {/* Additional Details */}
            <Section
              icon={Settings}
              title="Additional Details"
              defaultOpen={isEdit && hasValue('alias', 'owner', 'category', 'status', 'paymentTerms', 'creditLimit', 'email', 'phone', 'internalNotes')}
            >
              <FormRow>
                <Field label="Client Code">
                  <input
                    {...register('clientNo')}
                    placeholder="Auto-generated — you can edit it before saving"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Business Alias">
                  <input {...register('alias')} className={INPUT_CLASS} placeholder="Alias (optional)" />
                </Field>
              </FormRow>
              <FormRow>
                <Field
                  label="Sales Person"
                  actions={<ManageButtons onAdd={() => openMaster('owner', 'Sales Person')} onManage={() => openMaster('owner', 'Sales Person')} />}
                >
                  <select {...register('owner')} className={`${INPUT_CLASS} cursor-pointer`}>
                    <option value="">Select Sales Person</option>
                    {ownerOptions.map((owner) => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Category"
                  actions={<ManageButtons onAdd={() => openMaster('category', 'Category')} onManage={() => openMaster('category', 'Category')} />}
                >
                  <select {...register('category')} className={`${INPUT_CLASS} cursor-pointer`}>
                    <option value="">Select Category</option>
                    {masterOptions('category').map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Status">
                  <select {...register('status')} className={`${INPUT_CLASS} cursor-pointer`}>
                    {CLIENT_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Currency" required>
                  <select
                    {...register('currency', { required: 'Currency is required' })}
                    className={`${INPUT_CLASS} cursor-pointer ${errors.currency ? 'border-red-400' : ''}`}
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </Field>
              </FormRow>
              <FormRow>
                <Field
                  label="Payment Terms"
                  actions={<ManageButtons onAdd={() => openMaster('paymentTerms', 'Payment Terms')} onManage={() => openMaster('paymentTerms', 'Payment Terms')} />}
                >
                  <select {...register('paymentTerms')} className={`${INPUT_CLASS} cursor-pointer`}>
                    <option value="">Select Payment Terms</option>
                    {masterOptions('paymentTerms').map((terms) => (
                      <option key={terms} value={terms}>{terms}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Credit Limit">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    {...register('creditLimit')}
                    className={INPUT_CLASS}
                    placeholder="e.g. 500000"
                  />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Email" error={errors.email?.message}>
                  <input
                    type="email"
                    {...register('email', {
                      pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' }
                    })}
                    className={`${INPUT_CLASS} ${errors.email ? 'border-red-400' : ''}`}
                    placeholder="client@example.com"
                  />
                </Field>
                <Field label="Phone Number">
                  <input {...register('phone')} className={INPUT_CLASS} placeholder="+91-9876543210" />
                </Field>
              </FormRow>
              <FormRow full>
                <Field label="Notes">
                  <textarea {...register('internalNotes')} className={TEXTAREA_CLASS} placeholder="Internal notes about this client" />
                </Field>
              </FormRow>
            </Section>
          </div>

          {/* ============ SIDEBAR FORM ============ */}
          <div className="flex flex-col gap-4 min-w-0 xl:sticky xl:top-4">
            {/* Attachments */}
            <Section icon={Paperclip} title="Attachments" compact defaultOpen>
              <label className="border-2 border-dashed border-slate-300 rounded-xl py-10 px-4 text-center cursor-pointer bg-slate-50 hover:border-[#0A4F44] hover:bg-[#EDF7F4] transition-all block">
                <Upload className="w-9 h-9 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-600 m-0">
                  Drag &amp; drop files or <span className="text-[#0A4F44] font-medium">browse</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">PDF, DOCX, XLSX, PNG, JPG up to 10MB</p>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              {files.length > 0 && (
                <div className="mt-3">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg mb-1.5">
                      <FileText className="w-4 h-4 text-[#0B4A3D] shrink-0" />
                      <span className="text-xs font-medium text-slate-700 truncate flex-1">{file.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                      <button
                        onClick={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))}
                        className="p-0.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Account Details */}
            <Section
              icon={Landmark}
              title="Account Details"
              compact
              defaultOpen={isEdit && hasValue('bankName', 'accountHolderName', 'accountNumber', 'ifscCode', 'branch', 'upiId', 'openingBalance')}
            >
              <FormRow>
                <Field label="Bank Name">
                  <input {...register('bankName')} className={INPUT_CLASS} placeholder="e.g. HDFC Bank" />
                </Field>
                <Field label="Account Holder Name">
                  <input {...register('accountHolderName')} className={INPUT_CLASS} placeholder="e.g. John Doe" />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Account Number">
                  <input {...register('accountNumber')} className={INPUT_CLASS} placeholder="Enter account number" />
                </Field>
                <Field label="IFSC Code">
                  <input {...register('ifscCode')} className={INPUT_CLASS} placeholder="e.g. HDFC0001234" />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Branch">
                  <input {...register('branch')} className={INPUT_CLASS} placeholder="Enter branch name" />
                </Field>
                <Field label="UPI ID (Account)">
                  <input {...register('upiId')} className={INPUT_CLASS} placeholder="e.g. name@upi" />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Opening Balance">
                  <input
                    type="number"
                    step="0.01"
                    {...register('openingBalance')}
                    className={INPUT_CLASS}
                    placeholder="0.00"
                  />
                </Field>
              </FormRow>
            </Section>
          </div>
        </div>

        {/* ============ STICKY FOOTER ============ */}
        <div className="sticky bottom-0 z-40 bg-surface/95 backdrop-blur border border-slate-200 rounded-xl shadow-[0_-2px_12px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-slate-400" /> Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" /> Save Draft
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              {!isEdit && (
                <button
                  type="button"
                  onClick={handleSaveCreateNew}
                  disabled={submitting}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#0B4A3D] bg-surface border border-[#0B4A3D]/40 px-4 py-2.5 rounded-lg hover:bg-[#0B4A3D]/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting && saveMode === 'create-new' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Save &amp; Create New
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 bg-[#0B4A3D] hover:bg-[#0a3f35] text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting && saveMode === 'continue' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save &amp; Continue
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Link Contact modal */}
      <Modal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title="Link Contact"
        footer={
          <>
            <button
              onClick={() => setLinkModalOpen(false)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={linkContact}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#136754] to-[#0B4A3D] px-4 py-2 rounded-lg hover:from-[#17806A] hover:to-[#0F5C4C] transition-colors cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" /> Link Contact
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name">
            <input value={newContact.name} onChange={(e) => setNewContact((prev) => ({ ...prev, name: e.target.value }))} className={INPUT_CLASS} placeholder="Contact name" />
          </Field>
          <Field label="Designation">
            <input value={newContact.designation} onChange={(e) => setNewContact((prev) => ({ ...prev, designation: e.target.value }))} className={INPUT_CLASS} placeholder="Designation" />
          </Field>
          <Field label="Email">
            <input value={newContact.email} onChange={(e) => setNewContact((prev) => ({ ...prev, email: e.target.value }))} className={INPUT_CLASS} placeholder="email@example.com" />
          </Field>
          <Field label="Phone">
            <input value={newContact.phone} onChange={(e) => setNewContact((prev) => ({ ...prev, phone: e.target.value }))} className={INPUT_CLASS} placeholder="+91-9876543210" />
          </Field>
        </div>
      </Modal>

      {/* Master data modal */}
      <MasterDataModal
        open={masterModal !== null}
        title={masterTitle}
        options={masterModal ? masterOptions(masterModal.fieldKey) : []}
        onAdd={(value) => masterModal && handleMasterAdd(masterModal.fieldKey, value)}
        onRemove={(value) => masterModal && handleMasterRemove(masterModal.fieldKey, value)}
        onClose={() => setMasterModal(null)}
      />
    </div>
  );
}
