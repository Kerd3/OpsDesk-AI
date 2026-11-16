import { defineConfig, devices } from '@playwright/test';

// E2E runs the real API (NODE_ENV=test → isolated TEST_DATABASE_URL and the
// mock AI provider) and the real Vite frontend on dedicated ports.
const API_PORT = 4100;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.js',
  fullyParallel: false,
  workers: 1, // tests share one seeded database
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /responsive/ },
    { name: 'responsive', use: { ...devices['Desktop Chrome'] }, testMatch: /responsive/ },
    // Opt-in: `npm run screenshots` regenerates docs/screenshots.
    { name: 'screenshots', use: { ...devices['Desktop Chrome'] }, testMatch: /\.capture\.js$/ },
  ],
  webServer: [
    {
      command: 'node ../backend/src/server.js',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { NODE_ENV: 'test', PORT: String(API_PORT), AI_RATE_LIMIT_PER_MINUTE: '1000', N8N_WEBHOOK_URL: '' },
    },
    {
      command: `npm --prefix ../frontend run dev -- --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
