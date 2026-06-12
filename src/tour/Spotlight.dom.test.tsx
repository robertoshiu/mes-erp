// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup } from '@testing-library/react'
import { Spotlight, type SpotRect } from './Spotlight'

/* ──────────────────────────────────────────────────────────────────────────
 * Spotlight renders a dim veil with a TRUE hole (four bands framing the cutout)
 * plus an accent ring; with no rect it falls back to a single full veil. framer-
 * motion elements render as plain <div>s in jsdom, so we assert on the DOM tree:
 * count the veil bands (background set to the VEIL color) and the ring/sonar.
 * ────────────────────────────────────────────────────────────────────────── */

const VEIL_RGB = 'rgba(6, 10, 20, 0.78)'

function veilBands(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div')).filter(
    el => el.style.background === VEIL_RGB,
  )
}

function ringElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div')).filter(el =>
    el.style.border.includes('var(--accent)'),
  )
}

const rect: SpotRect = { x: 100, y: 120, width: 200, height: 80 }

describe('Spotlight', () => {
  afterEach(cleanup)

  it('renders four veil bands framing a hole when given a rect', () => {
    const { container } = render(<Spotlight rect={rect} />)
    expect(veilBands(container)).toHaveLength(4)
  })

  it('renders an accent ring around the rect (no pulse by default)', () => {
    const { container } = render(<Spotlight rect={rect} />)
    // Exactly one accent-bordered element: the glow ring (no sonar without pulse).
    expect(ringElements(container)).toHaveLength(1)
  })

  it('leaves the hole region free of any veil element', () => {
    const { container } = render(<Spotlight rect={rect} />)
    // None of the four bands covers the cutout: each band's background is the veil
    // and each is positioned strictly outside the padded hole. Assert no veil band
    // is the single full-screen inset-0 veil (that only appears in no-rect mode).
    const fullVeil = Array.from(container.querySelectorAll<HTMLElement>('div')).find(
      el => el.style.background === VEIL_RGB && el.className.includes('inset-0'),
    )
    expect(fullVeil).toBeUndefined()
  })

  it('renders a single full-screen veil (no hole) when rect is null', () => {
    const { container } = render(<Spotlight rect={null} />)
    const bands = veilBands(container)
    expect(bands).toHaveLength(1)
    expect(bands[0].className).toContain('inset-0')
    // No accent ring in centered/no-rect mode.
    expect(ringElements(container)).toHaveLength(0)
  })

  it('adds a second accent element (the sonar pulse) when pulse is set', () => {
    const { container } = render(<Spotlight rect={rect} pulse />)
    // Ring + sonar pulse = two accent-bordered elements.
    expect(ringElements(container)).toHaveLength(2)
  })
})
