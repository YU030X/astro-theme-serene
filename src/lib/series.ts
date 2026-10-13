import { z } from 'astro/zod'

export const seriesSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Series id must use lowercase letters, digits and single hyphens'),
  title: z.string().trim().min(1, 'Series title cannot be empty').max(80),
  order: z.number().int('Series order must be an integer').positive('Series order must be positive')
})

export type SeriesMetadata = z.infer<typeof seriesSchema>
export interface SeriesPost {
  id: string
  data: { title: string; draft?: boolean; series?: SeriesMetadata }
}
export interface PostSeries<T extends SeriesPost = SeriesPost> {
  id: string
  title: string
  posts: T[]
}

/** Publication filtering happens before cross-post validation and counting. */
export function getSeries<T extends SeriesPost>(posts: readonly T[], includeDrafts = false): PostSeries<T>[] {
  const groups = new Map<string, PostSeries<T>>()
  for (const post of posts) {
    if ((!includeDrafts && post.data.draft) || !post.data.series) continue
    const metadata = seriesSchema.parse(post.data.series)
    let group = groups.get(metadata.id)
    if (!group) {
      group = { id: metadata.id, title: metadata.title, posts: [] }
      groups.set(metadata.id, group)
    }
    if (group.title !== metadata.title) {
      throw new Error(`Series "${metadata.id}": inconsistent title in "${post.id}". Use "${group.title}" for every part.`)
    }
    const duplicate = group.posts.find(item => item.data.series!.order === metadata.order)
    if (duplicate) {
      throw new Error(`Series "${metadata.id}": duplicate order ${metadata.order} in "${duplicate.id}" and "${post.id}".`)
    }
    group.posts.push(post)
  }
  for (const group of groups.values()) group.posts.sort((a, b) => a.data.series!.order - b.data.series!.order)
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id))
}
