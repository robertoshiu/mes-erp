// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { TourController } from './TourController'
import { useTourStore } from './tourStore'
import { useUiStore } from '@/lib/uiStore'
import type { EventBus } from '@/lib/eventBus'
import type { TourDefinition } from './types'

/* ──────────────────────────────────────────────────────────────────────────
 * TourController integration-lite (jsdom). The controller portals the spotlight
 * + card to document.body when a tour is running, tracks the target rect via rAF
 * polling, and owns the keyboard shortcuts (Arrow/Esc/?). We:
 *   - stub the event bus (ofTopic→subscribe→unsubscribe) so waitFor steps are inert
 *   - stub requestAnimationFrame to run synchronously so rect tracking resolves
 *   - mount a real `[data-tour]` target div in document.body
 * ────────────────────────────────────────────────────────────────────────── */

// Inert event bus: ofTopic returns an observable-ish with subscribe→unsubscribe.
const stubBus = {
  ofTopic: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
} as unknown as EventBus

/** A one-step tour whose single step spotlights an existing DOM target. */
function oneStepTour(): TourDefinition {
  return {
    id: 'ctl-tour',
    title: { zh: '控制器測試', en: 'Controller test' },
    description: { zh: 'd', en: 'd' },
    estMinutes: 1,
    chapters: [
      {
        id: 'c',
        title: { zh: '章', en: 'Ch' },
        steps: [
          { id: 'only', target: 'ctl-anchor', title: { zh: '步驟', en: 'Step' }, body: { zh: 'b', en: 'b' } },
        ],
      },
    ],
  }
}

/** A two-step tour (no targets) for ArrowRight advancement. */
function twoStepTour(): TourDefinition {
  return {
    id: 'ctl-tour-2',
    title: { zh: '雙步', en: 'Two' },
    description: { zh: 'd', en: 'd' },
    estMinutes: 1,
    chapters: [
      {
        id: 'c',
        title: { zh: '章', en: 'Ch' },
        steps: [
          { id: 's0', title: { zh: '步驟一', en: 'Step one' }, body: { zh: 'b0', en: 'b0' } },
          { id: 's1', title: { zh: '步驟二', en: 'Step two' }, body: { zh: 'b1', en: 'b1' } },
        ],
      },
    ],
  }
}

let anchor: HTMLDivElement
let rafSpy: ReturnType<typeof vi.spyOn>

function resetStores() {
  localStorage.clear()
  useTourStore.setState({
    activeTour: null,
    chapterIdx: 0,
    stepIdx: 0,
    status: 'idle',
    autoplay: false, // disable the autoplay clock so steps don't self-advance
    lang: 'zh',
    centerOpen: false,
    completed: {},
    welcomeSeen: false,
  })
  useUiStore.setState({ activeRoute: 'fab-floor', selectedEntity: null })
}

describe('TourController', () => {
  beforeEach(() => {
    resetStores()
    // Defer rAF callbacks to a microtask (NOT inline-synchronous): the controller
    // does `let firstRaf = requestAnimationFrame(() => { firstRaf = rAF(commit) })`,
    // and an inline-synchronous stub would run the inner callback before `firstRaf`
    // is initialized (a TDZ ReferenceError). A microtask defer lets the assignment
    // settle first, and tests flush with `await Promise.resolve()` inside act().
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      queueMicrotask(() => cb(performance.now()))
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    // Give the target a non-zero rect.
    anchor = document.createElement('div')
    anchor.setAttribute('data-tour', 'ctl-anchor')
    anchor.getBoundingClientRect = () =>
      ({ left: 40, top: 60, width: 120, height: 50, right: 160, bottom: 110, x: 40, y: 60, toJSON() {} } as DOMRect)
    document.body.appendChild(anchor)
  })
  afterEach(() => {
    cleanup()
    anchor.remove()
    rafSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('renders nothing while idle', () => {
    render(<TourController eventBus={stubBus} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('portals a TourCard dialog + spotlight once a tour starts on an existing target', async () => {
    render(<TourController eventBus={stubBus} />)
    await act(async () => {
      useTourStore.getState().startTourDef(oneStepTour())
      await Promise.resolve()
    })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '步驟' })).toBeInTheDocument()
    // The spotlight ring (accent-bordered div) is rendered alongside the card.
    const ring = Array.from(document.body.querySelectorAll<HTMLElement>('div')).find(el =>
      el.style.border.includes('var(--accent)'),
    )
    expect(ring).toBeDefined()
  })

  it('advances to the next step on ArrowRight', () => {
    render(<TourController eventBus={stubBus} />)
    act(() => {
      useTourStore.getState().startTourDef(twoStepTour())
    })
    expect(screen.getByRole('heading', { name: '步驟一' })).toBeInTheDocument()
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })
    expect(useTourStore.getState().stepIdx).toBe(1)
    expect(screen.getByRole('heading', { name: '步驟二' })).toBeInTheDocument()
  })

  it('steps back on ArrowLeft', () => {
    render(<TourController eventBus={stubBus} />)
    act(() => {
      useTourStore.getState().startTourDef(twoStepTour())
      useTourStore.getState().next()
    })
    expect(useTourStore.getState().stepIdx).toBe(1)
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
    })
    expect(useTourStore.getState().stepIdx).toBe(0)
  })

  it('exits the tour on Escape', async () => {
    render(<TourController eventBus={stubBus} />)
    await act(async () => {
      useTourStore.getState().startTourDef(oneStepTour())
      await Promise.resolve()
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(useTourStore.getState().status).toBe('idle')
    expect(useTourStore.getState().activeTour).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"?" toggles the Tour Center open/closed (even mid-tour)', async () => {
    render(<TourController eventBus={stubBus} />)
    await act(async () => {
      useTourStore.getState().startTourDef(oneStepTour())
      await Promise.resolve()
    })
    expect(useTourStore.getState().centerOpen).toBe(false)
    act(() => {
      fireEvent.keyDown(window, { key: '?' })
    })
    expect(useTourStore.getState().centerOpen).toBe(true)
    act(() => {
      fireEvent.keyDown(window, { key: '?' })
    })
    expect(useTourStore.getState().centerOpen).toBe(false)
  })

  it('Space toggles pause/resume while running', () => {
    render(<TourController eventBus={stubBus} />)
    act(() => {
      useTourStore.getState().startTourDef(twoStepTour())
    })
    expect(useTourStore.getState().status).toBe('running')
    act(() => {
      fireEvent.keyDown(window, { key: ' ' })
    })
    expect(useTourStore.getState().status).toBe('paused')
    act(() => {
      fireEvent.keyDown(window, { key: ' ' })
    })
    expect(useTourStore.getState().status).toBe('running')
  })
})
