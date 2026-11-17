import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Save, Eye, Pencil } from 'lucide-react';
import { kbApi } from '../api/endpoints.js';
import { useToast } from '../context/ToastContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { applyFieldErrors } from '../hooks/useApiMutation.js';
import { PageHeader, Card, Tabs } from '../components/ui/Layout.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, Input, Textarea, Select } from '../components/ui/Form.jsx';
import { LoadingSpinner, ErrorState, Alert } from '../components/ui/States.jsx';
import { MarkdownView } from '../components/kb/KnowledgeBaseCard.jsx';
import { TICKET_CATEGORIES, KB_STATUSES, toOptions } from '../utils/labels.js';

export default function ArticleEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const { data: article, isLoading, error } = useQuery({ queryKey: ['kb-article', id, 'edit'], queryFn: () => kbApi.get(id, { view: '0' }), enabled: !isNew });
  useBreadcrumbs([{ label: 'Knowledge base', to: '/knowledge-base' }, { label: isNew ? 'New article' : `Edit: ${article?.title ?? '…'}` }]);

  if (!isNew && isLoading) return <LoadingSpinner />;
  if (error) return <Card><ErrorState error={error} /></Card>;
  return <ArticleForm article={article} />;
}

function ArticleForm({ article }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('write');
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      title: article?.title ?? '',
      description: article?.description ?? '',
      category: article?.category ?? '',
      tags: article?.tags.join(', ') ?? '',
      status: article?.status ?? 'draft',
      content: article?.content ?? '',
    },
  });
  const content = watch('content');

  const save = async (values) => {
    const body = { ...values, tags: values.tags.split(',').map((t) => t.trim()).filter(Boolean) };
    try {
      const saved = article ? await kbApi.update(article.id, body) : await kbApi.create(body);
      await queryClient.invalidateQueries({ queryKey: ['kb'] });
      queryClient.removeQueries({ queryKey: ['kb-article'] });
      toast.success(article ? 'Article saved' : 'Article created');
      navigate(`/knowledge-base/${saved.slug}`);
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(save)} noValidate>
      <PageHeader
        title={article ? 'Edit article' : 'New article'}
        description="Write clear, step-by-step instructions. Published articles are shown to employees and used by the AI assistant as its source of truth."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" icon={Save} loading={isSubmitting} disabled={article && !isDirty}>
              Save
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card bodyClassName="p-6 space-y-5">
          <Field label="Title" required error={errors.title?.message}>
            {(a) => <Input {...a} invalid={!!errors.title} {...register('title', { required: 'Title is required', minLength: { value: 3, message: 'At least 3 characters' }, maxLength: { value: 200, message: 'At most 200 characters' } })} />}
          </Field>
          <Field label="Summary" error={errors.description?.message} hint="One sentence shown in search results.">
            {(a) => <Input {...a} invalid={!!errors.description} {...register('description', { maxLength: { value: 500, message: 'At most 500 characters' } })} />}
          </Field>
          <div>
            <Tabs
              label="Editor mode"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'write', label: 'Write' },
                { value: 'preview', label: 'Preview' },
              ]}
            />
            <div className="pt-4">
              {tab === 'write' ? (
                <Field error={errors.content?.message} hint="Formatting: ## Heading, 1. numbered steps, - bullets, **bold**, `code`.">
                  {(a) => (
                    <Textarea
                      {...a}
                      aria-label="Article content"
                      rows={18}
                      className="font-mono text-[13px] leading-6"
                      invalid={!!errors.content}
                      {...register('content', { required: 'Content is required', minLength: { value: 20, message: 'At least 20 characters' } })}
                    />
                  )}
                </Field>
              ) : (
                <div className="min-h-[24rem] rounded-md border border-slate-200 p-6">{content?.trim() ? <MarkdownView content={content} /> : <p className="text-sm text-slate-500">Nothing to preview yet.</p>}</div>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Publishing">
            <div className="space-y-4">
              <Field label="Status">
                {(a) => <Select {...a} options={toOptions(KB_STATUSES)} {...register('status')} />}
              </Field>
              <Alert tone="info" icon={watch('status') === 'published' ? Eye : Pencil}>
                {watch('status') === 'published' ? 'Visible to all employees and used by the AI assistant.' : 'Only IT staff can see this article.'}
              </Alert>
            </div>
          </Card>
          <Card title="Organization">
            <div className="space-y-4">
              <Field label="Category" required error={errors.category?.message}>
                {(a) => <Select {...a} invalid={!!errors.category} placeholder="Select a category" options={toOptions(TICKET_CATEGORIES)} {...register('category', { required: 'Choose a category' })} />}
              </Field>
              <Field label="Tags" hint="Comma-separated, e.g. wifi, laptop" error={errors.tags?.message}>
                {(a) => <Input {...a} {...register('tags')} />}
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
