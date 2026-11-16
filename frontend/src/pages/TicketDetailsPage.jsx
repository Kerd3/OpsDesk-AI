import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { CheckCircle2, RotateCcw, Hand, Pencil, Lock, Send, Sparkles } from 'lucide-react';
import { ticketsApi, usersApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { useApiMutation } from '../hooks/useApiMutation.js';
import { PageHeader, Card, DescriptionList, Tabs } from '../components/ui/Layout.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, Input, Textarea, Select } from '../components/ui/Form.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { StatusBadge, PriorityBadge, Badge } from '../components/ui/Badges.jsx';
import { LoadingSpinner, ErrorState, Alert } from '../components/ui/States.jsx';
import { CommentThread, ActivityTimeline, PersonCell } from '../components/tickets/TicketParts.jsx';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, toOptions } from '../utils/labels.js';
import { formatDateTime, timeAgo } from '../utils/format.js';

export default function TicketDetailsPage() {
  const { id } = useParams();
  const { user, isStaff } = useAuth();
  const [tab, setTab] = useState('conversation');
  const [editing, setEditing] = useState(false);

  const { data: ticket, isLoading, error, refetch } = useQuery({ queryKey: ['ticket', id], queryFn: () => ticketsApi.get(id) });
  const { data: staff } = useQuery({ queryKey: ['directory', 'staff'], queryFn: () => usersApi.directory('staff'), enabled: isStaff });

  useBreadcrumbs([{ label: user.role === 'employee' ? 'My Tickets' : 'All Tickets', to: user.role === 'employee' ? '/my-tickets' : '/tickets' }, { label: ticket?.ticketNumber ?? 'Ticket' }]);

  const invalidate = [['ticket', id], ['tickets'], ['dashboard'], ['notifications']];
  const update = useApiMutation((patch) => ticketsApi.update(id, patch), { invalidate, successMessage: 'Ticket updated' });

  if (isLoading) return <LoadingSpinner label="Loading ticket…" />;
  if (error) return <Card><ErrorState error={error} onRetry={refetch} /></Card>;

  const p = ticket.permissions;
  const comments = ticket.comments;
  const internalCount = comments.filter((c) => c.isInternal).length;

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-slate-500">{ticket.ticketNumber}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.source === 'ai_assist' && (
              <Badge tone="violet">
                <Sparkles className="size-3" aria-hidden="true" /> Drafted with AI
              </Badge>
            )}
          </div>
        }
        title={ticket.subject}
        description={`Opened by ${ticket.requester.fullName} ${timeAgo(ticket.createdAt)}`}
        actions={
          <>
            {p.canAccept && (
              <Button icon={Hand} loading={update.isPending} onClick={() => update.mutate({ assigneeId: user.id, ...(ticket.status === 'open' ? { status: 'in_progress' } : {}) })}>
                Accept ticket
              </Button>
            )}
            {p.canConfirmResolution && (
              <>
                <Button variant="secondary" icon={RotateCcw} disabled={update.isPending} onClick={() => update.mutate({ status: 'open' })}>
                  Still not fixed
                </Button>
                <Button icon={CheckCircle2} loading={update.isPending} onClick={() => update.mutate({ status: 'closed' })}>
                  Confirm resolved
                </Button>
              </>
            )}
            {p.canEditDetails && (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </>
        }
      />

      {p.canConfirmResolution && (
        <div className="mb-6">
          <Alert tone="success" icon={CheckCircle2} title="IT marked this ticket as resolved">
            Please confirm that the problem is fixed, or reopen the ticket if it isn't.
          </Alert>
        </div>
      )}
      {ticket.status === 'waiting_for_employee' && ticket.requester.id === user.id && (
        <div className="mb-6">
          <Alert tone="warning" title="IT is waiting for your reply">
            Reply below to send the ticket back to the support team.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card title="Description">
            <p className="text-sm leading-6 break-words whitespace-pre-wrap text-slate-700">{ticket.description}</p>
          </Card>

          <Card bodyClassName="p-0">
            <div className="px-5 pt-2">
              <Tabs
                label="Ticket sections"
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: 'conversation', label: 'Conversation', count: comments.length },
                  { value: 'activity', label: 'Activity', count: ticket.activity.length },
                ]}
              />
            </div>
            <div className="p-5">
              {tab === 'conversation' ? (
                <div className="space-y-6">
                  {isStaff && internalCount > 0 && <p className="text-xs text-slate-500"><Lock className="mr-1 inline size-3" aria-hidden="true" />{internalCount} internal note{internalCount > 1 ? 's' : ''} — hidden from the requester.</p>}
                  <CommentThread comments={comments} currentUserId={user.id} />
                  {p.canComment ? <CommentComposer ticketId={id} allowInternal={p.canAddInternalNote} invalidate={invalidate} /> : <p className="text-center text-sm text-slate-500">This ticket is closed. Create a new ticket if you need more help.</p>}
                </div>
              ) : (
                <ActivityTimeline activity={ticket.activity} />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {p.canManage || p.canAssign ? (
            <ManagePanel ticket={ticket} staff={staff ?? []} update={update} canManage={p.canManage} />
          ) : (
            <Card title="Details">
              <DescriptionList
                items={[
                  ['Status', <StatusBadge key="s" status={ticket.status} />],
                  ['Priority', <PriorityBadge key="p" priority={ticket.priority} />],
                  ['Category', TICKET_CATEGORIES[ticket.category]],
                  ['Assignee', ticket.assignee?.fullName ?? 'Not yet assigned'],
                ]}
              />
            </Card>
          )}
          <Card title="Requester">
            <PersonCell person={ticket.requester} sub={ticket.requester.email} />
            {ticket.requester.department && <p className="mt-3 text-sm text-slate-500">{ticket.requester.department}</p>}
          </Card>
          <Card title="Timeline">
            <DescriptionList
              items={[
                ['Created', formatDateTime(ticket.createdAt)],
                ['Updated', formatDateTime(ticket.updatedAt)],
                ['Resolved', ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : '—'],
                ['Closed', ticket.closedAt ? formatDateTime(ticket.closedAt) : '—'],
              ]}
            />
          </Card>
        </div>
      </div>

      <EditDetailsModal open={editing} onClose={() => setEditing(false)} ticket={ticket} update={update} />
    </>
  );
}

function ManagePanel({ ticket, staff, update, canManage }) {
  const change = (field) => (e) => {
    const value = e.target.value;
    update.mutate({ [field]: field === 'assigneeId' ? value || null : value });
  };
  return (
    <Card title="Manage ticket" description="Changes are saved immediately and recorded in the activity log.">
      <div className="space-y-4">
        <Field label="Status">
          {(a) => <Select {...a} value={ticket.status} onChange={change('status')} disabled={!canManage || update.isPending} options={toOptions(TICKET_STATUSES)} />}
        </Field>
        <Field label="Priority">
          {(a) => <Select {...a} value={ticket.priority} onChange={change('priority')} disabled={!canManage || update.isPending} options={toOptions(TICKET_PRIORITIES)} />}
        </Field>
        <Field label="Category">
          {(a) => <Select {...a} value={ticket.category} onChange={change('category')} disabled={!canManage || update.isPending} options={toOptions(TICKET_CATEGORIES)} />}
        </Field>
        <Field label="Assignee">
          {(a) => (
            <Select
              {...a}
              value={ticket.assignee?.id ?? ''}
              onChange={change('assigneeId')}
              disabled={update.isPending}
              placeholder="Unassigned"
              options={staff.map((s) => ({ value: s.id, label: s.fullName }))}
            />
          )}
        </Field>
      </div>
    </Card>
  );
}

function CommentComposer({ ticketId, allowInternal, invalidate }) {
  const [internal, setInternal] = useState(false);
  const { register, handleSubmit, reset, watch } = useForm({ defaultValues: { body: '' } });
  const body = watch('body');
  const mutation = useApiMutation((values) => ticketsApi.comment(ticketId, values), {
    invalidate,
    successMessage: (_d, v) => (v.isInternal ? 'Internal note added' : 'Reply sent'),
    onSuccess: () => reset(),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate({ body: v.body, isInternal: internal }))} className={`rounded-xl border p-3 ${internal ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}>
      {allowInternal && (
        <div className="mb-2 flex gap-1" role="radiogroup" aria-label="Message type">
          {[
            [false, 'Public reply'],
            [true, 'Internal note'],
          ].map(([value, label]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={internal === value}
              onClick={() => setInternal(value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${internal === value ? (value ? 'bg-amber-100 text-amber-900' : 'bg-slate-900 text-white') : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {value && <Lock className="mr-1 inline size-3" aria-hidden="true" />}
              {label}
            </button>
          ))}
        </div>
      )}
      <label htmlFor="comment-body" className="sr-only">
        {internal ? 'Internal note' : 'Reply'}
      </label>
      <Textarea id="comment-body" rows={3} placeholder={internal ? 'Only IT staff and administrators can see this note…' : 'Write a reply…'} className="border-0 p-1 shadow-none focus:ring-0" {...register('body', { required: true, maxLength: 5000 })} />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{internal ? 'Hidden from the requester.' : 'Visible to the requester and IT staff.'}</p>
        <Button type="submit" size="sm" icon={Send} loading={mutation.isPending} disabled={!body?.trim()} variant={internal ? 'secondary' : 'primary'}>
          {internal ? 'Add note' : 'Send'}
        </Button>
      </div>
    </form>
  );
}

function EditDetailsModal({ open, onClose, ticket, update }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ values: { subject: ticket.subject, description: ticket.description } });
  const save = (values) => {
    const patch = {};
    if (values.subject !== ticket.subject) patch.subject = values.subject;
    if (values.description !== ticket.description) patch.description = values.description;
    if (!Object.keys(patch).length) return onClose();
    return update.mutate(patch, { onSuccess: onClose });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit ticket"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(save)} loading={update.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(save)} className="space-y-4">
        <Field label="Subject" error={errors.subject?.message}>
          {(a) => <Input {...a} invalid={!!errors.subject} {...register('subject', { required: 'Subject is required', minLength: { value: 3, message: 'At least 3 characters' }, maxLength: 200 })} />}
        </Field>
        <Field label="Description" error={errors.description?.message}>
          {(a) => <Textarea {...a} rows={8} invalid={!!errors.description} {...register('description', { required: 'Description is required', minLength: { value: 10, message: 'At least 10 characters' } })} />}
        </Field>
      </form>
    </Modal>
  );
}
