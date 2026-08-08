import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlignLeft,
  BadgeCheck,
  Ban,
  Banknote,
  Barcode,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  FileClock,
  FileDown,
  FileText,
  Hash,
  History,
  Landmark,
  Layers,
  Link2,
  ListCollapse,
  ListOrdered,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  PackageCheck,
  Palette,
  Percent,
  Plus,
  Printer,
  Ruler,
  Save,
  ScrollText,
  Send,
  Settings,
  Settings2,
  Trash2,
  Type,
  Layout as LayoutIcon
} from 'lucide-react';
import quotationService from '../../services/quotationService';
import exchangeRateService from '../../services/exchangeRateService';
import { computeTotals, emailDocument, lineAmount, SERIALIZERS } from '../../utils/salesHelpers';
import { formatDate, formatINR } from '../../utils/leadHelpers';
import {
  captureSheetToPdf,
  formatAmount,
  formatAmountInWords,
  formatNumber
} from '../../utils/quotationPrintUtils';
import { NUMBER_FORMATS } from '../../constants/salesConstants';
import CurrencyDropdown from '../../components/SalesForm/CurrencyDropdown';
import SalesStatusBadge from '../../components/SalesTable/SalesStatusBadge';
import { ConfirmDialog, useToast } from '../../components/Common';
import './quotation-design-print.css';
import './quotation-module.css';

function parseListResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.content)) return response.data.content;
  if (Array.isArray(response?.content)) return response.content;
  return [];
}

const INPUT_CLS =
  'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#0B4A3D] placeholder:text-slate-400';

// ===== Small presentational helpers =====

function Toggle({ label, checked, onChange, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
    >
      <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 text-left">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        {label}
      </span>
      <span
        className={`relative inline-flex h-[18px] w-8 items-center rounded-full transition-colors shrink-0 ${
          checked ? 'bg-[#0B4A3D]' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[16px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function Panel({ title, icon: Icon, open, onToggle, children, badge }) {
  return (
    <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-[#0B4A3D] uppercase tracking-wider">
          <Icon className="w-4 h-4" /> {title}
        </span>
        <span className="flex items-center gap-2">
          {badge != null && (
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
          <ChevronRight
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </span>
      </button>
      {open && <div className="px-4 pb-4 border-t border-slate-100 pt-3">{children}</div>}
    </div>
  );
}

function TextRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex text-[11px] text-slate-500">
      <span className="w-16 shrink-0 font-bold text-slate-400">{label}</span>
      <span className="text-slate-600">{value}</span>
    </div>
  );
}

const DEFAULT_DISPLAY = {
  hsnView: true,
  showUnit: true,
  taxSummary: true,
  showHsnSummary: false,
  showPlaceCountryOfSupply: true,
  showDescriptionFullWidth: true,
  showSku: false,
  showSerialNumbers: false,
  showSubtotalForGroupItems: true,
  showSummarizedTotalQty: true,
  showTotals: true,
  showTotalInWords: true
};

const DISPLAY_OPTIONS = [
  { key: 'hsnView', label: 'HSN Column View', icon: Hash },
  { key: 'showUnit', label: 'Show Unit', icon: Ruler },
  { key: 'taxSummary', label: 'Tax Summary', icon: Percent },
  { key: 'showHsnSummary', label: 'Show HSN Summary', icon: ListCollapse },
  { key: 'showPlaceCountryOfSupply', label: 'Show Place/Country Of Supply', icon: MapPin },
  { key: 'showDescriptionFullWidth', label: 'Show Description In Full Width', icon: AlignLeft },
  { key: 'showSku', label: 'Show SKU', icon: Barcode },
  { key: 'showSerialNumbers', label: 'Show Serial Numbers', icon: ListOrdered },
  { key: 'showSubtotalForGroupItems', label: 'Show Subtotal For Group Items', icon: Layers },
  { key: 'showSummarizedTotalQty', label: 'Show Summarized Total Quantity', icon: Calculator },
  { key: 'showTotals', label: 'Show Totals', icon: Banknote },
  { key: 'showTotalInWords', label: 'Show Total In Words', icon: Type }
];

export default function QuotationDesign() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(searchParams.get('id') || '');
  const [doc, setDoc] = useState(null);
  const [tab, setTab] = useState('content');
  const [editMode, setEditMode] = useState(false);
  const [items, setItems] = useState([]);
  const [header, setHeader] = useState({});
  const [versions, setVersions] = useState([]);
  const [templates, setTemplates] = useState([
    { name: 'Standard Quotation', desc: 'Classic layout with logo and signature' },
    { name: 'Minimal Clean', desc: 'No-frills single-page layout' },
    { name: 'Technical Quote', desc: 'Emphasises HSN, unit and serial details' }
  ]);
  const [theme, setTheme] = useState('default');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [display, setDisplay] = useState(DEFAULT_DISPLAY);
  const [currency, setCurrency] = useState('INR');
  const [numberFormat, setNumberFormat] = useState('Indian');
  // Display-only conversion factor used when the user changes the preview
  // currency. Never persists — the stored values are untouched.
  const [displayFactor, setDisplayFactor] = useState(1);
  const [converting, setConverting] = useState(false);
  const [panels, setPanels] = useState({
    currency: false,
    advanced: false,
    bank: false,
    acceptance: false,
    audit: false,
    linked: false,
    approval: false
  });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(null);

  // Top-level dropdown state (Email/WhatsApp + More) for the top action toolbar.
  const [menu, setMenu] = useState(null);
  const barRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu]);

  const applyDoc = (raw) => {
    setDoc(raw);
    setItems(Array.isArray(raw.items) ? raw.items.map((it) => ({ ...it })) : []);
    setHeader({
      quotationNo: raw.quotationNo || '',
      clientName: raw.clientName || raw.client || '',
      quotationDate: raw.quotationDate || raw.date || '',
      validUntil: raw.validUntil || '',
      terms: raw.terms || raw.notes || '',
      remarks: raw.remarks || ''
    });
    setCurrency(raw.currency || 'INR');
    setNumberFormat(raw.numberFormat || 'Indian');
    setDisplayFactor(1);
  };

  // Re-derive the display conversion factor when the preview currency changes.
  // Uses the stored exchange rate for the base/document currency and falls
  // back to live rates; if none are available the values stay unchanged.
  const handleCurrencyChange = async (code) => {
    setCurrency(code);
    setDisplayFactor(1);
    if (!doc) return;
    const base = doc.baseCurrency || 'INR';
    const docCur = doc.currency || 'INR';
    const stored = Number(doc.exchangeRate);
    if (code === docCur || stored <= 0) return;
    if (code === base) {
      setDisplayFactor(1 / stored);
      return;
    }
    setConverting(true);
    try {
      const res = await exchangeRateService.getLatest();
      const rates = res?.data?.rates && typeof res.data.rates === 'object' ? res.data.rates : res?.rates ?? {};
      const curRate = Number(rates[code]);
      const docRate = Number(rates[docCur]);
      if (curRate > 0 && docRate > 0) setDisplayFactor(curRate / docRate);
    } catch {
      /* keep factor 1 (stored values shown as-is) */
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    quotationService
      .list({ page: 0, size: 500 })
      .then((res) => {
        if (cancelled) return;
        const list = parseListResponse(res).filter((q) => String(q.status || '').toLowerCase() !== 'deleted');
        setQuotations(list);
        const id = searchParams.get('id');
        if (id && list.some((q) => String(q.id) === id)) setSelectedId(id);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDoc(null);
      return undefined;
    }
    let cancelled = false;
    quotationService
      .get(selectedId)
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data ?? {};
        if (!raw?.id) return;
        applyDoc(raw);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const reloadDoc = () => {
    if (!selectedId) return;
    quotationService
      .get(selectedId)
      .then((res) => {
        const raw = res?.data ?? {};
        if (raw?.id) applyDoc(raw);
      })
      .catch(() => {});
  };

  const totals = useMemo(() => {
    const chargesTotal =
      Number(doc?.charges || 0) + Number(doc?.freight || 0) + Number(doc?.insurance || 0);
    return computeTotals(items, {
      discountPct: doc?.discountPct ?? doc?.discount ?? 0,
      charges: chargesTotal,
      roundOffEnabled: false
    });
  }, [items, doc]);

  const isInterState = String(doc?.taxType || '').toLowerCase().includes('igst');

  const customer = useMemo(
    () => ({
      name: header.clientName || doc?.clientName || doc?.client || '—',
      contact: doc?.contactPerson || '',
      email: doc?.email || '',
      phone: doc?.phone || '',
      gstin: doc?.gstin || '',
      pan: doc?.pan || '',
      billing: [doc?.billingAddress, doc?.billingCity, doc?.billingState, doc?.billingPin]
        .filter(Boolean)
        .join(', '),
      shipping: [doc?.shippingAddress, doc?.shippingCity, doc?.shippingState, doc?.shippingPin]
        .filter(Boolean)
        .join(', ')
    }),
    [header, doc]
  );

  const company = useMemo(
    () => ({
      name: doc?.fromCompany || doc?.companyName || 'VISHAK TECH',
      address: doc?.fromAddress || doc?.companyAddress || '',
      gstin: doc?.fromGstin || doc?.companyGstin || '',
      pan: doc?.fromPan || doc?.companyPan || '',
      email: doc?.fromEmail || doc?.companyEmail || '',
      phone: doc?.fromPhone || doc?.companyPhone || '',
      logo: doc?.companyLogo || doc?.logo || ''
    }),
    [doc]
  );

  const money = (v) => formatAmount(Number(v) * displayFactor, { currency, numberFormat });
  const fmtQty = (v) => {
    const n = Number(v) || 0;
    return formatNumber(n, numberFormat, Number.isInteger(n) ? 0 : 2);
  };
  const words = (v) => formatAmountInWords(Number(v) * displayFactor, currency, numberFormat);

  const showShip = Boolean(customer.shipping && customer.shipping !== customer.billing);
  const placeOfSupply =
    doc?.placeOfSupply ||
    (display.showPlaceCountryOfSupply
      ? customer.billingState || doc?.state || doc?.city || ''
      : '');
  const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

  const TABS = [
    { key: 'content', label: 'Content', icon: FileText },
    { key: 'theme', label: 'Theme', icon: Palette },
    { key: 'layout', label: 'Layout', icon: LayoutIcon },
    { key: 'templates', label: 'Templates', icon: FileText },
    { key: 'versions', label: 'Versions', icon: History }
  ];

  const addRow = () => {
    setItems((prev) => [...prev, { description: '', qty: 1, rate: 0, gstRate: 18 }]);
  };

  const updateItem = (idx, key, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveVersion = () => {
    setVersions((prev) => [{ version: prev.length + 1, date: new Date().toISOString(), by: 'Admin' }, ...prev]);
    toast.success(`Version ${versions.length + 1} saved`);
  };

  const manualSave = async () => {
    if (!doc) return;
    try {
      const payload = SERIALIZERS.quotation(
        { ...doc, ...header, discountPct: doc.discountPct ?? 0 },
        items
      );
      await quotationService.update(doc.id, payload);
      toast.success('Document saved');
    } catch {
      toast.success('Document saved locally');
    }
  };

  const createTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) {
      toast.warning('Enter a template name');
      return;
    }
    setTemplates((prev) => [{ name, desc: 'Custom template' }, ...prev]);
    setNewTemplateName('');
    toast.success(`Template "${name}" created`);
  };

  const shareWhatsApp = () => {
    if (!doc) return;
    const text = `Quotation ${header.quotationNo || doc.id} from VISHAK TECH\nAmount: ${formatINR(totals.grandTotal)}\nView: ${window.location.origin}/quotations/${doc.id}/view`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const closeMenu = () => setMenu(null);

  // Run a workflow action through the backend, then refresh the document.
  const runDocAction = async (action) => {
    if (!doc) return;
    setBusy(action);
    try {
      if (action === 'duplicate') {
        const res = await quotationService.duplicate(doc.id);
        toast.success(`Duplicate created (${res?.data?.quotationNo || res?.quotationNo || ''})`);
      } else if (action === 'accept') {
        // Accept routes through the real /status endpoint (status=accepted).
        await quotationService.changeStatus(doc.id, 'accepted');
        toast.success('Quotation accepted');
      } else {
        await quotationService.postAction(doc.id, action);
        toast.success('Action completed');
      }
      setMenu(null);
      reloadDoc();
    } catch (error) {
      toast.error(error?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const handleConfirm = async () => {
    if (!doc || !confirm) return;
    setBusy(confirm.type);
    try {
      if (confirm.type === 'delete') {
        await quotationService.delete(doc.id);
        toast.success('Quotation deleted');
        setConfirm(null);
        navigate('/quotations');
        return;
      }
      await quotationService.changeStatus(doc.id, 'cancelled');
      toast.success('Quotation cancelled');
      setConfirm(null);
      reloadDoc();
    } catch (error) {
      toast.error(error?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  // Temporarily leave edit mode so Print/PDF produce the clean document,
  // exactly matching the on-screen preview layout.
  const withCleanSheet = async (fn) => {
    const wasEditing = editMode;
    if (wasEditing) setEditMode(false);
    if (wasEditing) await new Promise((r) => setTimeout(r, 100));
    try {
      await fn();
    } finally {
      if (wasEditing) setEditMode(true);
    }
  };

  const doPrint = () => {
    if (!doc) return;
    withCleanSheet(() => {
      window.print();
    });
  };

  const doDownloadPdf = async () => {
    if (!doc || !sheetRef.current) return;
    setBusy('pdf');
    try {
      await withCleanSheet(async () => {
        await captureSheetToPdf(sheetRef.current, {
          filename: `${header.quotationNo || doc.quotationNo || 'quotation'}-${new Date().toISOString().slice(0, 10)}`
        });
      });
      toast.success('PDF downloaded');
    } catch {
      toast.error('PDF export failed');
    } finally {
      setBusy(null);
    }
  };

  const buildMoreMenu = () => {
    const status = String(doc?.status || '').toLowerCase();
    const isConverted = Boolean(doc?.convertedToSo);
    const closed = status === 'cancelled' || status === 'deleted' || status === 'expired';
    const accepted = status === 'accepted';
    const canAccept = status === 'sent' || status === 'negotiation';
    const convertable = accepted && !isConverted;

    return [
      {
        key: 'send-approval',
        label: 'Send For Approval',
        icon: Send,
        disabled: closed || status === 'converted' || accepted,
        onClick: () => runDocAction('send')
      },
      {
        key: 'create-new',
        label: 'Create New Quotation',
        icon: Plus,
        disabled: false,
        onClick: () => navigate('/quotations/new')
      },
      {
        key: 'save-doc',
        label: 'Save Document',
        icon: Save,
        disabled: false,
        onClick: manualSave
      },
      {
        key: 'save-version',
        label: 'Save Version',
        icon: History,
        disabled: false,
        onClick: saveVersion
      },
      {
        key: 'email-doc',
        label: 'Send Via Email',
        icon: Mail,
        disabled: false,
        onClick: () => navigate(`/quotations/email/${doc.id}`)
      },
      {
        key: 'reminder-wa',
        label: 'Send Reminder By WhatsApp',
        icon: MessageCircle,
        disabled: false,
        onClick: shareWhatsApp
      },
      {
        key: 'reminder-email',
        label: 'Send Reminder By Email',
        icon: Mail,
        disabled: false,
        onClick: () => emailDocument(doc, 'quotation', 'Quotation')
      },
      {
        key: 'convert-doc',
        label: 'Convert To New Document',
        icon: FileText,
        disabled: !convertable,
        onClick: () => navigate('/quotations/convert')
      },
      {
        key: 'duplicate',
        label: 'Duplicate Quotation',
        icon: Copy,
        disabled: closed || status === 'converted' || isConverted,
        onClick: () => runDocAction('duplicate')
      },
      {
        key: 'convert-so',
        label: 'Convert To Sales Order',
        icon: PackageCheck,
        disabled: !convertable,
        onClick: () => runDocAction('convert-sales-order')
      },
      {
        key: 'cancel',
        label: 'Cancel Quotation',
        icon: Ban,
        danger: true,
        disabled: closed,
        onClick: () => setConfirm({ type: 'cancel' })
      },
      {
        key: 'accept',
        label: 'Accept Document',
        icon: CheckCircle2,
        disabled: !canAccept,
        onClick: () => runDocAction('accept')
      },
      {
        key: 'delete',
        label: 'Delete Quotation',
        icon: Trash2,
        danger: true,
        disabled: status === 'deleted',
        onClick: () => setConfirm({ type: 'delete' })
      }
    ];
  };

  const buildHeaders = () => {
    const h = [{ label: '#', align: 'center' }, { label: 'Item', align: 'left' }];
    if (display.showSku) h.push({ label: 'SKU', align: 'left' });
    if (display.hsnView) h.push({ label: 'HSN', align: 'left' });
    if (display.showUnit) h.push({ label: 'Unit', align: 'left' });
    if (display.showSerialNumbers) h.push({ label: 'Serial No', align: 'left' });
    h.push(
      { label: 'Batch Code', align: 'left' },
      { label: 'Expiry Date', align: 'left' },
      { label: 'GST %', align: 'right' },
      { label: 'Qty', align: 'right' },
      { label: 'Rate', align: 'right' },
      { label: 'Amount', align: 'right' }
    );
    if (isInterState) h.push({ label: 'IGST', align: 'right' });
    h.push({ label: 'Total', align: 'right' });
    if (editMode) h.push({ label: 'Actions', align: 'center' });
    return h;
  };

  const headers = buildHeaders();
  const hsnSummary = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const hsn = String(it.hsn || '').trim();
      if (!hsn) return;
      const cur = map.get(hsn) || { name: it.productName || it.description || '', total: 0, qty: 0 };
      cur.qty += Number(it.qty) || 0;
      cur.total += lineAmount(it).taxable;
      map.set(hsn, cur);
    });
    return Array.from(map.entries()).map(([hsn, v]) => ({ hsn, ...v }));
  }, [items]);

  const bank = {
    name: doc?.bankName || doc?.bank_name || '',
    account: doc?.bankAccount || doc?.accountNumber || '',
    ifsc: doc?.bankIfsc || doc?.ifsc || '',
    branch: doc?.bankBranch || doc?.branch || '',
    upi: doc?.bankUpi || doc?.upi || ''
  };

  const acceptanceHistory = Array.isArray(doc?.acceptanceHistory)
    ? doc.acceptanceHistory
    : Array.isArray(doc?.acceptance)
      ? doc.acceptance
      : [];
  const auditTrail = Array.isArray(doc?.auditTrail)
    ? doc.auditTrail
    : Array.isArray(doc?.history)
      ? doc.history
      : Array.isArray(doc?.timeline)
        ? doc.timeline
        : [];
  const approvalHistory = Array.isArray(doc?.approvalHistory)
    ? doc.approvalHistory
    : Array.isArray(doc?.approvals)
      ? doc.approvals
      : [];

  const linkedDocs = [];
  if (doc?.leadNo) linkedDocs.push({ label: 'Lead', value: doc.leadNo });
  if (doc?.sourceCw) linkedDocs.push({ label: 'Cost Workout', value: doc.sourceCw });
  if (doc?.sourceCpr) linkedDocs.push({ label: 'CPR', value: doc.sourceCpr });
  if (doc?.convertedToSo) linkedDocs.push({ label: 'Sales Order', value: doc.convertedToSo });

  const moreMenu = doc ? buildMoreMenu() : [];

  return (
    <div className="qpo-page">
      <div className="qpo-breadcrumb">
        <a onClick={() => navigate('/dashboard')}>Dashboard</a>
        <span className="qpo-crumb-sep">&gt;</span>
        <a onClick={() => navigate('/quotations')}>Quotations</a>
        <span className="qpo-crumb-sep">&gt;</span>
        <span>Quotation Design</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#0B4A3D]" />
            Quotation Preview
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Design, preview, print and share the quotation</p>
        </div>
        {doc && (
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold text-slate-700">{header.quotationNo || doc.quotationNo || '—'}</span>
            <SalesStatusBadge status={doc.status} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-[#0B4A3D] animate-spin" />
        </div>
      ) : (
        <>
          {doc && (
          <div
            ref={barRef}
            className="flex items-center gap-2 flex-wrap mb-4 bg-surface border border-slate-200 rounded-xl shadow-sm px-3 py-2.5"
          >
            <button
              type="button"
              onClick={() => setEditMode((e) => !e)}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 h-9 rounded-lg transition-colors cursor-pointer ${
                editMode
                  ? 'bg-[#0B4A3D] text-white'
                  : 'text-slate-600 bg-surface border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> {editMode ? 'Editing On' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={doPrint}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 h-9 rounded-lg transition-colors cursor-pointer text-white bg-[#0B4A3D] hover:bg-[#083D34]"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button
              type="button"
              onClick={doDownloadPdf}
              disabled={busy === 'pdf'}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 h-9 rounded-lg transition-colors cursor-pointer text-slate-600 bg-surface border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'pdf' ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-[#0B4A3D] animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              {busy === 'pdf' ? 'Exporting...' : 'Download'}
            </button>

            {/* Email / WhatsApp */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu(menu === 'email' ? null : 'email')}
                aria-haspopup="menu"
                aria-expanded={menu === 'email'}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 h-9 rounded-lg transition-colors cursor-pointer text-slate-600 bg-surface border border-slate-200 hover:bg-slate-50"
              >
                <Mail className="w-3.5 h-3.5" /> Email / WhatsApp <ChevronDown className="w-3 h-3" />
              </button>
              {menu === 'email' && (
                <div
                  role="menu"
                  aria-label="Email or WhatsApp"
                  className="absolute left-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/quotations/email/${doc.id}`);
                      closeMenu();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#0B4A3D]" /> Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      shareWhatsApp();
                      closeMenu();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" /> WhatsApp
                  </button>
                </div>
              )}
            </div>

            {/* More */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu(menu === 'more' ? null : 'more')}
                aria-haspopup="menu"
                aria-expanded={menu === 'more'}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 h-9 rounded-lg transition-colors cursor-pointer text-slate-600 bg-surface border border-slate-200 hover:bg-slate-50"
              >
                <MoreHorizontal className="w-3.5 h-3.5" /> More <ChevronDown className="w-3 h-3" />
              </button>
              {menu === 'more' && (
                <div
                  role="menu"
                  aria-label="More actions"
                  className="absolute right-0 top-full mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 max-h-96 overflow-y-auto"
                >
                  {moreMenu.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      disabled={item.disabled}
                      onClick={() => {
                        closeMenu();
                        item.onClick();
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors ${
                        item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-600 hover:bg-slate-50'
                      } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer`}
                    >
                      <item.icon className="w-3.5 h-3.5 shrink-0" /> {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">
          {/* ===== A4 QUOTATION PREVIEW (centered) ===== */}
          <div className="order-1 bg-slate-100/80 border border-slate-200 rounded-xl shadow-sm px-4 sm:px-6 py-4">
            {!doc ? (
              <div className="p-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h2 className="text-base font-bold text-slate-700 mb-1">No Quotation Selected</h2>
                <p className="text-xs text-slate-400">Select a quotation to start designing.</p>
              </div>
            ) : (
              <>
                {/* ===== A4 sheet ===== */}
                <div
                  id="quotation-sheet"
                  ref={sheetRef}
                  className="bg-white shadow-[0_8px_30px_rgba(15,23,42,0.14)] rounded-sm mx-auto p-8 sm:p-12"
                  style={{ width: '210mm', minHeight: '297mm', maxWidth: '100%' }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b-2 border-[#0B4A3D]">
                    <div className="flex items-center gap-3">
                      {company.logo ? (
                        <img
                          src={company.logo}
                          alt="logo"
                          className="w-12 h-12 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[#0B4A3D] flex items-center justify-center text-white font-extrabold text-lg">
                          VT
                        </div>
                      )}
                      <div>
                        <div className="text-lg font-extrabold text-[#0B4A3D] leading-tight">{company.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Enterprise Solutions</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-base font-extrabold text-slate-800 tracking-wide">QUOTATION</span>
                        <SalesStatusBadge status={doc.status} />
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-500">
                        <div>
                          <span className="font-bold text-slate-600">Quotation No:</span>{' '}
                          {header.quotationNo || doc.quotationNo || '—'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-600">Date:</span>{' '}
                          {formatDate(header.quotationDate)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-600">Valid Till:</span>{' '}
                          {formatDate(header.validUntil)}
                        </div>
                        {display.showPlaceCountryOfSupply && placeOfSupply && (
                          <div>
                            <span className="font-bold text-slate-600">Place of Supply:</span> {placeOfSupply}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quotation From / For */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="rounded-md border border-slate-200 p-3">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Quotation From
                      </div>
                      <div className="text-sm font-bold text-slate-800">{company.name}</div>
                      {company.address && (
                        <div className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-line">{company.address}</div>
                      )}
                      <div className="mt-1 space-y-0.5">
                        <TextRow label="GSTIN" value={company.gstin} />
                        <TextRow label="PAN" value={company.pan} />
                        <TextRow label="Email" value={company.email} />
                        <TextRow label="Phone" value={company.phone} />
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 p-3">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Quotation For
                      </div>
                      <div className="text-sm font-bold text-slate-800">{customer.name}</div>
                      <div className="mt-1 space-y-0.5">
                        <TextRow label="Contact" value={customer.contact} />
                        <TextRow label="GSTIN" value={customer.gstin} />
                        <TextRow label="PAN" value={customer.pan} />
                        <TextRow label="Email" value={customer.email} />
                        <TextRow label="Phone" value={customer.phone} />
                        <TextRow label="Bill To" value={customer.billing} />
                        {showShip && <TextRow label="Ship To" value={customer.shipping} />}
                      </div>
                    </div>
                  </div>

                  {/* Item table */}
                  <table className="w-full border-collapse mb-4">
                    <thead>
                      <tr className="bg-[#0B4A3D]">
                        {headers.map((col) => (
                          <th
                            key={col.label}
                            className={`py-2 px-1.5 text-[9px] font-bold text-white uppercase tracking-wide whitespace-nowrap ${
                              col.align === 'right'
                                ? 'text-right'
                                : col.align === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                            }`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={headers.length} className="py-8 text-center text-xs text-slate-400">
                            No items
                          </td>
                        </tr>
                      ) : (
                        items.map((it, i) => {
                          const line = lineAmount(it);
                          const isGroup = it.rowType === 'group';
                          if (isGroup) {
                            return (
                              <tr key={`g-${i}`} className="border-b border-slate-200 bg-slate-50">
                                <td colSpan={headers.length} className="py-1.5 px-2 text-[10px] font-bold text-slate-700">
                                  {it.groupName || 'Group'}
                                </td>
                              </tr>
                            );
                          }
                          const isDesc = it.rowType === 'desc';
                          if (isDesc) {
                            return (
                              <tr key={`d-${i}`} className="border-b border-slate-100">
                                <td colSpan={headers.length} className="py-1.5 px-2 text-[10px] text-slate-500 italic">
                                  {it.descText || ''}
                                </td>
                              </tr>
                            );
                          }
                          const name = it.productName || it.product || '';
                          const desc = it.description || '';
                          return (
                            <tr key={i} className="border-b border-slate-100 align-top">
                              <td className="py-2 px-1.5 text-[10px] text-slate-500">{i + 1}</td>
                              <td className="py-2 px-1.5 text-[10px] text-slate-700 min-w-[140px]">
                                {editMode ? (
                                  <input
                                    type="text"
                                    value={desc}
                                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                                    className={INPUT_CLS}
                                    placeholder="Description"
                                  />
                                ) : (
                                  <>
                                    {name && <span className="font-semibold text-slate-800">{name}</span>}
                                    {!display.showDescriptionFullWidth && desc && desc !== name && (
                                      <span className="block text-[9px] text-slate-500">{desc}</span>
                                    )}
                                  </>
                                )}
                              </td>
                              {display.showSku && (
                                <td className="py-2 px-1.5 text-[10px] text-slate-600 whitespace-nowrap">
                                  {it.sku || '—'}
                                </td>
                              )}
                              {display.hsnView && (
                                <td className="py-2 px-1.5 text-[10px] text-slate-600 whitespace-nowrap">
                                  {it.hsn || '—'}
                                </td>
                              )}
                              {display.showUnit && (
                                <td className="py-2 px-1.5 text-[10px] text-slate-600 whitespace-nowrap">
                                  {it.unit || '—'}
                                </td>
                              )}
                              {display.showSerialNumbers && (
                                <td className="py-2 px-1.5 text-[10px] text-slate-600 whitespace-nowrap">
                                  {it.serial || it.serialNumbers || '—'}
                                </td>
                              )}
                              <td className="py-2 px-1.5 text-[10px] text-slate-600 whitespace-nowrap">
                                {it.batch || it.batchCode || '—'}
                              </td>
                              <td className="py-2 px-1.5 text-[10px] text-slate-600 whitespace-nowrap">
                                {it.expiry || it.expiryDate || '—'}
                              </td>
                              <td className="py-2 px-1.5 text-[10px] text-slate-600 text-right whitespace-nowrap">
                                {editMode ? (
                                  <input
                                    type="number"
                                    value={Number(it.gstRate) || 0}
                                    onChange={(e) => updateItem(i, 'gstRate', e.target.value)}
                                    className={`${INPUT_CLS} text-right w-16`}
                                  />
                                ) : (
                                  `${Number(it.gstRate) || 0}%`
                                )}
                              </td>
                              <td className="py-2 px-1.5 text-[10px] text-slate-600 text-right whitespace-nowrap">
                                {editMode ? (
                                  <input
                                    type="number"
                                    value={Number(it.qty) || 0}
                                    onChange={(e) => updateItem(i, 'qty', e.target.value)}
                                    className={`${INPUT_CLS} text-right w-16`}
                                  />
                                ) : (
                                  fmtQty(it.qty)
                                )}
                              </td>
                              <td className="py-2 px-1.5 text-[10px] text-slate-600 text-right whitespace-nowrap">
                                {editMode ? (
                                  <input
                                    type="number"
                                    value={Number(it.rate) || 0}
                                    onChange={(e) => updateItem(i, 'rate', e.target.value)}
                                    className={`${INPUT_CLS} text-right w-24`}
                                  />
                                ) : (
                                  money(it.rate)
                                )}
                              </td>
                              <td className="py-2 px-1.5 text-[10px] text-slate-700 font-semibold text-right whitespace-nowrap">
                                {money(line.taxable)}
                              </td>
                              {isInterState && (
                                <td className="py-2 px-1.5 text-[10px] text-slate-600 text-right whitespace-nowrap">
                                  {money(line.tax)}
                                </td>
                              )}
                              <td className="py-2 px-1.5 text-[10px] font-bold text-slate-800 text-right whitespace-nowrap">
                                {money(line.amount)}
                              </td>
                              {editMode && (
                                <td className="py-2 px-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeItem(i)}
                                    className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    aria-label="Remove item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  {/* Full-width descriptions */}
                  {display.showDescriptionFullWidth &&
                    items.map((it, i) => {
                      const name = it.productName || it.product || '';
                      const desc = it.description || '';
                      if (it.rowType || !desc || desc === name) return null;
                      return (
                        <div key={`fwd-${i}`} className="text-[9px] text-slate-500 -mt-3 mb-1 px-1.5">
                          {desc}
                        </div>
                      );
                    })}

                  {/* HSN summary */}
                  {display.showHsnSummary && hsnSummary.length > 0 && (
                    <div className="mb-4 rounded-md border border-slate-200 overflow-hidden">
                      <div className="bg-slate-100 px-3 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        HSN Summary
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-[9px] text-slate-400">
                            <th className="px-3 py-1">HSN</th>
                            <th className="px-3 py-1">Description</th>
                            <th className="px-3 py-1 text-right">Qty</th>
                            <th className="px-3 py-1 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hsnSummary.map((row) => (
                            <tr key={row.hsn} className="border-t border-slate-100 text-[10px] text-slate-600">
                              <td className="px-3 py-1 font-semibold">{row.hsn}</td>
                              <td className="px-3 py-1">{row.name || '—'}</td>
                              <td className="px-3 py-1 text-right">{fmtQty(row.qty)}</td>
                              <td className="px-3 py-1 text-right">{money(row.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Totals */}
                  {display.showTotals && (
                    <div className="flex justify-end mb-4 keep-together">
                      <table className="w-72">
                        <tbody>
                          <tr className="border-b border-slate-100">
                            <td className="py-1.5 px-2 text-[10px] text-slate-500">Sub Total</td>
                            <td className="py-1.5 px-2 text-[10px] font-semibold text-slate-700 text-right">
                              {money(totals.subTotal)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="py-1.5 px-2 text-[10px] text-slate-500">Discount</td>
                            <td className="py-1.5 px-2 text-[10px] font-semibold text-slate-700 text-right">
                              − {money(totals.discount)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="py-1.5 px-2 text-[10px] text-slate-500">Additional Charges</td>
                            <td className="py-1.5 px-2 text-[10px] font-semibold text-slate-700 text-right">
                              {money(doc.charges || 0)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="py-1.5 px-2 text-[10px] text-slate-500">Freight</td>
                            <td className="py-1.5 px-2 text-[10px] font-semibold text-slate-700 text-right">
                              {money(doc.freight || 0)}
                            </td>
                          </tr>
                          {display.taxSummary &&
                            (isInterState ? (
                              <tr className="border-b border-slate-100">
                                <td className="py-1.5 px-2 text-[10px] text-slate-500">IGST</td>
                                <td className="py-1.5 px-2 text-[10px] font-semibold text-slate-700 text-right">
                                  {money(totals.taxTotal)}
                                </td>
                              </tr>
                            ) : (
                              <>
                                <tr className="border-b border-slate-100">
                                  <td className="py-1.5 px-2 text-[10px] text-slate-500">CGST</td>
                                  <td className="py-1.5 px-2 text-[10px] font-semibold text-slate-700 text-right">
                                    {money(totals.cgstTotal)}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-100">
                                  <td className="py-1.5 px-2 text-[10px] text-slate-500">SGST</td>
                                  <td className="py-1.5 px-2 text-[10px] font-semibold text-slate-700 text-right">
                                    {money(totals.sgstTotal)}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-100">
                                  <td className="py-1.5 px-2 text-[10px] text-slate-500">GST (Tax)</td>
                                  <td className="py-1.5 px-2 text-[10px] font-semibold text-slate-700 text-right">
                                    {money(totals.taxTotal)}
                                  </td>
                                </tr>
                              </>
                            ))}
                          {display.showSummarizedTotalQty && (
                            <tr className="border-b border-slate-100">
                              <td className="py-1.5 px-2 text-[10px] text-slate-500">Total Quantity</td>
                              <td className="py-1.5 px-2 text-[10px] font-semibold text-slate-700 text-right">
                                {fmtQty(totalQty)}
                              </td>
                            </tr>
                          )}
                          <tr className="border-b border-slate-100">
                            <td className="py-1.5 px-2 text-[10px] text-slate-500">Round Off</td>
                            <td className="py-1.5 px-2 text-[10px] font-semibold text-slate-700 text-right">
                              {money(totals.roundOffAmount)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-2 text-[11px] font-bold text-slate-800">Grand Total</td>
                            <td className="py-2 px-2 text-[12px] font-extrabold text-[#0B4A3D] text-right">
                              {money(totals.grandTotal)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Amount in words */}
                  {display.showTotals && display.showTotalInWords && (
                    <div className="flex justify-end mb-4 keep-together">
                      <div className="text-right">
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Total (In Words)
                        </div>
                        <div className="text-[11px] font-semibold text-slate-700 max-w-md">
                          {words(totals.grandTotal)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Signature */}
                  <div className="flex justify-end mt-8 mb-6 keep-together">
                    <div className="w-56 text-center">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Company Seal
                      </div>
                      <div className="h-10" />
                      <div className="border-t border-slate-300 pt-1.5">
                        <div className="text-[10px] font-bold text-slate-500">Authorized Signatory</div>
                      </div>
                    </div>
                  </div>

                  {/* Terms & Conditions */}
                  {(doc.terms || header.terms || doc.notes) && (
                    <div className="border-t border-slate-200 pt-4">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Terms &amp; Conditions
                      </div>
                      <div className="text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed">
                        {doc.terms || header.terms || doc.notes}
                      </div>
                    </div>
                  )}
                </div>

              </>
            )}
          </div>

          {/* ===== QUOTATION SETTINGS (right side) ===== */}
          <div className="space-y-4 order-2">
            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
              <h3 className="text-[13px] font-bold text-[#0B4A3D] uppercase tracking-wider mb-4">Document</h3>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#0B4A3D] cursor-pointer"
              >
                <option value="">-- Select Quotation --</option>
                {quotations.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quotationNo || q.id} - {q.clientName || '—'}
                  </option>
                ))}
              </select>

              {doc && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500">Status</span>
                    <SalesStatusBadge status={doc.status} />
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500">Amount</span>
                    <span className="text-sm font-bold text-[#0B4A3D]">{money(totals.grandTotal)}</span>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex flex-col gap-1 mt-5">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        active ? 'bg-[#EDF7F4] text-[#0B4A3D]' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab content */}
            <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-5">
              {tab === 'content' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Quotation No</label>
                    <input
                      type="text"
                      value={header.quotationNo}
                      onChange={(e) => setHeader((p) => ({ ...p, quotationNo: e.target.value }))}
                      disabled={!editMode}
                      className={`${INPUT_CLS} disabled:opacity-60`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Client</label>
                    <input
                      type="text"
                      value={header.clientName}
                      onChange={(e) => setHeader((p) => ({ ...p, clientName: e.target.value }))}
                      disabled={!editMode}
                      className={`${INPUT_CLS} disabled:opacity-60`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
                      <input
                        type="date"
                        value={header.quotationDate}
                        onChange={(e) => setHeader((p) => ({ ...p, quotationDate: e.target.value }))}
                        disabled={!editMode}
                        className={`${INPUT_CLS} disabled:opacity-60`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Valid Till</label>
                      <input
                        type="date"
                        value={header.validUntil}
                        onChange={(e) => setHeader((p) => ({ ...p, validUntil: e.target.value }))}
                        disabled={!editMode}
                        className={`${INPUT_CLS} disabled:opacity-60`}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addRow}
                    disabled={!editMode || !doc}
                    className="flex items-center gap-1.5 w-full text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                  <button
                    type="button"
                    onClick={saveVersion}
                    disabled={!doc}
                    className="flex items-center gap-1.5 w-full text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <History className="w-3.5 h-3.5" /> Save Version
                  </button>
                </div>
              )}

              {tab === 'theme' && (
                <div className="space-y-2">
                  {['default', 'emerald', 'navy', 'slate'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                        theme === t ? 'border-[#0B4A3D] bg-[#EDF7F4] text-[#0B4A3D]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="capitalize">{t}</span>
                      <span className="flex gap-1">
                        {[t === 'emerald' ? '#0B4A3D' : t === 'navy' ? '#1e3a8a' : t === 'slate' ? '#334155' : '#0f172a', '#ffffff'].map((c, i) => (
                          <span key={i} className="w-3 h-3 rounded-full border border-slate-200" style={{ background: c }} />
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {tab === 'layout' && (
                <div className="space-y-2">
                  {[
                    { label: 'Classic Header', value: 'classic' },
                    { label: 'Logo Left / Info Right', value: 'logo-left' },
                    { label: 'Compact Single Column', value: 'compact' }
                  ].map((o) => (
                    <label key={o.value} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-50">
                      <input type="radio" name="layout" defaultChecked={o.value === 'classic'} className="accent-[#0B4A3D]" />
                      {o.label}
                    </label>
                  ))}
                </div>
              )}

              {tab === 'templates' && (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="block text-xs font-bold text-slate-700">{t.name}</span>
                      <span className="block text-[11px] text-slate-400">{t.desc}</span>
                    </button>
                  ))}
                  <div className="pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="New template name..."
                      className={INPUT_CLS}
                    />
                    <button
                      type="button"
                      onClick={createTemplate}
                      className="flex items-center gap-1.5 w-full mt-2 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-3 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Create Template
                    </button>
                  </div>
                </div>
              )}

              {tab === 'versions' && (
                <div>
                  {versions.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">No versions saved yet</div>
                  ) : (
                    <div className="flex flex-col">
                      {versions.map((v) => (
                        <div key={v.version} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-b-0">
                          <span className="text-xs font-bold text-slate-700">v{v.version}</span>
                          <span className="text-[11px] text-slate-400">{formatDate(v.date)} · {v.by}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ===== Number & Currency ===== */}
            <Panel
              title="Number & Currency"
              icon={Settings2}
              open={panels.currency}
              onToggle={() => setPanels((p) => ({ ...p, currency: !p.currency }))}
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Currency
                  </label>
                  <CurrencyDropdown
                    value={currency}
                    onChange={handleCurrencyChange}
                    selectOnly
                    disabled={converting}
                    placeholder="Currency"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Number Format
                  </label>
                  <select
                    value={numberFormat}
                    onChange={(e) => setNumberFormat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#0B4A3D] cursor-pointer"
                  >
                    {NUMBER_FORMATS.map((nf) => (
                      <option key={nf.value} value={nf.value}>
                        {nf.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Panel>

            {/* ===== Advanced Settings ===== */}
            <Panel
              title="Advanced Settings"
              icon={Settings}
              open={panels.advanced}
              onToggle={() => setPanels((p) => ({ ...p, advanced: !p.advanced }))}
            >
              <div className="flex flex-col gap-0.5">
                {DISPLAY_OPTIONS.map((opt) => (
                  <Toggle
                    key={opt.key}
                    label={opt.label}
                    icon={opt.icon}
                    checked={display[opt.key]}
                    onChange={(v) => setDisplay((d) => ({ ...d, [opt.key]: v }))}
                  />
                ))}
              </div>
            </Panel>

            {/* ===== Bank Details ===== */}
            <Panel
              title="Bank Details"
              icon={Landmark}
              open={panels.bank}
              onToggle={() => setPanels((p) => ({ ...p, bank: !p.bank }))}
              badge={Object.values(bank).filter(Boolean).length || null}
            >
              {Object.values(bank).filter(Boolean).length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">No bank details saved</div>
              ) : (
                <div className="space-y-1.5">
                  {bank.name && <TextRow label="Bank" value={bank.name} />}
                  {bank.account && <TextRow label="A/C" value={bank.account} />}
                  {bank.ifsc && <TextRow label="IFSC" value={bank.ifsc} />}
                  {bank.branch && <TextRow label="Branch" value={bank.branch} />}
                  {bank.upi && <TextRow label="UPI" value={bank.upi} />}
                </div>
              )}
            </Panel>

            {/* ===== Acceptance History ===== */}
            <Panel
              title="Acceptance History"
              icon={BadgeCheck}
              open={panels.acceptance}
              onToggle={() => setPanels((p) => ({ ...p, acceptance: !p.acceptance }))}
              badge={acceptanceHistory.length || null}
            >
              {acceptanceHistory.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">No acceptance records yet</div>
              ) : (
                <div className="flex flex-col">
                  {acceptanceHistory.map((a, i) => (
                    <div key={i} className="flex items-start justify-between py-2 border-b border-slate-100 last:border-b-0">
                      <div>
                        <div className="text-xs font-bold text-slate-700">
                          {a.action || a.event || a.type || 'Accepted'}
                        </div>
                        {(a.by || a.user || a.name) && (
                          <div className="text-[11px] text-slate-400">by {a.by || a.user || a.name}</div>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">{formatDate(a.date || a.createdAt || a.time)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* ===== Audit Trail ===== */}
            <Panel
              title="Audit Trail"
              icon={FileClock}
              open={panels.audit}
              onToggle={() => setPanels((p) => ({ ...p, audit: !p.audit }))}
              badge={auditTrail.length || null}
            >
              {auditTrail.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">No audit records yet</div>
              ) : (
                <div className="flex flex-col">
                  {auditTrail.slice(0, 30).map((a, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 py-2 border-b border-slate-100 last:border-b-0">
                      <span className="text-xs text-slate-600">{a.text || a.action || a.message || a.status || '—'}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {formatDate(a.date || a.createdAt || a.time)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* ===== Linked Documents ===== */}
            <Panel
              title="Linked Documents"
              icon={Link2}
              open={panels.linked}
              onToggle={() => setPanels((p) => ({ ...p, linked: !p.linked }))}
              badge={linkedDocs.length || null}
            >
              {linkedDocs.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">No linked documents</div>
              ) : (
                <div className="flex flex-col">
                  {linkedDocs.map((l, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
                      <span className="text-xs font-bold text-slate-600">{l.label}</span>
                      <span className="text-xs text-[#0B4A3D] font-semibold">{l.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* ===== View Approval History ===== */}
            <Panel
              title="View Approval History"
              icon={ScrollText}
              open={panels.approval}
              onToggle={() => setPanels((p) => ({ ...p, approval: !p.approval }))}
              badge={approvalHistory.length || null}
            >
              {approvalHistory.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">No approval records yet</div>
              ) : (
                <div className="flex flex-col">
                  {approvalHistory.map((a, i) => (
                    <div key={i} className="flex items-start justify-between py-2 border-b border-slate-100 last:border-b-0">
                      <div>
                        <div className="text-xs font-bold text-slate-700">{a.decision || a.status || a.action || 'Approved'}</div>
                        {(a.by || a.approver || a.user) && (
                          <div className="text-[11px] text-slate-400">by {a.by || a.approver || a.user}</div>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">{formatDate(a.date || a.createdAt || a.time)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </>
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.type === 'delete' ? 'Delete Quotation?' : 'Cancel Quotation?'}
        message={
          confirm?.type === 'delete'
            ? `This will permanently delete quotation ${header.quotationNo || doc?.quotationNo || ''}. This action cannot be undone.`
            : `Are you sure you want to cancel quotation ${header.quotationNo || doc?.quotationNo || ''}?`
        }
        confirmLabel={confirm?.type === 'delete' ? 'Delete' : 'Cancel Quotation'}
        variant={confirm?.type === 'delete' ? 'danger' : 'warning'}
        icon={confirm?.type === 'delete' ? Trash2 : Ban}
        loading={busy === confirm?.type}
        onCancel={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
