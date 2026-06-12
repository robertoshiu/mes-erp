// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DonutSpark } from './DonutSpark'

afterEach(cleanup)

const segments = [
  { value: 30, color: '#22D3EE', label: 'Raw' },
  { value: 50, color: '#818CF8', label: 'WIP' },
  { value: 20, color: '#34D399', label: 'Finished' },
]

describe('DonutSpark', () => {
  it('renders the segment total in the center by default', () => {
    render(<DonutSpark segments={segments} centerLabel="Total" />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('renders a custom center value', () => {
    render(<DonutSpark segments={segments} centerValue="3" centerLabel="Types" />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders a title tooltip per segment (label + value)', () => {
    const { container } = render(<DonutSpark segments={segments} />)
    const titles = Array.from(container.querySelectorAll('title')).map(t => t.textContent)
    expect(titles).toContain('Raw: 30')
    expect(titles).toContain('WIP: 50')
    expect(titles).toContain('Finished: 20')
  })

  it('handles an all-zero total without crashing', () => {
    const { container } = render(
      <DonutSpark segments={[{ value: 0, color: '#22D3EE', label: 'None' }]} />,
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
