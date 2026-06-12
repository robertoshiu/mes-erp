// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AnimatedNumber } from './AnimatedNumber'

// Force the prefers-reduced-motion instant path so assertions are synchronous
// (no rAF flush needed): matchMedia(...).matches === true.
function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

afterEach(cleanup)

describe('AnimatedNumber (reduced-motion instant path)', () => {
  beforeEach(() => mockReducedMotion(true))

  it('renders the initial value', () => {
    render(<AnimatedNumber value={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('snaps to a new value instantly under reduced motion', () => {
    const { rerender } = render(<AnimatedNumber value={10} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    rerender(<AnimatedNumber value={250} />)
    expect(screen.getByText('250')).toBeInTheDocument()
  })

  it('applies a custom format function', () => {
    render(<AnimatedNumber value={1000} format={n => `$${Math.round(n)}`} />)
    expect(screen.getByText('$1000')).toBeInTheDocument()
  })
})
