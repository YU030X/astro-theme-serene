import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'

function dedupeLowercase(array: string[]) {
  return [...new Set(array.map((item) => item.toLowerCase()))]
}

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(80),
      description: z.string().max(200),
      publishDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      category: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      cover: z
        .object({
          src: z.union([image(), z.url()]),
          alt: z.string().default(''),
          /** Optional source URL for the cover image (attribution link). */
          source: z.url().optional()
        })
        .optional(),
      tags: z.array(z.string()).default([]).transform(dedupeLowercase),
      draft: z.boolean().default(false)
    })
})

export const collections = { blog }
