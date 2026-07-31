import avatar from './assets/avatar.svg'

/**
 * Serene — site configuration.
 * Site identity, personal details, navigation and contact links live here.
 */

export interface NavItem {
  label: string
  href: string
}

export interface SocialLink {
  label: string
  href: string
  icon: 'github' | 'mail' | 'x' | 'link'
}

export const siteConfig = {
  /** Production URL — used for canonical links, sitemap, RSS and Open Graph. */
  site: 'https://astro-theme-serene.vercel.app',

  /** Theme repository link shown in the footer. */
  repository: 'https://github.com/yu030x/astro-theme-serene',

  /** Site title, shown in the header and browser tab. */
  title: 'Serene',

  /** Used in meta descriptions and the RSS feed. */
  description:
    'A serene, editorial blog theme for Astro — quiet design, fluid motion, instant loads.',

  /** Display name for the demo site (footer, metadata). Swap for your own. */
  author: 'Serene',

  /** Author profile URL used by article structured data. */
  authorUrl: 'https://github.com/yu030x',

  /** One-line introduction under the title on the home page. */
  tagline: 'An Astro theme for quiet reading.',

  /** Short serif motto under the site name on the home masthead. */
  motto: 'Quiet reading, by design.',

  /** A slightly longer introduction for the home page. */
  bio: 'Editorial structure, system type, and calm motion — everything defers to the sentence you are reading.',

  /** Statically imported so Astro can optimize it everywhere it is rendered. */
  avatar,

  /** BCP 47 tag used for <html lang> and date formatting. */
  locale: 'en-US',

  /** Posts per page on /blog. */
  postsPerPage: 8,

  /** License notice shown after every published article. */
  articleLicense: {
    enabled: true,
    name: 'CC BY-NC-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
  },

  /** GitHub contribution calendar on the Projects page. */
  githubContributions: {
    enabled: true,
    username: 'example'
  },

  /**
   * Optional Waline comments and reactions. Disabled by default so the theme
   * does not make external requests until a site owner opts in.
   */
  waline: {
    enabled: false,
    /** Replace with your own Waline server before enabling. */
    serverURL: 'https://example.com'
  },

  /** Delimiter between page title and site title. */
  titleDelimiter: '·',

  /** Links page — site info shown in the "Apply Links" section (click to copy). */
  links: {
    applyTip: [
      { name: 'Name', val: 'Serene' },
      { name: 'Desc', val: 'An Astro theme for quiet reading.' },
      { name: 'Link', val: 'https://astro-theme-serene.vercel.app' },
      { name: 'Avatar', val: 'https://astro-theme-serene.vercel.app/avatar.svg' }
    ]
  },

  /** Header navigation. */
  nav: [
    { label: 'Blog', href: '/blog' },
    { label: 'Projects', href: '/projects' },
    { label: 'Links', href: '/links' },
    { label: 'About', href: '/about' }
  ] satisfies NavItem[],

  /** Social / contact links on the home page, about page and footer. */
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
