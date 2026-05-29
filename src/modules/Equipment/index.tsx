import { useEffect, useMemo, useState } from 'react'
import { Cpu, ScrollText, Radio } from 'lucide-react'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { StatusDot } from '../../components/ui/StatusDot'
import { useUiStore } from '../../lib/uiStore'
import type { EventBus } from '../../lib/eventBus'
import type { MasterData } from '../../data/master'
import type { Equipment } from '../../data/master/equipment'
import type { E10State } from '../../lib/events'
import { e10Colors, e10Glow, e10Labels } from '../../lib/tokens'
import { formatE10Transition, formatRecipeLoad } from '../../lib/secs'

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
    <div className="flex items-center gap-3">
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

export function EquipmentModule({ eventBus, masterData }: EquipmentModuleProps) {
  const [states, setStates] = useState<Record<string, E10State>>(() => {
    const m: Record<string, E10State> = {}
    for (const eq of masterData.equipment) m[eq.toolId] = eq.initialState
    return m
  })
  const [secsLog, setSecsLog] = useState<string[]>([])
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  useEffect(() => {
    const sub = eventBus.ofTopic('equip.state').subscribe(e => {
      setStates(prev => ({ ...prev, [e.toolId]: e.toState }))
      if (selectedEntity?.type === 'equipment' && selectedEntity.id === e.toolId) {
        setSecsLog(prev => [formatE10Transition(e.toolId, e.fromState, e.toState, e.reasonCode), ...prev].slice(0, 50))
      }
    })
    const sub2 = eventBus.ofTopic('recipe.load').subscribe(e => {
      if (selectedEntity?.type === 'equipment' && selectedEntity.id === e.toolId) {
        setSecsLog(prev => [formatRecipeLoad(e.toolId, e.recipeId, e.recipeVersion), ...prev].slice(0, 50))
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
  ], [states])

  const selectedTool = selectedEntity?.type === 'equipment'
    ? masterData.equipment.find(e => e.toolId === selectedEntity.id)
    : null

  const toolCount = masterData.equipment.length

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col gap-3 p-4 min-w-0">
        <Panel>
          <PanelHeader
            title="Equipment · E10 State"
            icon={<Cpu size={15} strokeWidth={1.9} />}
            right={
              <div className="flex items-center gap-4">
                <StateDistribution states={states} total={toolCount} />
                <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
                  <Radio size={13} strokeWidth={1.9} className="text-accent animate-pulse-soft" />
                  <span className="font-mono metric-value text-ink-1">{toolCount}</span>
                  <span className="uppercase tracking-[0.12em]">tools</span>
                </span>
              </div>
            }
          />
        </Panel>

        <div className="flex-1 min-h-0">
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
        </div>
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
              </div>
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
                {secsLog.map((msg, i) => (
                  <div key={i} className="mb-2 border-b border-edge pb-2 last:border-b-0 flex gap-2">
                    <span className="select-none text-e10-prod shrink-0">&gt;</span>
                    <pre className="whitespace-pre-wrap text-ink-2 m-0">{msg}</pre>
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
