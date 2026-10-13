import { defineConfig } from 'astro/config'
import base from '../../astro.config'

// Exercise the real routes with published posts that have no series metadata.
export default defineConfig({
  ...base,
  outDir: './docs/browser-no-series-dist',
  vite: {
    ...base.vite,
    plugins: [...(base.vite?.plugins ?? []), {
      name: 'serene-no-series-fixture',
      enforce: 'pre',
      transform(source, id) {
        if (!id.replaceAll('\\', '/').endsWith('/src/lib/utils.ts')) return
        const marker = 'return posts.sort('
        if (!source.includes(marker)) throw new Error('Update the no-series fixture for getPosts')
        return source.replace(marker, 'return posts.map(post => ({ ...post, data: { ...post.data, series: undefined } })).sort(')
      }
    }]
  }
})
