import { z } from 'astro/zod'

import linksFile from '@/data/links.json'
import { externalUrl, hashString } from '@/data/schema-utils'

const avatarSource = z.union([
  z.string().regex(/^\/(?!\/)/, 'Use a root-relative public path'),
  externalUrl
])
const optionalAvatarSource = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z
    .union([avatarSource, z.literal('')])
    .transform((avatar) => avatar || undefined)
)

const linksFileSchema = z.object({
  friends: z.array(
    z.object({
      id_name: z.string().min(1),
      desc: z.string().min(1),
      link_list: z.array(
        z.object({
          name: z.string().min(1),
          intro: z.string().min(1),
          link: externalUrl,
          avatar: optionalAvatarSource.optional()
        })
      )
    })
  )
})

export interface FriendLink {
  name: string
  url: string
  description: string
  avatar?: string
  hue: number
}

const linksData = linksFileSchema.parse(linksFile)

const linkGroups = linksData.friends
export const linksDescription =
  linkGroups[0]?.desc ??
  'A small directory of friends, references, and places on the web worth returning to.'

/** Normalized links consumed by the existing card components. */
export const friendLinks: FriendLink[] = linkGroups.flatMap((group) =>
  group.link_list.map((link) => ({
    name: link.name,
    url: link.link,
    description: link.intro,
    avatar: link.avatar,
    hue: hashString(`${group.id_name}:${link.name}`) % 360
  }))
)
