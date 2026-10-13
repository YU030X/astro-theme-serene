import { defineConfig } from 'astro/config'
import base from '../../astro.config'

export default defineConfig({
  ...base,
  outDir: './docs/performance-dist',
  integrations: [...(base.integrations ?? []), {
    name: 'serene-performance-fixture',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        injectRoute({ pattern: '/__fixtures/image-article', entrypoint: './tests/fixtures/image-article.astro' })
      }
    }
  }]
})
