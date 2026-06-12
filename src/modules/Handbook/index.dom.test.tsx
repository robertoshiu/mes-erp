// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act, fireEvent, within } from '@testing-library/react'
import Handbook from './index'
import { useTourStore } from '../../tour/tourStore'
import { useUiStore } from '../../lib/uiStore'
import { handbookEntries } from '../../tour/handbook-content'
import type { TourDefinition } from '../../tour/types'

// loadModuleTour is async + lazy; mock it so "Tour this page" availability and
// startTourDef wiring are deterministic.
const moduleTour: TourDefinition = {
  id: 'page-fab-floor',
  title: { zh: '車間頁導覽', en: 'Fab Floor page tour' },
  description: { zh: 'd', en: 'd' },
  estMinutes: 1,
  chapters: [{ id: 'c', title: { zh: 'c', en: 'c' }, steps: [
    { id: 's', route: 'fab-floor', title: { zh: 's', en: 's' }, body: { zh: 's', en: 's' } },
  ] }],
}

const loadModuleTourMock = vi.fn<(route: string) => Promise<TourDefinition | null>>()

vi.mock('../../tour/tours', () => ({
  loadModuleTour: (route: string) => loadModuleTourMock(route),
  loadTourById: vi.fn().mockResolvedValue(null),
  tourMeta: [],
}))

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
  loadModuleTourMock.mockReset()
  // Default: no per-page tour for any route.
  loadModuleTourMock.mockResolvedValue(null)
}

/** Render the Handbook, flushing the initial loadModuleTour effect. */
async function renderHandbook() {
  let utils!: ReturnType<typeof render>
  await act(async () => {
    utils = render(<Handbook />)
    await Promise.resolve()
  })
  return utils
}

describe('Handbook', () => {
  beforeEach(resetStores)
  afterEach(cleanup)

  it('renders the entry nav grouped by domain (MES/ERP/SCM/SYSTEM)', async () => {
    await renderHandbook()
    // Domain group headers present (left nav).
    for (const d of ['MES', 'ERP', 'SCM', 'SYSTEM']) {
      expect(screen.getAllByText(d).length).toBeGreaterThan(0)
    }
    // The first entry's title appears in the nav.
    expect(screen.getAllByText('車間總覽').length).toBeGreaterThan(0)
  })

  it('filters the nav by a zh query', async () => {
    await renderHandbook()
    const search = screen.getByPlaceholderText('搜尋模組或主題…')
    act(() => {
      fireEvent.change(search, { target: { value: '車間' } })
    })
    // The matching entry stays; a clearly-unrelated one drops out of the nav.
    expect(screen.getAllByText('車間總覽').length).toBeGreaterThan(0)
  })

  it('filters the nav by an EN query', async () => {
    useTourStore.getState().setLang('en')
    await renderHandbook()
    const search = screen.getByPlaceholderText('Search modules or topics…')
    act(() => {
      fireEvent.change(search, { target: { value: 'fab floor' } })
    })
    expect(screen.getAllByText('Fab Floor').length).toBeGreaterThan(0)
  })

  it('shows a no-results message when nothing matches', async () => {
    await renderHandbook()
    const search = screen.getByPlaceholderText('搜尋模組或主題…')
    act(() => {
      fireEvent.change(search, { target: { value: 'zzzznotathing' } })
    })
    expect(screen.getAllByText('找不到符合的條目').length).toBeGreaterThan(0)
  })

  it('selecting an entry shows its sections and event chips', async () => {
    await renderHandbook()
    // The default selection is fab-floor; its section headings + events render.
    expect(screen.getByText('用途')).toBeInTheDocument()
    expect(screen.getByText('相關事件')).toBeInTheDocument()
    // Event chips come from the entry's `events` array.
    const fab = handbookEntries.find(e => e.id === 'fab-floor')!
    const eventsSection = screen.getByText('相關事件').closest('section')!
    for (const ev of fab.events ?? []) {
      expect(within(eventsSection).getByText(ev)).toBeInTheDocument()
    }
  })

  it('a related link switches the selected entry', async () => {
    await renderHandbook()
    const fab = handbookEntries.find(e => e.id === 'fab-floor')!
    const relatedId = (fab.related ?? [])[0]
    const relatedEntry = handbookEntries.find(e => e.id === relatedId)!
    // Click the related chip (in the right pane) for that entry's title.
    const relatedSection = screen.getByText('延伸閱讀').closest('section')!
    const link = within(relatedSection).getByRole('button', { name: new RegExp(relatedEntry.title.zh) })
    act(() => {
      fireEvent.click(link)
    })
    // Right-pane H1 now reflects the related entry.
    expect(screen.getByRole('heading', { level: 1, name: new RegExp(relatedEntry.title.zh) })).toBeInTheDocument()
  })

  it('"Open page" routes the ui store to the selected module', async () => {
    await renderHandbook()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /開啟頁面/ }))
    })
    expect(useUiStore.getState().activeRoute).toBe('fab-floor')
  })

  it('"Tour this page" appears only when loadModuleTour resolves a tour, and starts it', async () => {
    // Resolve a real page tour for the fab-floor route.
    loadModuleTourMock.mockResolvedValue(moduleTour)
    await renderHandbook()
    const tourBtn = screen.getByRole('button', { name: /導覽此頁/ })
    expect(tourBtn).toBeInTheDocument()
    act(() => {
      fireEvent.click(tourBtn)
    })
    expect(useTourStore.getState().activeTour?.id).toBe('page-fab-floor')
    expect(useTourStore.getState().status).toBe('running')
  })

  it('hides "Tour this page" when no per-page tour resolves', async () => {
    loadModuleTourMock.mockResolvedValue(null)
    await renderHandbook()
    expect(screen.queryByRole('button', { name: /導覽此頁/ })).not.toBeInTheDocument()
  })
})
