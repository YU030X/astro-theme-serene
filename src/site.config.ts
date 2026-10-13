import avatar from './assets/avatar.svg'
import type { MessageKey, UiLocale } from './lib/i18n'

/**
 * Serene — site configuration.
 * Site identity, personal details, navigation and contact links live here.
 */

export interface NavItem {
  label?: string
  labelKey?: MessageKey
  href: string
}

export interface SocialLink {
  label: string
  href: string
  icon: 'github' | 'mail' | 'x' | 'link'
}

export const siteConfig = {
  site: 'https://astro-theme-serene.vercel.app',
  repository: 'https://github.com/yu030x/astro-theme-serene',
  title: 'Serene',
  description:
    'A serene, editorial blog theme for Astro — quiet design, fluid motion, instant loads.',
  author: 'Serene',
  authorUrl: 'https://github.com/yu030x/astro-theme-serene',
  tagline: 'An Astro theme for quiet reading.',
  motto: 'Quiet reading, by design.',
  bio: 'Editorial structure, system type, and calm motion — everything defers to the sentence you are reading.',
  avatar,

  /**
   * Content/document language and date formatting are independent of UI copy.
   * Custom navigation labels and authored content are never translated.
   */
  locale: 'en-US',
  dateLocale: 'en-US',
  uiLocale: 'en' as UiLocale,

  postsPerPage: 8,

  articleLicense: {
    enabled: true,
    name: 'CC BY-NC-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
  },

  githubContributions: {
    enabled: true,
    username: 'example'
  },

  // Optional; disabled by default to avoid external requests.
  waline: {
    enabled: false,
    serverURL: 'https://example.com'
  },
  titleDelimiter: '·',

  // Information copied from the Links page application panel.
  links: {
    applyTip: [
      { name: 'Name', val: 'Serene' },
      { name: 'Desc', val: 'An Astro theme for quiet reading.' },
      { name: 'Link', val: 'https://astro-theme-serene.vercel.app' },
      { name: 'Avatar', val: 'https://astro-theme-serene.vercel.app/avatar.svg' }
    ]
  },

  nav: [
    { labelKey: 'nav.blog', href: '/blog' },
    { labelKey: 'nav.projects', href: '/projects' },
    { labelKey: 'nav.links', href: '/links' },
    { labelKey: 'nav.about', href: '/about' }
  ] satisfies NavItem[],

  socials: [
    {
      label: 'GitHub',
      href: 'https://github.com/yu030x/astro-theme-serene',
      icon: 'github'
    }

    // Optional social templates:
    // { label: 'X (Twitter)', href: 'https://x.com/your-username', icon: 'x' },
    // { label: 'Personal site', href: 'https://example.com', icon: 'link' }
  ] satisfies SocialLink[]
}

export type SiteConfig = typeof siteConfig
