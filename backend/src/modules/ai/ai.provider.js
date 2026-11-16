import { config } from '../../config/env.js';
import { createGeminiProvider } from './providers/gemini.provider.js';
import { createMockProvider } from './providers/mock.provider.js';

// Provider abstraction: the rest of the app only calls provider.generateJson().
// Adding another vendor means adding one file in ./providers and a case here.
let provider;

export function getAiProvider() {
  if (!provider) {
    provider =
      config.ai.provider === 'mock'
        ? createMockProvider()
        : createGeminiProvider({ apiKey: config.ai.geminiApiKey, model: config.ai.geminiModel, timeoutMs: config.ai.timeoutMs });
  }
  return provider;
}
