import { cn } from '@/lib/utils'
import { resolveToneColor, type VizTone } from '@/lib/vizTone'

interface HeatbarProps {
  value: number
  max: number
  /** 'auto' derives a tone from value/max (≥0.66 success / ≥0.33 warn / else critical). */
  tone?: 'auto' | VizTone
  /** Optional tick marks (in value units) drawn over the track. */
  ticks?: number[]
  /** Optional inline label rendered above/before the bar. */
  label?: string
  className?: string
}

/** Inline table-cell bar: gradient fill + glowing tip. Cheap, no recharts. */
export function Heatbar({ value, max, tone = 'auto', ticks, label, className }: HeatbarProps) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const color = resolveToneColor(tone, max > 0 ? value / max : NaN)
  const pct = ratio * 100

  return (
    <div className={cn('w-full min-w-16', className)}>
      {label && (
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] uppercase tracking-[0.12em] text-ink-3 truncate">{label}</span>
          <span className="metric-value text-[10px] text-ink-2">{value}</span>
        </div>
      )}
      <div
        className="relative h-1.5 rounded-full overflow-hidden bg-white/[0.06]"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}55, ${color})`,
            boxShadow: `0 0 8px -1px ${color}, inset 0 0 0 1px ${color}40`,
          }}
        />
        {/* Glow tip */}
        {pct > 0 && pct < 100 && (
          <span
            className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full"
            style={{ left: `calc(${pct}% - 2px)`, background: color, boxShadow: `0 0 6px ${color}` }}
            aria-hidden
          />
        )}
        {/* Tick marks */}
        {ticks?.map((t, i) => {
          const tp = max > 0 ? Math.max(0, Math.min(1, t / max)) * 100 : 0
          return (
            <span
              key={i}
              className="absolute top-0 bottom-0 w-px bg-white/25"
              style={{ left: `${tp}%` }}
              aria-hidden
            />
          )
        })}
      </div>
    </div>
  )
}
