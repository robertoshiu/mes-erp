import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Play, BookOpen, Compass } from 'lucide-react'
import { useUiStore } from '@/lib/uiStore'
import type { I18nText } from './types'
import { useTourStore } from './tourStore'
import { tourMeta } from './tours'
import { LangToggle } from './LangToggle'

export function TourCenter() {
  const centerOpen = useTourStore(s => s.centerOpen)
  const closeCenter = useTourStore(s => s.closeCenter)
  const startTour = useTourStore(s => s.startTour)
  const lang = useTourStore(s => s.lang)
  const completed = useTourStore(s => s.completed)
  const setRoute = useUiStore(s => s.setRoute)

  // Esc closes (only when open).
  useEffect(() => {
    if (!centerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeCenter() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [centerOpen, closeCenter])

  const t = (x: I18nText) => x[lang]

  return createPortal(
    <AnimatePresence>
      {centerOpen && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Veil */}
          <button
            type="button"
            aria-label={lang === 'zh' ? '關閉' : 'Close'}
            onClick={closeCenter}
            className="absolute inset-0 bg-canvas/70 backdrop-blur-sm cursor-default"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={lang === 'zh' ? '導覽中心' : 'Tour Center'}
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg border border-edge-strong bg-surface-2/95 backdrop-blur-md"
            style={{ boxShadow: '0 30px 80px -30px rgba(0,0,0,0.9)' }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center gap-2.5 px-4 py-3 border-b border-edge bg-surface-2/95 backdrop-blur-md">
              <span className="accent-tick self-stretch min-h-[24px]" aria-hidden />
              <Compass size={16} className="text-accent" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-2">
                  {lang === 'zh' ? '導覽中心' : 'Tour Center'}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <LangToggle />
                <button
                  type="button"
                  onClick={closeCenter}
                  aria-label={lang === 'zh' ? '關閉' : 'Close'}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-ink-3 hover:text-ink-1 hover:bg-surface-3 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Tour cards */}
            <div className="p-4 grid gap-3">
              {tourMeta.map(tour => {
                const isDone = !!completed[tour.id]
                return (
                  <div
                    key={tour.id}
                    className="panel panel-hover p-3.5 flex items-start gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink-1 truncate">{t(tour.title)}</h3>
                        {isDone && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-success">
                            <Check size={11} /> {lang === 'zh' ? '已完成' : 'Done'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12px] text-ink-3 leading-relaxed">{t(tour.description)}</p>
                      <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-ink-mute">
                        <span>{tour.estMinutes} {lang === 'zh' ? '分鐘' : 'min'}</span>
                        <span>·</span>
                        <span>{tour.chapterCount} {lang === 'zh' ? '章' : 'chapters'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startTour(tour.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-foreground bg-accent hover:brightness-110 rounded-md px-3 py-1.5 cursor-pointer transition-all"
                    >
                      <Play size={13} /> {lang === 'zh' ? '開始' : 'Start'}
                    </button>
                  </div>
                )
              })}

              {/* Handbook link */}
              <button
                type="button"
                onClick={() => { setRoute('handbook'); closeCenter() }}
                className="mt-1 inline-flex items-center justify-center gap-2 text-[12px] text-ink-2 hover:text-accent border border-edge hover:border-edge-strong rounded-md py-2.5 cursor-pointer transition-colors"
              >
                <BookOpen size={14} />
                {lang === 'zh' ? '開啟操作手冊' : 'Open Handbook'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
