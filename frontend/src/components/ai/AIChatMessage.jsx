import { Link } from 'react-router';
import { Sparkles, BookOpen, LifeBuoy, AlertTriangle, ExternalLink, ArrowRight } from 'lucide-react';
import { Avatar } from '../ui/Layout.jsx';
import { Badge } from '../ui/Badges.jsx';
import { Button } from '../ui/Button.jsx';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../../utils/labels.js';

/** One chat turn. Assistant turns render structured, grounded output — never raw HTML. */
export function AIChatMessage({ message, userName, onCreateTicket, draftLoading }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-700 px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-white sm:max-w-[75%]">{message.content}</div>
        <Avatar name={userName} className="hidden sm:inline-flex" />
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="flex gap-3">
        <AssistantAvatar />
        <div role="alert" className="flex max-w-[85%] items-start gap-2 rounded-2xl rounded-tl-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{message.error}</span>
        </div>
      </div>
    );
  }

  const r = message.result;
  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 max-w-full flex-1 space-y-3 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3.5 shadow-card sm:max-w-[85%]">
        <p className="text-sm leading-6 whitespace-pre-wrap text-slate-800">{r.answer}</p>

        {r.steps.length > 0 && (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-6 text-slate-700 marker:font-medium marker:text-brand-600">
            {r.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}

        {r.nextStep && (
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
            <span>
              <span className="font-medium text-slate-900">Next step: </span>
              {r.nextStep}
            </span>
          </p>
        )}

        {r.sources.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Sources</p>
            <ul className="flex flex-wrap gap-2">
              {r.sources.map((s) => (
                <li key={s.id}>
                  <Link to={`/knowledge-base/${s.slug}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700">
                    <BookOpen className="size-3.5 text-brand-500" aria-hidden="true" />
                    {s.title}
                    <ExternalLink className="size-3 text-slate-500" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!r.grounded && (
          <p className="text-xs text-slate-500">No matching article was found in the company knowledge base, so no troubleshooting steps are shown.</p>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="gray">Suggested: {TICKET_CATEGORIES[r.suggestedCategory]}</Badge>
            <Badge tone={r.suggestedPriority === 'urgent' ? 'red' : r.suggestedPriority === 'high' ? 'amber' : 'gray'}>{TICKET_PRIORITIES[r.suggestedPriority]} priority</Badge>
            {r.needsHumanSupport && (
              <Badge tone="amber">
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
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-700" aria-hidden="true">
      <Sparkles className="size-4 text-white" />
    </span>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3" role="status" aria-label="The assistant is preparing an answer">
      <AssistantAvatar />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3.5">
        {[0, 150, 300].map((d) => (
          <span key={d} className="size-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
        ))}
        <span className="ml-2 text-xs text-slate-500">Searching the knowledge base…</span>
      </div>
    </div>
  );
}
