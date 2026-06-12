import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Hexagon, Play, Compass, SkipForward } from 'lucide-react'
import { useTourStore } from './tourStore'

const APPEAR_DELAY_MS = 1200

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

export function WelcomeModal() {
  const welcomeSeen = useTourStore(s => s.welcomeSeen)
  const markWelcomeSeen = useTourStore(s => s.markWelcomeSeen)
  const startTour = useTourStore(s => s.startTour)
  const openCenter = useTourStore(s => s.openCenter)
  const lang = useTourStore(s => s.lang)

  const [show, setShow] = useState(false)

  useEffect(() => {
    if (welcomeSeen) return
    const id = setTimeout(() => setShow(true), APPEAR_DELAY_MS)
    return () => clearTimeout(id)
  }, [welcomeSeen])

  const dismiss = () => {
    markWelcomeSeen()
    setShow(false)
  }

  // Escape = Skip (略過): mark seen + dismiss. Only while the modal is shown.
  useEffect(() => {
    if (!(show && !welcomeSeen)) return
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        markWelcomeSeen()
        setShow(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, welcomeSeen, markWelcomeSeen])

  const onStartTour = () => { startTour('full-flow'); dismiss() }
  const onOpenCenter = () => { openCenter(); dismiss() }

  return createPortal(
    <AnimatePresence>
      {show && !welcomeSeen && (
        <motion.div
          className="fixed inset-0 z-[85] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="absolute inset-0 bg-canvas/75 backdrop-blur-sm" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={lang === 'zh' ? '歡迎使用 FabPulse' : 'Welcome to FabPulse'}
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="scan-sweep relative w-full max-w-md rounded-xl border border-edge-strong bg-surface-2/95 backdrop-blur-md p-7 text-center"
            style={{ boxShadow: '0 30px 80px -30px rgba(0,0,0,0.92)' }}
          >
            <span className="relative inline-flex items-center justify-center mb-4">
              <Hexagon className="text-accent" size={44} strokeWidth={1.6} fill="rgba(34,211,238,0.12)" />
              <span
                className="absolute w-2 h-2 rounded-full bg-accent animate-pulse-soft"
                style={{ boxShadow: '0 0 10px var(--accent-glow)' }}
              />
            </span>

            <h2 className="text-lg font-semibold text-ink-1 text-glow-soft">
              {lang === 'zh' ? '歡迎使用 FabPulse' : 'Welcome to FabPulse'}
            </h2>
            <p className="mt-2 text-[13px] text-ink-2 leading-relaxed">
              {lang === 'zh'
                ? 'MES · ERP · SCM 一體化作業指揮中心。以 180 秒迴圈即時重現完整製造到供應鏈流程。'
                : 'A unified MES · ERP · SCM command center — a full make-to-supply flow replayed live on a 180-second loop.'}
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onStartTour}
                className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold text-accent-foreground bg-accent hover:brightness-110 rounded-md py-2.5 cursor-pointer transition-all"
              >
                <Play size={15} /> {lang === 'zh' ? '開始完整導覽' : 'Start full tour'}
              </button>
              <button
                type="button"
                onClick={onOpenCenter}
                className="inline-flex items-center justify-center gap-2 text-[13px] text-ink-2 hover:text-accent border border-edge hover:border-edge-strong rounded-md py-2.5 cursor-pointer transition-colors"
              >
                <Compass size={15} /> {lang === 'zh' ? '瀏覽導覽中心' : 'Browse Tour Center'}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex items-center justify-center gap-2 text-[12px] text-ink-3 hover:text-ink-1 py-1.5 cursor-pointer transition-colors"
              >
                <SkipForward size={13} /> {lang === 'zh' ? '略過' : 'Skip'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
