import { defineConfig } from 'astro/config'
import base from '../../astro.config'

// Test-only routes never enter the deployable dist directory.
export default defineConfig({
  ...base,
  outDir: './docs/browser-fixture-dist',
  integrations: [...(base.integrations ?? []), {
    name: 'serene-browser-fixtures',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        injectRoute({ pattern: '/__fixtures/series/singleton', entrypoint: './tests/fixtures/singleton-series.astro' })
        for (const name of ['first', 'second']) {
          injectRoute({
            pattern: `/__fixtures/comments/${name}`,
            entrypoint: './tests/fixtures/comments.astro'
          })
        }
      }
    }
  }]
})
