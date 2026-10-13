import { defineConfig } from 'astro/config'
import base from './astro.config'

export default defineConfig({
  ...base,
  outDir: './docs/browser-localized-dist',
  vite: {
    ...base.vite,
    plugins: [...(base.vite?.plugins ?? []), {
      name: 'serene-chinese-config-fixture',
      enforce: 'pre',
      transform(source, id) {
        if (!id.replaceAll('\\', '/').endsWith('/src/site.config.ts')) return
        if (!source.includes("uiLocale: 'en'")) throw new Error('Update the localization fixture for the configured UI locale')
        return source.replace("uiLocale: 'en'", "uiLocale: 'zh-CN'")
          .replace("{ labelKey: 'nav.blog',", "{ label: 'My writing', labelKey: 'nav.blog',")
      }
    }]
  }
})
