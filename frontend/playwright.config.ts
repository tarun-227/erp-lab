import { resolve } from 'node:path'
import { defineConfig } from '@playwright/test'

// End-to-end smoke test against the real backend. Locally it uses the installed Edge or Chrome
// (set PW_CHANNEL); in CI it uses Playwright's own Chromium. PYTHON points at the interpreter
// that has requirements.txt installed (e.g. ../.venv/Scripts/python.exe on Windows).
const python = process.env.PYTHON ? `"${resolve(process.env.PYTHON)}"` : 'python'
const runPy = `"${resolve(import.meta.dirname, '..', 'run.py')}"`

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  // The first ERP after the server starts filters a 15-minute recording (about 6 s, longer on a busy machine).
  expect: { timeout: 45_000 },
  use: {
    baseURL: 'http://127.0.0.1:8123',
    channel: process.env.CI ? undefined : (process.env.PW_CHANNEL ?? 'msedge'),
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `${python} ${runPy} --port 8123`,
    url: 'http://127.0.0.1:8123/api/health',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
})
