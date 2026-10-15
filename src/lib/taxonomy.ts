import { z } from 'astro/zod'

/** Raw content labels, never pre-encoded URL segments. */
export const urlSegment = (label: string) => z.string().trim().min(1, `${label} cannot be empty`)
  .refine(value => !/[/\\?#\s%\u0000-\u001f\u007f]/.test(value),
    `${label} cannot contain slashes, '?', '#', '%', whitespace or control characters — use hyphens`)
  .refine(value => value !== '.' && value !== '..', `${label} cannot be '.' or '..'`)

export function taxonomyHref(kind: 'tags' | 'categories', label: string): string {
  return `/${kind}/${encodeURIComponent(label)}`
}
