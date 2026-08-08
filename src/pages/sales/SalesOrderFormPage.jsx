import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  ClipboardList,
  Copy,
  FileText,
  Info,
  Layers,
  Link as LinkIcon,
  Package,
  Plus,
  Save,
  Search,
  Settings,
  StickyNote,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { EditableMasterDropdown, FormField, SelectInput, TextArea, TextInput, useToast } from '../../components/Common';
import ClientLookup from '../../components/SalesForm/ClientLookup';
import CreateCustomerModal from '../../components/SalesForm/CreateCustomerModal';
import CurrencyDropdown from '../../components/SalesForm/CurrencyDropdown';
import { GST_RATES } from '../../constants/salesConstants';
import { computeTotals, lineAmount, round2, SERIALIZERS } from '../../utils/salesHelpers';
import salesOrderService from '../../services/salesOrderService';
import salesContractService from '../../services/salesContractService';
import quotationService from '../../services/quotationService';

function parseListResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.content)) return response.data.content;
  if (Array.isArray(response?.content)) return response.content;
  return [];
}

/**
 * Sales Order create/edit page — visual 1:1 with the ERP reference
 * (sales-order-create.html) using the Purchase-module design system.
 *
 *   1. "Sales Order" card
 *      - grid-2: Sales Order No, Customer PO
 *      - grid-3: Order Date, Lead No (text), Sales Contract Ref (text + Pick)
 *      - grid-3: Quotation Ref (readonly text), Status, Currency
 *      - Client Details party card (Client lookup, Client Name, Contact
 *        Person, Email|Phone, City|State text, Billing, Shipping, GSTIN|PAN,
 *        Payment Terms text)
 *      - Order Information party card (Sales Executive text, Delivery Date,
 *        Delivery Terms text)
 *   2. "Items" card (SO-specific grid: Item Description, HSN/SAC, UOM, Qty,
 *      Rate, Disc%, GST%, Amount, Total; toolbar Add New Line / Add
 *      Description / Duplicate)
 *   3. "Order Terms & Conditions" card (Terms & Conditions)
 *   4. "Remarks / Internal Notes" card (Remarks textarea)
 *   Sidebar: Totals (Sub Total, CGST, SGST, IGST, Discount flat ₹, Charges
 *   flat ₹, Grand Total, words) + Linked Documents.
 *
 * The Sales Contract Ref field is a text input with a search button opening
 * a searchable contract picker fed from the Sales Contract module; selecting
 * one auto-populates the order exactly like the ERP's contract-picker intent
 * (client, contacts, addresses, terms, taxes, remarks and items). All control
 * types (text / date / readonly / select / textarea) match the ERP page.
 */
const SO_STATUS_OPTIONS = ['Draft', 'Pending Review', 'Approved', 'In Progress', 'Completed', 'Cancelled'];

const HEADER_FIELDS = [
  { key: 'soNo', label: 'Sales Order No', type: 'text', placeholder: 'SO-YYYY-XXXXXX', required: true },
  { key: 'customerPo', label: 'Customer PO', type: 'text' }
];

const HEADER_ROW2 = [
  { key: 'orderDate', label: 'Order Date', type: 'date', required: true },
  { key: 'leadNo', label: 'Lead No', type: 'text', placeholder: 'LEAD-2026-XXXX' },
  { key: 'scRef', label: 'Sales Contract Ref', type: 'scPicker', placeholder: 'SC-2026-XXXX' }
];

const HEADER_ROW3 = [
  { key: 'qtnRef', label: 'Quotation Ref', type: 'text', placeholder: 'QT-2026-XXXX', readOnly: true },
  { key: 'status', label: 'Status', type: 'select', options: SO_STATUS_OPTIONS },
  { key: 'currency', label: 'Currency', type: 'currency', required: true }
];

const ORDER_FIELDS = [
  { key: 'salesExecutive', label: 'Sales Executive', type: 'text', placeholder: 'Assigned user' },
  { key: 'deliveryDate', label: 'Delivery Date', type: 'date' },
  { key: 'deliveryTerms', label: 'Delivery Terms', type: 'text', placeholder: 'e.g. FOB' }
];

const INPUT_CLS =
  'w-full bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-600/50 focus:bg-surface transition-all shadow-inner';

const TH_CLS = 'px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap';

/**
 * Sales Order–specific items grid matching ERP sales-order-create.html:
 * columns # | Item Description | HSN/SAC | UOM | Qty | Rate | Disc% | GST% |
 * Amount | Total | trash, with the ERP toolbar (Add New Line, Add Description,
 * Duplicate). Amount = qty × rate; Total = amount − discount + GST.
 */
function SalesOrderItemsGrid({ items = [], setItems }) {
  const addRow = () => {
    setItems([
      ...items,
      {
        productId: null,
        productName: '',
        description: '',
        hsn: '',
        unit: '',
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
            <col style={{ width: 95 }} />
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
                        placeholder="Description line..."
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
                    <EditableMasterDropdown
                      masterKey="units"
                      value={item.unit || ''}
                      onChange={(v) => updateRow(idx, { unit: v })}
                      placeholder="UOM"
                      portal
                      inputClassName={`${INPUT_CLS} w-20 cursor-text`}
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
                      value={item.discountPct ?? 0}
                      onChange={(e) => updateRow(idx, { discountPct: e.target.value })}
                      className={`${INPUT_CLS} text-right`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={item.gstRate ?? 0}
                      onChange={(e) => updateRow(idx, { gstRate: Number(e.target.value) })}
                      className={`${INPUT_CLS} cursor-pointer text-right`}
                    >
                      {GST_RATES.map((r) => (
                        <option key={r} value={r}>{r}%</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 pt-3 text-xs font-semibold text-slate-700 text-right whitespace-nowrap">
                    {fmt(round2(calc.qty * calc.rate))}
                  </td>
                  <td className="px-2 py-1.5 pt-3 text-xs font-bold text-slate-800 text-right whitespace-nowrap">
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
  return convert(n) + ' Rupees Only';
}

function fieldControl(field, value, onChange, openScPicker) {
  const shared = { value: value ?? '', onChange: (e) => onChange(e.target.value) };
  switch (field.type) {
    case 'textarea':
      return <TextArea rows={field.rows || 3} {...shared} placeholder={field.placeholder || ''} />;
    case 'scPicker':
      return (
        <div className="flex gap-2">
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || 'SC-2026-XXXX'}
            className={INPUT_CLS}
            aria-label="Sales Contract Ref"
          />
          <button
            type="button"
            onClick={openScPicker}
            title="Select Sales Contract"
            className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" /> Pick
          </button>
        </div>
      );
    case 'currency':
      return <CurrencyDropdown value={value ?? ''} onChange={onChange} placeholder="Currency" />;
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

export default function SalesOrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);
  const navigateToList = '/sales-orders';

  const emptyForm = () => {
    const form = { status: SO_STATUS_OPTIONS[0] || 'draft' };
    form.orderDate = new Date().toISOString().split('T')[0];
    return form;
  };

  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [contractOptions, setContractOptions] = useState([]);
  const [quotationOptions, setQuotationOptions] = useState([]);
  const [scPickerOpen, setScPickerOpen] = useState(false);
  const [scQuery, setScQuery] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [clientRefreshKey, setClientRefreshKey] = useState(0);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Every field just updates state; the Sales Contract picker handles auto-fill.
  const handleFieldChange = (field, value) => setField(field.key, value);

  // Feed the Sales Contract picker (approved/available contracts) and the
  // Linked Documents quotation lookup from their modules.
  useEffect(() => {
    let cancelled = false;
    salesContractService
      .list({ page: 0, size: 200 })
      .then((res) => {
        if (!cancelled) setContractOptions(parseListResponse(res));
      })
      .catch(() => {});
    quotationService
      .list({ page: 0, size: 200 })
      .then((res) => {
        if (!cancelled) setQuotationOptions(parseListResponse(res));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredContracts = useMemo(() => {
    const q = scQuery.trim().toLowerCase();
    if (!q) return contractOptions;
    return contractOptions.filter((c) => {
      const d = String(c.contractDate || c.date || c.scDate || '').toLowerCase();
      return (
        String(c.scNo || '').toLowerCase().includes(q) ||
        String(c.clientName || c.client || '').toLowerCase().includes(q) ||
        d.includes(q)
      );
    });
  }, [contractOptions, scQuery]);

  // ERP contract-picker style population: fill client, terms, remarks and
  // items from the selected Sales Contract.
  const applyContract = (value) => {
    const sc = contractOptions.find((c) => String(c.scNo ?? c.id) === String(value));
    setField('scRef', String(value));
    if (!sc) return;
    setField('clientId', sc.clientId ?? '');
    setField('clientName', sc.clientName || sc.client || '');
    if (sc.contactPerson) setField('contactPerson', sc.contactPerson);
    if (sc.email) setField('email', sc.email);
    if (sc.phone) setField('phone', sc.phone);
    if (sc.city) setField('city', sc.city);
    if (sc.state) setField('state', sc.state);
    if (sc.billingAddress) setField('billingAddress', sc.billingAddress);
    if (sc.shippingAddress) setField('shippingAddress', sc.shippingAddress);
    if (sc.gstin) setField('gstin', sc.gstin);
    if (sc.pan) setField('pan', sc.pan);
    if (sc.paymentTerms) setField('paymentTerms', sc.paymentTerms);
    if (sc.deliveryTerms) setField('deliveryTerms', sc.deliveryTerms);
    if (sc.salesExecutive || sc.salesPerson) setField('salesExecutive', sc.salesExecutive || sc.salesPerson);
    if (sc.qtnRef) setField('qtnRef', String(sc.qtnRef));
    if (sc.leadNo) setField('leadNo', String(sc.leadNo));
    if (sc.poRef || sc.poReference) setField('customerPo', sc.poRef || sc.poReference);
    const terms = [sc.commercialTerms, sc.scope, sc.exclusions].filter(Boolean).join('\n');
    if (terms || sc.terms) setField('terms', sc.terms || terms);
    if (sc.remarks) setField('remarks', sc.remarks);
    if (Array.isArray(sc.items) && sc.items.length > 0) {
      setItems(
        sc.items.map((it) => ({
          productId: it.productId || null,
          productName: it.productName || it.product || '',
          description: it.description || it.productName || it.product || '',
          hsn: it.hsn || '',
          unit: it.unit || it.uom || '',
          qty: Number(it.qty) || 1,
          rate: Number(it.rate || it.unitPrice || it.price) || 0,
          discountPct: Number(it.discountPct) || 0,
          gstRate: Number(it.gstRate || it.tax) || 18,
          amount: Number(it.amount) || 0
        }))
      );
    }
    toast.success(`Loaded data from Sales Contract: ${sc.scNo ?? sc.id}`);
  };

  const handlePickContract = (sc) => {
    applyContract(String(sc.scNo ?? sc.id));
    setScPickerOpen(false);
    setScQuery('');
  };

  // Auto-fill from a selected customer (mirrors the original ERP CustomerLookup)
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
    setField('billingAddress', customer.billingAddress || '');
    setField('shippingAddress', customer.shippingAddress || customer.billingAddress || '');
    if (!form.paymentTerms) setField('paymentTerms', customer.paymentTerms || '');
  };

  // After creating a new client: refresh the Client lookup list and auto-fill
  // the order with the newly created customer's details.
  const handleClientCreated = (customer) => {
    setClientRefreshKey((k) => k + 1);
    handleClientSelect(customer);
  };

  const validate = () => {
    if (!form.clientName) {
      toast.error('Please select or enter a Client name.');
      return false;
    }
    if (items.length === 0) {
      toast.error('Add at least one item.');
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!isEdit) {
      let cancelled = false;
      salesOrderService
        .getNextNumber()
        .then((res) => {
          if (cancelled) return;
          const value = res?.data?.soNo || res?.data?.nextNumber;
          if (value) setForm((prev) => ({ ...prev, soNo: value }));
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
    salesOrderService
      .get(id)
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data ?? res ?? {};
        const toForm = {};
        const DATE_KEYS = new Set(['orderDate', 'deliveryDate', 'dueDate', 'validUntil']);
        Object.keys(raw).forEach((key) => {
          if (key === 'items') return;
          if (typeof raw[key] === 'string' && (DATE_KEYS.has(key) || /Date$/.test(key))) {
            toForm[key] = raw[key].slice(0, 10);
          } else {
            toForm[key] = raw[key];
          }
        });
        // The flat Discount ₹ input holds form.discountPct, but the serializer
        // persists it as `discount` — map it back on load so edits prefill.
        if (raw.discount != null && toForm.discountPct == null) toForm.discountPct = raw.discount;
        setForm({ status: SO_STATUS_OPTIONS[0] || 'draft', ...toForm });
        setItems(Array.isArray(raw.items) ? raw.items : []);
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

  const save = async ({ draft = false, stay = false } = {}) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = SERIALIZERS.salesOrder(form, items);
      const res = isEdit ? await salesOrderService.update(id, payload) : await salesOrderService.create(payload, draft);
      const created = res?.data ?? {};
      const no = created.soNo || form.soNo || '';
      toast.success(isEdit ? `${no} updated` : `${no} ${draft ? 'saved as draft' : 'created'}`);
      if (stay) {
        setForm(emptyForm());
        setItems([]);
        const next = await salesOrderService.getNextNumber();
        if (next?.data?.soNo) setForm((prev) => ({ ...prev, soNo: next.data.soNo }));
      } else {
        navigate(navigateToList);
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ERP SO totals: Sub Total, CGST, SGST, IGST, Discount (flat ₹), Charges
  // (flat ₹), Grand Total, words. CGST/SGST = GST/2 like the ERP engine;
  // IGST displays the full GST for the row; Grand Total applies GST once.
  const t = computeTotals(items, { discountPct: 0, charges: 0 });
  const discountValue = Number(form.discountPct ?? 0);
  const chargesValue = Number(form.charges ?? 0);
  const grandTotal = round2(t.subTotal - discountValue + chargesValue + t.taxTotal);
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

  const linkedSc = contractOptions.find((c) => String(c.scNo ?? c.id) === String(form.scRef || ''));
  const linkedQtn = quotationOptions.find((q) => String(q.quotationNo ?? q.id) === String(form.qtnRef || ''));

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
      {/* ===== BREADCRUMB ===== */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
        <span>VISHAK TECH</span>
        <span>&gt;</span>
        <span>Sales Execution</span>
        <span>&gt;</span>
        <span>Sales Order</span>
        <span>&gt;</span>
        <span className="text-slate-600">{isEdit ? 'Edit' : 'New'}</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-[#0B4A3D]" />
            {isEdit ? 'Edit Sales Order' : 'Create Sales Order'}
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

      {/* ===== TWO-COLUMN LAYOUT: ERP SO sections + totals sidebar ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 min-w-0 space-y-4">
          {/* ===== SECTION 1: SALES ORDER ===== */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader icon={FileText} title="Sales Order" />
            <div className="p-5 space-y-4">
              {/* grid-2: SO No + Customer PO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {HEADER_FIELDS.map((field) => (
                  <FormField key={field.key} label={field.label} required={field.required}>
                    {fieldControl(
                      field,
                      form[field.key],
                      (value) => handleFieldChange(field, value),
                      () => setScPickerOpen(true)
                    )}
                  </FormField>
                ))}
              </div>
              {/* grid-3: Order Date + Lead No + Sales Contract Ref */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {HEADER_ROW2.map((field) => (
                  <FormField key={field.key} label={field.label} required={field.required}>
                    {fieldControl(
                      field,
                      form[field.key],
                      (value) => handleFieldChange(field, value),
                      () => setScPickerOpen(true)
                    )}
                  </FormField>
                ))}
              </div>
              {/* grid-3: Quotation Ref (readonly) + Status + Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {HEADER_ROW3.map((field) => (
                  <FormField key={field.key} label={field.label} required={field.required}>
                    {fieldControl(
                      field,
                      form[field.key],
                      (value) => handleFieldChange(field, value),
                      () => setScPickerOpen(true)
                    )}
                  </FormField>
                ))}
              </div>

              {/* sc-info-grid: Client Details + Order Information party cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
                {/* PARTY CARD: CLIENT DETAILS */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <h4 className="flex items-center gap-2 px-4 py-3 bg-slate-50/70 border-b border-slate-200 text-[13px] font-bold text-slate-800 select-none">
                    <Users className="w-4 h-4 text-[#0B4A3D]" /> Client Details
                  </h4>
                  <div className="p-4 space-y-3">
                    <FormField label="Client" required hint="Type to search, or select an existing Client to auto-fill billing, shipping, GST, payment terms and contact details">
                      <ClientLookup
                        value={form.clientName}
                        onChange={(name) => setField('clientName', name)}
                        onAutoFill={handleClientSelect}
                        refreshKey={clientRefreshKey}
                        portal
                      />
                    </FormField>
                    <FormField label="Client Name">
                      {fieldControl(
                        { key: 'clientName', label: 'Client Name', type: 'text', required: true },
                        form.clientName,
                        (value) => setField('clientName', value),
                        () => setScPickerOpen(true)
                      )}
                    </FormField>
                    <FormField label="Contact Person">
                      {fieldControl(
                        { key: 'contactPerson', label: 'Contact Person', type: 'text' },
                        form.contactPerson,
                        (value) => setField('contactPerson', value),
                        () => setScPickerOpen(true)
                      )}
                    </FormField>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="Email">
                        {fieldControl(
                          { key: 'email', label: 'Email', type: 'email' },
                          form.email,
                          (value) => setField('email', value),
                          () => setScPickerOpen(true)
                        )}
                      </FormField>
                      <FormField label="Phone">
                        {fieldControl(
                          { key: 'phone', label: 'Phone', type: 'text' },
                          form.phone,
                          (value) => setField('phone', value),
                          () => setScPickerOpen(true)
                        )}
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="City">
                        {fieldControl(
                          { key: 'city', label: 'City', type: 'text' },
                          form.city,
                          (value) => setField('city', value),
                          () => setScPickerOpen(true)
                        )}
                      </FormField>
                      <FormField label="State">
                        {fieldControl(
                          { key: 'state', label: 'State', type: 'text' },
                          form.state,
                          (value) => setField('state', value),
                          () => setScPickerOpen(true)
                        )}
                      </FormField>
                    </div>
                    <FormField label="Billing Address">
                      {fieldControl(
                        { key: 'billingAddress', label: 'Billing Address', type: 'textarea', rows: 2 },
                        form.billingAddress,
                        (value) => setField('billingAddress', value),
                        () => setScPickerOpen(true)
                      )}
                    </FormField>
                    <FormField label="Shipping Address">
                      {fieldControl(
                        { key: 'shippingAddress', label: 'Shipping Address', type: 'textarea', rows: 2 },
                        form.shippingAddress,
                        (value) => setField('shippingAddress', value),
                        () => setScPickerOpen(true)
                      )}
                    </FormField>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="GSTIN">
                        {fieldControl(
                          { key: 'gstin', label: 'GSTIN', type: 'text' },
                          form.gstin,
                          (value) => setField('gstin', value),
                          () => setScPickerOpen(true)
                        )}
                      </FormField>
                      <FormField label="PAN">
                        {fieldControl(
                          { key: 'pan', label: 'PAN', type: 'text' },
                          form.pan,
                          (value) => setField('pan', value),
                          () => setScPickerOpen(true)
                        )}
                      </FormField>
                    </div>
                    <FormField label="Payment Terms">
                      {fieldControl(
                        { key: 'paymentTerms', label: 'Payment Terms', type: 'text', placeholder: 'e.g. Net 30' },
                        form.paymentTerms,
                        (value) => setField('paymentTerms', value),
                        () => setScPickerOpen(true)
                      )}
                    </FormField>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[13px] font-medium text-[#0B4A3D] hover:underline mt-2 cursor-pointer bg-transparent border-none p-0 font-sans"
                      onClick={() => setCustomerModalOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5" /> Create New Customer
                    </button>
                  </div>
                </div>

                {/* PARTY CARD: ORDER INFORMATION */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <h4 className="flex items-center gap-2 px-4 py-3 bg-slate-50/70 border-b border-slate-200 text-[13px] font-bold text-slate-800 select-none">
                    <Settings className="w-4 h-4 text-[#0B4A3D]" /> Order Information
                  </h4>
                  <div className="p-4 space-y-3">
                    {ORDER_FIELDS.map((field) => (
                      <FormField key={field.key} label={field.label} required={field.required}>
                        {fieldControl(
                          field,
                          form[field.key],
                          (value) => handleFieldChange(field, value),
                          () => setScPickerOpen(true)
                        )}
                      </FormField>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== SECTION 2: ITEMS ===== */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader icon={Package} title="Items" />
            <div className="p-4">
              <SalesOrderItemsGrid items={items} setItems={setItems} />
            </div>
          </div>

          {/* ===== SECTION 3: ORDER TERMS & CONDITIONS ===== */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader icon={ClipboardList} title="Order Terms & Conditions" />
            <div className="p-5">
              <FormField label="Terms & Conditions">
                {fieldControl(
                  { key: 'terms', label: 'Terms & Conditions', type: 'textarea', rows: 3, placeholder: 'Enter order terms and conditions...' },
                  form.terms,
                  (value) => setField('terms', value),
                  () => setScPickerOpen(true)
                )}
              </FormField>
            </div>
          </div>

          {/* ===== SECTION 4: REMARKS / INTERNAL NOTES ===== */}
          <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <SectionHeader icon={StickyNote} title="Remarks / Internal Notes" />
            <div className="p-5">
              <TextArea
                rows={3}
                value={form.remarks || ''}
                onChange={(e) => setField('remarks', e.target.value)}
                placeholder="Additional notes or remarks..."
                className={INPUT_CLS}
              />
            </div>
          </div>
        </div>

        {/* ===== RIGHT SIDEBAR ===== */}
        <div className="min-w-0 space-y-4">
          {/* TOTALS — ERP SO: Sub Total, CGST, SGST, IGST, Discount (flat ₹),
              Charges (flat ₹), Grand Total, words */}
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
                <span className="font-bold text-slate-800">{fmt(t.subTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">CGST</span>
                <span className="font-bold text-slate-800">{fmt(t.cgstTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">SGST</span>
                <span className="font-bold text-slate-800">{fmt(t.sgstTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">IGST</span>
                <span className="font-bold text-slate-800">{fmt(t.taxTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-500">Discount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setField('discountPct', e.target.value)}
                  className="w-24 bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 text-xs text-slate-700 text-right outline-none focus:border-emerald-600/50 focus:bg-surface transition-all shadow-inner"
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
                  className="w-24 bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 text-xs text-slate-700 text-right outline-none focus:border-emerald-600/50 focus:bg-surface transition-all shadow-inner"
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
            {!linkedSc && !linkedQtn ? (
              <p className="text-xs text-slate-400 font-medium py-1">
                No linked documents yet. Select a Sales Contract to link it here.
              </p>
            ) : (
              <div className="space-y-2">
                {linkedSc && (
                  <button
                    type="button"
                    onClick={() => linkedSc.id && navigate(`/sales-contracts/${linkedSc.id}`)}
                    className="w-full flex items-center justify-between gap-2 text-left text-xs font-bold text-[#0B4A3D] bg-[#0B4A3D]/5 border border-[#0B4A3D]/15 px-3 py-2.5 rounded-lg hover:bg-[#0B4A3D]/10 transition-colors cursor-pointer"
                  >
                    <span>Sales Contract</span>
                    <span className="text-slate-600 font-semibold">{linkedSc.scNo ?? linkedSc.id}</span>
                  </button>
                )}
                {linkedQtn && (
                  <button
                    type="button"
                    onClick={() => linkedQtn.id && navigate(`/quotations/${linkedQtn.id}`)}
                    className="w-full flex items-center justify-between gap-2 text-left text-xs font-bold text-[#0B4A3D] bg-[#0B4A3D]/5 border border-[#0B4A3D]/15 px-3 py-2.5 rounded-lg hover:bg-[#0B4A3D]/10 transition-colors cursor-pointer"
                  >
                    <span>Quotation</span>
                    <span className="text-slate-600 font-semibold">{linkedQtn.quotationNo ?? linkedQtn.id}</span>
                  </button>
                )}
              </div>
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
            onClick={() => save({})}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#032f25] hover:bg-[#054133] px-5 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> {isEdit ? 'Update' : 'Save &amp; Finish'}
          </button>
        </div>
      </div>

      {/* ===== SALES CONTRACT PICKER MODAL (ERP: Select Sales Contract) ===== */}
      {scPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setScPickerOpen(false);
              setScQuery('');
            }
          }}
        >
          <div className="bg-surface border border-slate-200 rounded-2xl shadow-2xl w-full max-w-[650px] max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <FileText className="w-4 h-4 text-[#0B4A3D]" /> Select Sales Contract
              </h3>
              <button
                type="button"
                onClick={() => {
                  setScPickerOpen(false);
                  setScQuery('');
                }}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <input
                type="text"
                value={scQuery}
                onChange={(e) => setScQuery(e.target.value)}
                placeholder="Search by SC No, Customer, Date..."
                className={`${INPUT_CLS} mb-3`}
              />
              {filteredContracts.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-slate-400">No sales contracts found</div>
              )}
              <div className="space-y-1.5">
                {filteredContracts.map((sc) => (
                  <button
                    key={sc.id ?? sc.scNo}
                    type="button"
                    onClick={() => handlePickContract(sc)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#0B4A3D]/5 border border-transparent hover:border-[#0B4A3D]/20 transition-colors cursor-pointer"
                  >
                    <span className="block text-xs font-bold text-slate-800">
                      {sc.scNo ?? sc.id}
                      {(sc.clientName || sc.client) ? ` — ${sc.clientName || sc.client}` : ''}
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      {sc.contractDate || sc.date || sc.scDate ? `${String(sc.contractDate || sc.date || sc.scDate).slice(0, 10)}` : ''}
                      {sc.amount ? ` · ₹${Number(sc.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <CreateCustomerModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onCreated={handleClientCreated}
      />
    </div>
  );
}
