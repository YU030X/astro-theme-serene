import { siteConfig, type NavItem } from '../site.config'
import { translate, type MessageKey, type MessageParams } from './i18n'

export const t = (key: MessageKey, params?: MessageParams) => translate(siteConfig.uiLocale, key, params)
export const navLabel = (item: NavItem) => item.label ?? (item.labelKey ? t(item.labelKey) : item.href)
export const postCount = (count: number) => t(count === 1 ? 'count.post' : 'count.posts', { count })
