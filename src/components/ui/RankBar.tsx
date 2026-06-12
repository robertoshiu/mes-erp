import { cn } from '@/lib/utils'
import { resolveToneColor, type VizTone } from '@/lib/vizTone'

export interface RankItem {
  label: string
  value: number
  /** Optional secondary read-out (shown muted, right of value). */
  hint?: string
}

interface RankBarProps {
  items: RankItem[]
  /** Scale max; defaults to the largest item value. */
  max?: number
  /** 'auto' tones each bar by its own ratio; otherwise a fixed tone. */
  tone?: 'auto' | VizTone
  onSelect?: (item: RankItem, index: number) => void
  /** Format the numeric value for display. */
  formatValue?: (n: number) => string
  className?: string
}

/** Ranked horizontal bar list with animated growth on mount, mono values and an
 *  optional hover-lift / click. Pure CSS bars — no recharts. */
export function RankBar({ items, max, tone = 'accent', onSelect, formatValue, className }: RankBarProps) {
  const top = max ?? Math.max(1, ...items.map(i => i.value))
  const fmt = formatValue ?? ((n: number) => n.toLocaleString())

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {items.map((item, i) => {
        const ratio = top > 0 ? Math.max(0, Math.min(1, item.value / top)) : 0
        const color = resolveToneColor(tone, top > 0 ? item.value / top : NaN)
        const interactive = !!onSelect
        const Row = interactive ? 'button' : 'div'
        return (
          <Row
            key={`${item.label}-${i}`}
            type={interactive ? 'button' : undefined}
            onClick={interactive ? () => onSelect!(item, i) : undefined}
            className={cn(
              'group w-full text-left rounded-md px-2 py-1 transition-colors',
              interactive && 'hover:bg-surface-3/50 cursor-pointer',
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] text-ink-2 truncate min-w-0 flex-1 group-hover:text-ink-1 transition-colors">
                {item.label}
              </span>
              <span className="metric-value text-[11px] font-semibold text-ink-1 shrink-0">
                {fmt(item.value)}
              </span>
              {item.hint && (
                <span className="font-mono text-[10px] text-ink-mute shrink-0">{item.hint}</span>
              )}
            </div>
            <div className="relative h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
              <div
                className="animate-bar-grow absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${ratio * 100}%`,
                  background: `linear-gradient(90deg, ${color}55, ${color})`,
                  boxShadow: `0 0 8px -1px ${color}`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            </div>
          </Row>
        )
      })}
    </div>
  )
}
