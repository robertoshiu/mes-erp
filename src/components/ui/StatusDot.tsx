import { cn } from '@/lib/utils'
import { e10Colors, e10Glow, e10Labels } from '@/lib/tokens'
import type { E10State } from '@/lib/events'

interface StatusDotProps {
  state: E10State
  size?: number
  /** Soft opacity pulse — use for live/critical states. */
  pulse?: boolean
  /** Render the state code next to the dot. */
  showCode?: boolean
  /** Render the human-readable label next to the dot. */
  showLabel?: boolean
  className?: string
}

/** Neon equipment-state indicator: colored dot with a soft halo + optional label. */
export function StatusDot({
  state,
  size = 9,
  pulse,
  showCode,
  showLabel,
  className,
}: StatusDotProps) {
  const color = e10Colors[state]
  const halo = e10Glow[state]
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn('rounded-full shrink-0', pulse && 'animate-pulse-soft')}
        style={{
          width: size,
          height: size,
          background: color,
          boxShadow: `0 0 8px ${halo}, 0 0 2px ${halo}`,
        }}
        aria-hidden
      />
      {showCode && <span className="font-mono text-xs text-ink-2">{state}</span>}
      {showLabel && <span className="text-xs text-ink-2">{e10Labels[state]}</span>}
    </span>
  )
}
