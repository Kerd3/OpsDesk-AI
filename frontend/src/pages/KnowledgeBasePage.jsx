import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Plus, BookOpen } from 'lucide-react';
import { kbApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { useUrlFilters, useDebouncedFilter } from '../hooks/useUrlFilters.js';
import { PageHeader, Card } from '../components/ui/Layout.jsx';
import { ButtonLink, Button } from '../components/ui/Button.jsx';
import { SearchInput, FilterDropdown } from '../components/ui/Form.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States.jsx';
import { Pagination } from '../components/ui/DataTable.jsx';
import { KnowledgeBaseCard } from '../components/kb/KnowledgeBaseCard.jsx';
import { TICKET_CATEGORIES, KB_STATUSES, toOptions } from '../utils/labels.js';

export default function KnowledgeBasePage() {
  const { isStaff } = useAuth();
  useBreadcrumbs([{ label: 'Knowledge base' }]);
  const [filters, setFilters] = useUrlFilters();
  const [search, setSearch] = useDebouncedFilter(filters, setFilters);

  const params = { search: filters.search, category: filters.category, status: filters.status, sort: filters.sort, page: filters.page, pageSize: 12 };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['kb', params], queryFn: () => kbApi.list(params), placeholderData: keepPreviousData });
  const articles = data?.data ?? [];
  const hasFilters = filters.search || filters.category || filters.status;

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description={isStaff ? 'Company-approved troubleshooting guides. Only published articles are visible to employees and the AI assistant.' : 'Company-approved guides for common IT questions.'}
        actions={
          isStaff && (
            <ButtonLink to="/knowledge-base/new" icon={Plus}>
              New article
            </ButtonLink>
          )
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder="Search articles, e.g. “printer offline”" label="Search articles" className="sm:flex-1" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterDropdown label="Category" value={filters.category ?? ''} onChange={(v) => setFilters({ category: v })} options={toOptions(TICKET_CATEGORIES)} className="sm:w-48" />
          {isStaff ? (
            <FilterDropdown label="Status" value={filters.status ?? ''} onChange={(v) => setFilters({ status: v })} options={toOptions(KB_STATUSES)} allLabel="Active" className="sm:w-40" />
          ) : (
            <FilterDropdown label="Sort" value={filters.sort ?? ''} onChange={(v) => setFilters({ sort: v })} options={[{ value: 'popular', label: 'Most viewed' }, { value: 'title', label: 'Title A–Z' }]} allLabel="Relevance" className="sm:w-40" />
          )}
        </div>
      </div>

      {error ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : articles.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={hasFilters ? 'No articles found' : 'No articles yet'}
            description={hasFilters ? 'Try different keywords, or ask the AI assistant or IT support for help.' : 'Published articles will appear here.'}
            action={
              hasFilters ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setFilters({ search: '', category: '', status: '' }); }}>
                    Clear search
                  </Button>
                  <ButtonLink to="/tickets/new" size="sm" icon={Plus}>
                    Create a ticket
                  </ButtonLink>
                </div>
              ) : null
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {articles.map((a) => (
              <KnowledgeBaseCard key={a.id} article={a} showStatus={isStaff} />
            ))}
          </div>
          {data.meta.totalPages > 1 && (
            <div className="card mt-4">
              <Pagination meta={data.meta} onPageChange={(page) => setFilters({ page })} />
            </div>
          )}
        </>
      )}
    </>
  );
}
