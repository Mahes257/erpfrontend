import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { GST_RATES } from '../../constants/salesConstants';
import { EditableMasterDropdown } from '../Common';
import useClickOutside from '../../hooks/useClickOutside';
import productService from '../../services/productService';
import { lineAmount } from '../../utils/salesHelpers';

const INPUT_CLS =
  'w-full bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-600/50 focus:bg-surface transition-all shadow-inner';

const TH_CLS = 'px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap';

/**
 * Type-or-select product combobox (matches the original ERP item grid):
 * searching the product master auto-fills description, HSN, UOM, rate and GST.
 */
function ProductCombobox({ value, onSelect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, () => setOpen(false), open);

  useEffect(() => {
    let cancelled = false;
    productService
      .list()
      .then((products) => {
        if (cancelled) return;
        setOptions(products || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (p) =>
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.sku || '').toLowerCase().includes(q) ||
        String(p.hsn || '').toLowerCase().includes(q)
    );
  }, [options, query]);

  return (
    <div ref={wrapRef} className="relative min-w-[220px]">
      <div className="relative">
        <input
          type="text"
          value={open ? query : value || ''}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type product or SKU"
          aria-label="Product"
          className={INPUT_CLS}
        />
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 max-h-56 overflow-y-auto bg-surface border border-slate-200 rounded-lg shadow-lg">
          {!loaded && <div className="px-3 py-2 text-xs text-slate-400">Loading products...</div>}
          {loaded && filtered.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">No products found</div>}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setQuery('');
                setOpen(false);
                onSelect(p);
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors cursor-pointer"
            >
              <span className="block text-xs font-semibold text-slate-700">{p.name}</span>
              <span className="block text-[10px] text-slate-400">
                {p.sku || ''} {p.hsn ? `· HSN ${p.hsn}` : ''} · {p.unit || ''} · ₹{Number(p.rate || 0).toLocaleString('en-IN')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ERP proforma item grid (proforma-invoice-create.html PICalc.addRow):
 * columns Item / Description | HSN/SAC | Qty | UOM | Rate | GST % | Amount,
 * toolbar with a single "Add Item" button. Description is a plain text input
 * (no Disc% column, no Product combobox); Amount = qty × rate × (1 + GST%).
 */
function ProformaItemsGrid({ items = [], setItems, readOnly = false }) {
  const addRow = () => {
    setItems([
      ...items,
      {
        productId: null,
        productName: '',
        description: '',
        hsn: '',
        unit: 'pcs',
        qty: 1,
        rate: 0,
        discountPct: 0,
        gstRate: 0,
        amount: 0
      }
    ]);
  };

  const updateRow = (index, patch) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    const row = next[index];
    if (row) row.amount = lineAmount(row).amount;
    setItems(next);
  };

  const removeRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  if (readOnly) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 720 }}>
          <thead>
            <tr className="bg-slate-50">
              <th className={TH_CLS}>#</th>
              <th className={TH_CLS}>Item / Description</th>
              <th className={TH_CLS}>HSN/SAC</th>
              <th className={`${TH_CLS} text-center`}>Qty</th>
              <th className={`${TH_CLS} text-center`}>UOM</th>
              <th className={`${TH_CLS} text-right`}>Rate</th>
              <th className={`${TH_CLS} text-center`}>GST %</th>
              <th className={`${TH_CLS} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const calc = lineAmount(item);
              return (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="px-2 py-2 text-xs text-slate-400">{idx + 1}</td>
                  <td className="px-2 py-2 text-xs font-semibold text-slate-700">{item.description || item.productName || '—'}</td>
                  <td className="px-2 py-2 text-xs">{item.hsn || '—'}</td>
                  <td className="px-2 py-2 text-xs text-center">{calc.qty}</td>
                  <td className="px-2 py-2 text-xs text-center">{item.unit || '—'}</td>
                  <td className="px-2 py-2 text-xs text-right">{Number(calc.rate).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-2 text-xs text-center">{calc.gstRate}%</td>
                  <td className="px-2 py-2 text-xs font-semibold text-right">
                    ₹{calc.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-center text-xs text-slate-400">
                  No items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-xs font-bold text-[#0B4A3D] bg-[#E8F0EE] hover:bg-[#D7E7E3] px-3 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 780 }}>
          <colgroup>
            <col style={{ width: 40 }} />
            <col />
            <col style={{ width: 85 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 44 }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-50">
              <th className={TH_CLS}>#</th>
              <th className={TH_CLS}>Item / Description</th>
              <th className={TH_CLS}>HSN/SAC</th>
              <th className={`${TH_CLS} text-center`}>Qty</th>
              <th className={`${TH_CLS} text-center`}>UOM</th>
              <th className={`${TH_CLS} text-right`}>Rate</th>
              <th className={`${TH_CLS} text-center`}>GST %</th>
              <th className={`${TH_CLS} text-right`}>Amount</th>
              <th className={TH_CLS} />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const calc = lineAmount(item);
              return (
                <tr key={idx} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-1.5 text-xs text-slate-400 pt-3">{idx + 1}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) => updateRow(idx, { description: e.target.value })}
                      placeholder="Product name"
                      className={`${INPUT_CLS} font-semibold`}
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
                      type="number"
                      min="0"
                      value={item.qty ?? 1}
                      onChange={(e) => updateRow(idx, { qty: e.target.value })}
                      className={`${INPUT_CLS} text-right`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={item.unit || ''}
                      onChange={(e) => updateRow(idx, { unit: e.target.value })}
                      placeholder="pcs"
                      className={INPUT_CLS}
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
                      step="0.1"
                      value={item.gstRate ?? 0}
                      onChange={(e) => updateRow(idx, { gstRate: e.target.value })}
                      className={`${INPUT_CLS} text-right`}
                    />
                  </td>
                  <td className="px-2 py-1.5 pt-3 text-xs font-bold text-slate-800 text-right whitespace-nowrap">
                    ₹{calc.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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
                <td colSpan={9} className="px-2 py-6 text-center text-xs text-slate-400">
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

export default function SalesItemGrid({ items = [], setItems, readOnly = false, proforma = false }) {
  if (proforma) {
    return <ProformaItemsGrid items={items} setItems={setItems} readOnly={readOnly} />;
  }

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

  const updateRow = (index, patch) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    // recompute amount for the changed row
    const row = next[index];
    if (row) {
      row.amount = lineAmount(row).amount;
    }
    setItems(next);
  };

  const removeRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleProductSelect = (index, product) => {
    updateRow(index, {
      productId: product.id,
      productName: product.name,
      description: product.description || product.name,
      hsn: product.hsn || '',
      unit: product.unit || '',
      rate: Number(product.rate) || 0,
      gstRate: Number(product.gstRate) || 0
    });
  };

  if (readOnly) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 720 }}>
          <thead>
            <tr className="bg-slate-50">
              <th className={TH_CLS}>#</th>
              <th className={TH_CLS}>Product</th>
              <th className={TH_CLS}>Description</th>
              <th className={TH_CLS}>HSN</th>
              <th className={TH_CLS}>Unit</th>
              <th className={`${TH_CLS} text-right`}>Qty</th>
              <th className={`${TH_CLS} text-right`}>Rate</th>
              <th className={`${TH_CLS} text-right`}>Disc %</th>
              <th className={`${TH_CLS} text-right`}>GST %</th>
              <th className={`${TH_CLS} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const calc = lineAmount(item);
              return (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="px-2 py-2 text-xs text-slate-400">{idx + 1}</td>
                  <td className="px-2 py-2 text-xs font-semibold text-slate-700">{item.productName || '—'}</td>
                  <td className="px-2 py-2 text-xs">{item.description || '—'}</td>
                  <td className="px-2 py-2 text-xs">{item.hsn || '—'}</td>
                  <td className="px-2 py-2 text-xs">{item.unit || '—'}</td>
                  <td className="px-2 py-2 text-xs text-right">{calc.qty}</td>
                  <td className="px-2 py-2 text-xs text-right">{Number(calc.rate).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-2 text-xs text-right">{calc.discountPct}%</td>
                  <td className="px-2 py-2 text-xs text-right">{calc.gstRate}%</td>
                  <td className="px-2 py-2 text-xs font-semibold text-right">
                    ₹{calc.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-2 py-6 text-center text-xs text-slate-400">
                  No items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 900 }}>
          <thead>
            <tr className="bg-slate-50">
              <th className={TH_CLS}>#</th>
              <th className={TH_CLS}>Product *</th>
              <th className={TH_CLS}>Description</th>
              <th className={TH_CLS}>HSN</th>
              <th className={TH_CLS}>Unit</th>
              <th className={`${TH_CLS} text-right`}>Qty</th>
              <th className={`${TH_CLS} text-right`}>Rate</th>
              <th className={`${TH_CLS} text-right`}>Disc %</th>
              <th className={`${TH_CLS} text-right`}>GST %</th>
              <th className={`${TH_CLS} text-right`}>Amount</th>
              <th className={TH_CLS} />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const calc = lineAmount(item);
              return (
                <tr key={idx} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-1.5 text-xs text-slate-400 pt-3">{idx + 1}</td>
                  <td className="px-2 py-1.5">
                    <ProductCombobox value={item.productName} onSelect={(p) => handleProductSelect(idx, p)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) => updateRow(idx, { description: e.target.value })}
                      placeholder="Description"
                      className={INPUT_CLS}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={item.hsn || ''}
                      onChange={(e) => updateRow(idx, { hsn: e.target.value })}
                      placeholder="HSN"
                      className={`${INPUT_CLS} w-20`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <EditableMasterDropdown
                      masterKey="units"
                      value={item.unit || ''}
                      onChange={(v) => updateRow(idx, { unit: v })}
                      placeholder="Unit"
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
                      className={`${INPUT_CLS} w-20 text-right`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate ?? 0}
                      onChange={(e) => updateRow(idx, { rate: e.target.value })}
                      className={`${INPUT_CLS} w-24 text-right`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      value={item.discountPct ?? 0}
                      onChange={(e) => updateRow(idx, { discountPct: e.target.value })}
                      className={`${INPUT_CLS} w-16 text-right`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={item.gstRate ?? 0}
                      onChange={(e) => updateRow(idx, { gstRate: Number(e.target.value) })}
                      className={`${INPUT_CLS} w-20 cursor-pointer text-right`}
                    >
                      {GST_RATES.map((r) => (
                        <option key={r} value={r}>{r}%</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 pt-3 text-xs font-bold text-slate-800 text-right whitespace-nowrap">
                    ₹{calc.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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
      <button
        type="button"
        onClick={addRow}
        className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#0B4A3D] bg-[#E8F0EE] hover:bg-[#D7E7E3] px-3 py-2 rounded-lg transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> Add Item
      </button>
    </div>
  );
}
