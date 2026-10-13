import { expect, test, type Page, type Route } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'

const api = 'https://github-contributions-api.jogruber.de/v4/**'
const cacheKey = 'serene:github-contributions:example:last'
const data = (count = 3) => ({ contributions: [{ date: '2026-07-01', count, level: 2 }] })
const calendar = (page: Page) => page.locator('[data-github-contributions]')
const json = (route: Route, body: unknown) => route.fulfill({ json: body })
const assets = 'docs/browser-fixture-dist/_astro'
const entry = readdirSync(assets).find(name => name.startsWith('WalineThread.') && name.endsWith('.js'))!
const client = readFileSync(`${assets}/${entry}`, 'utf8').match(/import\([`'"]\.\/([^`'"]+)[`'"]\)/)?.[1]
if (!client) throw new Error('Cannot locate the built Waline client import')
const clientRoute = `**/${client}`

test.describe('contribution calendar', () => {
  test('successful data is keyboard accessible and fresh cache avoids another request', async ({ page }) => {
    let requests = 0
    await page.route(api, route => { requests++; return json(route, data()) })
    await page.goto('/projects/')
    await expect(calendar(page)).toHaveAttribute('data-state', 'ready')
    await expect(calendar(page).getByRole('button')).toHaveAccessibleName(/3 contributions/)
    await calendar(page).getByRole('button').focus()
    await expect(calendar(page).getByRole('button')).toBeFocused()
    await page.reload()
    await expect(calendar(page)).toHaveAttribute('data-state', 'ready')
    expect(requests).toBe(1)
  })

  for (const refresh of ['success', 'failure'] as const) {
    test(`stale cache remains readable during ${refresh} refresh`, async ({ page }) => {
      await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
        key: cacheKey, value: { cachedAt: Date.now() - 7_200_000, data: data(2) }
      })
      let pending: Route | undefined
      await page.route(api, route => { pending = route })
      await page.goto('/projects/')
      await expect(calendar(page).getByRole('button')).toHaveAccessibleName(/2 contributions/)
      await expect.poll(() => !!pending).toBe(true)
      if (refresh === 'success') await json(pending!, data(8))
      else await pending!.abort()
      await expect(calendar(page)).toHaveAttribute('aria-busy', 'false')
      await expect(calendar(page).getByRole('button')).toHaveAccessibleName(new RegExp(`${refresh === 'success' ? 8 : 2} contributions`))
    })
  }

  for (const [name, response, state] of [
    ['empty', { contributions: [] }, 'empty'],
    ['invalid date', { contributions: [{ date: '2026-02-31', count: 1, level: 1 }] }, 'error'],
    ['invalid count', { contributions: [{ date: '2026-07-01', count: -1, level: 1 }] }, 'error']
  ] as const) {
    test(`${name} ends loading with a readable status`, async ({ page }) => {
      await page.route(api, route => json(route, response))
      await page.goto('/projects/')
      await expect(calendar(page)).toHaveAttribute('data-state', state)
      await expect(calendar(page)).toHaveAttribute('aria-busy', 'false')
      await expect(calendar(page).getByRole('status')).toBeVisible()
    })
  }

  test('stale empty cache can refresh into populated data', async ({ page }) => {
    await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({
      cachedAt: Date.now() - 7_200_000, data: { contributions: [] }
    })), cacheKey)
    await page.route(api, route => json(route, data(9)))
    await page.goto('/projects/')
    await expect(calendar(page).getByRole('button')).toHaveAccessibleName(/9 contributions/)
  })

  test('network failure leaves projects and navigation usable', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(api, route => route.abort())
    await page.goto('/projects/')
    await expect(calendar(page)).toHaveAttribute('data-state', 'error')
    await expect(page.locator('.pcc').first()).toBeVisible()
    await page.locator('header').getByRole('link', { name: 'Blog', exact: true }).click()
    await expect(page).toHaveURL(/\/blog\/?$/)
    expect(errors).toEqual([])
  })

  test('a stalled request times out rather than leaving a permanent skeleton', async ({ page }) => {
    await page.clock.install()
    let pending = false
    await page.route(api, () => { pending = true })
    await page.goto('/projects/')
    await expect.poll(() => pending).toBe(true)
    await page.clock.fastForward(10_100)
    await expect(calendar(page)).toHaveAttribute('data-state', 'error')
    await expect(calendar(page)).toHaveAttribute('aria-busy', 'false')
  })

  test('navigation aborts an old request and prevents stale cache writes', async ({ page }) => {
    let first: Route | undefined
    let count = 0
    await page.route(api, route => { if (++count === 1) first = route; else return json(route, data(7)) })
    await page.goto('/projects/')
    await expect.poll(() => !!first).toBe(true)
    await page.locator('header').getByRole('link', { name: 'Blog', exact: true }).click()
    await expect(page).toHaveURL(/\/blog\/?$/)
    await page.locator('header').getByRole('link', { name: 'Projects', exact: true }).click()
    await expect(calendar(page).getByRole('button')).toHaveAccessibleName(/7 contributions/)
    await json(first!, data(77)).catch(() => {}) // Chromium may already have cancelled the route.
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).data.contributions[0].count, cacheKey)).toBe(7)
  })
})

test('disabled comments load neither Waline client nor remote comment resources', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/blog/markdown-syntax/')
  await expect(page.locator('#waline-thread')).toHaveCount(0)
  expect(requests.filter(url => /waline|unpkg\.com|comments\.example\.test/i.test(url) || url.endsWith(`/${client}`))).toEqual([])
  await page.context().setOffline(true)
  await page.locator('.prose h2').first().scrollIntoViewIfNeeded()
  await expect(page.locator('.prose')).toBeVisible()
})

test.describe('enabled comment integration', () => {
  test.use({ baseURL: 'http://127.0.0.1:4400' })
  test.beforeEach(async ({ page }) => {
    await page.route('https://unpkg.com/**', route => json(route, []))
    await page.route('https://comments.example.test/**', route => {
      const url = route.request().url()
      return json(route, { errno: 0, data: url.includes('type=count') ? [0] : { count: 0, data: [], totalPages: 0 } })
    })
  })

  test('unavailable server shows an error while article and navigation work', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('https://comments.example.test/**', route => json(route, { errno: 1, errmsg: 'Comments temporarily unavailable' }))
    await page.goto('/__fixtures/comments/first')
    await expect(page.locator('#waline-thread')).toHaveAttribute('data-state', 'error')
    await expect(page.locator('[data-waline-status]')).toHaveText('Comments unavailable. Try the retry button below.')
    await expect(page.getByRole('button', { name: 'Retry comments' })).toBeVisible()
    await page.route('https://comments.example.test/**', route => json(route, { errno: 0, data: { count: 0, data: [], totalPages: 0 } }))
    await page.getByRole('button', { name: 'Retry comments' }).click()
    await expect(page.locator('#waline-thread')).toHaveAttribute('data-state', 'ready')
    await expect(page.locator('[data-waline-status]')).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Readable article' })).toBeVisible()
    await page.getByRole('link', { name: 'Leave comments' }).click()
    await expect(page).toHaveURL(/\/blog\/?$/)
    expect(errors).toEqual([])
  })

  test('failed client import has a bounded and accessible fallback', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(clientRoute, route => route.abort())
    await page.goto('/__fixtures/comments/first')
    await expect(page.locator('#waline-thread')).toHaveAttribute('data-state', 'error')
    await expect(page.locator('[data-waline-status]')).toHaveText('Comments unavailable. Reload the page to retry.')
    expect(errors).toEqual([])
  })

  for (const phase of ['client', 'server'] as const) {
    test(`stalled ${phase} stops loading after the deadline`, async ({ page }) => {
      await page.clock.install()
      let pending = false
      await page.route(phase === 'client' ? clientRoute : 'https://comments.example.test/**', () => { pending = true })
      await page.goto('/__fixtures/comments/first')
      await expect.poll(() => pending).toBe(true)
      await page.clock.fastForward(15_100)
      await expect(page.locator('#waline-thread')).toHaveAttribute('data-state', 'error')
      await expect(page.locator('#waline-thread')).toHaveAttribute('aria-busy', 'false')
      await expect(page.locator('[data-waline-status]')).toContainText('Reload the page')
    })
  }

  test('late import mounts only the current thread after soft navigation', async ({ page }) => {
    const errors: string[] = []
    const paths: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (request.url().startsWith('https://comments.example.test/')) {
        const path = new URL(request.url()).searchParams.get('path')
        if (path) paths.push(path)
      }
    })
    let pending: Route | undefined
    await page.route(clientRoute, route => { pending = route })
    await page.goto('/__fixtures/comments/first')
    await expect.poll(() => !!pending).toBe(true)
    await page.getByRole('link', { name: 'Second thread' }).click()
    await expect(page).toHaveURL(/comments\/second\/?$/)
    await pending!.continue()
    await expect(page.locator('#waline-thread')).toHaveAttribute('data-state', 'ready')
    await expect.poll(() => paths.length).toBeGreaterThan(0)
    expect(paths.every(path => path === '/__fixtures/comments/second')).toBe(true)
    for (let index = 0; index < 2; index++) {
      await page.getByRole('link', { name: 'First thread' }).click()
      await expect(page).toHaveURL(/comments\/first\/?$/)
      await expect(page.locator('#waline-thread .wl-editor')).toHaveCount(1)
      await page.getByRole('button', { name: /Switch to/ }).click()
      await page.getByRole('link', { name: 'Second thread' }).click()
      await expect(page).toHaveURL(/comments\/second\/?$/)
      await expect(page.locator('#waline-thread .wl-editor')).toHaveCount(1)
    }
    expect(errors).toEqual([])
  })
})
