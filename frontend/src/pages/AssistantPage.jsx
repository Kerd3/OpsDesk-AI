import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Send, Sparkles, RotateCcw, BookOpen, Plus, ShieldAlert, Wifi, Mail, Printer, Gauge, FolderLock, KeyRound } from 'lucide-react';
import { aiApi, ticketsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { PageHeader, Card } from '../components/ui/Layout.jsx';
import { Button, ButtonLink } from '../components/ui/Button.jsx';
import { Alert, LoadingSpinner } from '../components/ui/States.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { TicketForm } from '../components/tickets/TicketForm.jsx';
import { AIChatMessage, TypingIndicator, AssistantAvatar } from '../components/ai/AIChatMessage.jsx';

const SUGGESTIONS = [
  [Wifi, "Why can't my computer connect to Wi-Fi?"],
  [Mail, 'How do I configure my Gmail account?'],
  [Printer, 'My printer is not responding. What should I do?'],
  [Gauge, 'How can I troubleshoot a slow Windows computer?'],
  [FolderLock, "Why can't I access a shared company resource?"],
  [KeyRound, 'How do I request access to an internal system?'],
];
const MAX_LENGTH = 2000;

/** Conversation turns in the shape the API expects as history. */
const toHistory = (messages) =>
  messages
    .filter((m) => !m.error)
    .slice(-20)
    .map((m) =>
      m.role === 'user'
        ? { role: 'user', content: m.content }
        : { role: 'assistant', content: [m.result.answer, ...m.result.steps.map((s, i) => `${i + 1}. ${s}`)].join('\n').slice(0, 3900) },
    );

export default function AssistantPage() {
  useBreadcrumbs([{ label: 'AI Assistant' }]);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(null);
  const scrollRef = useRef(null);
  const { register, handleSubmit, reset, watch, setFocus } = useForm({ defaultValues: { message: '' } });
  const text = watch('message') ?? '';

  const status = useQuery({ queryKey: ['ai-status'], queryFn: aiApi.status, staleTime: 60_000 });
  const available = status.data?.available;

  const chat = useMutation({
    mutationFn: aiApi.chat,
    onSuccess: (result) => setMessages((m) => [...m, { role: 'assistant', result }]),
    onError: (err) => {
      setMessages((m) => [...m, { role: 'assistant', error: err.message }]);
      if (['AI_NOT_CONFIGURED', 'AI_DISABLED'].includes(err.code)) status.refetch();
    },
  });

  const assist = useMutation({
    mutationFn: aiApi.ticketAssist,
    onSuccess: setDraft,
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chat.isPending]);

  const send = (content) => {
    const message = content.trim();
    if (message.length < 2 || chat.isPending) return;
    const history = toHistory(messages);
    setMessages((m) => [...m, { role: 'user', content: message }]);
    reset({ message: '' });
    chat.mutate({ message, history });
  };

  const createDraft = () => assist.mutate({ messages: toHistory(messages) });

  const submitTicket = async (values) => {
    const ticket = await ticketsApi.create({ ...values, source: 'ai_assist' }).catch((err) => {
      toast.error(err.message);
      throw err;
    });
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    toast.success(`Ticket ${ticket.ticketNumber} created`);
    navigate(`/tickets/${ticket.id}`);
  };

  const lastAssistantIndex = messages.findLastIndex((m) => m.role === 'assistant' && m.result);

  return (
    <>
      <PageHeader
        title="AI troubleshooting assistant"
        description="Answers come from published company knowledge base articles. Always check the cited sources."
        actions={
          messages.length > 0 && (
            <Button variant="secondary" icon={RotateCcw} onClick={() => setMessages([])}>
              New conversation
            </Button>
          )
        }
      />

      {status.isLoading ? (
        <LoadingSpinner label="Checking AI service…" />
      ) : !available ? (
        <div className="space-y-6">
          <Alert tone="warning" icon={ShieldAlert} title={status.data?.configured === false ? 'The AI assistant is not configured' : status.data?.enabled === false ? 'The AI assistant is turned off' : 'The AI service is unavailable'}>
            {status.data?.configured === false
              ? 'An administrator needs to set GEMINI_API_KEY and GEMINI_MODEL on the server. No AI answers are generated until then.'
              : status.data?.enabled === false
                ? 'An administrator has disabled the assistant in Settings.'
                : 'We could not check the AI service status. Please try again later.'}
          </Alert>
          <Card title="You can still get help">
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/knowledge-base" variant="secondary" icon={BookOpen}>
                Search the knowledge base
              </ButtonLink>
              <ButtonLink to="/tickets/new" icon={Plus}>
                Create a support ticket
              </ButtonLink>
            </div>
          </Card>
        </div>
      ) : (
        <div className="card flex h-[calc(100dvh-13rem)] min-h-[28rem] flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto bg-slate-50/50 p-4 sm:p-6" aria-live="polite">
            {messages.length === 0 ? (
              <div className="mx-auto max-w-2xl py-6 text-center">
                <div className="mx-auto w-fit">
                  <AssistantAvatar />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">How can I help, {user.fullName.split(' ')[0]}?</h2>
                <p className="mt-1 text-sm text-slate-500">Describe the problem in your own words. If the knowledge base doesn't cover it, I'll say so and help you open a ticket.</p>
                <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
                  {SUGGESTIONS.map(([Icon, q]) => (
                    <button key={q} type="button" onClick={() => send(q)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-sm text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50/50">
                      <Icon className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <AIChatMessage key={i} message={m} userName={user.fullName} onCreateTicket={i === lastAssistantIndex ? createDraft : undefined} draftLoading={assist.isPending} />
              ))
            )}
            {chat.isPending && <TypingIndicator />}
          </div>

          <form onSubmit={handleSubmit((v) => send(v.message))} className="border-t border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <label htmlFor="ai-message" className="sr-only">
                Message the AI assistant
              </label>
              <textarea
                id="ai-message"
                rows={1}
                maxLength={MAX_LENGTH}
                placeholder="Describe your IT problem…"
                className="input max-h-40 min-h-[42px] resize-none [field-sizing:content]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(e.currentTarget.value);
                  }
                }}
                {...register('message')}
              />
              <Button type="submit" size="icon" className="size-[42px]" disabled={text.trim().length < 2 || chat.isPending} aria-label="Send message">
                <Send className="size-4" />
              </Button>
            </div>
            <p className="mt-2 flex justify-between gap-3 text-xs text-slate-400">
              <span>The assistant can make mistakes and cannot change accounts or systems. Enter to send, Shift+Enter for a new line.</span>
              <span className="tabular-nums">{text.length}/{MAX_LENGTH}</span>
            </p>
          </form>
        </div>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title="Review your ticket" description="The AI prepared this draft from your conversation. Edit anything before submitting." size="lg">
        {draft && (
          <>
            <div className="mb-4">
              <Alert tone="info" icon={Sparkles}>
                Nothing is submitted until you click <strong>Submit ticket</strong>.
              </Alert>
            </div>
            <TicketForm defaultValues={draft} onSubmit={submitTicket} onCancel={() => { setDraft(null); setFocus('message'); }} />
          </>
        )}
      </Modal>
    </>
  );
}
