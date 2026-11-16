import { query } from '../../database/pool.js';
import { config } from '../../config/env.js';

// Relevance thresholds, tuned with scripts/probe-retrieval.js against the seed corpus:
// on-topic articles rank ~0.06-0.10, incidental matches on words like "company" ~0.02.
export const MIN_RANK = 0.03;
// Secondary results must score at least this fraction of the best match.
export const RELATIVE_RANK = 0.4;

/**
 * Knowledge retrieval with PostgreSQL full-text search.
 *
 * Natural-language questions rarely contain every word of an article, so the
 * plain query's AND operators are relaxed to OR, and ts_rank decides relevance.
 * The `status = 'published'` filter is hard-coded: drafts and archived
 * articles can never reach the model.
 */
export async function retrievePublishedArticles(text, { limit = config.ai.maxContextArticles, minRank = MIN_RANK } = {}) {
  const searchText = text.slice(0, 1000);
  const { rows } = await query(
    `WITH q AS (
       SELECT CASE WHEN numnode(plainto_tsquery('english', $1)) = 0 THEN NULL
                   ELSE replace(plainto_tsquery('english', $1)::text, ' & ', ' | ')::tsquery END AS tsq
     )
     SELECT k.id, k.slug, k.title, k.description, k.category, k.content,
            ts_rank(k.search_vector, q.tsq, 1) AS rank
       FROM knowledge_base_articles k, q
      WHERE k.status = 'published' AND q.tsq IS NOT NULL AND k.search_vector @@ q.tsq
      ORDER BY rank DESC
      LIMIT $2`,
    [searchText, limit],
  );
  const top = rows[0]?.rank ?? 0;
  return rows
    .filter((r) => r.rank >= minRank && r.rank >= top * RELATIVE_RANK)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      category: r.category,
      rank: Number(r.rank.toFixed(4)),
      // Bound the amount of context sent to the model per article.
      content: r.content.length > config.ai.maxArticleChars ? `${r.content.slice(0, config.ai.maxArticleChars)}\n[...truncated]` : r.content,
    }));
}
