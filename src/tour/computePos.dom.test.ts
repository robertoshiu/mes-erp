// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { computePos } from './TourCard'

/* ──────────────────────────────────────────────────────────────────────────
 * computePos places the description card near the spotlit rect, clamped into
 * the viewport. Regression guard for the v1.1.1.0 bug: a near-fullscreen hero
 * (e.g. the cockpit swimlane) left no room on any side, auto-placement fell to
 * 'left', and the card clamped to MARGIN=12 — landing ON TOP of the 224px
 * sidebar, far from the highlight. With a leftInset the card must stay in the
 * main content column (left >= leftInset + MARGIN) and never on the sidebar.
 * computePos reads window.innerWidth/innerHeight, so these run under jsdom.
 * ────────────────────────────────────────────────────────────────────────── */

const SIDEBAR = 224 // App's `w-56` sidebar width
const CARD_W = 380
const MARGIN = 12

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true })
}

describe('computePos', () => {
  beforeEach(() => setViewport(1440, 900))

  it('never lands the card on the sidebar for a near-fullscreen hero', () => {
    // The cockpit swimlane: fills the main area, no room on any side.
    const hero = { x: 240, y: 150, width: 1184, height: 734 }
    const pos = computePos(hero, 'auto', 260, SIDEBAR)
    expect(pos.left).toBeGreaterThanOrEqual(SIDEBAR + MARGIN)
    // and still on-screen
    expect(pos.left).toBeLessThanOrEqual(1440 - CARD_W - MARGIN)
  })

  it('clamps an explicit left placement off the sidebar too', () => {
    // A hero hugging the sidebar with placement:'left' would compute a negative
    // left and previously clamp to MARGIN (on the sidebar). Now clamps to minLeft.
    const hero = { x: 250, y: 300, width: 900, height: 200 }
    const pos = computePos(hero, 'left', 220, SIDEBAR)
    expect(pos.left).toBeGreaterThanOrEqual(SIDEBAR + MARGIN)
  })

  it('centers a no-rect step within the main content area (right of the sidebar)', () => {
    const pos = computePos(null, 'auto', 260, SIDEBAR)
    expect(pos.placement).toBe('center')
    // centered in [leftInset, vw]: 224 + (1440-224-380)/2 = 642
    expect(pos.left).toBeCloseTo(SIDEBAR + (1440 - SIDEBAR - CARD_W) / 2, 0)
    expect(pos.left).toBeGreaterThanOrEqual(SIDEBAR + MARGIN)
  })

  it('keeps a comfortable placement when a side has room (no clamp needed)', () => {
    // Small hero in the upper-left of the main area: 'right' fits without clamping.
    const hero = { x: 300, y: 120, width: 200, height: 120 }
    const pos = computePos(hero, 'right', 200, SIDEBAR)
    // right placement => left = x + width + GAP = 300 + 200 + 16 = 516
    expect(pos.placement).toBe('right')
    expect(pos.left).toBe(516)
  })

  it('is backward compatible with no leftInset (clamps to MARGIN)', () => {
    const hero = { x: 0, y: 0, width: 1440, height: 900 }
    const pos = computePos(hero, 'left', 220) // leftInset defaults to 0
    expect(pos.left).toBeGreaterThanOrEqual(MARGIN)
  })
})
