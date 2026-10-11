import { expect, test, type Page } from '@playwright/test'

interface SearchHarness {
  events: string[]
  resolveSearch(query: string, results?: unknown[]): void
  resolveData(query: string): void
}

declare global {
  interface Window {
    __a11ySearch: SearchHarness
    __a11yErrors: string[]
  }
}

const pagefindModule = `
  const h = window.__a11ySearch;
  const pending = new Map();
  const wait = (query, value) => new Promise((resolve, reject) => {
    pending.set(query, { resolve, reject, value });
  });
  h.resolveSearch = (query, results = [{ data: () => Promise.resolve({ url: '/blog/welcome-to-serene/', excerpt: '<mark>' + query + '</mark> result', meta: { title: 'Mock ' + query } }) }]) => {
    const request = pending.get('search:' + query);
    if (request) request.resolve({ results });
    else pending.set('search:' + query, { resolve: () => {}, results });
  };
  h.resolveData = query => {
    const request = pending.get('data:' + query);
    if (request) request.resolve({
      url: '/blog/welcome-to-serene/',
      excerpt: '<mark>' + query + '</mark> result',
      meta: { title: 'Mock ' + query }
    });
  };
  export async function init() {}
  export function search(query) {
    h.events.push('search:' + query);
    if (query === 'error') return Promise.reject(new Error('mock search failure'));
    return new Promise(resolve => pending.set('search:' + query, { resolve }));
  }
`

const unsafeModule = `
  export async function init() {}
  export function search() {
    return Promise.resolve({ results: [{ data: () => Promise.resolve({
      url: '/blog/welcome-to-serene/',
      excerpt: '<script>window.__marker = true</script><style>body{}</style><img src=x onerror="window.__marker=true"><svg onload="window.__marker=true"><text>svg</text></svg><iframe src="javascript:window.__marker=true"></iframe><mark>安全 &amp; highlight</mark><strong>普通 &lt;文本&gt;</strong>',
      meta: { title: '<img src=x onerror="window.__marker=true">实体 &amp; title' }
    }) }] });
  }
`

async function install(page: Page, module = pagefindModule) {
  await page.addInitScript(() => {
    window.__a11ySearch = { events: [], resolveSearch: () => {}, resolveData: () => {} }
    window.__a11yErrors = []
    window.addEventListener('error', event => window.__a11yErrors.push(event.message))
    window.addEventListener('unhandledrejection', event => window.__a11yErrors.push(String(event.reason)))
  })
  await page.route('**/pagefind/pagefind.js*', route =>
    route.fulfill({ contentType: 'text/javascript', body: module }))
  await page.goto('/')
}

async function openWithKeyboard(page: Page, modifier: 'Control' | 'Meta' = 'Control') {
  await page.keyboard.press(`${modifier}+KeyK`)
  const dialog = page.locator('#search-dialog')
  await expect(dialog).toBeVisible()
  return dialog.locator('input[type="search"]')
}

test.describe('search accessibility acceptance', () => {
  test.afterEach(async ({ page }) => {
    expect(await page.evaluate(() => window.__a11yErrors)).toEqual([])
  })

  test('Ctrl/Cmd-K opens, focuses input, tabs to result, Enter navigates, Escape restores opener', async ({ page }) => {
    await install(page)
    const opener = page.locator('[data-search-open]').first()
    await opener.focus()
    const input = await openWithKeyboard(page)
    await expect(input).toBeFocused()
    await input.fill('serene')
    await expect.poll(() => page.evaluate(() => window.__a11ySearch.events)).toContain('search:serene')
    await page.evaluate(() => window.__a11ySearch.resolveSearch('serene'))
    await expect(page.locator('.search-result')).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-search-close]')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.locator('.search-result')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/blog\/welcome-to-serene\/?$/)
    await opener.focus()
    await page.keyboard.press('Meta+KeyK')
    await expect(page.locator('#search-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(opener).toBeFocused()
  })

  test('dialog focus remains contained while tabbing and Escape closes it', async ({ page }) => {
    await install(page)
    await openWithKeyboard(page)
    const dialog = page.locator('#search-dialog')
    for (let index = 0; index < 3; index++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.closest('#search-dialog') !== null)).toBe(true)
    }
    await page.keyboard.press('Shift+Tab')
    expect(await page.evaluate(() => document.activeElement?.closest('#search-dialog') !== null)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('status is polite atomic status and results are native links, not a listbox', async ({ page }) => {
    await install(page)
    const input = await openWithKeyboard(page)
    const status = page.locator('#search-status')
    await expect(status).toHaveAttribute('role', 'status')
    await expect(status).toHaveAttribute('aria-live', 'polite')
    await expect(status).toHaveAttribute('aria-atomic', 'true')
    await expect(input).toHaveAttribute('aria-controls', 'search-results')
    await expect(page.locator('#search-results')).not.toHaveAttribute('role', 'listbox')
    await input.fill('x')
    await expect.poll(() => page.evaluate(() => window.__a11ySearch.events)).toContain('search:x')
  })

  test('loading, count, empty and error states are announced from the real dialog', async ({ page }) => {
    await install(page)
    const input = await openWithKeyboard(page)
    await expect(page.locator('#search-status')).toContainText('Search ready')
    await input.fill('one')
    await expect.poll(() => page.evaluate(() => window.__a11ySearch.events)).toContain('search:one')
    await page.evaluate(() => window.__a11ySearch.resolveSearch('one'))
    await expect(page.locator('#search-status')).toHaveText('1 search result.')
    await input.fill('empty')
    await expect(page.locator('#search-status')).toContainText('Searching')
    await expect.poll(() => page.evaluate(() => window.__a11ySearch.events)).toContain('search:empty')
    await page.evaluate(() => window.__a11ySearch.resolveSearch('empty', []))
    await expect(page.locator('.search-empty')).toContainText('No results')
    await expect(page.locator('#search-status')).toContainText('No results')
    await input.fill('error')
    await expect(page.locator('[data-search-retry]')).toBeVisible()
    await expect(page.locator('#search-status')).toContainText('Search failed')
  })

  test('sanitizes hostile Pagefind output while retaining mark text and safe links', async ({ page }) => {
    await install(page, unsafeModule)
    await openWithKeyboard(page)
    await page.locator('input[type="search"]').fill('安全')
    await expect(page.locator('.search-result')).toBeVisible()
    await expect(page.locator('.search-result-excerpt')).toHaveText('安全 & highlight普通 <文本>')
    await expect(page.locator('.search-result-excerpt mark')).toHaveText('安全 & highlight')
    await expect(page.locator('#search-results script, #search-results style, #search-results img, #search-results svg, #search-results iframe')).toHaveCount(0)
    expect(await page.evaluate(() => (window as Window & { __marker?: boolean }).__marker)).toBeUndefined()
  })

  test('unsafe protocols are excluded from result links and counts', async ({ page }) => {
    await install(page, `export async function init() {} export function search() {
      return Promise.resolve({ results: ['javascript:alert(1)', 'data:text/html,unsafe'].map(url => ({
        data: () => Promise.resolve({ url, excerpt: '<mark>bad</mark>', meta: { title: 'Unsafe' } })
      })) })
    }`)
    await openWithKeyboard(page)
    await page.locator('input[type="search"]').fill('unsafe')
    await expect(page.locator('.search-empty')).toContainText('No results')
    await expect(page.locator('.search-result')).toHaveCount(0)
    await expect(page.locator('#search-status')).toContainText('No results')
  })

  test('renders hostile title as text and preserves safe relative result URL', async ({ page }) => {
    await install(page, `export async function init() {} export function search() { return Promise.resolve({ results: [{ data: () => Promise.resolve({ url: '/blog/welcome-to-serene/', excerpt: '<mark>正常</mark> &amp; text', meta: { title: '<b>纯文本</b>' } }) }] }) }`)
    await openWithKeyboard(page)
    await page.locator('input[type="search"]').fill('normal')
    await expect(page.locator('.search-result')).toBeVisible()
    await expect(page.locator('.search-result')).toHaveAttribute('href', /\/blog\/welcome-to-serene\//)
    await expect(page.locator('.search-result-title')).toHaveText('<b>纯文本</b>')
    await expect(page.locator('.search-result-excerpt mark')).toHaveText('正常')
  })

  test('composition preedit does not search; compositionend trailing input searches once', async ({ page }) => {
    await install(page)
    const input = await openWithKeyboard(page)
    await page.evaluate(() => {
      const target = document.querySelector<HTMLInputElement>('input[type="search"]')!
      target.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'に' }))
      target.value = 'に'
      target.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'に', isComposing: true }))
      target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape', isComposing: true }))
    })
    await page.waitForTimeout(220)
    await expect(page.locator('#search-dialog')).toBeVisible()
    expect(await page.evaluate(() => window.__a11ySearch.events)).toEqual([])
    await page.evaluate(() => {
      const target = document.querySelector<HTMLInputElement>('input[type="search"]')!
      target.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'に' }))
      target.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'に', isComposing: false }))
    })
    await expect.poll(() => page.evaluate(() => window.__a11ySearch.events.filter(event => event === 'search:に').length)).toBe(1)
  })

  test('starting composition invalidates an already pending query', async ({ page }) => {
    await install(page)
    const input = await openWithKeyboard(page)
    await input.fill('old')
    await expect.poll(() => page.evaluate(() => window.__a11ySearch.events)).toContain('search:old')
    await input.evaluate((target: HTMLInputElement) => {
      target.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      target.value = '中文'
      target.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
    })
    await page.evaluate(() => window.__a11ySearch.resolveSearch('old'))
    await expect(page.locator('#search-results')).toBeEmpty()
    await expect(page.locator('#search-dialog')).toBeVisible()
    await input.evaluate((target: HTMLInputElement) => {
      target.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    })
    await expect.poll(() => page.evaluate(() => window.__a11ySearch.events)).toContain('search:中文')
    await page.evaluate(() => window.__a11ySearch.resolveSearch('中文'))
    await expect(page.locator('.search-result-title')).toHaveText('Mock 中文')
  })
})
