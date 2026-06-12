// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RankBar } from './RankBar'

afterEach(cleanup)

const items = [
  { label: 'TSMC', value: 1200, hint: '42%' },
  { label: 'Samsung', value: 900 },
  { label: 'Intel', value: 400 },
]

describe('RankBar', () => {
  it('renders every item label and formatted value', () => {
    render(<RankBar items={items} />)
    expect(screen.getByText('TSMC')).toBeInTheDocument()
    expect(screen.getByText('Samsung')).toBeInTheDocument()
    expect(screen.getByText('1,200')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('applies a custom value formatter', () => {
    render(<RankBar items={items} formatValue={n => `$${n}`} />)
    expect(screen.getByText('$1200')).toBeInTheDocument()
  })

  it('renders rows as buttons and fires onSelect with item + index', async () => {
    const onSelect = vi.fn()
    render(<RankBar items={items} onSelect={onSelect} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    await userEvent.click(buttons[1])
    expect(onSelect).toHaveBeenCalledWith(items[1], 1)
  })

  it('renders non-interactive rows (no buttons) without onSelect', () => {
    render(<RankBar items={items} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
