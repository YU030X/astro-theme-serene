import { z } from 'astro/zod'

/** Absolute http(s) URL. */
export const externalUrl = z
  .url()
  .refine((value) => /^https?:\/\//.test(value), 'Use an HTTP or HTTPS URL')

/** Like `externalUrl`, but trims input and turns '' into undefined. */
export const optionalExternalUrl = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z
    .union([externalUrl, z.literal('')])
    .transform((url) => url || undefined)
)

/**
 * Stable 32-bit string hash. Gradient and hue assignment depend on it, so the
 * `(hash * 31 + code) >>> 0` algorithm must not change.
 */
export function hashString(value: string): number {
  let hash = 0
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return hash
}
