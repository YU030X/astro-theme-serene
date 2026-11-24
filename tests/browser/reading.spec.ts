import { expect, test } from '@playwright/test'

const article = '/blog/markdown-syntax/'

declare global {
  interface Window {
    __readingNavigationProbe: string
  }
}

async function noOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function settleReading(page: import('@playwright/test').Page) {
  await expect.poll(() => page.locator('[data-reveal]').evaluateAll(elements =>
    elements.filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    }).every(element => element.classList.contains('revealed') &&
      getComputedStyle(element).opacity === '1'))).toBe(true)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].filter(image => {
      const rect = image.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    }).map(image => image.decode().catch(() => {})))
  })
}

async function mockContributions(page: import('@playwright/test').Page) {
  await page.route('https://github-contributions-api.jogruber.de/v4/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      contributions: Array.from({ length: 365 }, (_, index) => ({
        date: new Date(Date.now() - (364 - index) * 86400000).toISOString().slice(0, 10),
        count: index % 5,
        level: index % 5
      }))
    }) }))
}

test.describe('reading layout and controls', () => {
  test.beforeEach(async ({ page }) => { await mockContributions(page) })
  test('home and projects remain readable at representative widths and themes', async ({ page }) => {
    test.setTimeout(45_000)
    for (const [width, theme] of [[320, 'light'], [390, 'dark'], [768, 'light'], [1440, 'dark']] as const) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', article, '/projects/']) {
        await page.goto(path)
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
        await settleReading(page)
        await noOverflow(page)
        if (path === '/') {
          const reading = page.locator('main > div').first()
          await expect(reading).toBeVisible()
          const box = await reading.boundingBox()
          expect(box!.width).toBeLessThanOrEqual(Math.min(width, 704))
          if (width === 320 || width === 1440) {
            await page.screenshot({ path: `docs/browser-evidence/reading-home-${width}-${theme}.png` })
          }
        }
      }
    }
  })

  test('project cards expose clamped descriptions and 44px action targets', async ({ page }) => {
    await page.goto('/projects/')
    const card = page.locator('.pcc').first()
    await expect(card).toBeVisible()
    await expect(card.locator('.pcc-description')).toHaveCSS('-webkit-line-clamp', '3')
    const action = card.locator('.pcc-actions .icon-btn').first()
    const box = await action.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
    const long = await card.locator('.pcc-description').evaluate(el => {
      const style = getComputedStyle(el)
      return { overflow: style.overflow, clamp: style.webkitLineClamp }
    })
    expect(long).toEqual({ overflow: 'hidden', clamp: '3' })
  })

  test('mobile menu opens, closes with Escape, and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/')
    const button = page.locator('#menu-button')
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#mobile-nav')).toHaveClass(/open/)
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await button.click()
    await page.keyboard.press('Escape')
    await expect(page.locator('#mobile-nav')).not.toHaveClass(/open/)
    await expect(button).toBeFocused()
    await button.click()
    await page.locator('#mobile-nav a').first().click()
    await expect(page).toHaveURL(/\/blog\/?$/)
    await expect(page.locator('#menu-button')).toHaveAttribute('aria-expanded', 'false')
  })

  test('desktop and mobile TOC links navigate to real headings', async ({ page }) => {
    await page.goto(article)
    const toc = page.locator('#toc')
    await expect(toc).toBeVisible()
    const link = toc.locator('a[href^="#"]').nth(1)
    const hash = await link.getAttribute('href')
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${hash!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
    await expect(page.locator(hash!)).toBeVisible()
    await page.setViewportSize({ width: 390, height: 800 })
    const details = page.locator('details').filter({ hasText: 'On this page' })
    await expect(details).toBeVisible()
    await details.locator('summary').click()
    const mobileLink = details.locator('a[href^="#"]').first()
    const mobileHash = await mobileLink.getAttribute('href')
    await mobileLink.click()
    await expect(page).toHaveURL(new RegExp(`${mobileHash!.slice(1)}$`))
    await expect(page.locator(mobileHash!)).toBeVisible()
  })

  test('image zoom opens and closes with Escape, restoring source focus', async ({ page }) => {
    await page.goto(article)
    const image = page.locator('.prose img').first()
    await expect(image).toBeVisible()
    await image.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.medium-zoom-overlay--opened')).toBeVisible()
    await expect(page.locator('.medium-zoom-image--clone')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('.medium-zoom-overlay')).toHaveCount(0)
    await expect(image).toBeFocused()
  })

  test('theme toggle persists through ClientRouter navigation', async ({ page }) => {
    await page.goto('/')
    const toggle = page.locator('[data-theme-toggle]').first()
    await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
    await page.locator('a[href="/projects"]').first().click()
    await expect(page).toHaveURL(/\/projects\/?$/)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('[data-theme-toggle]').first()).toHaveAttribute('aria-pressed', 'true')
  })

  test('repeated soft navigation leaves one menu and one zoom interaction', async ({ page }) => {
    test.setTimeout(30_000)
    await page.goto(article)
    await page.evaluate(() => { window.__readingNavigationProbe = 'preserved' })
    await page.locator('a[href="/projects"]').first().click()
    await expect(page).toHaveURL(/\/projects\/?$/)
    await page.locator('a[href="/blog"]').first().click()
    await expect(page).toHaveURL(/\/blog\/?$/)
    await page.locator(`a[href="${article.slice(0, -1)}"]`).first().click()
    await expect(page).toHaveURL(/\/blog\/markdown-syntax\/?$/)
    expect(await page.evaluate(() => window.__readingNavigationProbe)).toBe('preserved')
    await page.locator('a[href="/projects"]').first().click()
    await expect(page).toHaveURL(/\/projects\/?$/)
    await page.locator('a[href="/blog"]').first().click()
    await expect(page).toHaveURL(/\/blog\/?$/)
    await page.locator(`a[href="${article.slice(0, -1)}"]`).first().click()
    await expect(page).toHaveURL(/\/blog\/markdown-syntax\/?$/)
    await page.setViewportSize({ width: 390, height: 800 })
    await page.locator('#menu-button').click()
    await expect(page.locator('#mobile-nav.open')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.locator('#mobile-nav.open')).toHaveCount(0)
    const image = page.locator('.prose img').first()
    await image.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.medium-zoom-overlay--opened')).toBeVisible()
    await expect(page.locator('.medium-zoom-image--clone')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.locator('.medium-zoom-overlay')).toHaveCount(0)
    await image.click()
    await expect(page.locator('.medium-zoom-image--clone')).toHaveCount(1)
    await page.locator('.medium-zoom-overlay').click({ position: { x: 5, y: 5 } })
    await expect(page.locator('.medium-zoom-image--clone')).toHaveCount(0)
  })

  test('representative article widths have bounded reading and navigation containers', async ({ page }) => {
    for (const [width, theme] of [[320, 'light'], [390, 'dark'], [768, 'light'], [1440, 'dark']] as const) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(article)
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
      const shell = page.locator('.header-shell')
      const cover = page.locator('.hero-figure')
      const header = page.locator('article > .relative > header')
      const prose = page.locator('.prose')
      const license = page.locator('[data-post-license]')
      await expect(shell).toBeVisible()
      await expect(prose).toBeVisible()
      const shellBox = (await shell.boundingBox())!
      const coverBox = (await cover.boundingBox())!
      const headerBox = (await header.boundingBox())!
      const proseBox = (await prose.boundingBox())!
      const licenseBox = (await license.boundingBox())!
      expect(shellBox.width).toBeLessThanOrEqual(Math.min(width, 1088))
      expect(proseBox.width).toBeLessThanOrEqual(Math.min(width, 704))
      for (const box of [coverBox, headerBox, licenseBox]) {
        expect(box.x).toBeCloseTo(proseBox.x, 0)
        expect(box.width).toBeCloseTo(proseBox.width, 0)
      }
      await noOverflow(page)
    }
  })

  test('desktop scrolling navigation narrows without changing its top width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(article)
    const shell = page.locator('.header-shell')
    expect((await shell.boundingBox())!.width).toBeCloseTo(1088, 0)
    await page.evaluate(() => window.scrollTo({ top: 180, behavior: 'instant' }))
    await expect(page.locator('#site-header')).toHaveClass(/scrolled/)
    await expect.poll(async () => (await shell.boundingBox())!.width).toBeLessThanOrEqual(737)
    expect((await shell.boundingBox())!.width).toBeGreaterThanOrEqual(735)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await expect(page.locator('#site-header')).not.toHaveClass(/scrolled/)
    await expect.poll(async () => (await shell.boundingBox())!.width).toBeGreaterThanOrEqual(1087)
  })

  test('long post titles and descriptions preserve accessible text and clamping', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto('/')
    const post = page.locator('main a[href^="/blog/"]').first()
    const postTitle = post.locator('.truncate').first()
    await expect(postTitle).toBeVisible()
    const longTitle = 'Long title 中文 pressure fixture '.repeat(20)
    await postTitle.evaluate((element, text) => { element.textContent = text }, longTitle)
    await expect(postTitle).toHaveText(longTitle)
    await expect(post).toHaveAccessibleName(new RegExp('Long title 中文'))
    await expect(postTitle).toHaveCSS('text-overflow', 'ellipsis')
    await expect(postTitle).toHaveCSS('white-space', 'nowrap')
    expect(await postTitle.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
    const card = page.locator('.pcc').first()
    const description = card.locator('.pcc-description')
    await description.evaluate(element => { element.textContent = 'Long description '.repeat(40) })
    await expect(description).toHaveCSS('-webkit-line-clamp', '2')
    const descriptionBox = (await description.boundingBox())!
    const lineHeight = await description.evaluate(element => parseFloat(getComputedStyle(element).lineHeight))
    expect(descriptionBox.height).toBeLessThanOrEqual(lineHeight * 2 + 1)
    const action = (await card.locator('.pcc-actions .icon-btn').first().boundingBox())!
    expect(action.width).toBeGreaterThanOrEqual(44)
    expect(action.height).toBeGreaterThanOrEqual(44)
    await noOverflow(page)
  })

  test('TOC scroll settles below the sticky header and mobile summary is semantic', async ({ page }) => {
    await page.goto(article)
    const link = page.locator('#toc a[href^="#"]').nth(1)
    const hash = (await link.getAttribute('href'))!
    await link.click()
    await expect.poll(() => page.locator(hash).evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(300)
    await expect.poll(() => page.locator(hash).evaluate(element => {
      const header = document.getElementById('site-header')!
      return element.getBoundingClientRect().top - header.getBoundingClientRect().bottom
    })).toBeGreaterThanOrEqual(-8)
    await page.setViewportSize({ width: 390, height: 800 })
    const details = page.locator('details').filter({ hasText: 'On this page' })
    await expect(details.locator('summary')).toHaveCount(1)
    await expect(details).not.toHaveAttribute('open')
    await details.locator('summary').click()
    await expect(details).toHaveAttribute('open', '')
  })
})
