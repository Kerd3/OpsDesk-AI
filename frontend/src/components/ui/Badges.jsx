import { TICKET_PRIORITIES, TICKET_STATUSES, KB_STATUSES, ASSET_STATUSES, ROLES, DELIVERY_STATUSES } from '../../utils/labels.js';

const TONES = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/15',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  indigo: 'bg-brand-50 text-brand-700 ring-brand-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
};
const DOTS = { gray: 'bg-slate-400', blue: 'bg-blue-500', indigo: 'bg-brand-500', amber: 'bg-amber-500', green: 'bg-emerald-500', red: 'bg-red-500', violet: 'bg-violet-500' };

export function Badge({ tone = 'gray', dot = false, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {dot && <span className={`size-1.5 rounded-full ${DOTS[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

const STATUS_TONES = { open: 'blue', in_progress: 'indigo', waiting_for_employee: 'amber', resolved: 'green', closed: 'gray' };
export const StatusBadge = ({ status }) => (
  <Badge tone={STATUS_TONES[status]} dot>
    {TICKET_STATUSES[status] ?? status}
  </Badge>
);

const PRIORITY_TONES = { low: 'gray', medium: 'blue', high: 'amber', urgent: 'red' };
export const PriorityBadge = ({ priority }) => <Badge tone={PRIORITY_TONES[priority]}>{TICKET_PRIORITIES[priority] ?? priority}</Badge>;

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
