// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SparkRing } from './SparkRing'
import { sem, brand } from '@/lib/tokens'

afterEach(cleanup)

describe('SparkRing', () => {
  it('exposes meter ARIA values from value/max', () => {
    render(<SparkRing value={7} max={10} />)
    const meter = screen.getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuenow', '7')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '10')
  })

  it('renders a raw value/max readout in the title', () => {
    const { container } = render(<SparkRing value={3} max={8} />)
    expect(container.querySelector('title')?.textContent).toBe('3 / 8')
  })

  it('defaults to the accent (brand) stroke color', () => {
    const { container } = render(<SparkRing value={5} max={10} />)
    const arc = container.querySelectorAll('circle')[1]
    expect(arc).toHaveAttribute('stroke', brand.primary)
  })

  it("derives the tone from the ratio when tone is 'auto' (high → success)", () => {
    const { container } = render(<SparkRing value={9} max={10} tone="auto" />)
    const arc = container.querySelectorAll('circle')[1]
    expect(arc).toHaveAttribute('stroke', sem.success)
  })

  it("derives critical for a low ratio under 'auto'", () => {
    const { container } = render(<SparkRing value={1} max={10} tone="auto" />)
    const arc = container.querySelectorAll('circle')[1]
    expect(arc).toHaveAttribute('stroke', sem.critical)
  })

  it('clamps an over-max value so the arc dash does not exceed the full circle', () => {
    const { container } = render(<SparkRing value={50} max={10} size={20} />)
    const arc = container.querySelectorAll('circle')[1]
    const [filled, circumference] = (arc.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number)
    // ratio is clamped to 1 → filled segment equals the full circumference.
    expect(filled).toBeCloseTo(circumference, 5)
  })

  it('falls back to critical and an empty arc when max is zero', () => {
    const { container } = render(<SparkRing value={5} max={0} tone="auto" />)
    const arc = container.querySelectorAll('circle')[1]
    expect(arc).toHaveAttribute('stroke', sem.critical)
    const [filled] = (arc.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number)
    expect(filled).toBe(0)
  })
})
