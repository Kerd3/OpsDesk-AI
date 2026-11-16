// Unit tests for the Gemini provider's HTTP handling, using a stubbed fetch (no network, no database).
import { test, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiProvider } from '../src/modules/ai/providers/gemini.provider.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const ok = (json) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }), { status: 200 });
const fail = (status, message = 'error') => new Response(JSON.stringify({ error: { message } }), { status });

/** Replace fetch with a queue of responses and count the calls. */
function stubFetch(...responses) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    return typeof next === 'function' ? next(init) : next;
  };
  return calls;
}

const provider = (timeoutMs = 2000) => createGeminiProvider({ apiKey: 'test-key', model: 'test-model', timeoutMs });
const request = { systemInstruction: 'rules', messages: [{ role: 'user', text: 'hi' }], responseSchema: { type: 'OBJECT' } };

describe('Gemini provider', () => {
  test('sends the key in a header, never in the URL, and parses the JSON answer', async () => {
    const calls = stubFetch(ok({ answer: 'hello' }));
    assert.deepEqual(await provider().generateJson(request), { answer: 'hello' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.headers['x-goog-api-key'], 'test-key');
    assert.equal(String(calls[0].url).includes('test-key'), false);
  });

  test('retries once when Gemini is temporarily overloaded (503)', async () => {
    const calls = stubFetch(fail(503, 'This model is currently experiencing high demand.'), ok({ answer: 'second try' }));
    assert.deepEqual(await provider().generateJson(request), { answer: 'second try' });
    assert.equal(calls.length, 2);
  });

  test('gives up after the retry with a clear "busy" error', async () => {
    const calls = stubFetch(fail(503), fail(503));
    await assert.rejects(provider().generateJson(request), (err) => err.code === 'AI_BUSY' && err.status === 503);
    assert.equal(calls.length, 2);
  });

  test('does not retry configuration errors such as a retired model (404)', async () => {
    const calls = stubFetch(fail(404, 'This model is no longer available to new users.'));
    await assert.rejects(provider().generateJson(request), (err) => err.code === 'AI_MISCONFIGURED');
    assert.equal(calls.length, 1);
  });

  test('does not retry rate limiting (429)', async () => {
    const calls = stubFetch(fail(429));
    await assert.rejects(provider().generateJson(request), (err) => err.code === 'AI_RATE_LIMITED');
    assert.equal(calls.length, 1);
  });

  test('the timeout covers all attempts, so a retry cannot exceed it', async () => {
    // Every call hangs until the shared deadline aborts it.
    const hang = (init) =>
      new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
    stubFetch(fail(503), hang);
    const started = Date.now();
    await assert.rejects(provider(1300).generateJson(request), (err) => err.code === 'AI_TIMEOUT');
    assert.ok(Date.now() - started < 1800, 'finished close to the 1.3 s deadline');
  });

  test('unreadable model output is reported, not passed through', async () => {
    stubFetch(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }), { status: 200 }));
    await assert.rejects(provider().generateJson(request), (err) => err.code === 'AI_INVALID_RESPONSE');
  });
});
