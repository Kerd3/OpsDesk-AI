import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../api/endpoints.js';
import { Field, Input, Textarea, Select } from '../ui/Form.jsx';
import { Button } from '../ui/Button.jsx';
import { ASSET_CATEGORIES, ASSET_CONDITIONS, ASSET_STATUSES, toOptions } from '../../utils/labels.js';
import { applyFieldErrors } from '../../hooks/useApiMutation.js';

const today = () => new Date().toISOString().slice(0, 10);

/** Register or edit an asset. Assignment and status stay consistent with the API rules. */
export function AssetForm({ asset, onSubmit, onCancel, submitLabel = 'Save asset' }) {
  const { data: people = [] } = useQuery({ queryKey: ['directory', 'all'], queryFn: () => usersApi.directory('all') });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: asset?.name ?? '',
      category: asset?.category ?? '',
      manufacturer: asset?.manufacturer ?? '',
      model: asset?.model ?? '',
      serialNumber: asset?.serialNumber ?? '',
      location: asset?.location ?? '',
      purchaseDate: asset?.purchaseDate ?? '',
      condition: asset?.condition ?? 'good',
      status: asset?.status ?? 'available',
      assignedToId: asset?.assignedTo?.id ?? '',
      notes: asset?.notes ?? '',
    },
  });
  const status = watch('status');

  const submit = async (values) => {
    const body = { ...values, assignedToId: values.status === 'assigned' ? values.assignedToId || null : null, purchaseDate: values.purchaseDate || null };
    try {
      await onSubmit(body);
    } catch (err) {
      applyFieldErrors(err, setError);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Asset name" required error={errors.name?.message} className="sm:col-span-2">
          {(a) => <Input {...a} invalid={!!errors.name} placeholder="e.g. ThinkPad T14" {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })} />}
        </Field>
        <Field label="Category" required error={errors.category?.message}>
          {(a) => <Select {...a} invalid={!!errors.category} placeholder="Select a category" options={toOptions(ASSET_CATEGORIES)} {...register('category', { required: 'Choose a category' })} />}
        </Field>
        <Field label="Condition">
          {(a) => <Select {...a} options={toOptions(ASSET_CONDITIONS)} {...register('condition')} />}
        </Field>
        <Field label="Manufacturer" error={errors.manufacturer?.message}>
          {(a) => <Input {...a} {...register('manufacturer')} />}
        </Field>
        <Field label="Model" error={errors.model?.message}>
          {(a) => <Input {...a} {...register('model')} />}
        </Field>
        <Field label="Serial number" error={errors.serialNumber?.message}>
          {(a) => <Input {...a} invalid={!!errors.serialNumber} className="font-mono" {...register('serialNumber')} />}
        </Field>
        <Field label="Purchase date" error={errors.purchaseDate?.message}>
          {(a) => <Input {...a} type="date" max={today()} invalid={!!errors.purchaseDate} {...register('purchaseDate', { validate: (v) => !v || v <= today() || 'Purchase date cannot be in the future' })} />}
        </Field>
        <Field label="Location" className="sm:col-span-2">
          {(a) => <Input {...a} placeholder="e.g. HQ 3rd floor, Finance" {...register('location')} />}
        </Field>
        <Field label="Status">
          {(a) => (
            <Select
              {...a}
              options={toOptions(ASSET_STATUSES)}
              {...register('status', { onChange: (e) => e.target.value !== 'assigned' && setValue('assignedToId', '') })}
            />
          )}
        </Field>
        <Field label="Assigned to" error={errors.assignedToId?.message} hint={status !== 'assigned' ? 'Set status to Assigned to choose a person.' : undefined}>
          {(a) => (
            <Select
              {...a}
              disabled={status !== 'assigned'}
              invalid={!!errors.assignedToId}
              placeholder="Select a person"
              options={people.map((p) => ({ value: p.id, label: `${p.fullName}${p.department ? ` · ${p.department}` : ''}` }))}
              {...register('assignedToId', { validate: (v) => watch('status') !== 'assigned' || !!v || 'Choose who this asset is assigned to' })}
            />
          )}
        </Field>
        <Field label="Notes" className="sm:col-span-2" error={errors.notes?.message}>
          {(a) => <Textarea {...a} rows={3} {...register('notes', { maxLength: { value: 5000, message: 'At most 5,000 characters' } })} />}
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
