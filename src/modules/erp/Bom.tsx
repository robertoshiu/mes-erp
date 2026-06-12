import { useMemo, useState } from 'react'
import { ListTree, GitBranch, Package, Boxes, ChevronRight, Search, Coins } from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { Heatbar } from '../../components/ui/Heatbar'
import { DonutSpark, type DonutSegment } from '../../components/ui/DonutSpark'
import { chartSeries } from '../../lib/tokens'
import { cn } from '../../lib/utils'
import type { ErpModuleProps } from './types'
import type { Bom, Material } from '../../data/erp/types'
import { rollupBomCost, indexBomsByHeader, type ComponentCost } from './bomCost'

/** Compact USD formatter for the cost roll-up viz. */
const usd = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US')

/** Small type chip for a material (FERT / HALB / ROH), color-coded. */
function TypeChip({ type }: { type: Material['type'] }) {
  const map: Record<Material['type'], { label: string; cls: string }> = {
    FERT: { label: 'FERT', cls: 'bg-accent/15 text-accent border-accent/30' },
    HALB: { label: 'HALB', cls: 'bg-accent-3/15 text-accent-3 border-accent-3/30' },
    ROH: { label: 'ROH', cls: 'bg-surface-3 text-ink-3 border-edge' },
  }
  const s = map[type] ?? map.ROH
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[9px] font-semibold uppercase tracking-[0.1em] shrink-0',
        s.cls,
      )}
    >
      {s.label}
    </span>
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

export function BomModule({ erpData }: ErpModuleProps) {
  const { boms, materials } = erpData
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Fast lookup from materialNo -> Material for header type / component enrichment.
  const materialByNo = useMemo(() => {
    const m = new Map<string, Material>()
    for (const mat of materials) m.set(mat.materialNo, mat)
    return m
  }, [materials])

  const sortedBoms = useMemo(
    () => [...boms].sort((a, b) => a.headerMaterialNo.localeCompare(b.headerMaterialNo)),
    [boms],
  )

  const filteredBoms = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sortedBoms
    return sortedBoms.filter(
      b =>
        b.headerMaterialNo.toLowerCase().includes(q) ||
        b.headerDescription.toLowerCase().includes(q) ||
        b.bomId.toLowerCase().includes(q),
    )
  }, [sortedBoms, query])

  const selected: Bom | null = useMemo(
    () => (selectedId ? boms.find(b => b.bomId === selectedId) ?? null : null),
    [boms, selectedId],
  )

  const headerMaterial = selected ? materialByNo.get(selected.headerMaterialNo) ?? null : null

  // Header-material → Bom index drives the recursive cost roll-up (multi-level).
  const bomByHeader = useMemo(() => indexBomsByHeader(boms), [boms])

  // Roll up the selected structure's cost from its components (pure helper).
  const rollup = useMemo(
    () => (selected ? rollupBomCost(selected, bomByHeader, materialByNo) : null),
    [selected, bomByHeader, materialByNo],
  )
  const maxExtended = useMemo(
    () => (rollup ? rollup.components.reduce((m, c) => Math.max(m, c.extended), 1) : 1),
    [rollup],
  )
  // Cost-share donut segments (top components + an "other" bucket).
  const costDonut = useMemo(() => {
    if (!rollup || rollup.total <= 0) return []
    const sorted = [...rollup.components].sort((a, b) => b.extended - a.extended)
    const top = sorted.slice(0, 5)
    const otherVal = sorted.slice(5).reduce((s, c) => s + c.extended, 0)
    const segs: DonutSegment[] = top.map((c, i) => ({
      value: c.extended,
      color: chartSeries[i % chartSeries.length],
      label: c.materialNo,
    }))
    if (otherVal > 0) segs.push({ value: otherVal, color: '#4C5A74', label: 'Other' })
    return segs
  }, [rollup])

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      <div className="bg-bloom" aria-hidden />
      <div className="relative z-[1] px-4 pt-4 animate-rise" style={{ animationDelay: '0ms' }}>
        <ModuleHeader
          title="Bill of Materials"
          subtitle={`${boms.length.toLocaleString()} structures · multi-level component trees`}
          domain="ERP"
          icon={<ListTree size={13} strokeWidth={2} />}
          pills={[
            { label: 'Structures', value: <AnimatedNumber value={boms.length} />, tone: 'info' },
            ...(selected
              ? [
                  { label: 'Components', value: <AnimatedNumber value={selected.components.length} />, tone: 'accent' as const },
                  { label: 'Roll-Up', value: <AnimatedNumber value={rollup?.total ?? 0} format={usd} />, tone: 'success' as const },
                ]
              : []),
          ]}
        />
      </div>
    <div className="relative z-[1] flex flex-1 min-h-0">
      {/* Left: BOM list */}
      <div className="w-72 shrink-0 p-4 pr-2 min-w-0">
        <Panel className="flex flex-col h-full overflow-hidden">
          <PanelHeader
            title="Structures"
            subtitle={`${boms.length.toLocaleString()} BOMs`}
            icon={<ListTree size={15} strokeWidth={1.9} />}
          />

          {/* Filter */}
          <div className="px-3 py-2.5 border-b border-edge">
            <div className="relative flex items-center">
              <Search size={13} strokeWidth={1.9} className="absolute left-2.5 text-ink-3 pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter materials…"
                className="w-full bg-surface-2 border border-edge rounded-md pl-7 pr-2 py-1.5 text-xs text-ink-1 placeholder:text-ink-mute focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent transition-colors"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {filteredBoms.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <Search size={20} strokeWidth={1.6} className="text-ink-3" />
                <div className="text-xs text-ink-2">No structures match that filter</div>
                <div className="text-[11px] text-ink-3">Try a different material number.</div>
              </div>
            ) : (
              filteredBoms.map(bom => {
                const active = bom.bomId === selectedId
                const mat = materialByNo.get(bom.headerMaterialNo)
                return (
                  <button
                    key={bom.bomId}
                    onClick={() => setSelectedId(bom.bomId)}
                    className={cn(
                      'group relative w-full text-left flex items-center gap-2 pl-3 pr-2 py-2 border-b border-edge transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset',
                      active ? 'bg-accent/10' : 'hover:bg-surface-3/50',
                    )}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent"
                        style={{ boxShadow: '0 0 8px var(--accent-glow)' }}
                        aria-hidden
                      />
                    )}
                    <Package
                      size={14}
                      strokeWidth={1.9}
                      className={cn('shrink-0', active ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2')}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'font-mono text-[11px] truncate leading-tight',
                          active ? 'text-accent' : 'text-ink-1',
                        )}
                      >
                        {bom.headerMaterialNo}
                      </div>
                      <div className="text-[10px] text-ink-3 truncate mt-0.5">{bom.headerDescription}</div>
                    </div>
                    {mat && <TypeChip type={mat.type} />}
                  </button>
                )
              })
            )}
          </div>
        </Panel>
      </div>

      {/* Right: BOM tree */}
      <div className="flex-1 p-4 pl-2 min-w-0">
        <Panel className="flex flex-col h-full overflow-hidden" data-tour="bom.tree">
          {!selected ? (
            <>
              <PanelHeader title="Structure" icon={<GitBranch size={15} strokeWidth={1.9} />} />
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="relative flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-accent/10 blur-xl" aria-hidden />
                  <ListTree size={34} strokeWidth={1.4} className="text-accent relative text-glow-soft" />
                </div>
                <div className="text-sm text-ink-2 font-medium">Select a BOM</div>
                <div className="text-xs text-ink-3 max-w-[15rem]">
                  Pick a finished material on the left to explore its bill of materials and component tree.
                </div>
              </div>
            </>
          ) : (
            <>
              <PanelHeader
                title={selected.headerMaterialNo}
                subtitle={selected.headerDescription}
                icon={<GitBranch size={15} strokeWidth={1.9} />}
                right={
                  <span className="flex items-center gap-1.5 text-[10px] text-ink-3 uppercase tracking-[0.12em]">
                    <span className="font-mono metric-value text-ink-1 normal-case tracking-normal">
                      {selected.components.length}
                    </span>
                    components
                  </span>
                }
              />

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                {/* Header / parent node */}
                <div>
                  <SectionTitle icon={<GitBranch size={13} strokeWidth={1.9} />} text="Component Tree" />
                  <div className="mt-2.5 rounded-md border border-edge overflow-hidden">
                    {/* Header material row */}
                    <div className="relative flex items-center gap-2.5 py-2.5 px-3 bg-surface-2 border-b border-edge">
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent"
                        style={{ boxShadow: '0 0 8px var(--accent-glow)' }}
                        aria-hidden
                      />
                      <Boxes size={16} strokeWidth={1.9} className="text-accent shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[12px] text-ink-1 truncate leading-tight">
                          {selected.headerMaterialNo}
                        </div>
                        <div className="text-[11px] text-ink-3 truncate mt-0.5">{selected.headerDescription}</div>
                      </div>
                      {headerMaterial && <TypeChip type={headerMaterial.type} />}
                    </div>

                    {/* Component rows (indented, accent rails) */}
                    {selected.components.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
                        <Package size={18} strokeWidth={1.6} className="text-ink-3" />
                        <div className="text-xs text-ink-2">No components on this structure</div>
                        <div className="text-[11px] text-ink-3">This material is sourced directly.</div>
                      </div>
                    ) : (
                      selected.components.map((c, i) => {
                        const mat = materialByNo.get(c.materialNo)
                        const last = i === selected.components.length - 1
                        const cost: ComponentCost | undefined = rollup?.components[i]
                        return (
                          <div
                            key={`${c.materialNo}-${i}`}
                            className="group relative flex items-stretch gap-2 py-2 pl-3 pr-3 border-b border-edge last:border-b-0 hover:bg-surface-3/50 transition-colors"
                          >
                            {/* Tree rail: glowing vertical + elbow connector */}
                            <span className="relative shrink-0 w-6 self-stretch" aria-hidden>
                              <span
                                className={cn(
                                  'absolute left-2.5 top-0 w-px',
                                  last ? 'h-1/2' : 'h-full',
                                )}
                                style={{ background: 'linear-gradient(180deg, rgba(56,189,248,0.45), rgba(56,189,248,0.18))' }}
                              />
                              <span
                                className="absolute left-2.5 top-1/2 w-2.5 h-px"
                                style={{ background: 'rgba(56,189,248,0.4)' }}
                              />
                              <span
                                className="absolute left-[18px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent-2"
                                style={{ boxShadow: '0 0 5px rgba(56,189,248,0.7)' }}
                              />
                            </span>
                            <div className="min-w-0 flex-1 flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-ink-1 shrink-0">{c.materialNo}</span>
                                <span className="text-[11px] text-ink-2 truncate flex-1 min-w-0">{c.description}</span>
                                {mat && <TypeChip type={mat.type} />}
                                <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums text-ink-2 shrink-0">
                                  <ChevronRight
                                    size={11}
                                    strokeWidth={1.9}
                                    className="text-ink-mute opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-hidden
                                  />
                                  {c.qty}
                                  <span className="text-ink-3 uppercase text-[10px]">{c.uom}</span>
                                </span>
                              </div>
                              {/* Per-node cost roll-up Heatbar */}
                              {cost && cost.extended > 0 && (
                                <div className="flex items-center gap-2">
                                  <Heatbar value={cost.extended} max={maxExtended} tone="accent" className="flex-1" />
                                  <span className="font-mono tabular-nums text-[10px] text-ink-3 shrink-0 w-[64px] text-right">
                                    {usd(cost.extended)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Cost roll-up — recursive helper, component-cost donut + total */}
                {rollup && rollup.total > 0 && (
                  <div>
                    <SectionTitle icon={<Coins size={13} strokeWidth={1.9} />} text="Cost Roll-Up" />
                    <div className="mt-2.5 rounded-md border border-edge bg-surface-2/40 p-3 flex items-center gap-4">
                      <DonutSpark
                        segments={costDonut}
                        size={92}
                        centerValue={<span className="text-[11px]">{usd(rollup.total)}</span>}
                        centerLabel="total"
                      />
                      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                        {costDonut.map((seg, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <span
                              className="w-2 h-2 rounded-[2px] shrink-0"
                              style={{ background: seg.color, boxShadow: `0 0 6px ${seg.color}` }}
                              aria-hidden
                            />
                            <span className="font-mono text-ink-2 truncate flex-1 min-w-0">{seg.label}</span>
                            <span className="font-mono tabular-nums text-ink-1 shrink-0">{usd(seg.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* BOM meta */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs pt-1">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">BOM ID</div>
                    <div className="text-ink-1 font-mono truncate">{selected.bomId}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">Header Material</div>
                    <div className="text-ink-1 font-mono truncate">{selected.headerMaterialNo}</div>
                  </div>
                  {headerMaterial && (
                    <>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">Plant</div>
                        <div className="text-ink-1 truncate">{headerMaterial.plant}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">Base UoM</div>
                        <div className="text-ink-1 font-mono truncate">{headerMaterial.baseUoM}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
    </div>
  )
}
