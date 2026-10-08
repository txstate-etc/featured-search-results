import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
  webServer: {
    // The app under test runs in its own container (see docker-compose.test.yml), so the
    // command here is a no-op placeholder. Playwright polls `url` until the app answers,
    // which makes the test runner wait out the app's mongo-connect/startup time.
    command: 'while true; do sleep 600; done',
    url: 'http://search-featured-results/search?q=',
    timeout: 120_000,
    // The "server" is never started by this config, so an already-up app must not be an error.
    reuseExistingServer: true
  },
  use: {
    baseURL: 'http://search-featured-results'
  },
  testDir: 'tests',
  testMatch: /(.+\.)?(test|spec)\.[jt]s/,
  // Tests share seeded database state, so keep them on one worker.
  workers: 1,
  reporter: 'list'
}

export default config
