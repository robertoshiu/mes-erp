import { useMemo, useState } from 'react'
import { Package, Layers, TrendingUp, GitBranch, Search } from 'lucide-react'
import { AreaChart, Area, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { DonutSpark } from '../../components/ui/DonutSpark'
import { Heatbar } from '../../components/ui/Heatbar'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { ChartDefs, ChartTooltip, CHART } from '../../lib/chartTheme'
import { useUiStore } from '../../lib/uiStore'
import { cn } from '../../lib/utils'
import { brand, sem } from '../../lib/tokens'
import type { ErpModuleProps } from './types'
import type { Material, MaterialType, Bom } from '../../data/erp/types'
import {
  materialTypeCounts,
  abcClassify,
  abcCounts,
  whereUsedCounts,
  whereUsedParents,
  costTrend,
  type AbcClass,
} from './erpViz'

/** Per-type visual treatment for the material-type chip + legend. */
const TYPE_META: Record<MaterialType, { label: string; chip: string; dot: string; text: string; color: string }> = {
  FERT: { label: 'FERT', chip: 'bg-accent/15 text-accent border-accent/30', dot: 'bg-accent', text: 'text-accent', color: brand.primary },
  HALB: { label: 'HALB', chip: 'bg-accent-3/15 text-accent-3 border-accent-3/30', dot: 'bg-accent-3', text: 'text-accent-3', color: brand.tertiary },
  ROH: { label: 'ROH', chip: 'bg-ink-3/15 text-ink-3 border-edge', dot: 'bg-ink-mute', text: 'text-ink-3', color: '#74849E' },
}

/** ABC value class → glow tone (A=high value = accent, B=warn, C=muted). */
const ABC_META: Record<AbcClass, { color: string; chip: string }> = {
  A: { color: brand.primary, chip: 'bg-accent/15 text-accent border-accent/40' },
  B: { color: sem.warn, chip: 'bg-warn/15 text-warn border-warn/35' },
  C: { color: '#74849E', chip: 'bg-ink-3/10 text-ink-3 border-edge' },
}

/** Small colored chip for the material type. */
function TypeChip({ type }: { type: MaterialType }) {
  const m = TYPE_META[type]
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[10px] font-semibold uppercase tracking-wide font-mono',
        m.chip,
      )}
    >
      {m.label}
    </span>
  )
}

/** ABC value-class chip with a tone-keyed glow ring. */
function AbcChip({ cls }: { cls: AbcClass }) {
  const m = ABC_META[cls]
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded-sm border text-[10px] font-bold font-mono',
        m.chip,
      )}
      style={{ boxShadow: `0 0 8px -2px ${m.color}` }}
      title={`ABC class ${cls}`}
    >
      {cls}
    </span>
  )
}

/** Format a per-unit standard cost as a fixed-width mono currency string. */
function fmtCost(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Label/value pair in the drill-in detail grid (mirrors Production's drill-in). */
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

/** Compact where-used / valuation stat tile for the drill-in. */
function StatTile({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-md border border-edge bg-surface-3/40 px-2.5 py-2 min-w-0">
      <div className="text-[9px] uppercase tracking-[0.14em] text-ink-3 truncate">{label}</div>
      <div className={cn('metric-value text-[15px] font-semibold mt-0.5 leading-none', accent ? 'text-accent' : 'text-ink-1')}>
        {value}
      </div>
    </div>
  )
}

export function MaterialsModule({ erpData }: ErpModuleProps) {
  const { materials, boms } = erpData
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return materials
    return materials.filter(
      m =>
        m.materialNo.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q),
    )
  }, [materials, query])

  // Stable per-header lookup so a FERT detail can pull its BOM components.
  const bomByMaterial = useMemo(() => {
    const m = new Map<string, Bom>()
    for (const b of boms) m.set(b.headerMaterialNo, b)
    return m
  }, [boms])

  const counts = useMemo(() => materialTypeCounts(materials), [materials])
  const abc = useMemo(() => abcClassify(materials), [materials])
  const abcDist = useMemo(() => abcCounts(materials), [materials])
  const whereUsed = useMemo(() => whereUsedCounts(boms), [boms])
  // Costliest material drives the std-cost Heatbar scale.
  const maxCost = useMemo(() => materials.reduce((m, r) => Math.max(m, r.standardCost), 1), [materials])

  const columns: Column<Material>[] = useMemo(() => [
    {
      key: 'materialNo', header: 'Material', width: 130, mono: true,
      render: r => r.materialNo,
      sortFn: (a, b) => a.materialNo.localeCompare(b.materialNo),
    },
    {
      key: 'type', header: 'Type', width: 74,
      render: r => <TypeChip type={r.type} />,
      sortFn: (a, b) => a.type.localeCompare(b.type),
    },
    {
      key: 'abc', header: 'ABC', width: 56,
      render: r => <AbcChip cls={abc.get(r.materialNo) ?? 'C'} />,
      sortFn: (a, b) => (abc.get(a.materialNo) ?? 'C').localeCompare(abc.get(b.materialNo) ?? 'C'),
    },
    {
      key: 'description', header: 'Description', width: 240, flex: true,
      render: r => r.description,
      sortFn: (a, b) => a.description.localeCompare(b.description),
    },
    {
      key: 'materialGroup', header: 'Group', width: 120,
      render: r => r.materialGroup,
      sortFn: (a, b) => a.materialGroup.localeCompare(b.materialGroup),
    },
    {
      key: 'baseUoM', header: 'UoM', width: 62, mono: true,
      render: r => r.baseUoM,
      sortFn: (a, b) => a.baseUoM.localeCompare(b.baseUoM),
    },
    {
      key: 'standardCost', header: 'Std Cost', width: 150, mono: true,
      render: r => (
        <div className="flex items-center gap-2 w-full">
          <span className="font-mono tabular-nums text-right w-[68px] shrink-0">{fmtCost(r.standardCost)}</span>
          <Heatbar value={r.standardCost} max={maxCost} tone="accent" className="flex-1" />
        </div>
      ),
      sortFn: (a, b) => a.standardCost - b.standardCost,
    },
  ], [abc, maxCost])

  // Header DonutSparks: material-type mix + ABC-class mix, from real data.
  const typeSegments = [
    { value: counts.FERT, color: TYPE_META.FERT.color, label: 'FERT' },
    { value: counts.HALB, color: TYPE_META.HALB.color, label: 'HALB' },
    { value: counts.ROH, color: TYPE_META.ROH.color, label: 'ROH' },
  ]
  const abcSegments = [
    { value: abcDist.A, color: ABC_META.A.color, label: 'Class A' },
    { value: abcDist.B, color: ABC_META.B.color, label: 'Class B' },
    { value: abcDist.C, color: ABC_META.C.color, label: 'Class C' },
  ]

  const headerRight = (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center">
        <DonutSpark segments={typeSegments} size={48} centerValue={materials.length} centerLabel="TYPE" />
      </div>
      <div className="flex flex-col items-center">
        <DonutSpark segments={abcSegments} size={48} centerValue={abcDist.A} centerLabel="A-CLASS" />
      </div>
      <div className="hidden lg:flex items-center gap-3 text-[10px]">
        {(['FERT', 'HALB', 'ROH'] as MaterialType[]).map(t => (
          <span key={t} className={cn('flex items-center gap-1.5', TYPE_META[t].text)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', TYPE_META[t].dot)} aria-hidden />
            {TYPE_META[t].label}
            <span className="font-mono tabular-nums text-ink-3">{counts[t]}</span>
          </span>
        ))}
      </div>
    </div>
  )

  const selectedRow =
    selectedEntity?.type === 'material'
      ? materials.find(m => m.materialNo === selectedEntity.id) ?? null
      : null

  const renderDetail = (row: Material) => {
    const bom = row.type === 'FERT' ? bomByMaterial.get(row.materialNo) : undefined
    const cls = abc.get(row.materialNo) ?? 'C'
    const usedIn = whereUsed.get(row.materialNo) ?? 0
    const parents = whereUsedParents(boms, row.materialNo)
    const trend = costTrend(row.materialNo, row.standardCost, 12)
    const trendData = trend.map((value, index) => ({ index, value }))
    const trendMin = Math.min(...trend)
    const trendMax = Math.max(...trend)
    const delta = trend[trend.length - 1] - trend[0]

    return (
      <div className="space-y-5 text-xs">
        <section>
          <SectionTitle icon={<Package size={13} strokeWidth={1.9} />} text="Basic Data" />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3">
            <DetailField label="Material" value={row.materialNo} mono />
            <DetailField label="Type" value={<TypeChip type={row.type} />} />
            <DetailField label="ABC Class" value={<AbcChip cls={cls} />} />
            <DetailField label="Material Group" value={row.materialGroup} />
            <DetailField label="Base UoM" value={row.baseUoM} mono />
            {row.productCode && <DetailField label="Product Code" value={row.productCode} mono />}
          </div>
        </section>

        <section>
          <SectionTitle icon={<TrendingUp size={13} strokeWidth={1.9} />} text="Std Cost · 12-Period Trend" />
          <div className="mt-2 rounded-md border border-edge bg-surface-3/30 px-2 pt-2 pb-1">
            <div className="flex items-center justify-between px-1.5 mb-1">
              <span className="metric-value text-[15px] font-semibold text-ink-1">
                <AnimatedNumber value={row.standardCost} format={fmtCost} />
              </span>
              <span
                className={cn('font-mono text-[10px] tabular-nums', delta >= 0 ? 'text-warn' : 'text-success')}
              >
                {delta >= 0 ? '▲' : '▼'} {fmtCost(Math.abs(delta))}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={56}>
              <AreaChart data={trendData} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
                <ChartDefs />
                <YAxis hide domain={[trendMin * 0.96, trendMax * 1.04]} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={CHART.series[0]}
                  strokeWidth={1.6}
                  fill="url(#fpArea0)"
                  filter="url(#fpGlow)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <SectionTitle icon={<GitBranch size={13} strokeWidth={1.9} />} text="Where Used" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <StatTile label="BOMs Using" value={<AnimatedNumber value={usedIn} />} accent={usedIn > 0} />
            <StatTile label="Std Cost" value={fmtCost(row.standardCost)} />
            <StatTile label="Lead Time" value={`${row.leadTimeDays}d`} />
          </div>
          {parents.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parents.map(p => (
                <span key={p} className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-surface-3 border border-edge text-[10px] font-mono text-accent">
                  {p}
                </span>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle icon={<Layers size={13} strokeWidth={1.9} />} text="Valuation" />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3">
            <DetailField label="Standard Cost" value={fmtCost(row.standardCost)} mono />
            <DetailField label="Valuation Class" value={row.valuationClass} mono />
            <DetailField label="Plant" value={row.plant} mono />
            <DetailField label="Lead Time" value={`${row.leadTimeDays} d`} mono />
          </div>
        </section>

        {row.type === 'FERT' && (
          <section>
            <SectionTitle icon={<Layers size={13} strokeWidth={1.9} />} text="Bill of Materials" />
            {bom && bom.components.length > 0 ? (
              <div className="mt-2 rounded-md border border-edge overflow-hidden">
                {bom.components.map((c, i) => (
                  <div
                    key={`${c.materialNo}-${i}`}
                    className="flex items-center gap-2.5 py-1.5 pl-3 pr-2.5 border-b border-edge last:border-b-0 hover:bg-surface-3/50 transition-colors"
                  >
                    <span className="font-mono tabular-nums text-[11px] text-accent shrink-0 w-24 truncate">{c.materialNo}</span>
                    <span className="flex-1 truncate text-ink-2">{c.description}</span>
                    <span className="text-ink-1 font-mono tabular-nums text-[11px] shrink-0">{c.qty}</span>
                    <span className="text-ink-3 font-mono text-[10px] shrink-0 w-9 text-right">{c.uom}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-ink-3">No BOM defined for this finished good yet.</p>
            )}
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="bg-bloom" aria-hidden />
      <div className="relative z-[1] flex flex-col flex-1 min-h-0 p-4 gap-3">
        <ModuleHeader
          domain="ERP"
          icon={<Package size={13} strokeWidth={2} />}
          title="Materials"
          subtitle={`${materials.length.toLocaleString()} materials · ${counts.FERT} FERT / ${counts.HALB} HALB / ${counts.ROH} ROH`}
          pills={[
            { label: 'A-Class', value: <AnimatedNumber value={abcDist.A} />, tone: 'accent' },
            { label: 'B-Class', value: <AnimatedNumber value={abcDist.B} />, tone: 'warn' },
            { label: 'BOMs', value: <AnimatedNumber value={boms.length} />, tone: 'info' },
          ]}
          right={headerRight}
        />

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 animate-rise" style={{ animationDelay: '120ms' }}>
            <Panel className="flex flex-col h-full overflow-hidden" data-tour="materials.table">
              <PanelHeader
                title="Material Master"
                subtitle="Std cost intensity · ABC value class"
                icon={<Package size={15} strokeWidth={1.9} />}
                right={
                  <div className="relative flex items-center w-56 max-w-[14rem]">
                    <Search size={13} strokeWidth={1.9} className="absolute left-2.5 text-ink-3 pointer-events-none" />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Filter materials..."
                      className="w-full bg-surface-2 border border-edge rounded-md pl-7 pr-2 py-1.5 text-xs text-ink-1 placeholder:text-ink-mute focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent transition-colors"
                    />
                  </div>
                }
              />
              <div className="flex-1 min-h-0">
                <DenseDataTable
                  data={filtered}
                  columns={columns}
                  rowKey={r => r.materialNo}
                  onRowClick={row => selectEntity({ type: 'material', id: row.materialNo })}
                  selectedKey={selectedEntity?.id ?? null}
                />
              </div>
            </Panel>
          </div>

          {selectedRow && (
            <DrillInPanel title={selectedRow.materialNo} subtitle={selectedRow.description}>
              {renderDetail(selectedRow)}
            </DrillInPanel>
          )}
        </div>
      </div>
    </div>
  )
}
