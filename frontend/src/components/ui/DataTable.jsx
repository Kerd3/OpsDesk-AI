import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp } from 'lucide-react';
import { Skeleton, EmptyState, ErrorState } from './States.jsx';

/**
 * DataTable — columns: [{ key, header, render(row), className, sortKey }].
 * The table scrolls horizontally inside its card so the page itself never overflows.
 * Use `className: 'hidden md:table-cell'` on secondary columns for small screens.
 */
export function DataTable({ columns, rows, loading, error, onRetry, empty, onRowClick, sort, onSortChange, rowKey = (r) => r.id, caption }) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  const toggleSort = (key) => {
    if (!onSortChange) return;
    onSortChange(sort?.key === key ? { key, order: sort.order === 'asc' ? 'desc' : 'asc' } : { key, order: 'desc' });
  };

  return (
    // `relative` keeps absolutely positioned children (e.g. sr-only labels) inside the scroll box.
    <div className="relative overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-slate-50/80">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-4 py-3 text-xs font-medium whitespace-nowrap text-slate-500 ${c.className ?? ''}`} aria-sort={c.sortKey && sort?.key === c.sortKey ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}>
                {c.sortKey && onSortChange ? (
                  <button type="button" onClick={() => toggleSort(c.sortKey)} className="inline-flex items-center gap-1 transition-colors hover:text-slate-900">
                    {c.header}
                    {sort?.key === c.sortKey && (sort.order === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {loading
            ? Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-4 ${c.className ?? ''}`}>
                      <Skeleton className="h-4 w-full max-w-[12rem]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={onRowClick ? 'cursor-pointer transition-colors hover:bg-slate-50' : ''}>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 align-middle text-slate-700 ${c.className ?? ''}`}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && (empty ?? <EmptyState title="No results" description="Try adjusting your filters." />)}
    </div>
  );
}

export function Pagination({ meta, onPageChange }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600" aria-label="Pagination">
      <p>
        <span className="font-medium text-slate-900">{from}</span>–<span className="font-medium text-slate-900">{to}</span> of{' '}
        <span className="font-medium text-slate-900">{meta.total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1} className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40" aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2 tabular-nums">
          {meta.page} / {meta.totalPages}
        </span>
        <button type="button" onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.totalPages} className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40" aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
