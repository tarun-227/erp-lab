import { expect, test } from '@playwright/test'

for (const { sample, event, channel, row } of [
  { sample: 'Flanker task', event: 'response/error', channel: 'FCz', row: /^response\/error/ },
  { sample: 'Auditory oddball', event: 'tone/oddball', channel: 'CPz', row: /^tone\/oddball/ },
  { sample: 'Flickering light (SSVEP)', event: 'flicker/15 Hz', channel: 'O2', row: /^flicker\/15 Hz/ },
]) {
  test(`${sample} loads and reaches the ERP step with its own settings`, async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Skip', exact: true }).click()

    await page.getByRole('radio', { name: new RegExp(sample.replace(/[()]/g, '\\$&')) }).click()
    await page.getByRole('button', { name: 'Load sample recording' }).click()
    await expect(page.getByRole('button', { name: 'Continue to Events' })).toBeVisible()
    await expect(page.getByText(event, { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Step 4: ERP' }).click()
    await expect(page.locator('[data-plot=erp] h2')).toHaveText(`ERP at ${channel}`)
    await expect(page.getByRole('row').filter({ hasText: row })).toContainText('µV')
    await expect(page.locator('[data-plot=erp] .js-plotly-plot')).toBeVisible()
    await expect(page.locator('[data-plot=topomap] .js-plotly-plot')).toBeVisible()
    await expect(page.getByText('No epochs are left to average')).toHaveCount(0)
  })
}
