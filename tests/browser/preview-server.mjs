import { preview } from 'astro'

// The public API creates an isolated preview without replacing a user's CLI server.
const server = await preview({ server: { host: '127.0.0.1', port: 4399 } })
if (server.port !== 4399) {
  await server.stop()
  throw new Error('Browser tests need port 4399 to be available.')
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await server.stop()
    process.exit(0)
  })
}
