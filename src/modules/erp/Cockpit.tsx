import { useEffect, useMemo, useReducer } from 'react'
import {
  Radio,
  ShoppingCart,
  ClipboardList,
  Factory,
  Boxes,
  PackageCheck,
  ReceiptText,
  ArrowRight,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Panel, PanelHeader } from '../../components/ui/Panel'
import { useBridgedLots } from '../../lib/useBridgedLots'
import { cn } from '../../lib/utils'
import type { ErpModuleProps } from './types'

/* ──────────────────────────────────────────────────────────────────────────
 * Document-Flow Cockpit — the hero.
 * Six fixed swim-lane columns, one per stage of the order-to-cash pipeline:
 *   Sales Order → Planned → Prod Order → Lot → Goods Receipt → Invoice
 * Each lane keeps a rolling COUNT (overview) and the most-recent ~6 docs as
 * glowing chips (motion). New chips rise; the freshest gets an accent glow.
 * Live state comes from eventBus.ofTopic subscriptions; the Lot lane also
 * reads in-flight bridged lots from the shared zustand store.
 * Deterministic: no randomness, no wall-clock in render.
 * ────────────────────────────────────────────────────────────────────────── */

const MAX_CHIPS = 6

/** One document chip in a lane: id + a glowing status dot. */
interface LaneChip {
  /** Monotonic insertion key — stable, deterministic React key + ordering. */
  seq: number
  id: string
  /** Optional secondary label (e.g. customer, material). */
  sub?: string
  tone: LaneTone
}

type LaneTone = 'accent' | 'accent-2' | 'accent-3' | 'info' | 'success' | 'warn'

interface LaneState {
  /** Rolling, ever-incrementing total seen by this lane. */
  count: number
  /** Newest-first, capped at MAX_CHIPS. */
  chips: LaneChip[]
}

type LaneKey = 'so' | 'planned' | 'prod' | 'lot' | 'gr' | 'invoice'

type LaneAction =
  | { kind: 'push'; lane: LaneKey; id: string; sub?: string; tone: LaneTone; bump?: number }
  /** MRP run reports a planned-order batch count without per-doc ids. */
  | { kind: 'bumpOnly'; lane: LaneKey; by: number }

type CockpitState = Record<LaneKey, LaneState>

/** Module-scoped monotonic counter for chip keys — deterministic ordering,
 *  never derived from Math.random or Date.now. */
let chipSeq = 0

function emptyLane(seed = 0): LaneState {
  return { count: seed, chips: [] }
}

function reducer(state: CockpitState, action: LaneAction): CockpitState {
  const lane = state[action.lane]
  if (action.kind === 'bumpOnly') {
    return { ...state, [action.lane]: { ...lane, count: lane.count + action.by } }
  }
  const chip: LaneChip = { seq: ++chipSeq, id: action.id, sub: action.sub, tone: action.tone }
  const chips = [chip, ...lane.chips].slice(0, MAX_CHIPS)
  return {
    ...state,
    [action.lane]: { count: lane.count + (action.bump ?? 1), chips },
  }
}

/* ── Lane visual config ─────────────────────────────────────────────────── */

interface LaneMeta {
  key: LaneKey
  title: string
  icon: ReactNode
  tone: LaneTone
}

const LANES: LaneMeta[] = [
  { key: 'so', title: 'Sales Order', icon: <ShoppingCart size={14} strokeWidth={1.9} />, tone: 'accent' },
  { key: 'planned', title: 'Planned', icon: <ClipboardList size={14} strokeWidth={1.9} />, tone: 'accent-3' },
  { key: 'prod', title: 'Prod Order', icon: <Factory size={14} strokeWidth={1.9} />, tone: 'info' },
  { key: 'lot', title: 'Lot', icon: <Boxes size={14} strokeWidth={1.9} />, tone: 'accent-2' },
  { key: 'gr', title: 'Goods Receipt', icon: <PackageCheck size={14} strokeWidth={1.9} />, tone: 'success' },
  { key: 'invoice', title: 'Invoice', icon: <ReceiptText size={14} strokeWidth={1.9} />, tone: 'warn' },
]

/** Tailwind text + glow per tone. Glow is a CSS box-shadow color string. */
const TONE: Record<LaneTone, { text: string; bg: string; glow: string }> = {
  accent: { text: 'text-accent', bg: 'bg-accent', glow: 'rgba(34, 211, 238, 0.6)' },
  'accent-2': { text: 'text-accent-2', bg: 'bg-accent-2', glow: 'rgba(45, 212, 191, 0.6)' },
  'accent-3': { text: 'text-accent-3', bg: 'bg-accent-3', glow: 'rgba(129, 140, 248, 0.6)' },
  info: { text: 'text-info', bg: 'bg-info', glow: 'rgba(96, 165, 250, 0.6)' },
  success: { text: 'text-success', bg: 'bg-success', glow: 'rgba(52, 211, 153, 0.6)' },
  warn: { text: 'text-warn', bg: 'bg-warn', glow: 'rgba(251, 191, 36, 0.6)' },
}

/* ── Subcomponents ──────────────────────────────────────────────────────── */

/** A single live document chip: glowing dot + mono id + optional sub-label.
 *  `fresh` = the newest chip in its lane → subtle accent glow ring. */
function DocChip({ chip, fresh }: { chip: LaneChip; fresh: boolean }) {
  const tone = TONE[chip.tone]
  return (
    <div
      className={cn(
        'animate-rise flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors',
        fresh
          ? 'border-edge-strong bg-surface-3/70'
          : 'border-edge bg-surface-2/50 hover:bg-surface-3/40',
      )}
      style={fresh ? { boxShadow: `0 0 0 1px ${tone.glow}, 0 0 14px -4px ${tone.glow}` } : undefined}
    >
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.bg)}
        style={{ boxShadow: `0 0 6px ${tone.glow}` }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[11px] leading-tight text-ink-1">{chip.id}</div>
        {chip.sub && <div className="truncate text-[10px] leading-tight text-ink-3">{chip.sub}</div>}
      </div>
      {fresh && (
        <span className={cn('shrink-0 text-[9px] font-semibold uppercase tracking-[0.14em]', tone.text)}>
          New
        </span>
      )}
    </div>
  )
}

/** Mini step/total progress for an in-flight lot in the Lot lane. */
function LotProgress({ step, total }: { step: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (step / total) * 100) : 0
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent"
          style={{ width: `${pct}%`, boxShadow: '0 0 6px rgba(45, 212, 191, 0.55)' }}
        />
      </div>
      <span className="shrink-0 font-mono text-[9px] tabular-nums text-ink-3">
        {step}/{total}
      </span>
    </div>
  )
}

/** Warm empty state shown inside a lane with no documents yet. */
function LaneEmpty({ tone, line }: { tone: LaneTone; line: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-3 py-8 text-center">
      <span
        className={cn('flex h-7 w-7 items-center justify-center rounded-full bg-surface-3/60', TONE[tone].text)}
      >
        <Radio size={14} strokeWidth={1.9} className="animate-pulse-soft" />
      </span>
      <p className="text-[11px] leading-snug text-ink-3">{line}</p>
    </div>
  )
}

const EMPTY_LINES: Record<LaneKey, string> = {
  so: 'Awaiting the first order — the pipeline is primed.',
  planned: 'No planning runs yet. MRP will light this up.',
  prod: 'Floor is quiet. Released orders will land here.',
  lot: 'No lots in flight. Bridged work appears live.',
  gr: 'Nothing received yet. Receipts post as lots finish.',
  invoice: 'No invoices billed. Revenue posts on completion.',
}

/* ── Lane column ────────────────────────────────────────────────────────── */

function Lane({
  meta,
  state,
  bridgedLots,
}: {
  meta: LaneMeta
  state: LaneState
  bridgedLots?: BridgedLotView[]
}) {
  const tone = TONE[meta.tone]
  const hasContent = state.chips.length > 0 || (bridgedLots?.length ?? 0) > 0

  return (
    <Panel className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <PanelHeader
        title={meta.title}
        icon={meta.icon}
        right={
          <span
            className={cn(
              'flex min-w-[2.25rem] items-center justify-center rounded-md border border-edge bg-surface-3/60 px-1.5 py-0.5 font-mono text-[11px] tabular-nums',
              tone.text,
            )}
            style={{ textShadow: `0 0 8px ${tone.glow}` }}
            title={`${state.count} total`}
          >
            {state.count}
          </span>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {!hasContent && <LaneEmpty tone={meta.tone} line={EMPTY_LINES[meta.key]} />}

        {/* Lot lane: in-flight bridged lots with mini progress, pinned above chips. */}
        {bridgedLots && bridgedLots.length > 0 && (
          <div className="mb-0.5 flex flex-col gap-1.5">
            {bridgedLots.map(lot => (
              <div
                key={lot.lotId}
                className="rounded-md border border-edge bg-surface-2/50 px-2 py-1.5"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      lot.status === 'complete' ? 'bg-ink-mute' : tone.bg,
                    )}
                    style={
                      lot.status === 'complete' ? undefined : { boxShadow: `0 0 6px ${tone.glow}` }
                    }
                    aria-hidden
                  />
                  <span className="truncate font-mono text-[11px] leading-tight text-ink-1">
                    {lot.lotId}
                  </span>
                </div>
                <LotProgress step={lot.currentStep} total={lot.totalSteps} />
              </div>
            ))}
          </div>
        )}

        {/* Rolling document chips, newest-first. The first one is the freshest. */}
        {state.chips.map((chip, i) => (
          <DocChip key={chip.seq} chip={chip} fresh={i === 0} />
        ))}
      </div>
    </Panel>
  )
}

/* ── Main module ────────────────────────────────────────────────────────── */

interface BridgedLotView {
  lotId: string
  currentStep: number
  totalSteps: number
  status: 'in-process' | 'complete'
}

export function CockpitModule({ erpData, eventBus }: ErpModuleProps) {
  // Seed lane counts from the static snapshot so the cockpit opens populated,
  // then increment live from the bus. Computed once (no randomness).
  const seed = useMemo<CockpitState>(
    () => ({
      so: emptyLane(erpData.salesOrders.length),
      planned: emptyLane(0),
      prod: emptyLane(erpData.productionOrders.length),
      lot: emptyLane(0),
      gr: emptyLane(0),
      invoice: emptyLane(0),
    }),
    [erpData.salesOrders.length, erpData.productionOrders.length],
  )

  const [state, dispatch] = useReducer(reducer, seed)

  // Live in-flight lots from the shared bridge store (Lot lane).
  const lots = useBridgedLots(s => s.lots)
  const lotViews = useMemo<BridgedLotView[]>(
    () =>
      lots
        .filter(l => l.status === 'in-process')
        .slice(-MAX_CHIPS)
        .reverse()
        .map(l => ({
          lotId: l.lotId,
          currentStep: l.currentStep,
          totalSteps: l.totalSteps,
          status: l.status,
        })),
    [lots],
  )

  useEffect(() => {
    const subs = [
      // Sales Order lane
      eventBus.ofTopic('erp.order.created').subscribe(e =>
        dispatch({ kind: 'push', lane: 'so', id: e.orderNo, sub: e.customerName, tone: 'accent' }),
      ),

      // Planned lane — per-document creations…
      eventBus.ofTopic('erp.plannedorder.created').subscribe(e =>
        dispatch({
          kind: 'push',
          lane: 'planned',
          id: e.plannedOrderNo,
          sub: e.materialNo,
          tone: 'accent-3',
        }),
      ),
      // …plus MRP-run batches that report a planned-order count (count bump only).
      eventBus.ofTopic('erp.mrp.run').subscribe(e => {
        if (e.plannedOrders > 0) {
          dispatch({ kind: 'bumpOnly', lane: 'planned', by: e.plannedOrders })
        }
      }),

      // Prod Order lane — releases create docs…
      eventBus.ofTopic('erp.prodorder.released').subscribe(e =>
        dispatch({
          kind: 'push',
          lane: 'prod',
          id: e.orderNo,
          sub: e.productCode,
          tone: 'info',
        }),
      ),
      // …status transitions refresh the chip (re-surface as motion, no count bump).
      eventBus.ofTopic('erp.prodorder.status').subscribe(e =>
        dispatch({
          kind: 'push',
          lane: 'prod',
          id: e.orderNo,
          sub: e.status,
          tone: 'info',
          bump: 0,
        }),
      ),

      // Lot lane — moves and completions surface as chips (store drives progress).
      eventBus.ofTopic('lot.move').subscribe(e =>
        dispatch({
          kind: 'push',
          lane: 'lot',
          id: e.lotId,
          sub: `step ${e.routeStep}`,
          tone: 'accent-2',
          bump: 0,
        }),
      ),
      eventBus.ofTopic('lot.complete').subscribe(e =>
        dispatch({
          kind: 'push',
          lane: 'lot',
          id: e.lotId,
          sub: 'complete',
          tone: 'accent-2',
        }),
      ),

      // Goods Receipt lane — only GR movements (ignore goods issues).
      eventBus.ofTopic('erp.goods.movement').subscribe(e => {
        if (e.movementType === 'GR') {
          dispatch({
            kind: 'push',
            lane: 'gr',
            id: e.materialNo,
            sub: `${e.qty} → ${e.storageLoc}`,
            tone: 'success',
          })
        }
      }),

      // Invoice lane
      eventBus.ofTopic('erp.invoice.created').subscribe(e =>
        dispatch({
          kind: 'push',
          lane: 'invoice',
          id: e.invoiceNo,
          sub: e.orderNo,
          tone: 'warn',
        }),
      ),
    ]

    return () => {
      for (const s of subs) s.unsubscribe()
    }
  }, [eventBus])

  const totalDocs = LANES.reduce((sum, l) => sum + state[l.key].count, 0)

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* Hero title bar */}
      <Panel>
        <PanelHeader
          title="Document Flow · Live"
          subtitle="Order-to-cash pipeline — counts are the overview, chips are the motion"
          icon={<Radio size={15} strokeWidth={1.9} className="animate-pulse-soft" />}
          right={
            <div className="flex items-center gap-4">
              {/* Stage rail: lane labels chained with arrows. */}
              <div className="hidden items-center gap-1.5 xl:flex">
                {LANES.map((l, i) => (
                  <div key={l.key} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'text-[10px] font-medium uppercase tracking-[0.1em]',
                        TONE[l.tone].text,
                      )}
                    >
                      {l.title}
                    </span>
                    {i < LANES.length - 1 && (
                      <ArrowRight size={11} strokeWidth={2} className="text-ink-mute" aria-hidden />
                    )}
                  </div>
                ))}
              </div>
              <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
                <span className="font-mono metric-value text-ink-1 tabular-nums">{totalDocs}</span>
                <span className="uppercase tracking-[0.12em]">docs</span>
              </span>
            </div>
          }
        />
      </Panel>

      {/* Six swim lanes — flex row, each lane flex-1 min-w-0 with internal scroll. */}
      <div className="flex min-h-0 flex-1 gap-3">
        {LANES.map(meta => (
          <Lane
            key={meta.key}
            meta={meta}
            state={state[meta.key]}
            bridgedLots={meta.key === 'lot' ? lotViews : undefined}
          />
        ))}
      </div>
    </div>
  )
}
