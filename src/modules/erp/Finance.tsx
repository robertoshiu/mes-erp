import { useEffect, useMemo, useState } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Landmark,
  Wallet,
  Boxes,
  Coins,
  Building2,
  Radio,
  ScrollText,
  ArrowLeftRight,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { MetricTile } from '../../components/ui/MetricTile'
import { Gauge } from '../../components/ui/Gauge'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { RankBar } from '../../components/ui/RankBar'
import { TickerTape } from '../../components/ui/TickerTape'
import { CHART, ChartDefs, ChartTooltip } from '../../lib/chartTheme'
import { chartSeries, sem } from '../../lib/tokens'
import { cn } from '../../lib/utils'
import type { ErpModuleProps } from './types'
import type { GlPostingEvent } from '../../lib/erpEvents'
import { computeCashPosition, rankTopAccounts, buildGlTrend } from './financeMetrics'

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

const AR_COLOR = sem.success   // emerald — money in
const AP_COLOR = '#FB7185'     // rose — money out

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

    return { inventoryValue, wipValue, revenue }
  }, [erpData])

  // Cash position (AR vs AP) — extracted, node-tested helper.
  const cash = useMemo(() => computeCashPosition(erpData), [erpData])

  // AR collection health: share of revenue already collected (status complete).
  const collectedPct =
    kpis.revenue > 0 ? Math.round(((kpis.revenue - cash.openAr) / kpis.revenue) * 100) : 0

  // --- Live GL postings ledger ---------------------------------------------
  // Backfill from the ring buffer on mount so the ledger isn't blank when
  // navigating in after postings have fired. getBuffer() is oldest→newest, so
  // reverse to match the live newest-first prepend, then cap at MAX_POSTINGS.
  const [postings, setPostings] = useState<GlPostingEvent[]>(() =>
    (eventBus.getBuffer().filter(e => e.topic === 'erp.gl.posting') as GlPostingEvent[])
      .reverse()
      .slice(0, MAX_POSTINGS),
  )

  useEffect(() => {
    const sub = eventBus.ofTopic('erp.gl.posting').subscribe(e => {
      setPostings(prev => [e, ...prev].slice(0, MAX_POSTINGS))
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  // Top accounts by absolute posted amount + GL balance trend, folded from the
  // live ledger window (oldest→newest for the trend cumulation).
  const chronological = useMemo(() => [...postings].reverse(), [postings])
  const topAccounts = useMemo(
    () => rankTopAccounts(chronological, erpData.glAccounts, 6),
    [chronological, erpData.glAccounts],
  )
  const trend = useMemo(() => buildGlTrend(chronological, 12), [chronological])

  const costCenters = erpData.costCenters
  const source$ = useMemo(() => eventBus.all$(), [eventBus])

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div className="bg-bloom" aria-hidden />
      <div className="bg-bloom-2" aria-hidden />

      <div className="relative z-[1] flex h-full min-h-0 flex-col gap-3">
        {/* Command strip — folds the screen KPIs into ModuleHeader pills + right slot. */}
        <ModuleHeader
          domain="ERP"
          icon={<Landmark size={13} strokeWidth={2} />}
          title="Financials"
          subtitle="General ledger · receivables · payables — live"
          pills={[
            { label: 'Revenue', value: fmtMoney(kpis.revenue), tone: 'accent' },
            { label: 'Collected', value: `${collectedPct}%`, tone: 'success' },
            { label: 'Postings', value: postings.length, tone: 'info' },
          ]}
          right={
            <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
              <Radio size={13} strokeWidth={1.9} className="animate-pulse-soft text-success" />
              <span className="uppercase tracking-[0.12em]">GL stream</span>
            </div>
          }
        />

        {/* Hero — cash position band: AR vs AP dual gauges + net AnimatedNumber. */}
        <Panel
          className="animate-rise relative overflow-hidden p-4"
          style={{ animationDelay: '40ms' }}
          data-tour="finance.cashband"
        >
          <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
            {/* A/R gauge */}
            <div className="flex items-center justify-center gap-3">
              <Gauge
                value={cash.arShare * 100}
                max={100}
                size={104}
                stroke={10}
                color={AR_COLOR}
                valueText={<span className="text-base">{fmtMoney(cash.openAr)}</span>}
                label="Open A/R"
              />
            </div>

            {/* Net position centerpiece */}
            <div className="flex flex-col items-center justify-center px-2 text-center">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                <ArrowLeftRight size={12} strokeWidth={2} className="text-accent" />
                Net Cash Position
              </div>
              <AnimatedNumber
                value={cash.net}
                format={fmtMoney}
                className={cn(
                  'text-display mt-1 text-[34px] font-bold leading-none',
                  cash.net >= 0 ? 'text-success' : 'text-critical',
                )}
              />
              <div className="mt-1.5 text-[10.5px] text-ink-3">
                {cash.net >= 0 ? 'Receivables exceed payables' : 'Payables exceed receivables'}
              </div>
              <div className="mt-2 flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: AR_COLOR, boxShadow: `0 0 6px ${AR_COLOR}` }}
                  />
                  <span className="text-ink-3">A/R</span>
                  <span className="font-mono tabular-nums text-ink-1">{fmtMoney(cash.openAr)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: AP_COLOR, boxShadow: `0 0 6px ${AP_COLOR}` }}
                  />
                  <span className="text-ink-3">A/P</span>
                  <span className="font-mono tabular-nums text-ink-1">{fmtMoney(cash.openAp)}</span>
                </span>
              </div>
            </div>

            {/* A/P gauge */}
            <div className="flex items-center justify-center gap-3">
              <Gauge
                value={cash.apShare * 100}
                max={100}
                size={104}
                stroke={10}
                color={AP_COLOR}
                valueText={<span className="text-base">{fmtMoney(cash.openAp)}</span>}
                label="Open A/P"
              />
            </div>
          </div>

          {/* Live invoice / GL ticker fed by the bus. */}
          <div className="mt-3 border-t border-edge pt-2">
            <TickerTape
              source$={source$}
              accept={['erp.invoice.created', 'erp.gl.posting']}
              max={28}
            />
          </div>
        </Panel>

        {/* KPI row */}
        <div
          className="animate-rise grid grid-cols-2 gap-3 lg:grid-cols-4"
          style={{ animationDelay: '90ms' }}
        >
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
          <Panel className="flex items-center justify-center gap-3 p-3.5">
            <Gauge
              value={collectedPct}
              max={100}
              size={84}
              stroke={9}
              color={AR_COLOR}
              label="Collected"
            />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                Open A/P
              </div>
              <div
                className="metric-value mt-1 text-lg font-semibold leading-none text-ink-1"
                style={{ textShadow: '0 0 16px rgba(251,113,133,0.33)' }}
              >
                {fmtMoney(cash.openAp)}
              </div>
              <div className="mt-1.5 text-[10px] text-ink-3">
                <span className="font-mono tabular-nums text-ink-2">
                  {fmtMoney(kpis.revenue - cash.openAr)}
                </span>{' '}
                collected
              </div>
            </div>
          </Panel>
        </div>

        {/* GL trend — gradient ComposedChart (balance area + flow line) + top accounts. */}
        <div
          className="animate-rise grid min-h-[200px] grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
          style={{ animationDelay: '130ms' }}
        >
          <Panel className="flex min-h-0 flex-col overflow-hidden">
            <PanelHeader
              title="GL Balance Trend"
              subtitle="Cumulative ledger flow · live window"
              icon={<TrendingUp size={15} strokeWidth={1.9} />}
            />
            <div className="min-h-[180px] flex-1 px-2 pb-3 pt-3">
              {chronological.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp size={22} strokeWidth={1.6} />}
                  title="No postings to trend yet"
                  hint="The balance curve builds as GL postings stream in."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%" minHeight={170}>
                  <ComposedChart data={trend} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
                    <ChartDefs />
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="i" tickFormatter={(i: number) => `t${i + 1}`} stroke={CHART.axis} tick={CHART.tick} />
                    <YAxis width={48} stroke={CHART.axis} tick={CHART.tick} tickFormatter={fmtMoney} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      name="Balance"
                      stroke={chartSeries[0]}
                      strokeWidth={2}
                      fill="url(#fpArea0)"
                      filter="url(#fpGlow)"
                      isAnimationActive={false}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="flow"
                      name="Net flow"
                      stroke={chartSeries[2]}
                      strokeWidth={2}
                      dot={{ r: 2, fill: chartSeries[2], stroke: chartSeries[2] }}
                      activeDot={{ r: 4, fill: chartSeries[2], stroke: chartSeries[2] }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <Panel className="flex min-h-0 flex-col overflow-hidden">
            <PanelHeader
              title="Top Accounts"
              subtitle="By posted amount"
              icon={<Trophy size={15} strokeWidth={1.9} />}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {topAccounts.length === 0 ? (
                <EmptyState
                  icon={<Trophy size={22} strokeWidth={1.6} />}
                  title="No account activity yet"
                  hint="Ranked once postings accumulate on the ledger."
                />
              ) : (
                <RankBar
                  tone="auto"
                  items={topAccounts.map(a => ({
                    label: `${a.accountNo} · ${a.name}`,
                    value: Math.round(a.posted),
                    hint: undefined,
                  }))}
                  formatValue={fmtMoney}
                />
              )}
            </div>
          </Panel>
        </div>

        {/* Two-panel body */}
        <div
          className="animate-rise grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
          style={{ animationDelay: '170ms' }}
        >
          {/* Cost centers */}
          <Panel className="flex min-h-0 flex-col overflow-hidden">
            <PanelHeader
              title="Cost Centers"
              subtitle={`${costCenters.length} controlling objects`}
              icon={<Building2 size={15} strokeWidth={1.9} />}
              right={
                <span className="font-mono metric-value text-sm text-ink-1">
                  <AnimatedNumber value={costCenters.length} />
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
          <Panel className="flex min-h-0 flex-col overflow-hidden" data-tour="finance.ledger">
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
