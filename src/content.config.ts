import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'

function dedupeLowercase(array: string[]) {
  return [...new Set(array.map((item) => item.trim().toLowerCase()))]
}

/**
 * Categories and tags become single URL segments verbatim, so anything that
 * cannot survive that trip has to be rejected here — an empty value makes
 * Astro throw `Missing parameter`, and a slash silently splits the route.
 * Non-ASCII is fine; the browser percent-encodes it.
 */
const urlSegment = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} cannot be empty`)
    .refine(
      (value) => !/[/\\?#\s]/.test(value),
      `${label} cannot contain slashes, '?', '#' or whitespace — use hyphens`
    )

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
      draft: z.boolean().default(false)
    })
})

export const collections = { blog }
