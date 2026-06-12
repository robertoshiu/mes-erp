import { resolveToneColor, type VizTone } from '@/lib/vizTone'

interface SparkRingProps {
  value: number
  max: number
  /** Pixel diameter (16–28 typical for table cells). */
  size?: number
  /** 'auto' derives a tone from value/max; defaults to accent. */
  tone?: 'auto' | VizTone
}

/** Tiny pure-SVG radial ring with a glow stroke — cheap enough for table cells
 *  (no recharts). Title attr carries the raw value/max for hover read-out. */
export function SparkRing({ value, max, size = 20, tone = 'accent' }: SparkRingProps) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const color = resolveToneColor(tone, max > 0 ? value / max : NaN)
  const stroke = Math.max(2, Math.round(size * 0.14))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2

  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90 inline-block align-middle"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <title>{`${value} / ${max}`}</title>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${ratio * c} ${c}`}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  )
}
