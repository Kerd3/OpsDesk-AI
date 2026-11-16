export function Logo({ className = '' }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#2b306d" />
        <path d="M10 11.5a2.5 2.5 0 0 1 2.5-2.5h7a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H15l-3.5 3v-3h1a2.5 2.5 0 0 1-2.5-2.5z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="20.5" cy="10.5" r="2.5" fill="#a5b4fc" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">
        OpsDesk <span className="text-brand-600">AI</span>
      </span>
    </span>
  );
}
