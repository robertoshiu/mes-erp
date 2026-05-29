import { useEffect, useMemo, useState } from 'react'
import {
  Landmark,
  Wallet,
  Boxes,
  Receipt,
  Coins,
  Building2,
  Radio,
  ScrollText,
} from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { MetricTile } from '../../components/ui/MetricTile'
import { Gauge } from '../../components/ui/Gauge'
import { cn } from '../../lib/utils'
import type { ErpModuleProps } from './types'
import type { GlPostingEvent } from '../../lib/erpEvents'

/** Compact USD formatter — abbreviates to K / M so KPI tiles stay one line. */
function fmtMoney(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${Math.round(abs).toLocaleString()}`
}

/** Signed, rounded amount for the live ledger (e.g. +12,450 / -3,200). */
function fmtSigned(n: number): string {
  const r = Math.round(n)
  return `${r >= 0 ? '+' : '-'}${Math.abs(r).toLocaleString()}`
}

const MAX_POSTINGS = 40

export function FinanceModule({ erpData, eventBus }: ErpModuleProps) {
  // --- Deterministic KPIs computed from master/transactional data ----------
  const kpis = useMemo(() => {
    const costByMaterial = new Map<string, number>()
    for (const m of erpData.materials) costByMaterial.set(m.materialNo, m.standardCost)

    const inventoryValue = erpData.inventory.reduce(
      (acc, row) => acc + row.onHand * (costByMaterial.get(row.materialNo) ?? 0),
      0,
    )

    // WIP = standard cost of material committed but not yet on the shelf.
    const wipValue = erpData.inventory.reduce(
      (acc, row) => acc + row.committed * (costByMaterial.get(row.materialNo) ?? 0),
      0,
    )

    const revenue = erpData.salesOrders.reduce((acc, so) => acc + so.netValue, 0)

    // Open AR = net value of sales orders not yet complete.
    const openAr = erpData.salesOrders
      .filter(so => so.status !== 'complete')
      .reduce((acc, so) => acc + so.netValue, 0)

    // Open AP = net value of purchase orders not yet received.
    const openAp = erpData.purchaseOrders
      .filter(po => po.status !== 'received')
      .reduce((acc, po) => acc + po.netValue, 0)

    return { inventoryValue, wipValue, revenue, openAr, openAp }
  }, [erpData])

  // AR collection health: share of revenue already collected (status complete).
  const collectedPct =
    kpis.revenue > 0 ? Math.round(((kpis.revenue - kpis.openAr) / kpis.revenue) * 100) : 0

  // --- Live GL postings ledger ---------------------------------------------
  const [postings, setPostings] = useState<GlPostingEvent[]>([])

  useEffect(() => {
    const sub = eventBus.ofTopic('erp.gl.posting').subscribe(e => {
      setPostings(prev => [e, ...prev].slice(0, MAX_POSTINGS))
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  const costCenters = erpData.costCenters

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricTile
          label="Inventory Value"
          value={fmtMoney(kpis.inventoryValue)}
          icon={<Boxes size={14} strokeWidth={1.9} />}
          colorIndex={0}
        />
        <MetricTile
          label="WIP"
          value={fmtMoney(kpis.wipValue)}
          icon={<Coins size={14} strokeWidth={1.9} />}
          colorIndex={2}
        />
        <MetricTile
          label="Revenue"
          value={fmtMoney(kpis.revenue)}
          icon={<Landmark size={14} strokeWidth={1.9} />}
          colorIndex={3}
        />
        <MetricTile
          label="Open AR"
          value={fmtMoney(kpis.openAr)}
          icon={<Receipt size={14} strokeWidth={1.9} />}
          colorIndex={4}
        />
        <Panel className="flex items-center justify-center gap-3 p-3.5">
          <Gauge
            value={collectedPct}
            max={100}
            size={92}
            stroke={9}
            color="#34D399"
            label="Collected"
          />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Open AP
            </div>
            <div
              className="metric-value mt-1 text-lg font-semibold leading-none text-ink-1"
              style={{ textShadow: '0 0 16px rgba(251,113,133,0.33)' }}
            >
              {fmtMoney(kpis.openAp)}
            </div>
            <div className="mt-1.5 text-[10px] text-ink-3">
              <span className="font-mono tabular-nums text-ink-2">
                {fmtMoney(kpis.revenue - kpis.openAr)}
              </span>{' '}
              collected
            </div>
          </div>
        </Panel>
      </div>

      {/* Two-panel body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Cost centers */}
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PanelHeader
            title="Cost Centers"
            subtitle={`${costCenters.length} controlling objects`}
            icon={<Building2 size={15} strokeWidth={1.9} />}
            right={
              <span className="font-mono metric-value text-sm text-ink-1">
                {costCenters.length}
              </span>
            }
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {costCenters.length === 0 ? (
              <EmptyState
                icon={<Building2 size={22} strokeWidth={1.6} />}
                title="No cost centers yet"
                hint="Controlling objects will appear here once the org is configured."
              />
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="border-b border-edge text-[10px] uppercase tracking-[0.12em] text-ink-3">
                    <th className="px-3.5 py-2 text-left font-semibold">ID</th>
                    <th className="px-3.5 py-2 text-left font-semibold">Name</th>
                    <th className="px-3.5 py-2 text-left font-semibold">Area</th>
                  </tr>
                </thead>
                <tbody>
                  {costCenters.map(cc => (
                    <tr
                      key={cc.costCenterId}
                      className="border-b border-edge/60 transition-colors last:border-b-0 hover:bg-surface-3/50"
                    >
                      <td className="px-3.5 py-2 font-mono text-accent">{cc.costCenterId}</td>
                      <td className="px-3.5 py-2 text-ink-1">{cc.name}</td>
                      <td className="px-3.5 py-2">
                        <span className="inline-flex items-center rounded-sm border border-edge bg-surface-3/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-2">
                          {cc.area}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        {/* Live GL postings ledger */}
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PanelHeader
            title="GL Postings · Live"
            subtitle="Document line items"
            icon={<ScrollText size={15} strokeWidth={1.9} />}
            right={
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-ink-3">
                <Radio size={13} strokeWidth={1.9} className="text-success animate-pulse-soft" />
                {postings.length}
              </span>
            }
          />
          <div
            className="min-h-0 flex-1 overflow-y-auto bg-canvas font-mono text-xs"
            style={{ boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(34,211,238,0.06)' }}
          >
            {postings.length === 0 ? (
              <EmptyState
                icon={<Wallet size={22} strokeWidth={1.6} />}
                title="Ledger is balanced and quiet"
                hint="Postings stream in as orders, receipts, and invoices settle."
              />
            ) : (
              postings.map((p, i) => {
                const positive = p.amount >= 0
                return (
                  <div
                    key={`${p.t}-${p.accountNo}-${p.ref}-${i}`}
                    className={cn(
                      'flex items-center gap-2.5 border-b border-edge/60 px-3 py-1.5 last:border-b-0',
                      i === 0 && 'animate-rise',
                    )}
                  >
                    <span className="w-12 shrink-0 tabular-nums text-[10px] text-ink-mute">
                      {p.t.toFixed(1)}s
                    </span>
                    <span className="w-16 shrink-0 text-accent">{p.accountNo}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-2">
                      <span className="text-ink-1">{p.accountName}</span>
                      <span className="text-ink-3"> · {p.ref}</span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 tabular-nums font-semibold',
                        positive ? 'text-success' : 'text-critical',
                      )}
                    >
                      {fmtSigned(p.amount)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

/** Warm, centered empty state with a muted lucide icon. */
function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="text-ink-3">{icon}</span>
      <div className="text-sm text-ink-2">{title}</div>
      <div className="max-w-[34ch] text-[11px] leading-relaxed text-ink-3">{hint}</div>
    </div>
  )
}
