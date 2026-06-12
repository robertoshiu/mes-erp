import { motion } from 'framer-motion'

export interface SpotRect {
  x: number
  y: number
  width: number
  height: number
}

interface SpotlightProps {
  /** Target rect in viewport coords, or null for a centered (full-veil) step. */
  rect: SpotRect | null
  pulse?: boolean
}

const PAD = 8
const RX = 10
const VEIL = 'rgba(6,10,20,0.78)'
const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 }

/**
 * Dim veil with a TRUE hole around the target rect.
 *
 * Rather than an SVG mask (which still intercepts pointer events over the
 * cutout), the veil is drawn as four absolutely-positioned bands — top, bottom,
 * left, right — that frame the cutout. The hole region itself has NO veil
 * element, so the target paints at its natural z-index and is fully clickable.
 * Each band is `pointer-events-auto` to block clicks elsewhere; the accent glow
 * ring (and optional sonar pulse) are `pointer-events-none` so they never steal
 * the click. Centered/no-rect mode falls back to a single full-screen veil.
 */
export function Spotlight({ rect, pulse }: SpotlightProps) {
  // Centered step: single full veil, no hole.
  if (!rect) {
    return (
      <motion.div
        className="fixed inset-0 z-[90] pointer-events-auto"
        style={{ background: VEIL }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        aria-hidden
      />
    )
  }

  // Padded cutout geometry (clamped to >= 0).
  const cx = rect.x - PAD
  const cy = rect.y - PAD
  const cw = Math.max(0, rect.width + PAD * 2)
  const ch = Math.max(0, rect.height + PAD * 2)
  const cright = cx + cw
  const cbottom = cy + ch

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none" aria-hidden>
      {/* Four veil bands framing the hole — each blocks pointer events. */}
      {/* Top band: full width, above the cutout. */}
      <motion.div
        className="absolute left-0 right-0 top-0 pointer-events-auto"
        style={{ background: VEIL }}
        initial={false}
        animate={{ height: Math.max(0, cy) }}
        transition={SPRING}
      />
      {/* Bottom band: full width, below the cutout. */}
      <motion.div
        className="absolute left-0 right-0 bottom-0 pointer-events-auto"
        style={{ background: VEIL }}
        initial={false}
        animate={{ top: cbottom }}
        transition={SPRING}
      />
      {/* Left band: between top and bottom bands, left of the cutout. */}
      <motion.div
        className="absolute left-0 pointer-events-auto"
        style={{ background: VEIL }}
        initial={false}
        animate={{ top: cy, height: ch, width: Math.max(0, cx) }}
        transition={SPRING}
      />
      {/* Right band: between top and bottom bands, right of the cutout. */}
      <motion.div
        className="absolute right-0 pointer-events-auto"
        style={{ background: VEIL }}
        initial={false}
        animate={{ top: cy, height: ch, left: cright }}
        transition={SPRING}
      />

      {/* Optional sonar pulse around the cutout. */}
      {pulse && (
        <motion.div
          className="absolute rounded-[14px] pointer-events-none"
          style={{ border: '2px solid var(--accent)' }}
          initial={false}
          animate={{
            left: [cx - 4, cx - 14],
            top: [cy - 4, cy - 14],
            width: [cw + 8, cw + 28],
            height: [ch + 8, ch + 28],
            opacity: [0.5, 0],
          }}
          transition={{ duration: 1.8, ease: 'easeOut', repeat: Infinity }}
        />
      )}

      {/* Animated accent glow ring (rounded corners kept). */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          borderRadius: RX,
          border: '2px solid var(--accent)',
          filter: 'drop-shadow(0 0 8px var(--accent-glow))',
        }}
        initial={false}
        animate={{ left: cx, top: cy, width: cw, height: ch }}
        transition={SPRING}
      />
    </div>
  )
}
