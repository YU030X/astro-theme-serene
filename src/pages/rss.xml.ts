import rss from '@astrojs/rss'
import type { APIContext } from 'astro'

import { getPosts } from '@/lib/utils'
import { siteConfig } from '@/site.config'

export async function GET(context: APIContext) {
  const posts = await getPosts()
  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: context.site ?? siteConfig.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishDate,
      categories: [...new Set([post.data.category, ...post.data.tags])],
      link: `/blog/${post.id}`
    })),
    customData: `<language>${siteConfig.locale}</language>`
  })
}
