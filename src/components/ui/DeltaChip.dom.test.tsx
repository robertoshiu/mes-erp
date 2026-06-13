// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup } from '@testing-library/react'
import { DeltaChip } from './DeltaChip'

afterEach(cleanup)

const GOOD = '#34D399'
const BAD = '#FB7185'
const FLAT = '#74849E'

// The component renders a single wrapping <span> carrying the inline color and
// the (multi-node) magnitude text. Grab it directly rather than by text, since
// `{sign}{text}{suffix}` splits the readout across sibling text nodes.
function chip(container: HTMLElement) {
  return container.querySelector('span[style]') as HTMLElement
}

describe('DeltaChip', () => {
  it('renders a positive delta as green with a + sign (up = good by default)', () => {
    const { container } = render(<DeltaChip delta={5} />)
    const el = chip(container)
    expect(el).toHaveStyle({ color: GOOD })
    expect(el).toHaveTextContent('+5')
  })

  it('renders a negative delta as red with a minus sign', () => {
    const { container } = render(<DeltaChip delta={-3} />)
    const el = chip(container)
    expect(el).toHaveStyle({ color: BAD })
    // The sign is a U+2212 minus, not an ASCII hyphen.
    expect(el).toHaveTextContent('−3')
  })

  it('renders a zero delta as flat grey with no sign', () => {
    const { container } = render(<DeltaChip delta={0} />)
    const el = chip(container)
    expect(el).toHaveStyle({ color: FLAT })
    expect(el).toHaveTextContent('0')
    expect(el.textContent).not.toContain('+')
    expect(el.textContent).not.toContain('−')
  })

  it('inverts the tone so a positive delta reads bad (cost/lateness metrics)', () => {
    const { container } = render(<DeltaChip delta={4} invert />)
    expect(chip(container)).toHaveStyle({ color: BAD })
  })

  it('inverts the tone so a negative delta reads good', () => {
    const { container } = render(<DeltaChip delta={-4} invert />)
    expect(chip(container)).toHaveStyle({ color: GOOD })
  })

  it('shows integer magnitudes without a decimal', () => {
    const { container } = render(<DeltaChip delta={12} />)
    expect(chip(container)).toHaveTextContent('+12')
  })

  it('shows fractional magnitudes to one decimal place', () => {
    const { container } = render(<DeltaChip delta={2.345} />)
    expect(chip(container)).toHaveTextContent('+2.3')
  })

  it('appends a unit suffix to the magnitude', () => {
    const { container } = render(<DeltaChip delta={-1.5} suffix="pp" />)
    expect(chip(container)).toHaveTextContent('−1.5pp')
  })
})
