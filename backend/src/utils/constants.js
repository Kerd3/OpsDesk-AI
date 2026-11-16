// Shared enumerations. Values must match the CHECK constraints in the migrations.

export const ROLES = Object.freeze({ ADMIN: 'admin', IT_SUPPORT: 'it_support', EMPLOYEE: 'employee' });
export const ROLE_VALUES = Object.values(ROLES);
export const STAFF_ROLES = [ROLES.ADMIN, ROLES.IT_SUPPORT];

export const TICKET_CATEGORIES = ['hardware', 'software', 'network', 'printer', 'email_accounts', 'access_permissions', 'other'];
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_for_employee', 'resolved', 'closed'];
export const OPEN_STATUSES = ['open', 'in_progress', 'waiting_for_employee'];

export const KB_STATUSES = ['draft', 'published', 'archived'];

export const ASSET_CATEGORIES = ['laptop', 'desktop', 'monitor', 'printer', 'router', 'keyboard', 'mouse', 'other'];
export const ASSET_STATUSES = ['available', 'assigned', 'under_maintenance', 'retired'];
export const ASSET_CONDITIONS = ['new', 'good', 'fair', 'poor', 'damaged'];

export const WEBHOOK_EVENTS = ['ticket.created', 'ticket.assigned', 'ticket.status_changed', 'ticket.resolved'];

export const isStaff = (user) => STAFF_ROLES.includes(user?.role);
