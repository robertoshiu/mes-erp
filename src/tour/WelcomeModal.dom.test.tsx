// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { WelcomeModal } from './WelcomeModal'
import { useTourStore } from './tourStore'

// The modal calls startTour('full-flow'), which goes through the lazy loader.
// Mock it so the start path is observable without resolving real tour content.
vi.mock('./tours', () => ({
  loadTourById: vi.fn().mockResolvedValue(null),
  loadModuleTour: vi.fn().mockResolvedValue(null),
  tourMeta: [],
}))

const APPEAR_DELAY_MS = 1200

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

/** Render the modal and advance past its 1200ms appear delay. */
function renderAndAppear() {
  render(<WelcomeModal />)
  // Not visible immediately.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(APPEAR_DELAY_MS)
  })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
}

describe('WelcomeModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetTourStore()
  })
  afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('stays hidden when welcomeSeen is already true', () => {
    useTourStore.setState({ welcomeSeen: true })
    render(<WelcomeModal />)
    act(() => {
      vi.advanceTimersByTime(APPEAR_DELAY_MS * 2)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('appears only after the 1200ms delay', () => {
    render(<WelcomeModal />)
    act(() => {
      vi.advanceTimersByTime(APPEAR_DELAY_MS - 1)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '歡迎使用 FabPulse' })).toBeInTheDocument()
  })

  it('Start full tour marks welcomeSeen and starts the full-flow tour', async () => {
    const { loadTourById } = await import('./tours')
    renderAndAppear()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /開始完整導覽/ }))
    })
    expect(useTourStore.getState().welcomeSeen).toBe(true)
    expect(loadTourById).toHaveBeenCalledWith('full-flow')
  })

  it('Browse Tour Center marks welcomeSeen and opens the center', () => {
    renderAndAppear()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /瀏覽導覽中心/ }))
    })
    expect(useTourStore.getState().welcomeSeen).toBe(true)
    expect(useTourStore.getState().centerOpen).toBe(true)
  })

  it('Skip marks welcomeSeen and dismisses without opening anything', () => {
    renderAndAppear()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /略過/ }))
    })
    expect(useTourStore.getState().welcomeSeen).toBe(true)
    expect(useTourStore.getState().centerOpen).toBe(false)
  })

  it('Escape dismisses the modal and marks welcomeSeen', () => {
    renderAndAppear()
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(useTourStore.getState().welcomeSeen).toBe(true)
  })
})
