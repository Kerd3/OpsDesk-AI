import { useForm } from 'react-hook-form';
import { Send } from 'lucide-react';
import { Field, Input, Textarea, Select } from '../ui/Form.jsx';
import { Button } from '../ui/Button.jsx';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, toOptions } from '../../utils/labels.js';
import { applyFieldErrors } from '../../hooks/useApiMutation.js';

const PRIORITY_HINTS = {
  low: 'Minor inconvenience, a workaround exists.',
  medium: 'Affects your work but you can continue.',
  high: 'You cannot complete important work.',
  urgent: 'A team or site cannot work right now.',
};

/** Create/edit form for tickets. `onSubmit` must return a promise and throw ApiError on failure. */
export function TicketForm({ defaultValues, onSubmit, submitLabel = 'Submit ticket', onCancel, requesterOptions }) {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { subject: '', description: '', category: '', priority: 'medium', requesterId: '', ...defaultValues } });
  const priority = watch('priority');
  const description = watch('description') ?? '';

  const submit = async (values) => {
    try {
      await onSubmit({ ...values, requesterId: values.requesterId || undefined });
    } catch (err) {
      applyFieldErrors(err, setError);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      {requesterOptions && (
        <Field label="Requester" hint="Leave empty to file the ticket for yourself.">
          {(a) => <Select {...a} options={requesterOptions} placeholder="Myself" {...register('requesterId')} />}
        </Field>
      )}
      <Field label="Subject" required error={errors.subject?.message} hint="A short summary, e.g. “Laptop cannot connect to office Wi-Fi”.">
        {(a) => (
          <Input
            {...a}
            invalid={!!errors.subject}
            maxLength={200}
            {...register('subject', { required: 'Subject is required', minLength: { value: 3, message: 'Subject must be at least 3 characters' }, maxLength: { value: 200, message: 'Subject must be at most 200 characters' } })}
          />
        )}
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Category" required error={errors.category?.message}>
          {(a) => <Select {...a} invalid={!!errors.category} options={toOptions(TICKET_CATEGORIES)} placeholder="Select a category" {...register('category', { required: 'Choose a category' })} />}
        </Field>
        <Field label="Priority" required error={errors.priority?.message} hint={PRIORITY_HINTS[priority]}>
          {(a) => <Select {...a} options={toOptions(TICKET_PRIORITIES)} {...register('priority', { required: true })} />}
        </Field>
      </div>
      <Field label="Description" required error={errors.description?.message} hint={`What happened, when it started, error messages and what you already tried. ${description.length}/10000`}>
        {(a) => (
          <Textarea
            {...a}
            rows={8}
            invalid={!!errors.description}
            {...register('description', {
              required: 'Description is required',
              minLength: { value: 10, message: 'Please describe the problem in at least 10 characters' },
              maxLength: { value: 10000, message: 'Description is too long' },
            })}
          />
        )}
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting} icon={Send}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
