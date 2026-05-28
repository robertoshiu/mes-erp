import { useEffect, useMemo, useState } from 'react'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import type { EventBus } from '../../lib/eventBus'
import type { MasterData } from '../../data/master'
import type { Equipment } from '../../data/master/equipment'
import type { E10State } from '../../lib/events'
import { e10Colors, e10Symbols } from '../../lib/tokens'
import { formatE10Transition, formatRecipeLoad } from '../../lib/secs'

interface EquipmentModuleProps {
  eventBus: EventBus
  masterData: MasterData
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
        return (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 inline-block" style={{ backgroundColor: e10Colors[state] }} />
            <span>{e10Symbols[state]} {state}</span>
          </span>
        )
      },
    },
  ], [states])

  const selectedTool = selectedEntity?.type === 'equipment'
    ? masterData.equipment.find(e => e.toolId === selectedEntity.id)
    : null

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4">
        <DenseDataTable
          data={masterData.equipment}
          columns={columns}
          rowKey={r => r.toolId}
          onRowClick={r => {
            selectEntity({ type: 'equipment', id: r.toolId })
            setSecsLog([])
          }}
        />
      </div>

      {selectedTool && (
        <DrillInPanel title={`${selectedTool.toolId} — ${selectedTool.toolName}`}>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-[#6B7280] mb-1">Current State</div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4" style={{ backgroundColor: e10Colors[states[selectedTool.toolId] || 'NSC'] }} />
                <span className="font-mono text-sm">{states[selectedTool.toolId] || 'NSC'}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-[#6B7280] mb-1">SECS Message Log</div>
              <div className="bg-[#1A1A1A] text-[#16A34A] font-mono text-xs p-3 rounded-none max-h-96 overflow-y-auto">
                {secsLog.length === 0 && <div className="text-[#6B7280]">Waiting for events...</div>}
                {secsLog.map((msg, i) => (
                  <pre key={i} className="mb-2 whitespace-pre-wrap border-b border-[#303030] pb-2">{msg}</pre>
                ))}
              </div>
            </div>
          </div>
        </DrillInPanel>
      )}
    </div>
  )
}
