import { Fragment, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  Flag,
  Info,
  Layers,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Send
} from 'lucide-react';
import { Accordion, EditableMasterDropdown, FormField, SelectInput, TextArea, TextInput, useToast } from '../Common';
import ClientLookup from './ClientLookup';
import CreateCustomerModal from './CreateCustomerModal';
import CurrencyDropdown from './CurrencyDropdown';
import PendingAttachments from './PendingAttachments';
import SalesAttachments from '../SalesDetail/SalesAttachments';
import SalesItemGrid from './SalesItemGrid';
import SalesTotals from './SalesTotals';
import { SERIALIZERS } from '../../utils/salesHelpers';
import costWorkoutService from '../../services/costWorkoutService';
import quotationService from '../../services/quotationService';
import salesContractService from '../../services/salesContractService';
import salesOrderService from '../../services/salesOrderService';
import deliveryChallanService from '../../services/deliveryChallanService';
import proformaInvoiceService from '../../services/proformaInvoiceService';
import invoiceService from '../../services/invoiceService';
import paymentReceiptService from '../../services/paymentReceiptService';
import creditNoteService from '../../services/creditNoteService';

function parseListResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.content)) return response.data.content;
  if (Array.isArray(response?.content)) return response.content;
  return [];
}

// Source-document services keyed by the query param used on the create form.
const SOURCE_SERVICES = {
  qtn: quotationService,
  sc: salesContractService,
  so: salesOrderService,
  dc: deliveryChallanService,
  pi: proformaInvoiceService,
  inv: invoiceService,
  cn: creditNoteService,
  pr: paymentReceiptService
};

const SOURCE_DOC_NO_KEY = {
  qtn: 'quotationNo',
  sc: 'scNo',
  so: 'soNo',
  dc: 'dcNo',
  pi: 'piNo',
  inv: 'invoiceNo',
  cn: 'cnNo',
  pr: 'receiptNo'
};

// Which target field receives the source document number, per (target, source).
const TARGET_REF_FIELD = {
  salesContract: { qtn: 'qtnRef' },
  salesOrder: { qtn: 'qtnRef', sc: 'scRef' },
  deliveryChallan: { so: 'soRef' },
  proformaInvoice: { so: 'soRef', dc: 'dcRef' },
  invoice: { pi: 'piRef', dc: 'dcRef', so: 'soRef' },
  paymentReceipt: { inv: 'invoiceRef' },
  creditNote: { inv: 'invoiceRef', pr: 'prRef' }
};

// Source type strings stored in the target's `source` field (ERP values).
const TARGET_SOURCE_STRING = {
  proformaInvoice: { dc: 'From Delivery Challan', so: 'From Sales Order' },
  invoice: { pi: 'From Proforma Invoice', dc: 'From Delivery Challan' },
  paymentReceipt: { inv: 'From Invoice' },
  creditNote: { inv: 'From Invoice', pr: 'From Payment Receipt' }
};

const CLIENT_FIELDS = [
  'clientId', 'clientName', 'contactPerson', 'phone', 'email', 'gstin',
  'pan', 'city', 'state', 'pin', 'country', 'billingAddress', 'shippingAddress',
  'shipSameAsBill'
];

function fieldControl(field, value, onChange, dynamicOptions = {}) {
  const shared = { value: value ?? '', onChange: (e) => onChange(e.target.value) };
  switch (field.type) {
    case 'textarea':
      return <TextArea rows={field.rows || 3} {...shared} placeholder={field.placeholder || ''} />;
    case 'select':
      if (field.dynamicSource === 'costWorkouts') {
        return (
          <SelectInput {...shared} aria-label={field.label}>
            <option value="">{field.placeholder || '-- None --'}</option>
            {(dynamicOptions.costWorkouts || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </SelectInput>
        );
      }
      if (field.type === 'currency') {
        // Complete international currency list, searchable by code or name.
        return <CurrencyDropdown value={value ?? ''} onChange={onChange} placeholder="Currency" />;
      }
      if (field.masterKey) {
        // Master-data dropdown: search, add, edit and delete values, persisted
        // in MySQL via /masters/{key}. Rendered in a portal because the form
        // sections live inside overflow-hidden accordions.
        return (
          <EditableMasterDropdown
            masterKey={field.masterKey}
            value={value ?? ''}
            onChange={onChange}
            placeholder={field.placeholder || `Select ${field.label}`}
            portal
          />
        );
      }
      return (
        <SelectInput {...shared}>
          <option value="">Select {field.label}</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </SelectInput>
      );
    case 'checkbox':
      // `invert` flips the checkbox semantics (ERP Proforma Invoice: the
      // "Shipping address different from billing" toggle is checked when the
      // shipping address DIFFERS, i.e. when shipSameAsBill is false).
      return (
        <label
          className={`flex items-center gap-2 cursor-pointer ${
            field.invert ? 'text-[13px] font-normal text-slate-700 pt-1' : 'text-xs font-semibold text-slate-600 pt-2'
          }`}
        >
          <input
            type="checkbox"
            checked={field.invert ? value === false : !!value}
            onChange={(e) => onChange(field.invert ? !e.target.checked : e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#0B4A3D] focus:ring-[#0B4A3D]"
          />
          {field.label}
        </label>
      );
    // ERP read-only auto-filled value (GSTIN/PAN/Email/Phone on the Proforma
    // Invoice General Information card): a non-editable grey chip.
    case 'display':
      return (
        <div className="w-full rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2 text-[13px] text-slate-600 min-h-[38px] flex items-center">
          {value || '—'}
        </div>
      );
    case 'hidden':
      return null;
    default:
      return (
        <TextInput type={field.type || 'text'} {...shared} placeholder={field.placeholder || ''} readOnly={field.readOnly} />
      );
  }
}

/**
 * Generic create/edit page for the Sales Execution modules.
 * props.config -> SALES_FORM_CONFIGS[moduleKey]
 */
export default function SalesFormPage({ config, service, navigateToList }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const emptyForm = () => {
    const form = { status: config.statuses[0] || 'draft' };
    form[config.dateKey] = new Date().toISOString().split('T')[0];
    // ERP behaviour: some modules auto-fill date fields on load (e.g. DC
    // pre-fills Dispatch Date = today, Expected Delivery = +5 days).
    if (config.defaults) {
      Object.entries(config.defaults).forEach(([key, fn]) => {
        if (form[key] == null) form[key] = typeof fn === 'function' ? fn() : fn;
      });
    }
    return form;
  };

  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [dynamicOptions, setDynamicOptions] = useState({});
  const [pendingFiles, setPendingFiles] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [clientRefreshKey, setClientRefreshKey] = useState(0);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // ERP loadFromCostWorkout: populate the Source Cost Workout select and, when a
  // workout is chosen, auto-fill the client, source CPR and line items.
  useEffect(() => {
    const dynamic = config.sections
      .flatMap((s) => s.fields)
      .find((f) => f.dynamicSource === 'costWorkouts');
    if (!dynamic) return undefined;
    let cancelled = false;
    costWorkoutService
      .listCws({ page: 0, size: 100 })
      .then((res) => {
        if (cancelled) return;
        const list = parseListResponse(res);
        setDynamicOptions((prev) => ({
          ...prev,
          costWorkouts: list.map((cw) => ({
            value: cw.cwNo || String(cw.id || ''),
            label: cw.cwNo || `CW-${cw.id || ''}`,
            cw
          }))
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [config]);

  const applyCostWorkout = (value) => {
    if (!value) {
      setField('sourceCw', '');
      setField('sourceCpr', '');
      return;
    }
    const option = (dynamicOptions.costWorkouts || []).find((o) => o.value === value);
    setField('sourceCw', value);
    if (!option?.cw) return;
    const cw = option.cw;
    if (cw.clientName) setField('clientName', cw.clientName);
    if (cw.client) setField('clientName', cw.client);
    if (cw.contactPerson) setField('contactPerson', cw.contactPerson);
    if (cw.email) setField('email', cw.email);
    if (cw.phone) setField('phone', cw.phone);
    if (cw.billingAddress || cw.address) setField('billingAddress', cw.billingAddress || cw.address);
    if (cw.shippingAddress) setField('shippingAddress', cw.shippingAddress);
    if (cw.sourceCpr || cw.prNo) setField('sourceCpr', cw.sourceCpr || cw.prNo);
    if (Array.isArray(cw.items) && cw.items.length > 0) {
      setItems(
        cw.items.map((it) => ({
          productId: it.productId || null,
          productName: it.productName || it.description || '',
          description: it.description || it.productName || '',
          sku: it.sku || it.drawingNo || '',
          hsn: it.hsn || '',
          unit: it.unit || it.uom || '',
          qty: Number(it.qty) || 1,
          rate: Number(it.rate || it.estimatedCost) || 0,
          discountPct: Number(it.discountPct) || 0,
          gstRate: Number(it.gstRate) || 18,
          amount: Number(it.amount) || 0
        }))
      );
    }
  };

  // ERP qtnShipCopyBill: when "Same as Billing" is checked, copy billing
  // address/city/state/PIN into the shipping fields.
  const handleShipSameAsBill = (checked) => {
    setField('shipSameAsBill', checked);
    if (checked) {
      setForm((prev) => ({
        ...prev,
        shipSameAsBill: true,
        shippingAddress: prev.billingAddress || prev.shippingAddress || '',
        shippingCity: prev.billingCity || prev.shippingCity || '',
        shippingState: prev.billingState || prev.shippingState || '',
        shippingPin: prev.billingPin || prev.shippingPin || ''
      }));
    }
  };

  // Auto-fill from a selected customer (mirrors the original ERP's CustomerLookup)
  const handleClientSelect = (customer) => {
    setField('clientId', customer.id);
    setField('clientName', customer.businessName || '');
    setField('contactPerson', customer.contactPerson || '');
    setField('phone', customer.phone || '');
    setField('email', customer.email || '');
    setField('gstin', customer.gstin || '');
    setField('pan', customer.pan || '');
    setField('city', customer.billingCity || '');
    setField('state', customer.billingState || '');
    setField('pin', customer.billingPin || '');
    setField('country', customer.country || 'India');
    setField('billingAddress', customer.billingAddress || '');
    setField('shippingAddress', customer.shippingAddress || customer.billingAddress || '');
    if (!form.paymentTerms) setField('paymentTerms', customer.paymentTerms || '');
  };

  // ERP "Create New Customer": persist a new customer, refresh the lookup and
  // auto-fill the form with the newly created customer's details.
  const handleClientCreated = (customer) => {
    setClientRefreshKey((k) => k + 1);
    handleClientSelect(customer);
  };

  // Prefill from a source document query param (e.g. ?inv=12, or ?from=inv&id=12
  // for the Payment Receipt form). Loads the source document and copies the
  // client details, line items, source reference and (where the ERP stores it)
  // the source type into the target form.
  useEffect(() => {
    if (isEdit) return undefined;
    const sourceKey = ['qtn', 'sc', 'so', 'dc', 'pi', 'inv', 'cn', 'pr'].find((k) => searchParams.get(k));
    const from = searchParams.get('from');
    const source = sourceKey || (from && SOURCE_SERVICES[from] ? from : null);
    const sourceId = source ? (sourceKey ? searchParams.get(sourceKey) : searchParams.get('id')) : null;
    if (!source || !sourceId || !SOURCE_SERVICES[source]) return undefined;
    let cancelled = false;
    SOURCE_SERVICES[source]
      .get(sourceId)
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data ?? res ?? {};
        const srcNo = raw[SOURCE_DOC_NO_KEY[source]] || raw.id || String(sourceId);
        const patch = { sourceRef: srcNo };
        const refField = TARGET_REF_FIELD[config.moduleKey]?.[source];
        if (refField) patch[refField] = srcNo;
        const srcString = TARGET_SOURCE_STRING[config.moduleKey]?.[source];
        if (srcString) patch.source = srcString;
        CLIENT_FIELDS.forEach((key) => {
          if (raw[key] != null && raw[key] !== '') patch[key] = raw[key];
        });
        if (config.moduleKey === 'paymentReceipt' && source === 'inv' && raw.grandTotal != null) {
          patch.amount = Number(raw.grandTotal);
        }
        if (config.moduleKey === 'creditNote' && source === 'inv' && raw.grandTotal != null) {
          patch.refundAmount = Number(raw.grandTotal);
        }
        setForm((prev) => ({ ...prev, ...patch }));
        if (config.showItems && Array.isArray(raw.items) && raw.items.length > 0) {
          setItems(
            raw.items.map((it) => ({
              productId: it.productId || null,
              productName: it.productName || it.description || '',
              description: it.description || it.productName || '',
              sku: it.sku || it.drawingNo || '',
              hsn: it.hsn || '',
              unit: it.unit || it.uom || '',
              qty: Number(it.qty) || 1,
              rate: Number(it.rate || it.estimatedCost) || 0,
              discountPct: Number(it.discountPct) || 0,
              gstRate: Number(it.gstRate) || 18,
              amount: Number(it.amount) || 0
            }))
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isEdit, searchParams, config.moduleKey, config.showItems]);

  // ERP qtnValidateNumber: quotation no must be a non-empty valid number string
  const validate = () => {
    if (config.docNoKey === 'quotationNo' && !String(form.quotationNo || '').trim()) {
      toast.error('Quotation No is required.');
      return false;
    }
    if (config.showClient && !form.clientName) {
      toast.error('Please select or enter a Client name.');
      return false;
    }
    if (config.showItems && items.length === 0) {
      toast.error('Add at least one item.');
      return false;
    }
    if (config.moduleKey === 'paymentReceipt' && (form.amount == null || Number(form.amount) <= 0)) {
      toast.error('Please enter a valid Amount Received.');
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!isEdit) {
      let cancelled = false;
      service
        .getNextNumber()
        .then((res) => {
          if (cancelled) return;
          const field = { quotationNo: 'quotationNo', scNo: 'scNo', soNo: 'soNo', dcNo: 'dcNo', piNo: 'piNo', invoiceNo: 'invoiceNo', receiptNo: 'receiptNo', cnNo: 'cnNo' }[config.docNoKey];
          const value = res?.data?.[field] || res?.data?.nextNumber;
          if (value) setForm((prev) => ({ ...prev, [config.docNoKey]: value }));
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [isEdit, service, config.docNoKey]);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    service
      .get(id)
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data ?? res ?? {};
        const toForm = {};
        const DATE_KEYS = new Set(['validTill', 'validity', 'dueDate', 'deliveryDate', 'dispatchDate', 'validUntil']);
        Object.keys(raw).forEach((key) => {
          if (typeof raw[key] === 'string' && (DATE_KEYS.has(key) || /Date$/.test(key))) {
            toForm[key] = raw[key].slice(0, 10);
          } else if (key === 'items') {
            return;
          } else {
            toForm[key] = raw[key];
          }
        });
        toForm.shipSameAsBill = !!raw.shipSameAsBill;
        // Flat-discount modules (DC — ERP behaviour) store a flat ₹ amount in
        // the `discount` field; the form's discount input binds to `discountPct`.
        // Percentage-discount modules (PI — ERP proforma Discount %) load the
        // stored discountPct directly so an edit-save never shrinks it.
        if (config.percentageDiscount) {
          toForm.discountPct = raw.discountPct != null && raw.discountPct !== '' ? Number(raw.discountPct) : 0;
        } else if (config.flatDiscount) {
          toForm.discountPct = raw.discount != null && raw.discount !== '' ? Number(raw.discount) : 0;
        }
        setForm({ status: config.statuses[0] || 'draft', ...toForm });
        setItems(Array.isArray(raw.items) ? raw.items : []);
        setAttachments(Array.isArray(raw.attachments) ? raw.attachments : []);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err?.message || 'Failed to load document');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setAttachmentsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, service, config.statuses, config.flatDiscount, config.percentageDiscount, toast]);

  const reloadAttachments = () => {
    service
      .getAttachments(id)
      .then((res) => setAttachments(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []))
      .catch(() => {});
  };

  const save = async ({ draft = false, submit = false, stay = false, view = false, quiet = false } = {}) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const serialize = SERIALIZERS[config.moduleKey];
      const payload = serialize(form, items);
      const res = isEdit ? await service.update(id, payload) : await service.create(payload, draft);
      const created = res?.data ?? {};
      const no = created[config.docNoKey] || form[config.docNoKey] || '';
      if (!isEdit && created?.id && pendingFiles.length > 0) {
        const results = await service.uploadMany(created.id, pendingFiles);
        const failed = results.filter((r) => !r.ok).length;
        const ok = results.length - failed;
        if (ok > 0) toast.success(`${ok} attachment(s) uploaded`);
        if (failed > 0) toast.error(`${failed} attachment(s) failed to upload`);
      }
      if (submit && created?.id) {
        await service.postAction(created.id, 'send');
      }
      toast.success(
        submit ? `${no} sent` : isEdit ? `${no} updated` : `${no} ${draft ? 'saved as draft' : 'created'}`
      );
      if (stay) {
        setForm(emptyForm());
        setItems([]);
        setPendingFiles([]);
        setAttachments([]);
        const next = await service.getNextNumber();
        const field = { quotationNo: 'quotationNo', scNo: 'scNo', soNo: 'soNo', dcNo: 'dcNo', piNo: 'piNo', invoiceNo: 'invoiceNo', receiptNo: 'receiptNo', cnNo: 'cnNo' }[config.docNoKey];
        if (next?.data?.[field]) setForm((prev) => ({ ...prev, [config.docNoKey]: next.data[field] }));
      } else if (view && created?.id) {
        // ERP proforma "Submit" / "Update & Close": open the saved document.
        navigate(`${navigateToList || `/${config.listRoute}`}/${created.id}`);
      } else if (!quiet) {
        navigate(navigateToList || `/${config.listRoute}`);
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ERP positioning: some modules (DC, PI) render the Item Details card in the
  // main column at a fixed index instead of the right sidebar.
  const renderItemsCard = () => (
    <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="flex items-center gap-3 text-sm font-bold text-slate-900">
          <span className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
            <Layers className="w-4 h-4" />
          </span>
          Item Details
        </h3>
      </div>
      <div className="p-4">
        <SalesItemGrid items={items} setItems={setItems} proforma={config.itemsVariant === 'proforma'} />
      </div>
    </div>
  );

  // ERP proforma footer button labels (config.footerLabels), with generic
  // defaults preserved so every other module keeps its current buttons.
  const labels = {
    draft: config.footerLabels?.draft ?? 'Save As Draft',
    createNew: config.footerLabels?.createNew ?? 'Save & Create New',
    primaryCreate: config.footerLabels?.primaryCreate ?? 'Save & Continue',
    primaryEdit: config.footerLabels?.primaryEdit ?? 'Update',
    secondaryEdit: config.footerLabels?.secondaryEdit
  };

  // ERP proforma: Attachments is the 7th main-column section (after Remarks);
  // other modules keep it as a full-width card below the form grid.
  const renderAttachmentsCard = () => (
    <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
      <h3 className="flex items-center gap-3 text-sm font-bold text-slate-900 mb-4">
        <span className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
          <Paperclip className="w-4 h-4" />
        </span>
        Attachments
      </h3>
      {attachmentsLoading ? (
        <div className="flex items-center justify-center py-10 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading attachments...
        </div>
      ) : isEdit ? (
        <SalesAttachments
          service={service}
          docId={id}
          attachments={attachments}
          onChanged={reloadAttachments}
        />
      ) : (
        <PendingAttachments files={pendingFiles} onChange={setPendingFiles} />
      )}
    </div>
  );

  const renderClientLookup = (section) => (
    <div className="space-y-4">
      {/* Fields marked `beforeLookup` render above the Client lookup (ERP PI:
          PI Number + Date sit at the top of the same General Information card). */}
      {section.fields.filter((f) => f.beforeLookup && f.type !== 'hidden' && (!f.visible || f.visible(form))).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {section.fields
            .filter((f) => f.beforeLookup && f.type !== 'hidden' && (!f.visible || f.visible(form)))
            .map((field) => (
              <FormField
                key={field.key}
                label={field.label}
                required={field.required}
                className={field.grid || ''}
              >
                {fieldControl(field, form[field.key], (value) => setField(field.key, value), dynamicOptions)}
              </FormField>
            ))}
        </div>
      )}
      <FormField
        label={config.clientLookupLabel || 'Client'}
        required={config.clientRequired !== false}
        hint="Type to search, or select an existing Client to auto-fill billing, shipping, GST, payment terms and contact details"
      >
        <ClientLookup
          value={form.clientName}
          onChange={(name) => setField('clientName', name)}
          onAutoFill={handleClientSelect}
          placeholder={config.clientLookupPlaceholder}
          refreshKey={clientRefreshKey}
          portal
        />
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {section.fields
          .filter((f) => !f.beforeLookup && f.type !== 'hidden' && (!f.visible || f.visible(form)))
          .map((field) =>
            field.hideLabel ? (
              <div key={field.key} className={field.grid || ''}>
                {fieldControl(field, form[field.key], (value) => setField(field.key, value), dynamicOptions)}
              </div>
            ) : (
              <FormField
                key={field.key}
                label={field.label}
                required={field.required}
                className={field.grid || ''}
              >
                {fieldControl(field, form[field.key], (value) => setField(field.key, value), dynamicOptions)}
              </FormField>
            )
          )}
      </div>
      {config.clientCreate && (
        <button
          type="button"
          className="flex items-center gap-1 text-[13px] font-medium text-[#0B4A3D] hover:underline mt-2 cursor-pointer bg-transparent border-none p-0 font-sans"
          onClick={() => setCustomerModalOpen(true)}
        >
          <Plus className="w-3.5 h-3.5" /> Create New Customer
        </button>
      )}
    </div>
  );

  const renderSection = (section) => (
    <Accordion key={section.title} title={section.title} icon={section.icon} defaultOpen>
      {section.clientLookup ? renderClientLookup(section) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {section.fields
            .filter((f) => f.type !== 'hidden' && (!f.visible || f.visible(form)))
            .map((field) =>
              field.hideLabel ? (
                <div key={field.key} className={field.grid || ''}>
                  {fieldControl(
                    field,
                    form[field.key],
                    (value) => {
                      if (field.dynamicSource === 'costWorkouts') return applyCostWorkout(value);
                      if (field.type === 'checkbox' && field.key === 'shipSameAsBill') return handleShipSameAsBill(value);
                      return setField(field.key, value);
                    },
                    dynamicOptions
                  )}
                </div>
              ) : (
                <FormField
                  key={field.key}
                  label={field.label}
                  required={field.required}
                  className={field.grid || ''}
                >
                  {fieldControl(
                    field,
                    form[field.key],
                    (value) => {
                      if (field.dynamicSource === 'costWorkouts') return applyCostWorkout(value);
                      if (field.type === 'checkbox' && field.key === 'shipSameAsBill') return handleShipSameAsBill(value);
                      return setField(field.key, value);
                    },
                    dynamicOptions
                  )}
                </FormField>
              )
            )}
        </div>
      )}
    </Accordion>
  );

  if (loading) {
    return (
      <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
        <div className="flex items-center justify-center py-24">
          <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-[#0B4A3D] animate-spin" />
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
        <span>Sales Execution</span>
        <span>&gt;</span>
        <span>{config.title}</span>
        <span>&gt;</span>
        <span className="text-slate-600">{isEdit ? 'Edit' : 'New'}</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-[#0B4A3D]" />
            {isEdit ? `Edit ${config.title}` : `Create ${config.title}`}
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-300" />
            Fields marked with <span className="text-rose-500">*</span> are required
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(navigateToList || `/${config.listRoute}`)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer select-none w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" /> Back to List
        </button>
      </div>

      {/* ===== TWO-COLUMN LAYOUT ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 min-w-0 space-y-4">
          {config.sections.map((section, index) => (
            <Fragment key={section.title}>
              {renderSection(section)}
              {/* ERP positioning: render Item Details in the main column after a
                  given section (config.itemsAfterIndex) instead of the sidebar. */}
              {config.showItems && config.itemsAfterIndex === index && renderItemsCard()}
            </Fragment>
          ))}
          {/* ERP proforma: Attachments renders as the 7th main-column section. */}
          {config.showAttachments && config.attachmentsInColumn && renderAttachmentsCard()}
        </div>

        {/* ===== RIGHT SIDEBAR: items (default) + totals ===== */}
        <div className="min-w-0">
          {config.showItems && config.itemsAfterIndex == null && (
            <div className="mb-4">{renderItemsCard()}</div>
          )}

          {config.showTotals && (
            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
              <h3 className="flex items-center gap-3 text-sm font-bold text-slate-900 mb-4">
                <span className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                  <Info className="w-4 h-4" />
                </span>
                Totals
              </h3>
              <SalesTotals
                items={items}
                discountPct={form.discountPct ?? 0}
                charges={form.charges ?? 0}
                freight={form.freight ?? 0}
                insurance={form.insurance ?? 0}
                onDiscountChange={(v) => setField('discountPct', v)}
                onChargesChange={(v) => setField('charges', v)}
                showRoundOff={config.showRoundOff}
                flatDiscount={config.flatDiscount}
                percentageDiscount={config.percentageDiscount}
                showWords={config.showWords}
              />
            </div>
          )}

          {/* ERP proforma: Status card in the right sidebar (below Totals). */}
          {config.sidebarStatus && (
            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5 mt-4">
              <h3 className="flex items-center gap-3 text-sm font-bold text-slate-900 mb-4">
                <span className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                  <Flag className="w-4 h-4" />
                </span>
                Status
              </h3>
              <div className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600">
                {form.status || 'Draft'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== ATTACHMENTS (full width below the grid unless rendered in-column) ===== */}
      {config.showAttachments && !config.attachmentsInColumn && (
        <div className="mt-6">{renderAttachmentsCard()}</div>
      )}

      {/* ===== STICKY FOOTER ===== */}
      <div className="sticky bottom-0 z-30 bg-surface border-t-2 border-slate-200 px-4 sm:px-6 py-3 mt-6 flex flex-wrap items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] rounded-t-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(navigateToList || `/${config.listRoute}`)}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" /> Back
          </button>
          {!isEdit && (
            <button
              type="button"
              onClick={() => save({ draft: true })}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-slate-400" /> {labels.draft}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {!isEdit && config.showSaveNew !== false && (
            <button
              type="button"
              onClick={() => save({ stay: true })}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" /> {labels.createNew}
            </button>
          )}
          {isEdit && labels.secondaryEdit && (
            <button
              type="button"
              onClick={() => save({ quiet: true })}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-slate-500" /> {labels.secondaryEdit}
            </button>
          )}
          <button
            type="button"
            onClick={() => save(config.submitToView ? { view: true } : {})}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#032f25] hover:bg-[#054133] px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> {isEdit ? labels.primaryEdit : labels.primaryCreate}
          </button>
          {config.canSend && !isEdit && config.showSend !== false && (
            <button
              type="button"
              onClick={() => save({ submit: true })}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Save &amp; Send
            </button>
          )}
        </div>
      </div>

      {/* ERP "Create New Customer": only rendered when the module opts in via
          config.clientCreate (e.g. Delivery Challan client-create link). */}
      {config.clientCreate && (
        <CreateCustomerModal
          open={customerModalOpen}
          onClose={() => setCustomerModalOpen(false)}
          onCreated={handleClientCreated}
        />
      )}
    </div>
  );
}
