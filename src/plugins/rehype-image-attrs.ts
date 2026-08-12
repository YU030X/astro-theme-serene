import type { Element, Root, RootContent } from 'hast'

/**
 * Defers in-article images.
 *
 * Every image inside the prose sits below the fold — the article cover in
 * `pages/blog/[id].astro` is the LCP candidate and already claims eager +
 * high priority — so nothing here should compete with it for bandwidth.
 *
 * Note: in `.md` this runs before `rehypeRaw`, so hand-written HTML `<img>`
 * tags are still raw text at this point and pass through untouched.
 */
export default function rehypeImageAttrs() {
  return (tree: Root) => {
    const addImageAttrs = (node: Element | Root | RootContent) => {
      if (node.type === 'element' && node.tagName === 'img') {
        const properties = node.properties
        if (properties.loading === undefined) properties.loading = 'lazy'
        if (properties.decoding === undefined) properties.decoding = 'async'
      }
      if ('children' in node) {
        for (const child of node.children) addImageAttrs(child as RootContent)
      }
    }

    addImageAttrs(tree)
  }
}
