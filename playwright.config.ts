import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    // Points at whichever dev server this session already has running
    // (see .claude/launch.json / the Browser pane) rather than spawning a
    // second one - port 3000 in this environment can belong to a different
    // session's server for the same project, so a fixed webServer entry
    // here would either fight over the port or silently test the wrong
    // process. Override with PLAYWRIGHT_BASE_URL if that port ever changes.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:49153',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
})
