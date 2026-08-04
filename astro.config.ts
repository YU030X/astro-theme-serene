import mdx from '@astrojs/mdx'
import { unified } from '@astrojs/markdown-remark'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

import remarkCallouts from './src/plugins/remark-callouts'
import rehypeImageAttrs from './src/plugins/rehype-image-attrs'
import { siteConfig } from './src/site.config'

const remarkPlugins = [remarkMath, remarkCallouts]
const rehypePlugins = [rehypeKatex, rehypeImageAttrs]

// https://astro.build/config
export default defineConfig({
  site: siteConfig.site,

  // Instant-feeling navigation: pages are prefetched when links are hovered.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover'
  },

  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        jpeg: { quality: 85, progressive: true },
        webp: { quality: 85 },
        avif: { quality: 85 }
      }
    },
    // Emit responsive image styles for <Image layout="..."> components.
    responsiveStyles: true
  },

  markdown: {
    processor: unified({
      remarkPlugins,
      rehypePlugins
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

  integrations: [mdx({ remarkPlugins, rehypePlugins }), sitemap()],

  vite: {
    plugins: [tailwindcss()]
  }
})
