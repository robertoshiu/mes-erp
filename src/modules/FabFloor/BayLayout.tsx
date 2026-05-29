import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Observable } from 'rxjs'
import type { EquipStateEvent, LotMoveEvent, E10State } from '../../lib/events'
import { e10Colors, e10Glow, e10Symbols, e10Labels } from '../../lib/tokens'
import { StatusDot } from '../../components/ui/StatusDot'
import type { Equipment } from '../../data/master/equipment'

interface BayLayoutProps {
  equipment: Equipment[]
  equipState$: Observable<EquipStateEvent>
  lotMove$: Observable<LotMoveEvent>
}

const LEGEND_STATES: E10State[] = ['PROD', 'STBY', 'SDT', 'UDT', 'ENG', 'NSC']
const DOWN_STATES: ReadonlySet<E10State> = new Set<E10State>(['SDT', 'UDT'])
// States whose halo is transparent (NSC/OUT) get no bloom rect.
const NO_GLOW_STATES: ReadonlySet<E10State> = new Set<E10State>(['NSC', 'OUT'])

// Layout: 2 rows of 4 bays, tools in each bay
const SVG_WIDTH = 1000
const SVG_HEIGHT = 500
const BAY_WIDTH = 230
const BAY_HEIGHT = 200
const TILE_SIZE = 28
const TILE_GAP = 4

// Module-scoped, deterministic id source for wafer-flow particles.
let particleSeq = 0

type Particle = { id: number; x1: number; y1: number; x2: number; y2: number }

export function BayLayout({ equipment, equipState$, lotMove$ }: BayLayoutProps) {
  const [states, setStates] = useState<Record<string, E10State>>(() => {
    const initial: Record<string, E10State> = {}
    for (const eq of equipment) {
      initial[eq.toolId] = eq.initialState
    }
    return initial
  })

  useEffect(() => {
    const sub = equipState$.subscribe(e => {
      setStates(prev => ({ ...prev, [e.toolId]: e.toState }))
    })
    return () => sub.unsubscribe()
  }, [equipState$])

  // Layout: 2 rows of 4 bays, tools in each bay
  const svgWidth = SVG_WIDTH
  const svgHeight = SVG_HEIGHT
  const bayWidth = BAY_WIDTH
  const bayHeight = BAY_HEIGHT
  const tileSize = TILE_SIZE
  const tileGap = TILE_GAP

  // toolId -> tile center, using the SAME coordinate math as the tiles below.
  const toolPos = useMemo(() => {
    const map = new Map<string, { cx: number; cy: number }>()
    for (const eq of equipment) {
      const col = eq.bayIndex % 4
      const row = Math.floor(eq.bayIndex / 4)
      const bayX = col * BAY_WIDTH + 15
      const bayY = row * (BAY_HEIGHT + 40) + 30
      const tileX = bayX + 8 + eq.slotInBay * (TILE_SIZE + TILE_GAP)
      const tileY = bayY + 36
      map.set(eq.toolId, { cx: tileX + TILE_SIZE / 2, cy: tileY + TILE_SIZE / 2 })
    }
    return map
  }, [equipment])

  // Wafer-flow particles travelling between tools on lot moves.
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const sub = lotMove$.subscribe(e => {
      const from = toolPos.get(e.fromToolId)
      const to = toolPos.get(e.toToolId)
      if (!from || !to) return
      if (from.cx === to.cx && from.cy === to.cy) return
      const id = particleSeq++
      setParticles(prev => {
        const next = [...prev, { id, x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy }]
        return next.length > 14 ? next.slice(next.length - 14) : next
      })
    })
    return () => sub.unsubscribe()
  }, [lotMove$, toolPos])

  return (
    <div className="relative w-full h-full">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
        <defs>
          {/* Soft neon bloom for equipment tiles */}
          <filter id="fpTileGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Faint grid backdrop */}
          <pattern id="fpFloorGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(56,189,248,0.05)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Floor grid wash */}
        <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#fpFloorGrid)" />

        {/* Bay backgrounds */}
        {Array.from({ length: 8 }, (_, bayIdx) => {
          const col = bayIdx % 4
          const row = Math.floor(bayIdx / 4)
          const x = col * bayWidth + 15
          const y = row * (bayHeight + 40) + 30
          return (
            <g key={`bay-${bayIdx}`}>
              <rect
                x={x}
                y={y}
                width={bayWidth - 10}
                height={bayHeight}
                rx={8}
                fill="rgba(17,26,44,0.6)"
                stroke="rgba(56,189,248,0.18)"
                strokeWidth={1}
              />
              {/* header divider under the bay label */}
              <line
                x1={x + 8}
                y1={y + 26}
                x2={x + bayWidth - 18}
                y2={y + 26}
                stroke="rgba(56,189,248,0.10)"
                strokeWidth={1}
              />
              <text
                x={x + 10}
                y={y + 18}
                className="font-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  fill: '#74849E',
                  fontWeight: 600,
                }}
              >
                BAY-{String(bayIdx + 1).padStart(2, '0')}
              </text>
            </g>
          )
        })}

        {/* Equipment tiles */}
        {equipment.map(eq => {
          const state = states[eq.toolId] || 'NSC'
          const col = eq.bayIndex % 4
          const row = Math.floor(eq.bayIndex / 4)
          const bayX = col * bayWidth + 15
          const bayY = row * (bayHeight + 40) + 30
          const tileX = bayX + 8 + eq.slotInBay * (tileSize + tileGap)
          const tileY = bayY + 36
          const color = e10Colors[state]
          const halo = e10Glow[state]
          const isDown = DOWN_STATES.has(state)
          const cx = tileX + tileSize / 2
          const cy = tileY + tileSize / 2

          return (
            <g key={eq.toolId}>
              {/* Bloom halo behind the tile (skipped for non-glowing states) */}
              {!NO_GLOW_STATES.has(state) && (
                <rect
                  x={tileX - 3}
                  y={tileY - 3}
                  width={tileSize + 6}
                  height={tileSize + 6}
                  rx={7}
                  fill={halo}
                  className="transition-colors duration-200"
                  style={{ filter: 'blur(4px)' }}
                  opacity={0.7}
                />
              )}
              <rect
                x={tileX}
                y={tileY}
                width={tileSize}
                height={tileSize}
                fill={color}
                rx={5}
                className="transition-colors duration-200"
                style={{ filter: 'url(#fpTileGlow)' }}
              />
              {/* Pulsing ring on down tools to draw the eye */}
              {isDown && (
                <rect
                  x={tileX}
                  y={tileY}
                  width={tileSize}
                  height={tileSize}
                  rx={5}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  className="animate-pulse-soft"
                />
              )}
              <text
                x={cx}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-mono pointer-events-none"
                style={{ fontSize: 11, fill: 'rgba(10,14,24,0.78)', fontWeight: 700 }}
              >
                {e10Symbols[state]}
              </text>
              <title>{eq.toolId} — {state}</title>
            </g>
          )
        })}

        {/* Wafer-flow particle layer (draws on top; ignores pointer so tile tooltips work) */}
        <g className="pointer-events-none">
          {particles.map(p => (
            <g key={p.id}>
              <motion.line
                x1={p.x1}
                y1={p.y1}
                x2={p.x2}
                y2={p.y2}
                stroke="#22D3EE"
                strokeWidth={1}
                strokeDasharray="3 4"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.35, 0] }}
                transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
              />
              <motion.circle
                r={7}
                fill="#22D3EE"
                style={{ filter: 'blur(3px)' }}
                initial={{ cx: p.x1, cy: p.y1, opacity: 0 }}
                animate={{ cx: p.x2, cy: p.y2, opacity: [0, 0.28, 0.28, 0] }}
                transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
              />
              <motion.circle
                r={3.2}
                fill="#CFFAFE"
                filter="url(#fpTileGlow)"
                initial={{ cx: p.x1, cy: p.y1, opacity: 0 }}
                animate={{ cx: p.x2, cy: p.y2, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
                onAnimationComplete={() =>
                  setParticles(prev => prev.filter(q => q.id !== p.id))
                }
              />
            </g>
          ))}
        </g>
      </svg>

      {/* Decorative animated scan sweep overlay (CSS, performant, reduced-motion aware) */}
      <div
        className="scan-sweep pointer-events-none absolute inset-0 rounded-lg"
        aria-hidden
      />

      {/* Legend overlay */}
      <div
        className="glass rounded-md absolute bottom-2 left-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
        aria-label="Equipment state legend"
      >
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-3 mr-1">
          E10
        </span>
        {LEGEND_STATES.map(s => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <StatusDot state={s} size={7} pulse={DOWN_STATES.has(s)} />
            <span className="text-[10px] text-ink-2 leading-none">{e10Labels[s]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
