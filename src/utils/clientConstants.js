export const CLIENT_COLUMNS = [
  { key: 'clientCode', label: 'Client Code', width: 150, sortable: true, visible: true, align: 'left' },
  { key: 'name', label: 'Business Name', width: 220, sortable: true, visible: true, sticky: 'left', align: 'left' },
  { key: 'contactPerson', label: 'Contact Person', width: 170, sortable: true, visible: true, align: 'left' },
  { key: 'phone', label: 'Phone', width: 160, sortable: true, visible: true, align: 'left' },
  { key: 'email', label: 'Email', width: 240, sortable: true, visible: true, align: 'left' },
  { key: 'industry', label: 'Industry', width: 170, sortable: true, visible: true, align: 'left' },
  { key: 'lastFollowUp', label: 'Last Follow-up', width: 160, sortable: false, visible: true, align: 'left' },
  { key: 'nextFollowUp', label: 'Next Follow-up', width: 160, sortable: false, visible: true, align: 'left' },
  { key: 'status', label: 'Status', width: 110, sortable: true, visible: true, align: 'center' },
  { key: 'actions', label: 'Actions', width: 80, sortable: false, visible: true, sticky: 'right', align: 'center' }
];

export const DEFAULT_VISIBLE_CLIENT_COLUMNS = CLIENT_COLUMNS.filter((c) => c.visible).map((c) => c.key);

export const CLIENT_STATUSES = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Archived', label: 'Archived' },
  { value: 'Deleted', label: 'Deleted' }
];

export const CLIENT_STATUS_BADGES = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-amber-100 text-amber-700',
  Archived: 'bg-sky-100 text-sky-700',
  Deleted: 'bg-rose-100 text-rose-700'
};

export const CLIENT_ORIGINS = [
  'Referral',
  'Direct',
  'Website',
  'Trade Show',
  'LinkedIn',
  'Email Campaign',
  'Advertisement',
  'Existing Customer'
];

export const INDUSTRIES = [
  'Manufacturing',
  'Cement Industry',
  'Thermal Power Plant',
  'Nuclear Power Plant',
  'Steel Industry',
  'Chemical Industry',
  'Pharmaceutical',
  'Automobile',
  'Information Technology',
  'Telecommunications',
  'Banking & Finance',
  'Healthcare',
  'Education',
  'Construction',
  'Real Estate',
  'Retail',
  'Logistics',
  'Oil & Gas',
  'Energy',
  'Mining',
  'Agriculture',
  'Food & Beverage',
  'Textile',
  'Electronics',
  'Media & Entertainment',
  'Hospitality',
  'Transportation',
  'Government',
  'Others'
];

export const CLIENT_TYPES = [
  'Individual',
  'Sole Proprietorship',
  'Partnership',
  'Private Limited',
  'Public Limited',
  'LLP',
  'Government',
  'Trust / NGO',
  'Others'
];

export const TAX_TREATMENTS = [
  'Regular',
  'Composite',
  'SEZ',
  'Export',
  'NIL Rated',
  'Exempt',
  'Non-GST',
  'Others'
];

export const AVATAR_COLORS = [
  'bg-amber-100 text-amber-800',
  'bg-sky-100 text-sky-800',
  'bg-rose-100 text-rose-800',
  'bg-emerald-100 text-emerald-800',
  'bg-indigo-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
  'bg-blue-100 text-blue-800',
  'bg-pink-100 text-pink-800'
];

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const CLIENT_STORAGE_KEYS = {
  columns: 'vishak:clients:columns',
  pageSize: 'vishak:clients:pageSize'
};

export const CLIENT_CATEGORIES = [
  'A-Class',
  'B-Class',
  'C-Class',
  'VIP',
  'Key Account',
  'Standard',
  'Prospect',
  'Others'
];

export const PAYMENT_TERMS = [
  'Advance',
  'On Delivery',
  '15 Days',
  '30 Days',
  '45 Days',
  '60 Days',
  '90 Days',
  'Letter of Credit'
];

export const CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SGD',
  'AUD',
  'CAD',
  'JPY',
  'CNY',
  'SAR',
  'QAR'
];

export const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'United Arab Emirates',
  'Singapore',
  'Australia',
  'Canada',
  'Germany',
  'France',
  'Japan',
  'China',
  'Saudi Arabia',
  'Qatar',
  'Oman',
  'Malaysia',
  'Netherlands',
  'Italy',
  'Spain',
  'South Africa',
  'Brazil',
  'Others'
];
