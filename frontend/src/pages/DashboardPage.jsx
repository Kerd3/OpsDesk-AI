import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Users, Ticket, CircleDot, Loader, CheckCircle2, Timer, Inbox, UserCheck, AlertTriangle, Hourglass, Sparkles, BookOpen, Laptop, ArrowRight, Plus } from 'lucide-react';
import { dashboardApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { PageHeader, Card, DashboardCard } from '../components/ui/Layout.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';
import { ErrorState, EmptyState, Skeleton } from '../components/ui/States.jsx';
import { DataTable } from '../components/ui/DataTable.jsx';
import { ticketColumns, TicketCard, ActivityFeed } from '../components/tickets/TicketParts.jsx';
import { TICKET_CATEGORIES, ASSET_STATUSES } from '../utils/labels.js';
import { formatHours } from '../utils/format.js';
import { CategoryBarChart, DonutChart } from '../components/charts/Charts.jsx';


const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function DashboardPage() {
  const { user } = useAuth();
  useBreadcrumbs([{ label: 'Dashboard' }]);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });

  const header = (
    <PageHeader
      title={`${greeting()}, ${user.fullName.split(' ')[0]}`}
      description={user.role === 'employee' ? 'Track your requests and get help fast.' : user.role === 'it_support' ? 'Here is what needs your attention today.' : 'An overview of IT support across the organization.'}
      actions={
        <>
          <ButtonLink to="/assistant" variant="secondary" icon={Sparkles}>
            Ask AI
          </ButtonLink>
          <ButtonLink to="/tickets/new" icon={Plus}>
            New ticket
          </ButtonLink>
        </>
      }
    />
  );

  if (error)
    return (
      <>
        {header}
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      </>
    );

  return (
    <>
      {header}
      {user.role === 'admin' && <AdminDashboard data={data} loading={isLoading} />}
      {user.role === 'it_support' && <SupportDashboard data={data} loading={isLoading} />}
      {user.role === 'employee' && <EmployeeDashboard data={data} loading={isLoading} />}
    </>
  );
}

function ChartFallback() {
  return <Skeleton className="h-56 w-full" />;
}

function AdminDashboard({ data, loading }) {
  const s = data?.stats ?? {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <DashboardCard loading={loading} label="Total employees" value={s.totalEmployees} icon={Users} accent="slate" to="/admin/users?role=employee" />
        <DashboardCard loading={loading} label="Total tickets" value={s.totalTickets} icon={Ticket} to="/tickets" />
        <DashboardCard loading={loading} label="Open" value={s.openTickets} icon={CircleDot} accent="blue" hint={s.unassignedTickets != null ? `${s.unassignedTickets} unassigned` : undefined} to="/tickets?status=open" />
        <DashboardCard loading={loading} label="In progress" value={s.inProgressTickets} icon={Loader} accent="amber" hint={s.waitingTickets != null ? `${s.waitingTickets} waiting on employees` : undefined} to="/tickets?status=in_progress" />
        <DashboardCard loading={loading} label="Resolved" value={s.resolvedTickets} icon={CheckCircle2} accent="green" to="/tickets?status=resolved,closed" />
        <DashboardCard loading={loading} label="Avg. resolution time" value={formatHours(s.averageResolutionHours)} icon={Timer} accent="brand" hint="All resolved tickets" to="/reports" />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Tickets by category" className="xl:col-span-3">
          {loading ? <ChartFallback /> : <CategoryBarChart rows={data.ticketsByCategory} labels={TICKET_CATEGORIES} />}
        </Card>
        <Card title="IT assets" description="Equipment by status" className="xl:col-span-2" actions={<Link to="/assets" className="text-xs font-medium text-brand-700 hover:underline">View all</Link>}>
          {loading ? <ChartFallback /> : <DonutChart rows={data.assetsByStatus} labels={ASSET_STATUSES} height={200} />}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Latest tickets" className="xl:col-span-3" bodyClassName="" actions={<Link to="/tickets" className="text-xs font-medium text-brand-700 hover:underline">All tickets</Link>}>
          <DataTable columns={ticketColumns({ showRequester: false, showUpdated: false })} rows={data?.recentTickets ?? []} loading={loading} caption="Latest tickets" />
        </Card>
        <Card title="Recent support activity" className="xl:col-span-2" bodyClassName="px-4 py-1">
          {loading ? <Skeleton className="my-4 h-40 w-full" /> : <ActivityFeed items={data.recentActivity} />}
        </Card>
      </div>
    </div>
  );
}

function SupportDashboard({ data, loading }) {
  const s = data?.stats ?? {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <DashboardCard loading={loading} label="Assigned to me" value={s.assignedTickets} icon={UserCheck} to="/tickets?scope=assigned&status=open,in_progress,waiting_for_employee" />
        <DashboardCard loading={loading} label="Unassigned" value={s.unassignedTickets} icon={Inbox} accent="blue" to="/tickets?scope=unassigned&status=open,in_progress,waiting_for_employee" />
        <DashboardCard loading={loading} label="Urgent" value={s.urgentTickets} icon={AlertTriangle} accent="red" to="/tickets?priority=urgent&status=open,in_progress,waiting_for_employee" />
        <DashboardCard loading={loading} label="Waiting on employee" value={s.pendingTickets} icon={Hourglass} accent="amber" to="/tickets?scope=assigned&status=waiting_for_employee" />
        <DashboardCard loading={loading} label="Resolved by me" value={s.resolvedTickets} icon={CheckCircle2} accent="green" hint={s.resolvedThisWeek != null ? `${s.resolvedThisWeek} this week` : undefined} to="/tickets?scope=assigned&status=resolved,closed" />
      </div>
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Active queue" description="Your tickets and unassigned requests, highest priority first" className="xl:col-span-3" bodyClassName="" actions={<Link to="/tickets?status=open,in_progress,waiting_for_employee" className="text-xs font-medium text-brand-700 hover:underline">Open queue</Link>}>
          <DataTable
            columns={ticketColumns({ showRequester: false, showUpdated: false })}
            rows={data?.queue ?? []}
            loading={loading}
            caption="Active queue"
            empty={<EmptyState icon={CheckCircle2} title="Queue is clear" description="No active tickets are waiting for you." />}
          />
        </Card>
        <Card title="Recent ticket activity" className="xl:col-span-2" bodyClassName="px-4 py-1">
          {loading ? <Skeleton className="my-4 h-40 w-full" /> : <ActivityFeed items={data.recentActivity} />}
        </Card>
      </div>
    </div>
  );
}

function EmployeeDashboard({ data, loading }) {
  const s = data?.stats ?? {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <DashboardCard loading={loading} label="My open tickets" value={s.openTickets} icon={CircleDot} accent="blue" to="/my-tickets?status=open,in_progress" />
        <DashboardCard loading={loading} label="Waiting on me" value={s.pendingTickets} icon={Hourglass} accent="amber" hint="IT needs your reply" to="/my-tickets?status=waiting_for_employee" />
        <DashboardCard loading={loading} label="Resolved" value={s.resolvedTickets} icon={CheckCircle2} accent="green" to="/my-tickets?status=resolved,closed" />
        <DashboardCard loading={loading} label="My equipment" value={s.assignedAssets} icon={Laptop} accent="slate" to="/assets" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card relative overflow-hidden p-6">
          <div className="absolute -top-10 -right-10 size-40 rounded-full bg-brand-50" aria-hidden="true" />
          <div className="relative">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-700">
              <Sparkles className="size-5 text-white" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">Have an IT problem?</h2>
            <p className="mt-1 text-sm text-slate-500">Describe it to the AI assistant. It answers from approved company articles and can draft a ticket for you.</p>
            <ButtonLink to="/assistant" className="mt-5" icon={Sparkles}>
              Ask the AI assistant
            </ButtonLink>
          </div>
        </div>

        <Card title="My recent requests" className="xl:col-span-2" bodyClassName="p-2" actions={<Link to="/my-tickets" className="text-xs font-medium text-brand-700 hover:underline">View all</Link>}>
          {loading ? (
            <div className="space-y-3 p-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : data.recentTickets.length ? (
            <div className="divide-y divide-slate-100">{data.recentTickets.map((t) => <TicketCard key={t.id} ticket={t} />)}</div>
          ) : (
            <EmptyState icon={Ticket} title="No tickets yet" description="When you report a problem it will show up here." action={<ButtonLink to="/tickets/new" size="sm" icon={Plus}>Create a ticket</ButtonLink>} />
          )}
        </Card>
      </div>

      <Card title="Popular help articles" bodyClassName="p-2" actions={<Link to="/knowledge-base" className="text-xs font-medium text-brand-700 hover:underline">Knowledge base</Link>}>
        {loading ? (
          <Skeleton className="m-3 h-24" />
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {data.popularArticles.map((a) => (
              <li key={a.id}>
                <Link to={`/knowledge-base/${a.slug}`} className="group flex items-start gap-3 rounded-lg p-3 hover:bg-slate-50">
                  <BookOpen className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 group-hover:text-brand-700">{a.title}</span>
                    <span className="line-clamp-1 text-xs text-slate-500">{a.description}</span>
                  </span>
                  <ArrowRight className="ml-auto size-4 shrink-0 text-slate-300 group-hover:text-brand-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
