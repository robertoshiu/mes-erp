import { useEffect, useMemo, useState } from 'react'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import type { EventBus } from '../../lib/eventBus'
import type { MasterData } from '../../data/master'
import type { Lot } from '../../data/lots'

interface ProductionModuleProps {
  eventBus: EventBus
  masterData: MasterData
}

export function ProductionModule({ eventBus, masterData }: ProductionModuleProps) {
  const [lotSteps, setLotSteps] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    for (const lot of masterData.lots) m[lot.lotId] = lot.currentStep
    return m
  })
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  useEffect(() => {
    const sub = eventBus.ofTopic('lot.move').subscribe(e => {
      setLotSteps(prev => ({ ...prev, [e.lotId]: e.routeStep }))
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  const columns: Column<Lot>[] = useMemo(() => [
    { key: 'lotId', header: 'Lot ID', width: 170, mono: true, render: r => r.lotId, sortFn: (a, b) => a.lotId.localeCompare(b.lotId) },
    { key: 'productCode', header: 'Product', width: 120, mono: true, render: r => r.productCode },
    { key: 'customerName', header: 'Customer', width: 110, render: r => r.customerName },
    { key: 'routeId', header: 'Route', width: 110, mono: true, render: r => r.routeId },
    {
      key: 'progress', header: 'Progress', width: 100,
      render: r => {
        const step = lotSteps[r.lotId] ?? r.currentStep
        return (
          <div className="flex items-center gap-1">
            <div className="flex-1 h-1.5 bg-[#E5E7EB] rounded-full">
              <div className="h-full bg-[#0066B3] rounded-full" style={{ width: `${(step / r.totalSteps) * 100}%` }} />
            </div>
            <span className="text-[10px] text-[#6B7280] font-mono">{step}/{r.totalSteps}</span>
          </div>
        )
      },
    },
    {
      key: 'priority', header: 'Priority', width: 80,
      render: r => (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${
          r.priority === 'super-hot' ? 'bg-[#DC2626] text-white' :
          r.priority === 'hot' ? 'bg-[#F59E0B] text-white' :
          'text-[#6B7280]'
        }`}>
          {r.priority === 'normal' ? '\u2014' : r.priority.toUpperCase()}
        </span>
      ),
    },
    { key: 'status', header: 'Status', width: 90, render: r => r.status },
    { key: 'waferCount', header: 'Wafers', width: 60, render: r => r.waferCount },
  ], [lotSteps])

  const selectedLot = selectedEntity?.type === 'lot'
    ? masterData.lots.find(l => l.lotId === selectedEntity.id)
    : null

  const route = selectedLot
    ? masterData.routes.find(r => r.routeId === selectedLot.routeId)
    : null

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4">
        <DenseDataTable
          data={masterData.lots}
          columns={columns}
          rowKey={r => r.lotId}
          onRowClick={r => selectEntity({ type: 'lot', id: r.lotId })}
        />
      </div>

      {selectedLot && (
        <DrillInPanel title={selectedLot.lotId}>
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-[#6B7280]">Product:</span> <span className="font-mono">{selectedLot.productCode}</span></div>
              <div><span className="text-[#6B7280]">Customer:</span> {selectedLot.customerName}</div>
              <div><span className="text-[#6B7280]">Route:</span> <span className="font-mono">{selectedLot.routeId}</span></div>
              <div><span className="text-[#6B7280]">Wafers:</span> {selectedLot.waferCount}</div>
              <div><span className="text-[#6B7280]">Priority:</span> {selectedLot.priority}</div>
              <div><span className="text-[#6B7280]">Status:</span> {selectedLot.status}</div>
            </div>

            {route && (
              <div>
                <div className="font-semibold text-[#6B7280] mb-1">Route Steps</div>
                {route.steps.map(step => {
                  const current = (lotSteps[selectedLot.lotId] ?? selectedLot.currentStep) === step.stepIndex
                  return (
                    <div key={step.stepIndex} className={`flex items-center gap-2 py-1 border-b border-[#E5E7EB] ${current ? 'bg-[#0066B3] bg-opacity-10' : ''}`}>
                      <span className="w-5 text-center font-mono">{step.stepIndex}</span>
                      <span className="flex-1">{step.stepName}</span>
                      <span className="text-[#6B7280] font-mono">{step.toolType}</span>
                      {current && <span className="text-[#0066B3] font-semibold">CURRENT</span>}
                    </div>
                  )
                })}
              </div>
            )}

            {(selectedLot.parentLotId || selectedLot.childLotIds.length > 0) && (
              <div>
                <div className="font-semibold text-[#6B7280] mb-1">Genealogy</div>
                {selectedLot.parentLotId && (
                  <div className="py-1">
                    <span className="text-[#6B7280]">Parent:</span>{' '}
                    <button className="font-mono text-[#0066B3] hover:underline" onClick={() => selectEntity({ type: 'lot', id: selectedLot.parentLotId! })}>
                      {selectedLot.parentLotId}
                    </button>
                  </div>
                )}
                {selectedLot.childLotIds.length > 0 && (
                  <div className="py-1">
                    <span className="text-[#6B7280]">Children:</span>
                    {selectedLot.childLotIds.map(id => (
                      <button key={id} className="ml-2 font-mono text-[#0066B3] hover:underline" onClick={() => selectEntity({ type: 'lot', id })}>
                        {id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DrillInPanel>
      )}
    </div>
  )
}
