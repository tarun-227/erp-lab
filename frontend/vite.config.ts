/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The dev server proxies /api to the FastAPI backend (python run.py --dev or uvicorn on :8000).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Plotly (~4.6 MB) is loaded lazily in its own chunk on the first plot, so a large chunk is expected.
  build: { chunkSizeWarningLimit: 5000 },
  test: { exclude: ['e2e/**', 'node_modules/**'] },
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
})
