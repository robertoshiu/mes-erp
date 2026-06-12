import { cn } from '@/lib/utils'
import { useTourStore } from './tourStore'

/**
 * Shared bilingual language toggle used across the tour surfaces (TourCard,
 * TourCenter, Handbook). Reads + writes the tour-store `lang` directly so every
 * call site stays in sync, with one set of markup + aria semantics.
 */
export function LangToggle({ className }: { className?: string }) {
  const lang = useTourStore(s => s.lang)
  const setLang = useTourStore(s => s.setLang)
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
      aria-label={lang === 'zh' ? 'Switch to English' : '切換為中文'}
      className={cn(
        'shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded border border-edge text-ink-2 hover:text-accent hover:border-edge-strong transition-colors cursor-pointer',
        className,
      )}
    >
      {lang === 'zh' ? '中 / EN' : 'EN / 中'}
    </button>
  )
}
