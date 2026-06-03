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
  build: {
    rollupOptions: {
      output: {
        // Keep recharts + its (CommonJS) dependency cluster in ONE chunk. Vite 8's
        // rolldown bundler mis-wires es-toolkit's CJS interop when recharts is split
        // across the lazy route chunks — the XAxis chunk ends up calling a
        // `require_get` that lives in the AreaChart chunk, throwing
        // "require_get is not a function" and crashing EVERY full-Cartesian chart
        // (KPI, SPC, Demand Planning) in the production build only (dev/esbuild is
        // fine). Co-locating them removes the cross-chunk reference. See the
        // dashboard-liveness debugging notes.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](recharts|es-toolkit|victory-vendor|d3-[a-z0-9-]+|internmap|react-is|decimal\.js[a-z-]*|fast-equals|reduce-css-calc|reselect|immer|redux|react-redux|@reduxjs[\\/]toolkit|react-smooth|react-transition-group|eventemitter3|tiny-invariant)[\\/]/.test(id)) {
            return 'charts'
          }
        },
      },
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
