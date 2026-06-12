import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { TourDefinition } from './types'

// Mock the lazy tour loader so we can drive startTour()'s async path. vi.mock is
// hoisted above the dynamic `import('./tourStore')` below, so the store sees the
// mocked `loadTourById` when its module graph resolves `./tours`.
vi.mock('./tours', () => ({ loadTourById: vi.fn() }))

/* ──────────────────────────────────────────────────────────────────────────
 * tourStore state-transition tests (pure logic, node env).
 *
 * The store reads/writes localStorage at module-eval time and inside actions.
 * The node test env has no `localStorage`, so we install an in-memory stub on
 * globalThis BEFORE importing the store module. Each test resets the stub and
 * the store to a known baseline.
 * ────────────────────────────────────────────────────────────────────────── */

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.has(k) ? (this.map.get(k) as string) : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v))
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
  clear(): void {
    this.map.clear()
  }
  get raw(): Map<string, string> {
    return this.map
  }
}

const storage = new MemoryStorage()
;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = storage

// Import AFTER the stub is installed (module-eval reads localStorage).
const { useTourStore, flatStepCount, flatStepIndex, getCurrentStep } = await import('./tourStore')
const { loadTourById } = await import('./tours')
const loadTourByIdMock = vi.mocked(loadTourById)

/** A small two-chapter tour: chapter A has 2 steps, chapter B has 1 step. */
function makeTour(id = 'test-tour'): TourDefinition {
  return {
    id,
    title: { zh: '測試', en: 'Test' },
    description: { zh: '描述', en: 'Desc' },
    estMinutes: 1,
    chapters: [
      {
        id: 'a',
        title: { zh: '甲', en: 'A' },
        steps: [
          { id: 'a0', route: 'fab-floor', title: { zh: '0', en: '0' }, body: { zh: '0', en: '0' } },
          { id: 'a1', route: 'production', title: { zh: '1', en: '1' }, body: { zh: '1', en: '1' } },
        ],
      },
      {
        id: 'b',
        title: { zh: '乙', en: 'B' },
        steps: [
          { id: 'b0', route: 'kpi', title: { zh: '2', en: '2' }, body: { zh: '2', en: '2' } },
        ],
      },
    ],
  }
}

/** Reset store + storage to a clean baseline before each test. */
function resetStore() {
  storage.clear()
  loadTourByIdMock.mockReset()
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

describe('tourStore', () => {
  beforeEach(resetStore)

  describe('startTourDef', () => {
    it('activates a tour at chapter 0 / step 0, running, and closes the center', () => {
      const s = useTourStore.getState()
      s.openCenter()
      s.startTourDef(makeTour())
      const st = useTourStore.getState()
      expect(st.activeTour?.id).toBe('test-tour')
      expect(st.chapterIdx).toBe(0)
      expect(st.stepIdx).toBe(0)
      expect(st.status).toBe('running')
      expect(st.centerOpen).toBe(false)
    })
  })

  describe('startTour() async path', () => {
    it('loads a tour by id then activates it', async () => {
      const tour = makeTour('full-flow')
      loadTourByIdMock.mockResolvedValueOnce(tour)
      useTourStore.getState().startTour('full-flow')
      // The store does loadTourById(id).then(...) — flush the microtask queue so
      // the resolved promise's .then callback runs before we assert.
      await Promise.resolve()
      const st = useTourStore.getState()
      expect(loadTourByIdMock).toHaveBeenCalledWith('full-flow')
      expect(st.activeTour?.id).toBe('full-flow')
      expect(st.status).toBe('running')
    })

    it('stays idle when the loader resolves null (unknown id)', async () => {
      loadTourByIdMock.mockResolvedValueOnce(null)
      useTourStore.getState().startTour('does-not-exist')
      await Promise.resolve()
      const st = useTourStore.getState()
      expect(st.status).toBe('idle')
      expect(st.activeTour).toBeNull()
    })
  })

  describe('next() / cross-chapter math', () => {
    it('advances within a chapter', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().next()
      const st = useTourStore.getState()
      expect(st.chapterIdx).toBe(0)
      expect(st.stepIdx).toBe(1)
    })

    it('rolls over to the next chapter at step 0', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().next() // a1
      useTourStore.getState().next() // -> chapter b, step 0
      const st = useTourStore.getState()
      expect(st.chapterIdx).toBe(1)
      expect(st.stepIdx).toBe(0)
    })

    it('marks completed ONLY when advancing past the final step, then exits', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().next() // a1
      useTourStore.getState().next() // b0 (final)
      // Not yet complete while sitting on the final step.
      expect(useTourStore.getState().completed['test-tour']).toBeUndefined()
      useTourStore.getState().next() // past final => complete + exit
      const st = useTourStore.getState()
      expect(st.completed['test-tour']).toBe(true)
      expect(st.activeTour).toBeNull()
      expect(st.status).toBe('idle')
      expect(st.chapterIdx).toBe(0)
      expect(st.stepIdx).toBe(0)
    })

    it('persists completion to localStorage', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().next()
      useTourStore.getState().next()
      useTourStore.getState().next() // complete
      const raw = storage.getItem('fabpulse.tour.completed')
      expect(raw).toBeTruthy()
      expect(JSON.parse(raw as string)).toEqual({ 'test-tour': true })
    })

    it('is a no-op when no tour is active', () => {
      useTourStore.getState().next()
      expect(useTourStore.getState().activeTour).toBeNull()
      expect(useTourStore.getState().status).toBe('idle')
    })
  })

  describe('prev()', () => {
    it('steps back within a chapter', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().next() // a1
      useTourStore.getState().prev()
      expect(useTourStore.getState().stepIdx).toBe(0)
    })

    it('steps back across a chapter boundary onto the previous chapter last step', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().goTo(1, 0) // chapter b, step 0
      useTourStore.getState().prev()
      const st = useTourStore.getState()
      expect(st.chapterIdx).toBe(0)
      expect(st.stepIdx).toBe(1) // last step of chapter a
    })

    it('is a no-op at the very first step', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().prev()
      const st = useTourStore.getState()
      expect(st.chapterIdx).toBe(0)
      expect(st.stepIdx).toBe(0)
    })
  })

  describe('goTo()', () => {
    it('jumps to an arbitrary chapter/step', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().goTo(1, 0)
      const st = useTourStore.getState()
      expect(st.chapterIdx).toBe(1)
      expect(st.stepIdx).toBe(0)
    })

    it('clamps stepIdx into the target chapter range', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().goTo(1, 99) // chapter b has only 1 step
      expect(useTourStore.getState().stepIdx).toBe(0)
      useTourStore.getState().goTo(0, -5)
      expect(useTourStore.getState().stepIdx).toBe(0)
    })

    it('ignores an out-of-range chapter index', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().goTo(5, 0)
      const st = useTourStore.getState()
      expect(st.chapterIdx).toBe(0)
      expect(st.stepIdx).toBe(0)
    })
  })

  describe('exitTour()', () => {
    it('exits WITHOUT marking the tour complete', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().next() // mid-tour
      useTourStore.getState().exitTour()
      const st = useTourStore.getState()
      expect(st.activeTour).toBeNull()
      expect(st.status).toBe('idle')
      expect(st.completed['test-tour']).toBeUndefined()
      expect(storage.getItem('fabpulse.tour.completed')).toBeNull()
    })
  })

  describe('togglePause()', () => {
    it('toggles running <-> paused', () => {
      useTourStore.getState().startTourDef(makeTour())
      expect(useTourStore.getState().status).toBe('running')
      useTourStore.getState().togglePause()
      expect(useTourStore.getState().status).toBe('paused')
      useTourStore.getState().togglePause()
      expect(useTourStore.getState().status).toBe('running')
    })

    it('does nothing when idle', () => {
      useTourStore.getState().togglePause()
      expect(useTourStore.getState().status).toBe('idle')
    })
  })

  describe('pause()', () => {
    it('pauses a running tour', () => {
      useTourStore.getState().startTourDef(makeTour())
      expect(useTourStore.getState().status).toBe('running')
      useTourStore.getState().pause()
      expect(useTourStore.getState().status).toBe('paused')
    })

    it('is a no-op when already paused', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().pause()
      useTourStore.getState().pause()
      expect(useTourStore.getState().status).toBe('paused')
    })

    it('is a no-op when idle (never resumes a stopped tour)', () => {
      useTourStore.getState().pause()
      expect(useTourStore.getState().status).toBe('idle')
    })
  })

  describe('setLang()', () => {
    it('updates lang and persists it', () => {
      useTourStore.getState().setLang('en')
      expect(useTourStore.getState().lang).toBe('en')
      expect(storage.getItem('fabpulse.tour.lang')).toBe('en')
    })
  })

  describe('center actions', () => {
    it('opens and closes the center', () => {
      useTourStore.getState().openCenter()
      expect(useTourStore.getState().centerOpen).toBe(true)
      useTourStore.getState().closeCenter()
      expect(useTourStore.getState().centerOpen).toBe(false)
    })
  })

  describe('markWelcomeSeen()', () => {
    it('sets the flag and persists it', () => {
      useTourStore.getState().markWelcomeSeen()
      expect(useTourStore.getState().welcomeSeen).toBe(true)
      expect(storage.getItem('fabpulse.tour.welcomeSeen')).toBe('1')
    })

    it('is idempotent', () => {
      useTourStore.getState().markWelcomeSeen()
      storage.removeItem('fabpulse.tour.welcomeSeen')
      useTourStore.getState().markWelcomeSeen() // already seen => no re-write
      expect(storage.getItem('fabpulse.tour.welcomeSeen')).toBeNull()
    })
  })

  describe('selectors / helpers', () => {
    it('flatStepCount sums all chapter steps', () => {
      expect(flatStepCount(makeTour())).toBe(3)
    })

    it('flatStepIndex converts (chapter, step) to a zero-based flat index', () => {
      const tour = makeTour()
      expect(flatStepIndex(tour, 0, 0)).toBe(0)
      expect(flatStepIndex(tour, 0, 1)).toBe(1)
      expect(flatStepIndex(tour, 1, 0)).toBe(2)
    })

    it('flatStepIndex clamps an out-of-range chapter index to the total step count', () => {
      const tour = makeTour()
      // chapterIdx 99 is past the end: the loop is bounded by chapters.length,
      // so it sums every chapter's steps instead of crashing (3 total).
      expect(flatStepIndex(tour, 99, 0)).toBe(flatStepCount(tour))
    })

    it('getCurrentStep resolves the active step', () => {
      useTourStore.getState().startTourDef(makeTour())
      useTourStore.getState().goTo(1, 0)
      const step = getCurrentStep(useTourStore.getState())
      expect(step?.id).toBe('b0')
    })

    it('getCurrentStep returns null with no active tour', () => {
      expect(getCurrentStep(useTourStore.getState())).toBeNull()
    })
  })
})
