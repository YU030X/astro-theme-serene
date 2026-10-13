import { translate, type MessageKey, type MessageParams } from './i18n'

// Read on each call: Astro replaces root attributes during soft navigation.
export const t = (key: MessageKey, params?: MessageParams) =>
  translate(document.documentElement.dataset.uiLocale, key, params)
