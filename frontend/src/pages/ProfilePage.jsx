import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Save, Laptop } from 'lucide-react';
import { authApi, assetsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { useApiMutation, applyFieldErrors } from '../hooks/useApiMutation.js';
import { PageHeader, Card, Avatar, DescriptionList } from '../components/ui/Layout.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, Input } from '../components/ui/Form.jsx';
import { RoleBadge, AssetStatusBadge } from '../components/ui/Badges.jsx';
import { Skeleton } from '../components/ui/States.jsx';
import { formatDate, formatDateTime } from '../utils/format.js';
import { ASSET_CATEGORIES } from '../utils/labels.js';

export default function ProfilePage() {
  useBreadcrumbs([{ label: 'Profile' }]);
  const { user, setUser } = useAuth();
  const { register, handleSubmit, setError, reset, formState: { errors, isDirty } } = useForm({ values: { fullName: user.fullName, department: user.department ?? '', jobTitle: user.jobTitle ?? '' } });
  const save = useApiMutation(authApi.updateProfile, {
    successMessage: 'Profile updated',
    onSuccess: (data) => {
      setUser(data.user);
      reset({ fullName: data.user.fullName, department: data.user.department ?? '', jobTitle: data.user.jobTitle ?? '' });
    },
    onError: (err) => applyFieldErrors(err, setError),
  });
  const assets = useQuery({ queryKey: ['assets', { mine: true }], queryFn: () => assetsApi.list({ assignedToId: user.role === 'employee' ? undefined : user.id, pageSize: 10 }) });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Your profile" description="How you appear to IT staff and colleagues in OpsDesk." />
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar name={user.fullName} size="lg" />
            <p className="mt-3 font-semibold text-slate-900">{user.fullName}</p>
            <p className="text-sm break-all text-slate-500">{user.email}</p>
            <div className="mt-3">
              <RoleBadge role={user.role} />
            </div>
          </div>
          <div className="mt-6">
            <DescriptionList
              items={[
                ['Member since', formatDate(user.createdAt)],
                ['Last sign-in', formatDateTime(user.lastLoginAt)],
              ]}
            />
          </div>
        </Card>
        <div className="space-y-6 md:col-span-2">
          <Card title="Personal details">
            <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
              <Field label="Full name" error={errors.fullName?.message}>
                {(a) => <Input {...a} invalid={!!errors.fullName} {...register('fullName', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })} />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Department">{(a) => <Input {...a} {...register('department')} />}</Field>
                <Field label="Job title">{(a) => <Input {...a} {...register('jobTitle')} />}</Field>
              </div>
              <Field label="Email" hint="Contact an administrator to change your email address or role.">
                {(a) => <Input {...a} value={user.email} disabled readOnly />}
              </Field>
              <div className="flex justify-end">
                <Button type="submit" icon={Save} loading={save.isPending} disabled={!isDirty}>
                  Save profile
                </Button>
              </div>
            </form>
          </Card>
          <Card title="My equipment" bodyClassName="p-2" actions={<Link to="/assets" className="text-xs font-medium text-brand-700 hover:underline">View all</Link>}>
            {assets.isLoading ? (
              <Skeleton className="m-3 h-16" />
            ) : assets.data?.data.length ? (
              <ul className="divide-y divide-slate-100">
                {assets.data.data.map((a) => (
                  <li key={a.id}>
                    <Link to={`/assets/${a.id}`} className="flex items-center justify-between gap-3 rounded-lg p-3 hover:bg-slate-50">
                      <span className="flex min-w-0 items-center gap-3">
                        <Laptop className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">{a.name}</span>
                          <span className="text-xs text-slate-500"><span className="font-mono">{a.assetTag}</span> · {ASSET_CATEGORIES[a.category]}</span>
                        </span>
                      </span>
                      <AssetStatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-3 text-sm text-slate-500">No equipment is assigned to you.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
