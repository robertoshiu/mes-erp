import { useEffect, useMemo, useState } from 'react'
import { Boxes, GitBranch, ArrowRight, Layers } from 'lucide-react'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { useUiStore } from '../../lib/uiStore'
import { cn } from '../../lib/utils'
import type { EventBus } from '../../lib/eventBus'
import type { MasterData } from '../../data/master'
import type { Lot } from '../../data/lots'

interface ProductionModuleProps {
  eventBus: EventBus
  masterData: MasterData
}

/** Tiny colored dot + label for lot status. */
function StatusCell({ status }: { status: Lot['status'] }) {
  const map: Record<Lot['status'], { dot: string; text: string; label: string; glow?: string }> = {
    'in-process': { dot: 'bg-success', text: 'text-success', label: 'In-Process', glow: 'rgba(52, 211, 153, 0.55)' },
    hold: { dot: 'bg-warn', text: 'text-warn', label: 'Hold', glow: 'rgba(251, 191, 36, 0.55)' },
    complete: { dot: 'bg-ink-mute', text: 'text-ink-3', label: 'Complete' },
    queued: { dot: 'bg-accent-3', text: 'text-accent-3', label: 'Queued', glow: 'rgba(129, 140, 248, 0.5)' },
  }
  const s = map[status]
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.dot)}
        style={s.glow ? { boxShadow: `0 0 6px ${s.glow}` } : undefined}
      />
      <span className={cn('text-[11px] truncate', s.text)}>{s.label}</span>
    </span>
  )
}

/** Priority chip: super-hot pulses critical, hot is amber, normal is a muted dash. */
function PriorityCell({ priority }: { priority: Lot['priority'] }) {
  if (priority === 'super-hot') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm bg-critical text-white animate-pulse-soft">
        <span className="relative inline-flex w-1.5 h-1.5 shrink-0" aria-hidden>
          <span className="w-1.5 h-1.5 rounded-full bg-critical" />
          <span className="animate-sonar absolute inset-0 rounded-full border border-critical" />
        </span>
        Super-Hot
      </span>
    )
  }
  if (priority === 'hot') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm bg-warn/20 text-warn border border-warn/30">
        <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse-soft shrink-0" aria-hidden />
        Hot
      </span>
    )
  }
  return <span className="text-[11px] text-ink-3" aria-label="normal priority">&mdash;</span>
}

/** Progress track + glowing gradient fill + mono step/total label. */
function ProgressCell({ step, total }: { step: number; total: number }) {
  const pct = total > 0 ? (step / total) * 100 : 0
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent"
          style={{ width: `${pct}%`, boxShadow: '0 0 6px rgba(34, 211, 238, 0.55)' }}
        />
      </div>
      <span className="text-[10px] text-ink-3 font-mono tabular-nums shrink-0">{step}/{total}</span>
    </div>
  )
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
      key: 'progress', header: 'Progress', width: 120,
      render: r => {
        const step = lotSteps[r.lotId] ?? r.currentStep
        return <ProgressCell step={step} total={r.totalSteps} />
      },
    },
    {
      key: 'priority', header: 'Priority', width: 96,
      render: r => <PriorityCell priority={r.priority} />,
    },
    { key: 'status', header: 'Status', width: 110, render: r => <StatusCell status={r.status} /> },
    { key: 'waferCount', header: 'Wafers', width: 64, mono: true, render: r => <span className="font-mono tabular-nums">{r.waferCount}</span> },
  ], [lotSteps])

  const selectedLot = selectedEntity?.type === 'lot'
    ? masterData.lots.find(l => l.lotId === selectedEntity.id)
    : null

  const route = selectedLot
    ? masterData.routes.find(r => r.routeId === selectedLot.routeId)
    : null

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 min-w-0">
        <Panel className="flex flex-col h-full overflow-hidden">
          <PanelHeader
            title="Production · WIP"
            subtitle={`${masterData.lots.length.toLocaleString()} lots tracked`}
            icon={<Boxes size={15} strokeWidth={1.9} />}
            right={
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] text-ink-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-mute" aria-hidden />
                  Normal
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-warn">
                  <span className="w-1.5 h-1.5 rounded-full bg-warn" aria-hidden />
                  Hot
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-critical">
                  <span className="w-1.5 h-1.5 rounded-full bg-critical animate-pulse-soft" aria-hidden />
                  Super-Hot
                </span>
              </div>
            }
          />
          <div className="flex-1 min-h-0">
            <DenseDataTable
              data={masterData.lots}
              columns={columns}
              rowKey={r => r.lotId}
              onRowClick={r => selectEntity({ type: 'lot', id: r.lotId })}
              selectedKey={selectedEntity?.id ?? null}
              rowClassName={r => r.priority === 'super-hot' ? 'row-superhot' : r.priority === 'hot' ? 'row-hot' : undefined}
            />
          </div>
        </Panel>
      </div>

      {selectedLot && (
        <DrillInPanel title={selectedLot.lotId} subtitle={selectedLot.productCode}>
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <DetailField label="Product" value={selectedLot.productCode} mono />
              <DetailField label="Customer" value={selectedLot.customerName} />
              <DetailField label="Route" value={selectedLot.routeId} mono />
              <DetailField label="Wafers" value={String(selectedLot.waferCount)} mono />
              <DetailField label="Priority" value={<PriorityCell priority={selectedLot.priority} />} />
              <DetailField label="Status" value={<StatusCell status={selectedLot.status} />} />
            </div>

            {route && (
              <section>
                <SectionTitle icon={<Layers size={13} strokeWidth={1.9} />} text="Route Steps" />
                <div className="mt-2 rounded-md border border-edge overflow-hidden">
                  {route.steps.map(step => {
                    const current = (lotSteps[selectedLot.lotId] ?? selectedLot.currentStep) === step.stepIndex
                    return (
                      <div
                        key={step.stepIndex}
                        className={cn(
                          'relative flex items-center gap-2.5 py-1.5 pl-3 pr-2.5 border-b border-edge last:border-b-0 transition-colors',
                          current ? 'bg-accent/10' : 'hover:bg-surface-3/50',
                        )}
                      >
                        {current && (
                          <span
                            className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent"
                            style={{ boxShadow: '0 0 8px var(--accent-glow)' }}
                            aria-hidden
                          />
                        )}
                        <span className={cn('w-5 text-center font-mono tabular-nums text-[11px]', current ? 'text-accent' : 'text-ink-3')}>
                          {step.stepIndex}
                        </span>
                        <span className={cn('flex-1 truncate', current ? 'text-ink-1' : 'text-ink-2')}>{step.stepName}</span>
                        <span className="text-ink-3 font-mono text-[10px] shrink-0">{step.toolType}</span>
                        {current && (
                          <span className="text-accent font-semibold text-[10px] uppercase tracking-[0.12em] shrink-0 text-glow-soft">
                            Current
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {(selectedLot.parentLotId || selectedLot.childLotIds.length > 0) && (
              <section>
                <SectionTitle icon={<GitBranch size={13} strokeWidth={1.9} />} text="Genealogy" />
                <div className="mt-2 space-y-2">
                  {selectedLot.parentLotId && (
                    <div className="flex items-center gap-2">
                      <span className="text-ink-3 w-14 shrink-0">Parent</span>
                      <GenealogyLink id={selectedLot.parentLotId} onClick={() => selectEntity({ type: 'lot', id: selectedLot.parentLotId! })} />
                    </div>
                  )}
                  {selectedLot.childLotIds.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-ink-3 w-14 shrink-0 pt-1">Children</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedLot.childLotIds.map(id => (
                          <GenealogyLink key={id} id={id} onClick={() => selectEntity({ type: 'lot', id })} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </DrillInPanel>
      )}
    </div>
  )
}

/** Label/value pair in the drill-in detail grid. */
function DetailField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">{label}</div>
      <div className={cn('text-ink-1 truncate', mono && 'font-mono')}>{value}</div>
    </div>
  )
}

/** Uppercase tracked section heading with a small accent icon. */
function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
      <span className="text-accent flex items-center">{icon}</span>
      {text}
    </div>
  )
}

/** Accent button linking to a related lot. */
function GenealogyLink({ id, onClick }: { id: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:text-accent-2 px-2 py-1 rounded-md bg-accent/10 hover:bg-accent/15 border border-edge cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
    >
      <span className="group-hover:underline">{id}</span>
      <ArrowRight size={11} strokeWidth={1.9} className="opacity-60 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}
