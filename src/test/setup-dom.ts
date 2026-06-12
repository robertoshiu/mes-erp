/* ──────────────────────────────────────────────────────────────────────────
 * Shared test setup, wired globally via vite.config.ts `test.setupFiles`.
 *
 * The global vitest env is `node` (pure-logic tests); component tests opt into
 * jsdom with a `// @vitest-environment jsdom` pragma on line 1. This file must
 * therefore be a NO-OP under the node env and only install DOM helpers when a
 * real `window` exists — otherwise it would crash every node-env test on import.
 *
 * Under jsdom it polyfills ResizeObserver, which jsdom does not implement but
 * several tour components (TourCard's height measurement, the controller's rect
 * tracking) construct in effects. The jest-dom matchers are registered per test
 * file via `import '@testing-library/jest-dom/vitest'` so their type augmentation
 * is visible to tsc within each component test.
 * ────────────────────────────────────────────────────────────────────────── */
if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    ;(window as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
      ResizeObserverStub
    ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
      ResizeObserverStub
  }

  // jsdom implements scrollIntoView as a no-op throw in some versions; ensure it
  // exists so the controller's `el.scrollIntoView(...)` never crashes a test.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView(): void {}
  }
}
