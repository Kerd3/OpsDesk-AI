import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { UserPlus, Pencil, UserX, UserCheck, Users } from 'lucide-react';
import { adminApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { useUrlFilters, useDebouncedFilter } from '../hooks/useUrlFilters.js';
import { useApiMutation, applyFieldErrors } from '../hooks/useApiMutation.js';
import { PageHeader, Card } from '../components/ui/Layout.jsx';
import { Button } from '../components/ui/Button.jsx';
import { SearchInput, FilterDropdown, Field, Input, Select } from '../components/ui/Form.jsx';
import { DataTable, Pagination } from '../components/ui/DataTable.jsx';
import { RoleBadge, Badge } from '../components/ui/Badges.jsx';
import { EmptyState } from '../components/ui/States.jsx';
import { Modal, ConfirmationDialog } from '../components/ui/Modal.jsx';
import { PersonCell } from '../components/tickets/TicketParts.jsx';
import { ROLES, toOptions } from '../utils/labels.js';
import { timeAgo } from '../utils/format.js';

export default function UsersPage() {
  useBreadcrumbs([{ label: 'User Management' }]);
  const { user: me } = useAuth();
  const [filters, setFilters] = useUrlFilters();
  const [search, setSearch] = useDebouncedFilter(filters, setFilters);
  const [editing, setEditing] = useState(null); // null | 'new' | user
  const [toggling, setToggling] = useState(null);

  const params = { search: filters.search, role: filters.role, status: filters.status, page: filters.page, pageSize: 20 };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-users', params], queryFn: () => adminApi.users(params), placeholderData: keepPreviousData });

  const toggleActive = useApiMutation((u) => adminApi.updateUser(u.id, { isActive: !u.isActive }), {
    invalidate: [['admin-users']],
    successMessage: (u) => (u.isActive ? `${u.fullName} reactivated` : `${u.fullName} deactivated and signed out`),
    onSuccess: () => setToggling(null),
  });

  const columns = [
    { key: 'name', header: 'User', render: (u) => <div className="min-w-[12rem]"><PersonCell person={u} sub={u.email} /></div> },
    { key: 'role', header: 'Role', render: (u) => <RoleBadge role={u.role} /> },
    { key: 'department', header: 'Department', className: 'hidden md:table-cell', render: (u) => u.department ?? '—' },
    { key: 'status', header: 'Status', render: (u) => (u.isActive ? <Badge tone="green" dot>Active</Badge> : <Badge tone="gray" dot>Inactive</Badge>) },
    { key: 'tickets', header: 'Tickets', className: 'hidden lg:table-cell tabular-nums', render: (u) => u.ticketCount },
    { key: 'login', header: 'Last sign-in', className: 'hidden lg:table-cell whitespace-nowrap', render: (u) => (u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never') },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (u) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(u)} aria-label={`Edit ${u.fullName}`}>
            <span className="hidden sm:inline">Edit</span>
          </Button>
          {u.id !== me.id && (
            <Button variant="ghost" size="sm" icon={u.isActive ? UserX : UserCheck} onClick={() => setToggling(u)} aria-label={`${u.isActive ? 'Deactivate' : 'Reactivate'} ${u.fullName}`}>
              <span className="hidden sm:inline">{u.isActive ? 'Deactivate' : 'Reactivate'}</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="User management"
        description="Create accounts, assign roles and deactivate people who have left."
        actions={
          <Button icon={UserPlus} onClick={() => setEditing('new')}>
            Add user
          </Button>
        }
      />
      <Card bodyClassName="">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or department…" label="Search users" className="sm:max-w-sm sm:flex-1" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <FilterDropdown label="Role" value={filters.role ?? ''} onChange={(v) => setFilters({ role: v })} options={toOptions(ROLES)} className="sm:w-44" />
            <FilterDropdown label="Status" value={filters.status ?? ''} onChange={(v) => setFilters({ status: v })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} className="sm:w-40" />
          </div>
        </div>
        <DataTable caption="Users" columns={columns} rows={data?.data ?? []} loading={isLoading} error={error} onRetry={refetch} empty={<EmptyState icon={Users} title="No users found" />} />
        <Pagination meta={data?.meta} onPageChange={(page) => setFilters({ page })} />
      </Card>

      <UserModal user={editing} onClose={() => setEditing(null)} isSelf={editing?.id === me.id} />
      <ConfirmationDialog
        open={!!toggling}
        onClose={() => setToggling(null)}
        onConfirm={() => toggleActive.mutate(toggling)}
        loading={toggleActive.isPending}
        tone={toggling?.isActive ? 'danger' : 'primary'}
        title={toggling?.isActive ? `Deactivate ${toggling?.fullName}?` : `Reactivate ${toggling?.fullName}?`}
        message={toggling?.isActive ? 'They will be signed out immediately and will not be able to sign in. Their tickets and history are kept.' : 'They will be able to sign in again with their existing password.'}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Reactivate'}
      />
    </>
  );
}

function UserModal({ user, onClose, isSelf }) {
  const isNew = user === 'new';
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    values: isNew || !user ? { email: '', fullName: '', role: 'employee', department: '', jobTitle: '', password: '' } : { email: user.email, fullName: user.fullName, role: user.role, department: user.department ?? '', jobTitle: user.jobTitle ?? '', password: '' },
  });

  const mutation = useApiMutation(
    (v) => {
      if (isNew) return adminApi.createUser({ ...v, department: v.department || undefined, jobTitle: v.jobTitle || undefined });
      const patch = { fullName: v.fullName, department: v.department, jobTitle: v.jobTitle, ...(isSelf ? {} : { role: v.role }), ...(v.password ? { password: v.password } : {}) };
      return adminApi.updateUser(user.id, patch);
    },
    { invalidate: [['admin-users']], successMessage: isNew ? 'User created' : 'User updated', onSuccess: onClose, onError: (err) => applyFieldErrors(err, setError) },
  );

  const passwordRules = {
    ...(isNew ? { required: 'Set an initial password' } : {}),
    validate: (v) => !v || (v.length >= 10 && /[A-Za-z]/.test(v) && /\d/.test(v)) || 'At least 10 characters with a letter and a number',
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={isNew ? 'Add user' : `Edit ${user?.fullName ?? ''}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit((v) => mutation.mutate(v))} loading={mutation.isPending}>
            {isNew ? 'Create user' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Full name" required error={errors.fullName?.message}>
          {(a) => <Input {...a} invalid={!!errors.fullName} {...register('fullName', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })} />}
        </Field>
        <Field label="Email" required={isNew} error={errors.email?.message} hint={!isNew ? 'Email cannot be changed.' : undefined}>
          {(a) => <Input {...a} type="email" disabled={!isNew} invalid={!!errors.email} {...register('email', { required: isNew && 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' } })} />}
        </Field>
        <Field label="Role" hint={isSelf ? 'You cannot change your own role.' : undefined}>
          {(a) => <Select {...a} disabled={isSelf} options={toOptions(ROLES)} {...register('role')} />}
        </Field>
        <Field label="Department">{(a) => <Input {...a} {...register('department')} />}</Field>
        <Field label="Job title">{(a) => <Input {...a} {...register('jobTitle')} />}</Field>
        <Field label={isNew ? 'Initial password' : 'Reset password'} required={isNew} error={errors.password?.message} hint={isNew ? 'Share it securely; the user can change it in Settings.' : 'Leave empty to keep the current password. Resetting signs the user out.'}>
          {(a) => <Input {...a} type="password" autoComplete="new-password" invalid={!!errors.password} {...register('password', passwordRules)} />}
        </Field>
      </form>
    </Modal>
  );
}
