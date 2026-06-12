// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LangToggle } from './LangToggle'
import { useTourStore } from './tourStore'

function resetTourStore() {
  localStorage.clear()
  useTourStore.setState({
    activeTour: null,
    chapterIdx: 0,
    stepIdx: 0,
    status: 'idle',
    autoplay: true,
    lang: 'zh',
    centerOpen: false,
    completed: {},
    welcomeSeen: false,
  })
}

describe('LangToggle', () => {
  beforeEach(resetTourStore)
  afterEach(cleanup)

  it('shows the zh→EN affordance and aria-label when lang is zh', () => {
    render(<LangToggle />)
    const btn = screen.getByRole('button', { name: 'Switch to English' })
    expect(btn).toHaveTextContent('中 / EN')
  })

  it('flips the store lang and the aria-label/text on click (zh→en)', async () => {
    const user = userEvent.setup()
    render(<LangToggle />)
    await user.click(screen.getByRole('button', { name: 'Switch to English' }))
    expect(useTourStore.getState().lang).toBe('en')
    const btn = screen.getByRole('button', { name: '切換為中文' })
    expect(btn).toHaveTextContent('EN / 中')
  })

  it('flips back en→zh on a second click and persists each lang', async () => {
    const user = userEvent.setup()
    render(<LangToggle />)
    const get = () =>
      screen.getByRole('button', { name: /Switch to English|切換為中文/ })
    await user.click(get())
    expect(useTourStore.getState().lang).toBe('en')
    expect(localStorage.getItem('fabpulse.tour.lang')).toBe('en')
    await user.click(get())
    expect(useTourStore.getState().lang).toBe('zh')
    expect(localStorage.getItem('fabpulse.tour.lang')).toBe('zh')
  })

  it('reflects an externally-set lang without a click', () => {
    useTourStore.getState().setLang('en')
    render(<LangToggle />)
    expect(screen.getByRole('button', { name: '切換為中文' })).toBeInTheDocument()
  })
})
