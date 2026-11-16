import { AlertCircle, Inbox, Loader2, RotateCw } from 'lucide-react';
import { Button } from './Button.jsx';

export function LoadingSpinner({ label = 'Loading…', className = '' }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2 py-12 text-sm text-slate-500 ${className}`}>
      <Loader2 className="size-5 animate-spin text-brand-500" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Placeholder blocks shaped like the content being loaded. */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} aria-hidden="true" />;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-slate-100">
        <Icon className="size-5 text-slate-500" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong', className = '' }) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-red-50">
        <AlertCircle className="size-5 text-red-600" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{error?.status === 404 ? 'Not found' : title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{error?.message ?? 'Please try again.'}</p>
      {onRetry && error?.status !== 404 && error?.status !== 403 && (
        <Button variant="secondary" size="sm" icon={RotateCw} onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}

/** Inline banner for page-level notices. */
export function Alert({ tone = 'info', title, children, icon: Icon, action }) {
  const tones = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'note'} className={`flex flex-col gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-start ${tones[tone]}`}>
      {Icon && <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1 opacity-90' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
