import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, type MotionValue } from 'framer-motion'
import { ChevronLeft, ChevronRight, Play, Pause, X, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SpotRect } from './Spotlight'
import { LangToggle } from './LangToggle'
import { renderBody } from './richText'
import type { I18nText, Lang, TourChapter, TourStep } from './types'

const CARD_W = 380
const GAP = 16
const MARGIN = 12

const LABELS = {
  prev: { zh: '上一步', en: 'Prev' },
  next: { zh: '下一步', en: 'Next' },
  pause: { zh: '暫停', en: 'Pause' },
  resume: { zh: '繼續', en: 'Resume' },
  end: { zh: '結束導覽', en: 'End tour' },
  waiting: { zh: '等待即時事件…', en: 'waiting for live event…' },
  live: { zh: '● LIVE', en: '● LIVE' },
} as const

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center'

interface CardPos {
  left: number
  top: number
  placement: Placement
}

/** Pick a position near the rect by placement, clamped into the viewport. */
function computePos(
  rect: SpotRect | null,
  want: TourStep['placement'],
  cardH: number,
): CardPos {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!rect) {
    return {
      left: (vw - CARD_W) / 2,
      top: Math.max(MARGIN, (vh - cardH) / 2),
      placement: 'center',
    }
  }
  // Space available on each side of the rect.
  const space = {
    top: rect.y,
    bottom: vh - (rect.y + rect.height),
    left: rect.x,
    right: vw - (rect.x + rect.width),
  }
  let place: Placement
  if (want && want !== 'auto') {
    place = want
  } else {
    // Auto: pick the side with the most room (prefer right/bottom on ties).
    const order: Placement[] = ['right', 'bottom', 'left', 'top']
    place = order.reduce((best, s) =>
      space[s as keyof typeof space] > space[best as keyof typeof space] ? s : best,
    'right' as Placement)
  }

  let left: number
  let top: number
  switch (place) {
    case 'top':
      left = rect.x + rect.width / 2 - CARD_W / 2
      top = rect.y - GAP - cardH
      break
    case 'bottom':
      left = rect.x + rect.width / 2 - CARD_W / 2
      top = rect.y + rect.height + GAP
      break
    case 'left':
      left = rect.x - GAP - CARD_W
      top = rect.y + rect.height / 2 - cardH / 2
      break
    case 'right':
    default:
      left = rect.x + rect.width + GAP
      top = rect.y + rect.height / 2 - cardH / 2
      break
  }
  left = Math.min(Math.max(MARGIN, left), vw - CARD_W - MARGIN)
  top = Math.min(Math.max(MARGIN, top), Math.max(MARGIN, vh - cardH - MARGIN))
  return { left, top, placement: place }
}

interface TourCardProps {
  step: TourStep
  chapter: TourChapter
  lang: Lang
  rect: SpotRect | null
  flatIndex: number
  flatTotal: number
  chapterCount: number
  chapterIdx: number
  paused: boolean
  /** 0..1 autoplay progress, driven by rAF without React re-renders. */
  progressMv: MotionValue<number>
  waitingForLive: boolean
  liveFired: boolean
  onPrev: () => void
  onNext: () => void
  onTogglePause: () => void
  onClose: () => void
  onGoChapter: (idx: number) => void
}

export function TourCard({
  step,
  chapter,
  lang,
  rect,
  flatIndex,
  flatTotal,
  chapterCount,
  chapterIdx,
  paused,
  progressMv,
  waitingForLive,
  liveFired,
  onPrev,
  onNext,
  onTogglePause,
  onClose,
  onGoChapter,
}: TourCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState(220)
  const pos = useMemo(() => computePos(rect, step.placement, cardH), [rect, step.placement, cardH])

  // Move focus to the card on step change, without scrolling the page.
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true })
  }, [step.id])

  // Measure card height for positioning (re-measured when content/lang changes).
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setCardH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const t = (x: I18nText) => x[lang]
  const isFirst = flatIndex === 0
  const isLast = flatIndex === flatTotal - 1

  return (
    <motion.div
      className="fixed z-[91] pointer-events-auto"
      initial={false}
      animate={{ left: pos.left, top: pos.top }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ left: pos.left, top: pos.top, width: `min(${CARD_W}px, 92vw)` }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-label={t(step.title)}
          tabIndex={-1}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="relative overflow-hidden rounded-lg border border-edge-strong bg-surface-2/95 backdrop-blur-md focus:outline-none"
          style={{ boxShadow: '0 24px 60px -28px rgba(0,0,0,0.9)' }}
        >
          {/* Accent tick header strip */}
          <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
            <span className="accent-tick self-stretch min-h-[16px]" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3 truncate">
              {t(chapter.title)}
            </span>
            <span className="ml-auto font-mono text-[10px] text-ink-3 tabular-nums shrink-0">
              {lang === 'zh' ? '步驟' : 'STEP'} {flatIndex + 1}/{flatTotal}
            </span>
            <LangToggle />
            <button
              type="button"
              onClick={onClose}
              aria-label={t(LABELS.end)}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-ink-3 hover:text-ink-1 hover:bg-surface-3 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="px-3.5 pb-3">
            <h3 className="text-[15px] font-semibold text-ink-1 leading-snug">{t(step.title)}</h3>
            <div className="mt-1.5 text-[13px] text-ink-2 leading-relaxed">{renderBody(t(step.body))}</div>

            {waitingForLive && !liveFired && (
              <div className="mt-2.5 flex items-center gap-2 text-[11px] text-ink-3">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent/60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                {t(LABELS.waiting)}
              </div>
            )}
            {liveFired && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-accent">
                <Radio size={12} className="animate-pulse-soft" />
                {t(LABELS.live)}
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="flex items-center gap-2 px-3.5 pb-3">
            <button
              type="button"
              onClick={onPrev}
              disabled={isFirst}
              aria-label={t(LABELS.prev)}
              className="inline-flex items-center gap-1 text-[12px] text-ink-2 hover:text-ink-1 disabled:opacity-30 disabled:cursor-default cursor-pointer transition-colors"
            >
              <ChevronLeft size={15} /> {t(LABELS.prev)}
            </button>

            <button
              type="button"
              onClick={onTogglePause}
              aria-label={paused ? t(LABELS.resume) : t(LABELS.pause)}
              className="mx-auto w-8 h-8 flex items-center justify-center rounded-full border border-edge-strong text-accent hover:bg-accent/10 cursor-pointer transition-colors"
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>

            <button
              type="button"
              onClick={onNext}
              aria-label={isLast ? t(LABELS.end) : t(LABELS.next)}
              className="inline-flex items-center gap-1 text-[12px] text-accent hover:text-ink-1 cursor-pointer transition-colors"
            >
              {isLast ? t(LABELS.end) : t(LABELS.next)} <ChevronRight size={15} />
            </button>
          </div>

          {/* Chapter dots */}
          {chapterCount > 1 && (
            <div className="flex items-center justify-center gap-1.5 pb-3">
              {Array.from({ length: chapterCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onGoChapter(i)}
                  aria-label={`${lang === 'zh' ? '章節' : 'Chapter'} ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all cursor-pointer',
                    i === chapterIdx ? 'w-5 bg-accent' : 'w-1.5 bg-ink-mute hover:bg-ink-3',
                  )}
                />
              ))}
            </div>
          )}

          {/* Autoplay progress bar — driven by a MotionValue via scaleX (no
              layout, no per-frame React render). */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-edge/30">
            <motion.div
              className="h-[2px] w-full bg-accent"
              style={{ scaleX: progressMv, transformOrigin: 'left', boxShadow: '0 0 8px var(--accent-glow)' }}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
