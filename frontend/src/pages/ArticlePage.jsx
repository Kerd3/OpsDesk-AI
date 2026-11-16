import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Archive, Eye, EyeOff, Trash2, LifeBuoy, Sparkles, BookOpen } from 'lucide-react';
import { kbApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { useApiMutation } from '../hooks/useApiMutation.js';
import { PageHeader, Card } from '../components/ui/Layout.jsx';
import { Button, ButtonLink } from '../components/ui/Button.jsx';
import { Badge, KbStatusBadge } from '../components/ui/Badges.jsx';
import { ConfirmationDialog } from '../components/ui/Modal.jsx';
import { LoadingSpinner, ErrorState, Alert } from '../components/ui/States.jsx';
import { MarkdownView } from '../components/kb/KnowledgeBaseCard.jsx';
import { TICKET_CATEGORIES } from '../utils/labels.js';
import { formatDate } from '../utils/format.js';

export default function ArticlePage() {
  const { slug } = useParams();
  const { isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(null);
  const { data: article, isLoading, error, refetch } = useQuery({ queryKey: ['kb-article', slug], queryFn: () => kbApi.get(slug) });
  useBreadcrumbs([{ label: 'Knowledge Base', to: '/knowledge-base' }, { label: article?.title ?? 'Article' }]);

  const invalidate = [['kb'], ['kb-article', slug]];
  const setStatus = useApiMutation((status) => kbApi.update(article.id, { status }), {
    invalidate,
    successMessage: (a) => (a.status === 'published' ? 'Article published — now visible to employees and the AI assistant' : 'Article moved to drafts'),
  });
  const archive = useApiMutation(() => kbApi.archive(article.id), { invalidate, successMessage: 'Article archived', onSuccess: () => setConfirm(null) });
  const destroy = useApiMutation(() => kbApi.destroy(article.id), {
    invalidate: [['kb']],
    successMessage: 'Article permanently deleted',
    onSuccess: () => navigate('/knowledge-base', { replace: true }),
  });

  if (isLoading) return <LoadingSpinner label="Loading article…" />;
  if (error) return <Card><ErrorState error={error} onRetry={refetch} /></Card>;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <article className="min-w-0">
        <PageHeader
          eyebrow={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="indigo">{TICKET_CATEGORIES[article.category]}</Badge>
              {isStaff && <KbStatusBadge status={article.status} />}
            </div>
          }
          title={article.title}
          description={article.description}
          actions={
            isStaff && (
              <>
                <ButtonLink to={`/knowledge-base/${article.id}/edit`} variant="secondary" icon={Pencil}>
                  Edit
                </ButtonLink>
                {article.status === 'published' ? (
                  <Button variant="secondary" icon={EyeOff} loading={setStatus.isPending} onClick={() => setStatus.mutate('draft')}>
                    Unpublish
                  </Button>
                ) : (
                  <Button icon={Eye} loading={setStatus.isPending} onClick={() => setStatus.mutate('published')}>
                    Publish
                  </Button>
                )}
                {article.status !== 'archived' ? (
                  <Button variant="ghost" icon={Archive} onClick={() => setConfirm('archive')}>
                    Archive
                  </Button>
                ) : (
                  isAdmin && (
                    <Button variant="ghost" icon={Trash2} className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirm('delete')}>
                      Delete
                    </Button>
                  )
                )}
              </>
            )
          }
        />
        {isStaff && article.status !== 'published' && (
          <div className="mb-4">
            <Alert tone="warning" title={article.status === 'draft' ? 'Draft — not visible to employees' : 'Archived — not visible to employees'}>
              Only published articles are shown to employees and used by the AI assistant.
            </Alert>
          </div>
        )}
        <Card bodyClassName="p-6 sm:p-8">
          <MarkdownView content={article.content} />
        </Card>
        <p className="mt-3 text-xs text-slate-500">
          {article.author && <>Written by {article.author.fullName} · </>}Last updated {formatDate(article.updatedAt)}
          {article.updatedBy && article.updatedBy.id !== article.author?.id && <> by {article.updatedBy.fullName}</>} · {article.viewCount} views
        </p>
      </article>

      <aside className="space-y-4">
        <Card title="Still need help?">
          <p className="text-sm text-slate-500">If these steps didn't solve the problem, contact IT support.</p>
          <div className="mt-4 flex flex-col gap-2">
            <ButtonLink to="/tickets/new" icon={LifeBuoy}>
              Create a ticket
            </ButtonLink>
            <ButtonLink to="/assistant" variant="secondary" icon={Sparkles}>
              Ask the AI assistant
            </ButtonLink>
          </div>
        </Card>
        {article.tags.length > 0 && (
          <Card title="Tags">
            <div className="flex flex-wrap gap-1.5">
              {article.tags.map((t) => (
                <Badge key={t} tone="gray">
                  {t}
                </Badge>
              ))}
            </div>
          </Card>
        )}
        <Card title="Related articles" bodyClassName="p-2">
          {article.related.length ? (
            <ul>
              {article.related.map((r) => (
                <li key={r.id}>
                  <Link to={`/knowledge-base/${r.slug}`} className="flex gap-2.5 rounded-lg p-3 hover:bg-slate-50">
                    <BookOpen className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden="true" />
                    <span className="text-sm font-medium text-slate-800">{r.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-3 text-sm text-slate-500">No related articles.</p>
          )}
        </Card>
      </aside>

      <ConfirmationDialog
        open={confirm === 'archive'}
        onClose={() => setConfirm(null)}
        onConfirm={() => archive.mutate()}
        loading={archive.isPending}
        title="Archive this article?"
        message="Employees and the AI assistant will no longer see it. You can restore it later by publishing it again."
        confirmLabel="Archive"
      />
      <ConfirmationDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => destroy.mutate()}
        loading={destroy.isPending}
        title="Permanently delete this article?"
        message="This cannot be undone. The deletion is recorded in the audit log."
        confirmLabel="Delete permanently"
      />
    </div>
  );
}
