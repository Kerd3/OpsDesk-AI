import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { initials } from '../../utils/format.js';
import { Skeleton } from './States.jsx';

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1">{eyebrow}</div>}
        <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, actions, children, className = '', bodyClassName = 'p-4 sm:p-6', as: Tag = 'section' }) {
  return (
    <Tag className={`card min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
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

/** DashboardCard: a single KPI with optional link to the underlying list. */
export function DashboardCard({ label, value, icon: Icon, hint, to, loading }) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-500">{label}</p>
        {loading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-display mt-2 text-[28px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">{value ?? '—'}</p>}
        {hint && <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>}
      </div>
      {Icon && (
        <div className="hidden size-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 sm:flex">
          <Icon className="size-4" aria-hidden="true" />
        </div>
      )}
    </div>
  );
  if (!to) return <div className="card p-4 sm:p-6">{body}</div>;
  return (
    <Link to={to} className="card group block p-4 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50/40 sm:p-6">
      {body}
      <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        View <ArrowUpRight className="size-3" />
      </span>
    </Link>
  );
}

export function Avatar({ name, size = 'md', className = '' }) {
  const sizes = { sm: 'size-7 text-[11px]', md: 'size-8 text-xs', lg: 'size-12 text-base' };
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-100 font-semibold text-slate-700 ${sizes[size]} ${className}`} aria-hidden="true">
      {initials(name) || '?'}
    </span>
  );
}

export function DescriptionList({ items }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map(([term, detail]) => (
        <div key={term} className="grid grid-cols-3 gap-3 py-3 text-sm">
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
