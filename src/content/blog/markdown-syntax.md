---
title: 'Markdown syntax support'
description: 'A compact showcase of Markdown and prose styles in Serene — headings, callouts, code, tables, and more.'
publishDate: 2026-07-19
category: reference
tags: [markdown, reference]
cover:
  src: '../../assets/posts/sage.jpg'
  alt: 'Soft sage gradient'
---

## Basic syntax

### Emphasis

_Italic_, **bold**, **_bold italic_**, ~~strikethrough~~, and `inline code`.

### Links

Internal: [Welcome to Serene](/blog/welcome-to-serene). External: [Astro](https://astro.build).

### Lists

Unordered:

- One
- Two
  - Nested
- Three

Ordered:

1. Open an article
2. Press <kbd>⌘K</kbd> to search
3. Toggle the theme

### Blockquote

> Gunshot, thunder, sword rise. A scene of flowers and blood.
>
> A quiet page can still carry a loud idea.

Blockquotes can contain **emphasis**, links, and `inline code`.

### Callouts

Use a blockquote marker to add a structured note. Labels are case-insensitive, and `[!tips]` maps to the `tip` style. Add a title after the marker when the default label is not enough.

> [!tips]
> Keep the main idea close to the sentence that needs it.

> [!NOTE]
> Use notes for useful context that does not interrupt the reading flow.

> [!IMPORTANT]
> Important information should be understood before continuing.

> [!WARNING]
> Check assumptions before applying an example to production.

> [!CAUTION]
> Never paste credentials or private keys into public content.

> [!SUCCESS]
> The page remains readable in light mode, dark mode, and on small screens.

Add `-` to start closed, or `+` to start open. Both forms use native details controls, so their state works without client-side scripts:

> [!CAUTION]- Check this before **publishing**
> This content stays quiet until the reader chooses to open it.

> [!NOTE]+ This note starts **open**
> Custom titles preserve inline Markdown, including `code` and emphasis.

### Horizontal rule

---

## Code

Short blocks stay expanded:

```js
const theme = 'serene'
console.log(`hello, ${theme}`)
```

Longer blocks get a collapse control in the theme UI:

```ts
// Sample multi-line snippet for collapse testing
export type NavItem = { label: string; href: string }

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function formatTitle(
  pageTitle: string | undefined,
  siteTitle: string,
  delimiter: string
): string {
  if (!pageTitle) return siteTitle
  return `${pageTitle} ${delimiter} ${siteTitle}`
}

// padding lines so the block is long enough to collapse
const lines = Array.from({ length: 12 }, (_, i) => `line-${i + 1}`)
console.log(lines.join('\n'))
```

## Tables

| Feature | Notes |
|---------|--------|
| Dark mode | `data-theme` on `<html>` |
| Search | Pagefind after build |
| Comments | Opt-in Waline |

## Keyboard and marks

Use <kbd>Ctrl</kbd> + <kbd>K</kbd> (or <kbd>⌘K</kbd>) for search. <mark>Highlighted text</mark> uses the theme mark style when available.

## Images

Local assets via relative path:

![Soft blue horizon](../../assets/posts/sea.jpg)

Click the image to zoom (unless marked `data-no-zoom` on heroes).
