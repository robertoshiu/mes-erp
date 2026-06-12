// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { motionValue } from 'framer-motion'
import { TourCard } from './TourCard'
import { useTourStore } from './tourStore'
import type { TourChapter, TourStep } from './types'

/* ──────────────────────────────────────────────────────────────────────────
 * TourCard component tests (jsdom). TourCard is a controlled view: navigation
 * is delegated to callbacks (onPrev/onNext/…), but the embedded LangToggle reads
 * + writes the live tour store. We render with real callbacks (vi.fn) and a real
 * MotionValue for the progress bar.
 * ────────────────────────────────────────────────────────────────────────── */

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

const chapter: TourChapter = {
  id: 'ch-a',
  title: { zh: '製造執行', en: 'MES Execution' },
  steps: [],
}

function makeStep(over: Partial<TourStep> = {}): TourStep {
  return {
    id: 's1',
    title: { zh: '車間總覽', en: 'Fab Floor' },
    body: { zh: '觀察 **即時** 脈動與 `OEE`。', en: 'Watch the **live** pulse and `OEE`.' },
    ...over,
  }
}

interface Handlers {
  onPrev: ReturnType<typeof vi.fn<() => void>>
  onNext: ReturnType<typeof vi.fn<() => void>>
  onTogglePause: ReturnType<typeof vi.fn<() => void>>
  onClose: ReturnType<typeof vi.fn<() => void>>
  onGoChapter: ReturnType<typeof vi.fn<(idx: number) => void>>
}

function renderCard(opts: {
  step?: TourStep
  flatIndex?: number
  flatTotal?: number
  chapterCount?: number
  chapterIdx?: number
  paused?: boolean
  waitingForLive?: boolean
  liveFired?: boolean
} = {}): Handlers {
  const handlers: Handlers = {
    onPrev: vi.fn<() => void>(),
    onNext: vi.fn<() => void>(),
    onTogglePause: vi.fn<() => void>(),
    onClose: vi.fn<() => void>(),
    onGoChapter: vi.fn<(idx: number) => void>(),
  }
  render(
    <TourCard
      step={opts.step ?? makeStep()}
      chapter={chapter}
      lang={useTourStore.getState().lang}
      rect={null}
      flatIndex={opts.flatIndex ?? 1}
      flatTotal={opts.flatTotal ?? 4}
      chapterCount={opts.chapterCount ?? 3}
      chapterIdx={opts.chapterIdx ?? 0}
      paused={opts.paused ?? false}
      progressMv={motionValue(0)}
      waitingForLive={opts.waitingForLive ?? false}
      liveFired={opts.liveFired ?? false}
      onPrev={handlers.onPrev}
      onNext={handlers.onNext}
      onTogglePause={handlers.onTogglePause}
      onClose={handlers.onClose}
      onGoChapter={handlers.onGoChapter}
    />,
  )
  return handlers
}

describe('TourCard', () => {
  beforeEach(resetTourStore)
  afterEach(cleanup)

  it('renders the title, chapter label and body for the current language (zh)', () => {
    renderCard()
    expect(screen.getByRole('heading', { name: '車間總覽' })).toBeInTheDocument()
    expect(screen.getByText('製造執行')).toBeInTheDocument()
    // body rich-text content (across <strong>/<code> nodes) is present
    expect(screen.getByText('即時')).toBeInTheDocument()
    expect(screen.getByText('OEE')).toBeInTheDocument()
  })

  it('shows the step counter as flatIndex+1/flatTotal', () => {
    renderCard({ flatIndex: 1, flatTotal: 4 })
    expect(screen.getByText(/2\/4/)).toBeInTheDocument()
  })

  it('renders **bold** as <strong> and `code` as <code>', () => {
    renderCard()
    const strong = screen.getByText('即時')
    expect(strong.tagName).toBe('STRONG')
    const code = screen.getByText('OEE')
    expect(code.tagName).toBe('CODE')
  })

  it('toggles zh→EN via LangToggle, updating both the store and the rendered text', async () => {
    const user = userEvent.setup()
    // The card receives lang as a prop, so re-render on store change via a wrapper.
    function Harness() {
      const lang = useTourStore(s => s.lang)
      return (
        <TourCard
          step={makeStep()}
          chapter={chapter}
          lang={lang}
          rect={null}
          flatIndex={0}
          flatTotal={2}
          chapterCount={1}
          chapterIdx={0}
          paused={false}
          progressMv={motionValue(0)}
          waitingForLive={false}
          liveFired={false}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onTogglePause={vi.fn()}
          onClose={vi.fn()}
          onGoChapter={vi.fn()}
        />
      )
    }
    render(<Harness />)
    expect(screen.getByRole('heading', { name: '車間總覽' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Switch to English' }))
    expect(useTourStore.getState().lang).toBe('en')
    expect(screen.getByRole('heading', { name: 'Fab Floor' })).toBeInTheDocument()
    expect(screen.getByText('live')).toBeInTheDocument()
  })

  it('calls onPrev / onNext / onTogglePause when those controls are clicked', async () => {
    const user = userEvent.setup()
    const h = renderCard({ flatIndex: 1, flatTotal: 4 })
    await user.click(screen.getByRole('button', { name: '上一步' }))
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '暫停' }))
    expect(h.onPrev).toHaveBeenCalledTimes(1)
    expect(h.onNext).toHaveBeenCalledTimes(1)
    expect(h.onTogglePause).toHaveBeenCalledTimes(1)
  })

  it('disables Prev on the first step and labels Next as "End tour" on the last step', () => {
    renderCard({ flatIndex: 0, flatTotal: 3 })
    expect(screen.getByRole('button', { name: '上一步' })).toBeDisabled()
    cleanup()
    renderCard({ flatIndex: 2, flatTotal: 3 })
    // Both the Next button and the header close button carry the "End tour" label;
    // the Next button is the one rendering it as visible text.
    const endButtons = screen.getAllByRole('button', { name: '結束導覽' })
    expect(endButtons.some(b => b.textContent?.includes('結束導覽'))).toBe(true)
  })

  it('shows the resume icon label when paused', () => {
    renderCard({ paused: true })
    expect(screen.getByRole('button', { name: '繼續' })).toBeInTheDocument()
  })

  it('routes chapter dots through onGoChapter with the dot index', async () => {
    const user = userEvent.setup()
    const h = renderCard({ chapterCount: 3, chapterIdx: 0 })
    const dots = screen.getAllByRole('button', { name: /章節/ })
    expect(dots).toHaveLength(3)
    await user.click(dots[2])
    expect(h.onGoChapter).toHaveBeenCalledWith(2)
  })

  it('does not render chapter dots when there is a single chapter', () => {
    renderCard({ chapterCount: 1 })
    expect(screen.queryByRole('button', { name: /章節/ })).not.toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const h = renderCard()
    await user.click(screen.getByRole('button', { name: '結束導覽' }))
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the waiting line while waitFor is pending and not yet fired', () => {
    renderCard({ waitingForLive: true, liveFired: false })
    expect(screen.getByText('等待即時事件…')).toBeInTheDocument()
    expect(screen.queryByText('● LIVE')).not.toBeInTheDocument()
  })

  it('shows the LIVE badge (and drops the waiting line) once the event fires', () => {
    renderCard({ waitingForLive: true, liveFired: true })
    expect(screen.getByText('● LIVE')).toBeInTheDocument()
    expect(screen.queryByText('等待即時事件…')).not.toBeInTheDocument()
  })

  it('renders as an accessible dialog labeled by the step title', () => {
    renderCard()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('heading', { name: '車間總覽' })).toBeInTheDocument()
  })
})
