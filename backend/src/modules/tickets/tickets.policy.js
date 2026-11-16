import { ROLES } from '../../utils/constants.js';
import { forbidden, notFound, conflict } from '../../utils/errors.js';

/**
 * Ticket authorization rules — the single source of truth, enforced server-side.
 *
 *  Administrator : every ticket, every field.
 *  IT support    : tickets assigned to them, unassigned tickets (so they can
 *                  accept them) and tickets they requested themselves.
 *                  Full edit rights once the ticket is assigned to them.
 *  Employee      : only tickets they requested; may edit subject/description
 *                  while the ticket is active, and confirm (close) or reopen a
 *                  resolved ticket.
 */

/** SQL fragment restricting a `tickets t` query to what `user` may see. */
export function visibilityCondition(user, conditions) {
  if (user.role === ROLES.ADMIN) return;
  const self = conditions.param(user.id);
  if (user.role === ROLES.IT_SUPPORT) {
    conditions.clauses.push(`(t.assignee_id = ${self} OR t.assignee_id IS NULL OR t.requester_id = ${self})`);
  } else {
    conditions.clauses.push(`t.requester_id = ${self}`);
  }
}

export function canView(user, ticket) {
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.IT_SUPPORT) {
    return ticket.assignee_id === user.id || ticket.assignee_id === null || ticket.requester_id === user.id;
  }
  return ticket.requester_id === user.id;
}

/** Throws 404 (not 403) so ticket ids cannot be probed for existence. */
export function assertCanView(user, ticket) {
  if (!ticket || !canView(user, ticket)) throw notFound('Ticket');
}

export const canSeeInternal = (user) => user.role === ROLES.ADMIN || user.role === ROLES.IT_SUPPORT;

const EMPLOYEE_EDITABLE = new Set(['subject', 'description', 'status']);
const EMPLOYEE_STATUS_TRANSITIONS = { resolved: ['closed', 'open'] };

/** Validates that `user` may apply `patch` to `ticket`. Throws on violation. */
export function assertCanUpdate(user, ticket, patch) {
  assertCanView(user, ticket);
  const fields = Object.keys(patch);

  if (user.role === ROLES.ADMIN) return;

  if (user.role === ROLES.IT_SUPPORT) {
    if (ticket.assignee_id === user.id) return;
    if (ticket.assignee_id === null && patch.assigneeId === user.id) return; // accepting the ticket
    if (ticket.assignee_id === null) {
      throw forbidden('Accept this ticket (assign it to yourself) before changing it');
    }
    // Visible only because they requested it: behave like an employee.
  }

  if (ticket.requester_id !== user.id) throw forbidden();

  const restricted = fields.filter((f) => !EMPLOYEE_EDITABLE.has(f));
  if (restricted.length) {
    throw forbidden(`You cannot change the following fields: ${restricted.join(', ')}`);
  }
  if (patch.status !== undefined && patch.status !== ticket.status) {
    const allowed = EMPLOYEE_STATUS_TRANSITIONS[ticket.status] ?? [];
    if (!allowed.includes(patch.status)) {
      throw forbidden('You can only confirm a resolution (close) or reopen a resolved ticket');
    }
  }
  if ((patch.subject !== undefined || patch.description !== undefined) && ['resolved', 'closed'].includes(ticket.status)) {
    throw conflict('Resolved or closed tickets cannot be edited. Reopen the ticket or add a comment instead.');
  }
}

export function assertCanComment(user, ticket, isInternal) {
  assertCanView(user, ticket);
  if (isInternal && !canSeeInternal(user)) throw forbidden('Only IT staff can add internal notes');
  if (ticket.status === 'closed' && !canSeeInternal(user)) {
    throw conflict('This ticket is closed. Create a new ticket if you need more help.');
  }
}
