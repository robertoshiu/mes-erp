import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useUiStore } from '../lib/uiStore'

interface DrillInPanelProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  /**
   * Render as a `fixed` overlay (paints over the content) instead of an in-flow
   * flex sibling. Use only for screens whose layout cannot reserve the panel's
   * width — the Control Tower (vertical flex column with a flagship map) and the
   * Supplier Scorecards grid. Table-row screens omit this so the table compresses
   * into the space left of the panel instead of being occluded.
   */
  overlay?: boolean
}

export function DrillInPanel({ children, title, subtitle, overlay = false }: DrillInPanelProps) {
  const selectedEntity = useUiStore(s => s.selectedEntity)
  const selectEntity = useUiStore(s => s.selectEntity)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') selectEntity(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectEntity])

  // Move focus into the panel on open; restore it to the trigger on close.
  useEffect(() => {
    if (!selectedEntity) return
    triggerRef.current = document.activeElement
    closeRef.current?.focus()
    const trigger = triggerRef.current
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [selectedEntity])

  if (!selectedEntity) return null

  return (
    <motion.aside
      role="dialog"
      aria-modal="true"
      aria-labelledby="drillin-title"
      initial={{ x: 36, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
      className={
        overlay
          ? 'fixed top-14 right-0 bottom-0 w-[min(420px,70vw)] max-w-[420px] glass border-l border-edge-strong z-50 overflow-y-auto'
          : 'relative shrink-0 h-full w-[min(420px,70vw)] max-w-[420px] glass border-l border-edge-strong overflow-y-auto'
      }
      style={{ boxShadow: '-30px 0 60px -30px rgba(0,0,0,0.9)' }}
    >
      <div className="sticky top-0 z-10 flex items-center gap-2.5 px-4 py-3 border-b border-edge bg-surface/80 backdrop-blur-md">
        <span className="accent-tick self-stretch min-h-[26px]" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="drillin-title" className="text-sm font-semibold text-ink-1 truncate">{title}</h2>
          {subtitle && <div className="text-[10px] text-ink-3 font-mono truncate">{subtitle}</div>}
        </div>
        <button
          ref={closeRef}
          onClick={() => selectEntity(null)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-ink-3 hover:text-ink-1 hover:bg-surface-3 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Close panel"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </motion.aside>
  )
}
