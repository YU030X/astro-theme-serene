import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 15_000,
  fullyParallel: false,
  workers: 1,
  outputDir: 'docs/browser-evidence/results',
  reporter: [['list'], ['html', { outputFolder: 'docs/browser-evidence/report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4399',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome']
  },
  webServer: {
    command: 'node tests/browser/preview-server.mjs',
    url: 'http://127.0.0.1:4399',
    reuseExistingServer: false,
    timeout: 30_000
  }
})
