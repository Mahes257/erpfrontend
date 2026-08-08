import {
  Banknote,
  Building2,
  ClipboardList,
  FileText,
  Info,
  MapPin,
  PenLine,
  Settings,
  Ship,
  StickyNote,
  Truck,
  Users
} from 'lucide-react';
import {
  BANK_TYPES,
  CITIES,
  CREDIT_NOTE_INVENTORY_IMPACT,
  CREDIT_NOTE_REASONS,
  CREDIT_NOTE_SOURCES,
  CREDIT_NOTE_STATUSES,
  DELIVERY_CHALLAN_STATUSES,
  DELIVERY_TERMS,
  DURATIONS,
  INVOICE_SOURCES,
  INVOICE_STATUSES,
  NUMBER_FORMATS,
  PAYMENT_MODES,
  PAYMENT_RECEIPT_SOURCES,
  PAYMENT_RECEIPT_STATUSES,
  PAYMENT_TERMS,
  PROFORMA_INVOICE_STATUSES,
  PROFORMA_SOURCES,
  QUOTATION_STATUSES,
  SALES_CONTRACT_STATUSES,
  SALES_EXECUTIVES,
  SALES_ORDER_STATUSES,
  SIGNATURE_TYPES,
  STATES,
  TAX_TYPES,
  TRANSPORT_COMPANIES,
  WARRANTY
} from '../constants/salesConstants';

function companyFields() {
  return {
    title: 'Company Details',
    icon: Building2,
    fields: [
      { key: 'companyName', label: 'Company Name', type: 'text', grid: 'sm:col-span-2' },
      { key: 'companyAddress', label: 'Company Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' },
      { key: 'companyGstin', label: 'Company GSTIN', type: 'text' },
      { key: 'companyPan', label: 'Company PAN', type: 'text' },
      { key: 'companyState', label: 'Company State', type: 'select', options: STATES, masterKey: 'states' }
    ]
  };
}

export const SALES_FORM_CONFIGS = {
  quotation: {
    moduleKey: 'quotation',
    title: 'Quotation',
    docNoLabel: 'Quotation No',
    docNoKey: 'quotationNo',
    dateKey: 'quotationDate',
    showItems: true,
    showClient: true,
    showTotals: true,
    canSend: true,
    flatDiscount: true,
    showWords: true,
    statuses: QUOTATION_STATUSES,
    sections: [
      {
        title: 'Quotation Details',
        icon: Info,
        fields: [
          { key: 'quotationNo', label: 'Quotation No', type: 'text', placeholder: 'QTN-YYYY-XXXXXX', required: true },
          { key: 'reference', label: 'Reference', type: 'text', placeholder: 'e.g. RFQ-001' },
          { key: 'quotationDate', label: 'Quotation Date', type: 'date', required: true },
          { key: 'validUntil', label: 'Valid Till Date', type: 'date', required: true },
          { key: 'sourceCw', label: 'Source Cost Workout', type: 'select', dynamicSource: 'costWorkouts', placeholder: '-- None (Create from scratch) --' },
          { key: 'sourceCpr', label: 'Source CPR/PR', type: 'text', placeholder: 'Auto-filled from Cost Workout' },
          { key: 'leadNo', label: 'Lead No', type: 'text', placeholder: 'Lead number' },
          { key: 'salesPerson', label: 'Sales Person', type: 'select', options: SALES_EXECUTIVES, masterKey: 'sales_executives' }
        ]
      },
      {
        title: 'Quotation From',
        icon: Building2,
        fields: [
          { key: 'fromCompany', label: 'Company', type: 'select', options: ['VISHAK TECH'] },
          { key: 'fromName', label: 'Company Name', type: 'text' },
          { key: 'fromAddress', label: 'Address', type: 'text' },
          { key: 'fromGstin', label: 'GSTIN', type: 'text' },
          { key: 'fromPan', label: 'PAN', type: 'text' },
          { key: 'fromEmail', label: 'Email', type: 'email' },
          { key: 'fromPhone', label: 'Phone', type: 'text' }
        ]
      },
      {
        title: 'Quotation For',
        icon: Users,
        clientLookup: true,
        fields: [
          { key: 'clientId', label: 'Client ID', type: 'hidden' },
          { key: 'clientName', label: 'Client Name', type: 'text' },
          { key: 'contactPerson', label: 'Contact Person', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'address', label: 'Address', type: 'text' },
          { key: 'city', label: 'City', type: 'text' },
          { key: 'state', label: 'State', type: 'text' },
          { key: 'pin', label: 'PIN', type: 'text' },
          { key: 'country', label: 'Country', type: 'text' },
          { key: 'gstin', label: 'GSTIN', type: 'text' },
          { key: 'pan', label: 'PAN', type: 'text' }
        ]
      },
      {
        title: 'Billing Address',
        icon: MapPin,
        fields: [
          { key: 'billingAddress', label: 'Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' },
          { key: 'billingCity', label: 'City', type: 'text' },
          { key: 'billingState', label: 'State', type: 'text' },
          { key: 'billingPin', label: 'PIN', type: 'text' }
        ]
      },
      {
        title: 'Shipping Address',
        icon: Truck,
        fields: [
          { key: 'shipSameAsBill', label: 'Same as Billing', type: 'checkbox', grid: 'sm:col-span-2' },
          { key: 'shippingAddress', label: 'Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' },
          { key: 'shippingCity', label: 'City', type: 'text' },
          { key: 'shippingState', label: 'State', type: 'text' },
          { key: 'shippingPin', label: 'PIN', type: 'text' }
        ]
      },
      {
        title: 'Configure GST',
        icon: Settings,
        fields: [
          { key: 'taxType', label: 'Configure GST', type: 'select', options: TAX_TYPES },
          { key: 'currency', label: 'Currency', type: 'currency' },
          { key: 'numberFormat', label: 'Number Format', type: 'select', options: NUMBER_FORMATS.map((f) => f.label) }
        ]
      },
      {
        title: 'Commercial Terms',
        icon: ClipboardList,
        fields: [
          { key: 'paymentTerms', label: 'Payment Terms', type: 'text', placeholder: 'e.g. Net 30' },
          { key: 'deliveryTerms', label: 'Delivery Terms', type: 'text', placeholder: 'e.g. FOB - Bangalore' },
          { key: 'freight', label: 'Freight (₹)', type: 'number', min: 0, step: '0.01' },
          { key: 'insurance', label: 'Insurance (₹)', type: 'number', min: 0, step: '0.01' }
        ]
      },
      {
        title: 'Notes & Additional',
        icon: StickyNote,
        fields: [
          { key: 'remarks', label: 'Notes', type: 'textarea', rows: 2, grid: 'sm:col-span-2', placeholder: 'Customer notes...' },
          { key: 'additionalInfo', label: 'Additional Information', type: 'textarea', rows: 2, grid: 'sm:col-span-2', placeholder: 'Any additional info...' },
          { key: 'contactEmail', label: 'Contact Email', type: 'email' },
          { key: 'contactPhone', label: 'Contact Phone', type: 'text' }
        ]
      },
      {
        title: 'Terms & Conditions',
        icon: FileText,
        fields: [
          { key: 'terms', label: 'Terms & Conditions', type: 'textarea', rows: 3, grid: 'sm:col-span-2', placeholder: 'e.g. Lead Time, Payment Terms, Delivery Terms, Warranty, Validity...' }
        ]
      },
      {
        title: 'Advanced Options',
        icon: Settings,
        fields: [
          { key: 'hsnView', label: 'HSN Column View', type: 'checkbox', grid: 'sm:col-span-1', defaultChecked: true },
          { key: 'displayUnit', label: 'Display Unit As', type: 'checkbox', grid: 'sm:col-span-1', defaultChecked: true },
          { key: 'taxSummary', label: 'Tax Summary Display', type: 'checkbox', grid: 'sm:col-span-1', defaultChecked: true },
          { key: 'hidePlace', label: 'Hide Place/Country of Supply', type: 'checkbox', grid: 'sm:col-span-1' },
          { key: 'hsnSummary', label: 'Show HSN Summary', type: 'checkbox', grid: 'sm:col-span-1' },
          { key: 'originalImages', label: 'Add Original Images', type: 'checkbox', grid: 'sm:col-span-1' },
          { key: 'thumbnails', label: 'Show Thumbnails', type: 'checkbox', grid: 'sm:col-span-1' },
          { key: 'descFull', label: 'Show Description Full Width', type: 'checkbox', grid: 'sm:col-span-1' },
          { key: 'hideSubtotal', label: 'Hide Subtotal For Group Items', type: 'checkbox', grid: 'sm:col-span-1' },
          { key: 'showSku', label: 'Show SKU', type: 'checkbox', grid: 'sm:col-span-1' },
          { key: 'serial', label: 'Show Serial Numbers', type: 'checkbox', grid: 'sm:col-span-1' },
          { key: 'batch', label: 'Display Batch Details', type: 'checkbox', grid: 'sm:col-span-1' },
          { key: 'showTotalPdf', label: 'Show Total In PDF', type: 'checkbox', grid: 'sm:col-span-1', defaultChecked: true }
        ]
      },
      {
        title: 'Signature & Attachments',
        icon: PenLine,
        fields: [
          { key: 'signatureType', label: 'Signature Type', type: 'select', options: SIGNATURE_TYPES },
          { key: 'signatureLabel', label: 'Signature Label', type: 'text', placeholder: 'e.g. Authorised Signatory' },
          { key: 'internalNotes', label: 'Internal Notes', type: 'textarea', rows: 2, grid: 'sm:col-span-2', placeholder: 'Internal notes (not visible to customer)...' }
        ]
      }
    ]
  },

  salesContract: {
    moduleKey: 'salesContract',
    title: 'Sales Contract',
    docNoLabel: 'Contract No',
    docNoKey: 'scNo',
    dateKey: 'contractDate',
    showItems: true,
    showClient: true,
    showTotals: true,
    statuses: SALES_CONTRACT_STATUSES,
    sections: [
      {
        title: 'Contract Details',
        icon: FileText,
        fields: [
          { key: 'scNo', label: 'SC No', type: 'text', placeholder: 'SC-YYYY-XXXXXX' },
          { key: 'poRef', label: 'Customer PO Number (Optional)', type: 'text' },
          { key: 'contractDate', label: 'SC Date', type: 'date' },
          { key: 'leadNo', label: 'Lead No', type: 'text' },
          { key: 'qtnRef', label: 'Quotation Ref', type: 'text' }
        ]
      },
      {
        title: 'Client Information',
        icon: Users,
        clientLookup: true,
        fields: [
          { key: 'clientId', label: 'Client ID', type: 'hidden' },
          { key: 'clientName', label: 'Client Name', type: 'text' },
          { key: 'contactPerson', label: 'Contact Person', type: 'text' },
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'city', label: 'City', type: 'select', options: CITIES, masterKey: 'cities' },
          { key: 'state', label: 'State', type: 'select', options: STATES, masterKey: 'states' },
          { key: 'gstin', label: 'GSTIN', type: 'text' },
          { key: 'pan', label: 'PAN', type: 'text' },
          { key: 'billingAddress', label: 'Billing Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' },
          { key: 'shippingAddress', label: 'Shipping Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' }
        ]
      },
      {
        title: 'Contract Terms',
        icon: Settings,
        fields: [
          { key: 'status', label: 'Status', type: 'select', options: SALES_CONTRACT_STATUSES },
          { key: 'currency', label: 'Currency', type: 'currency' },
          { key: 'paymentTerms', label: 'Payment Terms', type: 'select', options: PAYMENT_TERMS, masterKey: 'payment_terms' },
          { key: 'deliveryTerms', label: 'Delivery Terms', type: 'select', options: DELIVERY_TERMS, masterKey: 'delivery_terms' },
          { key: 'salesExecutive', label: 'Sales Executive', type: 'select', options: SALES_EXECUTIVES, masterKey: 'sales_executives' },
          { key: 'validity', label: 'Contract Validity', type: 'date' },
          { key: 'duration', label: 'Contract Duration', type: 'select', options: DURATIONS, masterKey: 'durations' },
          { key: 'warranty', label: 'Warranty Terms', type: 'select', options: WARRANTY, masterKey: 'warranty_terms' }
        ]
      },
      {
        title: 'Commercial & Scope',
        icon: ClipboardList,
        fields: [
          { key: 'commercialTerms', label: 'Commercial Terms', type: 'textarea', rows: 3, grid: 'sm:col-span-2' },
          { key: 'scope', label: 'Scope of Supply', type: 'textarea', rows: 3, grid: 'sm:col-span-2' },
          { key: 'exclusions', label: 'Exclusions', type: 'textarea', rows: 3, grid: 'sm:col-span-2' },
          { key: 'remarks', label: 'Remarks', type: 'textarea', rows: 3, grid: 'sm:col-span-2' }
        ]
      }
    ]
  },

  salesOrder: {
    moduleKey: 'salesOrder',
    title: 'Sales Order',
    docNoLabel: 'Order No',
    docNoKey: 'soNo',
    dateKey: 'orderDate',
    showItems: true,
    showClient: true,
    showTotals: true,
    statuses: SALES_ORDER_STATUSES,
    sections: [
      {
        title: 'Order Details',
        icon: ClipboardList,
        fields: [
          { key: 'soNo', label: 'Sales Order No', type: 'text', placeholder: 'SO-YYYY-XXXXXX' },
          { key: 'customerPo', label: 'Customer PO', type: 'text' },
          { key: 'orderDate', label: 'Order Date', type: 'date' },
          { key: 'leadNo', label: 'Lead No', type: 'text' },
          { key: 'scRef', label: 'Sales Contract Ref', type: 'text' },
          { key: 'qtnRef', label: 'Quotation Ref', type: 'text' },
          { key: 'status', label: 'Status', type: 'select', options: SALES_ORDER_STATUSES },
          { key: 'currency', label: 'Currency', type: 'currency' },
          { key: 'paymentTerms', label: 'Payment Terms', type: 'select', options: PAYMENT_TERMS, masterKey: 'payment_terms' },
          { key: 'salesExecutive', label: 'Sales Executive', type: 'select', options: SALES_EXECUTIVES, masterKey: 'sales_executives' },
          { key: 'deliveryDate', label: 'Delivery Date', type: 'date' },
          { key: 'deliveryTerms', label: 'Delivery Terms', type: 'select', options: DELIVERY_TERMS, masterKey: 'delivery_terms' }
        ]
      },
      {
        title: 'Client Information',
        icon: Users,
        clientLookup: true,
        fields: [
          { key: 'clientId', label: 'Client ID', type: 'hidden' },
          { key: 'clientName', label: 'Client Name', type: 'text' },
          { key: 'contactPerson', label: 'Contact Person', type: 'text' },
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'gstin', label: 'GSTIN', type: 'text' },
          { key: 'pan', label: 'PAN', type: 'text' },
          { key: 'city', label: 'City', type: 'select', options: CITIES, masterKey: 'cities' },
          { key: 'state', label: 'State', type: 'select', options: STATES, masterKey: 'states' },
          { key: 'billingAddress', label: 'Billing Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' },
          { key: 'shippingAddress', label: 'Shipping Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' }
        ]
      },
      {
        title: 'Notes',
        icon: StickyNote,
        fields: [
          { key: 'terms', label: 'Terms & Conditions', type: 'textarea', rows: 3, grid: 'sm:col-span-2' },
          { key: 'remarks', label: 'Remarks', type: 'textarea', rows: 3, grid: 'sm:col-span-2' }
        ]
      }
    ]
  },

  deliveryChallan: {
    moduleKey: 'deliveryChallan',
    showAttachments: false,
    title: 'Delivery Challan',
    docNoLabel: 'Challan No',
    docNoKey: 'dcNo',
    dateKey: 'dcDate',
    showItems: true,
    showClient: true,
    showTotals: true,
    flatDiscount: true,
    clientCreate: true,
    // ERP DC auto-fills Dispatch Date (today) and Expected Delivery (+5 days).
    defaults: {
      dispatchDate: () => new Date().toISOString().split('T')[0],
      deliveryDate: () => new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
    },
    // ERP delivery-challan-create.html places the Items table in the main
    // column after the Transport & Dispatch card (before Notes & Terms).
    itemsAfterIndex: 2,
    statuses: DELIVERY_CHALLAN_STATUSES,
    sections: [
      {
        title: 'Challan Details',
        icon: Truck,
        fields: [
          { key: 'dcNo', label: 'DC Number', type: 'text', placeholder: 'DC-YYYY-XXXXXX', required: true },
          { key: 'soRef', label: 'Sales Order', type: 'text', placeholder: 'Select SO...' },
          { key: 'dcDate', label: 'Date', type: 'date', required: true },
          { key: 'scRef', label: 'Sales Contract Ref', type: 'text' },
          { key: 'status', label: 'Status', type: 'select', options: DELIVERY_CHALLAN_STATUSES, required: true }
        ]
      },
      {
        title: 'Client Information',
        icon: Users,
        clientLookup: true,
        fields: [
          { key: 'clientId', label: 'Client ID', type: 'hidden' },
          { key: 'clientName', label: 'Customer Name', type: 'text' },
          { key: 'contactPerson', label: 'Contact Person', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'billingAddress', label: 'Billing Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' },
          { key: 'shippingAddress', label: 'Shipping Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' },
          { key: 'city', label: 'City', type: 'select', options: CITIES, masterKey: 'cities' },
          { key: 'state', label: 'State', type: 'select', options: STATES, masterKey: 'states' }
        ]
      },
      {
        title: 'Transport Details',
        icon: Ship,
        fields: [
          { key: 'transportCompany', label: 'Transport Company', type: 'select', options: TRANSPORT_COMPANIES, masterKey: 'transport_companies' },
          { key: 'vehicleNumber', label: 'Vehicle Number', type: 'text' },
          { key: 'driverName', label: 'Driver Name', type: 'text' },
          { key: 'driverPhone', label: 'Driver Phone', type: 'text' },
          { key: 'lrNumber', label: 'LR Number', type: 'text' },
          { key: 'ewayBill', label: 'E-Way Bill No', type: 'text' },
          { key: 'dispatchDate', label: 'Dispatch Date', type: 'date' },
          { key: 'deliveryDate', label: 'Expected Delivery', type: 'date' }
        ]
      },
      {
        title: 'Notes & Terms',
        icon: StickyNote,
        fields: [
          { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, grid: 'sm:col-span-2' },
          { key: 'terms', label: 'Terms & Conditions', type: 'textarea', rows: 3, grid: 'sm:col-span-2' }
        ]
      }
    ]
  },

  proformaInvoice: {
    moduleKey: 'proformaInvoice',
    showAttachments: true,
    title: 'Proforma Invoice',
    docNoLabel: 'Proforma No',
    docNoKey: 'piNo',
    dateKey: 'piDate',
    showItems: true,
    showClient: true,
    showTotals: true,
    canSend: true,
    // ERP proforma-invoice-create.html: percentage discount (Discount % input
    // + Discount Amount display), single GST row in Totals, Status card in the
    // right sidebar, Attachments as the 7th main-column section, footer =
    // Save Draft / Save & New / Submit (create) and Save Changes /
    // Update & Close (edit). No Send button on the create form (ERP has none).
    percentageDiscount: true,
    showSend: false,
    sidebarStatus: true,
    attachmentsInColumn: true,
    submitToView: true,
    itemsVariant: 'proforma',
    footerLabels: {
      draft: 'Save Draft',
      createNew: 'Save & New',
      primaryCreate: 'Submit',
      primaryEdit: 'Update & Close',
      secondaryEdit: 'Save Changes'
    },
    // ERP proforma-invoice-create.html shows no required asterisk on the
    // Customer field, and keeps the Status in a sidebar card (not a form field).
    clientRequired: false,
    clientLookupLabel: 'Customer',
    // ERP customer search placeholder (General Information).
    clientLookupPlaceholder: 'Search customer by Name, Code, GST, Phone, Email...',
    // ERP default: shipping is same as billing ("Shipping address different from
    // billing" toggle unchecked). The checkbox is inverted in the UI, so the
    // form value (shipSameAsBill = same-as-billing) defaults to true.
    defaults: { shipSameAsBill: () => true },
    statuses: PROFORMA_INVOICE_STATUSES,
    // ERP proforma-invoice-create.html places the Item Details table in the
    // main column after the Bank Details card (before Terms & Conditions).
    itemsAfterIndex: 2,
    sections: [
      {
        // ERP SECTION 1: GENERAL INFORMATION — PI Number/Date sit above the
        // Customer lookup inside the same card.
        title: 'General Information',
        icon: Info,
        clientLookup: true,
        fields: [
          // ERP row 1: auto-generated readonly PI Number + Date.
          { key: 'piNo', label: 'PI Number', type: 'text', beforeLookup: true, readOnly: true },
          { key: 'piDate', label: 'Date', type: 'date', beforeLookup: true },
          { key: 'clientId', label: 'Client ID', type: 'hidden' },
          // ERP: Contact Person is an editable input; GSTIN/PAN/Email/Phone are
          // READ-ONLY values auto-filled from the selected customer (displayed
          // as grey chips), all inside the client-details area that ERP shows
          // only once a customer has been selected.
          { key: 'contactPerson', label: 'Contact Person', type: 'text', placeholder: 'Contact person' },
          { key: 'gstin', label: 'GSTIN', type: 'display', visible: (form) => !!form.clientName },
          { key: 'pan', label: 'PAN', type: 'display', visible: (form) => !!form.clientName },
          { key: 'email', label: 'Email', type: 'display', visible: (form) => !!form.clientName },
          { key: 'phone', label: 'Phone', type: 'display', visible: (form) => !!form.clientName },
          { key: 'billingAddress', label: 'Billing Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2', visible: (form) => !!form.clientName },
          // ERP: "Shipping address different from billing" toggle (checked = the
          // shipping address DIFFERS from billing, i.e. shipSameAsBill = false).
          { key: 'shipSameAsBill', label: 'Shipping address different from billing', type: 'checkbox', invert: true, hideLabel: true, grid: 'sm:col-span-2', visible: (form) => !!form.clientName },
          // ERP: the Shipping Address field is hidden until the toggle is on.
          { key: 'shippingAddress', label: 'Shipping Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2', visible: (form) => !!form.clientName && form.shipSameAsBill !== true }
        ]
      },
      {
        title: 'Reference Details',
        icon: ClipboardList,
        fields: [
          { key: 'referenceNo', label: 'Reference No', type: 'text', placeholder: 'PO / Reference No.' },
          { key: 'validTill', label: 'Valid Till', type: 'date' },
          { key: 'source', label: 'Source', type: 'select', options: PROFORMA_SOURCES },
          { key: 'sourceRef', label: 'Source Document', type: 'text' }
        ]
      },
      {
        title: 'Bank Details',
        icon: Banknote,
        fields: [
          { key: 'bankName', label: 'Bank Name', type: 'text' },
          { key: 'bankAccount', label: 'Account Number', type: 'text' },
          { key: 'bankIfsc', label: 'IFSC Code', type: 'text' },
          { key: 'bankBranch', label: 'Branch', type: 'text' },
          { key: 'bankType', label: 'Account Type', type: 'select', options: BANK_TYPES, masterKey: 'bank_types' },
          { key: 'bankUpi', label: 'UPI ID', type: 'text' }
        ]
      },
      {
        title: 'Terms & Conditions',
        icon: FileText,
        fields: [
          { key: 'terms', label: 'Terms & Conditions', type: 'textarea', rows: 3, grid: 'sm:col-span-2' }
        ]
      },
      {
        title: 'Remarks',
        icon: StickyNote,
        fields: [
          { key: 'notes', label: 'Remarks', type: 'textarea', rows: 3, grid: 'sm:col-span-2' }
        ]
      }
    ]
  },

  invoice: {
    moduleKey: 'invoice',
    showAttachments: true,
    title: 'Invoice',
    docNoLabel: 'Invoice No',
    docNoKey: 'invoiceNo',
    dateKey: 'invoiceDate',
    showItems: true,
    showClient: true,
    showTotals: true,
    showRoundOff: true,
    showWords: true,
    canSend: true,
    statuses: INVOICE_STATUSES,
    sections: [
      companyFields(),
      {
        title: 'Invoice Details',
        icon: FileText,
        fields: [
          { key: 'invoiceNo', label: 'Invoice Number', type: 'text', placeholder: 'INV-YYYY-XXXXXX' },
          { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
          { key: 'dueDate', label: 'Due Date', type: 'date' },
          { key: 'referenceNo', label: 'Reference', type: 'text' },
          { key: 'source', label: 'Source', type: 'select', options: INVOICE_SOURCES },
          { key: 'sourceRef', label: 'Source Document', type: 'text' },
          { key: 'status', label: 'Status', type: 'select', options: INVOICE_STATUSES }
        ]
      },
      {
        title: 'Client Information',
        icon: Users,
        clientLookup: true,
        fields: [
          { key: 'clientId', label: 'Client ID', type: 'hidden' },
          { key: 'clientName', label: 'Customer', type: 'text' },
          { key: 'contactPerson', label: 'Contact Person', type: 'text' },
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'gstin', label: 'GSTIN', type: 'text' },
          { key: 'pan', label: 'PAN', type: 'text' },
          { key: 'billingAddress', label: 'Billing Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' },
          { key: 'shipSameAsBill', label: 'Ship same as Billing', type: 'checkbox', grid: 'sm:col-span-2' },
          { key: 'shippingAddress', label: 'Shipping Address', type: 'textarea', rows: 2, grid: 'sm:col-span-2' }
        ]
      },
      {
        title: 'Bank Details',
        icon: Banknote,
        fields: [
          { key: 'bankName', label: 'Bank Name', type: 'text' },
          { key: 'bankAccount', label: 'Account Number', type: 'text' },
          { key: 'bankIfsc', label: 'IFSC Code', type: 'text' },
          { key: 'bankBranch', label: 'Branch', type: 'text' },
          { key: 'bankType', label: 'Account Type', type: 'select', options: BANK_TYPES, masterKey: 'bank_types' },
          { key: 'bankUpi', label: 'UPI ID', type: 'text' }
        ]
      },
      {
        title: 'Notes',
        icon: StickyNote,
        fields: [
          { key: 'terms', label: 'Terms & Conditions', type: 'textarea', rows: 3, grid: 'sm:col-span-2' },
          { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, grid: 'sm:col-span-2' }
        ]
      }
    ]
  },

  paymentReceipt: {
    moduleKey: 'paymentReceipt',
    showAttachments: true,
    title: 'Payment Receipt',
    docNoLabel: 'Receipt No',
    docNoKey: 'receiptNo',
    dateKey: 'paymentDate',
    showItems: false,
    showClient: true,
    showTotals: false,
    statuses: PAYMENT_RECEIPT_STATUSES,
    sections: [
      companyFields(),
      {
        title: 'Receipt Details',
        icon: Banknote,
        fields: [
          { key: 'receiptNo', label: 'Receipt Number', type: 'text', placeholder: 'PR-YYYY-XXXXXX' },
          { key: 'paymentDate', label: 'Payment Date', type: 'date' },
          { key: 'paymentMode', label: 'Payment Mode', type: 'select', options: PAYMENT_MODES, masterKey: 'payment_modes' },
          { key: 'source', label: 'Source', type: 'select', options: PAYMENT_RECEIPT_SOURCES },
          { key: 'invoiceRef', label: 'Invoice', type: 'text' },
          { key: 'status', label: 'Status', type: 'select', options: PAYMENT_RECEIPT_STATUSES }
        ]
      },
      {
        title: 'Client Information',
        icon: Users,
        clientLookup: true,
        fields: [
          { key: 'clientId', label: 'Client ID', type: 'hidden' },
          { key: 'clientName', label: 'Customer', type: 'text' },
          { key: 'contactPerson', label: 'Contact Person', type: 'text' },
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'gstin', label: 'GSTIN', type: 'text' }
        ]
      },
      {
        title: 'Payment Details',
        icon: Banknote,
        fields: [
          { key: 'bankName', label: 'Bank Name', type: 'text' },
          { key: 'branch', label: 'Branch', type: 'text' },
          { key: 'chequeTx', label: 'Cheque No / Transaction ID', type: 'text' },
          { key: 'referenceNo', label: 'Reference No / UTR', type: 'text' },
          { key: 'amount', label: 'Amount Received (₹)', type: 'number', required: true },
          { key: 'remarks', label: 'Remarks / Notes', type: 'textarea', rows: 2, grid: 'sm:col-span-2' }
        ]
      }
    ]
  },

  creditNote: {
    moduleKey: 'creditNote',
    showAttachments: true,
    title: 'Credit Note',
    docNoLabel: 'Credit Note No',
    docNoKey: 'cnNo',
    dateKey: 'cnDate',
    showItems: true,
    showClient: true,
    showTotals: true,
    statuses: CREDIT_NOTE_STATUSES,
    sections: [
      companyFields(),
      {
        title: 'Credit Note Details',
        icon: FileText,
        fields: [
          { key: 'cnNo', label: 'Credit Note Number', type: 'text', placeholder: 'CN-YYYY-XXXXXX' },
          { key: 'cnDate', label: 'Date', type: 'date' },
          { key: 'source', label: 'Source', type: 'select', options: CREDIT_NOTE_SOURCES },
          { key: 'sourceRef', label: 'Source Document', type: 'text' },
          { key: 'status', label: 'Status', type: 'select', options: CREDIT_NOTE_STATUSES },
          { key: 'reason', label: 'Reason for Credit Note', type: 'select', options: CREDIT_NOTE_REASONS, masterKey: 'credit_note_reasons' },
          { key: 'refundAmount', label: 'Refund Amount (₹)', type: 'number' },
          { key: 'returnQty', label: 'Return Quantity', type: 'number' },
          { key: 'inventoryImpact', label: 'Inventory Impact', type: 'select', options: CREDIT_NOTE_INVENTORY_IMPACT },
          { key: 'reasonDetail', label: 'Detailed Reason / Notes', type: 'textarea', rows: 2, grid: 'sm:col-span-2' }
        ]
      },
      {
        title: 'Client Information',
        icon: Users,
        clientLookup: true,
        fields: [
          { key: 'clientId', label: 'Client ID', type: 'hidden' },
          { key: 'clientName', label: 'Customer', type: 'text' },
          { key: 'contactPerson', label: 'Contact Person', type: 'text' },
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'gstin', label: 'GSTIN', type: 'text' }
        ]
      }
    ]
  }
};
