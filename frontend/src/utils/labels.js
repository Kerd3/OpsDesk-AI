// Display labels for API enumerations (values must match the backend).

export const TICKET_CATEGORIES = {
  hardware: 'Hardware',
  software: 'Software',
  network: 'Network',
  printer: 'Printer',
  email_accounts: 'Email and Accounts',
  access_permissions: 'Access and Permissions',
  other: 'Other',
};

export const TICKET_PRIORITIES = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

export const TICKET_STATUSES = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_for_employee: 'Waiting for Employee',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const KB_STATUSES = { draft: 'Draft', published: 'Published', archived: 'Archived' };

export const ASSET_CATEGORIES = {
  laptop: 'Laptop',
  desktop: 'Desktop',
  monitor: 'Monitor',
  printer: 'Printer',
  router: 'Router',
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  other: 'Other',
};
export const ASSET_STATUSES = { available: 'Available', assigned: 'Assigned', under_maintenance: 'Under Maintenance', retired: 'Retired' };
export const ASSET_CONDITIONS = { new: 'New', good: 'Good', fair: 'Fair', poor: 'Poor', damaged: 'Damaged' };

export const ROLES = { admin: 'Administrator', it_support: 'IT Support', employee: 'Employee' };

export const DELIVERY_STATUSES = { pending: 'Pending', delivering: 'Delivering', delivered: 'Delivered', failed: 'Failed', skipped: 'Skipped' };

export const toOptions = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));

/** Human sentence for a ticket activity entry. `actorName` lets self-assignment read naturally. */
export function describeActivity(a, actorName) {
  switch (a.action) {
    case 'created':
      return 'created the ticket';
    case 'status_changed':
      return `changed status from ${TICKET_STATUSES[a.from] ?? a.from} to ${TICKET_STATUSES[a.to] ?? a.to}`;
    case 'priority_changed':
      return `changed priority from ${TICKET_PRIORITIES[a.from] ?? a.from} to ${TICKET_PRIORITIES[a.to] ?? a.to}`;
    case 'category_changed':
      return `changed category from ${TICKET_CATEGORIES[a.from] ?? a.from} to ${TICKET_CATEGORIES[a.to] ?? a.to}`;
    case 'assigned':
      if (actorName && a.to === actorName) return a.from ? `took over the ticket from ${a.from}` : 'accepted the ticket';
      return a.from ? `reassigned the ticket from ${a.from} to ${a.to}` : `assigned the ticket to ${a.to}`;
    case 'unassigned':
      return `unassigned ${a.from ?? 'the ticket'}`;
    case 'details_updated':
      return 'updated the ticket details';
    case 'comment_added':
      return 'added a reply';
    case 'internal_note_added':
      return 'added an internal note';
    default:
      return a.action.replaceAll('_', ' ');
  }
}

export function describeAssetEvent(e) {
  const d = e.details ?? {};
  switch (e.action) {
    case 'registered':
      return 'registered the asset';
    case 'assigned':
      return `assigned it to ${d.toName ?? 'an employee'}`;
    case 'reassigned':
      return `reassigned it from ${d.fromName ?? 'previous owner'} to ${d.toName ?? 'a new owner'}`;
    case 'unassigned':
      return `returned it from ${d.fromName ?? 'its owner'}`;
    case 'status_changed':
      return `changed status from ${ASSET_STATUSES[d.from] ?? d.from} to ${ASSET_STATUSES[d.to] ?? d.to}`;
    case 'updated':
      return `updated ${(d.fields ?? []).join(', ') || 'details'}`;
    default:
      return e.action;
  }
}
