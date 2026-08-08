import { Archive, ArrowDown, ArrowUp, ArrowUpDown, ClipboardList, Plus, Search, Trash2, X } from 'lucide-react';

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 text-slate-300 shrink-0" />;
  return direction === 'asc' ? (
    <ArrowUp className="w-3 h-3 text-[#0B4A3D] shrink-0" />
  ) : (
    <ArrowDown className="w-3 h-3 text-[#0B4A3D] shrink-0" />
  );
}

function EmptyState({ subtab, searchQuery, onClearSearch, onNewCpr, onGoActive, emptyTitle = 'CPR', emptyActionLabel = 'New CPR', foundTitle, foundMessage }) {
  if (subtab === 2) {
    return (
      <div className="text-center px-5 py-14">
        <Trash2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-base font-bold text-slate-700 mb-1.5">No Deleted {emptyTitle}s</h3>
        <p className="text-xs text-slate-400 mb-5">Your trash is empty. Deleted {emptyTitle}s will appear here.</p>
        <button
          type="button"
          onClick={onGoActive}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          Back to Active {emptyTitle}s
        </button>
      </div>
    );
  }

  if (subtab === 1) {
    return (
      <div className="text-center px-5 py-14">
        <Archive className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-base font-bold text-slate-700 mb-1.5">No Archived {emptyTitle}s</h3>
        <p className="text-xs text-slate-400">
          {searchQuery ? `No archived ${emptyTitle}s matching your search criteria.` : `Archived ${emptyTitle}s will appear here.`}
        </p>
      </div>
    );
  }

  if (searchQuery) {
    return (
      <div className="text-center px-5 py-14">
        <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-base font-bold text-slate-700 mb-1.5">No Matching {emptyTitle}s</h3>
        <p className="text-xs text-slate-400 mb-5">No {emptyTitle}s matching your search criteria.</p>
        <button
          type="button"
          onClick={onClearSearch}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" /> Clear Search
        </button>
      </div>
    );
  }

  return (
    <div className="text-center px-5 py-14">
      <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <h3 className="text-base font-bold text-slate-700 mb-1.5">{foundTitle || `No ${emptyTitle} Found`}</h3>
      <p className="text-xs text-slate-400 mb-5">{foundMessage || `Create your first ${emptyTitle} to get started.`}</p>
      <button
        type="button"
        onClick={onNewCpr}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-4 py-2 rounded-lg transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> {emptyActionLabel}
      </button>
    </div>
  );
}

function LoadingRows({ columns }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((row) => (
        <tr key={row} className="border-b border-slate-100">
          {columns.map((col, index) => (
            <td key={index} className="px-3 py-3.5">
              <div className="h-3 bg-slate-100 rounded animate-pulse" style={{ width: col.loaderWidth || '70%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function CprTable({
  columns,
  rows,
  loading,
  subtab,
  searchQuery,
  sortKey,
  sortDir,
  onSort,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  renderCell,
  actionMenu,
  onClearSearch,
  onNewCpr,
  onGoActive,
  emptyTitle = 'CPR',
  emptyActionLabel = 'New CPR'
}) {
  const allOnPage = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const someSelected = rows.some((row) => selectedIds.has(row.id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} style={{ width: col.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-slate-100/80">
            {columns.map((col) => {
              if (col.key === 'checkbox') {
                return (
                  <th key={col.key} className="text-left py-2.5 px-3 font-semibold">
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      checked={allOnPage}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allOnPage;
                      }}
                      onChange={(e) => onSelectAll(e.target.checked)}
                      className="accent-emerald-600 w-3.5 h-3.5 cursor-pointer"
                    />
                  </th>
                );
              }
              const active = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  onClick={col.sortable ? () => onSort(col.key) : undefined}
                  className={`py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.sortable ? 'cursor-pointer select-none hover:text-[#0B4A3D]' : ''}`}
                >
                  <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                    {col.label}
                    {col.sortable && <SortIcon active={active} direction={sortDir} />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <LoadingRows columns={columns} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState
                  subtab={subtab}
                  searchQuery={searchQuery}
                  onClearSearch={onClearSearch}
                  onNewCpr={onNewCpr}
                  onGoActive={onGoActive}
                  emptyTitle={emptyTitle}
                  emptyActionLabel={emptyActionLabel}
                />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                {columns.map((col) => {
                  if (col.key === 'checkbox') {
                    return (
                      <td key={col.key} className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={(e) => onToggleSelect(row.id, e.target.checked)}
                          aria-label={`Select ${row.prNo}`}
                          className="accent-emerald-600 w-3.5 h-3.5 cursor-pointer"
                        />
                      </td>
                    );
                  }
                  if (col.key === 'actions') {
                    return (
                      <td key={col.key} className="px-3 py-2.5 text-center">
                        {actionMenu(row)}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-2.5 text-xs text-slate-600 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {renderCell(col.key, row)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
