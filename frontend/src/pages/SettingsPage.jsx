import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, Webhook, Sparkles, RotateCw, Send, CheckCircle2, XCircle, CircleAlert } from 'lucide-react';
import { authApi, adminApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { useApiMutation, applyFieldErrors } from '../hooks/useApiMutation.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import { PageHeader, Card, Tabs } from '../components/ui/Layout.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, Input, Toggle, FilterDropdown } from '../components/ui/Form.jsx';
import { DataTable, Pagination } from '../components/ui/DataTable.jsx';
import { DeliveryStatusBadge } from '../components/ui/Badges.jsx';
import { ErrorState, LoadingSpinner, Alert, EmptyState } from '../components/ui/States.jsx';
import { DELIVERY_STATUSES, toOptions } from '../utils/labels.js';
import { formatDateTime, timeAgo } from '../utils/format.js';

const EVENT_LABELS = {
  'ticket.created': 'New ticket created',
  'ticket.assigned': 'Ticket assigned',
  'ticket.status_changed': 'Ticket status changed',
  'ticket.resolved': 'Ticket resolved',
};

export default function SettingsPage() {
  useBreadcrumbs([{ label: 'Settings' }]);
  const { isAdmin } = useAuth();
  const [filters, setFilters] = useUrlFilters({ tab: 'security' });

  return (
    <div className="max-w-5xl">
      <PageHeader title="Settings" description={isAdmin ? 'Account security and system integrations.' : 'Manage your account security.'} />
      {isAdmin && (
        <div className="mb-6">
          <Tabs
            label="Settings sections"
            value={filters.tab}
            onChange={(tab) => setFilters({ tab, status: '' })}
            tabs={[
              { value: 'security', label: 'Account security' },
              { value: 'integrations', label: 'Integrations' },
            ]}
          />
        </div>
      )}
      {isAdmin && filters.tab === 'integrations' ? <IntegrationSettings filters={filters} setFilters={setFilters} /> : <PasswordSettings />}
    </div>
  );
}

function PasswordSettings() {
  const { register, handleSubmit, reset, watch, setError, formState: { errors } } = useForm({ defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const change = useApiMutation((v) => authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword }), {
    successMessage: 'Password changed. Other devices have been signed out.',
    onSuccess: () => reset(),
    onError: (err) => (err.status === 400 ? setError('currentPassword', { message: err.message }) : applyFieldErrors(err, setError)),
  });
  return (
    <Card title="Change password" description="Use at least 10 characters including a letter and a number.">
      <form onSubmit={handleSubmit((v) => change.mutate(v))} className="max-w-md space-y-4" noValidate>
        <Field label="Current password" error={errors.currentPassword?.message}>
          {(a) => <Input {...a} type="password" autoComplete="current-password" invalid={!!errors.currentPassword} {...register('currentPassword', { required: 'Enter your current password' })} />}
        </Field>
        <Field label="New password" error={errors.newPassword?.message}>
          {(a) => (
            <Input
              {...a}
              type="password"
              autoComplete="new-password"
              invalid={!!errors.newPassword}
              {...register('newPassword', { required: 'Enter a new password', validate: (v) => (v.length >= 10 && /[A-Za-z]/.test(v) && /\d/.test(v)) || 'At least 10 characters with a letter and a number' })}
            />
          )}
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message}>
          {(a) => <Input {...a} type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register('confirm', { validate: (v) => v === watch('newPassword') || 'Passwords do not match' })} />}
        </Field>
        <Button type="submit" icon={KeyRound} loading={change.isPending}>
          Update password
        </Button>
      </form>
    </Card>
  );
}

const StatusLine = ({ ok, label, warn }) => (
  <p className="flex items-center gap-2 text-sm">
    {ok ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> : warn ? <CircleAlert className="size-4 text-amber-600" aria-hidden="true" /> : <XCircle className="size-4 text-slate-500" aria-hidden="true" />}
    <span className="text-slate-700">{label}</span>
  </p>
);

function IntegrationSettings({ filters, setFilters }) {
  const status = useQuery({ queryKey: ['integrations'], queryFn: adminApi.integrations, refetchInterval: 30000 });
  const params = { status: filters.status, page: filters.page, pageSize: 10 };
  const deliveries = useQuery({ queryKey: ['deliveries', params], queryFn: () => adminApi.deliveries(params), refetchInterval: 30000 });
  const invalidate = [['integrations'], ['deliveries']];

  const setNotifications = useApiMutation(adminApi.updateNotificationSettings, { invalidate, successMessage: 'Notification settings saved' });
  const setAi = useApiMutation(adminApi.updateAiSettings, { invalidate: [...invalidate, ['ai-status']], successMessage: (s) => (s.enabled ? 'AI assistant enabled' : 'AI assistant disabled') });
  const retry = useApiMutation(adminApi.retryDelivery, { invalidate, successMessage: 'Delivery queued for retry' });
  const test = useApiMutation(adminApi.sendTestEvent, { invalidate, successMessage: (d) => (d.status === 'delivered' ? 'Test event delivered to n8n' : `Test event ${d.status}: ${d.lastError ?? ''}`) });

  if (status.isLoading) return <LoadingSpinner />;
  if (status.error) return <Card><ErrorState error={status.error} onRetry={status.refetch} /></Card>;
  const { webhook, ai, settings } = status.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="AI assistant" description="Google Gemini, grounded on published knowledge base articles" actions={<Sparkles className="size-4 text-brand-500" aria-hidden="true" />}>
          <div className="space-y-3">
            <StatusLine ok={ai.configured} label={ai.configured ? `API key configured · model ${ai.model}` : 'GEMINI_API_KEY / GEMINI_MODEL not set on the server'} />
            <div className="border-t border-slate-100 pt-4">
              <Toggle checked={settings.ai.enabled} disabled={setAi.isPending} onChange={(enabled) => setAi.mutate({ enabled })} label="Enable assistant for all users" description="When off, the assistant page explains that it is unavailable." />
            </div>
            {!ai.configured && <Alert tone="warning">Secrets are read from environment variables only and are never stored in the database or shown here.</Alert>}
          </div>
        </Card>

        <Card title="n8n workflow automation" description="Signed webhook events with retries" actions={<Webhook className="size-4 text-slate-500" aria-hidden="true" />}>
          <div className="space-y-3">
            <StatusLine ok={webhook.urlConfigured} label={webhook.urlConfigured ? `Webhook URL configured (${webhook.host})` : 'N8N_WEBHOOK_URL not set — events are recorded as skipped'} />
            <StatusLine ok={webhook.secretConfigured} label={webhook.secretConfigured ? 'Signing secret configured' : 'N8N_WEBHOOK_SECRET not set'} />
            <StatusLine ok={webhook.workerRunning} warn={webhook.configured && !webhook.workerRunning} label={webhook.workerRunning ? 'Delivery worker running' : 'Delivery worker stopped'} />
            <p className="text-xs text-slate-500">Last successful delivery: {webhook.lastDeliveredAt ? timeAgo(webhook.lastDeliveredAt) : 'never'}</p>
            <Button variant="secondary" size="sm" icon={Send} disabled={!webhook.configured} loading={test.isPending} onClick={() => test.mutate()}>
              Send test event
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Notification events" description="Choose which ticket events are sent to n8n (for example, to email the requester).">
        <div className="space-y-4">
          <Toggle checked={settings.notifications.enabled} disabled={setNotifications.isPending} onChange={(enabled) => setNotifications.mutate({ enabled })} label="Send events to n8n" description="Turning this off stops new events from being queued. Core ticket features are unaffected." />
          <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            {Object.entries(EVENT_LABELS).map(([event, label]) => (
              <Toggle key={event} checked={settings.notifications.events[event] !== false} disabled={!settings.notifications.enabled || setNotifications.isPending} onChange={(on) => setNotifications.mutate({ events: { [event]: on } })} label={label} description={<span className="font-mono text-xs">{event}</span>} />
            ))}
          </div>
        </div>
      </Card>

      <section aria-labelledby="deliveries-7d">
      <h2 id="deliveries-7d" className="mb-3 text-sm font-semibold text-slate-900">Deliveries in the last 7 days</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Delivered', webhook.last7Days.delivered, 'text-emerald-700'],
          ['Pending / retrying', webhook.last7Days.pending, 'text-blue-700'],
          ['Failed', webhook.last7Days.failed, 'text-red-700'],
          ['Skipped', webhook.last7Days.skipped, 'text-slate-700'],
        ].map(([label, value, color]) => (
          <div key={label} className="card p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className={`font-display mt-2 text-[28px] leading-none font-semibold tabular-nums ${value > 0 ? color : 'text-slate-900'}`}>{value}</p>
          </div>
        ))}
      </div>
      </section>

      <Card
        title="Webhook deliveries"
        description="Every event, its attempts and the last error. Failed deliveries can be retried with the same event id."
        bodyClassName=""
        actions={<FilterDropdown label="Status" value={filters.status ?? ''} onChange={(v) => setFilters({ status: v })} options={toOptions(DELIVERY_STATUSES)} className="w-40" />}
      >
        <DataTable
          caption="Webhook deliveries"
          loading={deliveries.isLoading}
          error={deliveries.error}
          onRetry={deliveries.refetch}
          rows={deliveries.data?.data ?? []}
          empty={<EmptyState icon={Webhook} title="No deliveries yet" description="Events appear here when tickets are created or updated." />}
          columns={[
            { key: 'event', header: 'Event', render: (d) => <div className="min-w-[10rem]"><p className="font-mono text-xs text-slate-900">{d.eventType}</p><p className="text-xs text-slate-500">{d.ticketNumber ?? d.resourceType}</p></div> },
            { key: 'status', header: 'Status', render: (d) => <DeliveryStatusBadge status={d.status} /> },
            { key: 'attempts', header: 'Attempts', className: 'hidden sm:table-cell tabular-nums', render: (d) => `${d.attempts}/${d.maxAttempts}` },
            { key: 'error', header: 'Last result', className: 'hidden md:table-cell', render: (d) => <span className={`line-clamp-2 max-w-xs text-xs ${d.lastError ? 'text-red-600' : 'text-slate-500'}`}>{d.lastError ?? (d.lastStatusCode ? `HTTP ${d.lastStatusCode}` : '—')}</span> },
            { key: 'time', header: 'Created', className: 'hidden lg:table-cell whitespace-nowrap text-xs', render: (d) => formatDateTime(d.createdAt) },
            {
              key: 'retry',
              header: <span className="sr-only">Actions</span>,
              className: 'text-right',
              render: (d) =>
                ['failed', 'skipped'].includes(d.status) && webhook.configured ? (
                  <Button size="sm" variant="secondary" icon={RotateCw} loading={retry.isPending && retry.variables === d.id} onClick={() => retry.mutate(d.id)}>
                    Retry
                  </Button>
                ) : null,
            },
          ]}
        />
        <Pagination meta={deliveries.data?.meta} onPageChange={(page) => setFilters({ page })} />
      </Card>
    </div>
  );
}
