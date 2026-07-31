import mdx from '@astrojs/mdx'
import { unified } from '@astrojs/markdown-remark'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

import remarkCallouts from './src/plugins/remark-callouts'
import { siteConfig } from './src/site.config'

// https://astro.build/config
export default defineConfig({
  site: siteConfig.site,

  // Instant-feeling navigation: pages are prefetched when links are hovered.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover'
  },

  image: {
    // Emit responsive image styles for <Image layout="..."> components.
    responsiveStyles: true
  },

  markdown: {
    processor: unified({
      remarkPlugins: [remarkCallouts]
    }),
    shikiConfig: {
      // Dual themes — the active one is picked via CSS variables in global.css
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      defaultColor: false
    }
  },

  integrations: [mdx({ remarkPlugins: [remarkCallouts] }), sitemap()],

  vite: {
    plugins: [tailwindcss()]
  }
})
