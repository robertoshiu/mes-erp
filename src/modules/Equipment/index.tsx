import { useEffect, useMemo, useRef, useState } from 'react'
import { Cpu, ScrollText, Radio, LayoutGrid, Gauge } from 'lucide-react'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { Heatbar } from '../../components/ui/Heatbar'
import { RankBar } from '../../components/ui/RankBar'
import { StatusDot } from '../../components/ui/StatusDot'
import { useUiStore } from '../../lib/uiStore'
import type { EventBus } from '../../lib/eventBus'
import type { MasterData } from '../../data/master'
import type { Equipment } from '../../data/master/equipment'
import type { E10State } from '../../lib/events'
import { e10Colors, e10Glow, e10Labels } from '../../lib/tokens'
import { formatE10Transition, formatRecipeLoad } from '../../lib/secs'
import { syntheticUptime, rankByUptime } from './uptime'
import { buildStateHistory } from './stateHistory'

interface EquipmentModuleProps {
  eventBus: EventBus
  masterData: MasterData
}

// E10 states ordered for the distribution bar
const STATE_ORDER: E10State[] = ['PROD', 'STBY', 'SDT', 'UDT', 'ENG', 'NSC', 'OUT']

/** Compact live state-distribution bar driven by the active states map. */
function StateDistribution({ states, total }: { states: Record<string, E10State>; total: number }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of Object.values(states)) c[s] = (c[s] ?? 0) + 1
    return c
  }, [states])

  const present = STATE_ORDER.filter(s => (counts[s] ?? 0) > 0)

  return (
    <div className="flex items-center gap-3" data-tour="equipment.state-dist">
      <div className="flex h-1.5 w-40 overflow-hidden rounded-full bg-surface-3/60">
        {present.map(s => {
          const pct = total > 0 ? ((counts[s] ?? 0) / total) * 100 : 0
          return (
            <span
              key={s}
              className="h-full transition-all duration-300"
              style={{ width: `${pct}%`, background: e10Colors[s], boxShadow: `0 0 6px ${e10Glow[s]}` }}
              title={`${e10Labels[s]} · ${counts[s] ?? 0}`}
            />
          )
        })}
      </div>
      <div className="flex items-center gap-2.5">
        {present.map(s => (
          <span key={s} className="flex items-center gap-1">
            <StatusDot state={s} size={7} />
            <span className="text-[10px] font-mono text-ink-3">{counts[s] ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Hero bay×tool fab-floor mosaic — one pure-SVG tile per tool, E10-state colored
 *  and live-updated from the same states map. Clicking a tile selects that row. */
function FabFloorMosaic({
  equipment,
  states,
  selectedId,
  onSelect,
}: {
  equipment: Equipment[]
  states: Record<string, E10State>
  selectedId: string | null
  onSelect: (toolId: string) => void
}) {
  // Group by bay, ordered by bayIndex, then slotInBay — the physical floor layout.
  const bays = useMemo(() => {
    const map = new Map<string, Equipment[]>()
    for (const eq of equipment) {
      const arr = map.get(eq.bay) ?? []
      arr.push(eq)
      map.set(eq.bay, arr)
    }
    const ordered = [...map.entries()].sort(
      (a, b) => (a[1][0]?.bayIndex ?? 0) - (b[1][0]?.bayIndex ?? 0),
    )
    for (const [, arr] of ordered) arr.sort((a, b) => a.slotInBay - b.slotInBay)
    return ordered
  }, [equipment])

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2.5">
      {bays.map(([bay, tools]) => (
        <div key={bay} className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-3 mb-1">
            {bay}
          </div>
          <div className="flex gap-1">
            {tools.map(eq => {
              const state = states[eq.toolId] ?? 'NSC'
              const color = e10Colors[state]
              const glow = e10Glow[state]
              const selected = eq.toolId === selectedId
              const live = state === 'SDT' || state === 'UDT'
              return (
                <button
                  key={eq.toolId}
                  type="button"
                  onClick={() => onSelect(eq.toolId)}
                  title={`${eq.toolId} · ${e10Labels[state]}`}
                  aria-label={`${eq.toolId} ${e10Labels[state]}`}
                  className="group relative rounded-[3px] transition-transform duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent hover:-translate-y-0.5"
                  style={{ lineHeight: 0 }}
                >
                  <svg width={16} height={16} className={live ? 'animate-pulse-soft' : undefined}>
                    <rect
                      x={1}
                      y={1}
                      width={14}
                      height={14}
                      rx={2.5}
                      fill={color}
                      opacity={selected ? 1 : 0.82}
                      style={{ filter: glow !== 'rgba(0,0,0,0)' ? `drop-shadow(0 0 3px ${glow})` : undefined }}
                    />
                    {selected && (
                      <rect
                        x={0.5}
                        y={0.5}
                        width={15}
                        height={15}
                        rx={3}
                        fill="none"
                        stroke="#E8EEF7"
                        strokeWidth={1.2}
                      />
                    )}
                  </svg>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Deterministic 24h E10 state band (stacked horizontal color segments). */
function StateStrip({ toolId, currentState }: { toolId: string; currentState: E10State }) {
  const band = useMemo(() => buildStateHistory(toolId, currentState), [toolId, currentState])
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label="24-hour state history">
      {band.map((seg, i) => (
        <span
          key={i}
          className="h-full"
          style={{
            width: `${seg.frac * 100}%`,
            background: e10Colors[seg.state],
            boxShadow: e10Glow[seg.state] !== 'rgba(0,0,0,0)' ? `inset 0 0 4px ${e10Glow[seg.state]}` : undefined,
          }}
          title={e10Labels[seg.state]}
        />
      ))}
    </div>
  )
}

/**
 * Progressively reveals `text` like a live console feed. Re-types whenever
 * `text` changes. Honors prefers-reduced-motion by revealing instantly.
 */
function Typewriter({ text, speed = 18 }: { text: string; speed?: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduce) {
      setCount(text.length)
      return
    }

    setCount(0)
    const id = setInterval(() => {
      setCount(prev => {
        const next = prev + 3
        if (next >= text.length) {
          clearInterval(id)
          return text.length
        }
        return next
      })
    }, speed)

    return () => clearInterval(id)
  }, [text, speed])

  const typing = count < text.length

  return (
    <span className="whitespace-pre-wrap">
      <span className="whitespace-pre-wrap">{text.slice(0, count)}</span>
      {typing && (
        <span className="animate-blink inline-block w-[1ch] text-accent" aria-hidden="true">
          ▄
        </span>
      )}
    </span>
  )
}

interface SecsLine {
  seq: number
  text: string
}

export function EquipmentModule({ eventBus, masterData }: EquipmentModuleProps) {
  const [states, setStates] = useState<Record<string, E10State>>(() => {
    const m: Record<string, E10State> = {}
    for (const eq of masterData.equipment) m[eq.toolId] = eq.initialState
    return m
  })
  const [secsLog, setSecsLog] = useState<SecsLine[]>([])
  const seqRef = useRef(0)
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  useEffect(() => {
    const append = (text: string) =>
      setSecsLog(prev => [{ seq: seqRef.current++, text }, ...prev].slice(0, 50))
    const sub = eventBus.ofTopic('equip.state').subscribe(e => {
      setStates(prev => ({ ...prev, [e.toolId]: e.toState }))
      if (selectedEntity?.type === 'equipment' && selectedEntity.id === e.toolId) {
        append(formatE10Transition(e.toolId, e.fromState, e.toState, e.reasonCode))
      }
    })
    const sub2 = eventBus.ofTopic('recipe.load').subscribe(e => {
      if (selectedEntity?.type === 'equipment' && selectedEntity.id === e.toolId) {
        append(formatRecipeLoad(e.toolId, e.recipeId, e.recipeVersion))
      }
    })
    return () => { sub.unsubscribe(); sub2.unsubscribe() }
  }, [eventBus, selectedEntity])

  const columns: Column<Equipment>[] = useMemo(() => [
    { key: 'toolId', header: 'Tool ID', width: 140, mono: true, render: r => r.toolId, sortFn: (a, b) => a.toolId.localeCompare(b.toolId) },
    { key: 'bay', header: 'Bay', width: 80, render: r => r.bay },
    { key: 'toolType', header: 'Type', width: 80, render: r => r.toolType },
    { key: 'vendor', header: 'Vendor', width: 80, render: r => r.vendor },
    { key: 'model', header: 'Model', width: 160, render: r => r.model },
    {
      key: 'state', header: 'E10 State', width: 120,
      render: r => {
        const state = states[r.toolId] || 'NSC'
        return <StatusDot state={state} showCode pulse={state === 'SDT' || state === 'UDT'} />
      },
    },
    {
      key: 'uptime', header: 'Uptime', width: 130,
      render: r => {
        const up = syntheticUptime(r.toolId, states[r.toolId] || 'NSC')
        return (
          <div className="flex items-center gap-2">
            <Heatbar value={up} max={100} tone="auto" className="flex-1" />
            <span className="metric-value text-[10px] text-ink-2 tabular-nums shrink-0 w-9 text-right">
              {up.toFixed(0)}%
            </span>
          </div>
        )
      },
    },
  ], [states])

  const selectedTool = selectedEntity?.type === 'equipment'
    ? masterData.equipment.find(e => e.toolId === selectedEntity.id)
    : null

  const toolCount = masterData.equipment.length

  // Synthetic uptime ranking — top + bottom 5 tools for the RankBar pair, plus the
  // productive-count headline. Recomputes only when the live states map changes.
  const ranked = useMemo(
    () => rankByUptime(masterData.equipment, states),
    [masterData.equipment, states],
  )
  const topTools = useMemo(
    () => ranked.slice(0, 5).map(t => ({ label: t.toolId, value: t.uptime, hint: '%' })),
    [ranked],
  )
  const bottomTools = useMemo(
    () => ranked.slice(-5).reverse().map(t => ({ label: t.toolId, value: t.uptime, hint: '%' })),
    [ranked],
  )
  const prodCount = useMemo(
    () => Object.values(states).filter(s => s === 'PROD').length,
    [states],
  )
  const selUptime = selectedTool
    ? syntheticUptime(selectedTool.toolId, states[selectedTool.toolId] || 'NSC')
    : 0

  return (
    <div className="flex h-full">
      <div className="relative flex-1 flex flex-col gap-3 p-4 min-w-0 overflow-hidden">
        <div className="bg-bloom" aria-hidden />

        <ModuleHeader
          domain="MES"
          icon={<Cpu size={13} strokeWidth={2} />}
          title="Equipment · E10 State"
          subtitle="live fab-floor status"
          pills={[
            { label: 'Tools', value: <AnimatedNumber value={toolCount} />, tone: 'accent' },
            { label: 'Productive', value: <AnimatedNumber value={prodCount} />, tone: 'success' },
          ]}
          right={
            <div className="hidden lg:flex items-center gap-4">
              <StateDistribution states={states} total={toolCount} />
              <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
                <Radio size={13} strokeWidth={1.9} className="text-accent animate-pulse-soft" />
                <span className="uppercase tracking-[0.12em]">live</span>
              </span>
            </div>
          }
        />

        {/* Hero: bay×tool mosaic + OEE/uptime rank pair */}
        <div className="grid grid-cols-[1fr_auto] gap-3 shrink-0">
          <Panel
            className="relative overflow-hidden animate-rise"
            style={{ animationDelay: '90ms' }}
            data-tour="equipment.mosaic"
          >
            <PanelHeader
              title="Fab Floor"
              subtitle="bay × tool · E10 state"
              icon={<LayoutGrid size={14} strokeWidth={1.9} />}
            />
            <div className="px-3 py-3 max-h-[148px] overflow-y-auto">
              <FabFloorMosaic
                equipment={masterData.equipment}
                states={states}
                selectedId={selectedEntity?.type === 'equipment' ? selectedEntity.id : null}
                onSelect={toolId => {
                  selectEntity({ type: 'equipment', id: toolId })
                  setSecsLog([])
                }}
              />
            </div>
          </Panel>

          <Panel className="relative w-[300px] overflow-hidden animate-rise" style={{ animationDelay: '140ms' }}>
            <PanelHeader
              title="Uptime Leaders & Laggards"
              icon={<Gauge size={14} strokeWidth={1.9} />}
            />
            <div className="px-2.5 py-2.5 grid grid-cols-2 gap-x-3 max-h-[148px] overflow-y-auto">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-success mb-1.5 px-1">Top</div>
                <RankBar
                  items={topTools}
                  max={100}
                  tone="success"
                  formatValue={n => n.toFixed(0)}
                  onSelect={item => { selectEntity({ type: 'equipment', id: item.label }); setSecsLog([]) }}
                />
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-critical mb-1.5 px-1">Bottom</div>
                <RankBar
                  items={bottomTools}
                  max={100}
                  tone="critical"
                  formatValue={n => n.toFixed(0)}
                  onSelect={item => { selectEntity({ type: 'equipment', id: item.label }); setSecsLog([]) }}
                />
              </div>
            </div>
          </Panel>
        </div>

        <Panel
          className="relative flex-1 min-h-0 overflow-hidden animate-rise"
          style={{ animationDelay: '190ms' }}
          data-tour="equipment.roster"
        >
          <DenseDataTable
            data={masterData.equipment}
            columns={columns}
            rowKey={r => r.toolId}
            selectedKey={selectedEntity?.id ?? null}
            onRowClick={r => {
              selectEntity({ type: 'equipment', id: r.toolId })
              setSecsLog([])
            }}
          />
        </Panel>
      </div>

      {selectedTool && (
        <DrillInPanel
          title={`${selectedTool.toolId} — ${selectedTool.toolName}`}
          subtitle={selectedTool.toolName}
        >
          <div className="space-y-4">
            {/* Current state */}
            <Panel className="p-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3 mb-2.5">
                Current State
              </div>
              <div className="flex items-center gap-3">
                <StatusDot
                  state={states[selectedTool.toolId] || 'NSC'}
                  size={16}
                  pulse={
                    (states[selectedTool.toolId] || 'NSC') === 'SDT' ||
                    (states[selectedTool.toolId] || 'NSC') === 'UDT'
                  }
                />
                <div className="min-w-0">
                  <div className="font-mono text-base text-ink-1 metric-value leading-none">
                    {states[selectedTool.toolId] || 'NSC'}
                  </div>
                  <div className="text-xs text-ink-2 mt-1">
                    {e10Labels[states[selectedTool.toolId] || 'NSC']}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3">Uptime</div>
                  <div className="metric-value text-base text-ink-1 tabular-nums leading-none mt-1">
                    <AnimatedNumber value={selUptime} format={n => `${n.toFixed(1)}%`} />
                  </div>
                </div>
              </div>
            </Panel>

            {/* 24h state history strip — deterministic hash-seeded band */}
            <Panel className="p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  24h State History
                </div>
                <span className="text-[9px] font-mono text-ink-mute">−24h → now</span>
              </div>
              <StateStrip
                toolId={selectedTool.toolId}
                currentState={states[selectedTool.toolId] || 'NSC'}
              />
            </Panel>

            {/* SECS message log terminal */}
            <Panel className="overflow-hidden">
              <PanelHeader
                title="SECS Message Log"
                icon={<ScrollText size={14} strokeWidth={1.9} />}
                right={
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-ink-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-e10-prod animate-pulse-soft" />
                    {secsLog.length}
                  </span>
                }
              />
              <div
                className="bg-canvas text-ink-2 font-mono text-xs p-3 max-h-96 overflow-y-auto"
                style={{ boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(34,211,238,0.06)' }}
              >
                {secsLog.length === 0 && (
                  <div className="flex items-center gap-2 text-ink-3">
                    <span className="text-accent">$</span>
                    <span>Waiting for events</span>
                    <span className="animate-pulse-soft text-accent">_</span>
                  </div>
                )}
                {secsLog.length > 0 && (
                  <div className="mb-2 border-b border-edge pb-2 last:border-b-0 flex gap-2">
                    <span className="select-none text-e10-prod shrink-0">&gt;</span>
                    <pre className="whitespace-pre-wrap text-ink-2 m-0">
                      <Typewriter text={secsLog[0].text} />
                    </pre>
                  </div>
                )}
                {secsLog.slice(1).map(msg => (
                  <div key={msg.seq} className="mb-2 border-b border-edge pb-2 last:border-b-0 flex gap-2">
                    <span className="select-none text-e10-prod shrink-0">&gt;</span>
                    <pre className="whitespace-pre-wrap text-ink-2 m-0">{msg.text}</pre>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </DrillInPanel>
      )}
    </div>
  )
}
