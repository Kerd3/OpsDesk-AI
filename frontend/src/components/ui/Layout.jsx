import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { initials } from '../../utils/format.js';
import { Skeleton } from './States.jsx';

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, actions, children, className = '', bodyClassName = 'p-5', as: Tag = 'section' }) {
  return (
    <Tag className={`card min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </Tag>
  );
}

const ACCENTS = {
  brand: 'bg-brand-50 text-brand-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  slate: 'bg-slate-100 text-slate-700',
};

/** DashboardCard: a single KPI with optional link to the underlying list. */
export function DashboardCard({ label, value, icon: Icon, accent = 'brand', hint, to, loading }) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-500">{label}</p>
        {loading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value ?? '—'}</p>}
        {hint && <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>}
      </div>
      {Icon && (
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${ACCENTS[accent]}`}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </div>
      )}
    </div>
  );
  if (!to) return <div className="card p-4 sm:p-5">{body}</div>;
  return (
    <Link to={to} className="card group block p-4 transition-shadow hover:shadow-pop sm:p-5">
      {body}
      <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        View <ArrowUpRight className="size-3" />
      </span>
    </Link>
  );
}

export function Avatar({ name, size = 'md', className = '' }) {
  const sizes = { sm: 'size-7 text-[11px]', md: 'size-8 text-xs', lg: 'size-12 text-base' };
  // Stable colour per person.
  const palette = ['bg-brand-100 text-brand-800', 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-800', 'bg-rose-100 text-rose-800', 'bg-violet-100 text-violet-800'];
  const hash = [...(name ?? '')].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${palette[hash % palette.length]} ${className}`} aria-hidden="true">
      {initials(name) || '?'}
    </span>
  );
}

export function DescriptionList({ items }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map(([term, detail]) => (
        <div key={term} className="grid grid-cols-3 gap-3 py-2.5 text-sm">
          <dt className="text-slate-500">{term}</dt>
          <dd className="col-span-2 min-w-0 break-words text-slate-900">{detail ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 [scrollbar-width:none]">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${value === t.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 tabular-nums">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
