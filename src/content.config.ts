import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'
import { seriesSchema } from './lib/series'
import { urlSegment } from './lib/taxonomy'

function dedupeLowercase(array: string[]) {
  return [...new Set(array.map((item) => item.trim().toLowerCase()))]
}

/** Only http(s) is safe to put in an href. */
const safeUrl = z
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'Use an HTTP or HTTPS URL')

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().trim().min(1).max(80),
      description: z.string().trim().min(1).max(200),
      publishDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      category: urlSegment('Category'),
      tags: z
        .array(urlSegment('Tag'))
        .default([])
        .transform(dedupeLowercase),
      cover: z
        .object({
          src: z.union([image(), safeUrl]),
          alt: z.string().default('Header Image'),
          /** Optional source URL for the cover image (attribution link). */
          source: safeUrl.optional()
        })
        .optional(),
      draft: z.boolean().default(false),
      series: seriesSchema.optional()
    })
})

export const collections = { blog }
