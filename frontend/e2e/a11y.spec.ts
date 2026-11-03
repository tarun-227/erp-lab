import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Automated WCAG 2.2 AA check of every step, in both themes. Plotly's own SVG internals are excluded
// (each plot carries a text summary as its accessible name instead).
for (const theme of ['light', 'dark'] as const) {
  test(`every step passes axe in the ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme })
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
    await page.goto('/')
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await page.getByRole('button', { name: 'Load sample recording' }).click()
    await expect(page.getByRole('button', { name: 'Continue to Events' })).toBeVisible()

    const steps: [string, string][] = [['1', 'load'], ['2', 'events'], ['3', 'epoching'], ['4', 'erp'], ['5', 'learn'], ['6', 'export']]
    for (const [key, name] of steps) {
      await page.keyboard.press(key)
      await page.waitForTimeout(1200)
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .exclude('.js-plotly-plot')
        .analyze()
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(serious.map((v) => `${name}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([])
    }
  })
}
