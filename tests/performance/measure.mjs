import { chromium } from '@playwright/test'
import { preview } from 'astro'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import os from 'node:os'

const label = process.argv[2]
if (!label || !/^[a-z0-9-]+$/.test(label)) throw new Error('Usage: node tests/performance/measure.mjs <baseline|after|label>')
const root = 'http://127.0.0.1:4402'
const profiles = [
  { name: 'home', path: '/' },
  { name: 'long-article', path: '/blog/markdown-syntax/' },
  { name: 'photo-cover', path: '/blog/mdx-demo-en/' },
  { name: 'image-heavy-synthetic', path: '/__fixtures/image-article/' }
]
const devices = [
  { name: 'desktop', viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 },
  { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
]
const network = { offline: false, latency: 40, downloadThroughput: 200_000, uploadThroughput: 93_750 }
const server = await preview({ configFile: './tests/fixtures/performance.config.ts', server: { host: '127.0.0.1', port: 4402 } })
let browser
try {
  if (server.port !== 4402) throw new Error('Performance measurement needs port 4402 to be free')
  browser = await chromium.launch()
  const report = {
    label, timestamp: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    environment: { node: process.version, platform: os.platform(), release: os.release(), cpu: os.cpus()[0]?.model, browser: browser.version() },
    procedure: { repetitions: 3, devices, network, cpuSlowdown: 4, coldContextEachRun: true, cacheDisabled: true, firstViewportSettleMs: 1500, syntheticThirdParty: true, hover: false },
    runs: []
  }
  for (const device of devices) for (const profile of profiles) for (let repetition = 1; repetition <= 3; repetition++) {
    const { name: deviceName, ...contextOptions } = device
    const context = await browser.newContext({ ...contextOptions, colorScheme: 'light', reducedMotion: 'no-preference', serviceWorkers: 'block' })
    try {
      const external = []
      await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.origin === root) return route.continue()
        external.push(url.href)
        if (url.hostname === 'github-contributions-api.jogruber.de') return route.fulfill({ json: { contributions: [] } })
        return route.abort()
      })
      const page = await context.newPage()
      const errors = []
      const responses = []
      const failures = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('requestfailed', request => failures.push({ url: request.url(), error: request.failure()?.errorText }))
      page.on('response', response => responses.push({ url: response.url(), status: response.status(), type: response.request().resourceType(), mime: response.headers()['content-type'] ?? '' }))
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
      await cdp.send('Network.emulateNetworkConditions', network)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.addInitScript(() => {
        window.__measurement = { shifts: [], lcp: 0, longTasks: [], supported: PerformanceObserver.supportedEntryTypes }
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__measurement.shifts.push({ value: entry.value, time: entry.startTime })
        }).observe({ type: 'layout-shift', buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__measurement.lcp = entry.startTime
        }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__measurement.longTasks.push(entry.duration)
        }).observe({ type: 'longtask', buffered: true })
      })
      const response = await page.goto(`${root}${profile.path}`, { waitUntil: 'networkidle', timeout: 45_000 })
      if (response?.status() !== 200) throw new Error(`Unexpected status for ${profile.path}`)
      // Fixed settling period is part of the measurement protocol, not an assertion wait.
      await page.waitForTimeout(1500)
      const snapshot = () => page.evaluate(() => {
        const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')]
        const resources = entries.map(entry => ({ url: entry.name, type: entry.initiatorType ?? 'navigation', transferBytes: entry.transferSize, encodedBytes: entry.encodedBodySize, decodedBytes: entry.decodedBodySize }))
        const images = [...document.images].map(image => ({ src: image.currentSrc || image.src, loading: image.loading, width: image.width, height: image.height, displayWidth: image.getBoundingClientRect().width, naturalWidth: image.naturalWidth, widthAttribute: image.getAttribute('width'), heightAttribute: image.getAttribute('height'), complete: image.complete }))
        let cls = 0, windowValue = 0, windowStart = 0, lastTime = -Infinity
        for (const shift of [...window.__measurement.shifts].sort((a, b) => a.time - b.time)) {
          if (shift.time - lastTime >= 1000 || shift.time - windowStart >= 5000) { windowValue = 0; windowStart = shift.time }
          windowValue += shift.value; lastTime = shift.time; cls = Math.max(cls, windowValue)
        }
        const sum = (filter, key) => resources.filter(filter).reduce((total, resource) => total + resource[key], 0)
        return {
          transferBytes: sum(() => true, 'transferBytes'), encodedBytes: sum(() => true, 'encodedBytes'),
          scriptBytes: sum(resource => /\.m?js(?:\?|$)/.test(resource.url), 'encodedBytes'),
          imageBytes: sum(resource => /\.(?:webp|png|jpe?g|svg|avif)(?:\?|$)/.test(resource.url), 'encodedBytes'),
          imageRequests: resources.filter(resource => /\.(?:webp|png|jpe?g|svg|avif)(?:\?|$)/.test(resource.url)).length,
          cls, shiftCount: window.__measurement.shifts.length, supportedEntries: window.__measurement.supported, lcpMs: window.__measurement.lcp,
          fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
          longTaskMs: window.__measurement.longTasks.reduce((total, duration) => total + duration, 0),
          inlineScriptBytes: [...document.scripts].filter(script => !script.src && script.type !== 'application/ld+json').reduce((total, script) => total + new TextEncoder().encode(script.textContent).length, 0),
          resources, images, overflow: document.documentElement.scrollWidth > innerWidth
        }
      })
      const firstViewport = await snapshot()
      for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += device.viewport.height * 0.75) {
        await page.evaluate(y => scrollTo(0, y), y)
        await page.waitForTimeout(80)
      }
      const brokenImages = await page.evaluate(async () => {
        const failures = []
        await Promise.all([...document.images].map(image => image.decode().catch(() => failures.push(image.currentSrc || image.src))))
        return failures
      })
      await page.waitForLoadState('networkidle')
      const fullRead = await snapshot()
      const localFailures = failures.filter(failure => failure.url.startsWith(root))
      const httpErrors = responses.filter(response => response.url.startsWith(root) && response.status >= 400)
      report.runs.push({ device: deviceName, profile: profile.name, repetition, externalRequests: external, responses, failures, errors, brokenImages, firstViewport, fullRead })
      // Preserve completed samples and failure evidence even when a later sample fails.
      await mkdir('docs/performance-evidence', { recursive: true })
      await writeFile(`docs/performance-evidence/${label}.json`, JSON.stringify(report, null, 2))
      if (errors.length || localFailures.length || httpErrors.length || brokenImages.length || fullRead.overflow || !firstViewport.fcpMs || !firstViewport.lcpMs) {
        throw new Error(`${profile.name}/${deviceName}: invalid sample; inspect docs/performance-evidence/${label}.json`)
      }
      console.log(`${label} ${deviceName}/${profile.name} #${repetition}: ${firstViewport.encodedBytes} bytes; scripts ${firstViewport.scriptBytes}; images ${firstViewport.imageBytes}; CLS ${firstViewport.cls.toFixed(4)}`)
    } finally { await context.close() }
  }
  await mkdir('docs/performance-evidence', { recursive: true })
  await writeFile(`docs/performance-evidence/${label}.json`, JSON.stringify(report, null, 2))
  console.log(`Saved docs/performance-evidence/${label}.json`)
} finally {
  await browser?.close()
  await server.stop()
}
