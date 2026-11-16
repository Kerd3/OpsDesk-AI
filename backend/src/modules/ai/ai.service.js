import { config } from '../../config/env.js';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../../utils/constants.js';
import { serviceUnavailable } from '../../utils/errors.js';
import { getSetting } from '../settings/settings.service.js';
import { getAiProvider } from './ai.provider.js';
import { retrievePublishedArticles } from './retrieval.service.js';
import {
  TROUBLESHOOTING_SYSTEM_PROMPT,
  TICKET_ASSIST_SYSTEM_PROMPT,
  CHAT_RESPONSE_SCHEMA,
  TICKET_DRAFT_SCHEMA,
  buildKnowledgeContext,
  escapeData,
} from './prompts.js';

const NO_KNOWLEDGE_ANSWER =
  "I couldn't find a published knowledge base article that covers this, so I can't give you company-approved steps. " +
  'Please create a support ticket and the IT team will help you directly.';

export async function getAiStatus() {
  const provider = getAiProvider();
  const settings = await getSetting('ai');
  return {
    configured: provider.isConfigured(),
    enabled: settings.enabled,
    available: provider.isConfigured() && settings.enabled,
    provider: provider.name,
    model: provider.isConfigured() ? provider.model : null,
  };
}

async function assertAvailable() {
  const status = await getAiStatus();
  if (!status.configured) {
    throw serviceUnavailable('AI_NOT_CONFIGURED', 'The AI assistant is not configured. An administrator must set GEMINI_API_KEY and GEMINI_MODEL.');
  }
  if (!status.enabled) throw serviceUnavailable('AI_DISABLED', 'The AI assistant has been disabled by an administrator.');
  return getAiProvider();
}

/** Keep only the most recent turns, make sure the conversation starts with the user, trim lengths. */
function normalizeHistory(history = []) {
  const recent = history.slice(-config.ai.maxHistoryMessages).map((m) => ({ role: m.role, text: m.content.slice(0, config.ai.maxMessageLength) }));
  while (recent.length && recent[0].role !== 'user') recent.shift();
  // Merge consecutive messages from the same role (the Gemini API expects alternation).
  return recent.reduce((acc, m) => {
    const last = acc.at(-1);
    if (last && last.role === m.role) last.text += `\n\n${m.text}`;
    else acc.push({ ...m });
    return acc;
  }, []);
}

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const cleanList = (list, max, maxLen) =>
  (Array.isArray(list) ? list : []).filter((s) => typeof s === 'string' && s.trim()).slice(0, max).map((s) => s.trim().slice(0, maxLen));

export async function chat(_user, { message, history }) {
  const provider = await assertAvailable();
  const turns = normalizeHistory(history);

  // Include the previous user turn so follow-ups ("it still fails") keep their topic.
  const previousUserText = [...turns].reverse().find((t) => t.role === 'user')?.text ?? '';
  let articles = await retrievePublishedArticles(message);
  if (!articles.length && previousUserText) articles = await retrievePublishedArticles(`${message} ${previousUserText}`);

  const userTurn = `${buildKnowledgeContext(articles)}\n\n<employee_message>\n${escapeData(message)}\n</employee_message>`;
  const raw = await provider.generateJson({
    systemInstruction: TROUBLESHOOTING_SYSTEM_PROMPT,
    messages: [...(turns.at(-1)?.role === 'user' ? turns.slice(0, -1) : turns), { role: 'user', text: userTurn }],
    responseSchema: CHAT_RESPONSE_SCHEMA,
  });

  // Server-side guardrails: the model's output is validated, never trusted blindly.
  const retrievedIds = new Set(articles.map((a) => a.id));
  const usedIds = cleanList(raw.usedSourceIds, 10, 64).filter((id) => retrievedIds.has(id));
  const grounded = usedIds.length > 0;
  const confidence = pick(raw.confidence, ['high', 'medium', 'low'], 'low');

  return {
    answer: grounded ? String(raw.answer ?? '').slice(0, 4000) : NO_KNOWLEDGE_ANSWER,
    // Without a supporting article there are no approved steps to show.
    steps: grounded ? cleanList(raw.steps, 12, 500) : [],
    nextStep: grounded ? String(raw.nextStep ?? '').slice(0, 500) : 'Create a support ticket so IT can investigate.',
    suggestedCategory: pick(raw.category, TICKET_CATEGORIES, 'other'),
    suggestedPriority: pick(raw.priority, TICKET_PRIORITIES, 'medium'),
    needsHumanSupport: !grounded || confidence !== 'high' || raw.needsHumanSupport === true,
    confidence: grounded ? confidence : 'low',
    grounded,
    sources: articles.filter((a) => usedIds.includes(a.id)).map(({ id, slug, title, description }) => ({ id, slug, title, description })),
    retrievedCount: articles.length,
  };
}

export async function draftTicket(_user, { messages }) {
  const provider = await assertAvailable();
  const transcript = normalizeHistory(messages)
    .map((m) => `${m.role === 'user' ? 'Employee' : 'Assistant'}: ${escapeData(m.text)}`)
    .join('\n\n');

  const raw = await provider.generateJson({
    systemInstruction: TICKET_ASSIST_SYSTEM_PROMPT,
    messages: [{ role: 'user', text: `<transcript>\n${transcript}\n</transcript>\n\nPrepare the ticket draft.` }],
    responseSchema: TICKET_DRAFT_SCHEMA,
  });

  const subject = String(raw.subject ?? '').trim().slice(0, 200);
  const attemptedSteps = cleanList(raw.attemptedSteps, 10, 300);
  let description = String(raw.description ?? '').trim().slice(0, 8000);
  if (attemptedSteps.length) description += `\n\nSteps already tried:\n${attemptedSteps.map((s) => `- ${s}`).join('\n')}`;

  return {
    subject: subject.length >= 3 ? subject : 'IT support request',
    description: description.length >= 10 ? description : 'Please describe the problem in more detail.',
    category: pick(raw.category, TICKET_CATEGORIES, 'other'),
    priority: pick(raw.priority, TICKET_PRIORITIES, 'medium'),
    attemptedSteps,
    // The draft is never submitted automatically; the employee reviews it first.
    requiresReview: true,
  };
}
