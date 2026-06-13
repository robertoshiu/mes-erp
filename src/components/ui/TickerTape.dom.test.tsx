// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { Subject } from 'rxjs'
import type { AppEvent } from '@/lib/events'
import { TickerTape } from './TickerTape'

// Control the reduced-motion branch. The component reads window.matchMedia
// lazily on render; default to the marquee (non-reduced) path.
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

function lotMove(lotId: string, toToolId: string): AppEvent {
  return {
    topic: 'lot.move',
    t: 0,
    lotId,
    fromToolId: 'T0',
    toToolId,
    routeStep: 1,
    operatorId: 'OP1',
    productCode: 'P1',
    customerName: 'Acme',
  }
}

function kpiTick(oee: number): AppEvent {
  return {
    topic: 'kpi.tick',
    t: 0,
    oee,
    yieldPct: 0.9,
    mtbfMinutes: 100,
    mttrMinutes: 10,
    wipTurn: 4,
    throughputUnitsPerHour: 200,
    cycleTimeMinutes: 5,
  }
}

afterEach(cleanup)

describe('TickerTape', () => {
  beforeEach(() => mockReducedMotion(false))

  it('shows the empty placeholder before any event arrives', () => {
    const source$ = new Subject<AppEvent>()
    render(<TickerTape source$={source$} />)
    expect(screen.getByText('Awaiting events…')).toBeInTheDocument()
  })

  it('renders an event short-text and topic tag after it is emitted', () => {
    const source$ = new Subject<AppEvent>()
    render(<TickerTape source$={source$} />)
    act(() => source$.next(lotMove('L42', 'ETCH-2')))
    // Marquee renders two copies of the track → tag/text appear more than once.
    expect(screen.getAllByText('LOT').length).toBeGreaterThan(0)
    expect(screen.getAllByText('L42 → ETCH-2').length).toBeGreaterThan(0)
  })

  it('formats a kpi.tick as a rounded OEE percentage', () => {
    const source$ = new Subject<AppEvent>()
    render(<TickerTape source$={source$} />)
    act(() => source$.next(kpiTick(0.826)))
    expect(screen.getAllByText('OEE 83%').length).toBeGreaterThan(0)
  })

  it('drops events whose topic is not in the accept filter', () => {
    const source$ = new Subject<AppEvent>()
    render(<TickerTape source$={source$} accept={['kpi.tick']} />)
    act(() => source$.next(lotMove('L99', 'CMP-1'))) // filtered out
    act(() => source$.next(kpiTick(0.5)))            // allowed
    expect(screen.queryByText('L99 → CMP-1')).not.toBeInTheDocument()
    expect(screen.getAllByText('OEE 50%').length).toBeGreaterThan(0)
  })

  it('ring-buffers to max, dropping the oldest event', () => {
    const source$ = new Subject<AppEvent>()
    render(<TickerTape source$={source$} max={2} />)
    act(() => source$.next(lotMove('OLD', 'A1')))
    act(() => source$.next(lotMove('MID', 'A2')))
    act(() => source$.next(lotMove('NEW', 'A3')))
    expect(screen.queryByText('OLD → A1')).not.toBeInTheDocument()
    expect(screen.getAllByText('MID → A2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('NEW → A3').length).toBeGreaterThan(0)
  })

  it('unsubscribes on unmount so post-unmount events are ignored', () => {
    const source$ = new Subject<AppEvent>()
    const { unmount } = render(<TickerTape source$={source$} />)
    expect(source$.observed).toBe(true)
    unmount()
    expect(source$.observed).toBe(false)
  })

  it('renders a static (non-marquee) list under reduced motion', () => {
    mockReducedMotion(true)
    const source$ = new Subject<AppEvent>()
    const { container } = render(<TickerTape source$={source$} />)
    act(() => source$.next(lotMove('L7', 'LITHO-1')))
    // The reduced-motion list renders a single copy (no .animate-ticker track).
    expect(container.querySelector('.animate-ticker')).toBeNull()
    expect(screen.getAllByText('L7 → LITHO-1')).toHaveLength(1)
  })
})
