import { getCollection, type CollectionEntry } from 'astro:content'

import { siteConfig } from '@/site.config'

export type Post = CollectionEntry<'blog'>

/** All published posts, newest first. Drafts stay visible in `astro dev`. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true
  )
  return posts.sort(
    (a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf()
  )
}

/** Unique tags with usage counts, most used first. */
export function getTags(posts: Post[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** Unique post categories with usage counts, most used first. */
export function getCategories(
  posts: Post[]
): { category: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const post of posts) {
    const { category } = post.data
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort(
      (firstCategory, secondCategory) =>
        secondCategory.count - firstCategory.count ||
        firstCategory.category.localeCompare(secondCategory.category)
    )
}

/** Human-readable label for a URL-safe category slug. */
export function formatCategory(category: string): string {
  return category
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Posts grouped by publish year, newest year first. */
export function groupByYear(posts: Post[]): [number, Post[]][] {
  const groups = new Map<number, Post[]>()
  for (const post of posts) {
    const year = post.data.publishDate.getFullYear()
    if (!groups.has(year)) groups.set(year, [])
    groups.get(year)!.push(post)
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0])
}

/** Rough reading time from raw markdown, in minutes (always ≥ 1). */
export function readingTime(body: string | undefined): number {
  if (!body) return 1
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_\-`[\]()!|]/g, ' ')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 210))
}

export function formatDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
): string {
  return new Intl.DateTimeFormat(siteConfig.locale, options).format(date)
}
