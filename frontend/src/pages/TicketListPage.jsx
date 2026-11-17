import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Plus, Ticket, X } from 'lucide-react';
import { ticketsApi } from '../api/endpoints.js';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useUrlFilters, useDebouncedFilter } from '../hooks/useUrlFilters.js';
import { PageHeader, Card, Tabs } from '../components/ui/Layout.jsx';
import { ButtonLink, Button } from '../components/ui/Button.jsx';
import { SearchInput, FilterDropdown, Input } from '../components/ui/Form.jsx';
import { DataTable, Pagination } from '../components/ui/DataTable.jsx';
import { EmptyState } from '../components/ui/States.jsx';
import { ticketColumns } from '../components/tickets/TicketParts.jsx';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, toOptions } from '../utils/labels.js';

const ACTIVE = 'open,in_progress,waiting_for_employee';
const STATUS_OPTIONS = [{ value: ACTIVE, label: 'All active' }, ...toOptions(TICKET_STATUSES), { value: 'resolved,closed', label: 'Resolved & closed' }];

export default function TicketListPage({ scope }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMine = scope === 'mine';
  useBreadcrumbs([{ label: isMine ? 'My tickets' : 'All tickets' }]);

  const [filters, setFilters] = useUrlFilters({ sort: 'updated', order: 'desc' });
  const [search, setSearch] = useDebouncedFilter(filters, setFilters);
  const effectiveScope = isMine ? 'mine' : filters.scope ?? 'all';

  const params = {
    scope: effectiveScope,
    status: filters.status,
    priority: filters.priority,
    category: filters.category,
    from: filters.from,
    to: filters.to,
    search: filters.search,
    sort: filters.sort,
    order: filters.order,
    page: filters.page,
    pageSize: 15,
  };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['tickets', params],
    queryFn: () => ticketsApi.list(params),
    placeholderData: keepPreviousData,
  });

  const hasFilters = ['status', 'priority', 'category', 'from', 'to', 'search'].some((k) => filters[k]);
  const clear = () => {
    setSearch('');
    setFilters({ status: '', priority: '', category: '', from: '', to: '', search: '' });
  };

  const scopeTabs =
    user.role === 'it_support'
      ? [
          { value: 'all', label: 'My queue' },
          { value: 'assigned', label: 'Assigned to me' },
          { value: 'unassigned', label: 'Unassigned' },
        ]
      : [
          { value: 'all', label: 'All tickets' },
          { value: 'assigned', label: 'Assigned to me' },
          { value: 'unassigned', label: 'Unassigned' },
        ];

  return (
    <>
      <PageHeader
        title={isMine ? 'My tickets' : 'All tickets'}
        description={isMine ? 'Support requests you have submitted.' : user.role === 'admin' ? 'Every support request in the organization.' : 'Tickets assigned to you and unassigned requests you can accept.'}
        actions={
          <ButtonLink to="/tickets/new" icon={Plus}>
            New ticket
          </ButtonLink>
        }
      />
      {!isMine && (
        <div className="mb-4">
          <Tabs label="Ticket scope" tabs={scopeTabs} value={filters.scope ?? 'all'} onChange={(v) => setFilters({ scope: v === 'all' ? '' : v })} />
        </div>
      )}
      <Card bodyClassName="">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search subject, description or ticket ID…" label="Search tickets" className="w-full md:w-auto md:min-w-[16rem] md:flex-1" />
          <FilterDropdown label="Status" value={filters.status ?? ''} onChange={(v) => setFilters({ status: v })} options={STATUS_OPTIONS} className="w-[calc(50%-0.25rem)] sm:w-44" />
          <FilterDropdown label="Priority" value={filters.priority ?? ''} onChange={(v) => setFilters({ priority: v })} options={toOptions(TICKET_PRIORITIES)} className="w-[calc(50%-0.25rem)] sm:w-40" />
          <FilterDropdown label="Category" value={filters.category ?? ''} onChange={(v) => setFilters({ category: v })} options={toOptions(TICKET_CATEGORIES)} className="w-full sm:w-48" />
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="sr-only" htmlFor="from">Created from</label>
            <Input id="from" type="date" value={filters.from ?? ''} onChange={(e) => setFilters({ from: e.target.value })} className="h-9 py-1.5" title="Created from" />
            <span className="text-xs text-slate-500">to</span>
            <label className="sr-only" htmlFor="to">Created to</label>
            <Input id="to" type="date" value={filters.to ?? ''} onChange={(e) => setFilters({ to: e.target.value })} className="h-9 py-1.5" title="Created to" />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" icon={X} onClick={clear}>
              Clear
            </Button>
          )}
        </div>
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}>
          <DataTable
            caption="Tickets"
            columns={ticketColumns({ showRequester: !isMine, showAssignee: true })}
            rows={data?.data ?? []}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            onRowClick={(t) => navigate(`/tickets/${t.id}`)}
            sort={{ key: filters.sort, order: filters.order }}
            onSortChange={({ key, order }) => setFilters({ sort: key, order })}
            empty={
              hasFilters ? (
                <EmptyState title="No tickets match your filters" description="Try removing a filter or searching for something else." action={<Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button>} />
              ) : (
                <EmptyState icon={Ticket} title="No tickets yet" description={isMine ? 'When you report a problem, it will appear here.' : 'New support requests will appear here.'} action={<ButtonLink to="/tickets/new" size="sm" icon={Plus}>New ticket</ButtonLink>} />
              )
            }
          />
        </div>
        <Pagination meta={data?.meta} onPageChange={(page) => setFilters({ page })} />
      </Card>
    </>
  );
}
