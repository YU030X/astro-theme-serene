import type { Element, Root, RootContent } from 'hast'

export default function rehypeImageAttrs() {
  return (tree: Root) => {
    let seenFirst = false

    const addImageAttrs = (node: Element | Root | RootContent) => {
      if (node.type === 'element' && node.tagName === 'img') {
        const properties = node.properties
        if (!seenFirst) {
          seenFirst = true
          properties.loading = 'eager'
          properties.fetchpriority = 'high'
        } else if (properties.loading === undefined) {
          properties.loading = 'lazy'
        }
        if (properties.decoding === undefined) properties.decoding = 'async'
      }
      if ('children' in node) {
        for (const child of node.children) addImageAttrs(child as RootContent)
      }
    }

    addImageAttrs(tree)
  }
}
