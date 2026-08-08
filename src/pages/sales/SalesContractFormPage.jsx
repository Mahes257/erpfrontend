import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronDown,
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
  Settings,
  StickyNote,
  Trash2,
  Users
} from 'lucide-react';
import { Accordion, EditableMasterDropdown, FormField, SelectInput, TextArea, TextInput, useToast } from '../../components/Common';
import ClientLookup from '../../components/SalesForm/ClientLookup';
import CreateCustomerModal from '../../components/SalesForm/CreateCustomerModal';
import CurrencyDropdown from '../../components/SalesForm/CurrencyDropdown';
import useClickOutside from '../../hooks/useClickOutside';
import { GST_RATES } from '../../constants/salesConstants';
import { computeTotals, lineAmount, round2, SERIALIZERS } from '../../utils/salesHelpers';
import leadService from '../../services/leadService';
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
 * Sales Contract create/edit page — visual 1:1 with the ERP reference
 * (create-sales-contract.html) using the Purchase-module design system.
 *
 *   1. Sales Contract Information  (SC No, Customer PO Number, SC Date,
 *      Lead No dropdown, Quotation Ref dropdown)
 *   2. Client Details              (Client lookup, Name, Contact, Email,
 *      Phone, City text, State text, Billing, Shipping, GSTIN, PAN)
 *   3. Order Information           (Status select, Currency, Payment Terms,
 *      Delivery Terms, Sales Executive text inputs)
 *   4. Items                       (SC-specific grid: Item Description,
 *      HSN/SAC, UOM, Qty, Rate, Disc%, GST%, Amount, Total; toolbar
 *      Add New Line / Add Description / Duplicate)
 *   5. Contract Terms & Conditions (Validity date, Duration text, Warranty
 *      text — grid-3; Commercial Terms + Scope — grid-2; Exclusions full)
 *   6. Remarks / Internal Notes    (Remarks textarea)
 *   Sidebar: Totals (Sub Total, CGST, SGST, Discount flat ₹, Grand Total,
 *   words) + Linked Documents.
 *
 * The Lead No and Quotation Ref fields are searchable dropdowns fed from the
 * Leads and Quotations modules; selecting one auto-populates the contract
 * exactly like the ERP's loadFromLead / loadFromQuotation. All other control
 * types (text / date / select / textarea) match the ERP reference page exactly.
 */
const SC_STATUS_OPTIONS = [
  'Draft',
  'Submitted',
  'Pending Review',
  'Under Review',
  'Approved',
  'Signed',
  'Active',
  'Completed',
  'Expired',
  'Cancelled',
  'Rejected'
];

const SECTIONS = [
  {
    title: 'Sales Contract Information',
    icon: FileText,
    fields: [
      { key: 'scNo', label: 'SC No', type: 'text', placeholder: 'SC-YYYY-XXXXXX', required: true },
      { key: 'poRef', label: 'Customer PO Number (Optional)', type: 'text' },
      { key: 'contractDate', label: 'SC Date', type: 'date', required: true },
      { key: 'leadNo', label: 'Lead No', type: 'leadSelect' },
      { key: 'qtnRef', label: 'Quotation Ref', type: 'quotationSelect' }
    ]
  },
  {
    title: 'Client Details',
    icon: Users,
    clientLookup: true,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'hidden' },
      { key: 'clientName', label: 'Client Name', type: 'text', required: true },
      { key: 'contactPerson', label: 'Contact Person', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'billingAddress', label: 'Billing Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' },
      { key: 'shippingAddress', label: 'Shipping Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' },
      { key: 'gstin', label: 'GSTIN', type: 'text' },
      { key: 'pan', label: 'PAN', type: 'text' }
    ]
  },
  {
    title: 'Order Information',
    icon: Settings,
    fields: [
      { key: 'status', label: 'Status', type: 'select', options: SC_STATUS_OPTIONS, required: true },
      { key: 'currency', label: 'Currency', type: 'currency', required: true },
      { key: 'paymentTerms', label: 'Payment Terms', type: 'text', placeholder: 'e.g. Net 30' },
      { key: 'deliveryTerms', label: 'Delivery Terms', type: 'text', placeholder: 'e.g. FOB' },
      { key: 'salesExecutive', label: 'Sales Executive', type: 'text', placeholder: 'Assigned user' }
    ]
  },
  {
    title: 'Items',
    icon: Package,
    itemsSection: true
  },
  {
    title: 'Contract Terms & Conditions',
    icon: ClipboardList,
    termsGrid: true,
    fields: [
      { key: 'validity', label: 'Contract Validity', type: 'date', placeholder: 'Valid until' },
      { key: 'duration', label: 'Contract Duration', type: 'text', placeholder: 'e.g. 12 months, 2 years' },
      { key: 'warranty', label: 'Warranty Terms', type: 'text', placeholder: 'e.g. 1 year from delivery' },
      { key: 'commercialTerms', label: 'Commercial Terms', type: 'textarea', rows: 2, placeholder: 'Commercial terms and conditions...' },
      { key: 'scope', label: 'Scope of Supply', type: 'textarea', rows: 2, placeholder: 'Describe what is included in scope...' },
      { key: 'exclusions', label: 'Exclusions', type: 'textarea', rows: 2, placeholder: 'Items or services NOT included in this contract...' }
    ]
  },
  {
    title: 'Remarks / Internal Notes',
    icon: StickyNote,
    fields: [{ key: 'remarks', label: 'Remarks', type: 'textarea', rows: 3, grid: 'sm:col-span-2' }]
  }
];

const INPUT_CLS =
  'w-full bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-600/50 focus:bg-surface transition-all shadow-inner';

const TH_CLS = 'px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap';

/**
 * Sales Contract–specific items grid matching ERP create-sales-contract.html:
 * columns # | Item Description | HSN/SAC | UOM | Qty | Rate | Disc% | GST% |
 * Amount | Total | trash, with the ERP toolbar (Add New Line, Add Description,
 * Duplicate). Amount = qty × rate; Total = amount − discount + GST.
 */
function SalesContractItemsGrid({ items = [], setItems }) {
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

/**
 * Searchable "type-or-select" dropdown — the app's standard searchable-select
 * pattern (same as ClientLookup / the CPR combobox). Options are
 * { value, label } pairs; the list filters as you type, arrow keys navigate,
 * Enter/Tab select, Escape closes. The list renders in a fixed portal so the
 * Accordion's overflow-hidden never clips it. Choosing an option (or typing)
 * commits the raw value through onChange.
 */
function SearchableSelect({ value, onChange, options = [], placeholder = 'Type or select...' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useClickOutside(wrapRef, () => setOpen(false), open);

  const positionDd = () => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    let left = Math.max(8, rect.left);
    if (left + rect.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - rect.width - 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const ddHeight = 224;
    const top = spaceBelow < ddHeight && rect.top > ddHeight ? rect.top - ddHeight - 4 : rect.bottom + 4;
    const maxHeight = spaceBelow < ddHeight && rect.top > ddHeight ? Math.min(224, rect.top - 16) : Math.min(224, spaceBelow - 16);
    setPos({ left, width: rect.width, top, maxHeight });
  };

  useEffect(() => {
    if (!open) return undefined;
    positionDd();
    const onScroll = () => positionDd();
    const onResize = () => positionDd();
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label || o.value || '').toLowerCase().includes(q));
  }, [options, query]);

  const commit = (val) => {
    onChange(val);
    setQuery('');
    setOpen(false);
    setHighlight(-1);
  };

  const select = (opt) => commit(opt.value);

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h < filtered.length - 1 ? h + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h > 0 ? h - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && filtered[highlight]) select(filtered[highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setHighlight(-1);
    } else if (e.key === 'Tab') {
      if (highlight >= 0 && filtered[highlight]) select(filtered[highlight]);
    }
  };

  const selectedLabel = options.find((o) => String(o.value) === String(value))?.label || value || '';

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={open ? query : selectedLabel}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            // Commit any typed value on blur (mirrors the ERP combobox).
            if (query.trim() && query.trim() !== (value || '')) commit(query);
            else setOpen(false);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className={INPUT_CLS}
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>
      {open && filtered.length > 0 &&
        createPortal(
          <div
            className="fixed z-[9999] bg-surface border border-slate-200 rounded-lg shadow-lg overflow-y-auto"
            style={{
              left: pos?.left,
              width: pos?.width,
              top: pos?.top,
              maxHeight: pos?.maxHeight,
              display: pos ? 'block' : 'none'
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {filtered.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(opt);
                }}
                onClick={() => select(opt)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 text-xs font-medium text-slate-700 border-b border-slate-100 last:border-b-0 transition-colors cursor-pointer ${
                  i === highlight ? 'bg-[#0B4A3D]/10 text-[#0B4A3D]' : 'hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

function fieldControl(field, value, onChange, leadOptions, quotationOptions) {
  const shared = { value: value ?? '', onChange: (e) => onChange(e.target.value) };
  switch (field.type) {
    case 'textarea':
      return <TextArea rows={field.rows || 3} {...shared} placeholder={field.placeholder || ''} />;
    case 'leadSelect':
      return (
        <SearchableSelect
          value={value ?? ''}
          onChange={onChange}
          placeholder="Select Lead"
          options={leadOptions.map((l) => ({
            value: String(l.leadNo ?? l.id),
            label: `${l.leadNo ?? l.id}${l.company || l.companyName || l.businessName || l.name ? ` — ${l.company || l.companyName || l.businessName || l.name}` : ''}`
          }))}
        />
      );
    case 'quotationSelect':
      return (
        <SearchableSelect
          value={value ?? ''}
          onChange={onChange}
          placeholder="Select Quotation"
          options={quotationOptions.map((q) => ({
            value: String(q.quotationNo ?? q.id),
            label: `${q.quotationNo ?? q.id}${q.clientName || q.customerName || q.client ? ` — ${q.clientName || q.customerName || q.client}` : ''}`
          }))}
        />
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
      return <TextInput type={field.type || 'text'} {...shared} placeholder={field.placeholder || ''} />;
  }
}

export default function SalesContractFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);
  const navigateToList = '/sales-contracts';

  const emptyForm = () => {
    const form = { status: SC_STATUS_OPTIONS[0] || 'draft' };
    form.contractDate = new Date().toISOString().split('T')[0];
    return form;
  };

  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [leadOptions, setLeadOptions] = useState([]);
  const [quotationOptions, setQuotationOptions] = useState([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Lead No / Quotation Ref route to their module-linked auto-population
  // handlers; every other field just updates state.
  const handleFieldChange = (field, value) => {
    if (field.type === 'leadSelect') return applyLead(value);
    if (field.type === 'quotationSelect') return applyQuotation(value);
    return setField(field.key, value);
  };

  // Feed the Lead No / Quotation Ref dropdowns from the Leads and Quotations
  // modules.
  useEffect(() => {
    let cancelled = false;
    leadService
      .listLeads({ page: 0, size: 200 })
      .then((res) => {
        if (!cancelled) setLeadOptions(parseListResponse(res));
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

  // ERP loadFromLead: populate the client details from the selected Lead.
  const applyLead = (value) => {
    if (!value) {
      setField('leadNo', '');
      return;
    }
    const lead = leadOptions.find((l) => String(l.leadNo ?? l.id) === String(value));
    setField('leadNo', String(value));
    if (!lead) return;
    const company = lead.company || lead.companyName || lead.businessName || lead.organisation || '';
    setField('clientName', company || lead.name || lead.clientName || '');
    if (lead.name || lead.contactPerson) setField('contactPerson', lead.contactPerson || lead.name || '');
    if (lead.email) setField('email', lead.email);
    if (lead.phone || lead.mobile) setField('phone', lead.phone || lead.mobile || '');
    if (lead.city) setField('city', lead.city);
    if (lead.state) setField('state', lead.state);
    if (lead.address) setField('billingAddress', lead.address);
    if (lead.taxId || lead.gstin) setField('gstin', lead.taxId || lead.gstin || '');
    toast.success(`Loaded data from Lead: ${lead.leadNo ?? lead.id}`);
  };

  // ERP loadFromQuotation: populate the contract exactly like the reference.
  const applyQuotation = (value) => {
    const q = quotationOptions.find((x) => String(x.quotationNo ?? x.id) === String(value));
    setField('qtnRef', String(value));
    if (!q) return;
    setField('clientName', q.clientName || q.customerName || q.client || '');
    if (q.contactPerson) setField('contactPerson', q.contactPerson);
    if (q.email || q.clientEmail) setField('email', q.email || q.clientEmail);
    if (q.phone) setField('phone', q.phone);
    if (q.address || q.billingAddress) setField('billingAddress', q.address || q.billingAddress);
    if (q.paymentTerms) setField('paymentTerms', q.paymentTerms);
    if (q.deliveryTerms) setField('deliveryTerms', q.deliveryTerms);
    if (q.salesPerson || q.executive) setField('salesExecutive', q.salesPerson || q.executive);
    if (q.leadNo) setField('leadNo', String(q.leadNo));
    if (q.poRef || q.poReference) setField('poRef', q.poRef || q.poReference);
    if (q.gstin || q.gst) setField('gstin', q.gstin || q.gst);
    if (q.pan) setField('pan', q.pan);
    if (q.notes || q.remarks) setField('remarks', q.notes || q.remarks);
    // ERP sets scValidity to the quotation validity (falls back to validUntil)
    const validityValue = q.validUntil || q.expiryDate || q.validity;
    if (validityValue) setField('validity', String(validityValue).slice(0, 10));
    if (q.contractDuration || q.duration) setField('duration', q.contractDuration || q.duration);
    if (q.warrantyTerms || q.warranty) setField('warranty', q.warrantyTerms || q.warranty);
    if (q.commercialTerms) setField('commercialTerms', q.commercialTerms);
    if (q.scopeOfSupply || q.scope) setField('scope', q.scopeOfSupply || q.scope);
    if (q.exclusions) setField('exclusions', q.exclusions);
    if (Array.isArray(q.items) && q.items.length > 0) {
      setItems(
        q.items.map((it) => ({
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
    toast.success(`Loaded data from Quotation: ${q.quotationNo ?? q.id}`);
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
      salesContractService
        .getNextNumber()
        .then((res) => {
          if (cancelled) return;
          const value = res?.data?.scNo || res?.data?.nextNumber;
          if (value) setForm((prev) => ({ ...prev, scNo: value }));
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
    salesContractService
      .get(id)
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data ?? res ?? {};
        const toForm = {};
        const DATE_KEYS = new Set(['validity', 'contractDate', 'dueDate', 'deliveryDate', 'dispatchDate', 'validUntil']);
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
        setForm({ status: SC_STATUS_OPTIONS[0] || 'draft', ...toForm });
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
      const payload = SERIALIZERS.salesContract(form, items);
      const res = isEdit ? await salesContractService.update(id, payload) : await salesContractService.create(payload, draft);
      const created = res?.data ?? {};
      const no = created.scNo || form.scNo || '';
      toast.success(isEdit ? `${no} updated` : `${no} ${draft ? 'saved as draft' : 'created'}`);
      if (stay) {
        setForm(emptyForm());
        setItems([]);
        const next = await salesContractService.getNextNumber();
        if (next?.data?.scNo) setForm((prev) => ({ ...prev, scNo: next.data.scNo }));
      } else {
        navigate(navigateToList);
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ERP SC totals: Sub Total, CGST, SGST, Discount (flat ₹ input), Grand Total, words
  const t = computeTotals(items, { discountPct: 0, charges: 0 });
  const discountValue = Number(form.discountPct ?? 0);
  const grandTotal = round2(t.subTotal - discountValue + t.taxTotal);
  const totalWords = numberToWordsINR(grandTotal);

  if (loading) {
    return (
      <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
        <div className="flex items-center justify-center py-24">
          <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-[#0B4A3D] animate-spin" />
        </div>
      </div>
    );
  }

  const linkedQtn = quotationOptions.find((q) => String(q.quotationNo ?? q.id) === String(form.qtnRef || ''));

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
      {/* ===== BREADCRUMB ===== */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
        <span>VISHAK TECH</span>
        <span>&gt;</span>
        <span>Sales Execution</span>
        <span>&gt;</span>
        <span>Sales Contract</span>
        <span>&gt;</span>
        <span className="text-slate-600">{isEdit ? 'Edit' : 'New'}</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-[#0B4A3D]" />
            {isEdit ? 'Edit Sales Contract' : 'Create Sales Contract'}
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

      {/* ===== TWO-COLUMN LAYOUT: 6 ERP sections + totals sidebar ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 min-w-0 space-y-4">
          {SECTIONS.map((section) => (
            <Accordion key={section.title} title={section.title} icon={section.icon} defaultOpen>
              {section.itemsSection ? (
                <div className="p-4">
                  <SalesContractItemsGrid items={items} setItems={setItems} />
                </div>
              ) : section.clientLookup ? (
                <div className="space-y-4">
                  <FormField
                    label="Client"
                    required
                    hint="Type to search, or select an existing Client to auto-fill billing, shipping, GST, payment terms and contact details"
                  >
                    <ClientLookup
                      value={form.clientName}
                      onChange={(name) => setField('clientName', name)}
                      onAutoFill={handleClientSelect}
                      portal
                    />
                  </FormField>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {section.fields
                      .filter((f) => f.type !== 'hidden')
                      .map((field) => (
                        <FormField
                          key={field.key}
                          label={field.label}
                          required={field.required}
                          className={field.grid || ''}
                        >
                          {fieldControl(
                            field,
                            form[field.key],
                            (value) => handleFieldChange(field, value),
                            leadOptions,
                            quotationOptions
                          )}
                        </FormField>
                      ))}
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[13px] font-medium text-[#0B4A3D] hover:underline mt-2 cursor-pointer bg-transparent border-none p-0 font-sans"
                    onClick={() => setCustomerModalOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5" /> Create New Customer
                  </button>
                </div>
              ) : section.termsGrid ? (
                <div className="space-y-4">
                  {/* grid-3: Contract Validity | Contract Duration | Warranty Terms */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {section.fields
                      .filter((f) => f.type !== 'hidden')
                      .slice(0, 3)
                      .map((field) => (
                        <FormField key={field.key} label={field.label} required={field.required}>
                          {fieldControl(
                            field,
                            form[field.key],
                            (value) => handleFieldChange(field, value),
                            leadOptions,
                            quotationOptions
                          )}
                        </FormField>
                      ))}
                  </div>
                  {/* grid-2: Commercial Terms | Scope of Supply */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {section.fields
                      .filter((f) => f.type !== 'hidden')
                      .slice(3, 5)
                      .map((field) => (
                        <FormField key={field.key} label={field.label} required={field.required}>
                          {fieldControl(
                            field,
                            form[field.key],
                            (value) => handleFieldChange(field, value),
                            leadOptions,
                            quotationOptions
                          )}
                        </FormField>
                      ))}
                  </div>
                  {/* full-width: Exclusions */}
                  <FormField label="Exclusions">
                    {fieldControl(
                      section.fields[5],
                      form.exclusions,
                      (value) => setField('exclusions', value),
                      leadOptions,
                      quotationOptions
                    )}
                  </FormField>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {section.fields
                    .filter((f) => f.type !== 'hidden')
                    .map((field) => (
                      <FormField
                        key={field.key}
                        label={field.label}
                        required={field.required}
                        className={field.grid || ''}
                      >
                        {fieldControl(
                          field,
                          form[field.key],
                          (value) => handleFieldChange(field, value),
                          leadOptions,
                          quotationOptions
                        )}
                      </FormField>
                    ))}
                </div>
              )}
            </Accordion>
          ))}
        </div>

        {/* ===== RIGHT SIDEBAR ===== */}
        <div className="min-w-0 space-y-4">
          {/* TOTALS — ERP SC: Sub Total, CGST, SGST, Discount (flat ₹), Grand Total, words */}
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
                <span className="font-bold text-slate-800">
                  ₹{t.subTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">CGST</span>
                <span className="font-bold text-slate-800">
                  ₹{t.cgstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">SGST</span>
                <span className="font-bold text-slate-800">
                  ₹{t.sgstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
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
              <div className="border-t-2 border-slate-200 my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-900">Grand Total</span>
                <span className="font-bold text-slate-900">
                  ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
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
            {!linkedQtn ? (
              <p className="text-xs text-slate-400 font-medium py-1">
                No linked documents yet. Select a Quotation to link it here.
              </p>
            ) : (
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

      <CreateCustomerModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onCreated={handleClientSelect}
      />
    </div>
  );
}
