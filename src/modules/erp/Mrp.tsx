import { useMemo, useState } from 'react'
import {
  Network,
  ShieldCheck,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  PackageSearch,
  X,
} from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { cn } from '../../lib/utils'
import type { ErpModuleProps } from './types'
import type {
  InventoryRow,
  Material,
  ProductionOrder,
  PurchaseOrder,
} from '../../data/erp/types'

/** Number of forward time buckets to project coverage over. */
const BUCKET_COUNT = 5
const BUCKETS = Array.from({ length: BUCKET_COUNT }, (_, i) => `B${i + 1}`)

/** Compact integer formatter for the dense numeric cells. */
function fmt(n: number): string {
  return Math.round(n).toLocaleString()
}

interface CoverageRow {
  materialNo: string
  description: string
  plant: string
  storageLoc: string
  baseUoM: string
  leadTimeDays: number
  onHand: number
  committed: number
  available: number
  /** Steady per-bucket burn (deterministic). */
  burn: number
  /** Projected on-hand at the end of each bucket B1..B5. */
  projected: number[]
  /** True if any bucket goes to/below zero. */
  shortage: boolean
  /** Index of the first bucket that breaches zero, or -1. */
  firstBreach: number
}

/**
 * Deterministically derive a per-bucket demand "burn" from a row's own numbers.
 * No randomness, no wall-clock: a longer lead time spreads the committed demand
 * over more buckets (slower burn); a shorter lead time concentrates it.
 */
function deriveBurn(committed: number, leadTimeDays: number): number {
  const horizon = Math.max(1, Math.min(leadTimeDays, BUCKET_COUNT))
  // Spread committed demand across the lead-time horizon, but never less than a
  // token trickle so every row time-phases visibly.
  return Math.max(committed / horizon, committed > 0 ? 0.5 : 0)
}

/** Build the time-phased coverage matrix from inventory + material master. */
function buildCoverage(
  inventory: InventoryRow[],
  materials: Material[],
): CoverageRow[] {
  const matByNo = new Map(materials.map(m => [m.materialNo, m]))

  return inventory.map(row => {
    const mat = matByNo.get(row.materialNo)
    const leadTimeDays = mat?.leadTimeDays ?? 1
    const baseUoM = mat?.baseUoM ?? 'EA'
    const burn = deriveBurn(row.committed, leadTimeDays)

    const projected: number[] = []
    let running = row.onHand
    let firstBreach = -1
    for (let i = 0; i < BUCKET_COUNT; i++) {
      running = running - burn
      projected.push(running)
      if (running <= 0 && firstBreach === -1) firstBreach = i
    }

    return {
      materialNo: row.materialNo,
      description: row.description,
      plant: row.plant,
      storageLoc: row.storageLoc,
      baseUoM,
      leadTimeDays,
      onHand: row.onHand,
      committed: row.committed,
      available: row.available,
      burn,
      projected,
      shortage: firstBreach !== -1,
      firstBreach,
    }
  })
}

/** Production orders consuming a material (demand) — open / not yet completed. */
function demandFor(materialNo: string, prodOrders: ProductionOrder[]): ProductionOrder[] {
  return prodOrders.filter(
    p => p.materialNo === materialNo && p.status !== 'Completed',
  )
}

/** Purchase order lines supplying a material (supply) — not yet received. */
interface SupplyElement {
  poNo: string
  vendorName: string
  deliveryDate: string
  status: PurchaseOrder['status']
  qty: number
}

function supplyFor(materialNo: string, purchaseOrders: PurchaseOrder[]): SupplyElement[] {
  const out: SupplyElement[] = []
  for (const po of purchaseOrders) {
    if (po.status === 'received') continue
    for (const line of po.lines) {
      if (line.materialNo !== materialNo) continue
      out.push({
        poNo: po.poNo,
        vendorName: po.vendorName,
        deliveryDate: po.deliveryDate,
        status: po.status,
        qty: line.qty,
      })
    }
  }
  return out
}

const PO_STATUS_TONE: Record<PurchaseOrder['status'], { dot: string; text: string }> = {
  open: { dot: 'bg-info', text: 'text-info' },
  confirmed: { dot: 'bg-success', text: 'text-success' },
  received: { dot: 'bg-ink-mute', text: 'text-ink-3' },
  late: { dot: 'bg-critical', text: 'text-critical' },
}

const PROD_STATUS_TONE: Record<ProductionOrder['status'], { dot: string; text: string }> = {
  Created: { dot: 'bg-ink-mute', text: 'text-ink-3' },
  Released: { dot: 'bg-accent-3', text: 'text-accent-3' },
  InProcess: { dot: 'bg-success', text: 'text-success' },
  Completed: { dot: 'bg-ink-mute', text: 'text-ink-3' },
}

export function MrpModule({ erpData, eventBus: _eventBus }: ErpModuleProps) {
  const [selectedNo, setSelectedNo] = useState<string | null>(null)

  const coverage = useMemo(
    () => buildCoverage(erpData.inventory, erpData.materials),
    [erpData.inventory, erpData.materials],
  )

  const shortageCount = useMemo(
    () => coverage.filter(r => r.shortage).length,
    [coverage],
  )

  const selected = useMemo(
    () => coverage.find(r => r.materialNo === selectedNo) ?? null,
    [coverage, selectedNo],
  )

  const demand = useMemo(
    () => (selected ? demandFor(selected.materialNo, erpData.productionOrders) : []),
    [selected, erpData.productionOrders],
  )
  const supply = useMemo(
    () => (selected ? supplyFor(selected.materialNo, erpData.purchaseOrders) : []),
    [selected, erpData.purchaseOrders],
  )

  // Column geometry: keep the matrix dense and aligned.
  const colMaterial = 320
  const colNum = 86
  const bucketCol = 78

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 min-w-0">
        <Panel className="flex flex-col h-full overflow-hidden">
          <PanelHeader
            title="MRP · Material Coverage"
            subtitle={`${coverage.length.toLocaleString()} materials · ${BUCKET_COUNT}-bucket projection`}
            icon={<Network size={15} strokeWidth={1.9} />}
            right={
              shortageCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] px-2 py-1 rounded-sm bg-critical/15 text-critical border border-critical/30">
                  <AlertTriangle size={12} strokeWidth={2} />
                  <span className="font-mono tabular-nums">{shortageCount}</span>
                  shortage{shortageCount === 1 ? '' : 's'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] px-2 py-1 rounded-sm bg-success/10 text-success border border-success/25">
                  <ShieldCheck size={12} strokeWidth={2} />
                  covered
                </span>
              )
            }
          />

          {coverage.length === 0 ? (
            <EmptyCovered
              title="No materials to plan"
              line="Inventory is empty — once stock is loaded, coverage projections appear here."
            />
          ) : shortageCount === 0 ? (
            <EmptyCovered
              title="All materials covered"
              line={`Projected on-hand stays positive across all ${BUCKET_COUNT} buckets for every material in stock.`}
            />
          ) : (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Matrix header */}
              <div className="flex bg-surface-3/60 border-b border-edge text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3 shrink-0">
                <div className="px-2.5 py-2.5 shrink-0" style={{ width: colMaterial }}>
                  Material
                </div>
                <div
                  className="px-2.5 py-2.5 shrink-0 text-right"
                  style={{ width: colNum }}
                >
                  On-Hand
                </div>
                {BUCKETS.map(b => (
                  <div
                    key={b}
                    className="px-2.5 py-2.5 shrink-0 text-right text-accent/80"
                    style={{ width: bucketCol }}
                    title="Projected on-hand at end of bucket"
                  >
                    {b}
                  </div>
                ))}
              </div>

              {/* Matrix body */}
              <div className="flex-1 overflow-auto">
                {coverage.map((row, idx) => {
                  const isSel = row.materialNo === selectedNo
                  return (
                    <button
                      key={row.materialNo}
                      onClick={() => setSelectedNo(row.materialNo)}
                      className={cn(
                        'group relative flex w-full items-center text-xs border-b border-white/[0.04] text-left transition-colors',
                        idx % 2 === 1 && !isSel && 'bg-white/[0.015]',
                        isSel ? 'bg-accent/10' : 'hover:bg-surface-3/70',
                        row.shortage && !isSel && 'row-hot',
                      )}
                      style={{ height: 34 }}
                    >
                      {/* selection / hover rail */}
                      <span
                        className={cn(
                          'absolute left-0 top-0 bottom-0 w-[2px] transition-all',
                          isSel
                            ? 'bg-accent'
                            : row.shortage
                              ? 'bg-critical/50'
                              : 'bg-transparent group-hover:bg-accent/40',
                        )}
                        style={isSel ? { boxShadow: '0 0 8px var(--accent-glow)' } : undefined}
                        aria-hidden
                      />
                      {/* Material */}
                      <div
                        className="px-2.5 shrink-0 min-w-0 flex items-baseline gap-2"
                        style={{ width: colMaterial }}
                      >
                        <span className="font-mono text-ink-2 shrink-0">{row.materialNo}</span>
                        <span className="truncate text-ink-3 text-[11px]">{row.description}</span>
                      </div>
                      {/* On-Hand */}
                      <div
                        className="px-2.5 shrink-0 text-right font-mono tabular-nums text-ink-1"
                        style={{ width: colNum }}
                      >
                        {fmt(row.onHand)}
                      </div>
                      {/* Buckets */}
                      {row.projected.map((p, i) => {
                        const breach = p <= 0
                        return (
                          <div
                            key={i}
                            className={cn(
                              'px-2.5 shrink-0 text-right font-mono tabular-nums self-stretch flex items-center justify-end',
                              breach
                                ? 'bg-critical/15 text-critical font-semibold'
                                : 'text-ink-2',
                            )}
                            style={{ width: bucketCol }}
                          >
                            {fmt(p)}
                          </div>
                        )
                      })}
                    </button>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="px-2.5 py-1.5 text-[10px] font-mono text-ink-3 border-t border-edge bg-surface-3/40 flex items-center gap-1.5 shrink-0">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-accent/70"
                  style={{ boxShadow: '0 0 6px var(--accent-glow)' }}
                />
                {coverage.length.toLocaleString()} materials · cells at or below zero glow critical
              </div>
            </div>
          )}
        </Panel>
      </div>

      {selected && (
        <aside
          className="w-[420px] shrink-0 glass border-l border-edge-strong overflow-y-auto"
          style={{ boxShadow: '-30px 0 60px -30px rgba(0,0,0,0.9)' }}
        >
          <div className="sticky top-0 z-10 flex items-center gap-2.5 px-4 py-3 border-b border-edge bg-surface/80 backdrop-blur-md">
            <span className="accent-tick self-stretch min-h-[26px]" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-ink-1 truncate">
                {selected.materialNo}
              </h2>
              <div className="text-[10px] text-ink-3 font-mono truncate">
                {selected.description}
              </div>
            </div>
            <button
              onClick={() => setSelectedNo(null)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-ink-3 hover:text-ink-1 hover:bg-surface-3 cursor-pointer transition-colors"
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-4 space-y-5 text-xs">
            {/* Coverage snapshot */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <DetailField label="Plant" value={selected.plant} mono />
              <DetailField label="Storage Loc" value={selected.storageLoc} mono />
              <DetailField label="On-Hand" value={`${fmt(selected.onHand)} ${selected.baseUoM}`} mono />
              <DetailField label="Committed" value={fmt(selected.committed)} mono />
              <DetailField label="Available" value={fmt(selected.available)} mono />
              <DetailField label="Lead Time" value={`${selected.leadTimeDays} d`} mono />
              <DetailField label="Per-Bucket Burn" value={fmt(selected.burn)} mono />
              <DetailField
                label="Coverage"
                value={
                  selected.shortage ? (
                    <span className="inline-flex items-center gap-1 text-critical">
                      <AlertTriangle size={12} strokeWidth={2} />
                      breach @ {BUCKETS[selected.firstBreach]}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-success">
                      <ShieldCheck size={12} strokeWidth={2} />
                      covered
                    </span>
                  )
                }
              />
            </div>

            {/* Projection strip */}
            <section>
              <SectionTitle icon={<PackageSearch size={13} strokeWidth={1.9} />} text="Projected On-Hand" />
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {selected.projected.map((p, i) => {
                  const breach = p <= 0
                  return (
                    <div
                      key={i}
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-center',
                        breach
                          ? 'bg-critical/15 border-critical/30 text-critical'
                          : 'bg-surface-3/40 border-edge text-ink-1',
                      )}
                    >
                      <div className="text-[9px] uppercase tracking-[0.12em] text-ink-3">
                        {BUCKETS[i]}
                      </div>
                      <div className="font-mono tabular-nums text-[11px] mt-0.5">{fmt(p)}</div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Demand elements — production orders consuming this material */}
            <section>
              <SectionTitle
                icon={<ArrowDownRight size={13} strokeWidth={1.9} />}
                text={`Demand · ${demand.length} prod order${demand.length === 1 ? '' : 's'}`}
              />
              {demand.length === 0 ? (
                <MiniEmpty line="No open production orders consuming this material." />
              ) : (
                <div className="mt-2 rounded-md border border-edge overflow-hidden">
                  {demand.map(p => {
                    const tone = PROD_STATUS_TONE[p.status]
                    return (
                      <div
                        key={p.orderNo}
                        className="flex items-center gap-2.5 py-1.5 px-2.5 border-b border-edge last:border-b-0"
                      >
                        <span className="font-mono text-[11px] text-ink-2 shrink-0">{p.orderNo}</span>
                        <span className="flex-1 truncate text-ink-3 text-[11px]">{p.description}</span>
                        <span className="font-mono tabular-nums text-critical text-[11px] shrink-0">
                          −{fmt(p.targetQty)}
                        </span>
                        <span className={cn('flex items-center gap-1 text-[10px] shrink-0', tone.text)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', tone.dot)} aria-hidden />
                          {p.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Supply elements — purchase orders replenishing this material */}
            <section>
              <SectionTitle
                icon={<ArrowUpRight size={13} strokeWidth={1.9} />}
                text={`Supply · ${supply.length} purch line${supply.length === 1 ? '' : 's'}`}
              />
              {supply.length === 0 ? (
                <MiniEmpty line="No inbound purchase orders for this material." />
              ) : (
                <div className="mt-2 rounded-md border border-edge overflow-hidden">
                  {supply.map((s, i) => {
                    const tone = PO_STATUS_TONE[s.status]
                    return (
                      <div
                        key={`${s.poNo}-${i}`}
                        className="flex items-center gap-2.5 py-1.5 px-2.5 border-b border-edge last:border-b-0"
                      >
                        <span className="font-mono text-[11px] text-ink-2 shrink-0">{s.poNo}</span>
                        <span className="flex-1 truncate text-ink-3 text-[11px]">{s.vendorName}</span>
                        <span className="font-mono tabular-nums text-success text-[11px] shrink-0">
                          +{fmt(s.qty)}
                        </span>
                        <span className={cn('flex items-center gap-1 text-[10px] shrink-0', tone.text)}>
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              tone.dot,
                              s.status === 'late' && 'animate-pulse-soft',
                            )}
                            aria-hidden
                          />
                          {s.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </aside>
      )}
    </div>
  )
}

/** Label/value pair in the drill-in detail grid. */
function DetailField({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">{label}</div>
      <div className={cn('text-ink-1 truncate', mono && 'font-mono tabular-nums')}>{value}</div>
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

/** Small inline empty line for the demand/supply sections. */
function MiniEmpty({ line }: { line: string }) {
  return (
    <div className="mt-2 rounded-md border border-edge bg-surface-3/30 px-3 py-3 text-[11px] text-ink-3">
      {line}
    </div>
  )
}

/** Warm centered empty state with an emerald check. */
function EmptyCovered({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6">
      <div className="w-12 h-12 rounded-full bg-success/10 border border-success/25 flex items-center justify-center mb-3">
        <ShieldCheck size={22} strokeWidth={1.8} className="text-success" />
      </div>
      <div className="text-sm font-semibold text-ink-2">{title}</div>
      <div className="text-xs text-ink-3 mt-1 max-w-xs">{line}</div>
    </div>
  )
}
