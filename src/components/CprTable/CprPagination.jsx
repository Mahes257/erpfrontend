import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

function buildPageWindow(current, total) {
  let start = Math.max(1, current - 2);
  let end = Math.min(total, current + 2);
  if (end - start < 4 && total > 5) {
    if (start === 1) end = Math.min(total, start + 4);
    else start = Math.max(1, end - 4);
  }
  const pages = [];
  for (let i = start; i <= end; i += 1) pages.push(i);
  return pages;
}

export default function CprPagination({
  total,
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange
}) {
  const start = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, total);
  const pages = buildPageWindow(currentPage, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200">
      <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
        <span>
          Showing {start}-{end} of {total}
        </span>
        <label className="flex items-center gap-1.5 text-slate-500">
          Rows:
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-600/50 cursor-pointer"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-surface text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-surface text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
            className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              page === currentPage
                ? 'bg-[#0B4A3D] text-white'
                : 'bg-surface border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-surface text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-surface text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
