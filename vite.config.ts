import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.GITHUB_ACTIONS ? '/mes-erp/' : './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    // Default to the node environment: every current test is pure logic (PRNG,
    // event bus, KPI math, SPC rules, ERP generators) and needs no DOM. This is
    // both the correct env for them and avoids a known upstream breakage in the
    // jsdom@27 → html-encoding-sniffer@6 → @exodus/bytes (ESM-only) require chain.
    // For a future React component test, add `// @vitest-environment jsdom`
    // (or happy-dom) at the top of that specific test file.
    environment: 'node',
  },
})
