# Contributing to Serene

Thanks for helping improve Serene. Keep changes focused on the theme itself and
preserve its reading-first visual language: calm motion, readable prose, and
progressive enhancement.

## Local setup

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run check
npm run build
```

The build also generates the Pagefind index in `dist/`.

## Content and configuration

- Use `src/site.config.ts` for site identity, navigation, and social links.
- Keep sample content changes separate from component or styling changes.
- Do not enable a hosted backend or add a secret to the default configuration.
- New external services must be optional, documented, and disabled by default.

## Pull requests

Explain the user-facing reason for the change, include verification commands,
and attach screenshots for visual changes when practical.
