import { Fragment } from 'react';
import { Link } from 'react-router';
import { Eye, FileText } from 'lucide-react';
import { KbStatusBadge, Badge } from '../ui/Badges.jsx';
import { TICKET_CATEGORIES } from '../../utils/labels.js';
import { timeAgo } from '../../utils/format.js';

export function KnowledgeBaseCard({ article, showStatus }) {
  return (
    <Link to={`/knowledge-base/${article.slug}`} className="card group flex h-full flex-col p-5 transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
          <FileText className="size-[18px] text-brand-600" aria-hidden="true" />
        </div>
        {showStatus && article.status !== 'published' && <KbStatusBadge status={article.status} />}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-slate-900 group-hover:text-brand-700">{article.title}</h3>
      <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-slate-500">{article.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
        <Badge tone="gray">{TICKET_CATEGORIES[article.category]}</Badge>
        <span className="inline-flex items-center gap-1">
          <Eye className="size-3.5" aria-hidden="true" /> {article.viewCount}
        </span>
        <span>Updated {timeAgo(article.updatedAt)}</span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Minimal, safe Markdown renderer for knowledge base articles.
// Supports ##/### headings, ordered and bullet lists, paragraphs, **bold** and
// `code`. It builds React elements (never HTML strings), so article content
// can never inject markup or scripts.
// ---------------------------------------------------------------------------
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function MarkdownView({ content }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let list = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (!line) {
      flushParagraph();
      flushList();
    } else if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h3', text: line.slice(4) });
    } else if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h2', text: line.slice(3) });
    } else if (ordered || bullet) {
      flushParagraph();
      const type = ordered ? 'ol' : 'ul';
      if (list?.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((ordered ?? bullet)[1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();

  return (
    <div className="space-y-4 text-[15px] leading-7 text-slate-700">
      {blocks.map((b, i) => {
        if (b.type === 'h2') return <h2 key={i} className="pt-2 text-lg font-semibold text-slate-900">{renderInline(b.text, i)}</h2>;
        if (b.type === 'h3') return <h3 key={i} className="pt-1 text-base font-semibold text-slate-900">{renderInline(b.text, i)}</h3>;
        if (b.type === 'ol')
          return (
            <ol key={i} className="list-decimal space-y-1.5 pl-6 marker:text-slate-400">
              {b.items.map((item, j) => <li key={j}>{renderInline(item, `${i}-${j}`)}</li>)}
            </ol>
          );
        if (b.type === 'ul')
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-6 marker:text-slate-400">
              {b.items.map((item, j) => <li key={j}>{renderInline(item, `${i}-${j}`)}</li>)}
            </ul>
          );
        return <p key={i}>{renderInline(b.text, i)}</p>;
      })}
    </div>
  );
}
