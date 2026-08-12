import type { Element, Root, RootContent } from 'hast'

function getTextContent(node: RootContent): string {
  if (node.type === 'text') return node.value
  if (node.type !== 'element') return ''
  if (node.properties.dataFootnoteBackref !== undefined) return ''
  return node.children.map(getTextContent).join('')
}

function visitElements(
  node: Root | RootContent,
  visitor: (element: Element) => void
) {
  if (node.type === 'element') visitor(node)
  if (!('children' in node)) return
  for (const child of node.children) visitElements(child, visitor)
}

export default function rehypeFootnotePreviews() {
  return (tree: Root) => {
    const footnoteContentById = new Map<string, string>()

    visitElements(tree, (element) => {
      if (element.tagName !== 'li') return
      const id = element.properties.id
      if (typeof id !== 'string' || !id.includes('fn-')) return
      const content = element.children
        .map(getTextContent)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
      if (content) footnoteContentById.set(id, content)
    })

    visitElements(tree, (element) => {
      if (
        element.tagName !== 'a' ||
        element.properties.dataFootnoteRef === undefined
      )
        return

      const href = element.properties.href
      if (typeof href !== 'string' || !href.startsWith('#')) return
      // Compare unmodified: `mdast-util-to-hast` encodes the `<li id>` and this
      // href with the same normalizeUri() pass, so decoding one side would lose
      // every non-ASCII and escaped label.
      const content = footnoteContentById.get(href.slice(1))
      if (!content) return

      const number = element.children.map(getTextContent).join('').trim()
      element.children.push({
        type: 'element',
        tagName: 'span',
        properties: {
          className: ['footnote-preview'],
          ariaHidden: 'true'
        },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['footnote-preview-number'] },
            children: [{ type: 'text', value: number }]
          },
          { type: 'text', value: content }
        ]
      })
    })
  }
}
