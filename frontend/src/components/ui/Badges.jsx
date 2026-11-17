import { TICKET_PRIORITIES, TICKET_STATUSES, KB_STATUSES, ASSET_STATUSES, ROLES, DELIVERY_STATUSES } from '../../utils/labels.js';

// Pills: dark tint, light text, faint outline.
const TONES = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  indigo: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
};
const DOTS = { gray: 'bg-slate-400', blue: 'bg-blue-500', indigo: 'bg-blue-500', amber: 'bg-amber-500', green: 'bg-emerald-500', red: 'bg-red-500', violet: 'bg-violet-500' };

export function Badge({ tone = 'gray', dot = false, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {dot && <span className={`size-1.5 rounded-full ${DOTS[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

// Ticket status: a colored dot beside plain text keeps busy tables calm.
const STATUS_DOTS = { open: 'bg-blue-500', in_progress: 'bg-violet-500', waiting_for_employee: 'bg-amber-500', resolved: 'bg-emerald-500', closed: 'bg-slate-400' };
export const StatusBadge = ({ status }) => (
  <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap text-slate-900">
    <span className={`size-[7px] shrink-0 rounded-full ${STATUS_DOTS[status] ?? 'bg-slate-400'}`} aria-hidden="true" />
    {TICKET_STATUSES[status] ?? status}
  </span>
);

// Priority: signal bars (1–3 lit), urgent in red. The text label carries the meaning.
const PRIORITY_BARS = {
  low: { lit: 1, color: 'bg-slate-500', text: 'text-slate-500' },
  medium: { lit: 2, color: 'bg-slate-900', text: 'text-slate-700' },
  high: { lit: 3, color: 'bg-amber-500', text: 'text-slate-900' },
  urgent: { lit: 3, color: 'bg-red-500', text: 'font-semibold text-red-600' },
};
export const PriorityBadge = ({ priority }) => {
  const p = PRIORITY_BARS[priority] ?? PRIORITY_BARS.low;
  return (
    <span className={`inline-flex items-center gap-2 text-sm whitespace-nowrap ${p.text}`}>
      <span className="inline-flex items-end gap-[2px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`w-[3px] rounded-[1px] ${i < p.lit ? p.color : 'bg-slate-300'}`} style={{ height: 6 + i * 2.5 }} />
        ))}
      </span>
      {TICKET_PRIORITIES[priority] ?? priority}
    </span>
  );
};

const KB_TONES = { draft: 'amber', published: 'green', archived: 'gray' };
export const KbStatusBadge = ({ status }) => (
  <Badge tone={KB_TONES[status]} dot>
    {KB_STATUSES[status]}
  </Badge>
);

const ASSET_TONES = { available: 'green', assigned: 'indigo', under_maintenance: 'amber', retired: 'gray' };
export const AssetStatusBadge = ({ status }) => (
  <Badge tone={ASSET_TONES[status]} dot>
    {ASSET_STATUSES[status]}
  </Badge>
);

const ROLE_TONES = { admin: 'violet', it_support: 'indigo', employee: 'gray' };
export const RoleBadge = ({ role }) => <Badge tone={ROLE_TONES[role]}>{ROLES[role]}</Badge>;

const DELIVERY_TONES = { pending: 'blue', delivering: 'indigo', delivered: 'green', failed: 'red', skipped: 'gray' };
export const DeliveryStatusBadge = ({ status }) => (
  <Badge tone={DELIVERY_TONES[status]} dot>
    {DELIVERY_STATUSES[status]}
  </Badge>
);
