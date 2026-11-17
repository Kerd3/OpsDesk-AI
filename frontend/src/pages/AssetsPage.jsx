import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { Plus, Laptop, X } from 'lucide-react';
import { assetsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { useUrlFilters, useDebouncedFilter } from '../hooks/useUrlFilters.js';
import { PageHeader, Card } from '../components/ui/Layout.jsx';
import { Button } from '../components/ui/Button.jsx';
import { SearchInput, FilterDropdown } from '../components/ui/Form.jsx';
import { DataTable, Pagination } from '../components/ui/DataTable.jsx';
import { AssetStatusBadge } from '../components/ui/Badges.jsx';
import { EmptyState } from '../components/ui/States.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { AssetForm } from '../components/assets/AssetForm.jsx';
import { PersonCell } from '../components/tickets/TicketParts.jsx';
import { ASSET_CATEGORIES, ASSET_STATUSES, ASSET_CONDITIONS, toOptions } from '../utils/labels.js';
import { formatDate } from '../utils/format.js';

export default function AssetsPage() {
  const { isStaff } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  useBreadcrumbs([{ label: isStaff ? 'IT assets' : 'My equipment' }]);

  const [filters, setFilters] = useUrlFilters();
  const [search, setSearch] = useDebouncedFilter(filters, setFilters);
  const params = { search: filters.search, category: filters.category, status: filters.status, page: filters.page, pageSize: 15 };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['assets', params], queryFn: () => assetsApi.list(params), placeholderData: keepPreviousData });
  const hasFilters = filters.search || filters.category || filters.status;

  const create = async (body) => {
    const asset = await assetsApi.create(body).catch((err) => {
      toast.error(err.message);
      throw err;
    });
    await queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    toast.success(`${asset.assetTag} registered`);
    setCreating(false);
  };

  const columns = [
    {
      key: 'name',
      header: 'Asset',
      render: (a) => (
        <div className="min-w-[12rem]">
          <Link to={`/assets/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-900 hover:text-brand-700">
            {a.name}
          </Link>
          <p className="text-xs text-slate-500">
            <span className="font-mono">{a.assetTag}</span> · {ASSET_CATEGORIES[a.category]}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (a) => <AssetStatusBadge status={a.status} /> },
    ...(isStaff ? [{ key: 'assigned', header: 'Assigned to', className: 'hidden md:table-cell', render: (a) => (a.assignedTo ? <PersonCell person={a.assignedTo} sub={a.assignedTo.department} /> : <span className="text-slate-500">—</span>) }] : []),
    { key: 'model', header: 'Model', className: 'hidden lg:table-cell', render: (a) => [a.manufacturer, a.model].filter(Boolean).join(' ') || '—' },
    { key: 'serial', header: 'Serial', className: 'hidden xl:table-cell font-mono text-xs', render: (a) => a.serialNumber ?? '—' },
    { key: 'location', header: 'Location', className: 'hidden lg:table-cell', render: (a) => a.location ?? '—' },
    { key: 'condition', header: 'Condition', className: 'hidden sm:table-cell', render: (a) => ASSET_CONDITIONS[a.condition] },
    { key: 'purchased', header: 'Purchased', className: 'hidden xl:table-cell whitespace-nowrap', render: (a) => formatDate(a.purchaseDate) },
  ];

  return (
    <>
      <PageHeader
        title={isStaff ? 'IT assets' : 'My equipment'}
        description={isStaff ? 'Company hardware, who has it, and its condition.' : 'Company equipment currently assigned to you. Report a problem with any device by creating a ticket.'}
        actions={
          isStaff && (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              Register asset
            </Button>
          )
        }
      />
      <Card bodyClassName="">
        {isStaff && (
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="Search tag, name, serial or person…" label="Search assets" className="sm:max-w-sm sm:flex-1" />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <FilterDropdown label="Category" value={filters.category ?? ''} onChange={(v) => setFilters({ category: v })} options={toOptions(ASSET_CATEGORIES)} className="sm:w-40" />
              <FilterDropdown label="Status" value={filters.status ?? ''} onChange={(v) => setFilters({ status: v })} options={toOptions(ASSET_STATUSES)} className="sm:w-48" />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" icon={X} onClick={() => { setSearch(''); setFilters({ search: '', category: '', status: '' }); }}>
                Clear
              </Button>
            )}
          </div>
        )}
        <DataTable
          caption="IT assets"
          columns={columns}
          rows={data?.data ?? []}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          onRowClick={(a) => navigate(`/assets/${a.id}`)}
          empty={<EmptyState icon={Laptop} title={hasFilters ? 'No assets match your filters' : isStaff ? 'No assets registered' : 'No equipment assigned to you'} description={isStaff ? undefined : 'If you were issued equipment that is not listed, let IT know.'} />}
        />
        <Pagination meta={data?.meta} onPageChange={(page) => setFilters({ page })} />
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Register asset" description="A unique asset tag is generated automatically." size="lg">
        <AssetForm onSubmit={create} onCancel={() => setCreating(false)} submitLabel="Register asset" />
      </Modal>
    </>
  );
}
