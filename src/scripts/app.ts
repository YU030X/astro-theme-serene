/** Serene — the site's only client script, re-initialized on every Astro view-transition navigation. */

let controller: AbortController | undefined
let revealObserver: IntersectionObserver | undefined

const reduceMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function setupHeader(signal: AbortSignal) {
  const header = document.getElementById('site-header')
  if (!header) return
  const panel = document.getElementById('mobile-nav')
  let previousScrollY = window.scrollY
  let frameRequested = false

  const update = () => {
    frameRequested = false
    const scrollY = window.scrollY
    const isScrolled = header.classList.contains('scrolled')

    // Separate enter/exit thresholds prevent flicker near the top.
    if (!isScrolled && scrollY >= 30) header.classList.add('scrolled')
    else if (isScrolled && scrollY <= 8) header.classList.remove('scrolled')

    const menuOpen = panel?.classList.contains('open') ?? false
    const headerFocused = header.contains(document.activeElement)
    const scrollDelta = scrollY - previousScrollY

    if (menuOpen || headerFocused || scrollY <= 400 || scrollDelta < -4) {
      header.classList.remove('header-hidden')
    } else if (scrollDelta > 6) {
      header.classList.add('header-hidden')
    }

    previousScrollY = scrollY
  }

  const requestUpdate = () => {
    if (frameRequested) return
    frameRequested = true
    requestAnimationFrame(update)
  }

  update()
  window.addEventListener('scroll', requestUpdate, { passive: true, signal })
  header.addEventListener('focusin', requestUpdate, { signal })
}

function setupMobileNav(signal: AbortSignal) {
  const button = document.getElementById('menu-button')
  const panel = document.getElementById('mobile-nav')
  if (!button || !panel) return

  const setOpen = (open: boolean, { refocus = false } = {}) => {
    button.setAttribute('aria-expanded', String(open))
    panel.classList.toggle('open', open)
    if (!open && refocus) button.focus({ preventScroll: true })
  }

  button.addEventListener(
    'click',
    () => setOpen(!panel.classList.contains('open')),
    { signal }
  )
  document.addEventListener(
    'keydown',
    (e) => {
      // Only a real close steals focus back to the button — an Escape pressed
      // elsewhere on the page must leave focus where it is.
      if (e.key === 'Escape' && panel.classList.contains('open'))
        setOpen(false, { refocus: true })
    },
    { signal }
  )
  document.addEventListener(
    'click',
    (e) => {
      if (
        panel.classList.contains('open') &&
        e.target instanceof Node &&
        !panel.contains(e.target) &&
        !button.contains(e.target)
      )
        setOpen(false)
    },
    { signal }
  )
}

/* Theme: apply + animated circular reveal on toggle */

type Theme = 'light' | 'dark'

const currentTheme = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  // The browser UI colour follows the chosen theme, not the OS preference.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  const color =
    meta?.dataset[theme === 'dark' ? 'themeColorDark' : 'themeColorLight']
  if (meta && color) meta.content = color
  try {
    localStorage.setItem('theme', theme)
  } catch {
    /* private mode */
  }
}

async function animatedThemeSwitch(next: Theme, x: number, y: number) {
  const root = document.documentElement
  if (!document.startViewTransition || reduceMotion()) {
    applyTheme(next)
    return
  }
  // Silence page transitions + shared-element names during the reveal
  root.setAttribute('data-theme-switching', '')
  const vt = document.startViewTransition(() => applyTheme(next))
  try {
    await vt.ready
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )
    await root.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${radius}px at ${x}px ${y}px)`
        ]
      },
      {
        duration: 550,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        pseudoElement: '::view-transition-new(root)'
      }
    ).finished
  } catch {
    /* view transition skipped */
  } finally {
    vt.finished.finally(() => root.removeAttribute('data-theme-switching'))
  }
}

function setupThemeToggle(signal: AbortSignal) {
  const synchronizeButton = (button: HTMLElement) => {
    const isDark = currentTheme() === 'dark'
    button.setAttribute('aria-pressed', String(isDark))
    button.setAttribute(
      'aria-label',
      isDark ? 'Switch to light theme' : 'Switch to dark theme'
    )
  }

  for (const button of document.querySelectorAll<HTMLElement>(
    '[data-theme-toggle]'
  )) {
    synchronizeButton(button)
    button.addEventListener(
      'click',
      () => {
        const rect = button.getBoundingClientRect()
        void animatedThemeSwitch(
          currentTheme() === 'dark' ? 'light' : 'dark',
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        ).finally(() => synchronizeButton(button))
      },
      { signal }
    )
  }
}

function setupReveal(signal: AbortSignal) {
  const elements = document.querySelectorAll<HTMLElement>(
    '[data-reveal]:not(.revealed)'
  )
  if (!elements.length) return
  if (reduceMotion() || !('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('revealed'))
    return
  }
  revealObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        el.classList.add('revealed')
        observer.unobserve(el)
        // Then hand transitions back to the element's own styles (hover lifts)
        const delay = parseFloat(getComputedStyle(el).transitionDelay) * 1000 || 0
        const timer = setTimeout(() => {
          el.removeAttribute('data-reveal')
          el.classList.remove('revealed')
          el.style.removeProperty('--reveal-delay')
        }, 750 + delay)
        signal.addEventListener('abort', () => clearTimeout(timer), {
          once: true
        })
      }
    },
    { threshold: 0.05, rootMargin: '0px 0px -5% 0px' }
  )
  elements.forEach((el) => revealObserver!.observe(el))
}

function settleSoftNavigationReveals() {
  if (!document.documentElement.hasAttribute('data-soft-navigation')) return

  // The route-level fade is the only entrance on soft navigation.
  for (const element of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    element.classList.add('revealed')
  }
}

function setupBackToTop(signal: AbortSignal) {
  const button = document.getElementById('back-to-top')
  if (!button) return
  const update = () =>
    button.classList.toggle('visible', window.scrollY > 640)
  update()
  window.addEventListener('scroll', update, { passive: true, signal })
  button.addEventListener(
    'click',
    () =>
      window.scrollTo({
        top: 0,
        behavior: reduceMotion() ? 'auto' : 'smooth'
      }),
    { signal }
  )
}

function setupProgress(signal: AbortSignal) {
  const bar = document.getElementById('reading-progress')
  if (!bar) return
  let ticking = false
  const update = () => {
    ticking = false
    const max = document.documentElement.scrollHeight - window.innerHeight
    const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0
    bar.style.transform = `scaleX(${progress})`
  }
  update()
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    },
    { passive: true, signal }
  )
}

function setupToc(signal: AbortSignal) {
  const toc = document.getElementById('toc')
  if (!toc) return
  const marker = toc.querySelector<HTMLElement>('.toc-marker')
  const links = [...toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
  const targets = links
    .map((link) => ({
      link,
      heading: document.getElementById(
        decodeURIComponent(link.hash.slice(1))
      )
    }))
    .filter((t): t is { link: HTMLAnchorElement; heading: HTMLElement } =>
      Boolean(t.heading)
    )
  if (!targets.length) return
  const groups = [...toc.querySelectorAll<HTMLElement>('li[data-toc-group]')]

  let active: HTMLAnchorElement | undefined
  let ticking = false

  /* Mid-fold the active link's offsetTop is stale (chasing it bounces), so
     aim at the FUTURE: for each sub-list ending above the link, add settled
     height (scrollHeight unfolding, 0 folding) minus rendered height. One
     slide, landing in step with the fold — both 0.3s on the same curve. */
  const settledMarkerY = (link: HTMLAnchorElement) => {
    let y = link.offsetTop
    for (const group of groups) {
      const sub = group.querySelector<HTMLElement>('.toc-sub')
      if (!sub || sub.contains(link) || sub.offsetTop >= link.offsetTop)
        continue
      const rendered = sub.getBoundingClientRect().height
      if (group.classList.contains('is-active')) {
        const settled =
          (sub.firstElementChild as HTMLElement | null)?.scrollHeight ??
          rendered
        y += settled - rendered
      } else {
        y -= rendered
      }
    }
    return y
  }

  const update = () => {
    ticking = false
    let current = targets[0]
    for (const target of targets) {
      if (target.heading.getBoundingClientRect().top <= 132) current = target
      else break
    }
    if (!current || current.link === active) return
    active = current.link
    for (const { link } of targets)
      link.classList.toggle('active', link === active)
    // Unfold only the chapter that owns the active heading.
    const activeGroup = active.closest('li[data-toc-group]')
    for (const group of groups)
      group.classList.toggle('is-active', group === activeGroup)
    if (marker) {
      marker.style.opacity = '1'
      marker.style.transform = `translateY(${settledMarkerY(active) + 6}px)`
      marker.style.height = `${active.offsetHeight - 12}px`
    }
  }
  update()
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    },
    { passive: true, signal }
  )
}

/* Copy and collapse controls on code blocks */

const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="icon-copy" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="3"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-check" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`
const CHEVRON_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`
const COLLAPSIBLE_CODE_LINES = 15
let codeBlockId = 0

function setupCodeBlocks(signal: AbortSignal) {
  for (const block of document.querySelectorAll<HTMLElement>('pre.astro-code')) {
    block.dataset.enhanced = ''

    // Keep controls pinned while the highlighted code scrolls horizontally.
    let frame = block.closest<HTMLElement>('.code-frame')
    if (!frame) {
      frame = document.createElement('div')
      frame.className = 'code-frame'
      block.parentNode?.insertBefore(frame, block)
      frame.appendChild(block)
    }

    const language = block.dataset.language?.trim()
    let caption = frame.querySelector<HTMLElement>('.code-caption')
    if (language && !caption) {
      caption = document.createElement('div')
      caption.className = 'code-caption'
      frame.insertBefore(caption, block)
    }

    let label = frame.querySelector<HTMLElement>('.code-language')
    if (language && !label) {
      label = document.createElement('span')
      label.className = 'code-language'
      label.textContent = language
    }
    if (caption && label && label.parentElement !== caption)
      caption.appendChild(label)

    const controlContainer = caption ?? frame
    let copyButton = frame.querySelector<HTMLButtonElement>('.code-copy')
    if (!copyButton) {
      copyButton = document.createElement('button')
      copyButton.className = 'code-copy'
      copyButton.type = 'button'
      copyButton.setAttribute('aria-label', 'Copy code')
      copyButton.innerHTML = COPY_ICON + CHECK_ICON
      controlContainer.appendChild(copyButton)
    }
    if (copyButton.parentElement !== controlContainer)
      controlContainer.appendChild(copyButton)
    const codeElement = block.querySelector('code')
    copyButton.addEventListener(
      'click',
      async () => {
        try {
          await navigator.clipboard.writeText(codeElement?.innerText ?? '')
          copyButton.setAttribute('data-copied', '')
          const timer = setTimeout(
            () => copyButton.removeAttribute('data-copied'),
            1600
          )
          signal.addEventListener('abort', () => clearTimeout(timer), {
            once: true
          })
        } catch {
          /* clipboard unavailable */
        }
      },
      { signal }
    )

    const code = codeElement?.innerText.replace(/\n$/, '') ?? ''
    const lineCount = code ? code.split('\n').length : 0
    if (lineCount <= COLLAPSIBLE_CODE_LINES) continue

    frame.classList.add('is-collapsible')
    if (!frame.hasAttribute('data-code-expanded'))
      frame.classList.add('is-collapsed')

    if (!block.id) block.id = `code-block-${++codeBlockId}`
    let toggle = frame.querySelector<HTMLButtonElement>('.code-toggle')
    if (!toggle) {
      toggle = document.createElement('button')
      toggle.className = 'code-toggle'
      toggle.type = 'button'
      toggle.innerHTML = `${CHEVRON_ICON}<span></span>`
      frame.appendChild(toggle)
    }
    toggle.setAttribute('aria-controls', block.id)

    const updateToggle = () => {
      const expanded = !frame.classList.contains('is-collapsed')
      toggle.setAttribute('aria-expanded', String(expanded))
      toggle.setAttribute(
        'aria-label',
        expanded ? 'Collapse code block' : 'Show all code'
      )
      const label = toggle.querySelector('span')
      if (label) label.textContent = expanded ? 'Collapse code' : 'Show all code'
    }

    updateToggle()
    toggle.addEventListener(
      'click',
      () => {
        const expanded = frame.classList.toggle('is-collapsed') === false
        frame.toggleAttribute('data-code-expanded', expanded)
        updateToggle()
        if (!expanded && frame.getBoundingClientRect().top < 0)
          frame.scrollIntoView({ block: 'start' })
      },
      { signal }
    )
  }
}

function setupImageZoom(signal: AbortSignal) {
  let source: HTMLImageElement | null = null
  let zoomed: HTMLImageElement | null = null
  let overlay: HTMLDivElement | null = null
  let closing = false
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  const finishClose = (restoreFocus: boolean) => {
    clearTimeout(closeTimer)
    zoomed?.remove()
    overlay?.remove()
    source?.classList.remove('medium-zoom-image--hidden')
    document.documentElement.classList.remove('medium-zoom--opened')
    if (restoreFocus) source?.focus({ preventScroll: true })
    source = null
    zoomed = null
    overlay = null
    closing = false
  }

  const close = (restoreFocus = true, immediate = false) => {
    if (!source || !zoomed || !overlay || closing) return
    closing = true
    zoomed.classList.remove('medium-zoom-image--opened')
    zoomed.style.transform = 'none'
    overlay.classList.remove('medium-zoom-overlay--opened')

    if (immediate || reduceMotion()) finishClose(restoreFocus)
    else closeTimer = setTimeout(() => finishClose(restoreFocus), 320)
  }

  const open = (image: HTMLImageElement) => {
    if (source) return

    if (!image.complete) {
      image
        .decode()
        .then(() => open(image))
        .catch(() => {})
      return
    }

    const rect = image.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    source = image
    overlay = document.createElement('div')
    overlay.className = 'medium-zoom-overlay'
    overlay.setAttribute('aria-hidden', 'true')

    zoomed = image.cloneNode(false) as HTMLImageElement
    zoomed.removeAttribute('srcset')
    zoomed.removeAttribute('sizes')
    zoomed.src = image.currentSrc || image.src
    zoomed.alt = image.alt
    zoomed.className = 'medium-zoom-image medium-zoom-image--clone'
    zoomed.tabIndex = 0
    zoomed.setAttribute('role', 'button')
    zoomed.setAttribute('aria-label', 'Close enlarged image')

    const style = getComputedStyle(image)
    Object.assign(zoomed.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      borderRadius: style.borderRadius,
      objectFit: style.objectFit,
      objectPosition: style.objectPosition
    })

    document.body.append(overlay, zoomed)
    image.classList.add('medium-zoom-image--hidden')
    document.documentElement.classList.add('medium-zoom--opened')

    const viewportPadding = Math.min(32, window.innerWidth * 0.04)
    const viewportScale = Math.min(
      (window.innerWidth - viewportPadding * 2) / rect.width,
      (window.innerHeight - viewportPadding * 2) / rect.height
    )
    const intrinsicScale = image.naturalWidth
      ? image.naturalWidth / rect.width
      : viewportScale
    const scale = Math.max(0.1, Math.min(viewportScale, intrinsicScale))
    const translateX = window.innerWidth / 2 - (rect.left + rect.width / 2)
    const translateY = window.innerHeight / 2 - (rect.top + rect.height / 2)

    requestAnimationFrame(() => {
      if (!zoomed || !overlay) return
      overlay.classList.add('medium-zoom-overlay--opened')
      zoomed.classList.add('medium-zoom-image--opened')
      zoomed.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`
      zoomed.focus({ preventScroll: true })
    })
  }

  for (const image of document.querySelectorAll<HTMLImageElement>(
    '.prose img, [data-zoomable] img, img[data-zoomable]'
  )) {
    if (image.closest('a, [data-no-zoom]')) continue
    image.classList.add('medium-zoom-image')
    image.tabIndex = 0
    image.setAttribute('role', 'button')
    image.setAttribute(
      'aria-label',
      image.alt ? `Enlarge image: ${image.alt}` : 'Enlarge image'
    )
    image.addEventListener('click', () => open(image), { signal })
    image.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        open(image)
      },
      { signal }
    )
  }

  document.addEventListener(
    'click',
    (event) => {
      if (event.target === zoomed || event.target === overlay) close()
    },
    { signal }
  )
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && source) close()
      if (
        source &&
        event.target === zoomed &&
        (event.key === 'Enter' || event.key === ' ')
      ) {
        event.preventDefault()
        close()
      }
    },
    { signal }
  )
  let lastWidth = window.innerWidth
  window.addEventListener(
    'resize',
    () => {
      const widthChanged = Math.abs(window.innerWidth - lastWidth) > 40
      lastWidth = window.innerWidth
      if (widthChanged) close(false)
    },
    { signal }
  )
  signal.addEventListener('abort', () => finishClose(false), { once: true })
}

function setupImageLoading(signal: AbortSignal) {
  const images = document.querySelectorAll<HTMLImageElement>(
    'img:not([data-image-skeleton="off"])'
  )

  for (const image of images) {
    image.setAttribute('data-image-loading', '')

    const finish = (failed: boolean) => {
      image.removeAttribute('data-image-loading')
      image.toggleAttribute('data-image-error', failed)
    }

    image.addEventListener('load', () => finish(false), {
      signal,
      once: true
    })
    image.addEventListener('error', () => finish(true), {
      signal,
      once: true
    })

    if (image.complete && image.naturalWidth > 0) finish(false)
    else if (image.complete && image.loading !== 'lazy') finish(true)
  }
}

/* Search (Pagefind, loaded on demand) */

interface PagefindResult {
  data(): Promise<{ url: string; excerpt: string; meta: { title?: string } }>
}
interface Pagefind {
  init?(): void
  search(query: string): Promise<{ results: PagefindResult[] }>
}

let pagefind: Pagefind | null | undefined

async function loadPagefind(): Promise<Pagefind | null> {
  if (pagefind !== undefined) return pagefind
  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    pagefind = (await import(
      /* @vite-ignore */ `${base}/pagefind/pagefind.js`
    )) as Pagefind
    pagefind.init?.()
  } catch {
    pagefind = null
  }
  return pagefind
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[c] as string
  )

function setupSearch(signal: AbortSignal) {
  const dialog = document.getElementById(
    'search-dialog'
  ) as HTMLDialogElement | null
  if (!dialog) return
  const input = dialog.querySelector<HTMLInputElement>('input[type="search"]')
  const results = dialog.querySelector<HTMLElement>('#search-results')
  const hint = dialog.querySelector<HTMLElement>('#search-hint')
  const closeButton = dialog.querySelector<HTMLButtonElement>('[data-search-close]')
  if (!input || !results || !hint) return
  let lastOpener: HTMLElement | null = null

  const open = (opener?: HTMLElement) => {
    lastOpener = opener ?? (document.activeElement as HTMLElement | null)
    if (!dialog.open) dialog.showModal()
    input.select()
    void loadPagefind().then((pf) => {
      hint.textContent =
        pf === null
          ? 'Search is available after `npm run build` — Pagefind indexes the built site.'
          : 'Type to search posts and pages.'
    })
  }
  const close = () => {
    if (dialog.open) dialog.close()
  }

  closeButton?.addEventListener('click', close, { signal })

  for (const opener of document.querySelectorAll('[data-search-open]'))
    opener.addEventListener(
      'click',
      () => open(opener instanceof HTMLElement ? opener : undefined),
      { signal }
    )

  dialog.addEventListener(
    'close',
    () => lastOpener?.focus({ preventScroll: true }),
    { signal }
  )

  document.addEventListener(
    'keydown',
    (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        dialog.open ? close() : open()
      }
    },
    { signal }
  )

  // e.target === dialog ⇒ backdrop click
  dialog.addEventListener(
    'mousedown',
    (e) => e.target === dialog && close(),
    { signal }
  )

  let timer: ReturnType<typeof setTimeout> | undefined
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  input.addEventListener(
    'input',
    () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        const query = input.value.trim()
        if (!query) {
          results.innerHTML = ''
          hint.hidden = false
          return
        }
        const pf = await loadPagefind()
        if (!pf) return
        const found = await pf.search(query)
        const top = await Promise.all(
          found.results.slice(0, 8).map((r) => r.data())
        )
        hint.hidden = true
        results.innerHTML = top.length
          ? top
              .map(
                (item) => `
                <a href="${item.url}" class="search-result">
                  <span class="search-result-title">${escapeHtml(item.meta.title ?? 'Untitled')}</span>
                  <span class="search-result-excerpt">${item.excerpt}</span>
                </a>`
              )
              .join('')
          : `<p class="search-empty">No results for “${escapeHtml(query)}”.</p>`
      }, 160)
    },
    { signal }
  )
}

function setupHeadingAnchors() {
  const headings = document.querySelectorAll<HTMLHeadingElement>(
    '.prose :is(h1, h2, h3, h4, h5, h6)[id]'
  )
  for (const heading of headings) {
    if (heading.querySelector('.heading-anchor')) continue
    const anchor = document.createElement('a')
    anchor.className = 'heading-anchor'
    anchor.href = `#${heading.id}`
    anchor.textContent = heading.tagName.toLowerCase()
    anchor.setAttribute('aria-label', `Link to “${heading.textContent ?? ''}”`)
    heading.append(anchor)
  }
}

function init() {
  controller?.abort()
  revealObserver?.disconnect()
  controller = new AbortController()
  const { signal } = controller

  settleSoftNavigationReveals()
  setupHeader(signal)
  setupMobileNav(signal)
  setupThemeToggle(signal)
  setupReveal(signal)
  setupBackToTop(signal)
  setupProgress(signal)
  setupToc(signal)
  setupCodeBlocks(signal)
  setupImageLoading(signal)
  setupImageZoom(signal)
  setupSearch(signal)
  setupHeadingAnchors()
}

// astro:page-load fires on first load AND after every ClientRouter soft
// navigation, so init() must be idempotent per document.
let pageLoadFired = false
document.addEventListener('astro:page-load', () => {
  pageLoadFired = true
  init()
})
// Soft navigations only: abort page-scoped work before the DOM swap and tag
// the incoming document for settleSoftNavigationReveals.
document.addEventListener('astro:before-swap', (event) => {
  controller?.abort()
  document.documentElement.classList.remove('medium-zoom--opened')
  event.newDocument.documentElement.setAttribute('data-soft-navigation', '')
})
// Fallback for forks that removed <ClientRouter />: the timeout lets a
// same-tick astro:page-load claim the first run, so first load inits once.
const fallbackInit = () =>
  setTimeout(() => {
    if (!pageLoadFired) init()
  }, 0)
if (document.readyState !== 'loading') fallbackInit()
else document.addEventListener('DOMContentLoaded', fallbackInit, { once: true })
