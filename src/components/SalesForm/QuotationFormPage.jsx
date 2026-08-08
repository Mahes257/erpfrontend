import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  BookUser,
  Building2,
  Calculator,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Coins,
  Columns,
  Copy,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Layers,
  List,
  Lock,
  MapPin,
  Package,
  Paperclip,
  PenLine,
  Plus,
  PlusCircle,
  Save,
  Scale,
  Search,
  Settings,
  StickyNote,
  Trash2,
  Truck,
  Undo2,
  User,
  X
} from 'lucide-react';
import { EditableMasterDropdown, useToast, useExchangeRates } from '../Common';
import ClientLookup from './ClientLookup';
import CurrencyDropdown from './CurrencyDropdown';
import NumberCurrencyModal from './NumberCurrencyModal';
import ColumnsFormulaModal from './ColumnsFormulaModal';
import UomManagerModal from './UomManagerModal';
import quotationService from '../../services/quotationService';
import costWorkoutService from '../../services/costWorkoutService';
import productService from '../../services/productService';
import { serializeQuotation } from '../../utils/salesHelpers';
import { NUMBER_FORMATS, SIGNATURE_TYPES, TAX_TYPES } from '../../constants/salesConstants';
import {
  loadColumnConfig,
  loadNumberSettings,
  saveNumberSettings,
  formatCellValue,
  formatMoney,
  evaluateFormula
} from '../../utils/quotationGrid';
import '../../pages/sales/quotation-create.css';

// =====================================================================
// ERP-identical Create Quotation page. The layout below is a line-for-line
// reproduction of the original ERP quotation-create.html using the same
// class names (qtn-*, item-table-*, sh-total-*) so it renders pixel-identical.
// Business logic (serializer, service, validation) is unchanged.
// =====================================================================

let uid = 0;
const nextId = () => ++uid;

function parseListResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.content)) return response.data.content;
  if (Array.isArray(response?.content)) return response.content;
  return [];
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

// ERP updateTotals() math — item level and document totals exactly as the
// original quotation-create.js computes them.
function computeRows(items) {
  let subTotal = 0, cgstTotal = 0, sgstTotal = 0, totalQty = 0;
  const rows = items.map((it) => {
    const qty = Number(it.qty) || 0;
    const rate = Number(it.rate) || 0;
    const gst = Number(it.gstRate) || 0;
    const discPct = Number(it.discountPct) || 0;
    const grossAmt = qty * rate;
    const discAmt = grossAmt * (discPct / 100);
    const netAmt = grossAmt - discAmt;
    const cgst = netAmt * (gst / 2 / 100);
    const sgst = netAmt * (gst / 2 / 100);
    const total = netAmt + cgst + sgst;
    subTotal += netAmt;
    cgstTotal += cgst;
    sgstTotal += sgst;
    totalQty += qty;
    return { ...it, grossAmt, discAmt, netAmt, cgst, sgst, total };
  });
  return { rows, subTotal, cgstTotal, sgstTotal, totalQty };
}

export default function QuotationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const emptyForm = () => ({
    quotationNo: '',
    reference: '',
    quotationDate: new Date().toISOString().split('T')[0],
    validUntil: '',
    leadNo: '',
    sourceCw: '',
    sourceCpr: '',
    fromCompany: 'VISHAK TECH',
    fromName: 'VISHAK TECH',
    fromAddress: '',
    fromGstin: '',
    fromPan: '',
    fromEmail: '',
    fromPhone: '',
    clientId: '',
    clientName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pin: '',
    country: 'India',
    gstin: '',
    pan: '',
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingPin: '',
    shipSameAsBill: false,
    shippingAddress: '',
    shippingCity: '',
    shippingState: '',
    shippingPin: '',
    taxType: 'GST',
    currency: 'INR',
    numberFormat: 'Indian',
    paymentTerms: '',
    deliveryTerms: '',
    freight: 0,
    insurance: 0,
    discountPct: 0,
    charges: 0,
    showTotalPdf: true,
    signatureType: 'Upload Signature',
    signatureLabel: '',
    internalNotes: '',
    notes: '',
    additionalInfo: '',
    contactEmail: '',
    contactPhone: '',
    hsnView: true,
    displayUnit: true,
    taxSummary: true,
    hidePlace: false,
    hsnSummary: false,
    originalImages: false,
    thumbnails: false,
    descFull: false,
    hideSubtotal: false,
    showSku: false,
    serial: false,
    batch: false
  });

  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [terms, setTerms] = useState([]);
  const [files, setFiles] = useState([]);
  const [logo, setLogo] = useState('');
  const [sigPreview, setSigPreview] = useState('');
  const [sigPadMode, setSigPadMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [productModal, setProductModal] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [extraUnit, setExtraUnit] = useState('');
  const [costWorkouts, setCostWorkouts] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const [showAddInfo, setShowAddInfo] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [numberSettings, setNumberSettings] = useState(() => loadNumberSettings());
  const [columnConfig, setColumnConfig] = useState(() => loadColumnConfig());
  const [numFormatModal, setNumFormatModal] = useState(false);
  const [columnsModal, setColumnsModal] = useState(false);
  const [uomModal, setUomModal] = useState(false);
  const [uomRowIdx, setUomRowIdx] = useState(null);
  const [unitRefreshKey, setUnitRefreshKey] = useState(0);
  const sigCanvasRef = useRef(null);
  const drawingRef = useRef(false);

  // Centralized exchange rates (silently refreshed daily, cached in MySQL).
  const { rates: exchangeRates, base: ratesBase } = useExchangeRates();
  // Currency the document was loaded with (edit mode) — used to decide whether
  // to keep the stored exchange rate or stamp a fresh one on save.
  const origCurrencyRef = useRef(null);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const roundMoney2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  // ---- Live currency conversion using the centralized latest exchange rates ----
  const handleCurrencyChange = (newCur) => {
    const oldCur = form.currency || 'INR';
    if (!newCur || newCur === oldCur) return;
    const oldRate = oldCur === ratesBase ? 1 : Number(exchangeRates[oldCur]);
    const newRate = newCur === ratesBase ? 1 : Number(exchangeRates[newCur]);
    if (!Number.isFinite(oldRate) || oldRate <= 0 || !Number.isFinite(newRate) || newRate <= 0) {
      toast.warning('Exchange rates are unavailable right now — try again shortly');
      return;
    }
    const factor = newRate / oldRate;
    // Convert every monetary value (item rates, charges, freight, insurance);
    // %-based discount and GST are rate-independent and stay untouched. The
    // totals recompute automatically from the converted rates.
    setItems((prev) =>
      prev.map((it) => (it.rowType === 'item' ? { ...it, rate: roundMoney2(Number(it.rate || 0) * factor) } : it))
    );
    setField('charges', roundMoney2(Number(form.charges || 0) * factor));
    setField('freight', roundMoney2(Number(form.freight || 0) * factor));
    setField('insurance', roundMoney2(Number(form.insurance || 0) * factor));
    // The document-level discount is a FLAT amount (form + backend treat it as
    // flat, subtracted from the subtotal), so it must be currency-converted
    // like charges/freight/insurance — otherwise a ₹100 discount would become
    // $100 after converting the document to USD.
    setField('discountPct', roundMoney2(Number(form.discountPct || 0) * factor));
    setField('currency', newCur);
    setField('exchangeRate', newRate);
    toast.success(
      `Converted to ${newCur} at 1 ${ratesBase} = ${newRate} ${newCur} (rates updated ${new Date().toLocaleDateString()})`
    );
  };

  // ---- next number ----
  useEffect(() => {
    if (isEdit) return undefined;
    let cancelled = false;
    quotationService
      .getNextNumber()
      .then((res) => {
        if (!cancelled) {
          const value = res?.data?.quotationNo || res?.data?.nextNumber;
          if (value) setForm((prev) => ({ ...prev, quotationNo: value }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isEdit]);

  // ---- load cost workouts for the Source select (ERP VT.QTN.loadFromCostWorkout) ----
  useEffect(() => {
    let cancelled = false;
    costWorkoutService
      .listCws({ page: 0, size: 100 })
      .then((res) => {
        if (cancelled) return;
        const list = parseListResponse(res);
        setCostWorkouts(
          list.map((cw) => ({ value: cw.cwNo || String(cw.id || ''), label: cw.cwNo || `CW-${cw.id || ''}`, cw }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- load products for the Products modal ----
  useEffect(() => {
    let cancelled = false;
    productService
      .list()
      .then((list) => {
        if (!cancelled) setProducts(list || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- edit mode: populate from backend (same mapping as the generic page) ----
  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    quotationService
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
        toForm.country = raw.country || 'India';
        toForm.fromCompany = raw.fromCompany || 'VISHAK TECH';
        toForm.fromName = raw.fromName || 'VISHAK TECH';
        // The document-level discount input is a FLAT amount; the backend
        // returns both `discount` (flat) and a derived `discountPct` (% of
        // subtotal). Load the flat value so re-saving an edit does not shrink
        // the stored discount to the derived percentage (data-loss fix).
        toForm.discountPct = raw.discount != null && raw.discount !== '' ? Number(raw.discount) : 0;
        setForm({ ...emptyForm(), ...toForm });
        origCurrencyRef.current = toForm.currency || 'INR';
        setItems(
          (Array.isArray(raw.items) ? raw.items : []).map((it) => ({
            id: nextId(),
            rowType: 'item',
            productId: it.productId || null,
            productName: it.productName || it.product || '',
            description: it.description || '',
            sku: it.sku || '',
            hsn: it.hsn || '',
            gstRate: Number(it.gstRate) || 0,
            // the backend returns the item unit under "uom" (QuotationItemResponse.uom)
            unit: it.uom || it.unit || 'Nos',
            qty: it.qty != null ? Number(it.qty) : 1,
            rate: Number(it.rate) || 0,
            discountPct: Number(it.discountPct) || 0
          }))
        );
        // Restore Terms & Conditions from the stored string so editing a
        // quotation does not wipe the persisted terms on the next save.
        const rawTerms = String(raw.terms || '').trim();
        setTerms(
          rawTerms
            ? rawTerms.split('\n').filter(Boolean).map((line) => {
                const isGroup = line.startsWith('[GROUP] ');
                const cleanLine = isGroup ? line.slice('[GROUP] '.length) : line;
                const sep = cleanLine.indexOf(':');
                return {
                  id: nextId(),
                  isGroup,
                  title: sep >= 0 ? cleanLine.slice(0, sep).trim() : cleanLine,
                  description: sep >= 0 ? cleanLine.slice(sep + 1).trim() : ''
                };
              })
            : []
        );
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err?.message || 'Failed to load quotation');
          navigate('/quotations');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, navigate, toast]);

  // ---- ERP qtnShipCopyBill ----
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

  // ---- ERP VT.QTN.loadFromCostWorkout ----
  const applyCostWorkout = (value) => {
    setField('sourceCw', value);
    if (!value) {
      setField('sourceCpr', '');
      return;
    }
    const option = costWorkouts.find((o) => o.value === value);
    if (!option?.cw) return;
    const cw = option.cw;
    if (cw.clientName || cw.client) setField('clientName', cw.clientName || cw.client);
    if (cw.contactPerson) setField('contactPerson', cw.contactPerson);
    if (cw.email) setField('email', cw.email);
    if (cw.phone) setField('phone', cw.phone);
    if (cw.billingAddress || cw.address) setField('billingAddress', cw.billingAddress || cw.address);
    if (cw.shippingAddress) setField('shippingAddress', cw.shippingAddress);
    if (cw.sourceCpr || cw.prNo) setField('sourceCpr', cw.sourceCpr || cw.prNo);
    setField('reference', `CW: ${cw.cwNo || value}`);
    if (Array.isArray(cw.items) && cw.items.length > 0) {
      setItems(
        cw.items.map((it) => ({
          id: nextId(),
          rowType: 'item',
          productId: it.productId || null,
          productName: it.productName || it.description || '',
          description: it.description || it.productName || '',
          sku: it.sku || it.drawingNo || '',
          hsn: it.hsn || '',
          gstRate: Number(it.gstRate) || 18,
          unit: it.unit || it.uom || 'Nos',
          qty: Number(it.qty) || 1,
          rate: Number(it.rate || it.estimatedCost) || 0,
          discountPct: Number(it.discountPct) || 0
        }))
      );
    }
  };

  // ---- ERP VT.CustomerLookup auto-fill ----
  // Maps the selected customer (camelCase fields returned by GET /customers)
  // onto every quotation client field. Each lookup keeps fallbacks so the
  // handler stays correct if the API field shape ever changes. This only
  // writes the initial values — the form remains fully editable afterwards.
  const handleClientSelect = (customer) => {
    const billingAddr = customer.billingAddress || customer.address || '';
    const billingCity = customer.billingCity || customer.city || '';
    const billingState = customer.billingState || customer.state || '';
    const billingPin = customer.billingPin || customer.pinCode || customer.pin || customer.zipCode || '';
    const shippingAddr = customer.shippingAddress || billingAddr || '';
    const shippingCity = customer.shippingCity || billingCity || '';
    const shippingState = customer.shippingState || billingState || '';
    const shippingPin = customer.shippingPin || billingPin || '';

    setField('clientId', customer.id ?? customer.clientId ?? customer.customerId ?? '');
    setField('clientName', customer.businessName || customer.companyName || customer.clientName || customer.name || '');
    setField('contactPerson', customer.contactPerson || '');
    setField('phone', customer.phone || customer.mobile || '');
    setField('email', customer.email || '');
    setField('gstin', customer.gstin || customer.gst || customer.gstNo || '');
    setField('pan', customer.pan || customer.panNumber || '');
    setField('city', billingCity);
    setField('state', billingState);
    setField('pin', billingPin);
    setField('country', customer.country || 'India');
    setField('address', billingAddr);
    setField('billingAddress', billingAddr);
    setField('billingCity', billingCity);
    setField('billingState', billingState);
    setField('billingPin', billingPin);
    setField('shippingAddress', shippingAddr);
    setField('shippingCity', shippingCity);
    setField('shippingState', shippingState);
    setField('shippingPin', shippingPin);
    if (customer.paymentTerms) setField('paymentTerms', customer.paymentTerms);
    if (customer.salesPerson) setField('salesPerson', customer.salesPerson);
  };

  // ================= ITEM GRID (ERP 14-column editable grid) =================

  const addItemRow = (data = {}) => {
    setItems((prev) => [
      ...prev,
      {
        id: nextId(),
        rowType: 'item',
        productId: data.productId || null,
        productName: data.productName || data.name || '',
        description: data.description || data.name || '',
        sku: data.sku || data.code || '',
        hsn: data.hsn || '',
        gstRate: Number(data.gstRate || data.tax || 0) || 0,
        unit: data.unit || 'Nos',
        qty: data.qty || 1,
        rate: Number(data.rate) || 0,
        discountPct: Number(data.discount || 0) || 0
      }
    ]);
  };

  const addGroupRow = () =>
    setItems((prev) => [...prev, { id: nextId(), rowType: 'group', groupName: '' }]);

  const addDescRow = () => {
    setItems((prev) => [...prev, { id: nextId(), rowType: 'desc', descText: '' }]);
  };

  const addImageRow = () =>
    setItems((prev) => [...prev, { id: nextId(), rowType: 'image', imageData: '', imageName: '' }]);

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  // apply "Round-off to Quantity / Rate" from the Number & Currency settings
  const applyRoundOff = (value, enabled) => {
    if (!enabled || value === '' || value == null) return value;
    const n = Number(value);
    return Number.isFinite(n) ? String(Math.round(n)) : value;
  };

  const removeRow = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveItem = (idx, dir) => {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const duplicateRow = (idx) => {
    setItems((prev) => {
      const next = [...prev];
      const copy = { ...next[idx], id: nextId() };
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  // ---- UOM manager: apply a chosen unit to the row the modal was opened
  // from (fall back to the last item row for the toolbar shortcut) ----
  const applyUnitToQuotation = (unitValue) => {
    const lastItemIdx = items.reduce((last, it, i) => (it.rowType === 'item' ? i : last), -1);
    const itemIdx =
      uomRowIdx != null && items[uomRowIdx] && items[uomRowIdx].rowType === 'item'
        ? uomRowIdx
        : lastItemIdx;
    if (itemIdx < 0) {
      toast.info('Add an item first, then choose a unit');
      return;
    }
    updateItem(itemIdx, { unit: unitValue });
    toast.success(`Unit "${unitValue}" applied to item`);
  };

  const selectProduct = (product) => {
    addItemRow({
      productId: product.id,
      productName: product.name,
      description: product.description || product.name,
      sku: product.sku || '',
      hsn: product.hsn || '',
      gstRate: Number(product.gstRate) || 0,
      unit: product.unit || 'Nos',
      rate: Number(product.rate) || 0
    });
    setProductModal(false);
    setProductQuery('');
  };

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.sku || '').toLowerCase().includes(q) ||
        String(p.hsn || '').toLowerCase().includes(q)
    );
  }, [products, productQuery]);

  const { rows: itemRows, subTotal, cgstTotal, sgstTotal, totalQty } = computeRows(
    items.filter((it) => it.rowType === 'item')
  );

  const discount = Number(form.discountPct) || 0;
  const charges = Number(form.charges) || 0;
  const freight = Number(form.freight) || 0;
  const insurance = Number(form.insurance) || 0;
  const grandTotal = Math.max(0, subTotal + cgstTotal + sgstTotal - discount + charges + freight + insurance);
  const totalItems = items.length;

  // ================= TERMS (ERP qtnTermsTable) =================
  const addTerm = (title = '', desc = '') =>
    setTerms((prev) => [...prev, { id: nextId(), title, description: desc, isGroup: false }]);

  const addTermGroup = () =>
    setTerms((prev) => [...prev, { id: nextId(), title: '', description: '', isGroup: true }]);

  const insertDefaultTerm = (text) => addTerm(text, '');

  const updateTerm = (idx, patch) =>
    setTerms((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));

  const removeTerm = (idx) => setTerms((prev) => prev.filter((_, i) => i !== idx));

  // ================= SIGNATURE =================
  const sigTypeChanged = (type) => {
    setField('signatureType', type);
    setSigPadMode(type === 'Use Signature Pad');
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startDraw = (e) => {
    drawingRef.current = true;
    const canvas = sigCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    ctx.moveTo(x, y);
  };
  const moveDraw = (e) => {
    if (!drawingRef.current) return;
    const canvas = sigCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const endDraw = () => {
    drawingRef.current = false;
  };

  // ================= LOGO =================
  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogo(ev.target.result);
    reader.readAsDataURL(file);
  };
  const removeLogo = () => setLogo('');

  // ================= ATTACHMENTS =================
  const handleAttachments = (e) => {
    const list = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...list]);
    e.target.value = '';
  };
  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const uploadQueued = async (docId) => {
    if (files.length === 0) return 0;
    const results = await quotationService.uploadMany(docId, files, {});
    const ok = results.filter((r) => r.ok).length;
    const failed = results.length - ok;
    if (ok > 0) toast.success(`${ok} attachment(s) uploaded`);
    if (failed > 0) toast.error(`${failed} attachment(s) failed to upload`);
    setFiles([]);
    return ok;
  };

  // ================= VALIDATION (unchanged from the generic page) =================
  const validate = () => {
    if (!String(form.quotationNo || '').trim()) {
      toast.error('Quotation No is required.');
      return false;
    }
    if (!form.clientName) {
      toast.error('Please select or enter a Client name.');
      return false;
    }
    if (items.filter((it) => it.rowType === 'item').length === 0) {
      toast.error('Add at least one item.');
      return false;
    }
    return true;
  };

  const buildTermsString = () =>
    terms
      .map((t) => `${t.isGroup ? '[GROUP] ' : ''}${t.title}: ${t.description}`.trim())
      .filter(Boolean)
      .join('\n');

  const save = async ({ draft = false, continueToDesign = false, resetAfter = false } = {}) => {
    if (!draft && !validate()) return;
    setSaving(true);
    try {
      const payload = serializeQuotation(
        {
          ...form,
          terms: buildTermsString(),
          showTotalPdf: form.showTotalPdf,
          // new feature settings ride along — backend ignores unknown props,
          // so they persist with the document wherever the backend stores them
          numberSystem: numberSettings.numberSystem,
          country: numberSettings.country,
          decimalDigits: numberSettings.decimalDigits,
          roundOffQty: numberSettings.roundOffQty,
          roundOffRate: numberSettings.roundOffRate,
          customCurrencySymbol: numberSettings.customCurrencySymbol,
          columnConfig: JSON.stringify(columnConfig)
        },
        itemRows
      );
      // Exchange-rate bookkeeping: a saved quotation keeps the rate used when
      // its currency was set, unless the user explicitly recalculates later.
      const cur = form.currency || 'INR';
      const storedRate = Number(form.exchangeRate);
      const keepStored =
        isEdit && Number.isFinite(storedRate) && storedRate > 0 && origCurrencyRef.current === cur;
      const liveRate = cur === ratesBase ? 1 : Number(exchangeRates[cur]);
      payload.exchangeRate = keepStored
        ? storedRate
        : Number.isFinite(liveRate) && liveRate > 0
          ? liveRate
          : undefined;
      payload.baseCurrency = form.baseCurrency || ratesBase;
      const res = isEdit ? await quotationService.update(id, payload) : await quotationService.create(payload, draft);
      const created = res?.data ?? {};
      const docId = created?.id || id;
      await uploadQueued(docId);
      if (draft) {
        toast.info('Draft saved');
        setSaving(false);
        return;
      }
      const no = created.quotationNo || form.quotationNo || '';
      toast.success(`${no} saved`);
      if (resetAfter) {
        setForm({ ...emptyForm(), quotationNo: '' });
        setItems([]);
        setTerms([]);
        const next = await quotationService.getNextNumber();
        if (next?.data?.quotationNo) setForm((prev) => ({ ...prev, quotationNo: next.data.quotationNo }));
      } else if (continueToDesign) {
        navigate(`/quotations/design?id=${docId}`);
      } else {
        navigate('/quotations');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = () => save({ draft: true });
  const saveNew = () => save({ resetAfter: true });
  const saveContinue = () => save({ continueToDesign: true });

  // ---- Number & Currency Format: persist + apply ----
  const handleSaveNumberSettings = (settings) => {
    saveNumberSettings(settings);
    setNumberSettings(settings);
    toast.success('Number & currency format saved');
  };

  // ---- Customize Columns & Formulas: persist + apply immediately ----
  const handleSaveColumns = (columns) => {
    setColumnConfig(columns);
    toast.success('Column layout applied to the grid');
  };

  // evaluate a formula against a representative row (used by the editor preview/validation)
  const evaluateRow = (formula) => {
    const sample = items.find((it) => it.rowType === 'item');
    const calc = itemRows[0] || {};
    return evaluateFormula(formula, rowVars(sample || {}, calc));
  };

  // ---- visible columns (driven by the Customize Columns & Formulas config) ----
  const visibleCols = columnConfig.filter((c) => c.visible);
  const hasActionsCol = visibleCols.some((c) => c.type === 'actions');
  const dataColCount = visibleCols.filter((c) => c.type !== 'actions').length;

  const cellAlign = (col) => {
    if (col.type === 'index' || col.type === 'actions') return 'center';
    if (col.type === 'text') return 'left';
    return 'right'; // number + computed
  };

  // row variables exposed to custom formulas
  const rowVars = (it, calc) => ({
    qty: Number(it.qty) || 0,
    rate: Number(it.rate) || 0,
    discountPct: Number(it.discountPct) || 0,
    gstRate: Number(it.gstRate) || 0,
    grossAmt: calc?.grossAmt ?? 0,
    discAmt: calc?.discAmt ?? 0,
    netAmt: calc?.netAmt ?? 0,
    cgst: calc?.cgst ?? 0,
    sgst: calc?.sgst ?? 0,
    total: calc?.total ?? 0
  });

  // evaluate a column's display value for a standard item row
  const colValue = (col, it, calc) => {
    if (col.type === 'index') return String((itemRows.indexOf(calc) + 1) || 1);
    if (col.type === 'computed') {
      if (col.key === 'amount') return calc?.netAmt ?? 0;
      if (col.key === 'cgst') return calc?.cgst ?? 0;
      if (col.key === 'sgst') return calc?.sgst ?? 0;
      if (col.key === 'total') return calc?.total ?? 0;
      if (col.formula) {
        const v = evaluateFormula(col.formula, rowVars(it, calc));
        return v == null ? 0 : v;
      }
      return 0;
    }
    if (col.type === 'currency') {
      if (col.key === 'amount') return calc?.netAmt ?? 0;
      if (col.key === 'cgst') return calc?.cgst ?? 0;
      if (col.key === 'sgst') return calc?.sgst ?? 0;
      if (col.key === 'total') return calc?.total ?? 0;
      if (col.formula) {
        const v = evaluateFormula(col.formula, rowVars(it, calc));
        return v == null ? 0 : v;
      }
      const v = Number(it[col.key]);
      return Number.isFinite(v) ? v : 0;
    }
    return it[col.key];
  };

  const renderItemRows = () =>
    items.map((it, idx) => {
      // running index within item rows only (group/desc/image/unit rows don't consume one)
      const idxOf = items.slice(0, idx).filter((x) => x.rowType === 'item').length + 1;
      if (it.rowType === 'group') {
        return (
          <tr key={it.id} className="item-table-row item-group-row">
            <td colSpan={dataColCount} style={{ padding: '0 10px', height: 44 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Layers size={14} color="#0B4A3D" />
                <input
                  value={it.groupName || ''}
                  onChange={(e) => updateItem(idx, { groupName: e.target.value })}
                  placeholder="Group name"
                  style={{ fontWeight: 600, border: 'none', background: 'transparent', width: '100%', outline: 'none', fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#1f2937' }}
                />
              </span>
            </td>
            {hasActionsCol && (
              <td className="item-actions">
                <button type="button" onClick={() => removeRow(idx)} title="Remove" tabIndex={-1} className="it-row-action-btn danger">
                  <Trash2 size={13} />
                </button>
              </td>
            )}
          </tr>
        );
      }
      if (it.rowType === 'desc') {
        return (
          <tr key={it.id} className="item-table-row item-desc-row">
            <td colSpan={dataColCount} style={{ padding: '4px 10px 8px' }}>
              <textarea
                rows={2}
                value={it.descText || ''}
                onChange={(e) => updateItem(idx, { descText: e.target.value })}
                placeholder="Enter description..."
                style={{ width: '100%', margin: 0, fontSize: 13 }}
              />
            </td>
            {hasActionsCol && (
              <td className="item-actions">
                <button type="button" onClick={() => removeRow(idx)} title="Remove" className="it-row-action-btn danger">
                  <Trash2 size={13} />
                </button>
              </td>
            )}
          </tr>
        );
      }
      if (it.rowType === 'image') {
        return (
          <tr key={it.id} className="item-table-row item-desc-row">
            <td colSpan={dataColCount} style={{ padding: '6px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#0A4F44', fontSize: 12, fontWeight: 500 }}>
                  <ImageIcon size={14} /> Choose Image
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => updateItem(idx, { imageData: ev.target.result, imageName: file.name });
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {it.imageData && (
                  <img src={it.imageData} alt={it.imageName} style={{ maxHeight: 60, borderRadius: 6 }} />
                )}
              </div>
            </td>
            {hasActionsCol && (
              <td className="item-actions">
                <button type="button" onClick={() => removeRow(idx)} title="Remove" className="it-row-action-btn danger">
                  <Trash2 size={13} />
                </button>
              </td>
            )}
          </tr>
        );
      }
      if (it.rowType === 'unit') {
        return (
          <tr key={it.id} className="item-table-row">
            <td colSpan={dataColCount - 1} style={{ textAlign: 'right', paddingRight: 8, color: '#64748b', fontSize: 12 }}>
              Unit
            </td>
            <td colSpan={1}>
              <input
                value={extraUnit}
                onChange={(e) => setExtraUnit(e.target.value)}
                placeholder="unit"
                style={{ width: 90, textAlign: 'center' }}
              />
            </td>
            {hasActionsCol && (
              <td className="item-actions">
                <button type="button" onClick={() => removeRow(idx)} title="Remove" className="it-row-action-btn danger">
                  <Trash2 size={13} />
                </button>
              </td>
            )}
          </tr>
        );
      }
      // standard item row
      const calc = itemRows[idxOf - 1];
      return (
        <tr key={it.id} className="item-table-row">
          {visibleCols.map((col) => {
            const align = cellAlign(col);
            if (col.type === 'actions') {
              return (
                <td key={col.key} className="item-actions" style={{ textAlign: 'center', padding: '0 2px' }}>
                  <div className="it-row-actions">
                    <button type="button" className="it-row-action-btn" onClick={() => moveItem(idx, -1)} title="Move Up" disabled={idx === 0}>
                      <ChevronUp size={12} />
                    </button>
                    <button type="button" className="it-row-action-btn" onClick={() => moveItem(idx, 1)} title="Move Down" disabled={idx === items.length - 1}>
                      <ChevronDown size={12} />
                    </button>
                    <button type="button" className="it-row-action-btn success" onClick={() => duplicateRow(idx)} title="Duplicate">
                      <Copy size={12} />
                    </button>
                    <button type="button" className="it-row-action-btn danger" onClick={() => removeRow(idx)} title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              );
            }
            if (col.type === 'index') {
              return (
                <td key={col.key} style={{ textAlign: align }}>
                  {idxOf}
                </td>
              );
            }
            if (col.type === 'computed') {
              return (
                <td key={col.key} style={{ textAlign: align }}>
                  <input
                    type="text"
                    value={formatCellValue(colValue(col, it, calc), numberSettings)}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
              );
            }
            if (col.type === 'currency') {
              return (
                <td key={col.key} style={{ textAlign: align }}>
                  <input
                    type="text"
                    value={formatMoney(colValue(col, it, calc) || 0, numberSettings)}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
              );
            }
            if (col.key === 'description') {
              return (
                <td key={col.key} style={{ textAlign: align }}>
                  <input
                    type="text"
                    value={it.description || ''}
                    onChange={(e) => updateItem(idx, { description: e.target.value, productName: e.target.value })}
                    placeholder="Enter item description"
                  />
                </td>
              );
            }
            if (col.key === 'gstRate') {
              return (
                <td key={col.key} style={{ textAlign: align }}>
                  <input
                    type="number"
                    value={it.gstRate ?? 0}
                    min="0"
                    step="0.1"
                    onChange={(e) => updateItem(idx, { gstRate: e.target.value })}
                    placeholder="0%"
                  />
                </td>
              );
            }
            if (col.key === 'qty') {
              return (
                <td key={col.key} style={{ textAlign: align }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <input
                      type="number"
                      value={it.qty ?? 1}
                      min="0.01"
                      step="0.01"
                      onChange={(e) => updateItem(idx, { qty: applyRoundOff(e.target.value, numberSettings.roundOffQty) })}
                      placeholder="0"
                      style={{ width: '100%' }}
                    />
                    {extraUnit === 'unit' && idx === items.length - 1 && (
                      <input
                        type="text"
                        value={it.unit || ''}
                        onChange={(e) => updateItem(idx, { unit: e.target.value })}
                        placeholder="unit"
                        style={{ width: 50, marginLeft: 4, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 6px', fontSize: 12, textAlign: 'center' }}
                      />
                    )}
                  </span>
                </td>
              );
            }
            if (col.type === 'number') {
              const isPct = col.key === 'discountPct';
              const isRate = col.key === 'rate';
              return (
                <td key={col.key} style={{ textAlign: align }}>
                  <input
                    type="number"
                    value={it[col.key] ?? 0}
                    min={isPct ? 0 : undefined}
                    max={isPct ? 100 : undefined}
                    step={isPct ? 0.1 : 0.01}
                    onChange={(e) =>
                      updateItem(idx, {
                        [col.key]: isRate ? applyRoundOff(e.target.value, numberSettings.roundOffRate) : e.target.value
                      })
                    }
                    placeholder={isPct ? '0' : '0.00'}
                  />
                </td>
              );
            }
            if (col.key === 'unit') {
              // Editable, searchable UOM dropdown backed by the shared
              // /masters/units list. The "Manage Units…" footer opens the UOM
              // manager modal; its changes refresh this dropdown via
              // unitRefreshKey so new/renamed units are immediately selectable.
              return (
                <td key={col.key} style={{ textAlign: align }}>
                  <EditableMasterDropdown
                    key={`uom-${idx}-${unitRefreshKey}`}
                    masterKey="units"
                    value={it.unit || 'Nos'}
                    onChange={(v) => updateItem(idx, { unit: v })}
                    placeholder="UOM"
                    portal
                    inputClassName="it-unit-dd"
                    manageLabel="Units"
                    onManage={() => {
                      setUomRowIdx(idx);
                      setUomModal(true);
                    }}
                  />
                </td>
              );
            }
            // text columns (sku, hsn, custom text)
            return (
              <td key={col.key} style={{ textAlign: align }}>
                <input
                  type="text"
                  value={it[col.key] ?? ''}
                  onChange={(e) => updateItem(idx, { [col.key]: e.target.value })}
                  placeholder=""
                />
              </td>
            );
          })}
        </tr>
      );
    });

  if (loading) {
    return (
      <div className="qtn-create-page">
        <div className="qtn-create-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#0A4F44', animation: 'spin 0.8s linear infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="qtn-create-page">
      <div className="qtn-create-inner">
        {/* ===== BREADCRUMB (ERP client-breadcrumb) ===== */}
        <div className="qtn-breadcrumb">
          <Link to="/dashboard">Dashboard</Link>
          <ChevronDown size={10} style={{ transform: 'rotate(-90deg)', color: '#cbd5e1' }} />
          <Link to="/quotations">Quotations</Link>
          <ChevronDown size={10} style={{ transform: 'rotate(-90deg)', color: '#cbd5e1' }} />
          <span>{isEdit ? 'Edit Quotation' : 'Create New Quotation'}</span>
        </div>

        {/* ===== STEPPER ===== */}
        <div className="qtn-stepper">
          <div className="qtn-step active">
            <div className="qtn-step-num">1</div>
            <div className="qtn-step-text">Quotation Details</div>
          </div>
          <div className="qtn-step-divider" />
          <div className="qtn-step">
            <div className="qtn-step-num">2</div>
            <div className="qtn-step-text">
              <a onClick={() => saveContinue()}>Design &amp; Share</a>
            </div>
          </div>
        </div>

        <div className="qtn-create-grid qtn-grid-full-width">
          <div className="qtn-main-form">
            {/* ===== SECTION 1: HEADER (Quotation) ===== */}
            <div className="qtn-card">
              <div className="qtn-card-body">
                <div className="qtn-section-title">Quotation</div>
                <div className="qtn-create-header-section">
                  <div className="qtn-create-header-fields">
                    <div className="qtn-grid-2" style={{ marginBottom: 16 }}>
                      <div className="qtn-field">
                        <label htmlFor="qtnNumber">Quotation No <span className="required">*</span></label>
                        <input
                          type="text"
                          className="qtn-input"
                          id="qtnNumber"
                          value={form.quotationNo}
                          onChange={(e) => setField('quotationNo', e.target.value)}
                          placeholder="QTN-YYYY-XXXXXX"
                        />
                      </div>
                      <div className="qtn-field">
                        <label htmlFor="qtnRef">Reference</label>
                        <input
                          type="text"
                          className="qtn-input"
                          id="qtnRef"
                          value={form.reference}
                          onChange={(e) => setField('reference', e.target.value)}
                          placeholder="e.g. RFQ-001"
                        />
                      </div>
                    </div>
                    <div className="qtn-grid-4">
                      <div className="qtn-field">
                        <label htmlFor="qtnDate">Quotation Date <span className="required">*</span></label>
                        <input
                          type="date"
                          className="qtn-input"
                          id="qtnDate"
                          value={form.quotationDate}
                          onChange={(e) => setField('quotationDate', e.target.value)}
                        />
                      </div>
                      <div className="qtn-field">
                        <label htmlFor="qtnValidTill">Valid Till Date <span className="required">*</span></label>
                        <input
                          type="date"
                          className="qtn-input"
                          id="qtnValidTill"
                          value={form.validUntil}
                          onChange={(e) => setField('validUntil', e.target.value)}
                        />
                      </div>
                      <div className="qtn-field">
                        <label>&nbsp;</label>
                        <a
                          onClick={() => toast.info('Custom fields coming soon')}
                          style={{ fontSize: 13, color: '#0A4F44', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, height: 44, cursor: 'pointer' }}
                        >
                          <Plus size={14} /> Add Custom Fields
                        </a>
                      </div>
                    </div>
                    <input type="hidden" id="qtnLeadNo" value={form.leadNo} />
                    <div className="qtn-grid-2" style={{ marginTop: 8 }}>
                      <div className="qtn-field">
                        <label htmlFor="qtnSourceCW">Source Cost Workout</label>
                        <select className="qtn-select" id="qtnSourceCW" value={form.sourceCw} onChange={(e) => applyCostWorkout(e.target.value)}>
                          <option value="">-- None (Create from scratch) --</option>
                          {costWorkouts.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="qtn-field">
                        <label htmlFor="qtnSourceCPR">Source CPR/PR</label>
                        <input
                          type="text"
                          className="qtn-input"
                          id="qtnSourceCPR"
                          value={form.sourceCpr}
                          readOnly
                          placeholder="Auto-filled from Cost Workout"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="qtn-logo-upload" onClick={() => document.getElementById('qtnLogoFile')?.click()}>
                      <CloudUpload size={28} />
                      <span>Upload Logo</span>
                      {logo && <img src={logo} alt="logo" />}
                      <input type="file" id="qtnLogoFile" accept="image/*" onChange={handleLogo} />
                    </div>
                    <div className="qtn-logo-actions">
                      <button type="button" onClick={() => document.getElementById('qtnLogoFile')?.click()}>Change Logo</button>
                      <button type="button" onClick={removeLogo}>Remove Logo</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== SECTION 2: COMPANY & CLIENT (party grid) ===== */}
            <div className="qtn-party-grid">
              <div className="qtn-party-card">
                <h4>
                  <span className="party-title">
                    <Building2 size={14} color="#0A4F44" /> Quotation From
                  </span>
                  <button type="button" className="edit-btn" onClick={() => toast.info('Edit company profile')}>Edit</button>
                </h4>
                <div className="qtn-party-fields">
                  <div className="qtn-field">
                    <label htmlFor="qtnFromCompany">Company</label>
                    <EditableMasterDropdown
                      id="qtnFromCompany"
                      masterKey="companies"
                      inputClassName="qtn-input"
                      value={form.fromCompany}
                      placeholder="Select Company"
                      onChange={(v) => {
                        setField('fromCompany', v);
                        if (v) setField('fromName', v);
                      }}
                    />
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnFromName">Company Name</label>
                    <input type="text" className="qtn-input" id="qtnFromName" value={form.fromName} onChange={(e) => setField('fromName', e.target.value)} placeholder="Company name" />
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnFromAddress">Address</label>
                    <input type="text" className="qtn-input" id="qtnFromAddress" value={form.fromAddress} onChange={(e) => setField('fromAddress', e.target.value)} placeholder="Address" />
                  </div>
                  <div className="qtn-grid-2">
                    <div className="qtn-field">
                      <label htmlFor="qtnFromGst">GSTIN</label>
                      <input type="text" className="qtn-input" id="qtnFromGst" value={form.fromGstin} onChange={(e) => setField('fromGstin', e.target.value)} placeholder="GSTIN" />
                    </div>
                    <div className="qtn-field">
                      <label htmlFor="qtnFromPan">PAN</label>
                      <input type="text" className="qtn-input" id="qtnFromPan" value={form.fromPan} onChange={(e) => setField('fromPan', e.target.value)} placeholder="PAN" />
                    </div>
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnFromEmail">Email</label>
                    <input type="email" className="qtn-input" id="qtnFromEmail" value={form.fromEmail} onChange={(e) => setField('fromEmail', e.target.value)} placeholder="Email" />
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnFromPhone">Phone</label>
                    <input type="text" className="qtn-input" id="qtnFromPhone" value={form.fromPhone} onChange={(e) => setField('fromPhone', e.target.value)} placeholder="Phone" />
                  </div>
                </div>
              </div>

              <div className="qtn-party-card">
                <h4>
                  <span className="party-title">
                    <User size={14} color="#0A4F44" /> Quotation For
                  </span>
                </h4>
                <div className="qtn-party-fields">
                  <div className="qtn-field">
                    <label htmlFor="qtnClientLookup">Client</label>
                    <ClientLookup
                      value={form.clientName}
                      onChange={(name) => setField('clientName', name)}
                      onAutoFill={handleClientSelect}
                      portal
                    />
                  </div>
                  <div className="qtn-grid-2">
                    <div className="qtn-field">
                      <label htmlFor="qtnClientName">Client Name</label>
                      <input type="text" className="qtn-input" id="qtnClientName" value={form.clientName} onChange={(e) => setField('clientName', e.target.value)} placeholder="Client name" />
                    </div>
                    <div className="qtn-field">
                      <label htmlFor="qtnClientContact">Contact Person</label>
                      <input type="text" className="qtn-input" id="qtnClientContact" value={form.contactPerson} onChange={(e) => setField('contactPerson', e.target.value)} placeholder="Contact person" />
                    </div>
                  </div>
                  <div className="qtn-grid-2">
                    <div className="qtn-field">
                      <label htmlFor="qtnClientEmail">Email</label>
                      <input type="email" className="qtn-input" id="qtnClientEmail" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="Email" />
                    </div>
                    <div className="qtn-field">
                      <label htmlFor="qtnClientPhone">Phone</label>
                      <input type="text" className="qtn-input" id="qtnClientPhone" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="Phone" />
                    </div>
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnClientAddress">Address</label>
                    <input type="text" className="qtn-input" id="qtnClientAddress" value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Address" />
                  </div>
                  <div className="qtn-grid-3">
                    <div className="qtn-field">
                      <label htmlFor="qtnClientCity">City</label>
                      <input type="text" className="qtn-input" id="qtnClientCity" value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="City" />
                    </div>
                    <div className="qtn-field">
                      <label htmlFor="qtnClientState">State</label>
                      <input type="text" className="qtn-input" id="qtnClientState" value={form.state} onChange={(e) => setField('state', e.target.value)} placeholder="State" />
                    </div>
                    <div className="qtn-field">
                      <label htmlFor="qtnClientPin">PIN</label>
                      <input type="text" className="qtn-input" id="qtnClientPin" value={form.pin} onChange={(e) => setField('pin', e.target.value)} placeholder="PIN" />
                    </div>
                    <div className="qtn-field">
                      <label htmlFor="qtnClientCountry">Country</label>
                      <input type="text" className="qtn-input" id="qtnClientCountry" value={form.country} onChange={(e) => setField('country', e.target.value)} placeholder="Country" />
                    </div>
                  </div>
                  <div className="qtn-grid-2">
                    <div className="qtn-field">
                      <label htmlFor="qtnClientGstin">GSTIN</label>
                      <input type="text" className="qtn-input" id="qtnClientGstin" value={form.gstin} onChange={(e) => setField('gstin', e.target.value)} placeholder="GSTIN" />
                    </div>
                    <div className="qtn-field">
                      <label htmlFor="qtnClientPan">PAN</label>
                      <input type="text" className="qtn-input" id="qtnClientPan" value={form.pan} onChange={(e) => setField('pan', e.target.value)} placeholder="PAN" />
                    </div>
                  </div>
                  <button type="button" className="qtn-link-btn" style={{ marginTop: 4 }} onClick={() => {
                    toast.info('New client form - Redirecting to client creation');
                    window.open('/clients', '_blank');
                  }}>
                    <Plus size={13} /> Add New Client
                  </button>
                </div>
              </div>
            </div>

            {/* ===== BILLING ADDRESS ===== */}
            <div className="qtn-card">
              <div className="qtn-card-header">
                <h3><MapPin size={14} color="#0A4F44" /> Billing Address</h3>
              </div>
              <div className="qtn-card-body">
                <div className="qtn-field">
                  <label htmlFor="qtnBillAddress">Address</label>
                  <textarea className="qtn-input" id="qtnBillAddress" rows={2} value={form.billingAddress} onChange={(e) => setField('billingAddress', e.target.value)} placeholder="Billing address" />
                </div>
                <div className="qtn-grid-3" style={{ marginTop: 16 }}>
                  <div className="qtn-field">
                    <label htmlFor="qtnBillCity">City</label>
                    <input type="text" className="qtn-input" id="qtnBillCity" value={form.billingCity} onChange={(e) => setField('billingCity', e.target.value)} placeholder="City" />
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnBillState">State</label>
                    <input type="text" className="qtn-input" id="qtnBillState" value={form.billingState} onChange={(e) => setField('billingState', e.target.value)} placeholder="State" />
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnBillPin">PIN</label>
                    <input type="text" className="qtn-input" id="qtnBillPin" value={form.billingPin} onChange={(e) => setField('billingPin', e.target.value)} placeholder="PIN" />
                  </div>
                </div>
              </div>
            </div>

            {/* ===== SHIPPING ADDRESS ===== */}
            <div className="qtn-card">
              <div className="qtn-card-header">
                <h3><Truck size={14} color="#0A4F44" /> Shipping Address</h3>
                <label style={{ fontSize: 12, color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" id="qtnShipSameAsBill" checked={form.shipSameAsBill} onChange={(e) => handleShipSameAsBill(e.target.checked)} style={{ accentColor: '#0A4F44', width: 14, height: 14 }} />
                  Same as Billing
                </label>
              </div>
              <div className="qtn-card-body">
                <div className="qtn-field">
                  <label htmlFor="qtnShipAddress">Address</label>
                  <textarea className="qtn-input" id="qtnShipAddress" rows={2} value={form.shippingAddress} onChange={(e) => setField('shippingAddress', e.target.value)} placeholder="Shipping address" />
                </div>
                <div className="qtn-grid-3" style={{ marginTop: 16 }}>
                  <div className="qtn-field">
                    <label htmlFor="qtnShipCity">City</label>
                    <input type="text" className="qtn-input" id="qtnShipCity" value={form.shippingCity} onChange={(e) => setField('shippingCity', e.target.value)} placeholder="City" />
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnShipState">State</label>
                    <input type="text" className="qtn-input" id="qtnShipState" value={form.shippingState} onChange={(e) => setField('shippingState', e.target.value)} placeholder="State" />
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnShipPin">PIN</label>
                    <input type="text" className="qtn-input" id="qtnShipPin" value={form.shippingPin} onChange={(e) => setField('shippingPin', e.target.value)} placeholder="PIN" />
                  </div>
                </div>
              </div>
            </div>

            {/* ===== SECTION 3: SETTINGS BAR ===== */}
            <div className="qtn-card">
              <div className="qtn-card-body">
                <div className="qtn-settings-bar">
                  <div className="qtn-field">
                    <label htmlFor="qtnTaxType">Configure GST</label>
                    <select className="qtn-select" id="qtnTaxType" value={form.taxType} onChange={(e) => setField('taxType', e.target.value)}>
                      {TAX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnCurrency">Currency</label>
                    <CurrencyDropdown
                      id="qtnCurrency"
                      value={form.currency}
                      onChange={handleCurrencyChange}
                      placeholder="Currency"
                      inputClassName="qtn-select qtn-editable-select"
                    />
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnNumFormat">Number Format</label>
                    <select className="qtn-select" id="qtnNumFormat" value={form.numberFormat} onChange={(e) => setField('numberFormat', e.target.value)}>
                      {NUMBER_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <span className="qtn-settings-divider" aria-hidden="true" />
                  <button type="button" className="qtn-link-btn" onClick={() => setNumFormatModal(true)}>
                    <Coins size={13} /> Number &amp; Currency Format
                  </button>
                  <button type="button" className="qtn-link-btn" onClick={() => setColumnsModal(true)}>
                    <Columns size={13} /> Edit Columns / Formula
                  </button>
                </div>
              </div>
            </div>

            {/* ===== SECTION 4: ITEMS — Enterprise Editable Data Grid ===== */}
            <div className="qtn-card">
              <div className="item-table-section" style={{ border: 'none', borderRadius: 0, marginBottom: 0, boxShadow: 'none' }}>
                <div className="item-table-header">
                  <h3><List size={14} /> Items</h3>
                  <div className="item-table-header-actions">
                    <button type="button" className="it-btn-add" onClick={() => addItemRow()}>
                      <Plus size={13} /> Add Row
                    </button>
                    <button type="button" className="it-btn-header" onClick={() => setProductModal(true)}>
                      <Package size={13} /> Products
                    </button>
                    <button type="button" className="it-btn-header" onClick={addGroupRow}>
                      <Layers size={13} /> Group
                    </button>
                    <button type="button" className="it-btn-header" onClick={addDescRow}>
                      <AlignLeft size={13} /> Desc
                    </button>
                    <button type="button" className="it-btn-header" onClick={addImageRow}>
                      <ImageIcon size={13} /> Image
                    </button>
                    <button type="button" className="it-btn-header" onClick={() => setUomModal(true)}>
                      <Scale size={13} /> Unit
                    </button>
                  </div>
                </div>
                <div className="item-table-wrap">
                  <table>
                    <colgroup>
                      {visibleCols.map((col) => (
                        <col key={col.key} style={{ width: col.width || 120 }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        {visibleCols.map((col) => (
                          <th key={col.key} style={{ textAlign: cellAlign(col) }}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody id="qtnItemsBody">
                      {renderItemRows()}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={visibleCols.length} style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: 12 }}>
                            No items added yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="item-table-footer">
                  <div className="item-table-footer-left">
                    <div className="item-table-footer-stat">
                      <span className="stat-label">Total Items</span>
                      <span className="stat-value" id="itFooterItems">{totalItems}</span>
                    </div>
                    <div className="item-table-footer-stat">
                      <span className="stat-label">Total Qty</span>
                      <span className="stat-value" id="itFooterQty">{totalQty.toFixed(2)}</span>
                    </div>
                    <div className="item-table-footer-stat">
                      <span className="stat-label">Estimated Value</span>
                      <span className="stat-value primary" id="itFooterValue">{formatMoney(subTotal, numberSettings)}</span>
                    </div>
                  </div>
                  <div className="item-table-footer-right">
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      <ChevronUp size={11} /> Use arrow buttons to reorder
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== SECTION 5: SIGNATURE & ATTACHMENTS ===== */}
            <div className="qtn-card">
              <div className="qtn-card-header">
                <h3><PenLine size={14} /> Signature &amp; Attachments</h3>
              </div>
              <div className="qtn-card-body">
                <div className="qtn-sa-grid">
                  <div className="qtn-sa-left">
                    <div className="qtn-sig-type">
                      <div className="qtn-field" style={{ flex: 1 }}>
                        <label>Signature Type</label>
                        <select className="qtn-select" id="qtnSigType" value={form.signatureType} onChange={(e) => sigTypeChanged(e.target.value)}>
                          {SIGNATURE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    {!sigPadMode ? (
                      <div>
                        <div className="qtn-sa-drop" onClick={() => document.getElementById('qtnSigFile')?.click()}>
                          <CloudUpload size={36} />
                          <span>Click to upload signature</span>
                          <input type="file" id="qtnSigFile" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => setSigPreview(ev.target.result);
                            reader.readAsDataURL(file);
                          }} />
                        </div>
                        <div className="qtn-sa-preview" id="qtnSigPreview">
                          {sigPreview ? (
                            <img src={sigPreview} alt="signature" />
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: 12 }}>Signature preview</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <canvas
                          id="qtnSignaturePad"
                          ref={sigCanvasRef}
                          width={400}
                          height={150}
                          className="qtn-sa-canvas"
                          onMouseDown={startDraw}
                          onMouseMove={moveDraw}
                          onMouseUp={endDraw}
                          onMouseLeave={endDraw}
                        />
                        <button type="button" className="qtn-link-btn" style={{ marginTop: 8 }} onClick={clearSignature}>
                          <Undo2 size={12} /> Clear
                        </button>
                      </div>
                    )}
                    <div className="qtn-field" style={{ marginTop: 4 }}>
                      <label htmlFor="qtnSigLabel">Signature Label</label>
                      <input type="text" className="qtn-input" id="qtnSigLabel" value={form.signatureLabel} onChange={(e) => setField('signatureLabel', e.target.value)} placeholder="e.g. Authorised Signatory" />
                    </div>
                  </div>
                  <div className="qtn-sa-right">
                    <div className="qtn-sa-dropzone" onClick={() => document.getElementById('qtnAttachments')?.click()}>
                      <CloudUpload size={36} />
                      <span>Drop files here or click to browse</span>
                      <span className="qtn-sa-formats">Supports: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG</span>
                      <input type="file" id="qtnAttachments" multiple style={{ display: 'none' }} onChange={handleAttachments} />
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="qtn-link-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            document.getElementById('qtnAttachments')?.click();
                          }}
                        >
                          <FolderOpen size={13} /> Browse Files
                        </button>
                      </div>
                    </div>
                    <div id="qtnAttachList" className="qtn-sa-file-list">
                      {files.map((f, idx) => (
                        <div key={idx} className="qtn-sa-file-row">
                          <Paperclip size={13} color="#0A4F44" style={{ flexShrink: 0 }} />
                          <span className="file-name">{f.name}</span>
                          <span className="file-size">({Math.round(f.size / 1024)} KB)</span>
                          <span className="file-actions">
                            <button type="button" className="danger" title="Remove" onClick={() => removeFile(idx)}>
                              <X size={13} />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== SECTION 6: ADDITIONAL BLOCKS ===== */}
            <div className="qtn-card">
              <div className="qtn-card-header">
                <h3><PlusCircle size={14} /> Additional</h3>
              </div>
              <div className="qtn-card-body">
                <div className="qtn-addon-grid">
                  <div className="qtn-addon-box" onClick={() => setShowNotes((v) => !v)}>
                    <StickyNote size={18} /> <span>Add Notes</span>
                  </div>
                  <div className="qtn-addon-box" onClick={() => setShowAddInfo((v) => !v)}>
                    <Info size={18} /> <span>Add Additional Info</span>
                  </div>
                  <div className="qtn-addon-box" onClick={() => setShowContact((v) => !v)}>
                    <BookUser size={18} /> <span>Add Contact Details</span>
                  </div>
                </div>
                {showNotes && (
                  <div id="qtnNotesSection" className="qtn-addon-section">
                    <div className="qtn-field">
                      <label htmlFor="qtnNotes">Notes</label>
                      <textarea className="qtn-input" id="qtnNotes" rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Customer notes..." />
                    </div>
                  </div>
                )}
                {showAddInfo && (
                  <div id="qtnAddInfoSection" className="qtn-addon-section">
                    <div className="qtn-field">
                      <label htmlFor="qtnAdditionalInfo">Additional Information</label>
                      <textarea className="qtn-input" id="qtnAdditionalInfo" rows={3} value={form.additionalInfo} onChange={(e) => setField('additionalInfo', e.target.value)} placeholder="Any additional info..." />
                    </div>
                  </div>
                )}
                {showContact && (
                  <div id="qtnContactSection" className="qtn-addon-section">
                    <div className="qtn-grid-2">
                      <div className="qtn-field">
                        <label htmlFor="qtnContactEmail">Contact Email</label>
                        <input type="email" className="qtn-input" id="qtnContactEmail" value={form.contactEmail} onChange={(e) => setField('contactEmail', e.target.value)} placeholder="Contact email" />
                      </div>
                      <div className="qtn-field">
                        <label htmlFor="qtnContactPhone">Contact Phone</label>
                        <input type="text" className="qtn-input" id="qtnContactPhone" value={form.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} placeholder="Contact phone" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ===== COMMERCIAL TERMS ===== */}
            <div className="qtn-card">
              <div className="qtn-card-header">
                <h3><FileText size={14} color="#0A4F44" /> Commercial Terms</h3>
              </div>
              <div className="qtn-card-body">
                <div className="qtn-grid-2">
                  <div className="qtn-field">
                    <label htmlFor="qtnPaymentTerms">Payment Terms</label>
                    <input type="text" className="qtn-input" id="qtnPaymentTerms" value={form.paymentTerms} onChange={(e) => setField('paymentTerms', e.target.value)} placeholder="e.g. Net 30" />
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnDeliveryTerms">Delivery Terms</label>
                    <input type="text" className="qtn-input" id="qtnDeliveryTerms" value={form.deliveryTerms} onChange={(e) => setField('deliveryTerms', e.target.value)} placeholder="e.g. FOB - Bangalore" />
                  </div>
                </div>
                <div className="qtn-grid-2" style={{ marginTop: 16 }}>
                  <div className="qtn-field">
                    <label htmlFor="qtnFreight">Freight (₹)</label>
                    <input type="number" className="qtn-input" id="qtnFreight" value={form.freight} min="0" step="0.01" onChange={(e) => setField('freight', e.target.value)} />
                  </div>
                  <div className="qtn-field">
                    <label htmlFor="qtnInsurance">Insurance (₹)</label>
                    <input type="number" className="qtn-input" id="qtnInsurance" value={form.insurance} min="0" step="0.01" onChange={(e) => setField('insurance', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* ===== TERMS & CONDITIONS ===== */}
            <div className="qtn-card">
              <div className="qtn-card-header">
                <h3><FileText size={14} /> Terms &amp; Conditions</h3>
              </div>
              <div className="qtn-card-body">
                <div className="qtn-terms-default">
                  <button type="button" onClick={() => insertDefaultTerm('Lead Time: 2-3 weeks from order confirmation')}>Lead Time</button>
                  <button type="button" onClick={() => insertDefaultTerm('Payment Terms: 50% advance, 50% on delivery')}>Payment Terms</button>
                  <button type="button" onClick={() => insertDefaultTerm('Delivery Terms: FOB - Bangalore')}>Delivery Terms</button>
                  <button type="button" onClick={() => insertDefaultTerm('Warranty: 12 months from installation')}>Warranty</button>
                  <button type="button" onClick={() => insertDefaultTerm('Validity: This quote is valid for 30 days')}>Validity</button>
                </div>
                <div className="qtn-items-toolbar" style={{ paddingTop: 0, display: 'flex', gap: 12, paddingBottom: 12 }}>
                  <button type="button" className="qtn-link-btn" onClick={() => addTerm()}>
                    <Plus size={13} /> Add New Term
                  </button>
                  <button type="button" className="qtn-link-btn" onClick={addTermGroup}>
                    <Layers size={13} /> Add New Group
                  </button>
                </div>
                <table className="qtn-terms-table" id="qtnTermsTable">
                  <thead>
                    <tr><th>#</th><th>Term</th><th>Description</th><th>Actions</th></tr>
                  </thead>
                  <tbody id="qtnTermsBody">
                    {terms.map((t, idx) => (
                      <tr key={t.id} style={t.isGroup ? { background: '#E8F0EE', fontWeight: 600 } : undefined}>
                        <td>{idx + 1}</td>
                        <td>
                          <input value={t.title} onChange={(e) => updateTerm(idx, { title: e.target.value })} placeholder="Term" style={{ fontWeight: t.isGroup ? 600 : 400 }} />
                        </td>
                        <td>
                          <input value={t.description} onChange={(e) => updateTerm(idx, { description: e.target.value })} placeholder="Description" />
                        </td>
                        <td>
                          <div className="term-actions">
                            <button type="button" title="Remove" className="danger" onClick={() => removeTerm(idx)}>
                              <X size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {terms.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '10px 0', fontSize: 12 }}>
                          No terms added yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===== ADVANCED OPTIONS ===== */}
            <div className="qtn-card">
              <div className="qtn-card-header">
                <h3><Settings size={14} /> Advanced Options</h3>
              </div>
              <div className="qtn-card-body">
                <div className="qtn-adv-grid">
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advHsn" checked={form.hsnView} onChange={(e) => setField('hsnView', e.target.checked)} />
                    <label htmlFor="advHsn">HSN Column View</label>
                  </div>
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advUnit" checked={form.displayUnit} onChange={(e) => setField('displayUnit', e.target.checked)} />
                    <label htmlFor="advUnit">Display Unit As</label>
                  </div>
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advTaxSummary" checked={form.taxSummary} onChange={(e) => setField('taxSummary', e.target.checked)} />
                    <label htmlFor="advTaxSummary">Tax Summary Display</label>
                  </div>
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advHidePlace" checked={form.hidePlace} onChange={(e) => setField('hidePlace', e.target.checked)} />
                    <label htmlFor="advHidePlace">Hide Place/Country of Supply</label>
                  </div>
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advHsnSummary" checked={form.hsnSummary} onChange={(e) => setField('hsnSummary', e.target.checked)} />
                    <label htmlFor="advHsnSummary">Show HSN Summary</label>
                  </div>
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advOriginalImages" checked={form.originalImages} onChange={(e) => setField('originalImages', e.target.checked)} />
                    <label htmlFor="advOriginalImages">Add Original Images</label>
                  </div>
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advThumbnails" checked={form.thumbnails} onChange={(e) => setField('thumbnails', e.target.checked)} />
                    <label htmlFor="advThumbnails">Show Thumbnails</label>
                  </div>
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advDescFull" checked={form.descFull} onChange={(e) => setField('descFull', e.target.checked)} />
                    <label htmlFor="advDescFull">Show Description Full Width</label>
                  </div>
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advHideSubtotal" checked={form.hideSubtotal} onChange={(e) => setField('hideSubtotal', e.target.checked)} />
                    <label htmlFor="advHideSubtotal">Hide Subtotal For Group Items</label>
                  </div>
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advSku" checked={form.showSku} onChange={(e) => setField('showSku', e.target.checked)} />
                    <label htmlFor="advSku">Show SKU</label>
                  </div>
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advSerial" checked={form.serial} onChange={(e) => setField('serial', e.target.checked)} />
                    <label htmlFor="advSerial">Show Serial Numbers</label>
                  </div>
                  <div className="qtn-adv-option">
                    <input type="checkbox" id="advBatch" checked={form.batch} onChange={(e) => setField('batch', e.target.checked)} />
                    <label htmlFor="advBatch">Display Batch Details</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== SIDEBAR (Internal Notes + Totals) — 3-col strip below ===== */}
          <div className="qtn-sidebar-form">
            <div className="qtn-card">
              <div className="qtn-card-header">
                <h3><Lock size={14} color="#0A4F44" /> Internal Notes</h3>
              </div>
              <div className="qtn-card-body">
                <div className="qtn-field">
                  <textarea className="qtn-input" id="qtnInternalNotes" rows={3} value={form.internalNotes} onChange={(e) => setField('internalNotes', e.target.value)} placeholder="Internal notes (not visible to customer)..." />
                </div>
              </div>
            </div>

            <div className="qtn-card">
              <div className="qtn-card-header">
                <h3><Calculator size={14} /> Totals</h3>
              </div>
              <div className="qtn-card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
                  <input type="checkbox" id="qtnShowTotalPdf" checked={form.showTotalPdf} onChange={(e) => setField('showTotalPdf', e.target.checked)} style={{ accentColor: '#0A4F44', width: 16, height: 16 }} />
                  <label htmlFor="qtnShowTotalPdf" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>Show Total In PDF</label>
                </div>
                <div className="sh-totals-card-body">
                  <div className="sh-total-row">
                    <span className="sh-total-label">Sub Total</span>
                    <span className="sh-total-value" id="qtnDisplayAmount">{formatMoney(subTotal, numberSettings)}</span>
                  </div>
                  <div className="sh-total-row">
                    <span className="sh-total-label">CGST</span>
                    <span className="sh-total-value" id="qtnDisplayCGST">{formatMoney(cgstTotal, numberSettings)}</span>
                  </div>
                  <div className="sh-total-row">
                    <span className="sh-total-label">SGST</span>
                    <span className="sh-total-value" id="qtnDisplaySGST">{formatMoney(sgstTotal, numberSettings)}</span>
                  </div>
                  <div className="sh-total-row">
                    <span className="sh-total-label">Discount</span>
                    <input type="number" className="sh-total-input" id="qtnDiscount" value={form.discountPct} min="0" step="0.01" onChange={(e) => setField('discountPct', e.target.value)} />
                  </div>
                  <div className="sh-total-row">
                    <span className="sh-total-label">Charges</span>
                    <input type="number" className="sh-total-input" id="qtnAdditionalCharges" value={form.charges} min="0" step="0.01" onChange={(e) => setField('charges', e.target.value)} />
                  </div>
                  <div className="sh-total-divider" />
                  <div className="sh-total-row sh-total-grand">
                    <span className="sh-total-label">Grand Total ({form.currency || 'INR'})</span>
                    <span className="sh-total-value" id="qtnDisplayGrandTotal">{formatMoney(grandTotal, numberSettings)}</span>
                  </div>
                  <div className="sh-total-words" id="qtnTotalInWords">{numberToWordsINR(grandTotal)}</div>
                  <button type="button" className="sh-total-add-field" onClick={() => toast.info('Add custom field')}>
                    <Plus size={12} /> Add Custom Fields
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM ACTION BAR (ERP form-footer) ===== */}
      <div className="qtn-form-footer">
        <div className="qtn-form-footer-left">
          <button type="button" className="qtn-btn qtn-btn-ghost" onClick={() => navigate('/quotations')} disabled={saving}>
            <ArrowLeft size={14} /> Back
          </button>
          <button type="button" className="qtn-btn qtn-btn-ghost" onClick={saveDraft} disabled={saving}>
            <Save size={14} /> Save As Draft
          </button>
        </div>
        <div className="qtn-form-footer-right">
          <button type="button" className="qtn-btn qtn-btn-secondary" onClick={saveNew} disabled={saving}>
            <Plus size={14} /> Save &amp; Create New
          </button>
          <button type="button" className="qtn-btn qtn-btn-primary" onClick={saveContinue} disabled={saving}>
            Save &amp; Continue <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ===== NUMBER & CURRENCY FORMAT MODAL (new feature) ===== */}
      <NumberCurrencyModal
        open={numFormatModal}
        onClose={() => setNumFormatModal(false)}
        settings={numberSettings}
        onSave={handleSaveNumberSettings}
      />

      {/* ===== CUSTOMIZE COLUMNS & FORMULAS MODAL (new feature) ===== */}
      <ColumnsFormulaModal
        open={columnsModal}
        onClose={() => setColumnsModal(false)}
        columns={columnConfig}
        onSave={handleSaveColumns}
        evaluateRow={evaluateRow}
      />

      {/* ===== UOM (UNIT OF MEASURE) MANAGER MODAL ===== */}
      <UomManagerModal
        open={uomModal}
        onClose={() => {
          setUomModal(false);
          setUomRowIdx(null);
        }}
        onApply={applyUnitToQuotation}
        onChanged={() => setUnitRefreshKey((k) => k + 1)}
        inUseUnits={items.filter((it) => it.rowType === 'item' && it.unit).map((it) => it.unit)}
      />

      {/* ===== PRODUCT SELECTOR MODAL ===== */}
      {productModal && (
        <div className="qtn-modal-overlay" onClick={() => setProductModal(false)}>
          <div className="qtn-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qtn-modal-header">
              <h3>Select Product</h3>
              <button type="button" className="qtn-modal-close" onClick={() => setProductModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="qtn-modal-body">
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <input
                  type="text"
                  className="qtn-input"
                  placeholder="Search products..."
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  style={{ paddingRight: 36 }}
                />
                <Search size={15} style={{ position: 'absolute', right: 12, top: 14, color: '#9ca3af', pointerEvents: 'none' }} />
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {filteredProducts.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: 12 }}>No products found</div>
                )}
                {filteredProducts.map((p) => (
                  <button type="button" key={p.id} className="qtn-product-item" onClick={() => selectProduct(p)}>
                    <span className="p-name">{p.name || '(No Name)'}</span>
                    <span className="p-meta">
                      {p.sku || ''} {p.hsn ? `· HSN ${p.hsn}` : ''} · {p.unit || ''} · ₹{Number(p.rate || 0).toLocaleString('en-IN')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
