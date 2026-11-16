import { AppError } from '../../../utils/errors.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Google Gemini provider (REST, no SDK). Converts provider failures into
 * AppErrors with safe messages; raw provider responses are only logged.
 */
export function createGeminiProvider({ apiKey, model, timeoutMs }) {
  return {
    name: 'gemini',
    model,
    isConfigured: () => Boolean(apiKey && model),

    /**
     * @param {object} req
     * @param {string} req.systemInstruction  trusted rules
     * @param {{role: 'user'|'assistant', text: string}[]} req.messages  conversation, last one is the user turn
     * @param {object} req.responseSchema  OpenAPI-style schema for JSON output
     * @returns {Promise<object>} parsed JSON produced by the model
     */
    async generateJson({ systemInstruction, messages, responseSchema, temperature = 0.2 }) {
      const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));

      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
      // One deadline covers every attempt, so a retry never makes the employee wait longer than timeoutMs.
      const deadline = AbortSignal.timeout(timeoutMs);

      let response;
      let payload;
      for (let attempt = 1; ; attempt += 1) {
        try {
          response = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body,
            signal: deadline,
          });
          payload = await response.json().catch(() => null);
        } catch (err) {
          if (err.name === 'TimeoutError' || deadline.aborted) {
            throw new AppError(504, 'AI_TIMEOUT', 'The AI assistant took too long to respond. Please try again.');
          }
          console.error('[ai] Gemini network error:', err.cause?.code || err.message);
          throw new AppError(502, 'AI_UNAVAILABLE', 'The AI service could not be reached. Please try again later.');
        }
        // Gemini reports short-lived overload ("high demand") as 503/500: retry once after a pause.
        const transient = response.status === 503 || response.status === 500;
        if (!transient || attempt >= MAX_ATTEMPTS) break;
        console.warn(`[ai] Gemini HTTP ${response.status} (attempt ${attempt}), retrying: ${payload?.error?.message ?? 'no body'}`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        if (deadline.aborted) throw new AppError(504, 'AI_TIMEOUT', 'The AI assistant took too long to respond. Please try again.');
      }

      if (!response.ok) {
        console.error(`[ai] Gemini HTTP ${response.status}:`, payload?.error?.message ?? 'no body');
        if (response.status === 503) throw new AppError(503, 'AI_BUSY', 'The AI service is under heavy load right now. Please try again in a moment.');
        if (response.status === 429) throw new AppError(429, 'AI_RATE_LIMITED', 'The AI service is busy right now. Please try again in a minute.');
        if (response.status === 401 || response.status === 403) {
          throw new AppError(503, 'AI_MISCONFIGURED', 'The AI service is not configured correctly. Please contact an administrator.');
        }
        if (response.status === 404) throw new AppError(503, 'AI_MISCONFIGURED', 'The configured AI model is not available. Please contact an administrator.');
        throw new AppError(502, 'AI_UNAVAILABLE', 'The AI service returned an error. Please try again later.');
      }

      if (payload?.promptFeedback?.blockReason) {
        throw new AppError(422, 'AI_BLOCKED', 'The AI service declined to answer this message. Try rephrasing it or create a support ticket.');
      }
      const candidate = payload?.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (!text) {
        console.error('[ai] Gemini returned no text, finishReason =', candidate?.finishReason);
        throw new AppError(502, 'AI_EMPTY_RESPONSE', 'The AI assistant did not return an answer. Please try again.');
      }
      try {
        return JSON.parse(text);
      } catch {
        console.error('[ai] Gemini returned invalid JSON, finishReason =', candidate?.finishReason);
        throw new AppError(502, 'AI_INVALID_RESPONSE', 'The AI assistant returned an unreadable answer. Please try again.');
      }
    },
  };
}
