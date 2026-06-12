import { useMemo, useState } from 'react'
import { Contact, Users, Globe, Trophy, Search } from 'lucide-react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { DonutSpark } from '../../components/ui/DonutSpark'
import { RankBar } from '../../components/ui/RankBar'
import { SparkRing } from '../../components/ui/SparkRing'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import { cn } from '../../lib/utils'
import { brand, sem } from '../../lib/tokens'
import type { BusinessPartner } from '../../data/erp/types'
import type { ErpModuleProps } from './types'
import { roleSplit, regionCounts, compositeScore, topPartners } from './erpViz'

type Role = BusinessPartner['role']

const ROLE_META: Record<Role, { label: string; cls: string; color: string }> = {
  customer: { label: 'Customer', cls: 'bg-accent-2/15 text-accent-2 border-accent-2/30', color: brand.secondary },
  vendor: { label: 'Vendor', cls: 'bg-warn/15 text-warn border-warn/30', color: sem.warn },
  both: { label: 'Both', cls: 'bg-accent-3/15 text-accent-3 border-accent-3/30', color: brand.tertiary },
}

/** Pill chip for a partner role — colour-keyed to the locked palette. */
function RoleChip({ role }: { role: Role }) {
  const m = ROLE_META[role]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm border',
        m.cls,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden />
      {m.label}
    </span>
  )
}

/** Label/value pair in the drill-in detail grid (mirrors Production's DetailField). */
function DetailField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-0.5">{label}</div>
      <div className={cn('text-ink-1 truncate', mono && 'font-mono')}>{value}</div>
    </div>
  )
}

/** Uppercase tracked rail-section heading with a small accent icon. */
function RailTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
      <span className="text-accent flex items-center">{icon}</span>
      {text}
    </div>
  )
}

const USD = (n: number) => `$${n.toLocaleString('en-US')}`
/** Composite-score tone: ≥75 success, ≥50 warn, else critical (mirrors auto-tone). */
function scoreTone(score: number): 'success' | 'warn' | 'critical' {
  if (score >= 75) return 'success'
  if (score >= 50) return 'warn'
  return 'critical'
}

export function BusinessPartnersModule({ erpData }: ErpModuleProps) {
  const partners = erpData.businessPartners
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return partners
    return partners.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.bpNo.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q),
    )
  }, [partners, query])

  const split = useMemo(() => roleSplit(partners), [partners])
  const regions = useMemo(() => regionCounts(partners).slice(0, 6), [partners])
  const top5 = useMemo(() => topPartners(partners, 5), [partners])

  const scoreByBp = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of partners) m.set(p.bpNo, compositeScore(p))
    return m
  }, [partners])

  const columns: Column<BusinessPartner>[] = useMemo(
    () => [
      {
        key: 'bpNo', header: 'BP No.', width: 110, mono: true,
        render: r => r.bpNo,
        sortFn: (a, b) => a.bpNo.localeCompare(b.bpNo),
      },
      {
        key: 'role', header: 'Role', width: 110,
        render: r => <RoleChip role={r.role} />,
        sortFn: (a, b) => a.role.localeCompare(b.role),
      },
      {
        key: 'name', header: 'Name', width: 220, flex: true,
        render: r => r.name,
        sortFn: (a, b) => a.name.localeCompare(b.name),
      },
      {
        key: 'rating', header: 'Rating', width: 96,
        render: r => {
          const score = scoreByBp.get(r.bpNo) ?? 0
          return (
            <span className="flex items-center gap-1.5">
              <SparkRing value={score} max={100} size={18} tone={scoreTone(score)} />
              <span className="font-mono tabular-nums text-[11px] text-ink-2">{score}</span>
            </span>
          )
        },
        sortFn: (a, b) => (scoreByBp.get(a.bpNo) ?? 0) - (scoreByBp.get(b.bpNo) ?? 0),
      },
      {
        key: 'country', header: 'Country', width: 84, mono: true,
        render: r => r.country,
        sortFn: (a, b) => a.country.localeCompare(b.country),
      },
      {
        key: 'paymentTerms', header: 'Terms', width: 84, mono: true,
        render: r => r.paymentTerms,
        sortFn: (a, b) => a.paymentTerms.localeCompare(b.paymentTerms),
      },
      {
        key: 'incoterms', header: 'Incoterms', width: 90, mono: true,
        render: r => r.incoterms,
        sortFn: (a, b) => a.incoterms.localeCompare(b.incoterms),
      },
    ],
    [scoreByBp],
  )

  const splitSegments = [
    { value: split.customer, color: ROLE_META.customer.color, label: 'Customers' },
    { value: split.vendor, color: ROLE_META.vendor.color, label: 'Vendors' },
    { value: split.both, color: ROLE_META.both.color, label: 'Both' },
  ]

  const selectedRow =
    selectedEntity?.type === 'businessPartner'
      ? partners.find(p => p.bpNo === selectedEntity.id) ?? null
      : null

  const renderDetail = (r: BusinessPartner) => {
    const score = scoreByBp.get(r.bpNo) ?? 0
    return (
      <div className="space-y-5 text-xs">
        <section>
          <div className="flex items-center gap-3 rounded-md border border-edge bg-surface-3/40 px-3 py-2.5">
            <SparkRing value={score} max={100} size={44} tone={scoreTone(score)} />
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink-3">Composite Score</div>
              <div className="metric-value text-[20px] font-semibold text-ink-1 leading-none mt-0.5">
                <AnimatedNumber value={score} />
                <span className="text-[11px] text-ink-3 ml-1">/100</span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <div className="col-span-2">
            <DetailField label="Name" value={r.name} />
          </div>
          <DetailField label="Role" value={<RoleChip role={r.role} />} />
          <DetailField label="Country" value={r.country} mono />
          <DetailField label="Payment Terms" value={r.paymentTerms} mono />
          <DetailField label="Incoterms" value={r.incoterms} mono />
          <div className="col-span-2">
            <DetailField label="Credit Limit" value={<span className="tabular-nums">{USD(r.creditLimit)}</span>} mono />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="bg-bloom" aria-hidden />
      <div className="relative z-[1] flex flex-col flex-1 min-h-0 p-4 gap-3">
        <ModuleHeader
          domain="ERP"
          icon={<Contact size={13} strokeWidth={2} />}
          title="Business Partners"
          subtitle={`${partners.length.toLocaleString()} customers & vendors`}
          pills={[
            { label: 'Customers', value: <AnimatedNumber value={split.customer} />, tone: 'info' },
            { label: 'Vendors', value: <AnimatedNumber value={split.vendor} />, tone: 'warn' },
            { label: 'Both', value: <AnimatedNumber value={split.both} />, tone: 'accent' },
          ]}
        />

        <div className="flex flex-1 min-h-0 gap-3">
          <div className="flex-1 min-w-0 animate-rise" style={{ animationDelay: '120ms' }}>
            <Panel className="flex flex-col h-full overflow-hidden" data-tour="business-partners.table">
              <PanelHeader
                title="Partner Master"
                subtitle="Composite rating · terms"
                icon={<Contact size={15} strokeWidth={1.9} />}
                right={
                  <div className="relative flex items-center w-56 max-w-[14rem]">
                    <Search size={13} strokeWidth={1.9} className="absolute left-2.5 text-ink-3 pointer-events-none" />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Filter partners..."
                      className="w-full bg-surface-2 border border-edge rounded-md pl-7 pr-2 py-1.5 text-xs text-ink-1 placeholder:text-ink-mute focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent transition-colors"
                    />
                  </div>
                }
              />
              <div className="flex-1 min-h-0">
                <DenseDataTable
                  data={filtered}
                  columns={columns}
                  rowKey={r => r.bpNo}
                  onRowClick={row => selectEntity({ type: 'businessPartner', id: row.bpNo })}
                  selectedKey={selectedEntity?.id ?? null}
                />
              </div>
            </Panel>
          </div>

          {/* Intelligence rail */}
          {!selectedRow && (
            <aside
              className="hidden xl:flex w-[300px] shrink-0 flex-col gap-3 animate-rise overflow-y-auto"
              style={{ animationDelay: '200ms' }}
            >
              <Panel className="p-3">
                <RailTitle icon={<Users size={13} strokeWidth={1.9} />} text="Customer / Vendor Split" />
                <div className="mt-3 flex items-center gap-4">
                  <DonutSpark segments={splitSegments} size={84} centerValue={partners.length} centerLabel="TOTAL" />
                  <div className="flex flex-col gap-1.5 text-[11px] min-w-0">
                    {splitSegments.map(s => (
                      <span key={s.label} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} aria-hidden />
                        <span className="text-ink-2 truncate">{s.label}</span>
                        <span className="font-mono tabular-nums text-ink-1 ml-auto">{s.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel className="p-3">
                <RailTitle icon={<Globe size={13} strokeWidth={1.9} />} text="By Region" />
                <div className="mt-3">
                  <RankBar items={regions} tone="accent" />
                </div>
              </Panel>

              <Panel className="p-3">
                <RailTitle icon={<Trophy size={13} strokeWidth={1.9} />} text="Top Partners" />
                <div className="mt-3 flex flex-col gap-2">
                  {top5.map((p, i) => (
                    <button
                      key={p.bpNo}
                      type="button"
                      onClick={() => selectEntity({ type: 'businessPartner', id: p.bpNo })}
                      className="group flex items-center gap-2.5 rounded-md px-1.5 py-1 text-left hover:bg-surface-3/50 transition-colors"
                    >
                      <span className="font-mono text-[10px] text-ink-mute w-4 shrink-0">{i + 1}</span>
                      <SparkRing value={p.score} max={100} size={26} tone={scoreTone(p.score)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-ink-2 truncate group-hover:text-ink-1 transition-colors">{p.label}</div>
                        <div className="text-[9px] text-ink-3 font-mono">{USD(p.value)}</div>
                      </div>
                      <span className="metric-value text-[12px] font-semibold text-ink-1 shrink-0">{p.score}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            </aside>
          )}

          {selectedRow && (
            <DrillInPanel title={selectedRow.name} subtitle={`${selectedRow.bpNo} · ${ROLE_META[selectedRow.role].label}`}>
              {renderDetail(selectedRow)}
            </DrillInPanel>
          )}
        </div>
      </div>
    </div>
  )
}
