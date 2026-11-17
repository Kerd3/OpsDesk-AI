import { Link } from 'react-router';
import { Skeleton } from './States.jsx';

/**
 * One bar split by ticket status, with the counts underneath. It replaces a row of
 * separate stat cards: the proportions show at a glance how the queue is doing.
 * segments: [{ key, label, count, color, to }]; extras: [{ label, value, to }] shown on the right.
 */
export function StatusDistribution({ segments, extras = [], loading }) {
  const total = segments.reduce((n, s) => n + (s.count ?? 0), 0);
  const description = `${total} tickets: ${segments.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(', ')}`;

  return (
    <section className="card p-4 sm:p-6" aria-label="Tickets by status">
      {loading ? (
        <Skeleton className="h-2.5 w-full" />
      ) : (
        <div className="flex h-2.5 gap-[3px]" role="img" aria-label={description}>
          {segments
            .filter((s) => s.count > 0)
            .map((s, i) => (
              <span key={s.key} className={`h-full origin-left animate-grow-x rounded-[2px] ${s.color}`} style={{ flexGrow: s.count, animationDelay: `${i * 80}ms` }} />
            ))}
        </div>
      )}
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-6 sm:flex sm:flex-wrap sm:items-end sm:gap-x-8 sm:gap-y-4">
        {segments.map((s) => (
          <li key={s.key}>
            <Link to={s.to} className="group block rounded-md focus-visible:outline-2">
              <span className="font-display block text-[28px] leading-none font-semibold text-slate-900 tabular-nums group-hover:text-brand-500">{loading ? '–' : s.count}</span>
              <span className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <span className={`size-[7px] rounded-full ${s.color}`} aria-hidden="true" />
                {s.label}
              </span>
            </Link>
          </li>
        ))}
        {extras.length > 0 && (
          <li className="col-span-2 grid grid-cols-3 gap-4 border-t border-slate-200 pt-4 sm:ml-auto sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-4 sm:border-0 sm:pt-0 sm:text-right">
            {extras.map((e) => (
              <Link key={e.label} to={e.to} className="group block rounded-md">
                <span className="font-display block text-[28px] leading-none font-semibold text-slate-900 tabular-nums group-hover:text-brand-500">{loading ? '–' : e.value}</span>
                <span className="mt-2 block text-sm text-slate-500">{e.label}</span>
              </Link>
            ))}
          </li>
        )}
      </ul>
    </section>
  );
}
