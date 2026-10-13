---
title: 'A small series: publish one part at a time'
description: 'The second part demonstrates series navigation and how drafts stay out of production counts.'
publishDate: 2026-06-10
category: guide
tags: [writing]
series:
  id: writing-a-series
  title: 'Writing a small series'
  order: 2
---

## Publish incrementally

The article navigation follows `series.order`, independently of the publication date and filename. For series articles it replaces the general chronological previous/next links.

## Keep unfinished parts private

Parts with `draft: true` remain visible in development but are excluded from the production series list, counts and navigation, just like other draft posts.

Old articles need no changes. Without a `series` field, they retain chronological navigation.
