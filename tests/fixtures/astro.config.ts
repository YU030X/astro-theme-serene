import { defineConfig } from 'astro/config'
import base from '../../astro.config'

// Test-only routes never enter the deployable dist directory.
export default defineConfig({
  ...base,
  outDir: './docs/browser-fixture-dist',
  vite: {
    ...base.vite,
    plugins: [...(base.vite?.plugins ?? []), {
      name: 'serene-taxonomy-fixture',
      enforce: 'pre',
      transform(source, id) {
        if (!id.replaceAll('\\', '/').endsWith('/src/lib/utils.ts')) return
        const marker = 'return posts.sort('
        if (!source.includes(marker)) throw new Error('Update taxonomy fixture for getPosts')
        return source.replace(marker, 'return posts.map(post => ({ ...post, data: { ...post.data, category: "研发&Design+Tools", tags: ["c++", "研发", "rock&roll"] } })).sort(')
      }
    }]
  },
  integrations: [...(base.integrations ?? []), {
    name: 'serene-browser-fixtures',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        injectRoute({ pattern: '/__fixtures/tools', entrypoint: './tests/fixtures/tools.astro' })
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
