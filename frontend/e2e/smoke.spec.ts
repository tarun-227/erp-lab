import { expect, test } from '@playwright/test'

test('a student can go from the sample recording to an exported pipeline', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Skip', exact: true }).click()

  // 1. Load
  await page.getByRole('button', { name: 'Load sample recording' }).click()
  await expect(page.getByRole('button', { name: 'Continue to Events' })).toBeVisible()
  await expect(page.getByText('response/error', { exact: true }).first()).toBeVisible()

  // 2. Events
  await page.getByRole('button', { name: 'Continue to Events' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Events and conditions' })).toBeVisible()
  await expect(page.getByLabel('Name for code 2')).toHaveValue('response/error')

  // 3. Epoching: stats and the linked plots appear
  await page.getByRole('button', { name: 'Continue to Epoching' }).click()
  await expect(page.getByText('Epochs kept')).toBeVisible()
  await expect(page.locator('[data-plot=raw] .js-plotly-plot')).toBeVisible()
  await expect(page.locator('[data-plot=erp_image] .js-plotly-plot')).toBeVisible()

  // 4. ERP: the peak table has the error responses and the difference wave (the ERN)
  await page.getByRole('button', { name: 'Continue to ERP' }).click()
  await expect(page.getByRole('row').filter({ hasText: /^response\/error/ })).toContainText('µV')
  await expect(page.getByRole('row').filter({ hasText: /^Difference/ })).toContainText('ms')
  await expect(page.locator('[data-plot=topomap] .js-plotly-plot')).toBeVisible()

  // 5. Learn: answering a quiz question gives feedback
  await page.getByRole('button', { name: 'Check your understanding' }).click()
  await page.getByRole('button', { name: '2 µV', exact: true }).click()
  await expect(page.getByText('Correct.')).toBeVisible()

  // 6. Export: the script reflects the current parameters
  await page.keyboard.press('6')
  await expect(page.locator('pre')).toContainText('mne.Epochs')
  await expect(page.locator('pre')).toContainText('reject=dict(eeg=150.0e-6)')
})
