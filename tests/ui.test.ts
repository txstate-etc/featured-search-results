import { expect, test } from '@playwright/test'

test('index redirects unauthenticated visitors to the admin area and on to unified auth login', async ({ page }) => {
  await page.goto('/')
  // / 301s to /admin/results, whose layout load 302s to unified auth (the fakeauth stub in this harness).
  await expect(page).toHaveURL(/\/\/fakeauth\/login\?/)
  const url = new URL(page.url())
  expect(url.searchParams.get('clientId')).toEqual('search-featured-results')
  expect(url.searchParams.get('requestedUrl')).toContain('/admin/results')
})
