/**
 * Deterministic AI provider used ONLY by the automated test suite
 * (config.ai.provider is forced to "gemini" outside NODE_ENV=test).
 * It records every request so tests can assert what context the model received.
 */
export function createMockProvider() {
  const state = { requests: [], nextError: null, nextResponse: null, configured: true };

  return {
    name: 'mock',
    model: 'mock-model',
    state,
    isConfigured: () => state.configured,

    async generateJson(request) {
      state.requests.push(request);
      if (state.nextError) {
        const err = state.nextError;
        state.nextError = null;
        throw err;
      }
      if (state.nextResponse) {
        const res = state.nextResponse;
        state.nextResponse = null;
        return typeof res === 'function' ? res(request) : res;
      }

      const lastUserText = request.messages.at(-1).text;
      if (request.responseSchema.properties.subject) {
        return {
          subject: 'Laptop cannot connect to office Wi-Fi',
          description: 'The employee reports their laptop cannot join the office wireless network.',
          category: 'network',
          priority: 'medium',
          attemptedSteps: ['Restarted the laptop', 'Toggled Wi-Fi off and on'],
        };
      }

      // Echo back every article id that was supplied as context.
      const ids = [...lastUserText.matchAll(/<article id="([0-9a-f-]{36})"/g)].map((m) => m[1]);
      if (!ids.length) {
        return {
          answer: 'The knowledge base does not cover this question.',
          steps: ['Invented step that must be removed by the server'],
          nextStep: 'Create a support ticket.',
          category: 'other',
          priority: 'medium',
          needsHumanSupport: false,
          confidence: 'high',
          usedSourceIds: ['00000000-0000-4000-8000-000000000000'],
        };
      }
      return {
        answer: 'Based on the knowledge base articles provided, follow these steps.',
        steps: ['Step one from the article', 'Step two from the article'],
        nextStep: 'If the problem continues, create a support ticket.',
        category: 'network',
        priority: 'medium',
        needsHumanSupport: false,
        confidence: 'high',
        // Includes a fabricated id to prove the server discards unknown citations.
        usedSourceIds: [...ids, '11111111-1111-4111-8111-111111111111'],
      };
    },
  };
}
