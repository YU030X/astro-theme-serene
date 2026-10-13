import { expect, test } from '@playwright/test'
import { en, zhCN, translate } from '../../src/lib/i18n'

test('translation keys fall back and preserve interpolation as plain text', () => {
  expect(translate('unknown', 'search.title')).toBe(en['search.title'])
  const saved = zhCN['search.title']
  delete zhCN['search.title']
  try { expect(translate('zh-CN', 'search.title')).toBe(en['search.title']) }
  finally { zhCN['search.title'] = saved }
  expect(translate('zh-CN', 'search.empty', { query: '<script>alert(1)</script>' })).toContain('<script>alert(1)</script>')
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
    expect(placeholders(translate('zh-CN', key)), key).toEqual(placeholders(en[key]))
  }
})

test.describe('Chinese UI build with English date and content settings', () => {
  test.use({ baseURL: 'http://127.0.0.1:4401' })
  test.beforeEach(async ({ page }) => {
    await page.route('https://github-contributions-api.jogruber.de/v4/**', route => route.fulfill({ json: { contributions: [] } }))
  })

  test('only UI configuration changes default labels; custom navigation and dates survive', async ({ page, request }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-ui-locale', 'zh-CN')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: 'My writing' })).toHaveAttribute('href', '/blog')
    await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '项目' })).toBeVisible()
    await expect(page.getByRole('link', { name: '更多文章' })).toBeVisible()
    await expect(page.locator('time').first()).toHaveText('Jul 31, 2026')
    const english = await request.get('http://127.0.0.1:4399/')
    expect(await english.text()).toContain('Jul 31, 2026')
    await page.getByRole('link', { name: '更多文章' }).click()
    await expect(page).toHaveURL(/\/blog\/?$/)
    await expect(page.getByRole('heading', { name: '文章', exact: true })).toBeVisible()
    await page.getByRole('button', { name: /切换为/ }).click()
    await expect(page.getByRole('button', { name: /切换为/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('real Pagefind search has Chinese status, native links and unchanged article URLs', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '搜索 (⌘K)' }).click()
    await expect(page.locator('#search-status')).toHaveText('搜索已就绪。')
    await page.getByRole('searchbox', { name: '搜索文章和页面' }).fill('Markdown')
    await expect(page.locator('#search-status')).toHaveText(/找到 \d+ 条结果。/)
    await expect(page.locator('.search-result').first()).toHaveAttribute('href', /\/blog\//)
    await page.locator('.search-result').first().click()
    await expect(page.locator('dt').filter({ hasText: /^发布于$/ }).first()).toBeVisible()
    await expect(page.locator('.prose')).toBeVisible()
    await expect(page.locator('.code-copy').first()).toHaveAccessibleName('复制代码')
    await page.getByRole('button', { name: '搜索 (⌘K)' }).click()
    await page.getByRole('searchbox').fill('zzzz-no-match-12345')
    await expect(page.locator('#search-status')).toHaveText('没有找到“zzzz-no-match-12345”的相关结果。')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '搜索 (⌘K)' })).toBeFocused()
  })

  test('error and retry states use the same Chinese dictionary', async ({ page }) => {
    await page.route('**/pagefind/pagefind.js*', route => route.abort())
    await page.goto('/')
    await page.getByRole('button', { name: '搜索 (⌘K)' }).click()
    await expect(page.locator('#search-status')).toHaveText('搜索索引不可用，请重试。')
    await expect(page.getByRole('button', { name: '重新搜索' })).toBeVisible()
  })

  for (const width of [320, 390]) {
    test(`Chinese reading, labels and dates do not overflow at ${width}px`, async ({ page }) => {
      test.setTimeout(30_000)
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', '/blog/', '/blog/markdown-syntax/', '/projects/', '/links/', '/archive/', '/categories/', '/tags/', '/404.html']) {
        await page.goto(path)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true)
      }
      await page.goto('/blog/markdown-syntax/')
      await expect(page.getByText('本页目录', { exact: true })).toBeVisible()
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].filter(image => image.getBoundingClientRect().top < innerHeight)
          .map(image => image.decode()))
      })
      await expect(page.locator('.hero-figure img')).toHaveCSS('opacity', '1')
      await page.screenshot({ path: `docs/browser-evidence/chinese-reading-${width}.png` })
      await page.getByText('本页目录', { exact: true }).click()
      await page.locator('details a').first().click()
      await expect(page).toHaveURL(/#.+/)
    })
  }

  test('comment client and fallback use Chinese without changing comment paths', async ({ page }) => {
    const paths: string[] = []
    await page.route('https://comments.example.test/**', route => {
      paths.push(new URL(route.request().url()).searchParams.get('path') ?? '')
      return route.fulfill({ json: { errno: 1, errmsg: 'Unavailable' } })
    })
    await page.route('https://unpkg.com/**', route => route.fulfill({ json: [] }))
    await page.goto('/__fixtures/comments/first')
    await expect(page.getByRole('heading', { name: '评论' })).toBeVisible()
    await expect(page.locator('[data-waline-status]')).toHaveText('评论暂时不可用，请点击下方按钮重试。')
    await expect(page.getByRole('button', { name: '重试加载评论' })).toBeVisible()
    expect(paths).toContain('/__fixtures/comments/first')
  })
})
