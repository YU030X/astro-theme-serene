---
title: 'Draft page (demo)'
description: 'Example draft — visible in development, excluded from production builds.'
publishDate: 2026-07-18
updatedDate: 2026-07-21
category: meta
tags: [draft, meta]
draft: true
---

This post has `draft: true` in frontmatter.

## Expected behavior

- In `npm run dev` it appears in lists with a **Draft** badge.
- In `npm run build` it is omitted from the blog index, archive, tags, categories, RSS, and Pagefind.

Remove `draft` or set `draft: false` to publish.

```log
draft: true  →  hidden in production
```

> Use drafts for unfinished notes without deleting the file.
