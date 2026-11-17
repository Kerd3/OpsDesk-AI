import { Link } from 'react-router';
import { MessageSquare, Lock, CircleDot, ArrowRightLeft, UserPlus, Flag, Pencil, Plus } from 'lucide-react';
import { StatusBadge, PriorityBadge, Badge } from '../ui/Badges.jsx';
import { Avatar } from '../ui/Layout.jsx';
import { TICKET_CATEGORIES, ROLES, describeActivity } from '../../utils/labels.js';
import { timeAgo, formatDateTime } from '../../utils/format.js';

/** Column definitions shared by ticket tables. */
export function ticketColumns({ showRequester = true, showAssignee = true, showUpdated = true } = {}) {
  return [
    {
      key: 'subject',
      header: 'Ticket',
      sortKey: 'number',
      render: (t) => (
        <div className="min-w-[14rem] max-w-md">
          <Link to={`/tickets/${t.id}`} className="font-medium text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
            {t.subject}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span className="font-mono whitespace-nowrap">{t.ticketNumber}</span>
            <span aria-hidden="true">·</span>
            <span>{TICKET_CATEGORIES[t.category]}</span>
            {t.commentCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="size-3" aria-hidden="true" />
                {t.commentCount}
              </span>
            )}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', sortKey: 'status', render: (t) => <StatusBadge status={t.status} /> },
    { key: 'priority', header: 'Priority', sortKey: 'priority', render: (t) => <PriorityBadge priority={t.priority} /> },
    ...(showRequester
      ? [{ key: 'requester', header: 'Requester', className: 'hidden lg:table-cell', render: (t) => <PersonCell person={t.requester} sub={t.requester.department} /> }]
      : []),
    ...(showAssignee
      ? [{ key: 'assignee', header: 'Assignee', className: 'hidden md:table-cell', render: (t) => (t.assignee ? <PersonCell person={t.assignee} /> : <span className="text-slate-500">Unassigned</span>) }]
      : []),
    ...(showUpdated
      ? [{ key: 'updated', header: 'Updated', sortKey: 'updated', className: 'hidden sm:table-cell whitespace-nowrap', render: (t) => <span title={formatDateTime(t.updatedAt)}>{timeAgo(t.updatedAt)}</span> }]
      : []),
  ];
}

export function PersonCell({ person, sub }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar name={person.fullName} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-800">{person.fullName}</p>
        {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

/** TicketCard: compact ticket summary used on dashboards. */
export function TicketCard({ ticket }) {
  return (
    <Link to={`/tickets/${ticket.id}`} className="block rounded-md px-3 py-3 transition-colors hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{ticket.subject}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="font-mono">{ticket.ticketNumber}</span> · {TICKET_CATEGORIES[ticket.category]} · {timeAgo(ticket.updatedAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={ticket.status} />
        </div>
      </div>
    </Link>
  );
}

export function CommentThread({ comments, currentUserId }) {
  if (!comments.length) return <p className="py-6 text-center text-sm text-slate-500">No replies yet.</p>;
  return (
    <ol className="space-y-4">
      {comments.map((c) => (
        <li key={c.id} className="flex gap-3">
          <Avatar name={c.author.fullName} />
          <div className={`min-w-0 flex-1 rounded-xl border px-4 py-3 ${c.isInternal ? 'note-hatch border-dashed border-amber-300 bg-amber-50/50' : c.author.id === currentUserId ? 'border-brand-100 bg-brand-50/40' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-medium text-slate-900">{c.author.fullName}</span>
              {c.author.role !== 'employee' && <span className="text-xs text-slate-500">{ROLES[c.author.role]}</span>}
              {c.isInternal && (
                <Badge tone="amber">
                  <Lock className="size-3" aria-hidden="true" /> Internal note
                </Badge>
              )}
              <time className="ml-auto text-xs text-slate-500" dateTime={c.createdAt} title={formatDateTime(c.createdAt)}>
                {timeAgo(c.createdAt)}
              </time>
            </div>
            {/* Rendered as text: React escapes it, so user-supplied HTML is never executed. */}
            <p className="mt-2 text-sm break-words whitespace-pre-wrap text-slate-700">{c.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const ACTIVITY_ICONS = {
  created: Plus,
  status_changed: CircleDot,
  priority_changed: Flag,
  category_changed: ArrowRightLeft,
  assigned: UserPlus,
  unassigned: UserPlus,
  details_updated: Pencil,
  comment_added: MessageSquare,
  internal_note_added: Lock,
};

export function ActivityTimeline({ activity }) {
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {activity.map((a) => {
        const Icon = ACTIVITY_ICONS[a.action] ?? CircleDot;
        return (
          <li key={a.id} className="relative">
            <span className="absolute top-0.5 -left-[29px] flex size-[18px] items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
              <Icon className="size-2.5 text-slate-500" aria-hidden="true" />
            </span>
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-900">{a.actor?.fullName ?? 'System'}</span> {describeActivity(a, a.actor?.fullName)}
            </p>
            <time className="text-xs text-slate-500" dateTime={a.createdAt}>
              {formatDateTime(a.createdAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

export function ActivityFeed({ items, emptyText = 'No recent activity.' }) {
  if (!items?.length) return <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((a) => (
        <li key={a.id}>
          <Link to={`/tickets/${a.ticket.id}`} className="flex gap-3 px-1 py-3 hover:bg-slate-50">
            <Avatar name={a.actorName ?? 'System'} size="sm" />
            <div className="min-w-0">
              <p className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">{a.actorName ?? 'System'}</span> {describeActivity(a, a.actorName)}
              </p>
              <p className="truncate text-xs text-slate-500">
                <span className="font-mono">{a.ticket.ticketNumber}</span> · {a.ticket.subject} · {timeAgo(a.createdAt)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
