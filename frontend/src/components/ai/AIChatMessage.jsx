import { Link } from 'react-router';
import { Sparkles, LifeBuoy, AlertTriangle, ExternalLink, ArrowRight } from 'lucide-react';
import { Avatar } from '../ui/Layout.jsx';
import { Badge } from '../ui/Badges.jsx';
import { Button } from '../ui/Button.jsx';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../../utils/labels.js';

/** Small teal marker that links a step to the numbered source it came from. */
function Cite({ n, title, anchor }) {
  return (
    <a
      href={`#${anchor}`}
      className="ml-1.5 inline-grid h-4 min-w-[18px] place-items-center rounded bg-brand-50 px-1 align-[2px] font-mono text-[10px] font-semibold text-brand-500 no-underline hover:bg-brand-500 hover:text-brand-950"
      aria-label={`Source ${n}: ${title}`}
    >
      {n}
    </a>
  );
}

/**
 * One chat turn. Assistant turns render as a "trace": each step links to the
 * help article it came from. Output is structured data rendered as text, never HTML.
 */
export function AIChatMessage({ message, index, userName, onCreateTicket, draftLoading }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[85%] rounded-xl rounded-br-sm border border-slate-300 bg-slate-50 px-4 py-3 text-sm break-words whitespace-pre-wrap text-slate-900 sm:max-w-[70%]">{message.content}</div>
        <Avatar name={userName} className="hidden sm:inline-flex" />
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="flex gap-3">
        <AssistantAvatar />
        <div role="alert" className="flex max-w-[85%] items-start gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{message.error}</span>
        </div>
      </div>
    );
  }

  const r = message.result;
  const anchor = (n) => `answer-${index}-source-${n}`;
  // With a single cited article, every step came from it, so each step can link to it.
  // With several, the model doesn't say which step used which, so steps aren't marked.
  const perStepSource = r.sources.length === 1 ? r.sources[0] : null;

  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="grid max-w-full min-w-0 flex-1 gap-4 sm:max-w-[78ch]">
        <p className="text-sm leading-6 whitespace-pre-wrap text-slate-900">{r.answer}</p>

        {r.steps.length > 0 && (
          <ol className="border-l border-slate-300">
            {r.steps.map((s, i) => (
              <li key={i} className="relative py-1.5 pl-6 text-sm leading-6 text-slate-900">
                <span className="absolute top-2 -left-[10px] grid size-[19px] place-items-center rounded-full border border-slate-300 bg-night font-mono text-[10px] font-semibold text-slate-500" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="sr-only">Step {i + 1}: </span>
                {s}
                {perStepSource && <Cite n={1} title={perStepSource.title} anchor={anchor(1)} />}
              </li>
            ))}
          </ol>
        )}

        {r.nextStep && (
          <p className="flex items-start gap-2 rounded-md border border-slate-200 bg-night px-3 py-3 text-sm text-slate-700">
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden="true" />
            <span>
              <span className="font-medium text-slate-900">Next step: </span>
              {r.nextStep}
            </span>
          </p>
        )}

        {r.sources.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs text-slate-500">Sources</h3>
            <ul className="grid gap-1.5">
              {r.sources.map((s, i) => (
                <li key={s.id}>
                  <Link
                    id={anchor(i + 1)}
                    to={`/knowledge-base/${s.slug}`}
                    target="_blank"
                    className="flex scroll-mt-24 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 hover:border-brand-300 target:border-brand-500"
                  >
                    <span className="font-mono text-[11px] font-semibold text-brand-500">{i + 1}</span>
                    {s.title}
                    <ExternalLink className="ml-auto size-3.5 text-slate-500" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!r.grounded && <p className="text-xs text-slate-500">No matching help article was found, so no troubleshooting steps are shown.</p>}

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="gray">Suggested: {TICKET_CATEGORIES[r.suggestedCategory]}</Badge>
            <Badge tone={r.suggestedPriority === 'urgent' ? 'red' : r.suggestedPriority === 'high' ? 'amber' : 'gray'}>{TICKET_PRIORITIES[r.suggestedPriority]} priority</Badge>
            {r.needsHumanSupport && (
              <Badge tone="indigo">
                <LifeBuoy className="size-3" aria-hidden="true" /> IT support recommended
              </Badge>
            )}
          </div>
          {onCreateTicket && (
            <Button size="sm" variant={r.needsHumanSupport ? 'primary' : 'secondary'} icon={LifeBuoy} onClick={onCreateTicket} loading={draftLoading}>
              Create ticket from chat
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AssistantAvatar() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-brand-300 bg-brand-50" aria-hidden="true">
      <Sparkles className="size-4 text-brand-500" />
    </span>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3" role="status" aria-label="The assistant is preparing an answer">
      <AssistantAvatar />
      <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-night px-4 py-3">
        {[0, 150, 300].map((d) => (
          <span key={d} className="size-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${d}ms` }} />
        ))}
        <span className="ml-2 text-xs text-slate-500">Searching help articles…</span>
      </div>
    </div>
  );
}

/** Side panel: which articles the last answer was given, how relevant each was, and which it cited. */
export function ArticlesSearched({ considered }) {
  if (!considered) {
    return <p className="text-sm text-slate-500">Ask a question to see which help articles were searched for the answer.</p>;
  }
  if (!considered.length) {
    return <p className="text-sm text-slate-500">No published article was relevant enough, so the assistant didn't suggest any steps.</p>;
  }
  const top = Math.max(...considered.map((c) => c.rank));
  return (
    <ul className="divide-y divide-slate-200">
      {considered.map((c) => (
        <li key={c.id} className="grid gap-1.5 py-3 first:pt-0 last:pb-0">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <Link to={`/knowledge-base/${c.slug}`} className={`hover:text-brand-500 ${c.cited ? 'text-slate-900' : 'text-slate-500'}`}>
              {c.title}
            </Link>
            <span className="font-mono text-xs text-slate-500">{c.rank.toFixed(3)}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
            <span className={`block h-full ${c.cited ? 'bg-brand-500' : 'bg-slate-400'}`} style={{ width: `${Math.max(6, (c.rank / top) * 100)}%` }} />
          </div>
          <span className="text-xs text-slate-500">{c.cited ? 'Cited in the answer' : 'Read by the AI, not cited'}</span>
        </li>
      ))}
    </ul>
  );
}
