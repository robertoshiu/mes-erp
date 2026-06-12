import { create } from 'zustand'
import type { Lang, TourDefinition, TourStep } from './types'
import { loadTourById } from './tours'

const LS = {
  lang: 'fabpulse.tour.lang',
  completed: 'fabpulse.tour.completed',
  welcomeSeen: 'fabpulse.tour.welcomeSeen',
} as const

// --- Lazy, guarded localStorage reads (no zustand persist middleware) ---
function readLang(): Lang {
  try {
    const v = localStorage.getItem(LS.lang)
    if (v === 'zh' || v === 'en') return v
  } catch { /* ignore */ }
  return 'zh'
}

function readCompleted(): Record<string, true> {
  try {
    const raw = localStorage.getItem(LS.completed)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, true>
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch { /* ignore */ }
  return {}
}

function readWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(LS.welcomeSeen) === '1'
  } catch { /* ignore */ }
  return false
}

function writeLang(lang: Lang) {
  try { localStorage.setItem(LS.lang, lang) } catch { /* ignore */ }
}

function writeCompleted(completed: Record<string, true>) {
  try { localStorage.setItem(LS.completed, JSON.stringify(completed)) } catch { /* ignore */ }
}

function writeWelcomeSeen() {
  try { localStorage.setItem(LS.welcomeSeen, '1') } catch { /* ignore */ }
}

export type TourStatus = 'idle' | 'running' | 'paused'

interface TourState {
  activeTour: TourDefinition | null
  chapterIdx: number
  stepIdx: number
  status: TourStatus
  autoplay: boolean
  lang: Lang
  centerOpen: boolean
  completed: Record<string, true>
  welcomeSeen: boolean

  startTour: (id: string) => void
  startTourDef: (def: TourDefinition) => void
  exitTour: () => void
  next: () => void
  prev: () => void
  goTo: (chapterIdx: number, stepIdx: number) => void
  togglePause: () => void
  pause: () => void
  setLang: (lang: Lang) => void
  openCenter: () => void
  closeCenter: () => void
  markWelcomeSeen: () => void
}

export const useTourStore = create<TourState>((set, get) => ({
  activeTour: null,
  chapterIdx: 0,
  stepIdx: 0,
  status: 'idle',
  autoplay: true,
  lang: readLang(),
  centerOpen: false,
  completed: readCompleted(),
  welcomeSeen: readWelcomeSeen(),

  startTour: (id) => {
    // Fire-and-forget: the tour content is loaded lazily (its own chunk), then
    // started. Callers don't await — the overlay appears once content resolves.
    void loadTourById(id).then(def => {
      if (def) get().startTourDef(def)
    }).catch(err => {
      console.error('[tour] failed to load tour content', err)
    })
  },

  startTourDef: (def) => {
    set({
      activeTour: def,
      chapterIdx: 0,
      stepIdx: 0,
      status: 'running',
      centerOpen: false,
    })
  },

  exitTour: () => {
    // Exiting NEVER writes completion — completion is only recorded by next()
    // when advancing past the final step of the final chapter.
    set({ activeTour: null, status: 'idle', chapterIdx: 0, stepIdx: 0 })
  },

  next: () => {
    const { activeTour, chapterIdx, stepIdx } = get()
    if (!activeTour) return
    const chapter = activeTour.chapters[chapterIdx]
    if (!chapter) return
    if (stepIdx + 1 < chapter.steps.length) {
      set({ stepIdx: stepIdx + 1 })
      return
    }
    if (chapterIdx + 1 < activeTour.chapters.length) {
      set({ chapterIdx: chapterIdx + 1, stepIdx: 0 })
      return
    }
    // Past the final step => mark completed (by the tour's id) + exit.
    const completed = { ...get().completed, [activeTour.id]: true as const }
    writeCompleted(completed)
    set({ completed, activeTour: null, status: 'idle', chapterIdx: 0, stepIdx: 0 })
  },

  prev: () => {
    const { activeTour, chapterIdx, stepIdx } = get()
    if (!activeTour) return
    if (stepIdx > 0) {
      set({ stepIdx: stepIdx - 1 })
      return
    }
    if (chapterIdx > 0) {
      const prevChapter = activeTour.chapters[chapterIdx - 1]
      set({ chapterIdx: chapterIdx - 1, stepIdx: Math.max(0, prevChapter.steps.length - 1) })
    }
    // At the very first step: no-op.
  },

  goTo: (chapterIdx, stepIdx) => {
    const tour = get().activeTour
    if (!tour) return
    const chapter = tour.chapters[chapterIdx]
    if (!chapter) return
    const clampedStep = Math.min(Math.max(0, stepIdx), chapter.steps.length - 1)
    set({ chapterIdx, stepIdx: clampedStep })
  },

  togglePause: () =>
    set((s) => (s.status === 'running' ? { status: 'paused' } : s.status === 'paused' ? { status: 'running' } : s)),

  // Pause autoplay only from the running state (used by the engine when the user
  // navigates away mid-tour). No-op while idle or already paused.
  pause: () => set((s) => (s.status === 'running' ? { status: 'paused' } : s)),

  setLang: (lang) => {
    writeLang(lang)
    set({ lang })
  },

  openCenter: () => set({ centerOpen: true }),
  closeCenter: () => set({ centerOpen: false }),

  markWelcomeSeen: () => {
    if (get().welcomeSeen) return
    writeWelcomeSeen()
    set({ welcomeSeen: true })
  },
}))

// --- Selectors / helpers (not reactive; call inside components or with get) ---

export function getActiveTour(state: Pick<TourState, 'activeTour'>): TourDefinition | null {
  return state.activeTour
}

export function getCurrentStep(state: Pick<TourState, 'activeTour' | 'chapterIdx' | 'stepIdx'>): TourStep | null {
  const tour = getActiveTour(state)
  return tour?.chapters[state.chapterIdx]?.steps[state.stepIdx] ?? null
}

/** Total step count across all chapters of a tour. */
export function flatStepCount(tour: TourDefinition): number {
  return tour.chapters.reduce((n, c) => n + c.steps.length, 0)
}

/** Zero-based flat index of the current (chapterIdx, stepIdx) across the tour. */
export function flatStepIndex(
  tour: TourDefinition,
  chapterIdx: number,
  stepIdx: number,
): number {
  let n = 0
  for (let c = 0; c < chapterIdx && c < tour.chapters.length; c++) {
    n += tour.chapters[c].steps.length
  }
  return n + stepIdx
}
