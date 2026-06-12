import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { useMotionValue } from 'framer-motion'
import type { Subscription } from 'rxjs'
import { useUiStore } from '@/lib/uiStore'
import type { ModuleRoute, SelectedEntity } from '@/lib/uiStore'
import type { EventBus } from '@/lib/eventBus'
import { Spotlight, type SpotRect } from './Spotlight'
import { TourCard } from './TourCard'
import type { TourDefinition, TourStep } from './types'
import {
  flatStepCount,
  flatStepIndex,
  getActiveTour,
  getCurrentStep,
  useTourStore,
} from './tourStore'

const POLL_MS = 100
const POLL_TIMEOUT_MS = 5000
const SAFETY_REMEASURE_MS = 1000
const SCROLLEND_FALLBACK_MS = 600
const RECT_EPSILON = 0.5
const DEFAULT_DURATION_S = 12

/** Treat two rects as equal within a sub-pixel epsilon (avoids no-op renders). */
function rectsEqual(a: SpotRect | null, b: SpotRect | null): boolean {
  if (a === null || b === null) return a === b
  return (
    Math.abs(a.x - b.x) < RECT_EPSILON &&
    Math.abs(a.y - b.y) < RECT_EPSILON &&
    Math.abs(a.width - b.width) < RECT_EPSILON &&
    Math.abs(a.height - b.height) < RECT_EPSILON
  )
}

interface TourControllerProps {
  eventBus: EventBus
}

function measure(el: Element): SpotRect {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

/**
 * Per-step view. Keyed by step id so rect/progress/liveFired reset cleanly on
 * each step change (no synchronous setState resets in effects).
 */
function TourStepView({
  tour,
  step,
  chapterIdx,
  stepIdx,
  eventBus,
  tourSelectedRef,
  engineNavRef,
}: {
  tour: TourDefinition
  step: TourStep
  chapterIdx: number
  stepIdx: number
  eventBus: EventBus
  tourSelectedRef: MutableRefObject<SelectedEntity | null>
  engineNavRef: MutableRefObject<ModuleRoute | null>
}) {
  const lang = useTourStore(s => s.lang)
  const status = useTourStore(s => s.status)
  const autoplay = useTourStore(s => s.autoplay)
  const centerOpen = useTourStore(s => s.centerOpen)
  const paused = status === 'paused'

  const [rect, setRect] = useState<SpotRect | null>(null)
  const [liveFired, setLiveFired] = useState(false)

  // Autoplay progress (0..1) lives in a MotionValue so the rAF loop can drive
  // the bar at 60fps WITHOUT a React re-render per frame. A fresh TourStepView
  // mounts per step (keyed by step id in TourController), so this resets to 0
  // on every step change automatically.
  const progressMv = useMotionValue(0)

  // autoplay gate: whether the duration timer may run (waitFor resolved).
  const liveReadyRef = useRef(!step.waitFor)

  // --- Navigate to the step's route on enter (and on autoplay resume). ---
  // Marks the navigation as engine-initiated (engineNavRef) so the controller's
  // activeRoute subscription doesn't mistake it for a user sidebar click and
  // pause the tour. Re-runs when `paused` clears so resuming a paused tour
  // re-asserts the step's route (the user may have navigated away while paused).
  useEffect(() => {
    if (paused) return
    const ui = useUiStore.getState()
    if (step.route && ui.activeRoute !== step.route) {
      engineNavRef.current = step.route
      ui.setRoute(step.route)
      engineNavRef.current = null
    }
  }, [step.route, paused, engineNavRef])

  // --- Target resolution + live rect tracking. ---
  useEffect(() => {
    if (!step.target) return
    let cancelled = false
    let pollId: ReturnType<typeof setInterval> | null = null
    let cleanupTrack: (() => void) | null = null
    const selector = `[data-tour="${step.target}"]`

    const track = (el: Element) => {
      // setRect that bails when the geometry is unchanged (within epsilon), so
      // the 1s safety interval / observers can't trigger no-op re-renders.
      const commit = () => {
        const next = measure(el)
        setRect(prev => (rectsEqual(prev, next) ? prev : next))
      }

      el.scrollIntoView({ block: 'center', behavior: 'smooth' })

      // First measure AFTER layout settles: a double-rAF lets the smooth-scroll
      // start and layout flush before we read geometry, avoiding a stale rect
      // captured pre-scroll.
      let firstRaf = requestAnimationFrame(() => {
        firstRaf = requestAnimationFrame(commit)
      })

      // rAF-coalesced live update: at most one getBoundingClientRect+setRect per
      // frame regardless of how many scroll/resize events fire.
      let pendingRaf = 0
      const requestUpdate = () => {
        if (pendingRaf) return
        pendingRaf = requestAnimationFrame(() => {
          pendingRaf = 0
          commit()
        })
      }

      window.addEventListener('scroll', requestUpdate, true)
      window.addEventListener('resize', requestUpdate)

      // Settling measure once the smooth scroll finishes. scrollend has good
      // modern support; a 600ms timeout is a fallback that settles once too.
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        commit()
      }
      window.addEventListener('scrollend', settle, true)
      const settleFallbackId = setTimeout(settle, SCROLLEND_FALLBACK_MS)

      // Layout-drift catch-all (low frequency) + observe the target itself.
      const safetyId = setInterval(commit, SAFETY_REMEASURE_MS)
      const ro = new ResizeObserver(requestUpdate)
      ro.observe(el)

      cleanupTrack = () => {
        cancelAnimationFrame(firstRaf)
        if (pendingRaf) cancelAnimationFrame(pendingRaf)
        window.removeEventListener('scroll', requestUpdate, true)
        window.removeEventListener('resize', requestUpdate)
        window.removeEventListener('scrollend', settle, true)
        clearTimeout(settleFallbackId)
        clearInterval(safetyId)
        ro.disconnect()
      }
    }

    const start = Date.now()
    const existing = document.querySelector(selector)
    if (existing) {
      track(existing)
    } else {
      pollId = setInterval(() => {
        if (cancelled) return
        const el = document.querySelector(selector)
        if (el) {
          if (pollId) clearInterval(pollId)
          pollId = null
          track(el)
        } else if (Date.now() - start > POLL_TIMEOUT_MS) {
          if (pollId) clearInterval(pollId)
          pollId = null // timeout => stay centered (rect remains null)
        }
      }, POLL_MS)
    }

    return () => {
      cancelled = true
      if (pollId) clearInterval(pollId)
      if (cleanupTrack) cleanupTrack()
    }
  }, [step.target])

  // --- selectEntity / clearSelection action. ---
  // Tour-driven selection is tracked at the controller level (tourSelectedRef)
  // and cleared only when the TOUR stops — NOT on per-step unmount. This keeps
  // the DrillInPanel mounted across consecutive steps that select the SAME lot
  // (e.g. mes-production-drill → mes-production-drillin-panel), avoiding an
  // unmount/remount flicker. Re-selecting an already-selected entity is a no-op.
  useEffect(() => {
    const action = step.action
    if (!action) return
    const ui = useUiStore.getState()
    if (action.type === 'selectEntity') {
      const prev = tourSelectedRef.current
      if (!prev || prev.type !== action.entity.type || prev.id !== action.entity.id) {
        tourSelectedRef.current = action.entity
        ui.selectEntity(action.entity)
      }
    } else if (action.type === 'clearSelection') {
      tourSelectedRef.current = null
      ui.selectEntity(null)
    }
  }, [step.action, tourSelectedRef])

  // --- waitFor: subscribe to bus topic; gate autoplay until event or timeout. ---
  useEffect(() => {
    const waitFor = step.waitFor
    if (!waitFor) return
    let sub: Subscription | null = eventBus.ofTopic(waitFor.topic).subscribe(() => {
      liveReadyRef.current = true
      setLiveFired(true)
      if (sub) { sub.unsubscribe(); sub = null }
    })
    const release = () => { liveReadyRef.current = true }
    const timeoutId = setTimeout(() => {
      release()
      if (sub) { sub.unsubscribe(); sub = null }
    }, waitFor.timeoutMs)
    return () => {
      if (sub) sub.unsubscribe()
      clearTimeout(timeoutId)
    }
    // Keyed on step.id (not step.waitFor object identity): TourStepView remounts
    // per step in TourController, so step.id uniquely identifies the step whose
    // waitFor is read above — robust to refactors that rebuild step objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, eventBus])

  // --- Autoplay progress + advance. ---
  useEffect(() => {
    if (!autoplay || paused) return
    const durationMs = (step.duration ?? DEFAULT_DURATION_S) * 1000
    let startedAt: number | null = null
    let raf = 0
    const tick = (now: number) => {
      // Hold the clock until waitFor (if any) resolves, AND while the Tour Center
      // is open (z-95 over the tour) — otherwise the tour advances invisibly
      // behind the center. Resetting startedAt on each held frame freezes elapsed
      // time so progress resumes from where it paused (no jump on close), exactly
      // mirroring how the waitFor gate holds the clock.
      if (!liveReadyRef.current || useTourStore.getState().centerOpen) {
        startedAt = null
        raf = requestAnimationFrame(tick)
        return
      }
      if (startedAt === null) startedAt = now
      const p = Math.min(1, (now - startedAt) / durationMs)
      progressMv.set(p)
      if (p >= 1) { useTourStore.getState().next(); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [autoplay, paused, centerOpen, step.duration, progressMv])

  const handleGoChapter = useCallback((idx: number) => {
    useTourStore.getState().goTo(idx, 0)
  }, [])

  const flatTotal = flatStepCount(tour)
  const flatIndex = flatStepIndex(tour, chapterIdx, stepIdx)
  const chapter = tour.chapters[chapterIdx]

  return (
    <>
      <Spotlight rect={rect} pulse={step.pulse} />
      <TourCard
        step={step}
        chapter={chapter}
        lang={lang}
        rect={rect}
        flatIndex={flatIndex}
        flatTotal={flatTotal}
        chapterCount={tour.chapters.length}
        chapterIdx={chapterIdx}
        paused={paused}
        progressMv={progressMv}
        waitingForLive={!!step.waitFor}
        liveFired={liveFired}
        onPrev={() => useTourStore.getState().prev()}
        onNext={() => useTourStore.getState().next()}
        onTogglePause={() => useTourStore.getState().togglePause()}
        onClose={() => useTourStore.getState().exitTour()}
        onGoChapter={handleGoChapter}
      />
    </>
  )
}

export function TourController({ eventBus }: TourControllerProps) {
  const status = useTourStore(s => s.status)
  const activeTour = useTourStore(s => s.activeTour)
  const chapterIdx = useTourStore(s => s.chapterIdx)
  const stepIdx = useTourStore(s => s.stepIdx)

  const running = status === 'running' || status === 'paused'
  const tour = getActiveTour({ activeTour })
  const step = getCurrentStep({ activeTour, chapterIdx, stepIdx })

  // Tracks the entity selected BY the tour (selectEntity steps), so it can be
  // cleared exactly once when the tour stops — instead of on every step unmount,
  // which would tear down + rebuild the DrillInPanel between consecutive steps.
  const tourSelectedRef = useRef<SelectedEntity | null>(null)

  // Marks the route the engine is about to assert via ui.setRoute, so the
  // activeRoute subscription below can distinguish engine navigation from a
  // user-initiated sidebar click. Set immediately before setRoute, cleared after.
  const engineNavRef = useRef<ModuleRoute | null>(null)

  // --- Pause autoplay when the USER navigates away mid-tour. ---
  // Each step asserts its route, so a user clicking the sidebar would otherwise
  // be yanked back on the next step. Subscribe to activeRoute while running: a
  // change that is NOT engine-initiated AND differs from the current step's route
  // means the user navigated — pause the tour (card stays; Space/▶ resumes, which
  // re-asserts the step's route via the resume-aware route effect above).
  useEffect(() => {
    if (!running) return
    return useUiStore.subscribe((state, prev) => {
      if (state.activeRoute === prev.activeRoute) return
      if (engineNavRef.current === state.activeRoute) return
      const cur = getCurrentStep(useTourStore.getState())
      if (cur?.route && state.activeRoute !== cur.route) {
        useTourStore.getState().pause()
      }
    })
  }, [running])

  // --- Clear tour selection when the tour stops (or the controller unmounts). ---
  // When the tour is no longer running/paused, drop any tour-driven selection so
  // the DrillInPanel closes. Esc-exit lands here too (exitTour → status 'idle').
  useEffect(() => {
    if (running) return
    if (tourSelectedRef.current) {
      tourSelectedRef.current = null
      useUiStore.getState().selectEntity(null)
    }
  }, [running])

  // Belt-and-suspenders: clear a lingering tour selection if the controller
  // itself unmounts while a selection is still active (the [running] effect
  // above has no teardown, so it would otherwise leak the open panel).
  useEffect(() => {
    return () => {
      if (tourSelectedRef.current) {
        tourSelectedRef.current = null
        useUiStore.getState().selectEntity(null)
      }
    }
  }, [])

  // --- Global "?" key: toggle Tour Center (works even when not running). ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (e.key === '?') {
        e.preventDefault()
        const st = useTourStore.getState()
        if (st.centerOpen) st.closeCenter()
        else st.openCenter()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // --- Keyboard controls while running. ---
  // Runs in the CAPTURE phase on window so it is the single owner of keydown
  // while the tour is active: window-capture fires before any document-level
  // listener (TourCenter's own Esc, DrillInPanel's Esc), so stopPropagation +
  // preventDefault here prevent those from double-firing.
  useEffect(() => {
    if (!running) return
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      const st = useTourStore.getState()
      if (e.key === 'Escape') {
        // Single ownership: close the center if it's open, else exit the tour.
        e.stopPropagation()
        e.preventDefault()
        if (st.centerOpen) st.closeCenter()
        else st.exitTour()
        return
      }
      // While the center is open, navigation keys must not drive the tour —
      // let them fall through untouched so the center stays usable.
      if (st.centerOpen) return
      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); st.next(); break
        case 'ArrowLeft': e.preventDefault(); st.prev(); break
        case ' ': e.preventDefault(); st.togglePause(); break
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [running])

  if (!running || !tour || !step) return null

  return createPortal(
    <TourStepView
      key={`${chapterIdx}:${stepIdx}:${step.id}`}
      tour={tour}
      step={step}
      chapterIdx={chapterIdx}
      stepIdx={stepIdx}
      eventBus={eventBus}
      tourSelectedRef={tourSelectedRef}
      engineNavRef={engineNavRef}
    />,
    document.body,
  )
}
