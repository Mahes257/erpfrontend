import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  ClipboardList,
  Copy,
  Info,
  Layers,
  Link as LinkIcon,
  List,
  Plus,
  Save,
  StickyNote,
  Trash2,
  Truck,
  Users
} from 'lucide-react';
import { FormField, SelectInput, TextArea, TextInput, useToast } from '../../components/Common';
import ClientLookup from '../../components/SalesForm/ClientLookup';
import CreateCustomerModal from '../../components/SalesForm/CreateCustomerModal';
import { TRANSPORT_COMPANIES } from '../../constants/salesConstants';
import { lineAmount, round2, SERIALIZERS } from '../../utils/salesHelpers';
import deliveryChallanService from '../../services/deliveryChallanService';
import salesOrderService from '../../services/salesOrderService';

function parseListResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.content)) return response.data.content;
  if (Array.isArray(response?.content)) return response.content;
  return [];
}

/**
 * Delivery Challan create/edit page — visual 1:1 with the ERP reference
 * (delivery-challan-create.html).
 *
 *   1. "Delivery Challan" card
 *      - grid-2: DC Number (readonly auto-generated), Sales Order (select)
 *      - grid-3: Date, Sales Contract Ref (readonly, auto-filled from SO),
 *        Status (Draft/Packed/Dispatched/In Transit/Delivered)
 *      - Client Details party card (Client lookup + Create New Customer,
 *        Customer Name, Contact Person, Email|Phone, Billing, Shipping,
 *        City|State)
 *      - Transport & Dispatch party card (Transport Company select, Vehicle
 *        Number, Driver Name|Driver Phone, LR Number, E-Way Bill|Dispatch
 *        Date, Expected Delivery)
 *   2. "Items" card (plain-text line grid matching the ERP: Description, HSN,
 *      UOM, Qty, Rate, Disc%, GST%, Amount, Total; toolbar Add New Line /
 *      Add Description / Duplicate). Amount = taxable; Total = taxable + GST.
 *   3. "Notes & Terms" card (Notes + Terms & Conditions)
 *   Sidebar: Totals (Sub Total, CGST, SGST, Discount flat ₹, Charges flat ₹,
 *   Grand Total, words) + Linked Documents.
 *
 * Auto-fill: Dispatch Date = today, Expected Delivery = today + 5 days (ERP
 * init). Selecting a Sales Order loads the client, SC ref, items, notes and
 * terms like the ERP's loadFromSO. Dates/status/validation match the ERP
 * DCCreate object exactly.
 */
const DC_STATUS_OPTIONS = ['Draft', 'Packed', 'Dispatched', 'In Transit', 'Delivered'];

const HEADER_FIELDS = [
  { key: 'dcNo', label: 'DC Number', type: 'text', placeholder: 'DC-YYYY-XXXXXX', required: true, readOnly: true },
  { key: 'soRef', label: 'Sales Order', type: 'soSelect' }
];

const HEADER_ROW2 = [
  { key: 'dcDate', label: 'Date', type: 'date', required: true },
  { key: 'scRef', label: 'Sales Contract Ref', type: 'text', readOnly: true, placeholder: 'Auto-filled from SO' },
  { key: 'status', label: 'Status', type: 'select', options: DC_STATUS_OPTIONS, required: true }
];

const INPUT_CLS =
  'w-full bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-600/50 focus:bg-surface transition-all shadow-inner';

// ERP party-card inputs (.sales-form-input): white bg, 1px #e5e7eb border,
// 8px radius, 8px 12px padding, 13px text, emerald focus ring. Inputs are
// 40px tall; textareas keep auto height.
const PARTY_FIELD_CLS =
  'w-full bg-surface border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 placeholder-slate-400 outline-none focus:border-[#0B4A3D] focus:ring-2 focus:ring-[#0B4A3D]/10 transition-all';
const PARTY_INPUT_CLS = `${PARTY_FIELD_CLS} h-10`;
const PARTY_TEXTAREA_CLS = PARTY_FIELD_CLS;

const TH_CLS = 'px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap';

/**
 * Delivery Challan–specific items grid matching ERP delivery-challan-create.html
 * (DCCreate.addRow): columns # | Item Description | HSN/SAC | UOM | Qty | Rate |
 * Disc% | GST% | Amount | Total | trash. Amount = taxable; Total = taxable + GST.
 */
function DeliveryChallanItemsGrid({ items = [], setItems }) {
  const addRow = () => {
    setItems([
      ...items,
      {
        productId: null,
        productName: '',
        description: '',
        hsn: '',
        unit: 'Nos',
        qty: 1,
        rate: 0,
        discountPct: 0,
        gstRate: 0,
        amount: 0
      }
    ]);
  };

  const addDescriptionRow = () => {
    setItems([...items, { rowType: 'description', description: '' }]);
  };

  const duplicateLast = () => {
    if (items.length === 0) return addRow();
    const last = { ...items[items.length - 1] };
    if (last.rowType) return addDescriptionRow();
    setItems([...items, { ...last, amount: 0 }]);
  };

  const updateRow = (index, patch) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    const row = next[index];
    if (row && row.rowType !== 'description') {
      row.amount = lineAmount(row).amount;
    }
    setItems(next);
  };

  const removeRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="qtn-items-toolbar flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-xs font-bold text-[#0B4A3D] bg-[#E8F0EE] hover:bg-[#D7E7E3] px-3 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add New Line
        </button>
        <button
          type="button"
          onClick={addDescriptionRow}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <ClipboardList className="w-3.5 h-3.5" /> Add Description
        </button>
        <button
          type="button"
          onClick={duplicateLast}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" /> Duplicate
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 940 }}>
          <colgroup>
            <col style={{ width: 50 }} />
            <col />
            <col style={{ width: 100 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 50 }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-50">
              <th className={TH_CLS}>#</th>
              <th className={`${TH_CLS} text-left`}>Item Description</th>
              <th className={TH_CLS}>HSN/SAC</th>
              <th className={TH_CLS}>UOM</th>
              <th className={`${TH_CLS} text-right`}>Qty</th>
              <th className={`${TH_CLS} text-right`}>Rate</th>
              <th className={`${TH_CLS} text-right`}>Disc%</th>
              <th className={`${TH_CLS} text-right`}>GST%</th>
              <th className={`${TH_CLS} text-right`}>Amount</th>
              <th className={`${TH_CLS} text-right`}>Total</th>
              <th className={TH_CLS} />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              if (item.rowType === 'description') {
                return (
                  <tr key={`d${idx}`} className="border-b border-slate-100 bg-amber-50/40">
                    <td className="px-2 py-1.5 text-xs text-slate-400 pt-3">{idx + 1}</td>
                    <td colSpan={9} className="px-2 py-1.5">
                      <TextArea
                        rows={1}
                        value={item.description || ''}
                        onChange={(e) => updateRow(idx, { description: e.target.value })}
                        placeholder="Description text (non-item)"
                        className={`${INPUT_CLS} resize-none`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        aria-label={`Remove row ${idx + 1}`}
                        className="p-1.5 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              }
              const calc = lineAmount(item);
              return (
                <tr key={idx} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-1.5 text-xs text-slate-400 pt-3">{idx + 1}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) => updateRow(idx, { description: e.target.value })}
                      placeholder="Item description"
                      className={INPUT_CLS}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={item.hsn || ''}
                      onChange={(e) => updateRow(idx, { hsn: e.target.value })}
                      placeholder="HSN"
                      className={INPUT_CLS}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={item.unit || ''}
                      onChange={(e) => updateRow(idx, { unit: e.target.value })}
                      placeholder="UOM"
                      className={`${INPUT_CLS} w-20`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      value={item.qty ?? 1}
                      onChange={(e) => updateRow(idx, { qty: e.target.value })}
                      className={`${INPUT_CLS} text-right`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate ?? 0}
                      onChange={(e) => updateRow(idx, { rate: e.target.value })}
                      className={`${INPUT_CLS} text-right`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.discountPct ?? 0}
                      onChange={(e) => updateRow(idx, { discountPct: e.target.value })}
                      className={`${INPUT_CLS} text-right`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.gstRate ?? 0}
                      onChange={(e) => updateRow(idx, { gstRate: e.target.value })}
                      className={`${INPUT_CLS} text-right`}
                    />
                  </td>
                  <td className="px-2 py-1.5 pt-3 text-xs font-semibold text-slate-700 text-right whitespace-nowrap">
                    {fmt(round2(calc.taxable))}
                  </td>
                  <td className="px-2 py-1.5 pt-3 text-xs font-bold text-[#0B4A3D] text-right whitespace-nowrap">
                    {fmt(calc.amount)}
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      aria-label={`Remove item ${idx + 1}`}
                      className="p-1.5 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-2 py-6 text-center text-xs text-slate-400">
                  No items added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function numberToWordsINR(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (num) => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convert(num % 100) : '');
    if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + convert(num % 100000) : '');
    return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + convert(num % 10000000) : '');
  };
  return 'Rupees ' + convert(n) + ' Only';
}

function fieldControl(field, value, onChange) {
  const shared = { value: value ?? '', onChange: (e) => onChange(e.target.value) };
  switch (field.type) {
    case 'textarea':
      return <TextArea rows={field.rows || 3} {...shared} placeholder={field.placeholder || ''} />;
    case 'hidden':
      return null;
    case 'select':
      return (
        <SelectInput {...shared}>
          <option value="">Select {field.label}</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </SelectInput>
      );
    default:
      return <TextInput type={field.type || 'text'} {...shared} placeholder={field.placeholder || ''} readOnly={field.readOnly} />;
  }
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 select-none">
      <div className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <span className="text-sm font-bold text-slate-900">{title}</span>
        {subtitle && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function DeliveryChallanFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);
  const navigateToList = '/delivery-challans';

  const emptyForm = () => {
    const form = { status: 'Dispatched' };
    const d = new Date();
    form.dcDate = d.toISOString().split('T')[0];
    form.dispatchDate = d.toISOString().split('T')[0];
    form.deliveryDate = new Date(d.getTime() + 5 * 86400000).toISOString().split('T')[0];
    return form;
  };

  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [soOptions, setSoOptions] = useState([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [clientRefreshKey, setClientRefreshKey] = useState(0);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFieldChange = (field, value) => setField(field.key, value);

  // Feed the Sales Order dropdown (approved/in-progress/completed SOs).
  useEffect(() => {
    let cancelled = false;
    salesOrderService
      .list({ page: 0, size: 200 })
      .then((res) => {
        if (cancelled) return;
        const all = parseListResponse(res);
        const s = (val) => String(val || '').toLowerCase();
        const filtered = all.filter((o) => {
          const st = s(o.status);
          return st === 'approved' || st === 'in progress' || st === 'in_progress' || st === 'completed';
        });
        setSoOptions(filtered);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const soOptionsByNo = useMemo(() => {
    const map = {};
    soOptions.forEach((o) => {
      map[String(o.soNo ?? o.id)] = o;
    });
    return map;
  }, [soOptions]);

  const handleClientSelect = (customer) => {
    setField('clientId', customer.id);
    setField('clientName', customer.businessName || '');
    setField('contactPerson', customer.contactPerson || '');
    setField('email', customer.email || '');
    setField('phone', customer.phone || '');
    setField('city', customer.city || customer.billingCity || '');
    setField('state', customer.state || customer.billingState || '');
    setField('billingAddress', customer.billingAddress || customer.address || '');
    setField('shippingAddress', customer.shippingAddress || customer.billingAddress || customer.address || '');
  };

  const handleClientCreated = (customer) => {
    setClientRefreshKey((k) => k + 1);
    handleClientSelect(customer);
  };

  // ERP loadFromSO: fill client, SC ref, items, notes and terms from the SO.
  const loadFromSO = (soValue) => {
    setField('soRef', soValue);
    if (!soValue) return;
    const so = soOptionsByNo[String(soValue)];
    if (!so) return;

    const customer = {
      id: so.clientId,
      businessName: so.clientName || so.client || '',
      contactPerson: so.contactPerson || '',
      email: so.email || '',
      phone: so.phone || '',
      city: so.city || '',
      state: so.state || '',
      billingAddress: so.billingAddress || '',
      shippingAddress: so.shippingAddress || so.billingAddress || ''
    };
    handleClientSelect(customer);
    setField('scRef', so.scRef || so.salesContract || so.contractRef || '');
    if (so.notes) setField('notes', so.notes);
    if (so.terms) setField('terms', so.terms);

    const soItems = Array.isArray(so.items) ? so.items : [];
    if (soItems.length > 0) {
      setItems(
        soItems.map((it) => ({
          productId: it.productId || null,
          productName: it.productName || it.product || '',
          description: it.description || it.productName || it.product || '',
          hsn: it.hsn || '',
          unit: it.unit || it.uom || 'Nos',
          qty: Number(it.qty) || 1,
          rate: Number(it.rate || it.unitPrice || it.price) || 0,
          discountPct: Number(it.discountPct || it.disc) || 0,
          gstRate: Number(it.gstRate || it.tax) || 0,
          amount: Number(it.amount) || 0
        }))
      );
    } else {
      setItems([]);
    }
    toast.success(`Loaded from Sales Order: ${so.soNo ?? soValue}`);
  };

  const validate = () => {
    const realItems = (Array.isArray(items) ? items : []).filter((i) => !i || !i.rowType || i.rowType === 'item');
    if (realItems.length === 0) {
      toast.error('Add at least one item');
      return false;
    }
    if (!form.clientName) {
      toast.error('Select a client');
      return false;
    }
    return true;
  };

  const resetForm = async () => {
    setForm({ ...emptyForm(), dcNo: '' });
    setItems([]);
    const next = await deliveryChallanService
      .getNextNumber()
      .then((res) => {
        const value = res?.data?.dcNo || res?.data?.nextNumber;
        if (value) setForm((prev) => ({ ...prev, dcNo: value }));
      })
      .catch(() => {});
    return next;
  };

  useEffect(() => {
    if (!isEdit) {
      let cancelled = false;
      deliveryChallanService
        .getNextNumber()
        .then((res) => {
          if (cancelled) return;
          const value = res?.data?.dcNo || res?.data?.nextNumber;
          if (value) setForm((prev) => ({ ...prev, dcNo: value }));
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    deliveryChallanService
      .get(id)
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data ?? res ?? {};
        const toForm = {};
        const DATE_KEYS = new Set(['dcDate', 'dispatchDate', 'deliveryDate']);
        Object.keys(raw).forEach((key) => {
          if (key === 'items') return;
          if (typeof raw[key] === 'string' && (DATE_KEYS.has(key) || /Date$/.test(key))) {
            toForm[key] = raw[key].slice(0, 10);
          } else {
            toForm[key] = raw[key];
          }
        });
        if (raw.discount != null && toForm.discountPct == null) toForm.discountPct = raw.discount;
        setForm({ status: 'Dispatched', ...toForm });
        setItems(
          (Array.isArray(raw.items) ? raw.items : []).map((it) => ({
            productId: it.productId || null,
            productName: it.productName || it.product || '',
            description: it.description || it.productName || it.product || '',
            hsn: it.hsn || '',
            unit: it.unit || it.uom || 'Nos',
            qty: Number(it.qty) || 1,
            rate: Number(it.rate || it.unitPrice || it.price) || 0,
            discountPct: Number(it.discountPct || it.disc) || 0,
            gstRate: Number(it.gstRate || it.tax) || 0,
            amount: Number(it.amount) || 0
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) toast.error(err?.message || 'Failed to load document');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, toast]);

  const save = async ({ draft = false, stay = false, view = false } = {}) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...SERIALIZERS.deliveryChallan(form, items) };
      if (draft) payload.status = 'Draft';
      const res = isEdit ? await deliveryChallanService.update(id, payload) : await deliveryChallanService.create(payload, draft);
      const created = res?.data ?? {};
      const no = created.dcNo || form.dcNo || '';
      toast.success(isEdit ? `${no} updated` : `${no} ${draft ? 'saved as draft' : 'created'}`);
      if (stay) {
        // Save & Create New → reset the form and stay on the page (ERP saveAndNew)
        await resetForm();
      } else if (view && created.id) {
        // Save & Finish → open the saved document (ERP saveAndView)
        navigate(`/delivery-challans/${created.id}`);
      } else {
        navigate(navigateToList);
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ERP DC totals: Sub Total = Σ taxable; CGST/SGST on taxable; Discount and
  // Charges are flat ₹ inputs; Grand Total = SubTotal + CGST + SGST − Discount
  // + Charges (never negative).
  const lines = (Array.isArray(items) ? items : []).filter((i) => !i || !i.rowType || i.rowType === 'item');
  const subTotal = round2(lines.reduce((sum, it) => sum + lineAmount(it).taxable, 0));
  const cgstTotal = round2(lines.reduce((sum, it) => sum + lineAmount(it).tax / 2, 0));
  const sgstTotal = round2(lines.reduce((sum, it) => sum + lineAmount(it).tax / 2, 0));
  const discountValue = Number(form.discountPct ?? 0);
  const chargesValue = Number(form.charges ?? 0);
  const grandTotal = round2(Math.max(0, subTotal + cgstTotal + sgstTotal - discountValue + chargesValue));
  const totalWords = numberToWordsINR(grandTotal);
  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

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
        <span>Delivery Challan</span>
        <span>&gt;</span>
        <span className="text-slate-600">{isEdit ? 'Edit' : 'New'}</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-[#0B4A3D]" />
            {isEdit ? 'Edit Delivery Challan' : 'Create Delivery Challan'}
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-300" />
            Fields marked with <span className="text-rose-500">*</span> are required
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(navigateToList)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer select-none w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" /> Back to List
        </button>
      </div>

      {/* ===== TWO-COLUMN LAYOUT: ERP DC sections + totals sidebar ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 min-w-0 space-y-4">
          {/* ===== SECTION 1: DELIVERY CHALLAN ===== */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader icon={Truck} title="Delivery Challan" />
            <div className="p-5 space-y-4">
              {/* grid-2: DC Number + Sales Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {HEADER_FIELDS.map((field) => (
                  <FormField key={field.key} label={field.label} required={field.required}>
                    {field.type === 'soSelect' ? (
                      <SelectInput
                        value={form.soRef ?? ''}
                        onChange={(e) => loadFromSO(e.target.value)}
                      >
                        <option value="">Select SO...</option>
                        {soOptions.map((o) => (
                          <option key={o.id ?? o.soNo} value={o.soNo ?? o.id}>
                            {o.soNo ?? o.id} - {o.clientName || o.client || ''}
                          </option>
                        ))}
                      </SelectInput>
                    ) : (
                      fieldControl(field, form[field.key], (value) => handleFieldChange(field, value), loadFromSO)
                    )}
                  </FormField>
                ))}
              </div>
              {/* grid-3: Date + SC Ref + Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {HEADER_ROW2.map((field) => (
                  <FormField key={field.key} label={field.label} required={field.required}>
                    {fieldControl(field, form[field.key], (value) => handleFieldChange(field, value))}
                  </FormField>
                ))}
              </div>
            </div>
          </div>

          {/* PARTY CARDS (ERP sc-info-grid): Client Details (minmax 650px/1fr) +
              Transport & Dispatch (320px), gap 20px */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
            {/* PARTY CARD: CLIENT DETAILS */}
            <div className="bg-surface border border-slate-200 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4 select-none">
                <Users className="w-4 h-4 text-[#0B4A3D]" /> Client Details
              </h4>
              <div className="space-y-3">
                <FormField label="Client" required hint="Type to search, or select an existing Client to auto-fill billing, shipping, contacts and addresses">
                  <ClientLookup
                    value={form.clientName}
                    onChange={(name) => setField('clientName', name)}
                    onAutoFill={handleClientSelect}
                    refreshKey={clientRefreshKey}
                    portal
                  />
                </FormField>
                <FormField label="Customer Name">
                  <TextInput
                    value={form.clientName ?? ''}
                    onChange={(e) => setField('clientName', e.target.value)}
                    placeholder="Customer name"
                    className={PARTY_INPUT_CLS}
                  />
                </FormField>
                <FormField label="Contact Person">
                  <TextInput
                    value={form.contactPerson ?? ''}
                    onChange={(e) => setField('contactPerson', e.target.value)}
                    placeholder="Contact person"
                    className={PARTY_INPUT_CLS}
                  />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Email">
                    <TextInput
                      type="email"
                      value={form.email ?? ''}
                      onChange={(e) => setField('email', e.target.value)}
                      placeholder="Email"
                      className={PARTY_INPUT_CLS}
                    />
                  </FormField>
                  <FormField label="Phone">
                    <TextInput
                      value={form.phone ?? ''}
                      onChange={(e) => setField('phone', e.target.value)}
                      placeholder="Phone"
                      className={PARTY_INPUT_CLS}
                    />
                  </FormField>
                </div>
                <FormField label="Billing Address">
                  <TextArea
                    rows={2}
                    value={form.billingAddress ?? ''}
                    onChange={(e) => setField('billingAddress', e.target.value)}
                    placeholder="Billing address"
                    className={PARTY_TEXTAREA_CLS}
                  />
                </FormField>
                <FormField label="Shipping Address">
                  <TextArea
                    rows={2}
                    value={form.shippingAddress ?? ''}
                    onChange={(e) => setField('shippingAddress', e.target.value)}
                    placeholder="Shipping address"
                    className={PARTY_TEXTAREA_CLS}
                  />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="City">
                    <TextInput
                      value={form.city ?? ''}
                      onChange={(e) => setField('city', e.target.value)}
                      placeholder="City"
                      className={PARTY_INPUT_CLS}
                    />
                  </FormField>
                  <FormField label="State">
                    <TextInput
                      value={form.state ?? ''}
                      onChange={(e) => setField('state', e.target.value)}
                      placeholder="State"
                      className={PARTY_INPUT_CLS}
                    />
                  </FormField>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-[13px] font-medium text-[#0B4A3D] hover:underline mt-2 cursor-pointer bg-transparent border-none p-0 font-sans"
                  onClick={() => setCustomerModalOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5" /> Create New Customer
                </button>
              </div>
            </div>

            {/* PARTY CARD: TRANSPORT & DISPATCH */}
            <div className="bg-surface border border-slate-200 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4 select-none">
                <Truck className="w-4 h-4 text-[#0B4A3D]" /> Transport &amp; Dispatch
              </h4>
              <div className="space-y-3.5">
                <FormField label="Transport Company">
                  <SelectInput
                    value={form.transportCompany ?? ''}
                    onChange={(e) => setField('transportCompany', e.target.value)}
                    className={PARTY_INPUT_CLS}
                  >
                    <option value="">Select...</option>
                    {TRANSPORT_COMPANIES.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Vehicle Number">
                  <TextInput
                    value={form.vehicleNumber ?? ''}
                    onChange={(e) => setField('vehicleNumber', e.target.value)}
                    placeholder="e.g. MH-01-AB-1234"
                    className={PARTY_INPUT_CLS}
                  />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Driver Name">
                    <TextInput
                      value={form.driverName ?? ''}
                      onChange={(e) => setField('driverName', e.target.value)}
                      placeholder="Driver name"
                      className={PARTY_INPUT_CLS}
                    />
                  </FormField>
                  <FormField label="Driver Phone">
                    <TextInput
                      value={form.driverPhone ?? ''}
                      onChange={(e) => setField('driverPhone', e.target.value)}
                      placeholder="Driver phone"
                      className={PARTY_INPUT_CLS}
                    />
                  </FormField>
                </div>
                <FormField label="LR Number">
                  <TextInput
                    value={form.lrNumber ?? ''}
                    onChange={(e) => setField('lrNumber', e.target.value)}
                    placeholder="LR number"
                    className={PARTY_INPUT_CLS}
                  />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="E-Way Bill No">
                    <TextInput
                      value={form.ewayBill ?? ''}
                      onChange={(e) => setField('ewayBill', e.target.value)}
                      placeholder="E-way bill number"
                      className={PARTY_INPUT_CLS}
                    />
                  </FormField>
                  <FormField label="Dispatch Date">
                    <TextInput
                      type="date"
                      value={form.dispatchDate ?? ''}
                      onChange={(e) => setField('dispatchDate', e.target.value)}
                      className={PARTY_INPUT_CLS}
                    />
                  </FormField>
                </div>
                <FormField label="Expected Delivery">
                  <TextInput
                    type="date"
                    value={form.deliveryDate ?? ''}
                    onChange={(e) => setField('deliveryDate', e.target.value)}
                    className={PARTY_INPUT_CLS}
                  />
                </FormField>
              </div>
            </div>
          </div>

          {/* ===== SECTION 2: ITEMS ===== */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader icon={List} title="Items" />
            <div className="p-4">
              <DeliveryChallanItemsGrid items={items} setItems={setItems} />
            </div>
          </div>

          {/* ===== SECTION 3: NOTES & TERMS ===== */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader icon={StickyNote} title="Notes & Terms" />
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Notes">
                  <TextArea
                    rows={3}
                    value={form.notes ?? ''}
                    onChange={(e) => setField('notes', e.target.value)}
                    placeholder="Internal notes..."
                    className={INPUT_CLS}
                  />
                </FormField>
                <FormField label="Terms & Conditions">
                  <TextArea
                    rows={3}
                    value={form.terms ?? ''}
                    onChange={(e) => setField('terms', e.target.value)}
                    placeholder="Terms and conditions..."
                    className={INPUT_CLS}
                  />
                </FormField>
              </div>
            </div>
          </div>
        </div>

        {/* ===== RIGHT SIDEBAR ===== */}
        <div className="min-w-0 space-y-4">
          {/* TOTALS — ERP DC: Sub Total, CGST, SGST, Discount (flat ₹), Charges
              (flat ₹), Grand Total, words */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
            <h3 className="flex items-center gap-3 text-sm font-bold text-slate-900 mb-4">
              <span className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                <Info className="w-4 h-4" />
              </span>
              Totals
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Sub Total</span>
                <span className="font-bold text-slate-800">{fmt(subTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">CGST</span>
                <span className="font-bold text-slate-800">{fmt(cgstTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">SGST</span>
                <span className="font-bold text-slate-800">{fmt(sgstTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-500">Discount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setField('discountPct', e.target.value)}
                  className="w-[100px] bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 text-xs text-slate-700 text-right outline-none focus:border-emerald-600/50 focus:bg-surface transition-all shadow-inner"
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-500">Charges</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={chargesValue}
                  onChange={(e) => setField('charges', e.target.value)}
                  className="w-[100px] bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 text-xs text-slate-700 text-right outline-none focus:border-emerald-600/50 focus:bg-surface transition-all shadow-inner"
                />
              </div>
              <div className="border-t-2 border-slate-200 my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-900">Grand Total</span>
                <span className="font-bold text-slate-900">{fmt(grandTotal)}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium pt-1">{totalWords}</p>
            </div>
          </div>

          {/* LINKED DOCUMENTS */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
            <h3 className="flex items-center gap-3 text-sm font-bold text-slate-900 mb-4">
              <span className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                <LinkIcon className="w-4 h-4" />
              </span>
              Linked Documents
            </h3>
            {form.soRef ? (
              <p className="text-xs text-slate-400 font-medium py-1">
                Linked to Sales Order: <span className="text-slate-600 font-semibold">{form.soRef}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400 font-medium py-1">No linked documents</p>
            )}
          </div>
        </div>
      </div>

      {/* ===== STICKY FOOTER (ERP: Back | Save As Draft · Save & Create New · Save & Finish) ===== */}
      <div className="sticky bottom-0 z-30 bg-surface border-t-2 border-slate-200 px-4 sm:px-6 py-3 mt-6 flex flex-wrap items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] rounded-t-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(navigateToList)}
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
              <Save className="w-3.5 h-3.5 text-slate-400" /> Save As Draft
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {!isEdit && (
            <button
              type="button"
              onClick={() => save({ stay: true })}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" /> Save &amp; Create New
            </button>
          )}
          <button
            type="button"
            onClick={() => save({ view: true })}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#032f25] hover:bg-[#054133] px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> {isEdit ? 'Update' : 'Save &amp; Finish'}
          </button>
        </div>
      </div>

      <CreateCustomerModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onCreated={handleClientCreated}
      />
    </div>
  );
}
