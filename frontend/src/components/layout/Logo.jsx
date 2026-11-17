export function Logo({ className = '' }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" className="size-7 text-brand-500" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 21 7v10l-9 5-9-5V7z" />
        <path d="M8 12h8M12 8v8" />
      </svg>
      <span className="font-display text-[17px] font-semibold tracking-tight text-slate-900">
        OpsDesk <span className="font-medium text-slate-500">AI</span>
      </span>
    </span>
  );
}
