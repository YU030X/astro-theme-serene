---
title: 'A small series: plan the reading order'
description: 'The first part of a minimal series example, ordered explicitly rather than by publication date.'
publishDate: 2026-06-20
category: guide
tags: [writing]
series:
  id: writing-a-series
  title: 'Writing a small series'
  order: 1
---

## Choose a stable identity

A series groups related articles with an explicit reading order. Its `id` is a stable URL segment; keep it when you rename the display title.

This example has a later publication date than part two. Readers still start here because `series.order` is `1`.

## Name every part consistently

Use the same `series.id` and `series.title` in each part. Give each published article a distinct positive integer `order`. Gaps are allowed, so reserving `10`, `20` and `30` can make later additions easier.
