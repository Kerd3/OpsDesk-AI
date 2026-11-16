import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ScrollText, ShieldCheck } from 'lucide-react';
import { adminApi } from '../api/endpoints.js';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { useUrlFilters, useDebouncedFilter } from '../hooks/useUrlFilters.js';
import { PageHeader, Card } from '../components/ui/Layout.jsx';
import { SearchInput, FilterDropdown, Input } from '../components/ui/Form.jsx';
import { DataTable, Pagination } from '../components/ui/DataTable.jsx';
import { Badge, RoleBadge } from '../components/ui/Badges.jsx';
import { EmptyState, Alert } from '../components/ui/States.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { formatDateTime } from '../utils/format.js';

const RESOURCE_TYPES = [
  { value: 'session', label: 'Sign-in' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'kb_article', label: 'Knowledge base' },
  { value: 'asset', label: 'Asset' },
  { value: 'user', label: 'User' },
  { value: 'system_setting', label: 'Settings' },
  { value: 'webhook_delivery', label: 'Integration' },
];
const toneFor = (action) => (action.includes('failed') || action.includes('deactivated') || action.includes('deleted') ? 'red' : action.startsWith('auth') ? 'gray' : action.includes('created') ? 'green' : 'indigo');

export default function AuditLogsPage() {
  useBreadcrumbs([{ label: 'Audit Logs' }]);
  const [filters, setFilters] = useUrlFilters();
  const [search, setSearch] = useDebouncedFilter(filters, setFilters);
  const [selected, setSelected] = useState(null);
  const params = { search: filters.search, action: filters.action, resourceType: filters.resourceType, from: filters.from, to: filters.to, page: filters.page, pageSize: 25 };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['audit', params], queryFn: () => adminApi.auditLogs(params), placeholderData: keepPreviousData });
  const { data: actions = [] } = useQuery({ queryKey: ['audit-actions'], queryFn: adminApi.auditActions });

  const columns = [
    { key: 'time', header: 'Time', className: 'whitespace-nowrap', render: (e) => <span className="text-slate-600">{formatDateTime(e.createdAt)}</span> },
    { key: 'action', header: 'Action', render: (e) => <Badge tone={toneFor(e.action)}><span className="font-mono">{e.action}</span></Badge> },
    {
      key: 'actor',
      header: 'Actor',
      render: (e) =>
        e.actor ? (
          <div className="min-w-[10rem]">
            <p className="text-sm text-slate-900">{e.actor.fullName}</p>
            <p className="text-xs text-slate-500">{e.actor.email}</p>
          </div>
        ) : (
          <span className="text-slate-400">System / unknown</span>
        ),
    },
    { key: 'resource', header: 'Resource', className: 'hidden md:table-cell', render: (e) => <span className="text-slate-600">{e.resourceType}{e.metadata?.ticketNumber ? ` · ${e.metadata.ticketNumber}` : e.metadata?.assetTag ? ` · ${e.metadata.assetTag}` : e.metadata?.title ? ` · ${e.metadata.title}` : ''}</span> },
  ];

  return (
    <>
      <PageHeader title="Audit logs" description="An append-only record of sign-ins and changes. Entries cannot be edited or deleted." />
      <Card bodyClassName="">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search action, person or resource id…" label="Search audit logs" className="lg:max-w-xs lg:flex-1" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <FilterDropdown label="Action" value={filters.action ?? ''} onChange={(v) => setFilters({ action: v })} options={actions.map((a) => ({ value: a, label: a }))} className="sm:w-56" />
            <FilterDropdown label="Resource" value={filters.resourceType ?? ''} onChange={(v) => setFilters({ resourceType: v })} options={RESOURCE_TYPES} className="sm:w-44" />
            <div className="col-span-2 flex items-center gap-2">
              <label htmlFor="afrom" className="sr-only">From</label>
              <Input id="afrom" type="date" value={filters.from ?? ''} onChange={(e) => setFilters({ from: e.target.value })} className="h-9 py-1.5" />
              <span className="text-xs text-slate-400">to</span>
              <label htmlFor="ato" className="sr-only">To</label>
              <Input id="ato" type="date" value={filters.to ?? ''} onChange={(e) => setFilters({ to: e.target.value })} className="h-9 py-1.5" />
            </div>
          </div>
        </div>
        <DataTable caption="Audit log entries" columns={columns} rows={data?.data ?? []} loading={isLoading} error={error} onRetry={refetch} onRowClick={setSelected} empty={<EmptyState icon={ScrollText} title="No audit entries match" />} />
        <Pagination meta={data?.meta} onPageChange={(page) => setFilters({ page })} />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Audit entry" description={selected ? formatDateTime(selected.createdAt) : ''} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={toneFor(selected.action)}><span className="font-mono">{selected.action}</span></Badge>
              {selected.actor && <RoleBadge role={selected.actor.role} />}
            </div>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <dt className="text-slate-500">Actor</dt>
              <dd className="col-span-2">{selected.actor ? `${selected.actor.fullName} (${selected.actor.email})` : '—'}</dd>
              <dt className="text-slate-500">Resource</dt>
              <dd className="col-span-2 font-mono text-xs break-all">{selected.resourceType} {selected.resourceId}</dd>
            </dl>
            <div>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Metadata</p>
              <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(selected.metadata, null, 2)}</pre>
            </div>
            <Alert tone="info" icon={ShieldCheck}>
              Audit metadata never includes passwords, tokens or message contents.
            </Alert>
          </div>
        )}
      </Modal>
    </>
  );
}
