import { forwardRef, useId } from 'react';
import { Search, ChevronDown } from 'lucide-react';

/** Label + control + help/error text with correct aria wiring. */
export function Field({ label, error, hint, required, children, className = '', id: providedId }) {
  const autoId = useId();
  const id = providedId ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
        </label>
      )}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', invalid, ...props }, ref) {
  return <input ref={ref} className={`input ${invalid ? 'input-error' : ''} ${className}`} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className = '', invalid, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={`input resize-y ${invalid ? 'input-error' : ''} ${className}`} {...props} />;
});

export const Select = forwardRef(function Select({ options, placeholder, className = '', invalid, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={`input appearance-none pr-9 ${invalid ? 'input-error' : ''} ${className}`} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
    </div>
  );
});

export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      <input type="search" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pl-9" />
    </div>
  );
}

/** FilterDropdown: compact labelled select used in toolbars. */
export function FilterDropdown({ label, value, onChange, options, allLabel = 'All', className = '' }) {
  const id = useId();
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} options={options} placeholder={`${label}: ${allLabel}`} className="h-9 py-1.5" />
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-900">
          {label}
        </label>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}
      >
        <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
