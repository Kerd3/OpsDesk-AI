import { useQuery } from '@tanstack/react-query';
import { Ticket, CircleDot, CheckCircle2, Timer, AlertTriangle, Inbox } from 'lucide-react';
import { reportsApi } from '../api/endpoints.js';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import { PageHeader, Card, DashboardCard } from '../components/ui/Layout.jsx';
import { Input, Select } from '../components/ui/Form.jsx';
import { DataTable } from '../components/ui/DataTable.jsx';
import { ErrorState, Skeleton } from '../components/ui/States.jsx';
import { CategoryBarChart, DonutChart, TrendLineChart, CHART_COLORS } from '../components/charts/Charts.jsx';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, ASSET_CATEGORIES, ROLES } from '../utils/labels.js';
import { formatHours, daysAgo, isoDate } from '../utils/format.js';

const PRESETS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
];
// Fixed colours so priority/status read consistently across charts.
const PRIORITY_COLORS = ['#94a3b8', '#0ea5e9', '#f59e0b', '#ef4444'];

export default function ReportsPage() {
  useBreadcrumbs([{ label: 'Reports' }]);
  const [filters, setFilters] = useUrlFilters({ range: '30' });
  const custom = filters.range === 'custom';
  const range = custom ? { from: filters.from, to: filters.to } : { from: daysAgo(Number(filters.range) - 1), to: isoDate(new Date()) };
  const params = { ...range, interval: filters.interval };

  const summary = useQuery({ queryKey: ['reports', 'summary', params], queryFn: () => reportsApi.summary(range) });
  const report = useQuery({ queryKey: ['reports', 'tickets', params], queryFn: () => reportsApi.tickets(params) });
  const error = summary.error ?? report.error;
  const s = summary.data;
  const r = report.data;

  // Present priorities in their natural order with fixed colours.
  const priorityRows = r ? ['low', 'medium', 'high', 'urgent'].map((k) => ({ key: k, count: r.byPriority.find((p) => p.key === k)?.count ?? 0 })).filter((p) => p.count) : [];
  const priorityColors = priorityRows.map((p) => PRIORITY_COLORS[['low', 'medium', 'high', 'urgent'].indexOf(p.key)]);

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        description="Calculated live from ticket and asset records."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="range" className="sr-only">Date range</label>
            <Select id="range" value={filters.range} onChange={(e) => setFilters({ range: e.target.value })} options={PRESETS} className="h-9 w-44 py-1.5" />
            {custom && (
              <>
                <label htmlFor="rfrom" className="sr-only">From</label>
                <Input id="rfrom" type="date" value={filters.from ?? ''} onChange={(e) => setFilters({ from: e.target.value })} className="h-9 w-auto py-1.5" />
                <label htmlFor="rto" className="sr-only">To</label>
                <Input id="rto" type="date" value={filters.to ?? ''} onChange={(e) => setFilters({ to: e.target.value })} className="h-9 w-auto py-1.5" />
              </>
            )}
            <label htmlFor="interval" className="sr-only">Trend interval</label>
            <Select id="interval" value={filters.interval ?? ''} onChange={(e) => setFilters({ interval: e.target.value })} placeholder="Auto interval" options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} className="h-9 w-36 py-1.5" />
          </div>
        }
      />

      {error ? (
        <Card>
          <ErrorState error={error} onRetry={() => { summary.refetch(); report.refetch(); }} />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            <DashboardCard loading={!s} label="Tickets created" value={s?.tickets.total} icon={Ticket} />
            <DashboardCard loading={!s} label="Still open" value={s ? s.tickets.open + s.tickets.inProgress + s.tickets.waiting : null} icon={CircleDot} accent="blue" />
            <DashboardCard loading={!s} label="Resolved" value={s?.tickets.resolved} icon={CheckCircle2} accent="green" />
            <DashboardCard loading={!s} label="Avg. resolution" value={formatHours(s?.resolution.averageHours)} icon={Timer} accent="brand" hint={s ? `Median ${formatHours(s.resolution.medianHours)} · ${s.resolution.resolvedCount} resolved` : undefined} />
            <DashboardCard loading={!s} label="Urgent open" value={s?.tickets.urgentOpen} icon={AlertTriangle} accent="red" />
            <DashboardCard loading={!s} label="Unassigned" value={s?.tickets.unassigned} icon={Inbox} accent="amber" />
          </div>

          <Card title="Ticket trend" description={r ? `Created vs. resolved per ${r.range.interval}` : undefined}>
            {r ? <TrendLineChart rows={r.trend} /> : <Skeleton className="h-64" />}
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Tickets by category">{r ? <CategoryBarChart rows={r.byCategory} labels={TICKET_CATEGORIES} /> : <Skeleton className="h-60" />}</Card>
            <Card title="Tickets by priority">{r ? <DonutChart rows={priorityRows} labels={TICKET_PRIORITIES} colors={priorityColors} /> : <Skeleton className="h-60" />}</Card>
            <Card title="Tickets by status">{r ? <CategoryBarChart rows={r.byStatus} labels={TICKET_STATUSES} layout="horizontal" color={CHART_COLORS[1]} /> : <Skeleton className="h-60" />}</Card>
            <Card title="Asset distribution" description="All registered assets by category">{r ? <DonutChart rows={r.assets.byCategory} labels={ASSET_CATEGORIES} /> : <Skeleton className="h-60" />}</Card>
          </div>

          <Card title="Tickets per IT staff member" description="Tickets created in the selected period, by current assignee" bodyClassName="">
            <DataTable
              caption="Tickets per IT staff member"
              loading={!r}
              rows={r?.perStaff ?? []}
              columns={[
                { key: 'name', header: 'Staff member', render: (p) => <span className="font-medium text-slate-900">{p.fullName}</span> },
                { key: 'role', header: 'Role', className: 'hidden sm:table-cell', render: (p) => ROLES[p.role] },
                { key: 'assigned', header: 'Assigned', className: 'text-right tabular-nums', render: (p) => p.assigned },
                { key: 'active', header: 'Active', className: 'text-right tabular-nums', render: (p) => p.active },
                { key: 'resolved', header: 'Resolved', className: 'text-right tabular-nums', render: (p) => p.resolved },
                { key: 'avg', header: 'Avg. resolution', className: 'hidden md:table-cell text-right tabular-nums', render: (p) => formatHours(p.averageResolutionHours) },
              ]}
            />
          </Card>
        </div>
      )}
    </>
  );
}
