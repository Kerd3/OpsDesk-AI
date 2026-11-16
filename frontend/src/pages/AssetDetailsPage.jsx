import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Wrench, LifeBuoy, History } from 'lucide-react';
import { assetsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { useApiMutation } from '../hooks/useApiMutation.js';
import { PageHeader, Card, DescriptionList } from '../components/ui/Layout.jsx';
import { Button, ButtonLink } from '../components/ui/Button.jsx';
import { AssetStatusBadge, Badge } from '../components/ui/Badges.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { AssetForm } from '../components/assets/AssetForm.jsx';
import { PersonCell } from '../components/tickets/TicketParts.jsx';
import { ASSET_CATEGORIES, ASSET_CONDITIONS, describeAssetEvent } from '../utils/labels.js';
import { formatDate, formatDateTime } from '../utils/format.js';

export default function AssetDetailsPage() {
  const { id } = useParams();
  const { isStaff } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data: asset, isLoading, error, refetch } = useQuery({ queryKey: ['asset', id], queryFn: () => assetsApi.get(id) });
  useBreadcrumbs([{ label: isStaff ? 'IT Assets' : 'My Equipment', to: '/assets' }, { label: asset?.assetTag ?? 'Asset' }]);

  const invalidate = [['asset', id], ['assets'], ['dashboard']];
  const maintenance = useApiMutation((status) => assetsApi.update(id, { status }), { invalidate, successMessage: (a) => (a.status === 'under_maintenance' ? 'Asset marked as under maintenance' : 'Asset is available again') });

  if (isLoading) return <LoadingSpinner label="Loading asset…" />;
  if (error) return <Card><ErrorState error={error} onRetry={refetch} /></Card>;

  const save = async (body) => {
    await assetsApi.update(id, body).catch((err) => {
      toast.error(err.message);
      throw err;
    });
    await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    toast.success('Asset updated');
    setEditing(false);
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-slate-500">{asset.assetTag}</span>
            <AssetStatusBadge status={asset.status} />
          </div>
        }
        title={asset.name}
        description={[asset.manufacturer, asset.model].filter(Boolean).join(' ') || ASSET_CATEGORIES[asset.category]}
        actions={
          isStaff ? (
            <>
              {asset.status !== 'retired' && (
                <Button variant="secondary" icon={Wrench} loading={maintenance.isPending} onClick={() => maintenance.mutate(asset.status === 'under_maintenance' ? 'available' : 'under_maintenance')}>
                  {asset.status === 'under_maintenance' ? 'Mark available' : 'Send to maintenance'}
                </Button>
              )}
              <Button icon={Pencil} onClick={() => setEditing(true)}>
                Edit / assign
              </Button>
            </>
          ) : (
            <ButtonLink to="/tickets/new" icon={LifeBuoy}>
              Report a problem
            </ButtonLink>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2">
          <DescriptionList
            items={[
              ['Category', ASSET_CATEGORIES[asset.category]],
              ['Manufacturer', asset.manufacturer],
              ['Model', asset.model],
              ['Serial number', asset.serialNumber && <span className="font-mono text-sm">{asset.serialNumber}</span>],
              ['Condition', <Badge key="c" tone={['poor', 'damaged'].includes(asset.condition) ? 'red' : 'gray'}>{ASSET_CONDITIONS[asset.condition]}</Badge>],
              ['Location', asset.location],
              ['Purchase date', formatDate(asset.purchaseDate)],
              ['Notes', asset.notes && <span className="whitespace-pre-wrap">{asset.notes}</span>],
            ]}
          />
        </Card>
        <div className="space-y-6">
          <Card title="Assigned to">{asset.assignedTo ? <PersonCell person={asset.assignedTo} sub={asset.assignedTo.email} /> : <p className="text-sm text-slate-500">Not assigned</p>}</Card>
          {isStaff && (
            <Card title="History" bodyClassName="p-0">
              {asset.history.length ? (
                <ol className="divide-y divide-slate-100">
                  {asset.history.map((h) => (
                    <li key={h.id} className="px-5 py-3">
                      <p className="text-sm text-slate-700">
                        <span className="font-medium text-slate-900">{h.actorName ?? 'System'}</span> {describeAssetEvent(h)}
                      </p>
                      <time className="text-xs text-slate-500">{formatDateTime(h.createdAt)}</time>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState icon={History} title="No history" />
              )}
            </Card>
          )}
        </div>
      </div>
      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${asset.assetTag}`} size="lg">
        <AssetForm asset={asset} onSubmit={save} onCancel={() => setEditing(false)} />
      </Modal>
    </>
  );
}
