// Developer utility: prints full-text retrieval ranks for sample questions (used to tune MIN_RANK).
import { retrievePublishedArticles } from '../src/modules/ai/retrieval.service.js';
import { pool } from '../src/database/pool.js';

const questions = process.argv.slice(2).length ? process.argv.slice(2) : [
  "Why can't my computer connect to Wi-Fi?", 'How do I configure my Gmail account?', 'My printer is not responding. What should I do?',
  'How can I troubleshoot a slow Windows computer?', "Why can't I access a shared company resource?", 'How do I request access to an internal system?',
  'How do I book a meeting room?', "What is the company's parental leave policy?", 'How do I bake sourdough bread?', 'my screen is broken', 'computer',
];
for (const q of questions) {
  const r = await retrievePublishedArticles(q, { minRank: 0 });
  console.log(`${q}\n   => ${r.map((a) => `${a.slug}:${a.rank}`).join(' | ') || '(none)'}`);
}
await pool.end();
