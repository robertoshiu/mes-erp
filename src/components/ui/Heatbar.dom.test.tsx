// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Heatbar } from './Heatbar'

afterEach(cleanup)

describe('Heatbar', () => {
  it('exposes meter ARIA values', () => {
    render(<Heatbar value={30} max={100} />)
    const meter = screen.getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuenow', '30')
    expect(meter).toHaveAttribute('aria-valuemax', '100')
  })

  it('renders a label and value when label is set', () => {
    render(<Heatbar value={75} max={100} label="Coverage" />)
    expect(screen.getByText('Coverage')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('uses the label for the meter aria-label', () => {
    render(<Heatbar value={5} max={10} label="Stock" />)
    expect(screen.getByRole('meter', { name: 'Stock' })).toBeInTheDocument()
  })

  it('does not crash with a zero max', () => {
    render(<Heatbar value={5} max={0} />)
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuemax', '0')
  })
})
