import { z } from 'astro/zod'

import projectsFile from '@/data/projects.json'
import {
  externalUrl,
  hashString,
  optionalExternalUrl
} from '@/data/schema-utils'

/** Live link: absolute http(s) URL or a same-site root-relative path. */
const optionalProjectWebsite = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z
    .union([
      externalUrl,
      z
        .string()
        .regex(/^\/[\w\-./]*$/, 'Use a root-relative path like /blog')
        .refine(
          (value) => !value.split('/').includes('..'),
          'Root-relative paths cannot traverse with ".."'
        ),
      z.literal('')
    ])
    .transform((url) => url || undefined)
)
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hex color')
const defaultProjectGradient: [string, string] = ['#5a7ba6', '#6d6a9e']
const projectGradientPalette: [string, string][] = [
  defaultProjectGradient,
  ['#5fa3b5', '#5a7ba6'],
  ['#c08a9b', '#cfa17e'],
  ['#7dab8f', '#a4b586'],
  ['#8a8fc0', '#b493ab'],
  ['#c9a86a', '#bd8a90'],
  ['#6f9f8f', '#6686a8'],
  ['#a8866f', '#9c7390']
]

const projectsFileSchema = z.object({
  projects: z.array(
    z.object({
      id_name: z.string().min(1),
      desc: z.string().min(1),
      project_list: z.array(
        z.object({
          name: z.string().min(1),
          intro: z.string().min(1),
          tags: z.array(z.string().min(1)),
          website: optionalProjectWebsite.optional(),
          repository: optionalExternalUrl.optional(),
          gradient: z.tuple([hexColor, hexColor]).optional(),
          featured: z.boolean().optional()
        })
      )
    })
  )
})

export interface Project {
  name: string
  description: string
  tags: string[]
  /** Live URL (shown with an external-link icon). */
  href?: string
  /** Repository URL (shown with a GitHub icon). */
  repo?: string
  /** Two CSS colors used for the card's gradient artwork. */
  gradient: [string, string]
  /** Featured projects also appear on the home page. */
  featured?: boolean
}

const projectsData = projectsFileSchema.parse(projectsFile)

function getAutomaticGradient(
  groupId: string,
  projectName: string
): [string, string] {
  const paletteIndex =
    hashString(`${groupId}:${projectName}`) % projectGradientPalette.length
  return projectGradientPalette[paletteIndex]
}

const projectGroups = projectsData.projects
export const projectsDescription =
  projectGroups[0]?.desc ??
  'Small, sharp tools built with care. Most are open source, documented, and intentionally narrow in scope.'

/** Normalized projects consumed by the existing card components. */
export const projects: Project[] = projectGroups.flatMap((group) =>
  group.project_list.map((project) => ({
    name: project.name,
    description: project.intro,
    tags: project.tags,
    href: project.website,
    repo: project.repository,
    gradient:
      project.gradient ?? getAutomaticGradient(group.id_name, project.name),
    featured: project.featured
  }))
)
