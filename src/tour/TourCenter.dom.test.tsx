// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act, fireEvent, within } from '@testing-library/react'
import { TourCenter } from './TourCenter'
import { useTourStore } from './tourStore'
import { useUiStore } from '@/lib/uiStore'
import { tourMeta } from './tours'

// startTour goes through the lazy loader; mock so its call is observable.
vi.mock('./tours', async () => {
  const meta = await vi.importActual<typeof import('./tours/meta')>('./tours/meta')
  return {
    tourMeta: meta.tourMeta,
    loadTourById: vi.fn().mockResolvedValue(null),
    loadModuleTour: vi.fn().mockResolvedValue(null),
  }
})

function resetStores() {
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
  useUiStore.setState({ activeRoute: 'fab-floor', selectedEntity: null })
}

/** Open the center and return its dialog element. */
function openCenter(): HTMLElement {
  act(() => {
    useTourStore.getState().openCenter()
  })
  return screen.getByRole('dialog', { name: '導覽中心' })
}

describe('TourCenter', () => {
  beforeEach(resetStores)
  afterEach(cleanup)

  it('renders nothing while closed', () => {
    render(<TourCenter />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lists every catalog tour with its est minutes and chapter count', () => {
    render(<TourCenter />)
    const dialog = openCenter()
    for (const tour of tourMeta) {
      expect(within(dialog).getByRole('heading', { name: tour.title.zh })).toBeInTheDocument()
      // est minutes + chapter count fragments appear in the tour card meta row
      expect(within(dialog).getAllByText(new RegExp(`${tour.estMinutes}\\s*分鐘`)).length).toBeGreaterThan(0)
      expect(within(dialog).getAllByText(new RegExp(`${tour.chapterCount}\\s*章`)).length).toBeGreaterThan(0)
    }
  })

  it('shows a completion badge only for completed tours', () => {
    useTourStore.setState({ completed: { 'full-flow': true } })
    render(<TourCenter />)
    const dialog = openCenter()
    const done = within(dialog).getAllByText('已完成')
    expect(done).toHaveLength(1)
  })

  it('Start calls startTour (lazy loader) with the tour id and closes the center once it resolves', async () => {
    const { loadTourById } = await import('./tours')
    // Resolve a minimal real tour so startTour's .then runs startTourDef, which
    // is what actually flips centerOpen → false.
    vi.mocked(loadTourById).mockResolvedValueOnce({
      id: tourMeta[0].id,
      title: tourMeta[0].title,
      description: tourMeta[0].description,
      estMinutes: tourMeta[0].estMinutes,
      chapters: [{ id: 'c', title: { zh: 'c', en: 'c' }, steps: [
        { id: 's', title: { zh: 's', en: 's' }, body: { zh: 's', en: 's' } },
      ] }],
    })
    render(<TourCenter />)
    const dialog = openCenter()
    const startButtons = within(dialog).getAllByRole('button', { name: /^開始$/ })
    expect(startButtons).toHaveLength(tourMeta.length)
    await act(async () => {
      fireEvent.click(startButtons[0])
      await Promise.resolve()
    })
    expect(loadTourById).toHaveBeenCalledWith(tourMeta[0].id)
    expect(useTourStore.getState().activeTour?.id).toBe(tourMeta[0].id)
    expect(useTourStore.getState().centerOpen).toBe(false)
  })

  it('Open Handbook sets the route to handbook and closes the center', () => {
    render(<TourCenter />)
    const dialog = openCenter()
    act(() => {
      fireEvent.click(within(dialog).getByRole('button', { name: /開啟操作手冊/ }))
    })
    expect(useUiStore.getState().activeRoute).toBe('handbook')
    expect(useTourStore.getState().centerOpen).toBe(false)
  })

  it('Escape closes the center', () => {
    render(<TourCenter />)
    openCenter()
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(useTourStore.getState().centerOpen).toBe(false)
  })

  it('clicking the backdrop closes the center', () => {
    render(<TourCenter />)
    const dialog = openCenter()
    // The veil is a button with aria-label 關閉, sibling to the dialog.
    const veil = dialog.parentElement!.querySelector<HTMLElement>('button[aria-label="關閉"]')!
    act(() => {
      fireEvent.click(veil)
    })
    expect(useTourStore.getState().centerOpen).toBe(false)
  })
})
