import { expect, test } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { getSeries, seriesSchema, type SeriesPost } from '../../src/lib/series'

const part = (id: string, order: number, draft = false): SeriesPost => ({
  id, data: { title: id, draft, series: { id: 'sample', title: 'Sample', order } }
})

test('series order is explicit, gaps are allowed, and drafts are opt-in', () => {
  const posts = [part('last', 30), part('draft', 20, true), part('first', 10)]
  expect(getSeries(posts)[0].posts.map(post => post.id)).toEqual(['first', 'last'])
  expect(getSeries(posts, true)[0].posts.map(post => post.id)).toEqual(['first', 'draft', 'last'])
  expect(getSeries([part('draft', 1, true)])).toEqual([])
  expect(getSeries([{ id: 'ordinary', data: { title: 'Ordinary' } }])).toEqual([])
  expect(getSeries([part('single', 5)])[0].posts).toHaveLength(1)
  expect(posts.map(post => post.id)).toEqual(['last', 'draft', 'first'])
})

test('invalid and inconsistent series metadata has actionable errors', () => {
  for (const series of [
    { id: 'Bad ID', title: 'Sample', order: 1 },
    { id: 'a--b', title: 'Sample', order: 1 },
    { id: 'sample', title: ' ', order: 1 },
    { id: 'sample', title: 'Sample', order: 0 },
    { id: 'sample', title: 'Sample', order: 1.5 },
    { id: 'sample', title: 'Sample' }
  ]) expect(seriesSchema.safeParse(series).success).toBe(false)
  expect(() => getSeries([part('first', 1), part('second', 1)])).toThrow(/duplicate order 1.*first.*second/)
  const renamed = part('renamed', 2)
  renamed.data.series!.title = 'Different'
  expect(() => getSeries([part('first', 1), renamed])).toThrow(/inconsistent title.*renamed/)
  expect(() => getSeries([part('first', 1), part('draft', 1, true)])).not.toThrow()
  expect(() => getSeries([part('first', 1), part('draft', 1, true)], true)).toThrow(/duplicate order/)
})

test('real no-series build hides the entry and emits no detail routes', () => {
  const blog = readFileSync('docs/browser-no-series-dist/blog/index.html', 'utf8')
  expect(blog).not.toContain('href="/series"')
  expect(readFileSync('docs/browser-no-series-dist/series/index.html', 'utf8')).toContain('No series yet')
  expect(existsSync('docs/browser-no-series-dist/series/writing-a-series/index.html')).toBe(false)
})

test('published index and detail use series order, not dates or filenames', async ({ page }) => {
  await page.goto('/blog/')
  await page.getByRole('navigation', { name: 'Blog indexes' }).getByRole('link', { name: 'Series', exact: true }).click()
  await expect(page).toHaveURL(/\/series\/?$/)
  await expect(page.getByRole('link', { name: /Writing a small series/ })).toContainText('2 posts')
  await page.getByRole('link', { name: /Writing a small series/ }).click()
  await expect(page.locator('a[href="/series"] svg')).toHaveCount(1)
  const links = page.locator('ol.post-list > li > a')
  await expect(links).toHaveCount(2)
  await expect(links.nth(0)).toHaveAttribute('href', '/blog/series-planning')
  await expect(links.nth(1)).toHaveAttribute('href', '/blog/series-building')
})

test('series endpoints replace chronological navigation and survive soft navigation', async ({ page }) => {
  await page.goto('/blog/series-planning')
  const nav = page.getByRole('navigation', { name: 'Series navigation' })
  await expect(nav).toContainText('Part 1 of 2')
  await expect(nav.locator('[rel="prev"]')).toHaveCount(0)
  await expect(page.getByText('Previous post', { exact: true })).toHaveCount(0)
  await nav.locator('[rel="next"]').click()
  await expect(page).toHaveURL(/\/blog\/series-building\/?$/)
  await expect(nav).toContainText('Part 2 of 2')
  await expect(nav.locator('[rel="next"]')).toHaveCount(0)
  await expect(nav.locator('[rel="prev"]')).toHaveAttribute('href', '/blog/series-planning')
  await page.goto('/blog/markdown-syntax')
  await expect(nav).toHaveCount(0)
  await expect(page.getByText('Previous post', { exact: true })).toBeVisible()
})

test('draft series parts never enter production artifacts or search', async ({ page, request }) => {
  expect((await request.get('/blog/series-draft')).status()).toBe(404)
  for (const file of ['rss.xml', 'sitemap-0.xml', 'series/index.html', 'series/writing-a-series/index.html']) {
    expect(readFileSync(`dist/${file}`, 'utf8'), file).not.toContain('/blog/series-draft')
  }
  await page.goto('/')
  await page.getByRole('button', { name: 'Search (⌘K)' }).click()
  await page.getByRole('searchbox').fill('epilogue')
  await expect(page.locator('#search-status')).toContainText('No results')
})

test('singleton series shows position without phantom previous or next links', async ({ page }) => {
  await page.goto('http://127.0.0.1:4400/__fixtures/series/singleton')
  const nav = page.getByRole('navigation', { name: 'Series navigation' })
  await expect(nav).toContainText('Part 1 of 1')
  await expect(nav.locator('[rel]')).toHaveCount(0)
})

test('series pages fit 320px and localized navigation retains stable URLs', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  for (const path of ['/blog/', '/series/', '/series/writing-a-series/', '/blog/series-building/']) {
    await page.goto(`http://127.0.0.1:4401${path}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true)
  }
  const nav = page.getByRole('navigation', { name: '系列导航' })
  await expect(nav).toContainText('第 2 篇，共 2 篇')
  await expect(nav.locator('[rel="prev"]')).toHaveAttribute('href', '/blog/series-planning')
  await nav.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'docs/browser-evidence/series-navigation-320.png' })
})
