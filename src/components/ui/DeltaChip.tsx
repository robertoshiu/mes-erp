import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeltaChipProps {
  /** Signed change. Sign drives the arrow; magnitude is shown. */
  delta: number
  /** Unit suffix appended to the magnitude (e.g. '%', 'pp'). */
  suffix?: string
  /** Flip the good/bad coloring (for cost / lateness metrics where up = bad). */
  invert?: boolean
  className?: string
}

const GOOD = '#34D399'
const BAD = '#FB7185'
const FLAT = '#74849E'

/** Standardized trend chip — up = good by default; `invert` flips the tones.
 *  Matches MetricTile's delta chip styling (mono, lucide trend icon). */
export function DeltaChip({ delta, suffix, invert, className }: DeltaChipProps) {
  const up = delta > 0
  const down = delta < 0
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus

  let color = FLAT
  if (up) color = invert ? BAD : GOOD
  else if (down) color = invert ? GOOD : BAD

  const mag = Math.abs(delta)
  const text = Number.isInteger(mag) ? mag.toString() : mag.toFixed(1)
  const sign = up ? '+' : down ? '−' : ''

  return (
    <span
      className={cn('inline-flex items-center gap-0.5 text-[11px] font-mono tabular-nums', className)}
      style={{ color }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {sign}{text}{suffix ?? ''}
    </span>
  )
}
