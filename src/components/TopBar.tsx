import { useEffect, useState } from 'react'
import { Radio, Users, Clock as ClockIcon, ChevronRight } from 'lucide-react'
import type { Clock } from '../lib/clock'
import { useUiStore } from '../lib/uiStore'
import { SPINE, type SpineBeat } from '../data/timeline'

interface TopBarProps {
  clock: Clock
  operatorCount: number
}

const LOOP_SECS = 180

// Scripted "beat" cues only — framing markers (Shift start / Loop restart) are
// orientation chrome, not things a presenter narrates as "coming up next".
const BEATS: SpineBeat[] = SPINE.filter(b => b.kind === 'beat')

// Pure: the next scripted beat strictly after `t`, wrapping to the first beat of
// the next cycle when none remain. Null only if there are no beats at all.
function nextBeat(t: number): SpineBeat | null {
  if (BEATS.length === 0) return null
  return BEATS.find(b => b.t > t) ?? BEATS[0]
}

// Read the presenter flag once, SSR-safe. The base rail is always on; the
// caption + beat ticks render only under `?present` so embeds stay minimal.
const PRESENT =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('present')

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

const SHIFT_COLOR: Record<string, string> = {
  A: '#34D399',
  B: '#38BDF8',
  C: '#FBBF24',
}

export function TopBar({ clock, operatorCount }: TopBarProps) {
  const [loopT, setLoopT] = useState(0)
  const [loopIndex, setLoopIndex] = useState(0)
  const currentShift = useUiStore(s => s.currentShift)

  useEffect(() => {
    const id = setInterval(() => {
      setLoopT(clock.loopT())
      setLoopIndex(clock.loopIndex())
    }, 1000)
    return () => clearInterval(id)
  }, [clock])

  const progressPct = (loopT / LOOP_SECS) * 100
  const shiftColor = SHIFT_COLOR[currentShift] ?? '#38BDF8'

  // Derived inline each tick — cheap; loopT already re-renders. No extra state/interval.
  const beat = nextBeat(loopT)
  const secondsUntil = beat ? Math.round((beat.t - loopT + LOOP_SECS) % LOOP_SECS) : 0
  const countdown = `0:${String(secondsUntil).padStart(2, '0')}`

  return (
    <header className="relative h-14 shrink-0 flex items-center justify-between px-4 bg-surface/80 backdrop-blur-md border-b border-edge">
      {/* Left zone — site + live status */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-ink-1 tracking-tight">FAB-01</span>
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full"
          style={{
            color: '#34D399',
            background: 'rgba(52,211,153,0.10)',
            border: '1px solid rgba(52,211,153,0.30)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-e10-prod animate-pulse-soft"
            style={{ boxShadow: '0 0 8px rgba(52,211,153,0.7)' }} />
          PRODUCTION
        </span>
        <span className="text-[10px] font-mono text-ink-3 border border-edge px-1.5 py-0.5 rounded">
          Week 22 · 2026
        </span>
      </div>

      {/* Center zone — mission clock */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2">
          <ClockIcon size={13} className="text-ink-3" />
          <span className="metric-value text-lg font-semibold text-ink-1 tracking-wider tabular-nums">
            {formatTime(loopT)}
          </span>
        </div>
        <span className="text-[9px] uppercase tracking-[0.22em] text-ink-mute font-mono">
          Cycle {String(loopIndex + 1).padStart(2, '0')} · Live
        </span>
        {/* Presenter caption — where the loop is heading next */}
        {PRESENT && beat && (
          <span className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] font-mono leading-none">
            <ChevronRight size={11} className="text-accent animate-pulse-soft" strokeWidth={2.5} />
            <span className="text-accent font-semibold uppercase tracking-[0.18em]">Next</span>
            <span className="text-ink-mute">·</span>
            <span className="text-ink-2 font-medium">{beat.name}</span>
            <span className="text-ink-mute">·</span>
            <span className="text-ink-3 tabular-nums">in {countdown}</span>
          </span>
        )}
      </div>

      {/* Right zone — shift / operators / feed */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-md border"
          style={{ color: shiftColor, borderColor: `${shiftColor}55`, background: `${shiftColor}12` }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: shiftColor, boxShadow: `0 0 8px ${shiftColor}` }} />
          SHIFT-{currentShift}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <Users size={14} className="text-ink-3" />
          <span className="font-mono text-ink-1">{operatorCount}</span>
          <span className="text-ink-3">on shift</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-accent">
          <Radio size={14} className="animate-pulse-soft" />
          LIVE
        </span>
      </div>

      {/* Loop progress rail */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-edge/30">
        {/* Per-beat tick marks — turns the rail into a timeline a presenter can point at */}
        {PRESENT &&
          BEATS.map(b => (
            <span
              key={b.t}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-px bg-accent/40"
              style={{ left: `${(b.t / LOOP_SECS) * 100}%` }}
            />
          ))}
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #38BDF8, #22D3EE)',
            boxShadow: '0 0 10px rgba(34,211,238,0.7)',
          }}
        />
        {/* Glowing position marker tracking current progress */}
        {PRESENT && (
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full transition-all duration-1000 ease-linear"
            style={{
              left: `${progressPct}%`,
              background: 'linear-gradient(90deg, #38BDF8, #22D3EE)',
              boxShadow: '0 0 10px rgba(34,211,238,0.9)',
            }}
          />
        )}
      </div>
    </header>
  )
}
