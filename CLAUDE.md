# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse,
/qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /retro,
/investigate, /document-release, /codex, /cso, /autoplan, /careful, /freeze, /guard,
/unfreeze, /gstack-upgrade.
If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.

## Testing
Run the suite with `node node_modules/vitest/vitest.mjs run` (the bare `vitest`/`npm`
shims may be broken in this WSL-installed tree — see the Windows build/run memory note).

The global vitest environment is **node** (pure-logic tests: PRNG, event bus, KPI/SPC
math, ERP generators — no DOM). Component tests opt into a DOM by adding the per-file
pragma on **line 1**:

```ts
// @vitest-environment jsdom
```

and importing the matchers in-file with `import '@testing-library/jest-dom/vitest'`.
`src/test/setup-dom.ts` (wired via `test.setupFiles`) is a no-op under node and only
polyfills `ResizeObserver`/`scrollIntoView` under jsdom. `vite.config.ts` seeds
`--experimental-require-module` into `NODE_OPTIONS` so jsdom@27's ESM-only encoding
dependency loads under Node <22.12 — do not remove it or every jsdom test breaks.

Component test files use the `*.dom.test.tsx` suffix and follow the same describe/it
style as the logic tests. New functions/components are expected to ship with tests.
