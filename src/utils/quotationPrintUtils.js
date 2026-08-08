/**
 * Quotation Preview / Print / PDF helpers.
 *
 * Pure formatting + WYSIWYG capture utilities used by the Quotation Preview
 * page. They never change business calculations — they only format the stored
 * values for display and export the exact on-screen A4 document.
 */

// ===== Currency metadata =====

export const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: 'CN¥',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  HKD: 'HK$',
  NZD: 'NZ$',
  AED: 'AED',
  SAR: 'SAR',
  QAR: 'QAR',
  KWD: 'KWD',
  BHD: 'BHD',
  OMR: 'OMR',
  LKR: 'LKR',
  NPR: 'NPR',
  PKR: 'PKR',
  BDT: '৳',
  PHP: '₱',
  IDR: 'Rp',
  KRW: '₩',
  THB: '฿',
  MYR: 'RM',
  TRY: '₺',
  RUB: '₽',
  ZAR: 'R',
  BRL: 'R$',
  MXN: 'Mex$',
  CHF: 'CHF',
  SEK: 'SEK',
  NOK: 'NOK',
  DKK: 'DKK',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  ILS: '₪',
  VND: '₫',
  EGP: 'EGP',
  NGN: '₦',
  KES: 'KES',
  ZMW: 'ZMW',
  MAD: 'MAD'
};

// Currency names used in "Amount In Words" (plural form follows the amount).
export const CURRENCY_WORDS = {
  INR: { name: 'Indian Rupee', plural: 'Indian Rupees', paise: 'Paise' },
  USD: { name: 'United States Dollar', plural: 'United States Dollars', paise: 'Cents' },
  EUR: { name: 'Euro', plural: 'Euros', paise: 'Cents' },
  GBP: { name: 'Pound Sterling', plural: 'Pounds Sterling', paise: 'Pence' },
  AED: { name: 'UAE Dirham', plural: 'UAE Dirhams', paise: 'Fils' },
  SGD: { name: 'Singapore Dollar', plural: 'Singapore Dollars', paise: 'Cents' },
  AUD: { name: 'Australian Dollar', plural: 'Australian Dollars', paise: 'Cents' },
  CAD: { name: 'Canadian Dollar', plural: 'Canadian Dollars', paise: 'Cents' },
  JPY: { name: 'Japanese Yen', plural: 'Japanese Yen', paise: 'Sen' },
  CNY: { name: 'Chinese Yuan', plural: 'Chinese Yuan', paise: 'Fen' },
  HKD: { name: 'Hong Kong Dollar', plural: 'Hong Kong Dollars', paise: 'Cents' },
  NZD: { name: 'New Zealand Dollar', plural: 'New Zealand Dollars', paise: 'Cents' },
  SAR: { name: 'Saudi Riyal', plural: 'Saudi Riyals', paise: 'Halala' },
  QAR: { name: 'Qatari Riyal', plural: 'Qatari Riyals', paise: 'Dirham' },
  KWD: { name: 'Kuwaiti Dinar', plural: 'Kuwaiti Dinars', paise: 'Fils' },
  BHD: { name: 'Bahraini Dinar', plural: 'Bahraini Dinars', paise: 'Fils' },
  OMR: { name: 'Omani Rial', plural: 'Omani Rials', paise: 'Baisa' },
  LKR: { name: 'Sri Lankan Rupee', plural: 'Sri Lankan Rupees', paise: 'Cents' },
  NPR: { name: 'Nepalese Rupee', plural: 'Nepalese Rupees', paise: 'Paisa' },
  PKR: { name: 'Pakistani Rupee', plural: 'Pakistani Rupees', paise: 'Paisa' },
  BDT: { name: 'Bangladeshi Taka', plural: 'Bangladeshi Taka', paise: 'Paisa' },
  PHP: { name: 'Philippine Peso', plural: 'Philippine Pesos', paise: 'Centavos' },
  IDR: { name: 'Indonesian Rupiah', plural: 'Indonesian Rupiah', paise: 'Sen' },
  KRW: { name: 'South Korean Won', plural: 'South Korean Won', paise: 'Jeon' },
  THB: { name: 'Thai Baht', plural: 'Thai Baht', paise: 'Satang' },
  MYR: { name: 'Malaysian Ringgit', plural: 'Malaysian Ringgit', paise: 'Sen' },
  TRY: { name: 'Turkish Lira', plural: 'Turkish Lira', paise: 'Kurus' },
  RUB: { name: 'Russian Ruble', plural: 'Russian Rubles', paise: 'Kopeck' },
  ZAR: { name: 'South African Rand', plural: 'South African Rand', paise: 'Cents' },
  BRL: { name: 'Brazilian Real', plural: 'Brazilian Reais', paise: 'Centavos' },
  MXN: { name: 'Mexican Peso', plural: 'Mexican Pesos', paise: 'Centavos' }
};

export function currencySymbol(code) {
  if (!code) return '₹';
  return CURRENCY_SYMBOLS[code] || `${code} `;
}

// ===== Number formatting =====

function localeFor(numberFormat) {
  return String(numberFormat || 'Indian').toLowerCase() === 'standard' ? 'en-US' : 'en-IN';
}

/**
 * Format a monetary value with the selected currency symbol and number format.
 * e.g. formatAmount(123456.78, 'INR', 'Indian') => "₹1,23,456.78"
 */
export function formatAmount(value, { currency = 'INR', numberFormat = 'Indian', decimals = 2 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${currencySymbol(currency)}0.00`;
  const num = n.toLocaleString(localeFor(numberFormat), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  const sym = currencySymbol(currency);
  const spacer = /[A-Za-z]/.test(sym) ? ' ' : '';
  return `${sym}${spacer}${num}`;
}

/**
 * Format a plain number (quantity, GST %, rate etc.) with the selected number
 * format. No currency symbol.
 */
export function formatNumber(value, numberFormat = 'Indian', decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(localeFor(numberFormat), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// ===== Amount in words =====

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function two(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
}

function three(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return (h ? `${ONES[h]} Hundred${r ? ' ' : ''}` : '') + (r ? two(r) : '');
}

function wordsIndian(n) {
  if (n === 0) return 'Zero';
  if (n < 1000) return three(n);
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  let s = '';
  if (crore) s += `${wordsIndian(crore)} Crore`;
  if (lakh) s += `${s ? ' ' : ''}${wordsIndian(lakh)} Lakh`;
  if (thousand) s += `${s ? ' ' : ''}${three(thousand)} Thousand`;
  if (rest) s += `${s ? ' ' : ''}${three(rest)}`;
  return s;
}

function wordsStandard(n) {
  if (n === 0) return 'Zero';
  if (n < 1000) return three(n);
  const units = [
    ['Trillion', 1000000000000],
    ['Billion', 1000000000],
    ['Million', 1000000],
    ['Thousand', 1000]
  ];
  let s = '';
  let rest = n;
  for (const [name, value] of units) {
    if (rest >= value) {
      const q = Math.floor(rest / value);
      rest %= value;
      s += `${s ? ' ' : ''}${wordsStandard(q)} ${name}`;
    }
  }
  if (rest) s += `${s ? ' ' : ''}${three(rest)}`;
  return s;
}

/**
 * Convert an amount to words in the selected currency and number system.
 * e.g. formatAmountInWords(1250, 'INR', 'Indian') =>
 *      "One Thousand Two Hundred Fifty Indian Rupees Only"
 */
export function formatAmountInWords(amount, currency = 'INR', numberFormat = 'Indian') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  const sign = n < 0 ? 'Minus ' : '';
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const paise = Math.round((abs - whole) * 100);
  const toWords = String(numberFormat || 'Indian').toLowerCase() === 'standard' ? wordsStandard : wordsIndian;
  const meta = CURRENCY_WORDS[currency] || {};
  const curWord = meta.plural || `${currency} Dollars`;
  const paiseWord = meta.paise || 'Cents';

  let text = `${sign}${toWords(whole)} ${curWord}`;
  if (paise > 0) text += ` And ${toWords(paise)} ${paiseWord}`;
  return `${text} Only`;
}

// ===== WYSIWYG PDF capture =====
//
// Captures the exact on-screen A4 sheet element and slices it into A4 pages so
// the PDF matches the preview (and therefore the print layout). The sheet is
// cloned into an off-screen fixed-size A4 holder so the capture is always a
// true 210x297mm layout — identical to the print output even when the on-screen
// container is narrower than A4.

export async function captureSheetToPdf(element, { filename = 'quotation' } = {}) {
  if (!element) throw new Error('Preview not ready');
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf')
  ]);

  // Build an off-screen holder pinned at exactly A4 (210mm) width. The print
  // stylesheet uses the same dimensions, so PDF === print === on-screen preview.
  const holder = document.createElement('div');
  holder.style.cssText = [
    'position: fixed',
    'left: -100000px',
    'top: 0',
    'width: 210mm',
    'height: auto',
    'background: #fff',
    'z-index: -1'
  ].join(';');

  const clone = element.cloneNode(true);
  clone.style.width = '210mm';
  clone.style.maxWidth = '210mm';
  clone.style.minHeight = '297mm';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  clone.style.border = 'none';
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    await Promise.all(
      Array.from(clone.querySelectorAll('img')).map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve();
            img.onload = resolve;
            img.onerror = resolve;
          })
      )
    );

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const data = canvas.toDataURL('image/jpeg', 0.95);

    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(data, 'JPEG', 0, position, imgW, imgH, undefined, 'FAST');
    heightLeft -= pageH;
    while (heightLeft > 0.5) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(data, 'JPEG', 0, position, imgW, imgH, undefined, 'FAST');
      heightLeft -= pageH;
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(holder);
  }
}
