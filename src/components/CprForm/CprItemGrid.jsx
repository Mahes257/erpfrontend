import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Boxes, ChevronDown, ChevronUp, Copy, GripVertical, Plus, Trash2, AlertTriangle
} from 'lucide-react';
import { ConfirmDialog, EditableMasterDropdown, useToast } from '../Common';

// UOM values are loaded from the backend `master_values` table (master key
// 'pr_units') via EditableMasterDropdown — searchable, addable, editable,
// deletable, and persisted in MySQL. No hardcoded list.

const CELL_INPUT =
  'w-full h-[30px] rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-600/50 focus:bg-surface transition-all';
const CELL_INPUT_ERROR =
  'w-full h-[30px] rounded-md border border-rose-400 bg-rose-50/40 px-2 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-rose-500 transition-all';

const ACTION_BTN =
  'inline-flex items-center justify-center w-[22px] h-[22px] rounded text-slate-400 hover:text-[#0B4A3D] hover:bg-[#0B4A3D]/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';
const ACTION_DEL = 'inline-flex items-center justify-center w-[22px] h-[22px] rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer';

function newItem() {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    drawingNo: '',
    description: '',
    specification: '',
    qty: 1,
    unit: '',
    estimatedCost: 0,
    remarks: ''
  };
}

function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mirrors the ERP's findDuplicateDescriptions(): returns indices of rows whose
// (case-insensitive, trimmed) description appears more than once.
function findDuplicateIndices(items) {
  const seen = {};
  const duplicates = [];
  for (let i = 0; i < items.length; i++) {
    const desc = (items[i].description || '').trim().toLowerCase();
    if (!desc) continue;
    if (seen[desc] !== undefined) {
      if (duplicates.indexOf(seen[desc]) === -1) duplicates.push(seen[desc]);
      if (duplicates.indexOf(i) === -1) duplicates.push(i);
    } else {
      seen[desc] = i;
    }
  }
  return duplicates;
}

const CprItemGrid = forwardRef(function CprItemGrid({ items, setItems }, ref) {
  const toast = useToast();
  const dragIndexRef = useRef(null);
  const tableRef = useRef(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // rowErrors[i] = set of fields flagged invalid by validate(): 'description' | 'qty' | 'unit' | 'cost' | 'duplicate'
  const [rowErrors, setRowErrors] = useState({});

  const addItem = () => setItems((prev) => [...prev, newItem()]);

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const deleteItem = (index) => {
    // Mirrors the ERP: the grid must keep at least one item.
    if (items.length <= 1) {
      toast.warning('Keep at least one item');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const moveItem = (index, dir) => {
    setItems((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const duplicateItem = (index) => {
    setItems((prev) => {
      const copy = { ...prev[index], id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}` };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const clearAll = () => {
    setItems([]);
    setRowErrors({});
    setConfirmClear(false);
  };

  const onDragStart = (index) => (e) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (index) => (e) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from == null || from === index) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndexRef.current = null;
  };

  /* ---- Keyboard navigation (mirrors ERP _initKeyboardNav / _focusNextCell) ---- */
  const editableFieldsOf = (rowEl) => Array.from(rowEl.querySelectorAll('input, select'));
  const rowsOf = () => Array.from(tableRef.current?.querySelectorAll('tbody tr') || []);

  const focusField = (el) => {
    if (el) {
      el.focus();
      if (el.tagName === 'INPUT') el.select();
    }
  };

  const onGridKeyDown = (e) => {
    const target = e.target;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'SELECT')) return;
    const row = target.closest('tr');
    if (!row) return;
    const rows = rowsOf();
    const rowIdx = rows.indexOf(row);
    const fields = editableFieldsOf(row);
    const fieldIdx = fields.indexOf(target);

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const targetRow = rows[rowIdx + dir];
      if (!targetRow) return;
      const targetFields = editableFieldsOf(targetRow);
      focusField(targetFields[Math.min(fieldIdx, targetFields.length - 1)]);
      return;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey) {
        if (fieldIdx < fields.length - 1) {
          focusField(fields[fieldIdx + 1]);
          return;
        }
        const nextRow = rows[rowIdx + 1];
        if (nextRow) {
          focusField(editableFieldsOf(nextRow)[0]);
        } else {
          // Last cell of last row: auto-add a new row when the current row is valid.
          const item = items[rowIdx];
          if (item && (item.description || '').trim() && parseFloat(item.qty) > 0) {
            addItem();
            requestAnimationFrame(() => {
              const newRows = rowsOf();
              const nr = newRows[newRows.length - 1];
              focusField(editableFieldsOf(nr)[0]);
            });
          }
        }
      } else {
        if (fieldIdx > 0) {
          focusField(fields[fieldIdx - 1]);
          return;
        }
        const prevRow = rows[rowIdx - 1];
        if (prevRow) {
          const prevFields = editableFieldsOf(prevRow);
          focusField(prevFields[prevFields.length - 1]);
        }
      }
    }
  };

  /* ---- Drawing No sanitization (mirrors ERP onDrawingNoChange) ---- */
  const onDrawingNoChange = (index, value) => {
    const sanitized = value.replace(/[^A-Za-z0-9 _/.-]+/g, '');
    updateItem(index, { drawingNo: sanitized });
  };

  /* ---- Imperative validate() (mirrors ERP validate + _highlightErrors) ---- */
  useImperativeHandle(ref, () => ({
    validate() {
      const messages = [];
      let valid = true;
      if (items.length === 0) {
        return { valid: false, messages: ['Please add at least one item'] };
      }
      const nextErrors = {};
      let hasEmptyDesc = false;
      let hasInvalidQty = false;
      let hasEmptyUom = false;

      items.forEach((item, i) => {
        const errSet = new Set();
        const desc = (item.description || '').trim();
        const qty = parseFloat(item.qty) || 0;
        const cost = parseFloat(item.estimatedCost) || 0;

        if (!desc) {
          errSet.add('description');
          hasEmptyDesc = true;
          valid = false;
        }
        if (!item.qty || isNaN(parseFloat(item.qty)) || qty <= 0) {
          errSet.add('qty');
          hasInvalidQty = true;
          valid = false;
        }
        if (!item.unit) {
          errSet.add('unit');
          hasEmptyUom = true;
          valid = false;
        }
        if (cost < 0) {
          errSet.add('cost');
          valid = false;
        }
        if (errSet.size) nextErrors[i] = Array.from(errSet);
      });

      const dups = findDuplicateIndices(items);
      if (dups.length) {
        valid = false;
        dups.forEach((i) => {
          nextErrors[i] = nextErrors[i] || [];
          if (!nextErrors[i].includes('duplicate')) nextErrors[i].push('duplicate');
        });
        messages.push('Duplicate descriptions found');
      }
      if (hasEmptyDesc) messages.push('Fill in item descriptions');
      if (hasInvalidQty) messages.push('Enter valid quantities');
      if (hasEmptyUom) messages.push('Select UOM for all items');

      setRowErrors(nextErrors);
      if (messages.length) toast.warning(messages.join('; '));
      return { valid, messages };
    },
    clearErrors() {
      setRowErrors({});
    }
  }));

  const duplicateIdx = useMemo(() => new Set(findDuplicateIndices(items)), [items]);

  const grandTotal = items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.estimatedCost) || 0), 0);
  const hasItems = items.length > 0;

  const cellCls = (index, field) =>
    rowErrors[index]?.includes(field) || (field === 'description' && duplicateIdx.has(index)) ? CELL_INPUT_ERROR : CELL_INPUT;

  return (
    <div className="item-table-section overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-surface flex-wrap">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Boxes className="w-4 h-4 text-[#0B4A3D]" /> Items
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold bg-[#0B4A3D] text-white shadow-sm hover:bg-[#136754] transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
          {hasItems && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-bold border-[1.5px] border-rose-600 bg-surface text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto" ref={tableRef} onKeyDown={onGridKeyDown}>
        <table className="w-full min-w-[1150px] table-fixed border-collapse">
          <colgroup>
            <col style={{ width: 34 }} />
            <col style={{ width: 42 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 260 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 85 }} />
            <col style={{ width: 105 }} />
            <col style={{ width: 115 }} />
            <col style={{ width: 170 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 150 }} />
          </colgroup>
          <thead>
            <tr className="bg-[#0B4A3D] text-white">
              <th className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider"><GripVertical className="w-3 h-3 inline opacity-60" /></th>
              <th className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider">#</th>
              <th className="py-2.5 text-left px-2 text-[11px] font-semibold uppercase tracking-wider">Drawing No.</th>
              <th className="py-2.5 text-left px-2 text-[11px] font-semibold uppercase tracking-wider">Item Description <span className="text-rose-400">*</span></th>
              <th className="py-2.5 text-left px-2 text-[11px] font-semibold uppercase tracking-wider">Specification</th>
              <th className="py-2.5 text-left px-2 text-[11px] font-semibold uppercase tracking-wider">Qty <span className="text-rose-400">*</span></th>
              <th className="py-2.5 text-left px-2 text-[11px] font-semibold uppercase tracking-wider">UOM</th>
              <th className="py-2.5 text-left px-2 text-[11px] font-semibold uppercase tracking-wider">Est. Cost</th>
              <th className="py-2.5 text-left px-2 text-[11px] font-semibold uppercase tracking-wider">Remarks</th>
              <th className="py-2.5 text-right px-2 text-[11px] font-semibold uppercase tracking-wider">Total</th>
              <th className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!hasItems ? (
              <tr>
                <td colSpan={11} className="py-16">
                  <div className="text-center max-w-[360px] mx-auto px-4">
                    <div className="w-[52px] h-[52px] rounded-[14px] bg-[#E8F0EE] flex items-center justify-center mx-auto mb-3">
                      <Boxes className="w-5 h-5 text-[#0B4A3D]" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-1">No items added yet</h4>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-[280px] mx-auto">
                      Add products, materials or services required for this Purchase Request.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const rowTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.estimatedCost) || 0);
                const hasValue = (parseFloat(item.qty) || 0) > 0 || (parseFloat(item.estimatedCost) || 0) > 0;
                const isDuplicate = duplicateIdx.has(index);
                return (
                  <tr
                    key={item.id}
                    draggable
                    onDragStart={onDragStart(index)}
                    onDragOver={onDragOver}
                    onDrop={onDrop(index)}
                    className={`border-b border-slate-100 hover:bg-slate-50 even:bg-slate-50/50 transition-colors ${
                      isDuplicate ? 'bg-amber-50/60' : ''
                    }`}
                  >
                    <td className="py-1 px-1 text-center cursor-grab text-slate-300">
                      <GripVertical className="w-3.5 h-3.5 inline" />
                    </td>
                    <td className="py-1 px-1 text-center text-xs font-semibold text-slate-400">{index + 1}</td>
                    <td className="py-1 px-1">
                      <input
                        className={cellCls(index, 'drawingNo')}
                        value={item.drawingNo}
                        maxLength={100}
                        placeholder="DWG-001"
                        onChange={(e) => onDrawingNoChange(index, e.target.value)}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        className={`${cellCls(index, 'description')} font-medium`}
                        value={item.description}
                        placeholder="Enter item description"
                        onChange={(e) => updateItem(index, { description: e.target.value })}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        className={cellCls(index, 'specification')}
                        value={item.specification}
                        placeholder="Spec / grade"
                        onChange={(e) => updateItem(index, { specification: e.target.value })}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        className={`${cellCls(index, 'qty')} text-right`}
                        value={item.qty}
                        min="0"
                        step="1"
                        onChange={(e) => updateItem(index, { qty: e.target.value })}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <EditableMasterDropdown
                        masterKey="pr_units"
                        value={item.unit}
                        onChange={(v) => updateItem(index, { unit: v })}
                        placeholder="Select UOM..."
                        portal
                        inputClassName={`${cellCls(index, 'unit')} cursor-text`}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        className={`${cellCls(index, 'cost')} text-right`}
                        value={item.estimatedCost}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        onChange={(e) => updateItem(index, { estimatedCost: e.target.value })}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        className={cellCls(index, 'remarks')}
                        value={item.remarks}
                        placeholder="Remarks"
                        onChange={(e) => updateItem(index, { remarks: e.target.value })}
                      />
                    </td>
                    <td className="py-1 px-2 text-right text-xs font-semibold text-[#0B4A3D] whitespace-nowrap">
                      {hasValue ? formatCurrency(rowTotal) : '—'}
                    </td>
                    <td className="py-1 px-2 text-center whitespace-nowrap">
                      <button
                        type="button"
                        className={ACTION_BTN}
                        onClick={() => moveItem(index, -1)}
                        disabled={index === 0}
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className={ACTION_BTN}
                        onClick={() => moveItem(index, 1)}
                        disabled={index === items.length - 1}
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" className={ACTION_DEL} onClick={() => deleteItem(index)} title="Delete Row">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" className={ACTION_BTN} onClick={() => duplicateItem(index)} title="Duplicate Row">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer totals */}
      {hasItems && (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
          <span className="text-slate-500">
            Total Estimated Value (<span className="font-bold text-slate-700">{items.length}</span> items)
          </span>
          <span className="font-bold text-[#0B4A3D]">{formatCurrency(grandTotal)}</span>
        </div>
      )}

      {/* Clear All confirmation (mirrors the ERP VT.Confirm dialog) */}
      <ConfirmDialog
        open={confirmClear}
        title="Clear All Items"
        message={`Remove all ${items.length} item${items.length === 1 ? '' : 's'} from this grid? This action cannot be undone.`}
        confirmLabel="Clear All"
        variant="danger"
        icon={AlertTriangle}
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
});

export default CprItemGrid;
