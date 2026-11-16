import { query, withTransaction } from '../../database/pool.js';
import { recordAudit } from '../audit/audit.service.js';
import { SqlConditions, getPagination, paginationMeta } from '../../utils/pagination.js';
import { isStaff } from '../../utils/constants.js';
import { notFound, forbidden, conflict } from '../../utils/errors.js';

const ARTICLE_SELECT = `
  SELECT k.*, au.full_name AS author_name, ub.full_name AS updated_by_name
    FROM knowledge_base_articles k
    LEFT JOIN users au ON au.id = k.author_id
    LEFT JOIN users ub ON ub.id = k.updated_by_id`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toArticleDto(row, { includeContent = true } = {}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    ...(includeContent ? { content: row.content } : {}),
    category: row.category,
    tags: row.tags,
    status: row.status,
    author: row.author_id ? { id: row.author_id, fullName: row.author_name } : null,
    updatedBy: row.updated_by_id ? { id: row.updated_by_id, fullName: row.updated_by_name } : null,
    viewCount: row.view_count,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.rank !== undefined ? { rank: row.rank } : {}),
  };
}

export function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[_\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'article';
}

async function uniqueSlug(db, base, excludeId = null) {
  let slug = base;
  for (let i = 2; ; i += 1) {
    const { rowCount } = await db.query('SELECT 1 FROM knowledge_base_articles WHERE slug = $1 AND id IS DISTINCT FROM $2', [slug, excludeId]);
    if (!rowCount) return slug;
    slug = `${base}-${i}`;
  }
}

export async function listArticles(user, filters) {
  const pagination = getPagination(filters, 12);
  const c = new SqlConditions();

  // Employees only ever see published content, regardless of the filter they send.
  if (!isStaff(user)) c.add("k.status = 'published'");
  else if (filters.status) c.add('k.status = ?', filters.status);
  else c.add("k.status <> 'archived'");

  if (filters.category) c.add('k.category = ?', filters.category);
  if (filters.tag) c.add('? = ANY(k.tags)', filters.tag);

  let rankSelect = '';
  let order = filters.sort === 'popular' ? 'k.view_count DESC, k.title' : filters.sort === 'title' ? 'k.title ASC' : 'k.updated_at DESC';
  if (filters.search) {
    const p = c.param(filters.search);
    const like = c.param(`%${filters.search}%`);
    c.clauses.push(`(k.search_vector @@ websearch_to_tsquery('english', ${p}) OR k.title ILIKE ${like})`);
    rankSelect = `, ts_rank_cd(k.search_vector, websearch_to_tsquery('english', ${p}), 32) AS rank`;
    if (!filters.sort) order = 'rank DESC, k.updated_at DESC';
  }

  const where = c.where();
  const total = (await query(`SELECT count(*) AS n FROM knowledge_base_articles k ${where}`, c.params)).rows[0].n;
  const { rows } = await query(
    `${ARTICLE_SELECT.replace('SELECT k.*,', `SELECT k.*${rankSelect},`)} ${where}
     ORDER BY ${order} LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    c.params,
  );
  return { items: rows.map((r) => toArticleDto(r, { includeContent: false })), meta: paginationMeta(pagination, total) };
}

async function loadArticle(db, idOrSlug) {
  const column = UUID_RE.test(idOrSlug) ? 'k.id' : 'k.slug';
  const { rows } = await db.query(`${ARTICLE_SELECT} WHERE ${column} = $1`, [idOrSlug]);
  return rows[0] ?? null;
}

/** Unpublished articles return 404 to employees so drafts are not discoverable. */
export async function getArticle(user, idOrSlug, { countView = true } = {}) {
  const row = await loadArticle({ query }, idOrSlug);
  if (!row || (!isStaff(user) && row.status !== 'published')) throw notFound('Article');
  if (countView && row.status === 'published') {
    await query('UPDATE knowledge_base_articles SET view_count = view_count + 1 WHERE id = $1', [row.id]);
    row.view_count += 1;
  }
  const related = await relatedArticles(row);
  return { ...toArticleDto(row), related };
}

/** Published articles in the same category or sharing tags, most overlap first. */
async function relatedArticles(article) {
  const { rows } = await query(
    `SELECT id, slug, title, description, category
       FROM knowledge_base_articles
      WHERE status = 'published' AND id <> $1 AND (category = $2 OR tags && $3::text[])
      ORDER BY cardinality(ARRAY(SELECT unnest(tags) INTERSECT SELECT unnest($3::text[]))) DESC,
               (category = $2) DESC, view_count DESC
      LIMIT 4`,
    [article.id, article.category, article.tags],
  );
  return rows;
}

export async function createArticle(user, input) {
  return withTransaction(async (db) => {
    const slug = await uniqueSlug(db, input.slug || slugify(input.title));
    const status = input.status ?? 'draft';
    const { rows } = await db.query(
      `INSERT INTO knowledge_base_articles (slug, title, description, content, category, tags, status, author_id, updated_by_id, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, CASE WHEN $7 = 'published' THEN now() END) RETURNING id`,
      [slug, input.title, input.description ?? '', input.content, input.category, normalizeTags(input.tags), status, user.id],
    );
    await recordAudit(
      { actorId: user.id, action: 'kb.article_created', resourceType: 'kb_article', resourceId: rows[0].id, metadata: { title: input.title, status } },
      db,
    );
    return toArticleDto(await loadArticle(db, rows[0].id));
  });
}

const normalizeTags = (tags = []) => [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 15);

export async function updateArticle(user, id, patch) {
  return withTransaction(async (db) => {
    const current = (await db.query('SELECT * FROM knowledge_base_articles WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!current) throw notFound('Article');

    const next = { ...patch };
    if (next.tags) next.tags = normalizeTags(next.tags);
    if (next.slug && next.slug !== current.slug) next.slug = await uniqueSlug(db, next.slug, id);

    const columns = ['slug', 'title', 'description', 'content', 'category', 'tags', 'status'];
    const sets = [];
    const params = [id, user.id];
    const changedFields = [];
    for (const column of columns) {
      if (next[column] === undefined) continue;
      if (JSON.stringify(next[column]) === JSON.stringify(current[column])) continue;
      params.push(next[column]);
      sets.push(`${column} = $${params.length}`);
      changedFields.push(column);
    }
    if (!sets.length) return toArticleDto(await loadArticle(db, id));
    if (next.status === 'published' && current.status !== 'published') sets.push('published_at = now()');

    await db.query(`UPDATE knowledge_base_articles SET ${sets.join(', ')}, updated_by_id = $2 WHERE id = $1`, params);

    let action = 'kb.article_updated';
    if (changedFields.includes('status')) {
      action = { published: 'kb.article_published', draft: 'kb.article_unpublished', archived: 'kb.article_archived' }[next.status];
    }
    await recordAudit(
      { actorId: user.id, action, resourceType: 'kb_article', resourceId: id, metadata: { title: next.title ?? current.title, fields: changedFields } },
      db,
    );
    return toArticleDto(await loadArticle(db, id));
  });
}

/**
 * Default: archive (reversible, keeps history). Administrators may pass
 * permanent=true to hard-delete an article that is already archived.
 */
export async function deleteArticle(user, id, { permanent = false } = {}) {
  return withTransaction(async (db) => {
    const current = (await db.query('SELECT id, title, status FROM knowledge_base_articles WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!current) throw notFound('Article');

    if (permanent) {
      if (user.role !== 'admin') throw forbidden('Only administrators can permanently delete articles');
      if (current.status !== 'archived') throw conflict('Archive the article before deleting it permanently');
      await db.query('DELETE FROM knowledge_base_articles WHERE id = $1', [id]);
      await recordAudit({ actorId: user.id, action: 'kb.article_deleted', resourceType: 'kb_article', resourceId: id, metadata: { title: current.title } }, db);
      return { id, deleted: true };
    }

    await db.query(`UPDATE knowledge_base_articles SET status = 'archived', updated_by_id = $2 WHERE id = $1`, [id, user.id]);
    await recordAudit({ actorId: user.id, action: 'kb.article_archived', resourceType: 'kb_article', resourceId: id, metadata: { title: current.title } }, db);
    return { id, archived: true };
  });
}

export async function listTags() {
  const { rows } = await query(
    `SELECT tag, count(*) AS n FROM knowledge_base_articles, unnest(tags) AS tag
      WHERE status = 'published' GROUP BY tag ORDER BY n DESC, tag LIMIT 30`,
  );
  return rows.map((r) => ({ tag: r.tag, count: r.n }));
}
