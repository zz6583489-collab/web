import { defineConfig } from '@playwright/test'

const apiOrigin = process.env.TEAMFLOW_API_ORIGIN ?? 'http://127.0.0.1:8081'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(apiOrigin)) {
  throw new Error('TEAMFLOW_API_ORIGIN must point to a local test server')
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: process.env.TEAMFLOW_E2E_BROWSER_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev --force --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    env: { VITE_API_PROXY_TARGET: apiOrigin },
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
