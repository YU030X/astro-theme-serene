import path from 'node:path'

import sharp from 'sharp'

const dominantColorCache = new Map<string, Promise<string | undefined>>()

async function extractDominantColor(
  source: string | Buffer
): Promise<string | undefined> {
  try {
    const { dominant } = await sharp(source)
      .resize(64, 64, { fit: 'inside', withoutEnlargement: true })
      .stats()
    return `${dominant.r} ${dominant.g} ${dominant.b}`
  } catch {
    return undefined
  }
}

interface ColorBucket {
  red: number
  green: number
  blue: number
  count: number
  score: number
}

/**
 * Extracted colors can be garish or near-black; cap saturation and pull
 * lightness into a mid band so one value reads on both light and dark canvases.
 */
const MAX_SATURATION = 0.5
const MIN_LIGHTNESS = 0.52
const MAX_LIGHTNESS = 0.66

function rgbToHsl(
  red: number,
  green: number,
  blue: number
): { hue: number; saturation: number; lightness: number } {
  const normalizedRed = red / 255
  const normalizedGreen = green / 255
  const normalizedBlue = blue / 255
  const maximum = Math.max(normalizedRed, normalizedGreen, normalizedBlue)
  const minimum = Math.min(normalizedRed, normalizedGreen, normalizedBlue)
  const lightness = (maximum + minimum) / 2
  const delta = maximum - minimum

  let hue = 0
  let saturation = 0
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1))
    switch (maximum) {
      case normalizedRed:
        hue = ((normalizedGreen - normalizedBlue) / delta) % 6
        break
      case normalizedGreen:
        hue = (normalizedBlue - normalizedRed) / delta + 2
        break
      default:
        hue = (normalizedRed - normalizedGreen) / delta + 4
    }
    hue *= 60
    if (hue < 0) hue += 360
  }
  return { hue, saturation, lightness }
}

function hslToRgb(
  hue: number,
  saturation: number,
  lightness: number
): { red: number; green: number; blue: number } {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const match = lightness - chroma / 2

  let red = 0
  let green = 0
  let blue = 0
  if (hue < 60) {
    red = chroma
    green = secondary
  } else if (hue < 120) {
    red = secondary
    green = chroma
  } else if (hue < 180) {
    green = chroma
    blue = secondary
  } else if (hue < 240) {
    green = secondary
    blue = chroma
  } else if (hue < 300) {
    red = secondary
    blue = chroma
  } else {
    red = chroma
    blue = secondary
  }
  return {
    red: Math.round((red + match) * 255),
    green: Math.round((green + match) * 255),
    blue: Math.round((blue + match) * 255)
  }
}

/** Clamps saturation and lightness, returning space-separated RGB channels. */
function normalizeThemeColor(red: number, green: number, blue: number): string {
  const { hue, saturation, lightness } = rgbToHsl(red, green, blue)
  const clampedSaturation = Math.min(saturation, MAX_SATURATION)
  const clampedLightness = Math.min(
    Math.max(lightness, MIN_LIGHTNESS),
    MAX_LIGHTNESS
  )
  const normalized = hslToRgb(hue, clampedSaturation, clampedLightness)
  return `${normalized.red} ${normalized.green} ${normalized.blue}`
}

async function extractAccentColor(
  source: string | Buffer
): Promise<string | undefined> {
  try {
    const { data, info } = await sharp(source)
      .resize(48, 48, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const buckets = new Map<string, ColorBucket>()

    for (let offset = 0; offset < data.length; offset += info.channels) {
      const red = data[offset] ?? 0
      const green = data[offset + 1] ?? 0
      const blue = data[offset + 2] ?? 0
      const alpha = data[offset + 3] ?? 255
      if (alpha < 80) continue

      const maximum = Math.max(red, green, blue) / 255
      const minimum = Math.min(red, green, blue) / 255
      const lightness = (maximum + minimum) / 2
      const delta = maximum - minimum
      const saturation =
        delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
      if (lightness < 0.12 || lightness > 0.92 || saturation < 0.16)
        continue

      const bucketKey = `${red >> 5}:${green >> 5}:${blue >> 5}`
      const bucket = buckets.get(bucketKey) ?? {
        red: 0,
        green: 0,
        blue: 0,
        count: 0,
        score: 0
      }
      bucket.red += red
      bucket.green += green
      bucket.blue += blue
      bucket.count += 1
      bucket.score += 0.4 + saturation
      buckets.set(bucketKey, bucket)
    }

    const accentBucket = [...buckets.values()].sort(
      (firstBucket, secondBucket) => secondBucket.score - firstBucket.score
    )[0]
    if (!accentBucket) {
      const dominant = await extractDominantColor(source)
      if (!dominant) return undefined
      const [dominantRed, dominantGreen, dominantBlue] = dominant
        .split(' ')
        .map(Number)
      return normalizeThemeColor(dominantRed, dominantGreen, dominantBlue)
    }

    const [averageRed, averageGreen, averageBlue] = [
      accentBucket.red,
      accentBucket.green,
      accentBucket.blue
    ].map((channel) => Math.round(channel / accentBucket.count))
    return normalizeThemeColor(averageRed, averageGreen, averageBlue)
  } catch {
    return undefined
  }
}

/** Extracts a representative theme color from a public or remote avatar. */
export function getAvatarThemeColor(
  imageSource: string
): Promise<string | undefined> {
  const cachedColor = dominantColorCache.get(imageSource)
  if (cachedColor) return cachedColor

  const dominantColor = imageSource.startsWith('/')
    ? getPublicImageColor(imageSource)
    : getRemoteImageColor(imageSource)

  dominantColorCache.set(imageSource, dominantColor)
  return dominantColor
}

async function getPublicImageColor(imageSource: string) {
  const publicDirectory = path.resolve(process.cwd(), 'public')
  const imagePath = path.resolve(
    publicDirectory,
    decodeURIComponent(imageSource.slice(1))
  )
  if (!imagePath.startsWith(`${publicDirectory}${path.sep}`)) return undefined
  return extractAccentColor(imagePath)
}

async function getRemoteImageColor(imageSource: string) {
  try {
    const response = await fetch(imageSource, {
      signal: AbortSignal.timeout(3000)
    })
    if (!response.ok) return undefined
    const imageBuffer = Buffer.from(await response.arrayBuffer())
    return extractAccentColor(imageBuffer)
  } catch {
    return undefined
  }
}
