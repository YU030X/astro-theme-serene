type MdastNode = {
  type: string
  value?: string
  children?: MdastNode[]
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

type CalloutType = 'note' | 'tip' | 'important' | 'warning' | 'caution' | 'success'

const calloutAliases = new Map<string, CalloutType>([
  ['note', 'note'],
  ['info', 'note'],
  ['tip', 'tip'],
  ['tips', 'tip'],
  ['important', 'important'],
  ['warning', 'warning'],
  ['caution', 'caution'],
  ['danger', 'caution'],
  ['error', 'caution'],
  ['failure', 'caution'],
  ['success', 'success']
])

const calloutTitles: Record<CalloutType, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
  success: 'Success'
}

const markerPattern = /^\[!([a-z]+)\]([+-]?)[ \t]*/i

function splitAtFirstBreak(children: MdastNode[]) {
  const titleChildren: MdastNode[] = []
  const bodyChildren: MdastNode[] = []
  let foundBreak = false

  for (const child of children) {
    if (foundBreak) {
      bodyChildren.push(child)
      continue
    }

    if (child.type === 'break') {
      foundBreak = true
      continue
    }

    if (child.type === 'text' && typeof child.value === 'string') {
      const lineBreak = child.value.match(/\r?\n/)
      if (lineBreak?.index !== undefined) {
        const before = child.value.slice(0, lineBreak.index)
        const after = child.value.slice(lineBreak.index + lineBreak[0].length)
        if (before.length > 0) titleChildren.push({ ...child, value: before })
        if (after.length > 0) bodyChildren.push({ ...child, value: after })
        foundBreak = true
        continue
      }
    }

    titleChildren.push(child)
  }

  return { titleChildren, bodyChildren }
}

/**
 * Flattens a title to text for `aria-label`. Raw `html` nodes are skipped
 * rather than unwrapped — their `value` is markup source, which a screen
 * reader would otherwise spell out tag by tag.
 */
function plainText(nodes: MdastNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'html') return ''
      return node.value ?? (node.children ? plainText(node.children) : '')
    })
    .join('')
    .trim()
}

function transformBlockquote(node: MdastNode) {
  const firstParagraph = node.children?.[0]
  if (firstParagraph?.type !== 'paragraph') return

  const firstText = firstParagraph.children?.[0]
  if (firstText?.type !== 'text' || typeof firstText.value !== 'string') return

  const marker = firstText.value.match(markerPattern)
  if (!marker) return

  const calloutType = calloutAliases.get(marker[1].toLowerCase())
  if (!calloutType) return

  const collapseMarker = marker[2]
  const collapsible = collapseMarker === '+' || collapseMarker === '-'
  const startsOpen = collapseMarker === '+'

  firstText.value = firstText.value.slice(marker[0].length)
  if (firstText.value.length === 0) {
    firstParagraph.children?.shift()
  }

  const { titleChildren, bodyChildren } = splitAtFirstBreak(firstParagraph.children ?? [])
  const defaultTitle = calloutTitles[calloutType]
  const customTitle = plainText(titleChildren)
  const hasCustomTitle = customTitle.length > 0
  const title = hasCustomTitle ? customTitle : defaultTitle

  const contentChildren = node.children?.slice(1) ?? []
  if (bodyChildren.length > 0) {
    contentChildren.unshift({
      ...firstParagraph,
      children: bodyChildren
    })
  }

  const titleNode: MdastNode = {
    type: 'paragraph',
    data: {
      ...(collapsible ? { hName: 'summary' } : {}),
      hProperties: {
        className: [
          'callout-title',
          ...(hasCustomTitle ? ['callout-title-custom'] : [])
        ]
      }
    },
    children: [
      {
        type: 'emphasis',
        data: {
          hName: 'span',
          hProperties: {
            className: ['callout-title-text']
          }
        },
        children: hasCustomTitle ? titleChildren : [{ type: 'text', value: defaultTitle }]
      }
    ]
  }

  node.children = [titleNode, ...contentChildren]
  node.data = {
    ...node.data,
    hName: collapsible ? 'details' : 'aside',
    hProperties: {
      ...node.data?.hProperties,
      className: ['callout', `callout-${calloutType}`],
      'data-callout': calloutType,
      'data-collapsible': String(collapsible),
      ...(collapsible
        ? startsOpen
          ? { open: true }
          : {}
        : { role: 'note', 'aria-label': title })
    }
  }
}

function walk(node: MdastNode) {
  if (node.type === 'blockquote') transformBlockquote(node)
  node.children?.forEach(walk)
}

export default function remarkCallouts() {
  return (tree: unknown) => walk(tree as MdastNode)
}
