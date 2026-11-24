import { expect, test } from '@playwright/test'

for (const device of [
  { name: 'desktop', width: 1440, dpr: 1, candidate: 704 },
  { name: 'mobile', width: 390, dpr: 2, candidate: 720 }
]) {
  test.describe(`${device.name} cover sizing`, () => {
    test.use({ viewport: { width: device.width, height: 900 }, deviceScaleFactor: device.dpr })
    test('local cover selects a bounded responsive image without changing layout', async ({ page }) => {
      await page.goto('/blog/mdx-demo-en/')
      const image = page.locator('.hero-figure img')
      await image.evaluate((image: HTMLImageElement) => image.decode())
      const dimensions = await image.evaluate((image: HTMLImageElement) => {
        const selected = image.srcset.split(',').map(candidate => candidate.trim().split(/\s+/))
          .find(([url]) => new URL(url, location.href).href === image.currentSrc)
        return { candidate: Number(selected?.[1].replace('w', '')), width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height }
      })
      expect(dimensions.candidate).toBe(device.candidate)
      expect(dimensions.width).toBeLessThanOrEqual(704)
      expect(dimensions.height).toBeGreaterThan(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(image).toHaveCSS('opacity', '1')
      await page.screenshot({ path: `docs/browser-evidence/cover-${device.name}.png` })
    })
  })
}
