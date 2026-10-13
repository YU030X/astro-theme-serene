import { preview } from 'astro'

// The public API creates an isolated preview without replacing a user's CLI server.
const fixtures = process.argv.includes('--fixtures')
const localized = process.argv.includes('--localized')
const port = localized ? 4401 : fixtures ? 4400 : 4399
const server = await preview({
  ...(localized ? { configFile: './tests/fixtures/localized.config.ts' }
    : fixtures ? { configFile: './tests/fixtures/astro.config.ts' } : {}),
  server: { host: '127.0.0.1', port }
})
if (server.port !== port) {
  await server.stop()
  throw new Error(`Browser tests need port ${port} to be available.`)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await server.stop()
    process.exit(0)
  })
}
