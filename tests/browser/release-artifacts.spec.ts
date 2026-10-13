import { expect, test } from '@playwright/test'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  })
}
const htmlFiles = files('dist').filter(path => path.endsWith('.html'))
// Astro renders the /404/ route into the host-compatible 404.html artifact.
const routeFor = (path: string) => path.replaceAll('\\', '/').replace(/^dist/, '').replace(/index\.html$/, '').replace(/^\/404\.html$/, '/404/')
const existsAt = (path: string) => existsSync(join('dist', decodeURIComponent(path), path.endsWith('/') ? 'index.html' : '')) || existsSync(join('dist', decodeURIComponent(path), 'index.html'))

test('every production page has consistent canonical, social and structured metadata', async ({ page }) => {
  const pages = await page.evaluate(inputs => inputs.map(({ path, html }) => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return {
      path,
      canonicals: [...doc.querySelectorAll('link[rel="canonical"]')].map(link => link.getAttribute('href')),
      og: doc.querySelector('meta[property="og:url"]')?.getAttribute('content'),
      image: doc.querySelector('meta[property="og:image"]')?.getAttribute('content'),
      rss: doc.querySelector('link[type="application/rss+xml"]')?.getAttribute('href'),
      sitemap: doc.querySelector('link[rel="sitemap"]')?.getAttribute('href'),
      robots: doc.querySelector('meta[name="robots"]')?.getAttribute('content'),
      json: [...doc.querySelectorAll('script[type="application/ld+json"]')].map(script => JSON.parse(script.textContent ?? ''))
    }
  }), htmlFiles.map(path => ({ path: routeFor(path), html: readFileSync(path, 'utf8') })))
  const home = pages.find(item => item.path === '/')!
  const origin = new URL(home.canonicals[0]!).origin
  // Optional explicit deployment expectation; otherwise check consistency within the theme build.
  if (process.env.SERENE_EXPECTED_SITE) expect(origin).toBe(new URL(process.env.SERENE_EXPECTED_SITE).origin)
  const seen = new Set<string>()
  for (const item of pages) {
    const canonical = new URL(item.path, origin).href
    expect(item.canonicals, item.path).toEqual([canonical])
    expect(seen.has(canonical), item.path).toBe(false)
    seen.add(canonical)
    expect(item.og, item.path).toBe(canonical)
    expect(item.rss, item.path).toBe(`${origin}/rss.xml`)
    expect(item.sitemap, item.path).toBe('/sitemap-index.xml')
    if (item.path === '/404/') expect(item.robots).toContain('noindex')
    const image = new URL(item.image!)
    expect(['https:', 'http:']).toContain(image.protocol)
    if (image.origin === origin) expect(existsAt(image.pathname), image.href).toBe(true)
    expect(item.json, item.path).toHaveLength(1)
    if (item.json[0]['@type'] === 'BlogPosting') {
      expect(item.json[0].url).toBe(canonical)
      expect(item.json[0].mainEntityOfPage['@id']).toBe(canonical)
      expect(Number.isNaN(Date.parse(item.json[0].datePublished))).toBe(false)
    } else expect(item.json[0].url).toBe(`${origin}/`)
  }
})

test('RSS, robots and sitemap point only to generated production routes', async ({ page }) => {
  const parse = (xml: string, selector: string) => page.evaluate(({ xml, selector }) => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    if (doc.querySelector('parsererror')) throw new Error('Invalid XML artifact')
    return [...doc.querySelectorAll(selector)].map(node => node.textContent ?? '')
  }, { xml, selector })
  const index = await parse(readFileSync('dist/sitemap-index.xml', 'utf8'), 'sitemap > loc')
  expect(index.length).toBeGreaterThan(0)
  const origin = new URL(index[0]).origin
  expect(readFileSync('dist/robots.txt', 'utf8')).toContain(`Sitemap: ${origin}/sitemap-index.xml`)
  const locations: string[] = []
  for (const url of index) {
    expect(new URL(url).origin).toBe(origin)
    expect(existsAt(new URL(url).pathname)).toBe(true)
    locations.push(...await parse(readFileSync(join('dist', new URL(url).pathname), 'utf8'), 'url > loc'))
  }
  for (const url of locations) {
    expect(new URL(url).origin, url).toBe(origin)
    expect(existsAt(new URL(url).pathname), url).toBe(true)
    expect(url).not.toContain('/__fixtures/')
  }
  const rss = await parse(readFileSync('dist/rss.xml', 'utf8'), 'item > link')
  const posts = htmlFiles.filter(path => readFileSync(path, 'utf8').includes('"@type":"BlogPosting"')).map(routeFor)
  expect(rss.map(url => new URL(url).pathname.replace(/\/$/, '')).sort()).toEqual(posts.map(path => path.replace(/\/$/, '')).sort())
  for (const url of rss) {
    expect(new URL(url).origin).toBe(origin)
    expect(locations.map(url => url.replace(/\/$/, ''))).toContain(url.replace(/\/$/, ''))
  }
  for (const draft of ['draft-demo', 'template', 'series-draft']) {
    expect(locations.join(' ')).not.toContain(`/blog/${draft}`)
    expect(rss.join(' ')).not.toContain(`/blog/${draft}`)
  }
})

test('Pagefind artifacts load from production and result URLs exist', async ({ page, request }) => {
  expect(existsSync('dist/pagefind/pagefind.js')).toBe(true)
  expect(files('dist/pagefind').some(path => path.endsWith('.pf_meta'))).toBe(true)
  expect(files('dist/pagefind').some(path => /wasm\..+\.pagefind$/.test(path))).toBe(true)
  await page.goto('/blog/')
  await page.getByRole('button', { name: 'Search (⌘K)' }).click()
  await page.getByRole('searchbox').fill('series')
  await expect(page.locator('.search-result').first()).toBeVisible()
  for (const href of await page.locator('.search-result').evaluateAll(links => links.map(link => link.getAttribute('href')!))) {
    expect(href).not.toContain('/__fixtures/')
    expect((await request.get(href)).status(), href).toBe(200)
  }
})
