import { z } from 'astro/zod'

import { optionalExternalUrl } from '@/data/schema-utils'
import toolsFile from '@/data/tools.json'

const toolsFileSchema = z.object({
  tools: z.array(
    z.object({
      id_name: z.string().min(1),
      desc: z.string().min(1),
      tool_list: z.array(
        z.object({
          name: z.string().min(1),
          intro: z.string().min(1),
          link: optionalExternalUrl.optional(),
          strikethrough: z.boolean().optional(),
          icon: z.string().min(1).optional()
        })
      )
    })
  )
})

export interface Tool {
  name: string
  description: string
  /** External URL (opens in a new tab when present). */
  href?: string
  /** Render the name with a strikethrough (a light joke, Pure-style). */
  strikethrough?: boolean
  /** SVG icon basename in src/assets/tools (e.g. 'vscode' → vscode.svg). */
  icon?: string
}

export interface ToolGroup {
  /** Section label rendered above the tool grid. */
  title: string
  tools: Tool[]
}

const toolsData = toolsFileSchema.parse(toolsFile)

/** Grouped tools consumed by the About page's tool sections. */
export const toolGroups: ToolGroup[] = toolsData.tools.map((group) => ({
  title: group.desc,
  tools: group.tool_list.map((tool) => ({
    name: tool.name,
    description: tool.intro,
    href: tool.link,
    strikethrough: tool.strikethrough,
    icon: tool.icon
  }))
}))
