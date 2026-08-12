# Changelog

All notable changes to Serene are documented here.

## Unreleased

### Fixed

- Footnote previews now match the percent-encoded ids that
  `mdast-util-to-hast` emits. Non-ASCII labels such as `[^注一]` had silently
  lost their preview, and a literal `%` in a label threw a `URIError` that
  emptied the article body while the build still exited 0
- `category` and `tags` are validated as URL segments. A slash used to crash
  routing with an unattributable "Missing parameter"; empty or whitespace
  values produced broken links
- Cover `src` and `source` are restricted to http(s), so an attribution link
  can no longer be a `javascript:` URL
- JSON-LD escapes `<`, so a title containing a closing script sequence no
  longer terminates the tag early
- `theme-color` follows the theme the reader chose rather than the OS
  preference, which contradicted the page after a manual switch
- Reading time counts CJK characters separately; Chinese posts reported one
  minute regardless of length. Hyphens no longer split words and tilde fences
  are stripped like backtick ones
- Dates render in UTC, so a build machine west of UTC no longer shows the
  previous day while the `datetime` attribute says otherwise
- A like rejected by the server with a 4xx or 5xx is rolled back instead of
  staying counted locally
- Avatar paths containing `%` no longer throw out of the colour extractor, and
  remote avatars are size-capped

### Changed

- Waline's stylesheet and client bundle stay out of the build entirely while
  comments are disabled, cutting 22.4 KB of unused CSS from every article
- In-article images are uniformly lazy; the first one in document order was
  being marked high priority and competing with the cover for bandwidth
- Index pages show an empty state instead of a heading over blank space when
  there are no posts yet
- The 404 page is marked `noindex`
- Tool icons run through SVGO, and two unreferenced demo images are gone —
  one of them 26.5 MB, the largest object in the repository

### Accessibility

- `#back-to-top` leaves the tab order while hidden
- The search input has a visible focus ring, and the panel border that stood
  in for it now meets the 3:1 contrast a focus indicator needs
- Reduced motion reaches view transitions and cancels transition delays
- Touch targets: project card icon buttons and the compact like button reach
  44px on coarse pointers
- Post meta tags dropped an opacity that put them at 2.86:1
- Collapsible and non-collapsible callouts share the same narrow-screen
  padding

## 1.0.0 — 2026-07-27

First stable release.

- **One page family**: every route opens with a centered serif title and an
  italic subtitle; layouts are open on the paper — hairlines and whitespace
  instead of boxed panels
- **Home**: centered masthead (avatar, name, configurable motto, socials)
  with About / Posts / Projects sections and compact project cards
- **Reading experience**: centered 44rem column, left-margin accordion table
  of contents with a sliding marker, three-dot section breaks, end-of-article
  seal, old-style figures, and optional MDX sidenotes
- **Blog lists**: open entries — title, excerpt, meta and tags beside a
  small square thumbnail; underlined index navigation and tag cloud (no pill
  boxes)
- **Header**: transparent over the page top, then a floating blurred capsule
  that tightens as you scroll; brand on the left, underlined nav grouped with
  the tools on the right, links prefetched on hover
- **Site-wide ambience**: single-accent mist (morning light / moonlight) and
  sub-perceptual paper grain
- **Two papers**: warm paper in the light; warm charcoal "night paper" in
  the dark, lifted off pure black for long reads
- **About**: type-specimen tools list — grayscale inline icons that regain
  color on hover, grouped under mono eyebrows
- **Archive** as a book's table of contents: serif year chapter heads and
  dot-leader rows
- **404** as an intentionally blank leaf
- One reading measure (`--container-reading`, 44rem) shared by every route
- Pagefind static search (⌘K), RSS, sitemap, Open Graph + JSON-LD, dark mode
  with a circular reveal
- Optional Waline comments and like counts; optional GitHub contribution
  calendar
- System font stacks throughout — zero font downloads; a single small client
  module, no framework runtime
