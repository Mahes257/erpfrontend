import { computeTotals, round2 } from '../../utils/salesHelpers';

const INPUT_CLS =
  'w-full bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-600/50 focus:bg-surface transition-all shadow-inner text-right';

function fmt(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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
 * Right-hand totals card. `discountPct` and `charges` are editable when not
 * read-only; all computed figures follow the original ERP math.
 *
 * - Default (ERP quotation): Sub Total, CGST, SGST, Discount %, Charges,
 *   Grand Total = sub − discount + cgst + sgst + charges (+ freight/insurance).
 * - `flatDiscount` (ERP DC): Discount becomes a flat ₹ input.
 * - `percentageDiscount` (ERP proforma-invoice-create.html): Sub Total,
 *   single GST row, Discount (%) input → Discount Amount display = SubTotal ×
 *   pct / 100, Additional Charges, Grand Total = SubTotal + GST − Discount
 *   Amount + Charges, plus amount-in-words.
 */
export default function SalesTotals({
  items = [],
  discountPct = 0,
  charges = 0,
  freight = 0,
  insurance = 0,
  onDiscountChange,
  onChargesChange,
  readOnly = false,
  showRoundOff = false,
  flatDiscount = false,
  percentageDiscount = false,
  showWords = false
}) {
  const t = computeTotals(items, {
    discountPct: flatDiscount || percentageDiscount ? 0 : discountPct,
    charges: Number(charges || 0) + Number(freight || 0) + Number(insurance || 0),
    roundOffEnabled: showRoundOff
  });

  const pct = Number(discountPct || 0);
  // ERP proforma: Discount Amount = SubTotal × Discount% / 100.
  const discAmt = percentageDiscount ? round2(Number(t.subTotal) * (pct / 100)) : 0;
  const flatDiscountValue = flatDiscount ? pct : 0;
  const rawGrand = percentageDiscount
    ? round2(t.subTotal + t.taxTotal + t.charges - discAmt)
    : flatDiscount
      ? round2(t.subTotal + t.taxTotal + t.charges - flatDiscountValue)
      : Number(t.grandTotal) || 0;
  const grandTotal = rawGrand;

  let baseRows;
  if (percentageDiscount) {
    baseRows = [
      ['Sub Total', fmt(t.subTotal)],
      ['GST', fmt(t.taxTotal)],
      ['Discount', `− ${fmt(discAmt)}`],
      ['Discount Amount', fmt(discAmt)],
      ['Charges', fmt(t.charges)]
    ];
  } else {
    baseRows = [
      ['Sub Total', fmt(t.subTotal)],
      ['CGST', fmt(t.cgstTotal)],
      ['SGST', fmt(t.sgstTotal)],
      ['Charges', fmt(t.charges)],
      ...(showRoundOff ? [['Round Off', fmt(t.roundOffAmount)]] : [])
    ];
    if (flatDiscount) {
      baseRows.splice(1, 0, ['Discount', fmt(flatDiscountValue)]);
    } else {
      baseRows.splice(1, 0, ['Discount', `− ${fmt(t.discount)}`]);
    }
  }
  const rows = [...baseRows, ['Grand Total', fmt(grandTotal)]];

  const discountLabel = percentageDiscount ? 'Discount (%)' : flatDiscount ? 'Discount (₹)' : 'Discount %';

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className={`grid ${flatDiscount || percentageDiscount ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              {discountLabel}
            </label>
            <input
              type="number"
              min="0"
              max={percentageDiscount ? 100 : undefined}
              step={percentageDiscount ? '0.1' : '0.01'}
              value={discountPct ?? 0}
              onChange={(e) => onDiscountChange?.(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              {percentageDiscount ? 'Additional Charges (₹)' : 'Charges (₹)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={charges ?? 0}
              onChange={(e) => onChargesChange?.(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className={`flex items-center justify-between px-3 py-2 text-xs ${
              label === 'Grand Total'
                ? 'bg-[#0B4A3D] text-white'
                : 'border-b border-slate-100'
            }`}
          >
            <span className={label === 'Grand Total' ? 'font-bold' : 'text-slate-500 font-medium'}>
              {label}
            </span>
            {label === 'Discount' && flatDiscount ? (
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountPct ?? 0}
                onChange={(e) => onDiscountChange?.(e.target.value)}
                className="w-28 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-xs text-right text-slate-700 outline-none focus:border-emerald-600/50"
              />
            ) : (
              <span className={label === 'Grand Total' ? 'font-extrabold text-sm' : 'font-bold text-slate-800'}>
                {value}
              </span>
            )}
          </div>
        ))}
      </div>

      {(showWords || percentageDiscount) && (
        <div className="text-[11px] text-slate-400 text-center pt-1">{numberToWordsINR(grandTotal)}</div>
      )}
    </div>
  );
}
