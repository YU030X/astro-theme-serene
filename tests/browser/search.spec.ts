import { expect, test, type Page } from '@playwright/test'

interface Harness {
  events: { name: string; query: string }[]
  errors: string[]
  initRejectOnce?: boolean
  initRejected?: boolean
  initBlocked?: boolean
  resolveInit(): void
  resolveSearch(query: string, empty?: boolean): void
  rejectSearch(query: string): void
  resolveData(query: string, title?: string): void
  rejectData(query: string): void
  detachedResults?: HTMLElement
}

declare global {
  interface Window {
    __searchHarness: Harness
  }
}

// Run the actual production interaction script, controlling only Pagefind I/O.
const pagefindModule = `
  const h = window.__searchHarness;
  const pending = new Map();
  const event = (name, query = '') => h.events.push({ name, query });
  const defer = (kind, query) => new Promise((resolve, reject) => {
    const key = kind + ':' + query;
    const queue = pending.get(key) || [];
    queue.push({ resolve, reject });
    pending.set(key, queue);
  });
  const settle = (kind, query, value, failed = false) => {
    const request = pending.get(kind + ':' + query)?.shift();
    if (!request) throw new Error('No pending ' + kind + ' for ' + query);
    event(kind + ':settled', query);
    failed ? request.reject(new Error(kind + ' failed')) : request.resolve(value);
  };
  h.resolveSearch = (query, empty = false) => settle('search', query, {
    results: empty ? [] : [{ data: () => {
      event('data:start', query);
      return defer('data', query);
    } }]
  });
  h.rejectSearch = query => settle('search', query, null, true);
  h.resolveData = (query, title = 'Mock ' + query) => settle('data', query, {
    url: '/blog/welcome-to-serene/',
    excerpt: '<mark>' + query + '</mark> result',
    meta: { title }
  });
  h.rejectData = query => settle('data', query, null, true);
  export async function init() {
    event('init:start');
    if (h.initBlocked) await new Promise(resolve => h.resolveInit = resolve);
    event('init:settled');
    if (h.initRejectOnce && !h.initRejected) {
      h.initRejected = true;
      throw new Error('init failed');
    }
  }
  export function search(query) {
    event('search:start', query);
    return defer('search', query);
  }
`

async function waitEvent(page: Page, name: string, query = '', count = 1) {
  await expect.poll(() => page.evaluate(({ name, query }) =>
    window.__searchHarness.events.filter(event =>
      event.name === name && event.query === query).length,
  { name, query })).toBe(count)
}

async function openSearch(page: Page) {
  await page.locator('[data-search-open]').first().click()
  await expect(page.locator('#search-dialog')).toBeVisible()
  return page.locator('#search-dialog input[type="search"]')
}

async function completeSearch(page: Page, query: string, title?: string, count = 1) {
  await page.evaluate(query => window.__searchHarness.resolveSearch(query), query)
  await waitEvent(page, 'data:start', query, count)
  await page.evaluate(({ query, title }) =>
    window.__searchHarness.resolveData(query, title), { query, title })
}

test.describe('controlled Pagefind failures and timing', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__searchHarness = { events: [], errors: [] } as unknown as Harness
      window.addEventListener('unhandledrejection', event => {
        window.__searchHarness.errors.push(String(event.reason))
      })
      window.addEventListener('error', event => {
        window.__searchHarness.errors.push(event.message)
      })
    })
    await page.route('**/pagefind/pagefind.js*', route =>
      route.fulfill({ contentType: 'text/javascript', body: pagefindModule }))
    await page.goto('/')
  })

  test.afterEach(async ({ page }) => {
    expect(await page.evaluate(() => window.__searchHarness.errors)).toEqual([])
  })

  test('only B renders when slower A finishes last', async ({ page }) => {
    const input = await openSearch(page)
    await input.fill('a')
    await waitEvent(page, 'search:start', 'a')
    await input.fill('b')
    await waitEvent(page, 'search:start', 'b')
    await completeSearch(page, 'b')
    await expect(page.locator('.search-result-title')).toHaveText('Mock b')
    await page.evaluate(() => window.__searchHarness.resolveSearch('a'))
    await waitEvent(page, 'search:settled', 'a')
    await expect(page.locator('.search-result-title')).toHaveText('Mock b')
  })

  test('late result data cannot overwrite B', async ({ page }) => {
    const input = await openSearch(page)
    await input.fill('a')
    await waitEvent(page, 'search:start', 'a')
    await page.evaluate(() => window.__searchHarness.resolveSearch('a'))
    await waitEvent(page, 'data:start', 'a')
    await input.fill('b')
    await waitEvent(page, 'search:start', 'b')
    await completeSearch(page, 'b')
    await expect(page.locator('.search-result-title')).toHaveText('Mock b')
    await page.evaluate(() => window.__searchHarness.resolveData('a'))
    await waitEvent(page, 'data:settled', 'a')
    await expect(page.locator('.search-result-title')).toHaveText('Mock b')
  })

  test('clearing input immediately removes state and invalidates A', async ({ page }) => {
    const input = await openSearch(page)
    await input.fill('a')
    await waitEvent(page, 'search:start', 'a')
    await input.fill('')
    await expect(page.locator('#search-hint')).toContainText('Type to search')
    await expect(page.locator('[data-search-retry]')).toBeHidden()
    await page.evaluate(() => window.__searchHarness.resolveSearch('a'))
    await waitEvent(page, 'search:settled', 'a')
    await expect(page.locator('#search-results')).toBeEmpty()
  })

  test('one Escape closes, restores focus and reopening reruns the query', async ({ page }) => {
    const input = await openSearch(page)
    await input.fill('a')
    await waitEvent(page, 'search:start', 'a')
    await page.keyboard.press('Escape')
    await expect(page.locator('#search-dialog')).toBeHidden()
    await expect(page.locator('[data-search-open]').first()).toBeFocused()
    await openSearch(page)
    await waitEvent(page, 'search:start', 'a', 2)
    // The first request belongs to the closed dialog; the second is current.
    await page.evaluate(() => window.__searchHarness.resolveSearch('a'))
    await waitEvent(page, 'search:settled', 'a')
    await expect(page.locator('#search-results')).toBeEmpty()
    await completeSearch(page, 'a', 'Reopened')
    await expect(page.locator('.search-result-title')).toHaveText('Reopened')
  })

  test('closing during stalled index init ignores its completion', async ({ page }) => {
    await page.evaluate(() => { window.__searchHarness.initBlocked = true })
    await openSearch(page)
    await waitEvent(page, 'init:start')
    await page.locator('[data-search-close]').click()
    await expect(page.locator('#search-dialog')).toBeHidden()
    const status = await page.locator('#search-status').textContent()
    await page.evaluate(() => window.__searchHarness.resolveInit())
    await waitEvent(page, 'init:settled')
    await expect(page.locator('#search-status')).toHaveText(status ?? '')
    await expect(page.locator('#search-results')).toBeEmpty()
  })

  test('soft navigation invalidates pending data and new page search works', async ({ page }) => {
    const input = await openSearch(page)
    await input.fill('a')
    await waitEvent(page, 'search:start', 'a')
    await page.evaluate(() => window.__searchHarness.resolveSearch('a'))
    await waitEvent(page, 'data:start', 'a')
    await page.evaluate(() => {
      window.__searchHarness.detachedResults = document.getElementById('search-results')!
      const link = document.createElement('a')
      link.href = '/about/'
      document.body.append(link)
      link.click()
      link.remove()
    })
    await expect(page).toHaveURL(/\/about\/?$/)
    await expect(page.locator('h1')).toBeVisible()
    // A preserved harness confirms ClientRouter navigation, not a full reload.
    await page.evaluate(() => window.__searchHarness.resolveData('a'))
    await waitEvent(page, 'data:settled', 'a')
    expect(await page.evaluate(() =>
      window.__searchHarness.detachedResults?.childElementCount)).toBe(0)
    await expect(page.locator('#search-results')).toBeEmpty()
    const nextInput = await openSearch(page)
    await nextInput.fill('b')
    await waitEvent(page, 'search:start', 'b')
    await completeSearch(page, 'b')
    await expect(page.locator('.search-result-title')).toHaveText('Mock b')
  })

  test('failed init retries successfully with empty input', async ({ page }) => {
    await page.evaluate(() => { window.__searchHarness.initRejectOnce = true })
    await openSearch(page)
    await expect(page.locator('[data-search-retry]')).toBeVisible()
    await expect(page.locator('#search-hint')).not.toContainText('build')
    await page.locator('[data-search-retry]').click()
    await waitEvent(page, 'init:start', '', 2)
    await expect(page.locator('#search-hint')).toContainText('Type to search')
    await expect(page.locator('[data-search-retry]')).toBeHidden()
  })

  for (const query of ['', 'retry']) {
    test(`failed module import retries with ${query ? 'nonempty' : 'empty'} input`, async ({ page }) => {
      let requests = 0
      const failures = query ? 2 : 1
      await page.route('**/pagefind/pagefind.js*', route => {
        requests++
        return requests <= failures
          ? route.fulfill({ status: 503, contentType: 'text/javascript', body: '' })
          : route.fulfill({ contentType: 'text/javascript', body: pagefindModule })
      })
      const input = await openSearch(page)
      await expect(page.locator('[data-search-retry]')).toBeVisible()
      if (query) {
        await input.fill(query)
        await expect.poll(() => requests).toBe(2)
        await expect(page.locator('[data-search-retry]')).toBeVisible()
      }
      await page.locator('[data-search-retry]').click()
      await waitEvent(page, 'init:settled')
      expect(requests).toBe(failures + 1)
      if (query) {
        await waitEvent(page, 'search:start', query)
        await completeSearch(page, query)
        await expect(page.locator('.search-result-title')).toHaveText('Mock retry')
      } else {
        await expect(page.locator('#search-hint')).toContainText('Type to search')
      }
      await expect(page.locator('[data-search-retry]')).toBeHidden()
    })
  }

  for (const stage of ['search', 'data'] as const) {
    test(`${stage} rejection recovers when Retry is clicked`, async ({ page }) => {
      const input = await openSearch(page)
      await input.fill('broken')
      await waitEvent(page, 'search:start', 'broken')
      if (stage === 'data') {
        await page.evaluate(() => window.__searchHarness.resolveSearch('broken'))
        await waitEvent(page, 'data:start', 'broken')
        await page.evaluate(() => window.__searchHarness.rejectData('broken'))
      } else {
        await page.evaluate(() => window.__searchHarness.rejectSearch('broken'))
      }
      await expect(page.locator('#search-hint')).toContainText('Search failed')
      await expect(page.locator('[data-search-retry]')).toBeVisible()
      if (stage === 'search') {
        await page.screenshot({ path: 'docs/browser-evidence/search-error.png' })
      }
      await page.locator('[data-search-retry]').click()
      await waitEvent(page, 'search:start', 'broken', 2)
      await completeSearch(page, 'broken', 'Recovered', stage === 'data' ? 2 : 1)
      await expect(page.locator('.search-result-title')).toHaveText('Recovered')
      await expect(page.locator('[data-search-retry]')).toBeHidden()
    })
  }

  test('loading, empty results and errors have separate states', async ({ page }) => {
    const input = await openSearch(page)
    await input.fill('none')
    await waitEvent(page, 'search:start', 'none')
    await expect(page.locator('#search-hint')).toContainText('Searching')
    await page.screenshot({ path: 'docs/browser-evidence/search-loading.png' })
    await page.evaluate(() => window.__searchHarness.resolveSearch('none', true))
    await expect(page.locator('.search-empty')).toContainText('No results')
    await expect(page.locator('#search-hint')).toBeHidden()
    await input.fill('bad')
    await expect(page.locator('.search-empty')).toHaveCount(0)
    await waitEvent(page, 'search:start', 'bad')
    await page.evaluate(() => window.__searchHarness.rejectSearch('bad'))
    await expect(page.locator('[data-search-retry]')).toBeVisible()
    await input.fill('')
    await expect(page.locator('[data-search-retry]')).toBeHidden()
    await expect(page.locator('#search-status')).toHaveText('Search cleared.')
  })

  for (const [width, theme] of [[320, 'light'], [390, 'dark'], [1440, 'light']] as const) {
    test(`search has no horizontal overflow at ${width}px in ${theme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(theme => {
        document.documentElement.setAttribute('data-theme', theme)
      }, theme)
      await openSearch(page)
      await waitEvent(page, 'init:settled')
      await expect(page.locator('[data-search-retry]')).toBeHidden()
      const dimensions = await page.locator('#search-dialog').evaluate(dialog => ({
        scrollWidth: dialog.scrollWidth,
        clientWidth: dialog.clientWidth,
        left: dialog.getBoundingClientRect().left,
        right: dialog.getBoundingClientRect().right,
        viewport: window.innerWidth
      }))
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
      expect(dimensions.left).toBeGreaterThanOrEqual(0)
      expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport)
      expect(await page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: `docs/browser-evidence/search-${width}-${theme}.png` })
    })
  }
})

test('real production Pagefind result opens a readable article', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const input = await openSearch(page)
  await input.fill('Serene')
  const result = page.locator('.search-result').first()
  await expect(result).toBeVisible({ timeout: 10_000 })
  await expect(result).toHaveAttribute('href', /\/blog\//)
  const title = (await result.locator('.search-result-title').textContent())?.trim()
  expect(title).toBeTruthy()
  await result.click()
  await expect(page).toHaveURL(/\/blog\//)
  await expect(page.locator('h1')).toHaveText(title!)
  expect(errors).toEqual([])
})

test('real Pagefind import recovers from a transient HTTP failure', async ({ page }) => {
  let requests = 0
  await page.route('**/pagefind/pagefind.js*', route => {
    requests++
    return requests === 1
      ? route.fulfill({ status: 503, contentType: 'text/javascript', body: '' })
      : route.continue()
  })
  await page.goto('/')
  const input = await openSearch(page)
  await expect(page.locator('[data-search-retry]')).toBeVisible()
  await page.locator('[data-search-retry]').click()
  await expect(page.locator('#search-hint')).toContainText('Type to search')
  await input.fill('Serene')
  await expect(page.locator('.search-result').first()).toBeVisible({ timeout: 10_000 })
  expect(requests).toBe(2)
})
