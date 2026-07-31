---
title: 'Getting started with Serene'
description: 'Configure identity, write posts, add projects and links, and optionally enable Waline comments.'
publishDate: 2026-07-20
category: meta
tags: [meta, guide]
cover:
  src: '../../assets/posts/slate.jpg'
  alt: 'Cool slate gradient'
---

This guide matches a typical theme setup post: config first, content second, extras last.

## 1. Site identity

Edit `src/site.config.ts`:

| Field | Role |
|-------|------|
| `site` | Production URL (canonical, RSS, OG) |
| `title` / `description` | Site name and meta blurb |
| `author` / `tagline` / `bio` | Home and footer copy |
| `avatar` | Portrait under `src/assets/` |
| `nav` / `socials` | Header and contact links |
| `waline` | Optional comments and reactions (`enabled` + `serverURL`) |
| `githubContributions` | Optional calendar on the Projects page |

Swap `src/assets/avatar.svg` for your own square image.

## 2. Design tokens

Colors, radii, and type live in `src/styles/global.css`. Change light and dark `--accent` (and related tokens) and buttons, links, and selection follow.

## 3. Write posts

Add Markdown under `src/content/blog/`. Frontmatter example (YAML, not a second post):

~~~yaml
title: Hello world
description: Up to 200 characters for lists, SEO, and RSS.
publishDate: 2026-07-21
category: notes
tags: [notes]
cover:
  src: ../../assets/posts/dawn.jpg
  alt: Cover description
  source: https://example.com/source
draft: false
~~~

Wrap that YAML in `---` delimiters in real files. Set `draft: true` to show the post only in `astro dev` and hide it from production lists, archive, tags, RSS, and search.

## 4. Projects, links, tools

| File | Used on |
|------|---------|
| `src/data/projects.json` | Home (only `featured: true`) and Projects |
| `src/data/links.json` | Links page |
| `src/data/tools.json` | About tools grid |

Each JSON file has a Zod adapter so invalid data fails the build early.

## 5. Commands

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site + Pagefind index
npm run preview  # serve dist/
```

Pagefind only has results after `build` / `preview`, not during bare `dev`.

## 6. Optional comments and activity data

Waline is included but disabled by default. To enable comments and article
reactions, replace the server URL and set `waline.enabled` to `true` in
`site.config.ts`:

```ts
waline: {
  enabled: true,
  serverURL: 'https://your-waline-server.example.com'
}
```

When enabled, the Links page can also use the comment thread for link
exchanges.

The Projects page can show a GitHub contribution calendar. Set your username in
`site.config.ts`, then change `githubContributions.enabled` to `true` when you
want to use the public contributions API.
