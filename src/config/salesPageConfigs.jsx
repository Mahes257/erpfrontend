import {
  Archive as ArchiveIcon,
  BadgeCheck,
  Ban,
  Banknote,
  CheckCheck as CheckCheckIcon,
  CheckCircle2,
  ClipboardList as ClipboardListIcon,
  Clock,
  Copy,
  Eye as EyeIcon,
  FileDown,
  FileSpreadsheet,
  FileText,
  GitBranch as GitBranchIcon,
  Handshake,
  History as HistoryIcon,
  IndianRupee,
  Layers as LayersIcon,
  Link2 as Link2Icon,
  Mail,
  MessageCircle,
  PackageCheck,
  Paperclip as PaperclipIcon,
  PenLine,
  Printer,
  RefreshCw,
  Repeat,
  RotateCcw,
  Send,
  Tag,
  Trash2,
  Truck,
  Wallet
} from 'lucide-react';
import useSalesModule from '../hooks/useSalesModule';
import { recalculateQuotationRates } from '../utils/quotationCurrency';
import quotationService from '../services/quotationService';
import salesContractService from '../services/salesContractService';
import salesOrderService from '../services/salesOrderService';
import deliveryChallanService from '../services/deliveryChallanService';
import proformaInvoiceService from '../services/proformaInvoiceService';
import invoiceService from '../services/invoiceService';
import paymentReceiptService from '../services/paymentReceiptService';
import creditNoteService from '../services/creditNoteService';
import {
  CREDIT_NOTE_STATUSES,
  DELIVERY_CHALLAN_STATUSES,
  INVOICE_STATUSES,
  PAYMENT_RECEIPT_STATUSES,
  PROFORMA_INVOICE_STATUSES,
  QUOTATION_STATUSES,
  SALES_CONTRACT_STATUSES,
  SALES_EXECUTIVES,
  SALES_ORDER_STATUSES
} from '../constants/salesConstants';
import {
  emailDocument,
  whatsappDocument,
  normalizeCreditNote,
  normalizeDeliveryChallan,
  normalizeInvoice,
  normalizePaymentReceipt,
  normalizeProformaInvoice,
  normalizeQuotation,
  normalizeSalesContract,
  normalizeSalesOrder
} from '../utils/salesHelpers';
import { buildSalesPrintHtml, exportSalesDocumentPdf } from '../utils/salesPrintUtils';
import { formatDate, formatINR } from '../utils/leadHelpers';

const money = (value) => formatINR(value);

// KPI card: statusValue is the backend status string used for both the card
// lookup (stats[statusValue]) and the status filter (statusMap key).
function statusKpi(statusValue, label, icon, color) {
  return { key: statusValue, label, valueOf: (s) => s?.[statusValue] ?? 0, icon, color };
}

// Conversion action keys shown in the Quotation Actions menu (ERP workflow
// order: Quotation → Sales Contract → Sales Order → Proforma Invoice →
// Invoice → Credit Note → Payment Receipt). Hidden once the quotation is
// converted, cancelled or deleted.
const QUOTATION_CONVERT_KEYS = new Set(['convertSc', 'convert', 'convertPi', 'convertDc', 'convertInv', 'convertCn', 'convertPr']);

// NOTE: the useHook options below (statusMap / searchKeys / extraParams) are
// defined as module-level constants so their identity never changes between
// renders. Passing inline literals would give buildParams a new identity on
// every render and re-fire the load effect endlessly (infinite loading loop).

// Display status label -> backend status value (used by the status filter).
const QTN_STATUS_VALUES = {
  'Draft': 'draft',
  'Sent': 'sent',
  'Accepted': 'accepted',
  'Rejected': 'rejected',
  'Negotiation': 'negotiation',
  'Expired': 'expired',
  'Cancelled': 'cancelled',
  'Converted': 'converted'
};
const SC_STATUS_VALUES = {
  'Draft': 'draft',
  'Submitted': 'submitted',
  'Under Review': 'under review',
  'Approved': 'approved',
  'Active': 'active',
  'Completed': 'completed',
  'Cancelled': 'cancelled'
};
const SO_STATUS_VALUES = {
  'Draft': 'draft',
  'Pending Review': 'pending review',
  'Approved': 'approved',
  'In Progress': 'in progress',
  'Completed': 'completed',
  'Cancelled': 'cancelled'
};
const DC_STATUS_VALUES = {
  'Draft': 'draft',
  'Packed': 'packed',
  'Dispatched': 'dispatched',
  'In Transit': 'in transit',
  'Delivered': 'delivered',
  'Accepted': 'accepted',
  'Cancelled': 'cancelled'
};
const PI_STATUS_VALUES = {
  'Draft': 'draft',
  'Sent': 'sent',
  'Paid': 'paid',
  'Overdue': 'overdue',
  'Accepted': 'accepted',
  'Expired': 'expired',
  'Converted': 'converted',
  'Cancelled': 'cancelled'
};
const INV_STATUS_VALUES = {
  'Draft': 'draft',
  'Issued': 'issued',
  'Sent': 'sent',
  'Partial': 'partial',
  'Paid': 'paid',
  'Overdue': 'overdue',
  'Cancelled': 'cancelled'
};
const PR_STATUS_VALUES = {
  'Draft': 'draft',
  'Received': 'received',
  'Partial': 'partial',
  'Completed': 'completed',
  'Cancelled': 'cancelled'
};
const CN_STATUS_VALUES = {
  'Draft': 'draft',
  'Pending Approval': 'pending approval',
  'Approved': 'approved',
  'Issued': 'issued',
  'Adjusted': 'adjusted',
  'Refunded': 'refunded',
  'Cancelled': 'cancelled'
};

// ===== Module hook option constants (stable identities) =====
const QTN_STATUS_MAP = {
  all: '',
  draft: 'draft',
  sent: 'sent',
  accepted: 'accepted',
  negotiation: 'negotiation',
  rejected: 'rejected',
  expired: 'expired',
  converted: 'converted',
  cancelled: 'cancelled'
};
const QTN_SEARCH_KEYS = ['no', 'client', 'lead'];
const QTN_EXTRA_PARAMS = { client: 'client', salesPerson: 'salesPerson', validTill: 'validTill' };

const SC_STATUS_MAP = {
  all: '',
  draft: 'draft',
  submitted: 'submitted',
  approved: 'approved',
  active: 'active'
};
const SC_SEARCH_KEYS = ['no', 'client'];
const SC_EXTRA_PARAMS = { client: 'client' };

const SO_STATUS_MAP = {
  all: '',
  draft: 'draft',
  'pending review': 'pending review',
  approved: 'approved',
  'in progress': 'in progress'
};
const SO_SEARCH_KEYS = ['no', 'client', 'lead'];
const SO_EXTRA_PARAMS = { client: 'client' };

const DC_STATUS_MAP = {
  all: '',
  draft: 'draft',
  packed: 'packed',
  dispatched: 'dispatched',
  'in transit': 'in transit',
  delivered: 'delivered',
  accepted: 'accepted'
};
const DC_SEARCH_KEYS = ['no', 'client'];
const DC_EXTRA_PARAMS = { client: 'client' };

const PI_STATUS_MAP = {
  all: '',
  draft: 'draft',
  sent: 'sent',
  paid: 'paid',
  overdue: 'overdue'
};
const PI_SEARCH_KEYS = ['no', 'client'];
const PI_EXTRA_PARAMS = { client: 'client' };

const INV_STATUS_MAP = {
  all: '',
  draft: 'draft',
  issued: 'issued',
  sent: 'sent',
  partial: 'partial',
  paid: 'paid'
};
const INV_SEARCH_KEYS = ['no', 'client'];
const INV_EXTRA_PARAMS = { client: 'client' };

const PR_STATUS_MAP = {
  all: '',
  draft: 'draft',
  received: 'received',
  partial: 'partial',
  completed: 'completed',
  cancelled: 'cancelled'
};
const PR_SEARCH_KEYS = ['no', 'client'];
const PR_EXTRA_PARAMS = { client: 'client' };

const CN_STATUS_MAP = {
  all: '',
  draft: 'draft',
  'pending approval': 'pending approval',
  approved: 'approved',
  issued: 'issued',
  adjusted: 'adjusted'
};
const CN_SEARCH_KEYS = ['no', 'client'];
const CN_EXTRA_PARAMS = { client: 'client' };

// ===== Quotations =====
export const quotationListConfig = {
  service: quotationService,
  moduleKey: 'quotation',
  title: 'Quotation',
  titlePlural: 'Quotations',
  icon: FileText,
  newLabel: 'New Quotation',
  listRoute: '/quotations',
  newRoute: '/quotations/new',
  viewRoute: (row) => `/quotations/${row.id}/view`,
  editRoute: (row) => `/quotations/${row.id}/edit`,
  searchPlaceholder: 'Search Quotation No, Client, Sales Person...',
  tableMinWidth: 1000,
  useHook: () =>
    useSalesModule({
      service: quotationService,
      moduleKey: 'quotation',
      statusMap: QTN_STATUS_MAP,
      statusValueMap: QTN_STATUS_VALUES,
      searchKeys: QTN_SEARCH_KEYS,
      extraParams: QTN_EXTRA_PARAMS
    }),
  columns: [
    { key: 'checkbox', label: '', width: 48, always: true },
    { key: 'quotationNo', label: 'Quotation No', width: 160, sortable: true, mandatory: true },
    { key: 'quotationDate', label: 'Date', width: 110, sortable: true },
    { key: 'clientName', label: 'Client', width: 200, sortable: true },
    { key: 'salesPerson', label: 'Sales Person', width: 140 },
    { key: 'items', label: 'Items', width: 70, align: 'center', render: (row) => (Array.isArray(row.items) ? row.items.length : row.itemsCount ?? '—') },
    { key: 'grandTotal', label: 'Amount', width: 130, align: 'right', sortable: true },
    { key: 'validUntil', label: 'Valid Until', width: 110 },
    { key: 'status', label: 'Status', width: 150, mandatory: true },
    { key: 'createdAt', label: 'Created', width: 110, render: (row) => <span className="text-slate-500">{formatDate(row.createdAt)}</span> },
    { key: 'actions', label: 'Actions', width: 110, align: 'center', mandatory: true }
  ],
  kpis: [
    { key: 'all', label: 'Total Quotations', valueOf: (s) => s?.total ?? s?.all ?? 0, icon: FileText, color: '#3b82f6' },
    statusKpi('draft', 'Draft', PenLine, '#f59e0b'),
    statusKpi('sent', 'Sent', Send, '#3b82f6'),
    statusKpi('accepted', 'Accepted', CheckCircle2, '#10b981'),
    statusKpi('negotiation', 'Negotiation', Handshake, '#d97706'),
    statusKpi('rejected', 'Rejected', Ban, '#dc2626'),
    statusKpi('expired', 'Expired', Clock, '#ef4444'),
    statusKpi('converted', 'Converted', Repeat, '#8b5cf6'),
    statusKpi('cancelled', 'Cancelled', Ban, '#9ca3af'),
    { key: 'totalvalue', label: 'Total Value', valueOf: (s) => money(s?.totalAmt ?? 0), icon: IndianRupee, color: '#059669' }
  ],
  filters: [
    { key: 'client', label: 'Client', type: 'text', placeholder: 'Search client...' },
    { key: 'salesPerson', label: 'Sales Person', type: 'select', options: SALES_EXECUTIVES, masterKey: 'sales_executives' },
    { key: 'status', label: 'Status', type: 'select', options: QUOTATION_STATUSES },
    { key: 'dateFrom', label: 'Date From', type: 'date' },
    { key: 'dateTo', label: 'Date To', type: 'date' },
    { key: 'validTill', label: 'Valid Till', type: 'date' },
    { key: 'minAmount', label: 'Min Amount', type: 'number' },
    { key: 'maxAmount', label: 'Max Amount', type: 'number' }
  ],
  // ERP quotations.js _actionMenu: headed sections QUOTATION / DOCUMENTS / CONVERSION / STATUS.
  rowMenu: (row) => {
    const status = String(row.status || '').toLowerCase();
    if (status === 'archived') {
      return [
        { heading: true, label: 'QUOTATION' },
        { key: 'view', label: 'View', icon: EyeIcon },
        { key: 'edit', label: 'Edit', icon: PenLine },
        { divider: true },
        { heading: true, label: 'STATUS' },
        { key: 'restore', label: 'Restore to Active', icon: RotateCcw },
        { key: 'delete', label: 'Delete', icon: Trash2, danger: true }
      ];
    }
    const items = [
      { heading: true, label: 'QUOTATION' },
      { key: 'view', label: 'View', icon: EyeIcon },
      { key: 'edit', label: 'Edit', icon: PenLine },
      { key: 'duplicate', label: 'Duplicate', icon: Copy },
      { divider: true },
      { heading: true, label: 'DOCUMENTS' },
      { key: 'pdf', label: 'Download PDF', icon: FileDown },
      { key: 'email', label: 'Email', icon: Mail },
      { divider: true },
      { heading: true, label: 'CONVERSION' },
      { key: 'convertSc', label: 'Convert to Sales Contract', icon: FileSpreadsheet },
      { key: 'convert', label: 'Convert to Sales Order', icon: PackageCheck },
      { key: 'convertPi', label: 'Convert to Proforma Invoice', icon: FileText },
      { key: 'convertDc', label: 'Convert to Delivery Challan', icon: Truck },
      { key: 'convertInv', label: 'Convert to Invoice', icon: Wallet },
      { key: 'convertCn', label: 'Convert to Credit Note', icon: FileText },
      { key: 'convertPr', label: 'Convert to Payment Receipt', icon: Banknote },
      { divider: true },
      { heading: true, label: 'STATUS' },
      { key: 'changeStatus', label: 'Change Status', icon: Tag },
      { key: 'archive', label: 'Archive', icon: ArchiveIcon },
      { key: 'delete', label: 'Delete', icon: Trash2, danger: true }
    ];
    if (row.convertedToSo || row.convertedToPi || row.convertedToInvoice || row.convertedToCn
      || row.convertedToPr || status === 'converted' || status === 'cancelled' || status === 'deleted') {
      // A converted / cancelled / deleted quotation hides the conversion and
      // status actions (ERP behaviour).
      return items.filter(
        (it) =>
          !it.key ||
          (!QUOTATION_CONVERT_KEYS.has(it.key) && it.key !== 'changeStatus' && it.key !== 'duplicate')
      );
    }
    return items;
  },
  rowActions: (row) => {
    const items = [];
    const status = String(row.status || '').toLowerCase();
    if (!row.convertedToSo && status !== 'converted' && status !== 'cancelled') {
      items.push({ key: 'convert', label: 'Convert to Sales Order', icon: PackageCheck });
    }
    items.push(
      { key: 'pdf', label: 'Download PDF', icon: FileDown },
      { key: 'email', label: 'Email', icon: Mail },
      { key: 'changeStatus', label: 'Change Status', icon: Tag }
    );
    return items;
  },
  onRowAction: (key, row, hook, navigate) => {
    if (key === 'convertSc') {
      // ERP quotation-convert flow: the dedicated Convert page pre-selects this
      // quotation and creates the Sales Contract from it (auto-populates client,
      // terms and items, marks the quotation converted).
      navigate(`/quotations/convert?id=${row.id}`);
      return undefined;
    }
    if (key === 'convert') return runAction(hook, row.id, 'convert-sales-order', `${row.quotationNo} converted to sales order`);
    if (key === 'convertPi') return runAction(hook, row.id, 'convert-proforma', `${row.quotationNo} converted to proforma invoice`);
    if (key === 'convertDc') return runAction(hook, row.id, 'convert-delivery-challan', `${row.quotationNo} converted to delivery challan`);
    if (key === 'convertInv') return runAction(hook, row.id, 'convert-invoice', `${row.quotationNo} converted to invoice`);
    if (key === 'convertCn') return runAction(hook, row.id, 'convert-credit-note', `${row.quotationNo} converted to credit note`);
    if (key === 'convertPr') return runAction(hook, row.id, 'convert-payment-receipt', `${row.quotationNo} converted to payment receipt`);
    if (key === 'email') return emailDocument(row, 'quotation', 'Quotation');
    if (key === 'pdf') return exportSalesDocumentPdf(row, 'Quotation', 'quotation', `${row.quotationNo || 'quotation'}-${new Date().toISOString().slice(0, 10)}`);
    return undefined;
  }
};

export const quotationViewConfig = {
  service: quotationService,
  moduleKey: 'quotation',
  title: 'Quotation',
  label: 'quotation',
  listRoute: '/quotations',
  editRoute: (doc) => `/quotations/${doc.id}/edit`,
  dateKey: 'quotationDate',
  normalize: normalizeQuotation,
  // ERP quotation-view: Back, Edit, Print, Email, Archive (no duplicate/share/pdf/delete in header)
  viewHeaderActions: ['edit', 'print', 'email', 'archive'],
  // ERP quotation-view tabs: Overview, Timeline, Activity Log, Attachments, Linked Documents, Version History, Approval History
  viewTabs: [
    { key: 'overview', label: 'Overview', icon: LayersIcon, count: null },
    { key: 'timeline', label: 'Timeline', icon: HistoryIcon, count: null },
    { key: 'activities', label: 'Activity Log', icon: ClipboardListIcon, count: null },
    { key: 'attachments', label: 'Attachments', icon: PaperclipIcon, count: null },
    { key: 'linked-documents', label: 'Linked Documents', icon: Link2Icon, count: null },
    { key: 'version-history', label: 'Version History', icon: GitBranchIcon, count: null },
    { key: 'approval-history', label: 'Approval History', icon: CheckCheckIcon, count: null }
  ],
  addressCards: true,
  showItemsInOverview: true,
  generalRows: (doc) => [
    ['Quotation No', <strong key="n">{doc.quotationNo}</strong>],
    ['Date', formatDate(doc.quotationDate)],
    ['Valid Till', formatDate(doc.validUntil)],
    ['Reference', doc.reference || '—'],
    ['Sales Person', doc.salesPerson || '—'],
    ['Currency', doc.currency || '—']
  ],
  linkedDocs: (doc) => {
    const links = [];
    if (doc.leadNo) links.push({ label: 'Lead', value: doc.leadNo });
    if (doc.sourceCw) links.push({ label: 'Cost Workout', value: doc.sourceCw });
    if (doc.sourceCpr) links.push({ label: 'CPR', value: doc.sourceCpr });
    if (doc.convertedToSo) links.push({ label: 'Sales Order', value: doc.convertedToSo });
    return links;
  },
  headerActions: (doc, { runAction }) => {
    const actions = [];
    const status = String(doc.status || '').toLowerCase();
    if ((status === 'draft' || status === 'rejected') && !doc.convertedToSo) {
      actions.push({ key: 'send', label: 'Send', icon: Send, style: 'primary', action: () => runAction(() => quotationService.postAction(doc.id, 'send'), `${doc.quotationNo} sent to client`) });
    }
    if (status === 'accepted' && !doc.convertedToSo) {
      actions.push({ key: 'convert', label: 'Convert to Sales Order', icon: PackageCheck, style: 'green', action: () => runAction(() => quotationService.postAction(doc.id, 'convert-sales-order'), `${doc.quotationNo} converted to sales order`) });
    }
    // Live exchange-rate support: saved quotations keep the rate used at
    // creation; the user can explicitly recalculate with the latest rates.
    const hasRates = doc.currency && Number(doc.exchangeRate) > 0;
    if (hasRates && status !== 'deleted' && status !== 'archived') {
      actions.push({
        key: 'recalc',
        label: 'Recalculate with Latest Rates',
        icon: RefreshCw,
        style: 'ghost',
        action: () =>
          runAction(
            () => recalculateQuotationRates(doc, quotationService),
            `${doc.quotationNo || 'Quotation'} recalculated with latest exchange rates`
          )
      });
    }
    return actions;
  },
  printHtml: (doc) => buildSalesPrintHtml(doc, 'Quotation', 'quotation'),
  exportPdf: (doc) => exportSalesDocumentPdf(doc, 'Quotation', 'quotation', `${doc.quotationNo || 'quotation'}-${new Date().toISOString().slice(0, 10)}`)
};

// ===== Sales Contracts =====
export const salesContractListConfig = {
  service: salesContractService,
  moduleKey: 'salesContract',
  title: 'Sales Contract',
  titlePlural: 'Sales Contracts',
  icon: FileSpreadsheet,
  newLabel: 'New Sales Contract',
  listRoute: '/sales-contracts',
  newRoute: '/sales-contracts/new',
  viewRoute: (row) => `/sales-contracts/${row.id}`,
  editRoute: (row) => `/sales-contracts/${row.id}/edit`,
  searchPlaceholder: 'Search Contract No, Client, PO Ref...',
  tableMinWidth: 1000,
  useHook: () =>
    useSalesModule({
      service: salesContractService,
      moduleKey: 'salesContract',
      statusMap: SC_STATUS_MAP,
      statusValueMap: SC_STATUS_VALUES,
      searchKeys: SC_SEARCH_KEYS,
      extraParams: SC_EXTRA_PARAMS
    }),
  columns: [
    { key: 'checkbox', label: '', width: 48, always: true },
    { key: 'contractDate', label: 'Date', width: 110, sortable: true },
    { key: 'scNo', label: 'SC No', width: 160, sortable: true, mandatory: true },
    { key: 'clientName', label: 'Client', width: 200, sortable: true },
    { key: 'contactPerson', label: 'Contact', width: 150 },
    { key: 'poRef', label: 'PO Ref', width: 140 },
    { key: 'grandTotal', label: 'Amount', width: 130, align: 'right', sortable: true },
    { key: 'status', label: 'Status', width: 140, mandatory: true },
    { key: 'convertedToSo', label: 'Source SO', width: 130, render: (row) => row.convertedToSo || '—' },
    { key: 'actions', label: 'Actions', width: 110, align: 'center', mandatory: true }
  ],
  kpis: [
    { key: 'all', label: 'All Contracts', valueOf: (s) => s?.total ?? s?.all ?? 0, icon: FileSpreadsheet, color: '#0B4A3D' },
    { key: 'totalvalue', label: 'Total Amount', valueOf: (s) => money(s?.totalAmt ?? 0), icon: IndianRupee, color: '#ec4899' },
    statusKpi('draft', 'Draft', PenLine, '#6b7280'),
    statusKpi('submitted', 'Submitted', Clock, '#2563eb'),
    statusKpi('approved', 'Approved', CheckCircle2, '#16a34a'),
    statusKpi('active', 'Active', BadgeCheck, '#2563eb'),
    statusKpi('completed', 'Completed', CheckCircle2, '#059669'),
    statusKpi('cancelled', 'Cancelled', Ban, '#9ca3af')
  ],
  filters: [
    { key: 'no', label: 'Contract No', type: 'text', placeholder: 'Search number...' },
    { key: 'client', label: 'Client', type: 'text', placeholder: 'Search client...' },
    { key: 'status', label: 'Status', type: 'select', options: SALES_CONTRACT_STATUSES },
    { key: 'dateFrom', label: 'Date From', type: 'date' },
    { key: 'dateTo', label: 'Date To', type: 'date' }
  ],
  rowActions: (row) => {
    const items = [];
    const status = String(row.status || '').toLowerCase();
    if (status === 'draft') items.push({ key: 'approve', label: 'Approve', icon: CheckCircle2 });
    if (status === 'approved' && !row.convertedToSo) items.push({ key: 'convert', label: 'Convert to Sales Order', icon: PackageCheck });
    items.push({ key: 'email', label: 'Email', icon: Mail }, { key: 'print', label: 'Print', icon: Printer }, { key: 'pdf', label: 'PDF', icon: FileDown });
    return items;
  },
  onRowAction: (key, row, hook) => {
    if (key === 'approve') return runAction(hook, row.id, 'approve', `${row.scNo} approved`);
    if (key === 'convert') return runAction(hook, row.id, 'convert-sales-order', `${row.scNo} converted to sales order`);
    if (key === 'email') return emailDocument(row, 'salesContract', 'Sales Contract');
    if (key === 'print') return openPrint(buildSalesPrintHtml(row, 'Sales Contract', 'salesContract'));
    if (key === 'pdf') return exportSalesDocumentPdf(row, 'Sales Contract', 'salesContract', `${row.scNo || 'contract'}-${new Date().toISOString().slice(0, 10)}`);
    return undefined;
  }
};

export const salesContractViewConfig = {
  service: salesContractService,
  moduleKey: 'salesContract',
  title: 'Sales Contract',
  label: 'sales contract',
  listRoute: '/sales-contracts',
  editRoute: (doc) => `/sales-contracts/${doc.id}/edit`,
  dateKey: 'contractDate',
  normalize: normalizeSalesContract,
  // ERP sales-contract-view header actions: Edit, PDF, Print, Convert, Back
  viewHeaderActions: ['edit', 'print', 'pdf', 'email', 'share', 'whatsapp', 'archive', 'delete'],
  generalRows: (doc) => [
    ['SC No', <strong key="n">{doc.scNo}</strong>],
    ['Customer PO', doc.poRef || '—'],
    ['Date', formatDate(doc.contractDate)],
    ['Lead No', doc.leadNo || '—'],
    ['Quotation Ref', doc.qtnRef || '—'],
    ['Sales Executive', doc.salesExecutive || '—'],
    ['Payment Terms', doc.paymentTerms || '—'],
    ['Delivery Terms', doc.deliveryTerms || '—'],
    ['Contract Validity', formatDate(doc.validity)],
    ['Contract Duration', doc.duration || '—'],
    ['Warranty Terms', doc.warranty || '—']
  ],
  linkedDocs: (doc) => {
    const links = [];
    if (doc.qtnRef) links.push({ label: 'Quotation', value: doc.qtnRef });
    if (doc.leadNo) links.push({ label: 'Lead', value: doc.leadNo });
    if (doc.convertedToSo) links.push({ label: 'Sales Order', value: doc.convertedToSo });
    return links;
  },
  headerActions: (doc, { runAction }) => {
    const actions = [];
    const status = String(doc.status || '').toLowerCase();
    if (status === 'draft') {
      actions.push({ key: 'approve', label: 'Approve', icon: CheckCircle2, style: 'approve', action: () => runAction(() => salesContractService.postAction(doc.id, 'approve'), `${doc.scNo} approved`) });
    }
    if (status === 'approved' && !doc.convertedToSo) {
      actions.push({ key: 'convert', label: 'Convert to Sales Order', icon: PackageCheck, style: 'green', action: () => runAction(() => salesContractService.postAction(doc.id, 'convert-sales-order'), `${doc.scNo} converted to sales order`) });
    }
    return actions;
  },
  printHtml: (doc) => buildSalesPrintHtml(doc, 'Sales Contract', 'salesContract'),
  exportPdf: (doc) => exportSalesDocumentPdf(doc, 'Sales Contract', 'salesContract', `${doc.scNo || 'contract'}-${new Date().toISOString().slice(0, 10)}`)
};

// ===== Sales Orders =====
export const salesOrderListConfig = {
  service: salesOrderService,
  moduleKey: 'salesOrder',
  title: 'Sales Order',
  titlePlural: 'Sales Orders',
  icon: PackageCheck,
  newLabel: 'New Sales Order',
  listRoute: '/sales-orders',
  newRoute: '/sales-orders/new',
  viewRoute: (row) => `/sales-orders/${row.id}`,
  editRoute: (row) => `/sales-orders/${row.id}/edit`,
  searchPlaceholder: 'Search Order No, Client, PO No...',
  tableMinWidth: 1000,
  useHook: () =>
    useSalesModule({
      service: salesOrderService,
      moduleKey: 'salesOrder',
      statusMap: SO_STATUS_MAP,
      statusValueMap: SO_STATUS_VALUES,
      searchKeys: SO_SEARCH_KEYS,
      extraParams: SO_EXTRA_PARAMS
    }),
  columns: [
    { key: 'checkbox', label: '', width: 48, always: true },
    { key: 'orderDate', label: 'Date', width: 110, sortable: true },
    { key: 'soNo', label: 'SO No', width: 160, sortable: true, mandatory: true },
    { key: 'clientName', label: 'Client', width: 200, sortable: true },
    { key: 'contactPerson', label: 'Contact', width: 150 },
    { key: 'customerPo', label: 'PO Ref', width: 140 },
    { key: 'grandTotal', label: 'Amount', width: 130, align: 'right', sortable: true },
    { key: 'status', label: 'Status', width: 140, mandatory: true },
    { key: 'scRef', label: 'SC Ref', width: 130, render: (row) => row.scRef || '—' },
    { key: 'actions', label: 'Actions', width: 110, align: 'center', mandatory: true }
  ],
  kpis: [
    { key: 'all', label: 'All Orders', valueOf: (s) => s?.total ?? s?.all ?? 0, icon: PackageCheck, color: '#0B4A3D' },
    { key: 'totalvalue', label: 'Total Amount', valueOf: (s) => money(s?.totalAmt ?? 0), icon: IndianRupee, color: '#ec4899' },
    statusKpi('draft', 'Draft', PenLine, '#6b7280'),
    statusKpi('pending review', 'Pending Review', Clock, '#d97706'),
    statusKpi('approved', 'Approved', CheckCircle2, '#16a34a'),
    statusKpi('in progress', 'In Progress', Clock, '#2563eb')
  ],
  filters: [
    { key: 'no', label: 'Order No', type: 'text', placeholder: 'Search number...' },
    { key: 'client', label: 'Client', type: 'text', placeholder: 'Search client...' },
    { key: 'status', label: 'Status', type: 'select', options: SALES_ORDER_STATUSES },
    { key: 'dateFrom', label: 'Date From', type: 'date' },
    { key: 'dateTo', label: 'Date To', type: 'date' }
  ],
  rowActions: (row) => {
    const items = [];
    const status = String(row.status || '').toLowerCase();
    if (status === 'draft') {
      items.push({ key: 'approve', label: 'Approve', icon: CheckCircle2 });
      items.push({ key: 'cancel', label: 'Cancel Order', icon: Ban });
    }
    if (status === 'approved' || status === 'in progress') {
      items.push({ key: 'dc', label: 'Generate Delivery Challan', icon: Truck });
      items.push({ key: 'proforma', label: 'Convert to Proforma', icon: FileText });
      items.push({ key: 'invoice', label: 'Convert to Invoice', icon: Wallet });
    }
    items.push({ key: 'email', label: 'Email', icon: Mail }, { key: 'print', label: 'Print', icon: Printer }, { key: 'pdf', label: 'PDF', icon: FileDown });
    return items;
  },
  onRowAction: (key, row, hook) => {
    const actions = {
      approve: ['approve', `${row.soNo} approved`],
      cancel: ['cancel', `${row.soNo} cancelled`],
      dc: ['generate-delivery-challan', `${row.soNo} delivery challan generated`],
      proforma: ['convert-proforma', `${row.soNo} converted to proforma`],
      invoice: ['convert-invoice', `${row.soNo} converted to invoice`]
    };
    if (actions[key]) return runAction(hook, row.id, actions[key][0], actions[key][1]);
    if (key === 'email') return emailDocument(row, 'salesOrder', 'Sales Order');
    if (key === 'print') return openPrint(buildSalesPrintHtml(row, 'Sales Order', 'salesOrder'));
    if (key === 'pdf') return exportSalesDocumentPdf(row, 'Sales Order', 'salesOrder', `${row.soNo || 'order'}-${new Date().toISOString().slice(0, 10)}`);
    return undefined;
  }
};

export const salesOrderViewConfig = {
  service: salesOrderService,
  moduleKey: 'salesOrder',
  title: 'Sales Order',
  label: 'sales order',
  listRoute: '/sales-orders',
  editRoute: (doc) => `/sales-orders/${doc.id}/edit`,
  dateKey: 'orderDate',
  normalize: normalizeSalesOrder,
  generalRows: (doc) => [
    ['SO No', <strong key="n">{doc.soNo}</strong>],
    ['Customer PO', doc.customerPo || '—'],
    ['Order Date', formatDate(doc.orderDate)],
    ['Lead No', doc.leadNo || '—'],
    ['Quotation Ref', doc.qtnRef || '—'],
    ['Contract Ref', doc.scRef || '—'],
    ['Sales Executive', doc.salesExecutive || '—'],
    ['Payment Terms', doc.paymentTerms || '—'],
    ['Delivery Terms', doc.deliveryTerms || '—'],
    ['Delivery Date', formatDate(doc.deliveryDate)]
  ],
  linkedDocs: (doc) => {
    const links = [];
    if (doc.qtnRef) links.push({ label: 'Quotation', value: doc.qtnRef });
    if (doc.scRef) links.push({ label: 'Sales Contract', value: doc.scRef });
    if (doc.convertedToDc) links.push({ label: 'Delivery Challan', value: doc.convertedToDc });
    if (doc.convertedToProforma) links.push({ label: 'Proforma Invoice', value: doc.convertedToProforma });
    if (doc.convertedToInv) links.push({ label: 'Invoice', value: doc.convertedToInv });
    return links;
  },
  headerActions: (doc, { runAction }) => {
    const actions = [];
    const status = String(doc.status || '').toLowerCase();
    if (status === 'draft') {
      actions.push({ key: 'approve', label: 'Approve', icon: CheckCircle2, style: 'approve', action: () => runAction(() => salesOrderService.postAction(doc.id, 'approve'), `${doc.soNo} approved`) });
      actions.push({ key: 'cancel', label: 'Cancel Order', icon: Ban, style: 'danger', action: () => runAction(() => salesOrderService.postAction(doc.id, 'cancel'), `${doc.soNo} cancelled`) });
    }
    if (status === 'approved' || status === 'in progress') {
      actions.push({ key: 'dc', label: 'Generate Delivery Challan', icon: Truck, style: 'secondary', action: () => runAction(() => salesOrderService.postAction(doc.id, 'generate-delivery-challan'), `${doc.soNo} delivery challan generated`) });
      actions.push({ key: 'proforma', label: 'Convert to Proforma', icon: FileText, style: 'secondary', action: () => runAction(() => salesOrderService.postAction(doc.id, 'convert-proforma'), `${doc.soNo} converted to proforma`) });
      actions.push({ key: 'invoice', label: 'Convert to Invoice', icon: Wallet, style: 'green', action: () => runAction(() => salesOrderService.postAction(doc.id, 'convert-invoice'), `${doc.soNo} converted to invoice`) });
    }
    return actions;
  },
  printHtml: (doc) => buildSalesPrintHtml(doc, 'Sales Order', 'salesOrder'),
  exportPdf: (doc) => exportSalesDocumentPdf(doc, 'Sales Order', 'salesOrder', `${doc.soNo || 'order'}-${new Date().toISOString().slice(0, 10)}`)
};

// ===== Delivery Challans =====
export const deliveryChallanListConfig = {
  service: deliveryChallanService,
  moduleKey: 'deliveryChallan',
  title: 'Delivery Challan',
  titlePlural: 'Delivery Challans',
  icon: Truck,
  newLabel: 'New Delivery Challan',
  listRoute: '/delivery-challans',
  newRoute: '/delivery-challans/new',
  viewRoute: (row) => `/delivery-challans/${row.id}`,
  editRoute: (row) => `/delivery-challans/${row.id}/edit`,
  searchPlaceholder: 'Search Challan No, Client, SO Ref...',
  tableMinWidth: 1000,
  useHook: () =>
    useSalesModule({
      service: deliveryChallanService,
      moduleKey: 'deliveryChallan',
      statusMap: DC_STATUS_MAP,
      statusValueMap: DC_STATUS_VALUES,
      searchKeys: DC_SEARCH_KEYS,
      extraParams: DC_EXTRA_PARAMS
    }),
  columns: [
    { key: 'checkbox', label: '', width: 48, always: true },
    { key: 'dcDate', label: 'Date', width: 110, sortable: true },
    { key: 'dcNo', label: 'DC No', width: 160, sortable: true, mandatory: true },
    { key: 'clientName', label: 'Client', width: 200, sortable: true },
    { key: 'transportCompany', label: 'Transport', width: 160 },
    { key: 'vehicleNumber', label: 'Vehicle', width: 120 },
    { key: 'grandTotal', label: 'Amount', width: 130, align: 'right', sortable: true },
    { key: 'status', label: 'Status', width: 140, mandatory: true },
    { key: 'soRef', label: 'SO Ref', width: 130, render: (row) => row.soRef || '—' },
    { key: 'actions', label: 'Actions', width: 110, align: 'center', mandatory: true }
  ],
  kpis: [
    { key: 'all', label: 'All DCs', valueOf: (s) => s?.total ?? s?.all ?? 0, icon: Truck, color: '#0B4A3D' },
    { key: 'totalvalue', label: 'Total Amount', valueOf: (s) => money(s?.totalAmt ?? 0), icon: IndianRupee, color: '#ec4899' },
    statusKpi('draft', 'Draft', PenLine, '#6b7280'),
    statusKpi('packed', 'Packed', PackageCheck, '#15803d'),
    statusKpi('dispatched', 'Dispatched', Truck, '#2563eb'),
    statusKpi('in transit', 'In Transit', Truck, '#2563eb'),
    statusKpi('delivered', 'Delivered', CheckCircle2, '#16a34a')
  ],
  filters: [
    { key: 'no', label: 'Challan No', type: 'text', placeholder: 'Search number...' },
    { key: 'client', label: 'Client', type: 'text', placeholder: 'Search client...' },
    { key: 'status', label: 'Status', type: 'select', options: DELIVERY_CHALLAN_STATUSES },
    { key: 'dateFrom', label: 'Date From', type: 'date' },
    { key: 'dateTo', label: 'Date To', type: 'date' }
  ],
  rowActions: (row) => {
    const items = [];
    const status = String(row.status || '').toLowerCase();
    if (!['converted', 'cancelled', 'deleted', 'archived'].includes(status)) {
      items.push({ key: 'accept', label: 'Accept Document', icon: CheckCircle2 });
      if (!row.convertedToInvoice) items.push({ key: 'convert', label: 'Generate Invoice', icon: Wallet });
    }
    items.push({ key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }, { key: 'email', label: 'Email', icon: Mail }, { key: 'print', label: 'Print', icon: Printer }, { key: 'pdf', label: 'PDF', icon: FileDown });
    return items;
  },
  onRowAction: (key, row, hook) => {
    if (key === 'accept') return hook.changeStatus(row.id, 'accepted').then(() => ({ ok: true, message: `${row.dcNo} accepted` }));
    if (key === 'convert') return runAction(hook, row.id, 'convert-invoice', `${row.dcNo} converted to invoice`);
    if (key === 'whatsapp') return whatsappDocument(row, 'deliveryChallan', 'Delivery Challan');
    if (key === 'email') return emailDocument(row, 'deliveryChallan', 'Delivery Challan');
    if (key === 'print') return openPrint(buildSalesPrintHtml(row, 'Delivery Challan', 'deliveryChallan'));
    if (key === 'pdf') return exportSalesDocumentPdf(row, 'Delivery Challan', 'deliveryChallan', `${row.dcNo || 'challan'}-${new Date().toISOString().slice(0, 10)}`);
    return undefined;
  }
};

export const deliveryChallanViewConfig = {
  service: deliveryChallanService,
  moduleKey: 'deliveryChallan',
  title: 'Delivery Challan',
  label: 'delivery challan',
  listRoute: '/delivery-challans',
  editRoute: (doc) => `/delivery-challans/${doc.id}/edit`,
  dateKey: 'dcDate',
  normalize: normalizeDeliveryChallan,
  generalRows: (doc) => [
    ['Challan No', <strong key="n">{doc.dcNo}</strong>],
    ['SO Ref', doc.soRef || '—'],
    ['Contract Ref', doc.scRef || '—'],
    ['Challan Date', formatDate(doc.dcDate)],
    ['Transport Company', doc.transportCompany || '—'],
    ['Vehicle Number', doc.vehicleNumber || '—'],
    ['Driver Name', doc.driverName || '—'],
    ['LR Number', doc.lrNumber || '—'],
    ['E-Way Bill', doc.ewayBill || '—'],
    ['Dispatch Date', formatDate(doc.dispatchDate)],
    ['Expected Delivery', formatDate(doc.deliveryDate)]
  ],
  linkedDocs: (doc) => {
    const links = [];
    if (doc.soRef) links.push({ label: 'Sales Order', value: doc.soRef });
    if (doc.scRef) links.push({ label: 'Sales Contract', value: doc.scRef });
    if (doc.convertedToInvoice) links.push({ label: 'Invoice', value: doc.convertedToInvoice });
    return links;
  },
  headerActions: (doc, { runAction }) => {
    const actions = [];
    const status = String(doc.status || '').toLowerCase();
    if (!['converted', 'cancelled', 'deleted', 'archived'].includes(status)) {
      if (!doc.convertedToInvoice) {
        actions.push({ key: 'convert', label: 'Generate Invoice', icon: Wallet, style: 'green', action: () => runAction(() => deliveryChallanService.postAction(doc.id, 'convert-invoice'), `${doc.dcNo} converted to invoice`) });
      }
      actions.push({ key: 'accept', label: 'Accept Document', icon: CheckCircle2, style: 'secondary', action: () => runAction(() => deliveryChallanService.changeStatus(doc.id, 'accepted'), `${doc.dcNo} accepted`) });
      actions.push({ key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, style: 'ghost', action: () => whatsappDocument(doc, 'deliveryChallan', 'Delivery Challan') });
    }
    return actions;
  },
  printHtml: (doc) => buildSalesPrintHtml(doc, 'Delivery Challan', 'deliveryChallan'),
  exportPdf: (doc) => exportSalesDocumentPdf(doc, 'Delivery Challan', 'deliveryChallan', `${doc.dcNo || 'challan'}-${new Date().toISOString().slice(0, 10)}`)
};

// ===== Proforma Invoices =====
export const proformaInvoiceListConfig = {
  service: proformaInvoiceService,
  moduleKey: 'proformaInvoice',
  title: 'Proforma Invoice',
  titlePlural: 'Proforma Invoices',
  icon: FileText,
  newLabel: 'New Proforma Invoice',
  listRoute: '/proforma-invoices',
  newRoute: '/proforma-invoices/new',
  viewRoute: (row) => `/proforma-invoices/${row.id}`,
  editRoute: (row) => `/proforma-invoices/${row.id}/edit`,
  searchPlaceholder: 'Search Proforma No, Client, Ref...',
  tableMinWidth: 1000,
  useHook: () =>
    useSalesModule({
      service: proformaInvoiceService,
      moduleKey: 'proformaInvoice',
      statusMap: PI_STATUS_MAP,
      statusValueMap: PI_STATUS_VALUES,
      searchKeys: PI_SEARCH_KEYS,
      extraParams: PI_EXTRA_PARAMS
    }),
  columns: [
    { key: 'checkbox', label: '', width: 48, always: true },
    { key: 'piDate', label: 'Date', width: 110, sortable: true },
    { key: 'piNo', label: 'PI No', width: 160, sortable: true, mandatory: true },
    { key: 'clientName', label: 'Client', width: 200, sortable: true },
    { key: 'grandTotal', label: 'Amount', width: 130, align: 'right', sortable: true },
    { key: 'status', label: 'Status', width: 140, mandatory: true },
    { key: 'dcRef', label: 'DC Ref', width: 130, render: (row) => (String(row.source || '').toLowerCase().includes('challan') ? row.sourceRef || '—' : '—') },
    { key: 'soRef', label: 'SO Ref', width: 130, render: (row) => (String(row.source || '').toLowerCase().includes('sales order') ? row.sourceRef || '—' : '—') },
    { key: 'actions', label: 'Actions', width: 110, align: 'center', mandatory: true }
  ],
  kpis: [
    { key: 'all', label: 'All PI', valueOf: (s) => s?.total ?? s?.all ?? 0, icon: FileText, color: '#0B4A3D' },
    { key: 'totalvalue', label: 'Total Amount', valueOf: (s) => money(s?.totalAmt ?? 0), icon: IndianRupee, color: '#ec4899' },
    statusKpi('draft', 'Draft', PenLine, '#6b7280'),
    statusKpi('sent', 'Sent', Send, '#2563eb'),
    statusKpi('paid', 'Paid', CheckCircle2, '#16a34a'),
    statusKpi('overdue', 'Overdue', Ban, '#dc2626')
  ],
  filters: [
    { key: 'no', label: 'Proforma No', type: 'text', placeholder: 'Search number...' },
    { key: 'client', label: 'Client', type: 'text', placeholder: 'Search client...' },
    { key: 'status', label: 'Status', type: 'select', options: PROFORMA_INVOICE_STATUSES },
    { key: 'dateFrom', label: 'Date From', type: 'date' },
    { key: 'dateTo', label: 'Date To', type: 'date' }
  ],
  rowActions: (row) => {
    const items = [];
    const status = String(row.status || '').toLowerCase();
    if (status === 'draft' || status === 'accepted') items.push({ key: 'send', label: 'Send', icon: Send });
    if (!['converted', 'cancelled', 'deleted', 'archived'].includes(status)) {
      if (!row.convertedToSo) items.push({ key: 'convertSo', label: 'Convert to Sales Order', icon: PackageCheck });
      if (!row.convertedToInvoice) items.push({ key: 'convert', label: 'Convert to Invoice', icon: Wallet });
      if (!row.convertedToDc) items.push({ key: 'generateDc', label: 'Generate Delivery Challan', icon: Truck });
    }
    items.push({ key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }, { key: 'email', label: 'Email', icon: Mail }, { key: 'print', label: 'Print', icon: Printer }, { key: 'pdf', label: 'PDF', icon: FileDown });
    return items;
  },
  onRowAction: (key, row, hook) => {
    if (key === 'send') return runAction(hook, row.id, 'send', `${row.piNo} sent`);
    if (key === 'convertSo') return runAction(hook, row.id, 'convert-sales-order', `${row.piNo} converted to sales order`);
    if (key === 'convert') return runAction(hook, row.id, 'convert-invoice', `${row.piNo} converted to invoice`);
    if (key === 'generateDc') return runAction(hook, row.id, 'generate-delivery-challan', `Delivery Challan generated from ${row.piNo}`);
    if (key === 'whatsapp') return whatsappDocument(row, 'proformaInvoice', 'Proforma Invoice');
    if (key === 'email') return emailDocument(row, 'proformaInvoice', 'Proforma Invoice');
    if (key === 'print') return openPrint(buildSalesPrintHtml(row, 'Proforma Invoice', 'proformaInvoice'));
    if (key === 'pdf') return exportSalesDocumentPdf(row, 'Proforma Invoice', 'proformaInvoice', `${row.piNo || 'proforma'}-${new Date().toISOString().slice(0, 10)}`);
    return undefined;
  }
};

export const proformaInvoiceViewConfig = {
  service: proformaInvoiceService,
  moduleKey: 'proformaInvoice',
  title: 'Proforma Invoice',
  label: 'proforma invoice',
  listRoute: '/proforma-invoices',
  editRoute: (doc) => `/proforma-invoices/${doc.id}/edit`,
  dateKey: 'piDate',
  normalize: normalizeProformaInvoice,
  generalRows: (doc) => [
    ['Proforma No', <strong key="n">{doc.piNo}</strong>],
    ['Proforma Date', formatDate(doc.piDate)],
    ['Reference No', doc.referenceNo || '—'],
    ['Valid Till', formatDate(doc.validTill)],
    ['Source', doc.source || '—'],
    ['Source Ref', doc.sourceRef || '—']
  ],
  linkedDocs: (doc) => {
    const links = [];
    if (doc.sourceRef) links.push({ label: 'Source', value: doc.sourceRef });
    if (doc.convertedToSo) links.push({ label: 'Sales Order', value: doc.convertedToSo });
    if (doc.convertedToInvoice) links.push({ label: 'Invoice', value: doc.convertedToInvoice });
    if (doc.convertedToDc) links.push({ label: 'Delivery Challan', value: doc.convertedToDc });
    return links;
  },
  headerActions: (doc, { runAction }) => {
    const actions = [];
    const status = String(doc.status || '').toLowerCase();
    if ((status === 'draft' || status === 'accepted') && !doc.convertedToInvoice) {
      actions.push({ key: 'send', label: 'Send', icon: Send, style: 'primary', action: () => runAction(() => proformaInvoiceService.postAction(doc.id, 'send'), `${doc.piNo} sent to client`) });
    }
    if (!['converted', 'cancelled', 'deleted', 'archived'].includes(status)) {
      if (!doc.convertedToSo) {
        actions.push({ key: 'convertSo', label: 'Convert to Sales Order', icon: PackageCheck, style: 'secondary', action: () => runAction(() => proformaInvoiceService.postAction(doc.id, 'convert-sales-order'), `${doc.piNo} converted to sales order`) });
      }
      if (!doc.convertedToInvoice) {
        actions.push({ key: 'convert', label: 'Convert to Invoice', icon: Wallet, style: 'green', action: () => runAction(() => proformaInvoiceService.postAction(doc.id, 'convert-invoice'), `${doc.piNo} converted to invoice`) });
      }
      if (!doc.convertedToDc) {
        actions.push({ key: 'generateDc', label: 'Generate Delivery Challan', icon: Truck, style: 'secondary', action: () => runAction(() => proformaInvoiceService.postAction(doc.id, 'generate-delivery-challan'), `Delivery Challan generated from ${doc.piNo}`) });
      }
      actions.push({ key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, style: 'ghost', action: () => whatsappDocument(doc, 'proformaInvoice', 'Proforma Invoice') });
    }
    return actions;
  },
  printHtml: (doc) => buildSalesPrintHtml(doc, 'Proforma Invoice', 'proformaInvoice'),
  exportPdf: (doc) => exportSalesDocumentPdf(doc, 'Proforma Invoice', 'proformaInvoice', `${doc.piNo || 'proforma'}-${new Date().toISOString().slice(0, 10)}`)
};

// ===== Invoices =====
export const invoiceListConfig = {
  service: invoiceService,
  moduleKey: 'invoice',
  title: 'Invoice',
  titlePlural: 'Invoices',
  icon: Wallet,
  newLabel: 'New Invoice',
  listRoute: '/invoices',
  newRoute: '/invoices/new',
  viewRoute: (row) => `/invoices/${row.id}`,
  editRoute: (row) => `/invoices/${row.id}/edit`,
  searchPlaceholder: 'Search Invoice No, Client, Ref...',
  tableMinWidth: 1000,
  useHook: () =>
    useSalesModule({
      service: invoiceService,
      moduleKey: 'invoice',
      statusMap: INV_STATUS_MAP,
      statusValueMap: INV_STATUS_VALUES,
      searchKeys: INV_SEARCH_KEYS,
      extraParams: INV_EXTRA_PARAMS
    }),
  columns: [
    { key: 'checkbox', label: '', width: 48, always: true },
    { key: 'invoiceDate', label: 'Date', width: 110, sortable: true },
    { key: 'invoiceNo', label: 'Invoice No', width: 160, sortable: true, mandatory: true },
    { key: 'clientName', label: 'Client', width: 200, sortable: true },
    { key: 'grandTotal', label: 'Amount', width: 130, align: 'right', sortable: true },
    { key: 'dueDate', label: 'Due Date', width: 110 },
    { key: 'status', label: 'Status', width: 140, mandatory: true },
    { key: 'piRef', label: 'PI Ref', width: 130, render: (row) => (String(row.source || '').toLowerCase().includes('proforma') ? row.sourceRef || '—' : '—') },
    { key: 'actions', label: 'Actions', width: 110, align: 'center', mandatory: true }
  ],
  kpis: [
    { key: 'all', label: 'All', valueOf: (s) => s?.total ?? s?.all ?? 0, icon: Wallet, color: '#0B4A3D' },
    statusKpi('draft', 'Draft', PenLine, '#6b7280'),
    statusKpi('issued', 'Issued', BadgeCheck, '#2563eb'),
    statusKpi('sent', 'Sent', Send, '#2563eb'),
    statusKpi('partial', 'Partial', Clock, '#b45309'),
    statusKpi('paid', 'Paid', CheckCircle2, '#16a34a')
  ],
  filters: [
    { key: 'no', label: 'Invoice No', type: 'text', placeholder: 'Search number...' },
    { key: 'client', label: 'Client', type: 'text', placeholder: 'Search client...' },
    { key: 'status', label: 'Status', type: 'select', options: INVOICE_STATUSES },
    { key: 'dateFrom', label: 'Date From', type: 'date' },
    { key: 'dateTo', label: 'Date To', type: 'date' }
  ],
  rowActions: (row) => {
    const items = [];
    const status = String(row.status || '').toLowerCase();
    if (status === 'draft' || status === 'sent') {
      items.push({ key: 'send', label: 'Send', icon: Send });
      items.push({ key: 'markpaid', label: 'Mark Paid', icon: CheckCircle2 });
    }
    if (status === 'sent' || status === 'partial') {
      items.push({ key: 'receipt', label: 'Generate Payment Receipt', icon: Banknote });
      items.push({ key: 'creditnote', label: 'Convert to Credit Note', icon: FileText });
    }
    items.push({ key: 'email', label: 'Email', icon: Mail }, { key: 'print', label: 'Print', icon: Printer }, { key: 'pdf', label: 'PDF', icon: FileDown });
    return items;
  },
  onRowAction: (key, row, hook) => {
    const actions = {
      send: ['send', `${row.invoiceNo} sent`],
      markpaid: ['mark-paid', `${row.invoiceNo} marked paid`],
      receipt: ['generate-payment-receipt', `${row.invoiceNo} payment receipt generated`],
      creditnote: ['convert-credit-note', `${row.invoiceNo} converted to credit note`]
    };
    if (actions[key]) return runAction(hook, row.id, actions[key][0], actions[key][1]);
    if (key === 'email') return emailDocument(row, 'invoice', 'Invoice');
    if (key === 'print') return openPrint(buildSalesPrintHtml(row, 'Invoice', 'invoice'));
    if (key === 'pdf') return exportSalesDocumentPdf(row, 'Invoice', 'invoice', `${row.invoiceNo || 'invoice'}-${new Date().toISOString().slice(0, 10)}`);
    return undefined;
  }
};

export const invoiceViewConfig = {
  service: invoiceService,
  moduleKey: 'invoice',
  title: 'Invoice',
  label: 'invoice',
  listRoute: '/invoices',
  editRoute: (doc) => `/invoices/${doc.id}/edit`,
  dateKey: 'invoiceDate',
  normalize: normalizeInvoice,
  generalRows: (doc) => [
    ['Invoice No', <strong key="n">{doc.invoiceNo}</strong>],
    ['Invoice Date', formatDate(doc.invoiceDate)],
    ['Due Date', formatDate(doc.dueDate)],
    ['Reference No', doc.referenceNo || '—'],
    ['Source', doc.source || '—'],
    ['Source Ref', doc.sourceRef || '—']
  ],
  linkedDocs: (doc) => {
    const links = [];
    if (doc.sourceRef) links.push({ label: 'Source', value: doc.sourceRef });
    if (doc.convertedToReceipt) links.push({ label: 'Payment Receipt', value: doc.convertedToReceipt });
    if (doc.convertedToCreditNote) links.push({ label: 'Credit Note', value: doc.convertedToCreditNote });
    return links;
  },
  headerActions: (doc, { runAction }) => {
    const actions = [];
    const status = String(doc.status || '').toLowerCase();
    if (status === 'draft' || status === 'sent') {
      actions.push({ key: 'send', label: 'Send', icon: Send, style: 'primary', action: () => runAction(() => invoiceService.postAction(doc.id, 'send'), `${doc.invoiceNo} sent to client`) });
      actions.push({ key: 'markpaid', label: 'Mark Paid', icon: CheckCircle2, style: 'approve', action: () => runAction(() => invoiceService.postAction(doc.id, 'mark-paid'), `${doc.invoiceNo} marked paid`) });
    }
    if (status === 'sent' || status === 'partial') {
      actions.push({ key: 'receipt', label: 'Generate Payment Receipt', icon: Banknote, style: 'secondary', action: () => runAction(() => invoiceService.postAction(doc.id, 'generate-payment-receipt'), `${doc.invoiceNo} payment receipt generated`) });
      actions.push({ key: 'creditnote', label: 'Convert to Credit Note', icon: FileText, style: 'secondary', action: () => runAction(() => invoiceService.postAction(doc.id, 'convert-credit-note'), `${doc.invoiceNo} converted to credit note`) });
    }
    return actions;
  },
  printHtml: (doc) => buildSalesPrintHtml(doc, 'Invoice', 'invoice'),
  exportPdf: (doc) => exportSalesDocumentPdf(doc, 'Invoice', 'invoice', `${doc.invoiceNo || 'invoice'}-${new Date().toISOString().slice(0, 10)}`)
};

// ===== Payment Receipts =====
export const paymentReceiptListConfig = {
  service: paymentReceiptService,
  moduleKey: 'paymentReceipt',
  title: 'Payment Receipt',
  titlePlural: 'Payment Receipts',
  icon: Banknote,
  newLabel: 'New Payment Receipt',
  listRoute: '/payment-receipts',
  newRoute: '/payment-receipts/new',
  viewRoute: (row) => `/payment-receipts/${row.id}`,
  editRoute: (row) => `/payment-receipts/${row.id}/edit`,
  searchPlaceholder: 'Search Receipt No, Client, Invoice Ref...',
  tableMinWidth: 900,
  useHook: () =>
    useSalesModule({
      service: paymentReceiptService,
      moduleKey: 'paymentReceipt',
      statusMap: PR_STATUS_MAP,
      statusValueMap: PR_STATUS_VALUES,
      searchKeys: PR_SEARCH_KEYS,
      extraParams: PR_EXTRA_PARAMS
    }),
  columns: [
    { key: 'checkbox', label: '', width: 48, always: true },
    { key: 'paymentDate', label: 'Date', width: 110, sortable: true },
    { key: 'receiptNo', label: 'Receipt No', width: 160, sortable: true, mandatory: true },
    { key: 'clientName', label: 'Customer', width: 200, sortable: true },
    { key: 'amount', label: 'Amount', width: 130, align: 'right', sortable: true },
    { key: 'paymentMode', label: 'Mode', width: 130 },
    { key: 'invoiceRef', label: 'Invoice Ref', width: 130 },
    { key: 'status', label: 'Status', width: 130, mandatory: true },
    { key: 'actions', label: 'Actions', width: 110, align: 'center', mandatory: true }
  ],
  kpis: [
    { key: 'all', label: 'All', valueOf: (s) => s?.total ?? s?.all ?? 0, icon: Banknote, color: '#0B4A3D' },
    statusKpi('draft', 'Draft', PenLine, '#6b7280'),
    statusKpi('received', 'Received', CheckCircle2, '#16a34a'),
    statusKpi('partial', 'Partial', Clock, '#b45309'),
    statusKpi('completed', 'Completed', CheckCircle2, '#059669'),
    statusKpi('cancelled', 'Cancelled', Ban, '#dc2626')
  ],
  filters: [
    { key: 'no', label: 'Receipt No', type: 'text', placeholder: 'Search number...' },
    { key: 'client', label: 'Customer', type: 'text', placeholder: 'Search customer...' },
    { key: 'status', label: 'Status', type: 'select', options: PAYMENT_RECEIPT_STATUSES },
    { key: 'dateFrom', label: 'Date From', type: 'date' },
    { key: 'dateTo', label: 'Date To', type: 'date' }
  ],
  rowActions: () => [
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'print', label: 'Print', icon: Printer },
    { key: 'pdf', label: 'PDF', icon: FileDown }
  ],
  onRowAction: (key, row) => {
    if (key === 'email') return emailDocument(row, 'paymentReceipt', 'Payment Receipt');
    if (key === 'print') return openPrint(buildSalesPrintHtml(row, 'Payment Receipt', 'paymentReceipt'));
    if (key === 'pdf') return exportSalesDocumentPdf(row, 'Payment Receipt', 'paymentReceipt', `${row.receiptNo || 'receipt'}-${new Date().toISOString().slice(0, 10)}`);
    return undefined;
  }
};

export const paymentReceiptViewConfig = {
  service: paymentReceiptService,
  moduleKey: 'paymentReceipt',
  title: 'Payment Receipt',
  label: 'payment receipt',
  listRoute: '/payment-receipts',
  editRoute: (doc) => `/payment-receipts/${doc.id}/edit`,
  dateKey: 'paymentDate',
  showItems: false,
  normalize: normalizePaymentReceipt,
  generalRows: (doc) => [
    ['Receipt No', <strong key="n">{doc.receiptNo}</strong>],
    ['Payment Date', formatDate(doc.paymentDate)],
    ['Payment Mode', doc.paymentMode || '—'],
    ['Bank Name', doc.bankName || '—'],
    ['Branch', doc.branch || '—'],
    ['Cheque / Tx No', doc.chequeTx || '—'],
    ['Reference No', doc.referenceNo || '—'],
    ['Source', doc.source || '—'],
    ['Invoice Ref', doc.invoiceRef || '—']
  ],
  linkedDocs: (doc) => {
    const links = [];
    if (doc.invoiceRef) links.push({ label: 'Invoice', value: doc.invoiceRef });
    return links;
  },
  printHtml: (doc) => buildSalesPrintHtml(doc, 'Payment Receipt', 'paymentReceipt'),
  exportPdf: (doc) => exportSalesDocumentPdf(doc, 'Payment Receipt', 'paymentReceipt', `${doc.receiptNo || 'receipt'}-${new Date().toISOString().slice(0, 10)}`)
};

// ===== Credit Notes =====
export const creditNoteListConfig = {
  service: creditNoteService,
  moduleKey: 'creditNote',
  title: 'Credit Note',
  titlePlural: 'Credit Notes',
  icon: FileText,
  newLabel: 'New Credit Note',
  listRoute: '/credit-notes',
  newRoute: '/credit-notes/new',
  viewRoute: (row) => `/credit-notes/${row.id}`,
  editRoute: (row) => `/credit-notes/${row.id}/edit`,
  searchPlaceholder: 'Search Credit Note No, Client, Reason...',
  tableMinWidth: 1000,
  useHook: () =>
    useSalesModule({
      service: creditNoteService,
      moduleKey: 'creditNote',
      statusMap: CN_STATUS_MAP,
      statusValueMap: CN_STATUS_VALUES,
      searchKeys: CN_SEARCH_KEYS,
      extraParams: CN_EXTRA_PARAMS
    }),
  columns: [
    { key: 'checkbox', label: '', width: 48, always: true },
    { key: 'cnDate', label: 'Date', width: 110, sortable: true },
    { key: 'cnNo', label: 'CN No', width: 160, sortable: true, mandatory: true },
    { key: 'clientName', label: 'Customer', width: 200, sortable: true },
    { key: 'grandTotal', label: 'Amount', width: 130, align: 'right', sortable: true },
    { key: 'reason', label: 'Reason', width: 170 },
    { key: 'status', label: 'Status', width: 150, mandatory: true },
    { key: 'actions', label: 'Actions', width: 110, align: 'center', mandatory: true }
  ],
  kpis: [
    { key: 'all', label: 'All', valueOf: (s) => s?.total ?? s?.all ?? 0, icon: FileText, color: '#0B4A3D' },
    statusKpi('draft', 'Draft', PenLine, '#6b7280'),
    statusKpi('pending approval', 'Pending Approval', Clock, '#d97706'),
    statusKpi('approved', 'Approved', CheckCircle2, '#16a34a'),
    statusKpi('issued', 'Issued', BadgeCheck, '#2563eb'),
    statusKpi('adjusted', 'Adjusted', CheckCircle2, '#a16207')
  ],
  filters: [
    { key: 'no', label: 'Credit Note No', type: 'text', placeholder: 'Search number...' },
    { key: 'client', label: 'Customer', type: 'text', placeholder: 'Search customer...' },
    { key: 'status', label: 'Status', type: 'select', options: CREDIT_NOTE_STATUSES },
    { key: 'dateFrom', label: 'Date From', type: 'date' },
    { key: 'dateTo', label: 'Date To', type: 'date' }
  ],
  rowActions: (row) => {
    const items = [];
    const status = String(row.status || '').toLowerCase();
    if (status === 'draft' || status === 'pending approval') items.push({ key: 'approve', label: 'Approve', icon: CheckCircle2 });
    if (status === 'approved') items.push({ key: 'issue', label: 'Issue', icon: BadgeCheck });
    items.push({ key: 'email', label: 'Email', icon: Mail }, { key: 'print', label: 'Print', icon: Printer }, { key: 'pdf', label: 'PDF', icon: FileDown });
    return items;
  },
  onRowAction: (key, row, hook) => {
    const actions = {
      approve: ['approve', `${row.cnNo} approved`],
      issue: ['issue', `${row.cnNo} issued`]
    };
    if (actions[key]) return runAction(hook, row.id, actions[key][0], actions[key][1]);
    if (key === 'email') return emailDocument(row, 'creditNote', 'Credit Note');
    if (key === 'print') return openPrint(buildSalesPrintHtml(row, 'Credit Note', 'creditNote'));
    if (key === 'pdf') return exportSalesDocumentPdf(row, 'Credit Note', 'creditNote', `${row.cnNo || 'credit-note'}-${new Date().toISOString().slice(0, 10)}`);
    return undefined;
  }
};

export const creditNoteViewConfig = {
  service: creditNoteService,
  moduleKey: 'creditNote',
  title: 'Credit Note',
  label: 'credit note',
  listRoute: '/credit-notes',
  editRoute: (doc) => `/credit-notes/${doc.id}/edit`,
  dateKey: 'cnDate',
  normalize: normalizeCreditNote,
  generalRows: (doc) => [
    ['Credit Note No', <strong key="n">{doc.cnNo}</strong>],
    ['Credit Note Date', formatDate(doc.cnDate)],
    ['Source', doc.source || '—'],
    ['Source Ref', doc.sourceRef || '—'],
    ['Reason', doc.reason || '—'],
    ['Refund Amount', money(doc.refundAmount ?? 0)],
    ['Return Qty', doc.returnQty ?? '—'],
    ['Inventory Impact', doc.inventoryImpact || '—']
  ],
  linkedDocs: (doc) => {
    const links = [];
    if (doc.sourceRef) links.push({ label: 'Source', value: doc.sourceRef });
    return links;
  },
  headerActions: (doc, { runAction }) => {
    const actions = [];
    const status = String(doc.status || '').toLowerCase();
    if (status === 'draft' || status === 'pending approval') {
      actions.push({ key: 'approve', label: 'Approve', icon: CheckCircle2, style: 'approve', action: () => runAction(() => creditNoteService.postAction(doc.id, 'approve'), `${doc.cnNo} approved`) });
    }
    if (status === 'approved') {
      actions.push({ key: 'issue', label: 'Issue', icon: BadgeCheck, style: 'green', action: () => runAction(() => creditNoteService.postAction(doc.id, 'issue'), `${doc.cnNo} issued`) });
    }
    return actions;
  },
  printHtml: (doc) => buildSalesPrintHtml(doc, 'Credit Note', 'creditNote'),
  exportPdf: (doc) => exportSalesDocumentPdf(doc, 'Credit Note', 'creditNote', `${doc.cnNo || 'credit-note'}-${new Date().toISOString().slice(0, 10)}`)
};

// ===== Shared helper for row actions =====
// Calls the hook's mutation wrapper (which refreshes the list on success) and
// returns a promise the list page resolves into a toast.
function runAction(hook, id, action, message) {
  return hook.postAction(id, action).then((res) =>
    res?.ok
      ? { ok: true, message }
      : { ok: false, error: res?.error || { message: 'Action failed' } }
  );
}

function openPrint(html) {
  const win = window.open('', '_blank', 'width=1000,height=750');
  if (!win) return { ok: false, error: { message: 'Popup blocked. Please allow pop-ups to print.' } };
  win.document.open();
  win.document.write(html);
  win.document.close();
  return { ok: true, message: 'Print preview opened' };
}

