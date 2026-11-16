// Loads the sample troubleshooting articles (published ones only) WITHOUT any demo
// accounts, tickets or assets. Safe to run in production; existing slugs are skipped,
// so running it twice changes nothing. Articles are authored by the first active admin.
//
//   node src/database/seed-knowledge-base.js
//
// The articles describe a fictional company ("Harborview Logistics"). Edit them in
// the Knowledge Base editor to match your organisation before relying on them.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './pool.js';
import { DEMO_ARTICLES } from './seed-data.js';
import { createArticle } from '../modules/knowledge-base/kb.service.js';

export async function seedKnowledgeBase({ log = console.log } = {}) {
  const admin = (await query(`SELECT id FROM users WHERE role = 'admin' AND is_active ORDER BY created_at LIMIT 1`)).rows[0];
  if (!admin) throw new Error('Create an administrator first (npm run admin:create)');

  let created = 0;
  let skipped = 0;
  for (const article of DEMO_ARTICLES.filter((a) => (a.status ?? 'published') === 'published')) {
    const exists = await query('SELECT 1 FROM knowledge_base_articles WHERE slug = $1', [article.slug]);
    if (exists.rowCount) {
      skipped += 1;
      continue;
    }
    await createArticle({ id: admin.id }, { ...article, status: 'published' });
    created += 1;
  }
  log(`[seed-kb] ${created} article(s) published, ${skipped} already present`);
  return { created, skipped };
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  try {
    await seedKnowledgeBase();
  } catch (err) {
    console.error(`[seed-kb] ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
