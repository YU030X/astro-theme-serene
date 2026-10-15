import { expect, test } from '@playwright/test'
import { taxonomyHref, urlSegment } from '../../src/lib/taxonomy'

test('taxonomy rejects ambiguous path segments without changing valid labels', () => {
  const schema = urlSegment('Tag')
  for (const value of ['', '.', '..', '%', '%2e', '100%', 'a/b', 'a\\b', 'a?b', 'a#b', 'a b', 'a\u0000b']) {
    expect(schema.safeParse(value).success, value).toBe(false)
  }
  for (const value of ['guide', 'Tech', '研发', 'c++', 'rock&roll', 'v1.0']) {
    expect(schema.parse(value)).toBe(value)
    expect(decodeURIComponent(taxonomyHref('tags', value))).toBe(`/tags/${value}`)
  }
  expect(taxonomyHref('categories', 'Tech')).toBe('/categories/Tech')
})

for (const [kind, label] of [['categories', '研发&Design+Tools'], ['tags', 'c++'], ['tags', '研发'], ['tags', 'rock&roll']] as const) {
  test(`real taxonomy routes resolve encoded ${kind}: ${label}`, async ({ page }) => {
    const origin = 'http://127.0.0.1:4400'
    const href = taxonomyHref(kind, label)
    await page.goto(`${origin}/${kind}`)
    await page.locator(`main a[href="${href}"]`).click()
    await expect(page).toHaveURL(`${origin}${href}`)
    await expect(page.locator('h1')).toContainText(label)
    expect((await page.reload())?.status()).toBe(200)
    await page.locator('main .post-list a').first().click()
    await expect(page.locator(`main a[href="${href}"]`)).toHaveCount(1)
  })
}
