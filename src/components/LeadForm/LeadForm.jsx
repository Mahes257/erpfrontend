import { useState, useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, Building2, ChevronDown, CloudUpload, FileText, Info, Loader2,
  MapPin, Paperclip, Pencil, Plus, Save, Settings, StickyNote, User, UserCheck,
  Users, X
} from 'lucide-react';
import { SearchableSelect, useToast } from '../Common';
import leadService from '../../services/leadService';
import userService from '../../services/userService';
import industryService from '../../services/industryService';
import IndustryManagerModal from '../LeadModals/IndustryManagerModal';
import { serializeLead } from '../../utils/leadHelpers';
import { readMeta, writeMeta } from '../../utils/leadMeta';
import { STAGES, LEAD_SOURCES, LEAD_STATUSES, LEAD_PRIORITIES } from '../../utils/leadConstants';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const PHONE_PATTERN = /^[+\d][\d\s()-]{7,}$/;
const NUMERIC_PATTERN = /^\d*$/;

const COUNTRIES = ['India', 'US', 'UK', 'Canada', 'Australia', 'Germany', 'UAE', 'Singapore', 'Other'];
const STATES = [
  'Andhra Pradesh', 'Karnataka', 'Kerala', 'Maharashtra', 'Tamil Nadu', 'Telangana',
  'Delhi', 'Gujarat', 'Haryana', 'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Other'
];
const CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Other'
];

const DEFAULT_VALUES = {
  leadNo: '',
  businessName: '',
  businessType: '',
  industry: '',
  taxId: '',
  website: '',
  name: '',
  company: '',
  title: '',
  value: '',
  expectedCloseDate: '',
  stage: 'New',
  source: 'Website',
  status: 'Active',
  priority: 'medium',
  email: '',
  phone: '',
  secondaryName: '',
  secondaryEmail: '',
  secondaryPhone: '',
  secondaryDesignation: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  landmark: '',
  owner: 'Admin User',
  notes: '',
  internalNotes: ''
};

const INPUT =
  'w-full bg-surface border border-slate-300 rounded-lg px-3 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#0B4A3D] focus:ring-2 focus:ring-[#0B4A3D]/10 h-10';
const INVALID = ' border-rose-400 bg-rose-50 focus:border-rose-400 focus:ring-rose-400/10';
const FIELD_GRID = 'grid grid-cols-1 sm:grid-cols-2 gap-3.5';

function Field({ label, required, error, hint, className = '', children }) {
  return (
    <div className={className}>
      <label className="block text-[13px] font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-rose-500 text-[15px] leading-none">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function TextInput({ registration, error, ...rest }) {
  return <input className={`${INPUT} ${error ? INVALID : ''}`} {...registration} {...rest} />;
}

function Select({ registration, error, children, ...rest }) {
  return (
    <div className="relative">
      <select
        className={`${INPUT} appearance-none pr-8 cursor-pointer ${error ? INVALID : ''}`}
        {...registration}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
    </div>
  );
}

function TextArea({ registration, error, rows = 3, ...rest }) {
  return (
    <textarea
      rows={rows}
      className={`${INPUT} h-auto min-h-[90px] py-2.5 resize-y ${error ? INVALID : ''}`}
      {...registration}
      {...rest}
    />
  );
}

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

function FieldActions({ onAdd, onManage }) {
  return (
    <div className="flex gap-1 mt-1">
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B4A3D] px-2 py-1 rounded-md hover:bg-[#0B4A3D]/10 transition-colors cursor-pointer"
      >
        <Plus className="w-3 h-3" /> Add
      </button>
      <button
        type="button"
        onClick={onManage}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B4A3D] px-2 py-1 rounded-md hover:bg-[#0B4A3D]/10 transition-colors cursor-pointer"
      >
        <Pencil className="w-3 h-3" /> Manage
      </button>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function mergeOptions(options, current) {
  if (!current) return options;
  const values = new Set(options.map((o) => String(o)));
  if (values.has(String(current))) return options;
  return [current, ...options];
}

export default function LeadForm({ initialData, leadId }) {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors }
  } = useForm({ defaultValues: { ...DEFAULT_VALUES, ...initialData }, mode: 'onTouched' });

  const [submitting, setSubmitting] = useState(false);
  const [submittingNew, setSubmittingNew] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [industryModalOpen, setIndustryModalOpen] = useState(false);
  const [industries, setIndustries] = useState([]);
  const [users, setUsers] = useState(() => (initialData?.owner ? [{ id: 'current', name: initialData.owner }] : []));

  const industryValue = initialData?.industry || '';
  const countryValue = initialData?.country || 'India';
  const stateValue = initialData?.state || '';
  const cityValue = initialData?.city || '';

  const loadIndustries = async () => {
    try {
      const list = await industryService.listIndustries();
      setIndustries(Array.isArray(list) ? list : []);
    } catch {
      // Keep the current list if the industries endpoint is unavailable.
    }
  };

  useEffect(() => {
    if (initialData?.leadNo) setValue('leadNo', initialData.leadNo);
  }, [initialData?.leadNo, setValue]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await industryService.listIndustries();
        if (!cancelled) setIndustries(Array.isArray(list) ? list : []);
      } catch {
        // Keep the current list if the industries endpoint is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    leadService
      .getUsers()
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? data?.users ?? [];
        if (cancelled) return;
        setUsers((prev) => {
          const seen = new Set(prev.map((user) => user?.name ?? user?.email));
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
  }, [initialData?.owner]);

  const handleFiles = (files) => {
    const incoming = Array.from(files || []);
    const accepted = [];
    incoming.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 10MB limit`);
        return;
      }
      accepted.push(file);
    });
    if (accepted.length > 0) {
      setAttachmentFiles((prev) => [...prev, ...accepted]);
    }
  };

  const handleInputChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (id) => {
    for (const file of attachmentFiles) {
      const formData = new FormData();
      formData.append('file', file);
      await leadService.addAttachment(id, formData);
    }
  };

  const saveNote = async (id, text) => {
    if (!text || !text.trim()) return;
    await leadService.addNote(id, { text });
  };

  const onSubmit = async (values, mode = 'continue') => {
    const isNew = !leadId;
    const setBusy = mode === 'new' ? setSubmittingNew : setSubmitting;
    setBusy(true);
    try {
      const rawInternalNotes =
        typeof initialData?._rawInternalNotes === 'string' ? initialData._rawInternalNotes : '';
      // Preserve the meta blob (priority, leadNo, follow-up schedule) that the
      // form displays stripped: re-attach the original meta to the edited text.
      const mergedNotes = values.internalNotes
        ? writeMeta(values.internalNotes || '', readMeta(rawInternalNotes))
        : rawInternalNotes;
      const payload = {
        ...serializeLead({ ...values, internalNotes: mergedNotes }),
        businessName: values.company || values.businessName,
        notes: values.notes
      };

      if (isNew) {
        const created = await leadService.createLead(payload);
        const createdLead = created?.data ?? created ?? {};
        const id = createdLead.id;
        if (attachmentFiles.length > 0) {
          await uploadAttachments(id);
        }
        await saveNote(id, values.notes);

        if (mode === 'new') {
          toast.success('Lead created successfully');
          reset({ ...DEFAULT_VALUES, leadNo: '' });
          setAttachmentFiles([]);
          try {
            const next = await leadService.getNextNumber();
            if (next?.data?.leadNo) setValue('leadNo', next.data.leadNo);
          } catch {
            // The backend will auto-generate a lead number on the next save.
          }
        } else {
          toast.success('Lead created successfully');
          navigate('/leads');
        }
      } else {
        await leadService.updateLead(leadId, payload);
        if (attachmentFiles.length > 0) {
          await uploadAttachments(leadId);
        }
        await saveNote(leadId, values.notes);
        toast.success('Lead updated successfully');
        navigate(`/leads/${leadId}`);
      }
    } catch (err) {
      toast.error(err?.message || (isNew ? 'Failed to create lead' : 'Failed to update lead'));
    } finally {
      setBusy(false);
    }
  };

  const onSaveContinue = handleSubmit((values) => onSubmit(values, 'continue'));
  const onSaveNew = handleSubmit((values) => onSubmit(values, 'new'));

  const handleIndustryAdded = (name) => {
    if (name) setValue('industry', name, { shouldValidate: true });
  };

  const industryOptions = mergeOptions(
    industries.map((industry) => industry.name).filter(Boolean),
    industryValue
  );

  const hasValue = (...keys) => keys.some((key) => Boolean(initialData?.[key]));

  return (
    <form
      onSubmit={onSaveContinue}
      className="max-w-[1200px] mx-auto pb-28 space-y-5"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.target.closest('[data-dropzone]')) {
          handleFiles(e.dataTransfer.files);
        }
      }}
    >
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        {/* ===== Main column ===== */}
        <div className="flex flex-col gap-4">
          {/* Business Information */}
          <Section icon={Building2} title="Business Information" defaultOpen>
            <div className={FIELD_GRID}>
              <Field label="Business Name" required error={errors.company?.message}>
                <TextInput
                  registration={register('company', { required: 'Business name is required' })}
                  error={!!errors.company}
                  placeholder="Enter business name"
                />
              </Field>
              <Field label="Industry">
                <Select registration={register('industry')}>
                  <option value="">Select Industry</option>
                  {industryOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
                <FieldActions
                  onAdd={() => setIndustryModalOpen(true)}
                  onManage={() => setIndustryModalOpen(true)}
                />
              </Field>
            </div>
            <div className={`${FIELD_GRID} mt-3.5`}>
              <Field label="Website">
                <TextInput registration={register('website')} placeholder="https://example.com" />
              </Field>
            </div>
          </Section>

          {/* Lead Information */}
          <Section
            icon={Info}
            title="Lead Information"
            defaultOpen={Boolean(leadId) && hasValue('source', 'value', 'expectedCloseDate')}
          >
            <div className={FIELD_GRID}>
              <Field label="Lead Number" hint="Auto-generated; you can edit it before saving">
                <TextInput registration={register('leadNo')} placeholder="Auto-generated" />
              </Field>
              <Field label="Lead Source">
                <Select registration={register('source')}>
                  {LEAD_SOURCES.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className={`${FIELD_GRID} mt-3.5`}>
              <Field label="Expected Value (₹)">
                <TextInput
                  type="number"
                  min="0"
                  step="1000"
                  registration={register('value', {
                    pattern: { value: NUMERIC_PATTERN, message: 'Enter a valid number' }
                  })}
                  error={!!errors.value}
                  placeholder="e.g. 500000"
                />
              </Field>
              <Field label="Expected Close Date">
                <TextInput type="date" registration={register('expectedCloseDate')} />
              </Field>
            </div>
          </Section>

          {/* Primary Contact */}
          <Section
            icon={User}
            title="Primary Contact"
            defaultOpen={Boolean(leadId) && hasValue('name', 'phone', 'email')}
          >
            <div className={FIELD_GRID}>
              <Field label="Contact Person" required error={errors.name?.message}>
                <TextInput
                  registration={register('name', { required: 'Contact person is required' })}
                  error={!!errors.name}
                  placeholder="Primary contact person"
                />
              </Field>
              <Field label="Phone" required error={errors.phone?.message}>
                <TextInput
                  type="tel"
                  registration={register('phone', {
                    required: 'Phone is required',
                    pattern: { value: PHONE_PATTERN, message: 'Enter a valid phone number' }
                  })}
                  error={!!errors.phone}
                  placeholder="+91-9876543210"
                />
              </Field>
            </div>
            <div className={`${FIELD_GRID} mt-3.5`}>
              <Field label="Email" required error={errors.email?.message}>
                <TextInput
                  type="email"
                  registration={register('email', {
                    required: 'Email is required',
                    pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' }
                  })}
                  error={!!errors.email}
                  placeholder="contact@example.com"
                />
              </Field>
            </div>
          </Section>

          {/* Secondary Contact */}
          <Section
            icon={Users}
            title="Secondary Contact"
            defaultOpen={Boolean(leadId) && hasValue('secondaryName', 'secondaryPhone', 'secondaryEmail', 'secondaryDesignation')}
          >
            <div className={FIELD_GRID}>
              <Field label="Contact Person">
                <TextInput registration={register('secondaryName')} placeholder="Secondary contact person" />
              </Field>
              <Field label="Phone" error={errors.secondaryPhone?.message}>
                <TextInput
                  type="tel"
                  registration={register('secondaryPhone', {
                    pattern: { value: PHONE_PATTERN, message: 'Enter a valid phone number' }
                  })}
                  error={!!errors.secondaryPhone}
                  placeholder="+91-9876543210"
                />
              </Field>
            </div>
            <div className={`${FIELD_GRID} mt-3.5`}>
              <Field label="Email" error={errors.secondaryEmail?.message}>
                <TextInput
                  type="email"
                  registration={register('secondaryEmail', {
                    pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' }
                  })}
                  error={!!errors.secondaryEmail}
                  placeholder="secondary@example.com"
                />
              </Field>
              <Field label="Designation">
                <TextInput registration={register('secondaryDesignation')} placeholder="e.g. Manager" />
              </Field>
            </div>
          </Section>

          {/* Address */}
          <Section
            icon={MapPin}
            title="Address"
            defaultOpen={Boolean(leadId) && hasValue('address', 'city', 'state', 'pincode', 'landmark')}
          >
            <div className={FIELD_GRID}>
              <Field label="Country" required>
                <Select registration={register('country')}>
                  {mergeOptions(COUNTRIES, countryValue).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              </Field>
              <Field label="State">
                <Select registration={register('state')}>
                  <option value="">Select State</option>
                  {mergeOptions(STATES, stateValue).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className={`${FIELD_GRID} mt-3.5`}>
              <Field label="City/Town">
                <Select registration={register('city')}>
                  <option value="">Select City</option>
                  {mergeOptions(CITIES, cityValue).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Pincode">
                <TextInput registration={register('pincode')} placeholder="Enter pincode" />
              </Field>
            </div>
            <Field label="Map No / Landmark" className="mt-3.5">
              <TextInput
                registration={register('landmark')}
                placeholder="Enter Map Number or Landmark"
                maxLength={150}
              />
            </Field>
            <Field label="Address" className="mt-3.5">
              <TextArea registration={register('address')} rows={3} placeholder="Enter street address" />
            </Field>
          </Section>

          {/* Assignment */}
          <Section
            icon={UserCheck}
            title="Assignment"
            defaultOpen={Boolean(leadId) && hasValue('owner', 'priority')}
          >
            <div className={FIELD_GRID}>
              <Field label="Lead Owner">
                <Controller
                  name="owner"
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
                          setUsers((prev) => {
                            if (prev.some((user) => (user?.name ?? user?.email) === ownerName)) return prev;
                            return [...prev, { id: created?.id, name: ownerName, email: created?.email || '' }];
                          });
                          field.onChange(ownerName);
                        } catch (err) {
                          toast.error(err?.message || 'Failed to create owner');
                        }
                      }}
                      options={users.map((user) => ({
                        value: user?.name ?? user?.email ?? '',
                        label: user?.name ?? user?.email ?? ''
                      }))}
                      placeholder="Search and select an owner"
                    />
                  )}
                />
              </Field>
              <Field label="Stage">
                <Select registration={register('stage')}>
                  {STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className={`${FIELD_GRID} mt-3.5`}>
              <Field label="Priority">
                <Select registration={register('priority')}>
                  {LEAD_PRIORITIES.map((priority) => (
                    <option key={priority.value} value={priority.value}>{priority.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select registration={register('status')}>
                  {LEAD_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Section>

          {/* Notes */}
          <Section
            icon={StickyNote}
            title="Notes"
            defaultOpen={Boolean(leadId) && hasValue('notes')}
          >
            <TextArea
              registration={register('notes')}
              rows={4}
              placeholder="Enter notes, requirements, and any additional information about this lead..."
            />
          </Section>
        </div>

        {/* ===== Sidebar ===== */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-4">
          {/* Attachments */}
          <Section icon={Paperclip} title="Attachments" defaultOpen>
            <div
              data-dropzone
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-all duration-150 ${
                dragOver
                  ? 'border-[#0B4A3D] bg-[#EDF7F4]'
                  : 'border-slate-300 bg-slate-50 hover:border-[#0B4A3D] hover:bg-[#EDF7F4]'
              }`}
            >
              <CloudUpload className="w-9 h-9 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600">
                Drag &amp; drop files or <span className="text-[#0B4A3D] font-medium">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">PDF, DOCX, XLSX, PNG, JPG up to 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleInputChange}
              />
            </div>

            {attachmentFiles.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {attachmentFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#0B4A3D] shrink-0" />
                    <span className="flex-1 text-[13px] text-slate-700 truncate">{file.name}</span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      aria-label={`Remove ${file.name}`}
                      className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Internal Information */}
          <Section icon={Settings} title="Internal Information" defaultOpen compact>
            <Field label="Internal Notes" hint="Private notes for the team only">
              <TextArea
                registration={register('internalNotes')}
                rows={4}
                placeholder="Internal team notes"
              />
            </Field>
          </Section>
        </div>
      </div>

      {/* ===== Footer ===== */}
      <div className="sticky bottom-0 z-40 bg-surface/95 backdrop-blur border border-slate-200 rounded-xl shadow-[0_-2px_12px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/leads')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-slate-400" /> Cancel
          </button>

          <div className="flex items-center gap-2.5">
            {!leadId && (
              <button
                type="button"
                onClick={onSaveNew}
                disabled={submittingNew || submitting}
                className="flex items-center gap-1.5 text-xs font-bold text-[#0B4A3D] bg-surface border border-[#0B4A3D]/40 px-4 py-2.5 rounded-lg hover:bg-[#0B4A3D]/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Save &amp; Create New
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || submittingNew}
              className="flex items-center gap-2 bg-[#0B4A3D] hover:bg-[#0a3f35] text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>
                {submitting
                  ? (leadId ? 'Saving...' : 'Creating...')
                  : 'Save & Continue'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <IndustryManagerModal
        open={industryModalOpen}
        onClose={() => setIndustryModalOpen(false)}
        onRefresh={loadIndustries}
        onAdded={handleIndustryAdded}
      />
    </form>
  );
}
