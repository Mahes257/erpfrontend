import { useEffect, useMemo, useRef, useCallback, memo } from 'react';
import {
  ArrowUp, ArrowDown, ChevronsUpDown, X, AlertTriangle, RefreshCw,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight
} from 'lucide-react';
import { ActionMenu } from '../Common';
import { PAGE_SIZE_OPTIONS } from '../../utils/leadConstants';
import { getCellValue } from '../../utils/leadHelpers';

const SELECT_COLUMN_WIDTH = 52;

const BULK_VARIANTS = {
  danger: 'text-red-600 hover:bg-red-50 hover:border-red-500 hover:text-red-600',
  default: 'text-slate-600 hover:bg-[rgba(11,74,61,0.06)] hover:border-[#0B4A3D] hover:text-[#0B4A3D]'
};

/* Convert the flat row-action list (headers/dividers/submenus) into
   ActionMenu groups, matching the OLD grouped menu layout. */
function buildActionGroups(actions, row, onRowAction) {
  const groups = [];
  let current = null;
  const pushGroup = () => {
    if (current && current.items.length > 0) groups.push(current);
    current = null;
  };
  (actions || []).forEach((action) => {
    if (action.divider) {
      pushGroup();
      return;
    }
    if (action.header) {
      pushGroup();
      current = { title: action.header, items: [] };
      return;
    }
    if (action.submenu) {
      pushGroup();
      groups.push({
        title: action.label,
        items: action.submenu.map((item) => ({
          ...item,
          onClick: () => onRowAction?.(item.key, row)
        }))
      });
      return;
    }
    if (!current) current = { title: undefined, items: [] };
    current.items.push({ ...action, onClick: () => onRowAction?.(action.key, row) });
  });
  pushGroup();
  return groups;
}

function TableRow({
  row,
  rowId,
  rowIndex = 0,
  layout,
  selectable,
  isChecked,
  onSelectionChange,
  renderers,
  rowActions,
  onRowAction
}) {
  const actions = typeof rowActions === 'function' ? rowActions(row) : rowActions;
  const groups = buildActionGroups(actions, row, onRowAction);
  const zebraBg = rowIndex % 2 === 1 ? 'bg-slate-50/40' : 'bg-surface';
  const stickyCellBg = isChecked ? 'bg-[#E8F0EE]' : zebraBg;
  const cells = [];

  if (selectable) {
    cells.push(
      <td key="__select" className={`px-4 py-3 w-[52px] text-center sticky left-0 z-30 ${stickyCellBg} transition-colors`}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onSelectionChange?.(rowId)}
          className="w-4 h-4 accent-[#0A4F44] cursor-pointer rounded"
        />
      </td>
    );
  }

  layout.forEach((col) => {
    const style = { minWidth: col.width || 120 };
    if (col.leftOffset !== undefined) style.left = col.leftOffset;
    if (col.rightOffset !== undefined) style.right = col.rightOffset;
    const isSticky = col.sticky === 'left' || col.sticky === 'right';
    const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '';
    const cellClass = isSticky ? `sticky z-30 ${stickyCellBg} transition-colors` : '';
    cells.push(
      <td key={col.key} style={style} className={`px-4 py-3 border-b border-slate-100 ${cellClass} ${alignClass}`}>
        {col.key === 'actions' ? (
          <ActionMenu
            groups={groups}
            align="right"
            ariaLabel={`Actions for ${row.name || 'lead'}`}
          />
        ) : renderers[col.key] ? (
          renderers[col.key](row)
        ) : (
          getCellValue(row, col.key)
        )}
      </td>
    );
  });

  return (
    <tr className={`group transition-colors ${isChecked ? 'bg-[#E8F0EE]' : zebraBg} hover:bg-[#EDF7F4]`}>
      {cells}
    </tr>
  );
}

const MemoizedTableRow = memo(TableRow);

export default function LeadTable({
  columns,
  data = [],
  loading = false,
  error = null,
  sortKey = '',
  sortDirection = 'asc',
  onSort,
  pagination,
  onPageChange,
  onPageSizeChange,
  selectedIds = [],
  onSelectionChange,
  selectable = true,
  renderers = {},
  rowActions = [],
  onRowAction,
  bulkActions = [],
  onBulkAction,
  bulkBarExtra = null,
  selectedLabel = 'lead(s)',
  onRetry,
  emptyMessage = 'No records found matching your criteria.',
  emptyState = null,
  emptyAction = null,
  errorMessage = 'Failed to load records. Please try again.',
  maxHeight = 560,
  skeletonRows = 8,
  getRowId = (row) => row.id
}) {
  const selectAllRef = useRef(null);
  const selectedIdsRef = useRef(selectedIds);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const handleRowToggle = useCallback(
    (rowId) => {
      const current = selectedIdsRef.current;
      onSelectionChange?.(
        current.includes(rowId)
          ? current.filter((id) => id !== rowId)
          : [...current, rowId]
      );
    },
    [onSelectionChange]
  );

  const visibleColumns = useMemo(() => columns.filter((col) => col.visible !== false), [columns]);

  const layout = useMemo(() => {
    const leftLayout = visibleColumns.reduce(
      (acc, col) => {
        if (col.sticky === 'left') {
          return {
            cols: [...acc.cols, { ...col, leftOffset: acc.leftOffset }],
            leftOffset: acc.leftOffset + (col.width || 0)
          };
        }
        return { cols: [...acc.cols, col], leftOffset: acc.leftOffset };
      },
      { cols: [], leftOffset: selectable ? SELECT_COLUMN_WIDTH : 0 }
    );

    return leftLayout.cols.reduceRight(
      (acc, col) => {
        if (col.sticky === 'right') {
          return {
            cols: [{ ...col, rightOffset: acc.rightOffset }, ...acc.cols],
            rightOffset: acc.rightOffset + (col.width || 0)
          };
        }
        return { cols: [col, ...acc.cols], rightOffset: acc.rightOffset };
      },
      { cols: [], rightOffset: 0 }
    ).cols;
  }, [visibleColumns, selectable]);

  const colCount = layout.length + (selectable ? 1 : 0);
  const { page = 1, pageSize = 10, totalCount = 0, totalPages = 1 } = pagination || {};

  const isAllSelected = data.length > 0 && data.every((row) => selectedIds.includes(getRowId(row)));
  const isSomeSelected = data.some((row) => selectedIds.includes(getRowId(row)));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isSomeSelected && !isAllSelected;
    }
  }, [isAllSelected, isSomeSelected]);

  const handleSelectAll = (e) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      onSelectionChange(data.map(getRowId));
    } else {
      onSelectionChange([]);
    }
  };

  const renderSortIcon = (col) => {
    if (sortKey !== col.key) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
      : <ArrowDown className="w-3.5 h-3.5 text-amber-300" />;
  };

  const renderHeader = () => {
    const cells = [];
    if (selectable) {
      cells.push(
        <th key="__select" className="px-4 py-0 w-[52px] text-center sticky left-0 z-50 bg-[#0B4A3D]">
          <input
            ref={selectAllRef}
            type="checkbox"
            onChange={handleSelectAll}
            checked={isAllSelected}
            className="w-4 h-4 accent-[#0A4F44] cursor-pointer rounded"
          />
        </th>
      );
    }
    layout.forEach((col) => {
      const style = { minWidth: col.width || 120 };
      if (col.leftOffset !== undefined) style.left = col.leftOffset;
      if (col.rightOffset !== undefined) style.right = col.rightOffset;
      const isSticky = col.sticky === 'left' || col.sticky === 'right';
      const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '';
      cells.push(
        <th
          key={col.key}
          style={style}
          className={`px-4 py-0 text-[13px] font-semibold tracking-[0.2px] ${alignClass} ${isSticky ? 'sticky z-50 bg-[#0B4A3D]' : ''}`}
        >
          {col.sortable ? (
            <button
              onClick={() => onSort?.(col.key)}
              className="inline-flex items-center gap-1 tracking-[0.2px] cursor-pointer hover:text-emerald-200 transition-colors"
            >
              {col.label}
              {renderSortIcon(col)}
            </button>
          ) : (
            col.label
          )}
        </th>
      );
    });
    return cells;
  };

  const renderSkeleton = () =>
    Array.from({ length: Math.min(skeletonRows, 8) }, (_, index) => (
      <tr key={`skeleton-${index}`} className="border-b border-slate-100">
        {selectable && (
          <td className="px-4 py-3 text-center sticky left-0 z-30 bg-surface">
            <div className="w-4 h-4 mx-auto rounded bg-slate-200 animate-pulse" />
          </td>
        )}
        {layout.map((col) => {
          const style = { minWidth: col.width || 120 };
          if (col.leftOffset !== undefined) style.left = col.leftOffset;
          if (col.rightOffset !== undefined) style.right = col.rightOffset;
          const isSticky = col.sticky === 'left' || col.sticky === 'right';
          const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '';
          return (
            <td key={col.key} style={style} className={`px-4 py-3 ${alignClass} ${isSticky ? 'sticky z-30 bg-surface' : ''}`}>
              <div className={`h-3 bg-slate-200 rounded animate-pulse ${col.align === 'center' ? 'mx-auto w-16' : 'w-24'}`} />
            </td>
          );
        })}
      </tr>
    ));

  const renderEmpty = () => (
    <tr>
      <td colSpan={colCount} className="p-0">
        {emptyState || (
          <div className="py-14 text-center text-slate-400 font-medium">
            {emptyMessage}
            {emptyAction && (
              <button
                onClick={emptyAction.onClick}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                {emptyAction.icon && <emptyAction.icon className="w-3.5 h-3.5" />}
                {emptyAction.label}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );

  const renderError = () => (
    <tr>
      <td colSpan={colCount} className="p-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-rose-300" />
          <span className="text-slate-500 font-medium">{errorMessage}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  const renderPagination = () => {
    const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalCount);

    // Numbered window (max 5), same logic as OLD.zip pagination.js
    let sp = Math.max(1, page - 2);
    let ep = Math.min(totalPages, page + 2);
    if (ep - sp < 4 && totalPages > 5) {
      if (sp === 1) ep = Math.min(totalPages, sp + 4);
      else sp = Math.max(1, ep - 4);
    }
    const numbers = [];
    for (let i = sp; i <= ep; i += 1) numbers.push(i);

    const pageBtn = (key, onClick, disabled, label, children) => (
      <button
        key={key}
        onClick={onClick}
        disabled={disabled}
        title={label}
        aria-label={label}
        className="w-8 h-8 rounded-md border border-slate-200 bg-surface text-slate-700 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center text-[13px] leading-none p-0 transition-all cursor-pointer dark:bg-surface dark:border-line dark:text-ink-2"
      >
        {children}
      </button>
    );

    return (
      <div className="flex flex-col sm:flex-row justify-between items-center gap-2.5 px-5 py-3 border-t border-slate-200 text-[13px] text-slate-500 font-medium">
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <span className="whitespace-nowrap">Showing {start}-{end} of {totalCount}</span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            Rows:
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="px-2 py-1 border border-slate-200 rounded-md text-[13px] text-slate-700 bg-surface outline-none hover:border-[#0B4A3D] transition-colors cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {pageBtn('first', () => onPageChange?.(1), page <= 1, 'First', <ChevronsLeft className="w-4 h-4" />)}
          {pageBtn('prev', () => onPageChange?.(page - 1), page <= 1, 'Previous', <ChevronLeft className="w-4 h-4" />)}
          {numbers.map((n) => (
            <button
              key={n}
              onClick={() => onPageChange?.(n)}
              className={`w-8 h-8 rounded-md border text-[13px] leading-none inline-flex items-center justify-center transition-all cursor-pointer ${
                n === page
                  ? 'bg-[#0B4A3D] text-white border-[#0B4A3D] font-bold'
                  : 'bg-surface text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300 dark:bg-surface dark:border-line dark:text-ink-2'
              }`}
            >
              {n}
            </button>
          ))}
          {pageBtn('next', () => onPageChange?.(page + 1), page >= totalPages, 'Next', <ChevronRight className="w-4 h-4" />)}
          {pageBtn('last', () => onPageChange?.(totalPages), page >= totalPages, 'Last', <ChevronsRight className="w-4 h-4" />)}
        </div>
      </div>
    );
  };

  return (
    <>
      {selectable && selectedIds.length > 0 && (
        <div className="bulk-slide-in flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 bg-[#E8F0EE] border-[1.5px] border-[#0B4A3D] rounded-xl mb-3 text-[13px] text-[#166534]">
          <span className="font-semibold text-[#0B4A3D] text-sm whitespace-nowrap flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#0B4A3D] text-white text-[11px] font-bold">
              {selectedIds.length}
            </span>
            {selectedLabel} selected
          </span>
          <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            {bulkActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  onClick={() => onBulkAction?.(action.key, selectedIds)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-transparent border border-transparent transition-all cursor-pointer whitespace-nowrap ${BULK_VARIANTS[action.variant] || BULK_VARIANTS.default}`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />} {action.label}
                </button>
              );
            })}
            {bulkBarExtra}
            <button
              onClick={() => onSelectionChange?.([])}
              className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:bg-[rgba(11,74,61,0.08)] hover:text-[#0B4A3D] transition-colors cursor-pointer"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface border border-slate-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden relative w-full dark:bg-surface dark:border-line">
        <div className="overflow-auto" style={{ maxHeight }}>
          <table className="w-full text-left border-collapse text-[13px] min-w-[1100px]">
            <thead className="bg-[#0B4A3D] text-white font-semibold select-none sticky top-0 z-40">
              <tr className="h-[52px]">{renderHeader()}</tr>
            </thead>
            <tbody className="text-slate-700 dark:text-ink-2">
              {loading
                ? renderSkeleton()
                : data.length > 0
                  ? data.map((row, index) => (
                      <MemoizedTableRow
                        key={getRowId(row)}
                        row={row}
                        rowId={getRowId(row)}
                        rowIndex={index}
                        layout={layout}
                        selectable={selectable}
                        isChecked={selectedIds.includes(getRowId(row))}
                        onSelectionChange={handleRowToggle}
                        renderers={renderers}
                        rowActions={rowActions}
                        onRowAction={onRowAction}
                      />
                    ))
                  : error
                    ? renderError()
                    : renderEmpty()}
            </tbody>
          </table>
        </div>
        {!loading && pagination && renderPagination()}
      </div>
    </>
  );
}
