import { expect, test } from '@playwright/test'

for (const route of ['/about', 'http://127.0.0.1:4400/__fixtures/tools']) {
  test(`tool sections retain unique local heading associations: ${route}`, async ({ page }) => {
    await page.goto(route)
    const groups = page.locator('section.tool-group')
    expect(await groups.count()).toBeGreaterThan(0)
    const associations = await groups.evaluateAll(sections => sections.map(section => {
      const id = section.getAttribute('aria-labelledby')
      const heading = section.querySelector('h3')
      return {
        id,
        local: Boolean(id && heading?.id === id && document.getElementById(id) === heading),
        count: [...document.querySelectorAll('[id]')].filter(node => node.id === id).length
      }
    }))
    expect(new Set(associations.map(item => item.id)).size).toBe(associations.length)
    for (const association of associations) {
      expect(association.local).toBe(true)
      expect(association.count).toBe(1)
    }
    if (route.includes('__fixtures')) {
      await expect(groups.locator('h3')).toHaveText(['Development', 'Development', 'A B', 'A B', '中文工具'])
    }
  })
}
