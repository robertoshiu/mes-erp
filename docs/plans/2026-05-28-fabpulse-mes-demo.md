# FabPulse MES Demo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a purely-static, high-fidelity MES demo for semiconductor fabs with 7 interactive modules, a 3-minute scripted event loop, and cross-module event correlation — all in a single `dist/` bundle under 800KB gzipped.

**Architecture:** Vite + React + TypeScript SPA. RxJS event bus drives all live data (no backend). Zustand handles UI state only (active route, modals, selected entity). A seedable PRNG generates deterministic synthetic fab data. A timeline engine plays 6 scripted dramatic beats over a 180s loop while background events fire continuously at ~1/s. Pre-roll warmup ensures no module is empty on first paint.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui (Radix), RxJS, zustand, GSAP (Fab Floor SVG), Recharts (SPC + KPI sparklines), @tanstack/react-virtual, framer-motion (page transitions), Vitest

**Design doc:** `gstack-design-20260528-202732.md` (root of repo)

**Skills to consult during build:**
- `@secs-gem-open-source-docs` — SECS S2F41/S6F11 message structure
- `@lithography-expert` — process step names, CD/CDU/Overlay for SPC
- `@manufacturing-expert` — OEE/Yield/MTBF/MTTR formulas
- `@ui-ux-pro-max` — shadcn component patterns

---

## Day 1 — Foundation (Tasks 1-9)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (via Vite scaffold)
- Create: `tsconfig.json`, `vite.config.ts`
- Create: `index.html`

**Step 1: Scaffold Vite + React + TypeScript project**

```bash
cd /mnt/e/repo/mes-erp
npm create vite@latest . -- --template react-ts
```

If the directory is non-empty, accept overwrite for config files only.

**Step 2: Install production dependencies**

```bash
npm install react react-dom rxjs zustand gsap recharts framer-motion @tanstack/react-virtual clsx tailwind-merge date-fns
```

**Step 3: Install dev dependencies**

```bash
npm install -D tailwindcss @tailwindcss/vite postcss autoprefixer vitest @testing-library/react jsdom
```

**Step 4: Initialize Tailwind**

Create `src/index.css`:
```css
@import "tailwindcss";
```

Add Tailwind Vite plugin in `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
```

**Step 5: Initialize shadcn**

```bash
npx shadcn@latest init -d
```

When prompted: style=default, base-color=slate, css-variables=yes.

Then install the specific components needed:
```bash
npx shadcn@latest add button input sheet dialog table scroll-area badge separator
```

**Step 6: Configure design tokens in Tailwind**

Create `src/lib/tokens.ts`:
```typescript
// Design tokens from the design doc — single source of truth.
// These are consumed by both Tailwind config and runtime code.

export const brand = {
  primary: '#0066B3',
  secondary: '#4A90A4',
} as const

export const neutral = {
  bg: '#F3F6F9',
  surface: '#FFFFFF',
  border: '#D1D5DB',
  divider: '#E5E7EB',
  ink1: '#1A1A1A',
  ink2: '#303030',
  ink3: '#6B7280',
  inkMute: '#9CA3AF',
} as const

export const e10Colors = {
  PROD: '#16A34A',
  STBY: '#F59E0B',
  SDT: '#DC2626',
  UDT: '#B91C1C',
  NSC: '#6B7280',
  ENG: '#2563EB',
  OUT: '#1F2937',
} as const

export const e10Symbols: Record<string, string> = {
  PROD: '\u25CF', // ●
  STBY: '\u25D0', // ◐
  SDT: '\u25A0',  // ■
  UDT: '\u25A8',  // ▨
  NSC: '\u25CB',  // ○
  ENG: '\u25C6',  // ◆
  OUT: '\u2715',  // ✕
}

export const sem = {
  info: '#2563EB',
  warn: '#B45309',
  critical: '#DC2626',
  success: '#16A34A',
} as const

export const motion = {
  instant: 80,
  quick: 180,
  smooth: 300,
  deliberate: 600,
} as const

export const easing = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  decel: 'cubic-bezier(0, 0, 0.2, 1)',
} as const
```

**Step 7: Verify scaffold works**

```bash
npm run dev
```

Expected: Vite dev server starts, browser shows default React page at localhost:5173.

**Step 8: Commit**

```bash
git init
echo "node_modules/\ndist/\n.DS_Store\n*.local" > .gitignore
git add -A
git commit -m "feat: scaffold Vite + React + TS project with all dependencies

Tailwind, shadcn/ui, RxJS, zustand, GSAP, Recharts, framer-motion,
@tanstack/react-virtual, vitest configured. Design tokens defined.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: PRNG + Hash (TDD)

**Files:**
- Create: `src/data/prng.ts`
- Create: `src/data/prng.test.ts`

**Step 1: Write failing tests for PRNG + hash**

Create `src/data/prng.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { mulberry32, cyrb53 } from './prng'

describe('mulberry32', () => {
  it('returns deterministic sequence for a given seed', () => {
    const rng1 = mulberry32(42)
    const rng2 = mulberry32(42)
    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())
    expect(seq1).toEqual(seq2)
  })

  it('returns values in [0, 1)', () => {
    const rng = mulberry32(12345)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(1)
    const rng2 = mulberry32(2)
    const seq1 = Array.from({ length: 5 }, () => rng1())
    const seq2 = Array.from({ length: 5 }, () => rng2())
    expect(seq1).not.toEqual(seq2)
  })

  it('has reasonable distribution (chi-squared sanity)', () => {
    const rng = mulberry32(999)
    const buckets = new Array(10).fill(0)
    const N = 10000
    for (let i = 0; i < N; i++) {
      buckets[Math.floor(rng() * 10)]++
    }
    // Each bucket should be ~1000. Allow 20% deviation.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(800)
      expect(count).toBeLessThan(1200)
    }
  })

  it('helper: pick returns element from array deterministically', () => {
    // Test after pick is implemented
  })
})

describe('cyrb53', () => {
  it('returns consistent hash for same input', () => {
    expect(cyrb53('hello')).toBe(cyrb53('hello'))
  })

  it('returns different hash for different inputs', () => {
    expect(cyrb53('hello')).not.toBe(cyrb53('world'))
  })

  it('accepts an optional seed', () => {
    expect(cyrb53('hello', 0)).not.toBe(cyrb53('hello', 1))
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/data/prng.test.ts
```

Expected: FAIL — `Cannot find module './prng'`

**Step 3: Implement PRNG + hash**

Create `src/data/prng.ts`:
```typescript
/**
 * Mulberry32 — fast, seedable 32-bit PRNG.
 * Returns a function that produces floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * cyrb53 — fast 53-bit string hash.
 * Good enough for deterministic data generation.
 */
export function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/**
 * Create a seeded PRNG from two numeric seeds (e.g., loopIndex + timestamp).
 * Combines via cyrb53 to avoid seed correlation.
 */
export function seededRng(a: number, b: number): () => number {
  return mulberry32(cyrb53(`${a}:${b}`))
}

/**
 * Pick a random element from an array using the next PRNG value.
 */
export function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

/**
 * Pick N unique random elements from an array.
 */
export function pickN<T>(arr: readonly T[], n: number, rng: () => number): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, n)
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/data/prng.test.ts
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/data/prng.ts src/data/prng.test.ts
git commit -m "feat: add mulberry32 PRNG + cyrb53 hash with tests

Deterministic seedable PRNG for synthetic data generation.
All 5 tests pass: determinism, range, distribution, hash consistency.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Event Types

**Files:**
- Create: `src/lib/events.ts`

**Step 1: Write the full Event discriminated union**

Create `src/lib/events.ts`:
```typescript
export type E10State = 'PROD' | 'STBY' | 'SDT' | 'UDT' | 'NSC' | 'ENG' | 'OUT'

export type LotMoveEvent = {
  topic: 'lot.move'
  t: number
  lotId: string
  fromToolId: string
  toToolId: string
  routeStep: number
  operatorId: string
  productCode: string
  customerName: string
}

export type EquipStateEvent = {
  topic: 'equip.state'
  t: number
  toolId: string
  fromState: E10State
  toState: E10State
  reasonCode?: string
}

export type SpcViolationEvent = {
  topic: 'spc.violation'
  t: number
  measurementId: string
  ruleNumber: 1 | 2 | 4
  severity: 'info' | 'warn' | 'critical'
  controlPoint: {
    value: number
    ucl: number
    lcl: number
    centerline: number
  }
}

export type AlarmRaisedEvent = {
  topic: 'alarm.raised'
  t: number
  alarmId: string
  source: string
  severity: 'minor' | 'major' | 'critical'
  message: string
  sopRef?: string
  ackOperatorId?: string
}

export type RecipeLoadEvent = {
  topic: 'recipe.load'
  t: number
  toolId: string
  recipeId: string
  recipeVersion: string
  approverOperatorId: string
}

export type KpiTickEvent = {
  topic: 'kpi.tick'
  t: number
  oee: number
  yieldPct: number
  mtbfMinutes: number
  mttrMinutes: number
  wipTurn: number
  throughputUnitsPerHour: number
  cycleTimeMinutes: number
}

export type ShiftBoundaryEvent = {
  topic: 'shift.boundary'
  t: number
  kind: 'start' | 'handover' | 'loop-restart'
  shiftCode: 'A' | 'B' | 'C'
}

export type MesEvent =
  | LotMoveEvent
  | EquipStateEvent
  | SpcViolationEvent
  | AlarmRaisedEvent
  | RecipeLoadEvent
  | KpiTickEvent
  | ShiftBoundaryEvent

export type EventTopic = MesEvent['topic']
```

**Step 2: Commit**

```bash
git add src/lib/events.ts
git commit -m "feat: add MesEvent discriminated union type definitions

7 event topics: lot.move, equip.state, spc.violation, alarm.raised,
recipe.load, kpi.tick, shift.boundary. Operator traceability fields
included on lot.move, alarm.raised, recipe.load.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Clock

**Files:**
- Create: `src/lib/clock.ts`

**Step 1: Implement the demo clock**

Create `src/lib/clock.ts`:
```typescript
const LOOP_DURATION = 180 // seconds

export interface Clock {
  /** Seconds elapsed since boot */
  now(): number
  /** Seconds within current loop (0..180) */
  loopT(): number
  /** Monotonic loop counter (0, 1, 2, ...) */
  loopIndex(): number
  /** Start the clock. Call once after pre-roll. */
  start(): void
  /** Register callback for loop boundary crossings */
  onLoopBoundary(cb: (newLoopIndex: number) => void): () => void
  /** Clean up listeners */
  destroy(): void
}

export function createClock(): Clock {
  let t0 = 0
  let currentLoopIndex = 0
  let started = false
  const loopListeners: Set<(idx: number) => void> = new Set()

  function now(): number {
    if (!started) return 0
    return (performance.now() - t0) / 1000
  }

  function loopT(): number {
    return now() % LOOP_DURATION
  }

  function loopIndex(): number {
    return Math.floor(now() / LOOP_DURATION)
  }

  function checkLoopBoundary() {
    const idx = loopIndex()
    if (idx !== currentLoopIndex) {
      currentLoopIndex = idx
      loopListeners.forEach(cb => cb(idx))
    }
  }

  let intervalId: ReturnType<typeof setInterval> | null = null

  function handleVisibility() {
    if (document.hidden || !started) return
    checkLoopBoundary()
  }

  function start() {
    t0 = performance.now()
    currentLoopIndex = 0
    started = true
    // Check for loop boundaries every 100ms
    intervalId = setInterval(checkLoopBoundary, 100)
    document.addEventListener('visibilitychange', handleVisibility)
  }

  function onLoopBoundary(cb: (newLoopIndex: number) => void): () => void {
    loopListeners.add(cb)
    return () => loopListeners.delete(cb)
  }

  function destroy() {
    if (intervalId) clearInterval(intervalId)
    document.removeEventListener('visibilitychange', handleVisibility)
    loopListeners.clear()
  }

  return { now, loopT, loopIndex, start, onLoopBoundary, destroy }
}

export const LOOP_DURATION_S = LOOP_DURATION
```

**Step 2: Commit**

```bash
git add src/lib/clock.ts
git commit -m "feat: add demo clock with loop boundary detection

Wall-clock based via performance.now(). 100ms tick for loop boundary
check. Visibility change handler for tab-return recovery.
LOOP_DURATION = 180s.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Event Bus with Ring Buffer (TDD)

**Files:**
- Create: `src/lib/eventBus.ts`
- Create: `src/lib/eventBus.test.ts`

**Step 1: Write failing tests for event bus**

Create `src/lib/eventBus.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from './eventBus'
import type { MesEvent, LotMoveEvent, EquipStateEvent } from './events'

function makeLotMove(t: number, lotId = 'LOT-001'): LotMoveEvent {
  return {
    topic: 'lot.move', t, lotId,
    fromToolId: 'EQP-LITHO-01', toToolId: 'EQP-ETCH-01',
    routeStep: 1, operatorId: 'OP-001',
    productCode: 'DEV-7NM-A1', customerName: 'ACME-SEMI',
  }
}

function makeEquipState(t: number, toolId = 'EQP-LITHO-01'): EquipStateEvent {
  return {
    topic: 'equip.state', t, toolId,
    fromState: 'PROD', toState: 'STBY',
  }
}

describe('eventBus', () => {
  it('publishes events to topic-filtered subscribers', () => {
    const bus = createEventBus()
    const received: LotMoveEvent[] = []
    const sub = bus.ofTopic('lot.move').subscribe(e => received.push(e))

    bus.publish(makeLotMove(0))
    bus.publish(makeEquipState(1))
    bus.publish(makeLotMove(2))

    expect(received).toHaveLength(2)
    expect(received[0].t).toBe(0)
    expect(received[1].t).toBe(2)
    sub.unsubscribe()
    bus.destroy()
  })

  it('ring buffer holds last N events', () => {
    const bus = createEventBus(5) // small buffer for test
    for (let i = 0; i < 10; i++) {
      bus.publish(makeLotMove(i))
    }
    const buffer = bus.getBuffer()
    expect(buffer).toHaveLength(5)
    expect(buffer[0].t).toBe(5)
    expect(buffer[4].t).toBe(9)
    bus.destroy()
  })

  it('ring buffer emits via observable', () => {
    const bus = createEventBus(3)
    const snapshots: MesEvent[][] = []
    const sub = bus.ringBuffer$().subscribe(buf => snapshots.push([...buf]))

    bus.publish(makeLotMove(0))
    bus.publish(makeLotMove(1))
    bus.publish(makeLotMove(2))
    bus.publish(makeLotMove(3))

    // Each publish triggers a new snapshot
    expect(snapshots.length).toBe(4)
    // Last snapshot should have events 1,2,3 (buffer size 3)
    expect(snapshots[3]).toHaveLength(3)
    expect(snapshots[3][0].t).toBe(1)
    sub.unsubscribe()
    bus.destroy()
  })

  it('all$ emits all events regardless of topic', () => {
    const bus = createEventBus()
    const received: MesEvent[] = []
    const sub = bus.all$().subscribe(e => received.push(e))

    bus.publish(makeLotMove(0))
    bus.publish(makeEquipState(1))

    expect(received).toHaveLength(2)
    sub.unsubscribe()
    bus.destroy()
  })

  it('publishBatch emits multiple events synchronously', () => {
    const bus = createEventBus()
    const received: MesEvent[] = []
    const sub = bus.all$().subscribe(e => received.push(e))

    bus.publishBatch([makeLotMove(0), makeLotMove(1), makeEquipState(2)])

    expect(received).toHaveLength(3)
    sub.unsubscribe()
    bus.destroy()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/eventBus.test.ts
```

Expected: FAIL — `Cannot find module './eventBus'`

**Step 3: Implement event bus**

Create `src/lib/eventBus.ts`:
```typescript
import { Subject, Observable, map } from 'rxjs'
import { filter } from 'rxjs/operators'
import type { MesEvent, EventTopic } from './events'

// Extract the event type for a given topic
type EventOfTopic<T extends EventTopic> = Extract<MesEvent, { topic: T }>

export interface EventBus {
  publish(event: MesEvent): void
  publishBatch(events: MesEvent[]): void
  all$(): Observable<MesEvent>
  ofTopic<T extends EventTopic>(topic: T): Observable<EventOfTopic<T>>
  ringBuffer$(): Observable<MesEvent[]>
  getBuffer(): MesEvent[]
  destroy(): void
}

export function createEventBus(bufferSize = 1000): EventBus {
  const subject = new Subject<MesEvent>()

  // Ring buffer: fixed-size array + write pointer
  const ring: (MesEvent | null)[] = new Array(bufferSize).fill(null)
  let writePtr = 0
  let count = 0

  // Ring buffer observable — emits current buffer snapshot on each event
  const ringSubject = new Subject<MesEvent[]>()

  function getBuffer(): MesEvent[] {
    if (count === 0) return []
    const size = Math.min(count, bufferSize)
    const result: MesEvent[] = new Array(size)
    const startIdx = count <= bufferSize ? 0 : writePtr
    for (let i = 0; i < size; i++) {
      result[i] = ring[(startIdx + i) % bufferSize] as MesEvent
    }
    return result
  }

  function addToRing(event: MesEvent) {
    ring[writePtr] = event
    writePtr = (writePtr + 1) % bufferSize
    count++
  }

  function publish(event: MesEvent) {
    addToRing(event)
    subject.next(event)
    ringSubject.next(getBuffer())
  }

  function publishBatch(events: MesEvent[]) {
    for (const event of events) {
      addToRing(event)
      subject.next(event)
    }
    ringSubject.next(getBuffer())
  }

  function all$(): Observable<MesEvent> {
    return subject.asObservable()
  }

  function ofTopic<T extends EventTopic>(topic: T): Observable<EventOfTopic<T>> {
    return subject.pipe(
      filter((e): e is EventOfTopic<T> => e.topic === topic)
    )
  }

  function destroy() {
    subject.complete()
    ringSubject.complete()
  }

  return {
    publish,
    publishBatch,
    all$,
    ofTopic,
    ringBuffer$: () => ringSubject.asObservable(),
    getBuffer,
    destroy,
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/eventBus.test.ts
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/eventBus.ts src/lib/eventBus.test.ts
git commit -m "feat: add RxJS event bus with ring buffer

scan()-based ring buffer (fixed array + write pointer) for zero GC
pressure. Topic-filtered observables via ofTopic<T>(). publishBatch()
for pre-roll warmup. 5 tests passing.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: UI Store

**Files:**
- Create: `src/lib/uiStore.ts`

**Step 1: Implement zustand store**

Create `src/lib/uiStore.ts`:
```typescript
import { create } from 'zustand'

export type ModuleRoute =
  | 'fab-floor'
  | 'production'
  | 'equipment'
  | 'spc'
  | 'recipe'
  | 'alarms'
  | 'kpi'

export interface SelectedEntity {
  type: 'lot' | 'equipment' | 'alarm' | 'recipe'
  id: string
}

export interface BadgeCounts {
  alarms: number
  production: number
  equipmentDown: number
}

interface UiState {
  activeRoute: ModuleRoute
  setRoute: (route: ModuleRoute) => void

  selectedEntity: SelectedEntity | null
  selectEntity: (entity: SelectedEntity | null) => void

  badges: BadgeCounts
  updateBadges: (badges: Partial<BadgeCounts>) => void

  currentShift: 'A' | 'B' | 'C'
  setShift: (shift: 'A' | 'B' | 'C') => void
}

export const useUiStore = create<UiState>((set) => ({
  activeRoute: 'fab-floor',
  setRoute: (route) => set({ activeRoute: route, selectedEntity: null }),

  selectedEntity: null,
  selectEntity: (entity) => set({ selectedEntity: entity }),

  badges: { alarms: 0, production: 0, equipmentDown: 0 },
  updateBadges: (badges) =>
    set((state) => ({ badges: { ...state.badges, ...badges } })),

  currentShift: 'A',
  setShift: (shift) => set({ currentShift: shift }),
}))
```

**Step 2: Commit**

```bash
git add src/lib/uiStore.ts
git commit -m "feat: add zustand UI store

Manages activeRoute, selectedEntity (drill-in), badge counts,
current shift. Not used for events (those flow via RxJS eventBus).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Master Data Generators

**Files:**
- Create: `src/data/master/equipment.ts`
- Create: `src/data/master/recipes.ts`
- Create: `src/data/master/routes.ts`
- Create: `src/data/master/operators.ts`
- Create: `src/data/master/products.ts`
- Create: `src/data/master/customers.ts`
- Create: `src/data/master/index.ts`
- Create: `src/data/lots.ts`

**Step 1: Create equipment master data**

Create `src/data/master/equipment.ts`:
```typescript
import { mulberry32, pick } from '../prng'
import type { E10State } from '../../lib/events'

export interface Equipment {
  toolId: string
  toolName: string
  bay: string
  bayIndex: number
  slotInBay: number
  toolType: string
  vendor: string
  model: string
  initialState: E10State
  x: number
  y: number
}

const BAYS = ['BAY-01', 'BAY-02', 'BAY-03', 'BAY-04', 'BAY-05', 'BAY-06', 'BAY-07', 'BAY-08']
const TOOL_TYPES = ['LITHO', 'ETCH', 'CMP', 'CVD', 'PVD', 'DIFF', 'IMPL', 'INSP']
const VENDORS = ['ASML', 'LAM', 'AMAT', 'TEL', 'KLA', 'SCREEN']
const MODELS: Record<string, string[]> = {
  LITHO: ['NXT:2000i', 'NXT:1980Di', 'TWINSCAN 1970Ci'],
  ETCH: ['Kiyo FX', 'Versys 2300', 'Exelan HPT'],
  CMP: ['Reflexion LK', 'FREX 300S', 'Mirra Mesa'],
  CVD: ['Producer SE', 'TELINDY Plus', 'iSpeed'],
  PVD: ['Endura Clover', 'Inova XT', 'ENTRON EX'],
  DIFF: ['ADVANCE 400', 'ALPHA 303iH', 'VF-3000'],
  IMPL: ['VIISta 900XP', 'Purion H', 'MC3 Ultra'],
  INSP: ['Puma 9975Bi', 'INS-3300', 'Surfscan SP7'],
}

export function generateEquipment(seed = 42): Equipment[] {
  const rng = mulberry32(seed)
  const equipment: Equipment[] = []

  // 8 bays, ~6 tools each = ~48 tools
  const toolsPerBay = [7, 6, 6, 6, 7, 6, 6, 6] // = 50

  for (let bayIdx = 0; bayIdx < BAYS.length; bayIdx++) {
    const bay = BAYS[bayIdx]
    const toolType = TOOL_TYPES[bayIdx]
    const vendor = pick(VENDORS, rng)
    const models = MODELS[toolType]

    for (let slot = 0; slot < toolsPerBay[bayIdx]; slot++) {
      const toolNum = String(slot + 1).padStart(2, '0')
      const toolId = `EQP-${toolType}-${toolNum}`

      // Deterministic initial E10 state distribution
      // ~70% PROD, ~15% STBY, ~5% SDT, ~5% ENG, ~5% other
      const r = rng()
      let initialState: E10State = 'PROD'
      if (r > 0.95) initialState = 'NSC'
      else if (r > 0.90) initialState = 'ENG'
      else if (r > 0.85) initialState = 'SDT'
      else if (r > 0.70) initialState = 'STBY'

      equipment.push({
        toolId,
        toolName: `${toolType}-${toolNum} ${pick(models, rng)}`,
        bay,
        bayIndex: bayIdx,
        slotInBay: slot,
        toolType,
        vendor,
        model: pick(models, rng),
        initialState,
        // Grid layout: bays in 2 rows of 4, tools in columns within bay
        x: (bayIdx % 4) * 250 + slot * 35 + 20,
        y: Math.floor(bayIdx / 4) * 300 + 60,
      })
    }
  }

  return equipment
}
```

**Step 2: Create remaining master data generators**

Create `src/data/master/products.ts`:
```typescript
import { mulberry32 } from '../prng'

export interface Product {
  productCode: string
  productName: string
  technology: string
  layers: number
}

const TECHS = ['7nm', '5nm', '3nm', '14nm', '10nm', '28nm']
const PRODUCT_NAMES = [
  'Phoenix', 'Orion', 'Vega', 'Altair', 'Sirius',
  'Polaris', 'Deneb', 'Rigel', 'Capella', 'Antares',
  'Arcturus', 'Betelgeuse',
]

export function generateProducts(seed = 100): Product[] {
  const rng = mulberry32(seed)
  return PRODUCT_NAMES.map((name, i) => ({
    productCode: `DEV-${TECHS[i % TECHS.length].toUpperCase()}-${String.fromCharCode(65 + i)}${Math.floor(rng() * 9) + 1}`,
    productName: name,
    technology: TECHS[i % TECHS.length],
    layers: Math.floor(rng() * 40) + 20,
  }))
}
```

Create `src/data/master/customers.ts`:
```typescript
export interface Customer {
  customerId: string
  customerName: string
  displayName: string
}

const CUSTOMERS: [string, string][] = [
  ['CUST-001', 'GlobalTech Semiconductor'],
  ['CUST-002', 'Pacific Micro Systems'],
  ['CUST-003', 'NovaStar Electronics'],
  ['CUST-004', 'Quantum Chip Corp'],
  ['CUST-005', 'SilkRoad IC Design'],
  ['CUST-006', 'DragonBridge Foundry'],
  ['CUST-007', 'AuroraWave Tech'],
  ['CUST-008', 'SummitPeak Digital'],
]

export function generateCustomers(): Customer[] {
  return CUSTOMERS.map(([id, name]) => ({
    customerId: id,
    customerName: name,
    displayName: name.split(' ')[0],
  }))
}
```

Create `src/data/master/operators.ts`:
```typescript
import { mulberry32, pick } from '../prng'

export interface Operator {
  operatorId: string
  name: string
  nameZh: string
  shift: 'A' | 'B' | 'C'
  role: 'operator' | 'engineer' | 'supervisor'
  certifiedTools: string[]
}

// Mix of EN + zh-TW names per design doc i18n decision
const SURNAMES_ZH = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊']
const GIVEN_ZH = ['志明', '淑芬', '建宏', '美玲', '家豪', '雅婷', '俊傑', '怡君', '宗翰', '佩君']
const SURNAMES_EN = ['Chen', 'Lin', 'Huang', 'Chang', 'Lee', 'Wang', 'Wu', 'Liu', 'Tsai', 'Yang']
const GIVEN_EN = ['James', 'Sarah', 'Kevin', 'Grace', 'Alex', 'Amy', 'Brian', 'Iris', 'David', 'Peggy']
const SHIFTS: ('A' | 'B' | 'C')[] = ['A', 'B', 'C']
const ROLES: ('operator' | 'engineer' | 'supervisor')[] = ['operator', 'operator', 'operator', 'engineer', 'supervisor']

export function generateOperators(seed = 200, toolIds: string[] = []): Operator[] {
  const rng = mulberry32(seed)
  const operators: Operator[] = []

  for (let i = 0; i < 80; i++) {
    const sIdx = i % SURNAMES_ZH.length
    const gIdx = Math.floor(rng() * GIVEN_ZH.length)
    const shift = SHIFTS[i % 3]
    const role = pick(ROLES, rng)
    const numCerts = role === 'engineer' ? 8 : role === 'supervisor' ? 12 : 4
    const certs: string[] = []
    for (let c = 0; c < numCerts && c < toolIds.length; c++) {
      const idx = Math.floor(rng() * toolIds.length)
      if (!certs.includes(toolIds[idx])) certs.push(toolIds[idx])
    }

    operators.push({
      operatorId: `OP-${String(i + 1).padStart(3, '0')}`,
      name: `${SURNAMES_EN[sIdx]} ${GIVEN_EN[gIdx]}`,
      nameZh: `${SURNAMES_ZH[sIdx]}${GIVEN_ZH[gIdx]}`,
      shift,
      role,
      certifiedTools: certs,
    })
  }

  return operators
}
```

Create `src/data/master/routes.ts`:
```typescript
export interface ProcessStep {
  stepIndex: number
  stepName: string
  toolType: string
  nominalMinutes: number
}

export interface ProcessRoute {
  routeId: string
  routeName: string
  technology: string
  steps: ProcessStep[]
}

// Consult @lithography-expert for realistic step names
export function generateRoutes(): ProcessRoute[] {
  return [
    {
      routeId: 'RT-7NM-STD',
      routeName: '7nm Standard Logic',
      technology: '7nm',
      steps: [
        { stepIndex: 0, stepName: 'Gate Oxide Growth', toolType: 'DIFF', nominalMinutes: 45 },
        { stepIndex: 1, stepName: 'EUV Litho - Metal 1', toolType: 'LITHO', nominalMinutes: 30 },
        { stepIndex: 2, stepName: 'Metal 1 Etch', toolType: 'ETCH', nominalMinutes: 20 },
        { stepIndex: 3, stepName: 'ILD CMP', toolType: 'CMP', nominalMinutes: 15 },
        { stepIndex: 4, stepName: 'Cu Barrier PVD', toolType: 'PVD', nominalMinutes: 10 },
        { stepIndex: 5, stepName: 'Cu Seed CVD', toolType: 'CVD', nominalMinutes: 12 },
        { stepIndex: 6, stepName: 'Post-CMP Inspection', toolType: 'INSP', nominalMinutes: 8 },
        { stepIndex: 7, stepName: 'Ion Implant - S/D', toolType: 'IMPL', nominalMinutes: 25 },
      ],
    },
    {
      routeId: 'RT-5NM-HP',
      routeName: '5nm High Performance',
      technology: '5nm',
      steps: [
        { stepIndex: 0, stepName: 'HKMG Deposition', toolType: 'CVD', nominalMinutes: 35 },
        { stepIndex: 1, stepName: 'FinFET Litho', toolType: 'LITHO', nominalMinutes: 40 },
        { stepIndex: 2, stepName: 'Si Fin Etch', toolType: 'ETCH', nominalMinutes: 25 },
        { stepIndex: 3, stepName: 'Spacer CMP', toolType: 'CMP', nominalMinutes: 18 },
        { stepIndex: 4, stepName: 'S/D Epi Growth', toolType: 'DIFF', nominalMinutes: 50 },
        { stepIndex: 5, stepName: 'Contact PVD', toolType: 'PVD', nominalMinutes: 12 },
        { stepIndex: 6, stepName: 'CD Measurement', toolType: 'INSP', nominalMinutes: 10 },
      ],
    },
    {
      routeId: 'RT-3NM-GAA',
      routeName: '3nm GAA Nanosheet',
      technology: '3nm',
      steps: [
        { stepIndex: 0, stepName: 'Nanosheet Stack CVD', toolType: 'CVD', nominalMinutes: 55 },
        { stepIndex: 1, stepName: 'EUV Multi-Pattern Litho', toolType: 'LITHO', nominalMinutes: 45 },
        { stepIndex: 2, stepName: 'Channel Release Etch', toolType: 'ETCH', nominalMinutes: 30 },
        { stepIndex: 3, stepName: 'Inner Spacer CMP', toolType: 'CMP', nominalMinutes: 20 },
        { stepIndex: 4, stepName: 'Work Function Metal ALD', toolType: 'PVD', nominalMinutes: 15 },
        { stepIndex: 5, stepName: 'Overlay Measurement', toolType: 'INSP', nominalMinutes: 12 },
      ],
    },
    {
      routeId: 'RT-14NM-IOT',
      routeName: '14nm IoT Low Power',
      technology: '14nm',
      steps: [
        { stepIndex: 0, stepName: 'Thick Oxide Growth', toolType: 'DIFF', nominalMinutes: 30 },
        { stepIndex: 1, stepName: 'i-line Litho', toolType: 'LITHO', nominalMinutes: 15 },
        { stepIndex: 2, stepName: 'Poly Etch', toolType: 'ETCH', nominalMinutes: 12 },
        { stepIndex: 3, stepName: 'STI CMP', toolType: 'CMP', nominalMinutes: 10 },
        { stepIndex: 4, stepName: 'BF2 Implant', toolType: 'IMPL', nominalMinutes: 20 },
      ],
    },
    {
      routeId: 'RT-28NM-RF',
      routeName: '28nm RF/Analog',
      technology: '28nm',
      steps: [
        { stepIndex: 0, stepName: 'MIM Cap CVD', toolType: 'CVD', nominalMinutes: 25 },
        { stepIndex: 1, stepName: 'Inductor Litho', toolType: 'LITHO', nominalMinutes: 20 },
        { stepIndex: 2, stepName: 'Deep Trench Etch', toolType: 'ETCH', nominalMinutes: 18 },
        { stepIndex: 3, stepName: 'Thick Cu CMP', toolType: 'CMP', nominalMinutes: 22 },
        { stepIndex: 4, stepName: 'Parametric Test', toolType: 'INSP', nominalMinutes: 15 },
      ],
    },
  ]
}
```

Create `src/data/master/recipes.ts`:
```typescript
import { mulberry32, pick } from '../prng'

export interface RecipeVersion {
  version: string
  author: string
  changeNote: string
  timestamp: string
}

export interface Recipe {
  recipeId: string
  recipeName: string
  toolType: string
  currentVersion: string
  versions: RecipeVersion[]
  parameters: Record<string, string>
}

const CHANGE_NOTES = [
  'Optimized gas flow ratio for improved uniformity',
  'Reduced chamber pressure per SPC feedback',
  'Updated endpoint detection algorithm',
  'Adjusted RF power for target CD',
  'Revised thermal ramp profile',
  'Corrected dose map for edge die',
  'Tightened overlay budget per spec rev',
  'Modified CMP slurry flow rate',
]

export function generateRecipes(seed = 300): Recipe[] {
  const rng = mulberry32(seed)
  const recipes: Recipe[] = []
  const TOOL_TYPES = ['LITHO', 'ETCH', 'CMP', 'CVD', 'PVD', 'DIFF', 'IMPL', 'INSP']

  for (let i = 0; i < 30; i++) {
    const toolType = TOOL_TYPES[i % 8]
    const recipeNum = String(Math.floor(i / 8) + 1).padStart(2, '0')
    const recipeId = `RCP-${toolType}-${recipeNum}`
    const major = Math.floor(rng() * 3) + 1
    const minor = Math.floor(rng() * 5)
    const patch = Math.floor(rng() * 10)

    const versions: RecipeVersion[] = []
    for (let v = 0; v <= minor; v++) {
      versions.push({
        version: `v${major}.${v}.${Math.floor(rng() * 10)}`,
        author: `OP-${String(Math.floor(rng() * 20) + 1).padStart(3, '0')}`,
        changeNote: pick(CHANGE_NOTES, rng),
        timestamp: `2026-05-${String(Math.floor(rng() * 28) + 1).padStart(2, '0')}T${String(Math.floor(rng() * 24)).padStart(2, '0')}:00:00`,
      })
    }

    recipes.push({
      recipeId,
      recipeName: `${toolType}_PROC_${recipeNum}`,
      toolType,
      currentVersion: `v${major}.${minor}.${patch}`,
      versions,
      parameters: generateRecipeParams(toolType, rng),
    })
  }

  return recipes
}

function generateRecipeParams(toolType: string, rng: () => number): Record<string, string> {
  const params: Record<string, string> = {}
  switch (toolType) {
    case 'LITHO':
      params['Exposure Dose (mJ/cm2)'] = (20 + rng() * 30).toFixed(1)
      params['Focus Offset (nm)'] = (rng() * 100 - 50).toFixed(0)
      params['Alignment Mode'] = rng() > 0.5 ? 'ATHENA' : 'SMASH'
      break
    case 'ETCH':
      params['RF Power (W)'] = String(Math.floor(200 + rng() * 800))
      params['Chamber Pressure (mTorr)'] = String(Math.floor(5 + rng() * 50))
      params['Gas Flow CF4 (sccm)'] = String(Math.floor(10 + rng() * 90))
      break
    case 'CMP':
      params['Platen Speed (rpm)'] = String(Math.floor(60 + rng() * 60))
      params['Down Force (psi)'] = (2 + rng() * 4).toFixed(1)
      params['Slurry Flow (ml/min)'] = String(Math.floor(150 + rng() * 200))
      break
    default:
      params['Temperature (C)'] = String(Math.floor(200 + rng() * 800))
      params['Time (sec)'] = String(Math.floor(30 + rng() * 300))
      params['Pressure (Torr)'] = (rng() * 10).toFixed(2)
  }
  return params
}
```

Create `src/data/lots.ts`:
```typescript
import { mulberry32, pick } from './prng'
import type { Product } from './master/products'
import type { Customer } from './master/customers'
import type { ProcessRoute } from './master/routes'

export interface Lot {
  lotId: string
  productCode: string
  customerName: string
  routeId: string
  currentStep: number
  totalSteps: number
  waferCount: number
  priority: 'normal' | 'hot' | 'super-hot'
  status: 'in-process' | 'hold' | 'complete' | 'queued'
  currentToolId: string | null
  startTime: string
  parentLotId: string | null
  childLotIds: string[]
}

export function generateLots(
  seed: number,
  count: number,
  products: Product[],
  customers: Customer[],
  routes: ProcessRoute[],
  toolIds: string[],
): Lot[] {
  const rng = mulberry32(seed)
  const lots: Lot[] = []
  const weekNum = '22' // Week 22 of 2026

  for (let i = 0; i < count; i++) {
    const product = pick(products, rng)
    const customer = pick(customers, rng)
    const route = pick(routes, rng)
    const currentStep = Math.floor(rng() * route.steps.length)
    const lotNum = String(i + 1).padStart(5, '0')

    // ~5% hot lots, ~1% super-hot
    const prioRoll = rng()
    const priority: Lot['priority'] =
      prioRoll > 0.99 ? 'super-hot' : prioRoll > 0.94 ? 'hot' : 'normal'

    // ~70% in-process, ~10% hold, ~10% complete, ~10% queued
    const statusRoll = rng()
    const status: Lot['status'] =
      statusRoll > 0.90 ? 'queued'
      : statusRoll > 0.80 ? 'complete'
      : statusRoll > 0.70 ? 'hold'
      : 'in-process'

    const currentToolId = status === 'in-process'
      ? pick(toolIds.filter(id => id.includes(route.steps[currentStep].toolType)), rng) || pick(toolIds, rng)
      : null

    // ~10% of lots have a parent (split lots)
    const parentLotId = i > 10 && rng() > 0.9
      ? lots[Math.floor(rng() * Math.min(i, lots.length))].lotId
      : null

    lots.push({
      lotId: `LOT-26${weekNum}W-${lotNum}`,
      productCode: product.productCode,
      customerName: customer.displayName,
      routeId: route.routeId,
      currentStep,
      totalSteps: route.steps.length,
      waferCount: [25, 25, 25, 13, 12][Math.floor(rng() * 5)],
      priority,
      status,
      currentToolId,
      startTime: `2026-05-${String(Math.floor(rng() * 28) + 1).padStart(2, '0')}T${String(Math.floor(rng() * 24)).padStart(2, '0')}:00:00`,
      parentLotId,
      childLotIds: [],
    })
  }

  // Wire up child references for split lots
  for (const lot of lots) {
    if (lot.parentLotId) {
      const parent = lots.find(l => l.lotId === lot.parentLotId)
      if (parent) parent.childLotIds.push(lot.lotId)
    }
  }

  return lots
}
```

Create `src/data/master/index.ts`:
```typescript
import { generateEquipment } from './equipment'
import { generateProducts } from './products'
import { generateCustomers } from './customers'
import { generateOperators } from './operators'
import { generateRoutes } from './routes'
import { generateRecipes } from './recipes'
import { generateLots } from '../lots'

export function generateMasterData() {
  const equipment = generateEquipment(42)
  const products = generateProducts(100)
  const customers = generateCustomers()
  const routes = generateRoutes()
  const toolIds = equipment.map(e => e.toolId)
  const operators = generateOperators(200, toolIds)
  const recipes = generateRecipes(300)
  const lots = generateLots(400, 200, products, customers, routes, toolIds)

  return { equipment, products, customers, routes, operators, recipes, lots }
}

export type MasterData = ReturnType<typeof generateMasterData>
```

**Step 3: Commit**

```bash
git add src/data/master/ src/data/lots.ts
git commit -m "feat: add deterministic master data generators

50 equipment across 8 bays, 12 products, 8 customers, 80 operators,
5 process routes, 30 recipes, 200 lots with genealogy. All seeded
via mulberry32 for deterministic output. Realistic fab nomenclature.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Shared Components

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Create: `src/components/TopBar.tsx`
- Create: `src/components/DrillInPanel.tsx`
- Create: `src/components/EventStream.tsx`
- Create: `src/components/DenseDataTable.tsx`

**Step 1: ErrorBoundary**

Create `src/components/ErrorBoundary.tsx`:
```tsx
import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  moduleName: string
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.moduleName}]`, error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 bg-[#F3F6F9]">
          <div className="font-mono text-sm text-[#6B7280]">
            {this.props.moduleName}: Event subscription error
          </div>
          <button
            onClick={this.handleReload}
            className="px-3 py-1.5 text-sm border border-[#D1D5DB] rounded-sm hover:bg-[#F3F6F9]"
          >
            Reload module
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

**Step 2: TopBar**

Create `src/components/TopBar.tsx`:
```tsx
import { useEffect, useState } from 'react'
import type { Clock } from '../lib/clock'
import { useUiStore } from '../lib/uiStore'

interface TopBarProps {
  clock: Clock
  operatorCount: number
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

export function TopBar({ clock, operatorCount }: TopBarProps) {
  const [loopT, setLoopT] = useState(0)
  const currentShift = useUiStore(s => s.currentShift)

  useEffect(() => {
    const id = setInterval(() => setLoopT(clock.loopT()), 1000)
    return () => clearInterval(id)
  }, [clock])

  const progressPct = (loopT / 180) * 100

  const shiftColor = currentShift === 'A' ? '#16A34A' : currentShift === 'B' ? '#2563EB' : '#F59E0B'

  return (
    <header className="relative h-12 flex items-center justify-between px-4 bg-white border-b border-[#D1D5DB]">
      {/* Left zone */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-[#1A1A1A]">FAB-01 PROD</span>
        <span className="text-xs font-mono text-[#6B7280] border border-[#D1D5DB] px-1.5 py-0.5 rounded-sm">
          FabPulse v1.0
        </span>
      </div>

      {/* Center zone */}
      <div className="font-mono text-base text-[#1A1A1A]">
        {formatTime(loopT)}
      </div>

      {/* Right zone */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs border border-[#D1D5DB] px-1.5 py-0.5 rounded-sm">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: shiftColor }} />
          SHIFT-{currentShift}
        </span>
        <span className="text-xs text-[#6B7280]">
          {operatorCount} on shift
        </span>
      </div>

      {/* Loop progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-[#0066B3] transition-all duration-1000 ease-linear"
        style={{ width: `${progressPct}%` }}
      />
    </header>
  )
}
```

**Step 3: DrillInPanel**

Create `src/components/DrillInPanel.tsx`:
```tsx
import { useEffect } from 'react'
import { useUiStore } from '../lib/uiStore'

interface DrillInPanelProps {
  children: React.ReactNode
  title: string
}

export function DrillInPanel({ children, title }: DrillInPanelProps) {
  const selectedEntity = useUiStore(s => s.selectedEntity)
  const selectEntity = useUiStore(s => s.selectEntity)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') selectEntity(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectEntity])

  if (!selectedEntity) return null

  return (
    <aside className="fixed top-12 right-0 bottom-0 w-[400px] bg-white border-l border-[#D1D5DB] shadow-lg z-50 overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
        <h2 className="text-sm font-semibold text-[#1A1A1A]">{title}</h2>
        <button
          onClick={() => selectEntity(null)}
          className="w-6 h-6 flex items-center justify-center text-[#6B7280] hover:text-[#1A1A1A] text-lg"
          aria-label="Close panel"
        >
          &times;
        </button>
      </div>
      <div className="p-4">{children}</div>
    </aside>
  )
}
```

**Step 4: EventStream**

Create `src/components/EventStream.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import type { Observable } from 'rxjs'
import type { MesEvent } from '../lib/events'
import { format } from 'date-fns'

interface EventStreamProps {
  events$: Observable<MesEvent>
  maxVisible?: number
}

interface DisplayEvent {
  event: MesEvent
  id: number
  pinned: boolean
  pinnedUntil: number
}

let eventCounter = 0

function severityOf(event: MesEvent): 'critical' | 'major' | 'minor' | 'routine' {
  if (event.topic === 'alarm.raised') {
    return event.severity === 'critical' ? 'critical' : event.severity === 'major' ? 'major' : 'minor'
  }
  if (event.topic === 'spc.violation' && event.severity === 'critical') return 'critical'
  if (event.topic === 'spc.violation') return 'major'
  return 'routine'
}

function eventMessage(event: MesEvent): string {
  switch (event.topic) {
    case 'lot.move': return `${event.lotId} moved to ${event.toToolId} (step ${event.routeStep})`
    case 'equip.state': return `${event.toolId}: ${event.fromState} -> ${event.toState}`
    case 'spc.violation': return `Rule ${event.ruleNumber} violation: ${event.controlPoint.value.toFixed(2)} (UCL=${event.controlPoint.ucl.toFixed(2)})`
    case 'alarm.raised': return `[${event.severity.toUpperCase()}] ${event.message}`
    case 'recipe.load': return `${event.toolId} loaded ${event.recipeId} ${event.recipeVersion}`
    case 'kpi.tick': return `OEE=${(event.oee * 100).toFixed(1)}% Yield=${(event.yieldPct * 100).toFixed(1)}%`
    case 'shift.boundary': return `Shift ${event.kind}: ${event.shiftCode}`
  }
}

const SEVERITY_STYLES = {
  critical: 'border-l-[3px] border-l-[#DC2626] font-semibold bg-[#FEF2F2]',
  major: 'border-l-[3px] border-l-[#B45309] font-medium bg-[#FFFBEB]',
  minor: 'border-l border-l-[#F59E0B]',
  routine: 'border-l border-l-[#D1D5DB]',
}

export function EventStream({ events$, maxVisible = 50 }: EventStreamProps) {
  const [items, setItems] = useState<DisplayEvent[]>([])
  const [paused, setPaused] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sub = events$.subscribe(event => {
      const severity = severityOf(event)
      const shouldPin = severity === 'critical' || severity === 'major'
      const entry: DisplayEvent = {
        event,
        id: ++eventCounter,
        pinned: shouldPin,
        pinnedUntil: shouldPin ? Date.now() + 10_000 : 0,
      }

      setItems(prev => {
        const unpinned = prev.map(item => ({
          ...item,
          pinned: item.pinned && Date.now() < item.pinnedUntil,
        }))
        const next = [entry, ...unpinned].slice(0, maxVisible)
        // Sort: pinned first, then by time descending
        next.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          return b.id - a.id
        })
        return next
      })
    })
    return () => sub.unsubscribe()
  }, [events$, maxVisible])

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [items, paused])

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto text-xs"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {items.map(item => {
        const severity = severityOf(item.event)
        return (
          <div
            key={item.id}
            className={`px-2 py-1.5 ${SEVERITY_STYLES[severity]} ${item.pinned ? 'bg-opacity-100' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[#6B7280] shrink-0">
                {item.event.t.toFixed(1)}s
              </span>
              <span className="font-mono text-[#6B7280] shrink-0">
                {item.event.topic}
              </span>
            </div>
            <div className="mt-0.5 text-[#303030]">{eventMessage(item.event)}</div>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 5: DenseDataTable**

Create `src/components/DenseDataTable.tsx`:
```tsx
import { useState, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

export interface Column<T> {
  key: string
  header: string
  width: number
  render: (row: T) => React.ReactNode
  sortFn?: (a: T, b: T) => number
  mono?: boolean
}

interface DenseDataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  rowHeight?: number
}

export function DenseDataTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  rowHeight = 32,
}: DenseDataTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const parentRef = useRef<HTMLDivElement>(null)

  const sortedData = useMemo(() => {
    if (!sortCol) return data
    const col = columns.find(c => c.key === sortCol)
    if (!col?.sortFn) return data
    const sorted = [...data].sort(col.sortFn)
    return sortDir === 'desc' ? sorted.reverse() : sorted
  }, [data, columns, sortCol, sortDir])

  const virtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  })

  const handleSort = useCallback((key: string) => {
    if (sortCol === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(key)
      setSortDir('asc')
    }
  }, [sortCol])

  return (
    <div className="flex flex-col h-full border border-[#D1D5DB] rounded-none">
      {/* Header */}
      <div className="flex bg-[#F3F6F9] border-b border-[#D1D5DB] text-xs font-semibold text-[#6B7280]">
        {columns.map(col => (
          <div
            key={col.key}
            className="px-2 py-2 cursor-pointer hover:bg-[#E5E7EB] select-none shrink-0"
            style={{ width: col.width }}
            onClick={() => col.sortFn && handleSort(col.key)}
          >
            {col.header}
            {sortCol === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
          </div>
        ))}
      </div>

      {/* Virtualized rows */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(vRow => {
            const row = sortedData[vRow.index]
            return (
              <div
                key={rowKey(row)}
                className="absolute left-0 right-0 flex items-center text-xs border-b border-[#E5E7EB] hover:bg-[#F3F6F9] cursor-pointer"
                style={{ height: rowHeight, transform: `translateY(${vRow.start}px)` }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map(col => (
                  <div
                    key={col.key}
                    className={`px-2 truncate shrink-0 ${col.mono ? 'font-mono' : ''}`}
                    style={{ width: col.width }}
                  >
                    {col.render(row)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-2 py-1 text-xs text-[#6B7280] border-t border-[#D1D5DB] bg-[#F3F6F9]">
        {sortedData.length} rows
      </div>
    </div>
  )
}
```

**Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add shared components

ErrorBoundary (per-module error isolation), TopBar (clock + shift +
progress bar), DrillInPanel (right-side Sheet), EventStream (severity
pinning), DenseDataTable (virtualized + sortable).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: App Shell

**Files:**
- Modify: `src/main.tsx`
- Create: `src/App.tsx`

**Step 1: Write App.tsx with sidebar + routing + error boundaries**

Create `src/App.tsx`:
```tsx
import { useMemo, useEffect } from 'react'
import { useUiStore, type ModuleRoute } from './lib/uiStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { generateMasterData } from './data/master'
import { createClock } from './lib/clock'
import { createEventBus } from './lib/eventBus'
import { e10Colors, e10Symbols } from './lib/tokens'

// Lazy placeholders — will be replaced with real modules in Day 2-3
function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-full text-sm text-[#6B7280] font-mono">
      {name} — awaiting implementation
    </div>
  )
}

const NAV_ITEMS: { route: ModuleRoute; label: string; icon: string; badgeKey?: 'alarms' | 'production' | 'equipmentDown' }[] = [
  { route: 'fab-floor', label: 'Fab Floor', icon: '◉' },
  { route: 'production', label: 'Production', icon: '▦', badgeKey: 'production' },
  { route: 'equipment', label: 'Equipment', icon: '⚙', badgeKey: 'equipmentDown' },
  { route: 'spc', label: 'SPC / Quality', icon: '📈' },
  { route: 'recipe', label: 'Recipe Mgmt', icon: '📋' },
  { route: 'alarms', label: 'Alarms', icon: '⚠', badgeKey: 'alarms' },
  { route: 'kpi', label: 'KPI Dashboard', icon: '▣' },
]

export default function App() {
  const masterData = useMemo(() => generateMasterData(), [])
  const clock = useMemo(() => createClock(), [])
  const eventBus = useMemo(() => createEventBus(1000), [])

  const activeRoute = useUiStore(s => s.activeRoute)
  const setRoute = useUiStore(s => s.setRoute)
  const badges = useUiStore(s => s.badges)

  // Start clock on mount
  useEffect(() => {
    clock.start()
    return () => clock.destroy()
  }, [clock])

  // Count on-shift operators
  const operatorCount = useMemo(() => {
    const shift = useUiStore.getState().currentShift
    return masterData.operators.filter(op => op.shift === shift).length
  }, [masterData])

  const renderModule = () => {
    switch (activeRoute) {
      case 'fab-floor': return <Placeholder name="FabFloor" />
      case 'production': return <Placeholder name="Production" />
      case 'equipment': return <Placeholder name="Equipment" />
      case 'spc': return <Placeholder name="SPC" />
      case 'recipe': return <Placeholder name="Recipe" />
      case 'alarms': return <Placeholder name="Alarms" />
      case 'kpi': return <Placeholder name="KPI" />
    }
  }

  return (
    <div className="flex h-screen bg-[#F3F6F9] font-sans">
      {/* Sidebar */}
      <nav className="w-52 bg-white border-r border-[#D1D5DB] flex flex-col" aria-label="Module navigation">
        <div className="p-4 border-b border-[#E5E7EB]">
          <span className="text-lg font-semibold text-[#0066B3]">FabPulse</span>
        </div>
        <div className="flex-1 py-2">
          {NAV_ITEMS.map(item => {
            const isActive = activeRoute === item.route
            const badge = item.badgeKey ? badges[item.badgeKey] : 0
            return (
              <button
                key={item.route}
                onClick={() => setRoute(item.route)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors
                  ${isActive
                    ? 'bg-[#0066B3] bg-opacity-10 text-[#0066B3] font-semibold border-r-2 border-[#0066B3]'
                    : 'text-[#303030] hover:bg-[#F3F6F9]'
                  }`}
              >
                <span className="w-5 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono
                    ${item.badgeKey === 'alarms' ? 'bg-[#DC2626] text-white' : 'bg-[#F59E0B] text-white'}`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar clock={clock} operatorCount={operatorCount} />
        <main className="flex-1 overflow-hidden">
          <ErrorBoundary moduleName={activeRoute}>
            {renderModule()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
```

**Step 2: Update main.tsx**

Replace `src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**Step 3: Verify dev server shows app shell**

```bash
npm run dev
```

Expected: Browser shows sidebar with 7 nav items, top bar with FAB-01 PROD + clock + shift badge, and a "FabFloor — awaiting implementation" placeholder in the main area. Clicking sidebar items switches the placeholder text. No console errors.

**Step 4: Commit**

```bash
git add src/App.tsx src/main.tsx src/index.css
git commit -m "feat: app shell with sidebar, top bar, and routing

7 sidebar nav items with badge count slots. TopBar with demo clock,
shift indicator, loop progress bar. Zustand-based routing (no router
library). ErrorBoundary wraps each module. Placeholder modules ready
for Day 2-3 replacement.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**Step 5: Day 1 smoke gate**

Run: `npm run dev` — click all 7 sidebar items. Each shows its placeholder. No console errors. Clock ticks. Shift badge visible. **Day 1 complete.**

---

## Day 2 — Hero + Engine + Equipment + SPC (Tasks 10-16)

---

### Task 10: Western Electric Rules (TDD)

**Files:**
- Create: `src/lib/westernElectric.ts`
- Create: `src/lib/westernElectric.test.ts`

**Step 1: Write failing tests**

Create `src/lib/westernElectric.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { checkWesternElectric, type ControlPoint } from './westernElectric'

function makePoints(values: number[], ucl = 100, lcl = 0, centerline = 50): ControlPoint[] {
  return values.map((value, i) => ({ value, ucl, lcl, centerline, index: i }))
}

describe('Western Electric Rules', () => {
  describe('Rule 1: single point beyond 3-sigma', () => {
    it('detects point above UCL', () => {
      const points = makePoints([50, 50, 50, 101])
      const violations = checkWesternElectric(points)
      expect(violations).toContainEqual(expect.objectContaining({ rule: 1, index: 3 }))
    })

    it('detects point below LCL', () => {
      const points = makePoints([50, 50, 50, -1])
      const violations = checkWesternElectric(points)
      expect(violations).toContainEqual(expect.objectContaining({ rule: 1, index: 3 }))
    })

    it('does not fire for point within limits', () => {
      const points = makePoints([50, 60, 40, 99])
      const violations = checkWesternElectric(points)
      const rule1 = violations.filter(v => v.rule === 1)
      expect(rule1).toHaveLength(0)
    })
  })

  describe('Rule 2: 9 consecutive points on same side of centerline', () => {
    it('detects 9 consecutive above centerline', () => {
      const points = makePoints([51, 52, 53, 54, 55, 56, 57, 58, 59])
      const violations = checkWesternElectric(points)
      expect(violations).toContainEqual(expect.objectContaining({ rule: 2, index: 8 }))
    })

    it('does not fire for 8 consecutive', () => {
      const points = makePoints([51, 52, 53, 54, 55, 56, 57, 58])
      const violations = checkWesternElectric(points)
      const rule2 = violations.filter(v => v.rule === 2)
      expect(rule2).toHaveLength(0)
    })

    it('detects 9 consecutive below centerline', () => {
      const points = makePoints([49, 48, 47, 46, 45, 44, 43, 42, 41])
      const violations = checkWesternElectric(points)
      expect(violations).toContainEqual(expect.objectContaining({ rule: 2, index: 8 }))
    })

    it('resets when point crosses centerline', () => {
      const points = makePoints([51, 52, 53, 54, 49, 56, 57, 58, 59, 60, 61, 62, 63])
      const violations = checkWesternElectric(points)
      const rule2 = violations.filter(v => v.rule === 2)
      // After crossing at index 4, consecutive count resets. 5,6,7,8,9,10,11,12 = 8 above. Not 9.
      expect(rule2).toHaveLength(0)
    })
  })

  describe('Rule 4: 14 consecutive alternating up-down', () => {
    it('detects 14 alternating points', () => {
      const points = makePoints([50, 55, 45, 55, 45, 55, 45, 55, 45, 55, 45, 55, 45, 55])
      const violations = checkWesternElectric(points)
      expect(violations).toContainEqual(expect.objectContaining({ rule: 4, index: 13 }))
    })

    it('does not fire for 13 alternating', () => {
      const points = makePoints([50, 55, 45, 55, 45, 55, 45, 55, 45, 55, 45, 55, 45])
      const violations = checkWesternElectric(points)
      const rule4 = violations.filter(v => v.rule === 4)
      expect(rule4).toHaveLength(0)
    })

    it('resets when alternation breaks', () => {
      const points = makePoints([50, 55, 45, 55, 45, 55, 55, 45, 55, 45, 55, 45, 55, 45, 55])
      const violations = checkWesternElectric(points)
      const rule4 = violations.filter(v => v.rule === 4)
      // Break at index 5→6 (both go up). Reset.
      expect(rule4).toHaveLength(0)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/westernElectric.test.ts
```

Expected: FAIL — `Cannot find module './westernElectric'`

**Step 3: Implement Western Electric rules**

Create `src/lib/westernElectric.ts`:
```typescript
export interface ControlPoint {
  value: number
  ucl: number
  lcl: number
  centerline: number
  index: number
}

export interface Violation {
  rule: 1 | 2 | 4
  index: number
  severity: 'info' | 'warn' | 'critical'
  description: string
}

export function checkWesternElectric(points: ControlPoint[]): Violation[] {
  const violations: Violation[] = []

  for (let i = 0; i < points.length; i++) {
    const p = points[i]

    // Rule 1: Single point beyond 3-sigma (UCL/LCL)
    if (p.value > p.ucl || p.value < p.lcl) {
      violations.push({
        rule: 1,
        index: i,
        severity: 'critical',
        description: `Point ${i} (${p.value.toFixed(2)}) beyond ${p.value > p.ucl ? 'UCL' : 'LCL'}`,
      })
    }

    // Rule 2: 9 consecutive points on same side of centerline
    if (i >= 8) {
      const window = points.slice(i - 8, i + 1)
      const allAbove = window.every(pt => pt.value > pt.centerline)
      const allBelow = window.every(pt => pt.value < pt.centerline)
      if (allAbove || allBelow) {
        // Only report at the 9th point to avoid duplicates
        const alreadyReported = violations.some(v => v.rule === 2 && v.index === i)
        if (!alreadyReported) {
          violations.push({
            rule: 2,
            index: i,
            severity: 'warn',
            description: `9 consecutive points ${allAbove ? 'above' : 'below'} centerline ending at ${i}`,
          })
        }
      }
    }

    // Rule 4: 14 consecutive points alternating up-down
    if (i >= 13) {
      let alternating = true
      for (let j = i - 12; j <= i; j++) {
        const diff1 = points[j].value - points[j - 1].value
        const diff0 = points[j - 1].value - (j >= 2 ? points[j - 2].value : points[j - 1].value)
        if (j === i - 12) continue // need at least 2 diffs to check alternation
        const prevDiff = points[j].value - points[j - 1].value
        const prevPrevDiff = points[j - 1].value - points[j - 2].value
        if ((prevDiff > 0 && prevPrevDiff > 0) || (prevDiff < 0 && prevPrevDiff < 0) || prevDiff === 0) {
          alternating = false
          break
        }
      }
      if (alternating) {
        violations.push({
          rule: 4,
          index: i,
          severity: 'info',
          description: `14 consecutive alternating points ending at ${i}`,
        })
      }
    }
  }

  return violations
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/westernElectric.test.ts
```

Expected: All 10 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/westernElectric.ts src/lib/westernElectric.test.ts
git commit -m "feat: add Western Electric Rules 1, 2, 4 detector with tests

Rule 1: point beyond UCL/LCL (critical).
Rule 2: 9 consecutive same side (warn).
Rule 4: 14 alternating (info).
10 tests covering detection, non-detection, and reset conditions.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: KPI Formulas (TDD)

**Files:**
- Create: `src/lib/kpi.ts`
- Create: `src/lib/kpi.test.ts`

Consult `@manufacturing-expert` for correct OEE/Yield/MTBF/MTTR formulas.

**Step 1: Write failing tests**

Create `src/lib/kpi.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { computeOEE, computeYield, computeMTBF, computeMTTR, computeKpis } from './kpi'
import type { MesEvent } from './events'

describe('KPI formulas', () => {
  describe('OEE', () => {
    it('returns availability * performance * quality', () => {
      // availability = 0.9, performance = 0.85, quality = 0.99
      expect(computeOEE(0.9, 0.85, 0.99)).toBeCloseTo(0.757, 2)
    })

    it('clamps to [0, 1]', () => {
      expect(computeOEE(1.1, 1.0, 1.0)).toBeCloseTo(1.0)
      expect(computeOEE(0, 0.5, 0.5)).toBeCloseTo(0)
    })
  })

  describe('Yield', () => {
    it('returns good units / total units', () => {
      expect(computeYield(990, 1000)).toBeCloseTo(0.99, 3)
    })

    it('returns 1.0 for zero total', () => {
      expect(computeYield(0, 0)).toBe(1.0)
    })
  })

  describe('MTBF', () => {
    it('returns total uptime / number of failures', () => {
      // 1000 minutes uptime, 5 failures
      expect(computeMTBF(1000, 5)).toBeCloseTo(200)
    })

    it('returns Infinity for zero failures', () => {
      expect(computeMTBF(1000, 0)).toBe(Infinity)
    })
  })

  describe('MTTR', () => {
    it('returns total repair time / number of repairs', () => {
      expect(computeMTTR(50, 5)).toBeCloseTo(10)
    })

    it('returns 0 for zero repairs', () => {
      expect(computeMTTR(0, 0)).toBe(0)
    })
  })

  describe('computeKpis from event buffer', () => {
    it('computes KPIs from a mixed event buffer', () => {
      const events: MesEvent[] = [
        { topic: 'lot.move', t: 0, lotId: 'L1', fromToolId: 'A', toToolId: 'B', routeStep: 1, operatorId: 'OP1', productCode: 'P1', customerName: 'C1' },
        { topic: 'lot.move', t: 1, lotId: 'L2', fromToolId: 'B', toToolId: 'C', routeStep: 2, operatorId: 'OP2', productCode: 'P2', customerName: 'C2' },
        { topic: 'equip.state', t: 2, toolId: 'A', fromState: 'PROD', toState: 'UDT' },
        { topic: 'equip.state', t: 5, toolId: 'A', fromState: 'UDT', toState: 'PROD' },
        { topic: 'lot.move', t: 10, lotId: 'L3', fromToolId: 'C', toToolId: 'D', routeStep: 3, operatorId: 'OP3', productCode: 'P3', customerName: 'C3' },
      ]
      const kpis = computeKpis(events, 50) // 50 total equipment
      expect(kpis.oee).toBeGreaterThan(0)
      expect(kpis.oee).toBeLessThanOrEqual(1)
      expect(kpis.yieldPct).toBeGreaterThan(0)
      expect(kpis.throughputUnitsPerHour).toBeGreaterThan(0)
    })

    it('returns baseline KPIs for empty buffer', () => {
      const kpis = computeKpis([], 50)
      expect(kpis.oee).toBeGreaterThan(0.8) // baseline should be healthy
      expect(kpis.yieldPct).toBeGreaterThan(0.95)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/kpi.test.ts
```

Expected: FAIL — `Cannot find module './kpi'`

**Step 3: Implement KPI formulas**

Create `src/lib/kpi.ts`:
```typescript
import type { MesEvent, EquipStateEvent, LotMoveEvent } from './events'

export function computeOEE(availability: number, performance: number, quality: number): number {
  return Math.max(0, Math.min(1, availability * performance * quality))
}

export function computeYield(goodUnits: number, totalUnits: number): number {
  if (totalUnits === 0) return 1.0
  return goodUnits / totalUnits
}

export function computeMTBF(uptimeMinutes: number, failures: number): number {
  if (failures === 0) return Infinity
  return uptimeMinutes / failures
}

export function computeMTTR(repairMinutes: number, repairs: number): number {
  if (repairs === 0) return 0
  return repairMinutes / repairs
}

export interface KpiSnapshot {
  oee: number
  yieldPct: number
  mtbfMinutes: number
  mttrMinutes: number
  wipTurn: number
  throughputUnitsPerHour: number
  cycleTimeMinutes: number
}

// Baseline KPIs — used when no events have accumulated yet.
const BASELINE: KpiSnapshot = {
  oee: 0.873,
  yieldPct: 0.992,
  mtbfMinutes: 142 * 60,
  mttrMinutes: 35,
  wipTurn: 3.2,
  throughputUnitsPerHour: 2400,
  cycleTimeMinutes: 480,
}

/**
 * Compute KPI snapshot from a buffer of recent events.
 * Uses event counts and state transitions to estimate real-time KPIs.
 * Blends with baseline to avoid wild swings from small sample sizes.
 */
export function computeKpis(events: MesEvent[], totalEquipment: number): KpiSnapshot {
  if (events.length === 0) return { ...BASELINE }

  const lotMoves = events.filter((e): e is LotMoveEvent => e.topic === 'lot.move')
  const equipStates = events.filter((e): e is EquipStateEvent => e.topic === 'equip.state')

  // Time window (seconds)
  const tMin = events[0].t
  const tMax = events[events.length - 1].t
  const windowSec = Math.max(tMax - tMin, 1)
  const windowMin = windowSec / 60

  // Throughput: lot moves per hour
  const throughputPerHour = lotMoves.length > 0
    ? (lotMoves.length / windowSec) * 3600
    : BASELINE.throughputUnitsPerHour

  // Failures: transitions to UDT or SDT
  const failures = equipStates.filter(e => e.toState === 'UDT' || e.toState === 'SDT')
  const repairs = equipStates.filter(e => (e.fromState === 'UDT' || e.fromState === 'SDT') && e.toState === 'PROD')

  // Downtime estimation (rough: each failure assumed 3min avg until repair event)
  const downtimeMin = failures.length * 3
  const repairTimeMin = repairs.length > 0 ? downtimeMin : 0

  // Availability
  const totalUptime = totalEquipment * windowMin
  const availability = totalUptime > 0 ? Math.max(0.5, (totalUptime - downtimeMin) / totalUptime) : BASELINE.oee

  // Performance (blend with baseline)
  const perfRatio = lotMoves.length > 5
    ? Math.min(1, throughputPerHour / BASELINE.throughputUnitsPerHour)
    : 0.95

  // Quality (simulated — slight random dip on SPC violations)
  const spcViolations = events.filter(e => e.topic === 'spc.violation').length
  const quality = Math.max(0.95, 1.0 - spcViolations * 0.005)

  // Blend with baseline to avoid noisy swings
  const blendFactor = Math.min(events.length / 100, 1) // ramp up confidence
  const blend = (computed: number, baseline: number) =>
    computed * blendFactor + baseline * (1 - blendFactor)

  const oee = computeOEE(
    blend(availability, BASELINE.oee / (0.95 * BASELINE.yieldPct)),
    blend(perfRatio, 0.95),
    blend(quality, BASELINE.yieldPct),
  )

  return {
    oee: Math.max(0, Math.min(1, oee)),
    yieldPct: blend(quality, BASELINE.yieldPct),
    mtbfMinutes: failures.length > 0 ? computeMTBF(totalUptime, failures.length) : BASELINE.mtbfMinutes,
    mttrMinutes: repairs.length > 0 ? computeMTTR(repairTimeMin, repairs.length) : BASELINE.mttrMinutes,
    wipTurn: blend(lotMoves.length > 0 ? lotMoves.length / Math.max(windowMin / 60, 0.01) : BASELINE.wipTurn, BASELINE.wipTurn),
    throughputUnitsPerHour: blend(throughputPerHour, BASELINE.throughputUnitsPerHour),
    cycleTimeMinutes: blend(lotMoves.length > 0 ? windowMin / Math.max(lotMoves.length, 1) * 25 : BASELINE.cycleTimeMinutes, BASELINE.cycleTimeMinutes),
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/kpi.test.ts
```

Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/kpi.ts src/lib/kpi.test.ts
git commit -m "feat: add KPI computation engine with tests

OEE = availability * performance * quality.
Yield, MTBF, MTTR, WIP Turn, Throughput, Cycle Time from event buffer.
Blends with baseline to avoid noisy swings. 7 tests passing.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: SECS Message Formatter

**Files:**
- Create: `src/lib/secs.ts`

Consult `@secs-gem-open-source-docs` for authentic S2F41/S6F11 structure.

**Step 1: Implement mock SECS formatter**

Create `src/lib/secs.ts`:
```typescript
/**
 * Mock SECS/GEM message formatter.
 * Generates text that LOOKS like real SECS-II messages but carries no real transport.
 * Per design doc: S2F41 (Host Command Send) and S6F11 (Event Report Send) appearance only.
 */

export function formatS2F41(toolId: string, command: string, params: Record<string, string>): string {
  const paramLines = Object.entries(params)
    .map(([k, v]) => `      <A "${k}">\n      <A "${v}">`)
    .join('\n')
  return `S2F41 W
  <L [3]
    <A "${toolId}">
    <A "${command}">
    <L [${Object.keys(params).length}]
${paramLines}
    >
  >`
}

export function formatS6F11(toolId: string, ceid: number, reportData: Record<string, string | number>): string {
  const dataLines = Object.entries(reportData)
    .map(([k, v]) => `      <A "${k}">: ${typeof v === 'number' ? `<U4 ${v}>` : `<A "${v}">`}`)
    .join('\n')
  return `S6F11 W
  <L [3]
    <U4 ${ceid}>
    <A "${toolId}">
    <L [${Object.keys(reportData).length}]
${dataLines}
    >
  >`
}

export function formatE10Transition(toolId: string, fromState: string, toState: string, reason?: string): string {
  return formatS6F11(toolId, 1001, {
    TOOLID: toolId,
    PREV_STATE: fromState,
    CURR_STATE: toState,
    ...(reason ? { REASON: reason } : {}),
    TIMESTAMP: new Date().toISOString(),
  })
}

export function formatRecipeLoad(toolId: string, recipeId: string, version: string): string {
  return formatS2F41(toolId, 'PP-SELECT', {
    PPID: recipeId,
    PP_VERSION: version,
    PP_TYPE: 'PROCESS',
  })
}

export function formatLotTrackIn(toolId: string, lotId: string, carrierId: string): string {
  return formatS2F41(toolId, 'LOT-TRACK-IN', {
    LOTID: lotId,
    CARRIER_ID: carrierId,
    SLOT_MAP: '1111111111111111111111111',
  })
}
```

**Step 2: Commit**

```bash
git add src/lib/secs.ts
git commit -m "feat: add mock SECS/GEM message formatter

S2F41 (Host Command Send) and S6F11 (Event Report Send) text format.
Helpers for E10 transitions, recipe loads, lot track-in.
Appearance-only — no HSMS transport.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 13: Timeline Engine + Pre-roll

**Files:**
- Create: `src/data/timeline.ts` (spine definition — JSON-in-TS for type safety)
- Create: `src/data/timeline-engine.ts`

**Step 1: Define the scripted spine**

Create `src/data/timeline.ts`:
```typescript
import type { MesEvent } from '../lib/events'

export interface SpineBeat {
  t: number // seconds into the loop
  kind: 'framing' | 'beat'
  name: string
  events: MesEvent[]
}

/**
 * The scripted spine — 6 dramatic beats + 3 framing cues.
 * These fire at exact timestamps during each 180s loop.
 * Background events are generated separately via PRNG.
 */
export const SPINE: SpineBeat[] = [
  {
    t: 0, kind: 'framing', name: 'Shift start',
    events: [
      { topic: 'shift.boundary', t: 0, kind: 'start', shiftCode: 'A' },
    ],
  },
  {
    t: 25, kind: 'beat', name: 'Lot priority insertion',
    events: [
      { topic: 'lot.move', t: 25, lotId: 'LOT-2622W-HOT01', fromToolId: 'QUEUE', toToolId: 'EQP-LITHO-01', routeStep: 0, operatorId: 'OP-003', productCode: 'DEV-5NM-B2', customerName: 'NovaStar' },
    ],
  },
  {
    t: 50, kind: 'beat', name: 'Equipment minor alarm',
    events: [
      { topic: 'equip.state', t: 50, toolId: 'EQP-CMP-05', fromState: 'PROD', toState: 'SDT', reasonCode: 'PM_OVERDUE' },
      { topic: 'alarm.raised', t: 50, alarmId: 'ALM-0050', source: 'EQP-CMP-05', severity: 'minor', message: 'Scheduled PM overdue by 2h — pad conditioner wear', sopRef: 'SOP-CMP-003' },
    ],
  },
  {
    t: 80, kind: 'beat', name: 'Chamber drift detected',
    events: [
      { topic: 'spc.violation', t: 80, measurementId: 'MEAS-ETCH-080', ruleNumber: 2, severity: 'warn', controlPoint: { value: 52.3, ucl: 55.0, lcl: 45.0, centerline: 50.0 } },
      { topic: 'equip.state', t: 80, toolId: 'EQP-ETCH-03', fromState: 'PROD', toState: 'ENG', reasonCode: 'SPC_HOLD' },
    ],
  },
  {
    t: 105, kind: 'beat', name: 'SPC alarm escalation + engineer ack',
    events: [
      { topic: 'alarm.raised', t: 105, alarmId: 'ALM-0105', source: 'EQP-ETCH-03', severity: 'critical', message: 'Chamber drift confirmed — CD uniformity out of spec (>3sigma)', sopRef: 'SOP-ETCH-001', ackOperatorId: 'OP-012' },
      { topic: 'spc.violation', t: 105, measurementId: 'MEAS-ETCH-105', ruleNumber: 1, severity: 'critical', controlPoint: { value: 56.1, ucl: 55.0, lcl: 45.0, centerline: 50.0 } },
    ],
  },
  {
    t: 130, kind: 'beat', name: 'Recipe revision pushed',
    events: [
      { topic: 'recipe.load', t: 130, toolId: 'EQP-ETCH-03', recipeId: 'RCP-ETCH-01', recipeVersion: 'v2.3.1', approverOperatorId: 'OP-012' },
      { topic: 'equip.state', t: 130, toolId: 'EQP-ETCH-03', fromState: 'ENG', toState: 'PROD', reasonCode: 'RECIPE_UPDATED' },
    ],
  },
  {
    t: 150, kind: 'beat', name: 'KPI recovery',
    events: [
      { topic: 'kpi.tick', t: 150, oee: 0.891, yieldPct: 0.994, mtbfMinutes: 8520, mttrMinutes: 28, wipTurn: 3.4, throughputUnitsPerHour: 2450, cycleTimeMinutes: 465 },
    ],
  },
  {
    t: 175, kind: 'framing', name: 'Shift handover prep',
    events: [
      { topic: 'shift.boundary', t: 175, kind: 'handover', shiftCode: 'B' },
    ],
  },
  {
    t: 180, kind: 'framing', name: 'Loop restart',
    events: [
      { topic: 'shift.boundary', t: 180, kind: 'loop-restart', shiftCode: 'A' },
    ],
  },
]
```

**Step 2: Implement the timeline engine**

Create `src/data/timeline-engine.ts`:
```typescript
import { SPINE } from './timeline'
import { seededRng, pick } from './prng'
import type { EventBus } from '../lib/eventBus'
import type { Clock } from '../lib/clock'
import type { MesEvent, E10State } from '../lib/events'
import type { MasterData } from './master'
import { LOOP_DURATION_S } from '../lib/clock'

const BG_EVENTS_PER_SEC = 1

export interface TimelineEngine {
  preRoll(): void
  start(): void
  stop(): void
}

export function createTimelineEngine(
  clock: Clock,
  eventBus: EventBus,
  masterData: MasterData,
): TimelineEngine {
  let tickInterval: ReturnType<typeof setInterval> | null = null
  let lastBeatIndex = -1
  let bgRng: () => number = seededRng(0, 0)

  const { equipment, operators, products, customers, routes, lots, recipes } = masterData
  const toolIds = equipment.map(e => e.toolId)
  const E10_STATES: E10State[] = ['PROD', 'STBY', 'SDT', 'UDT', 'NSC', 'ENG', 'OUT']

  function generateBackgroundEvent(t: number): MesEvent {
    const roll = bgRng()
    if (roll < 0.40) {
      // Lot move
      const lot = pick(lots, bgRng)
      const fromTool = pick(toolIds, bgRng)
      const toTool = pick(toolIds, bgRng)
      const op = pick(operators, bgRng)
      return {
        topic: 'lot.move', t,
        lotId: lot.lotId, fromToolId: fromTool, toToolId: toTool,
        routeStep: Math.floor(bgRng() * 8),
        operatorId: op.operatorId, productCode: lot.productCode, customerName: lot.customerName,
      }
    } else if (roll < 0.60) {
      // E10 state transition (minor — not alarming)
      const tool = pick(equipment, bgRng)
      const fromState = pick(['PROD', 'STBY'] as E10State[], bgRng)
      const toState = pick(['PROD', 'STBY'] as E10State[], bgRng)
      return {
        topic: 'equip.state', t,
        toolId: tool.toolId, fromState, toState,
      }
    } else if (roll < 0.75) {
      // Recipe load
      const tool = pick(equipment, bgRng)
      const recipe = pick(recipes, bgRng)
      const op = pick(operators.filter(o => o.role === 'engineer'), bgRng)
      return {
        topic: 'recipe.load', t,
        toolId: tool.toolId, recipeId: recipe.recipeId,
        recipeVersion: recipe.currentVersion,
        approverOperatorId: op.operatorId,
      }
    } else {
      // SPC measurement (routine — within limits)
      const centerline = 50
      const sigma = 1.5
      const value = centerline + (bgRng() - 0.5) * sigma * 4
      return {
        topic: 'spc.violation', t,
        measurementId: `MEAS-BG-${Math.floor(t * 100)}`,
        ruleNumber: 1, // will not actually violate since value is within limits
        severity: 'info',
        controlPoint: { value, ucl: centerline + 3 * sigma, lcl: centerline - 3 * sigma, centerline },
      }
    }
  }

  function generatePreRollEvents(loopIndex: number): MesEvent[] {
    const events: MesEvent[] = []
    const preRng = seededRng(loopIndex, -1)
    for (let t = -30; t < 0; t++) {
      // ~1 event per second for pre-roll
      const roll = preRng()
      if (roll < 0.8) { // 80% chance of event each second
        events.push(generateBackgroundEventWithRng(t, preRng))
      }
    }
    return events
  }

  function generateBackgroundEventWithRng(t: number, rng: () => number): MesEvent {
    const savedRng = bgRng
    bgRng = rng
    const event = generateBackgroundEvent(t)
    bgRng = savedRng
    return event
  }

  function preRoll() {
    const events = generatePreRollEvents(0)
    eventBus.publishBatch(events)
  }

  let bgAccumulator = 0

  function tick() {
    const t = clock.loopT()

    // Fire spine beats that haven't fired yet in this loop
    for (let i = 0; i < SPINE.length; i++) {
      if (i > lastBeatIndex && SPINE[i].t <= t && SPINE[i].t < LOOP_DURATION_S) {
        lastBeatIndex = i
        for (const event of SPINE[i].events) {
          eventBus.publish({ ...event, t })
        }
      }
    }

    // Fire background events at ~1/sec
    bgAccumulator += 0.1 // tick is 100ms
    while (bgAccumulator >= 1.0 / BG_EVENTS_PER_SEC) {
      bgAccumulator -= 1.0 / BG_EVENTS_PER_SEC
      eventBus.publish(generateBackgroundEvent(t))
    }
  }

  function handleLoopBoundary(newLoopIndex: number) {
    lastBeatIndex = -1
    bgRng = seededRng(newLoopIndex, 0)
    bgAccumulator = 0
    // Pre-roll for new loop
    const events = generatePreRollEvents(newLoopIndex)
    eventBus.publishBatch(events)
  }

  let unsubLoopBoundary: (() => void) | null = null

  function start() {
    bgRng = seededRng(clock.loopIndex(), 0)
    unsubLoopBoundary = clock.onLoopBoundary(handleLoopBoundary)
    tickInterval = setInterval(tick, 100)
  }

  function stop() {
    if (tickInterval) clearInterval(tickInterval)
    if (unsubLoopBoundary) unsubLoopBoundary()
  }

  return { preRoll, start, stop }
}
```

**Step 3: Commit**

```bash
git add src/data/timeline.ts src/data/timeline-engine.ts
git commit -m "feat: add timeline engine with scripted spine + pre-roll

6 dramatic beats + 3 framing cues at fixed timestamps.
Background events at ~1/s via seeded PRNG.
Pre-roll generates 30s of backdated events for warm start.
Loop boundary handler reseeds background + replays pre-roll.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 14: Wire Timeline Engine into App

**Files:**
- Modify: `src/App.tsx`

**Step 1: Connect timeline engine to app lifecycle**

In `src/App.tsx`, add imports and wire the engine:

```typescript
// Add to imports:
import { createTimelineEngine } from './data/timeline-engine'
```

Inside `App()`, after `eventBus` useMemo, add:

```typescript
const engine = useMemo(
  () => createTimelineEngine(clock, eventBus, masterData),
  [clock, eventBus, masterData],
)

// Replace the clock-only useEffect with:
useEffect(() => {
  engine.preRoll()
  clock.start()
  engine.start()
  return () => {
    engine.stop()
    clock.destroy()
  }
}, [clock, engine])

// Subscribe to shift boundary events to update UI store
useEffect(() => {
  const sub = eventBus.ofTopic('shift.boundary').subscribe(e => {
    useUiStore.getState().setShift(e.shiftCode)
  })
  return () => sub.unsubscribe()
}, [eventBus])

// Subscribe to events for badge counts (throttled)
useEffect(() => {
  let alarmCount = 0
  let lotCount = 0
  let downCount = 0
  const sub = eventBus.all$().subscribe(e => {
    if (e.topic === 'alarm.raised' && !e.ackOperatorId) alarmCount++
    if (e.topic === 'alarm.raised' && e.ackOperatorId) alarmCount = Math.max(0, alarmCount - 1)
    if (e.topic === 'lot.move') lotCount = masterData.lots.filter(l => l.status === 'in-process').length
    if (e.topic === 'equip.state' && (e.toState === 'SDT' || e.toState === 'UDT')) downCount++
    if (e.topic === 'equip.state' && e.fromState !== 'PROD' && e.toState === 'PROD') downCount = Math.max(0, downCount - 1)
  })
  const throttle = setInterval(() => {
    useUiStore.getState().updateBadges({ alarms: alarmCount, production: lotCount, equipmentDown: downCount })
  }, 1000)
  return () => { sub.unsubscribe(); clearInterval(throttle) }
}, [eventBus, masterData])
```

**Step 2: Verify events are flowing**

```bash
npm run dev
```

Open browser console: you should see no errors. The event stream isn't visible yet (FabFloor module not built), but badge counts should update on the sidebar after ~50s when the first alarm beat fires.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire timeline engine into app lifecycle

Pre-roll -> clock start -> engine start on mount.
Badge count subscriptions for Alarms/Production/Equipment.
Shift boundary updates UI store.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 15: Fab Floor Hero Module

**Files:**
- Create: `src/modules/FabFloor/index.tsx`
- Create: `src/modules/FabFloor/BayLayout.tsx`
- Create: `src/modules/FabFloor/KpiStrip.tsx`

**Step 1: Create BayLayout SVG component**

Create `src/modules/FabFloor/BayLayout.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import type { Observable } from 'rxjs'
import type { EquipStateEvent, E10State } from '../../lib/events'
import { e10Colors, e10Symbols } from '../../lib/tokens'
import type { Equipment } from '../../data/master/equipment'

interface BayLayoutProps {
  equipment: Equipment[]
  equipState$: Observable<EquipStateEvent>
}

export function BayLayout({ equipment, equipState$ }: BayLayoutProps) {
  const [states, setStates] = useState<Record<string, E10State>>(() => {
    const initial: Record<string, E10State> = {}
    for (const eq of equipment) {
      initial[eq.toolId] = eq.initialState
    }
    return initial
  })

  useEffect(() => {
    const sub = equipState$.subscribe(e => {
      setStates(prev => ({ ...prev, [e.toolId]: e.toState }))
    })
    return () => sub.unsubscribe()
  }, [equipState$])

  // Layout: 2 rows of 4 bays, tools in each bay
  const svgWidth = 1000
  const svgHeight = 500
  const bayWidth = 230
  const bayHeight = 200
  const tileSize = 28
  const tileGap = 4

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
      {/* Bay backgrounds */}
      {Array.from({ length: 8 }, (_, bayIdx) => {
        const col = bayIdx % 4
        const row = Math.floor(bayIdx / 4)
        const x = col * bayWidth + 15
        const y = row * (bayHeight + 40) + 30
        return (
          <g key={`bay-${bayIdx}`}>
            <rect x={x} y={y} width={bayWidth - 10} height={bayHeight} rx={0} fill="#F3F6F9" stroke="#D1D5DB" strokeWidth={1} />
            <text x={x + 8} y={y + 18} className="text-[11px] fill-[#6B7280] font-semibold">
              BAY-{String(bayIdx + 1).padStart(2, '0')}
            </text>
          </g>
        )
      })}

      {/* Equipment tiles */}
      {equipment.map(eq => {
        const state = states[eq.toolId] || 'NSC'
        const col = eq.bayIndex % 4
        const row = Math.floor(eq.bayIndex / 4)
        const bayX = col * bayWidth + 15
        const bayY = row * (bayHeight + 40) + 30
        const tileX = bayX + 8 + eq.slotInBay * (tileSize + tileGap)
        const tileY = bayY + 30

        return (
          <g key={eq.toolId}>
            <rect
              x={tileX} y={tileY} width={tileSize} height={tileSize}
              fill={e10Colors[state]} rx={0}
              className="transition-colors duration-200"
            />
            <text
              x={tileX + tileSize / 2} y={tileY + tileSize / 2 + 1}
              textAnchor="middle" dominantBaseline="middle"
              className="text-[10px] fill-white font-mono pointer-events-none"
            >
              {e10Symbols[state]}
            </text>
            <title>{eq.toolId} — {state}</title>
          </g>
        )
      })}
    </svg>
  )
}
```

**Step 2: Create KPI strip**

Create `src/modules/FabFloor/KpiStrip.tsx`:
```tsx
import { useEffect, useState } from 'react'
import type { Observable } from 'rxjs'
import type { KpiTickEvent } from '../../lib/events'

interface KpiStripProps {
  kpiTick$: Observable<KpiTickEvent>
}

interface TileConfig {
  label: string
  format: (kpi: KpiTickEvent) => string
  unit: string
}

const TILES: TileConfig[] = [
  { label: 'OEE', format: k => (k.oee * 100).toFixed(1), unit: '%' },
  { label: 'Yield', format: k => (k.yieldPct * 100).toFixed(1), unit: '%' },
  { label: 'Throughput', format: k => Math.round(k.throughputUnitsPerHour).toString(), unit: 'wph' },
  { label: 'MTBF', format: k => Math.round(k.mtbfMinutes / 60).toString(), unit: 'h' },
  { label: 'WIP', format: k => Math.round(k.wipTurn * 575).toString(), unit: 'lots' },
]

export function KpiStrip({ kpiTick$ }: KpiStripProps) {
  const [kpi, setKpi] = useState<KpiTickEvent | null>(null)

  useEffect(() => {
    const sub = kpiTick$.subscribe(setKpi)
    return () => sub.unsubscribe()
  }, [kpiTick$])

  return (
    <div className="flex gap-3 px-4 py-3 border-b border-[#D1D5DB] bg-white">
      {TILES.map(tile => (
        <div key={tile.label} className="flex-1 px-3 py-2 border border-[#D1D5DB]">
          <div className="text-xs text-[#6B7280] mb-1">{tile.label}</div>
          <div className="text-xl font-semibold text-[#1A1A1A] font-mono">
            {kpi ? tile.format(kpi) : '—'}
            <span className="text-xs font-normal text-[#6B7280] ml-1">{tile.unit}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Step 3: Compose FabFloor module**

Create `src/modules/FabFloor/index.tsx`:
```tsx
import { useMemo } from 'react'
import { BayLayout } from './BayLayout'
import { KpiStrip } from './KpiStrip'
import { EventStream } from '../../components/EventStream'
import type { EventBus } from '../../lib/eventBus'
import type { MasterData } from '../../data/master'

interface FabFloorProps {
  eventBus: EventBus
  masterData: MasterData
}

export function FabFloor({ eventBus, masterData }: FabFloorProps) {
  const equipState$ = useMemo(() => eventBus.ofTopic('equip.state'), [eventBus])
  const kpiTick$ = useMemo(() => eventBus.ofTopic('kpi.tick'), [eventBus])
  const allEvents$ = useMemo(() => eventBus.all$(), [eventBus])

  return (
    <div className="flex h-full">
      {/* Main content: floor layout + KPI strip */}
      <div className="flex-1 flex flex-col min-w-0">
        <KpiStrip kpiTick$={kpiTick$} />
        <div className="flex-1 p-4 overflow-hidden">
          <BayLayout equipment={masterData.equipment} equipState$={equipState$} />
        </div>
      </div>

      {/* Right panel: event stream */}
      <aside className="w-80 border-l border-[#D1D5DB] bg-white" aria-label="Event stream">
        <div className="px-3 py-2 border-b border-[#E5E7EB] text-xs font-semibold text-[#6B7280]">
          Live Events
        </div>
        <div className="h-[calc(100%-33px)]">
          <EventStream events$={allEvents$} />
        </div>
      </aside>
    </div>
  )
}
```

**Step 4: Wire FabFloor into App.tsx routing**

In `App.tsx`, replace the `<Placeholder name="FabFloor" />` with:

```tsx
import { FabFloor } from './modules/FabFloor'

// In renderModule():
case 'fab-floor': return <FabFloor eventBus={eventBus} masterData={masterData} />
```

Also pass `eventBus` and `masterData` context for other modules by updating `renderModule` to receive these props (or use React Context — but for hackathon speed, props are fine).

**Step 5: Verify hero is working**

```bash
npm run dev
```

Expected: Fab Floor shows 48 equipment tiles colored by E10 state, KPI strip with 5 tiles, live event stream scrolling on the right. At t=50s the CMP-05 tile should change color.

**Step 6: Commit**

```bash
git add src/modules/FabFloor/ src/App.tsx
git commit -m "feat: add Fab Floor hero module

BayLayout SVG with 48 equipment tiles colored by E10 state.
KPI strip (OEE, Yield, Throughput, MTBF, WIP).
Right-side event stream with severity pinning.
Cross-module event correlation visible on spine beats.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 16: Equipment Module

**Files:**
- Create: `src/modules/Equipment/index.tsx`

**Step 1: Implement Equipment module**

Create `src/modules/Equipment/index.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react'
import { DenseDataTable, type Column } from '../../components/DenseDataTable'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import type { EventBus } from '../../lib/eventBus'
import type { MasterData } from '../../data/master'
import type { Equipment } from '../../data/master/equipment'
import type { E10State, MesEvent } from '../../lib/events'
import { e10Colors, e10Symbols } from '../../lib/tokens'
import { formatE10Transition, formatRecipeLoad, formatLotTrackIn } from '../../lib/secs'

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
```

**Step 2: Wire into App.tsx**

```typescript
import { EquipmentModule } from './modules/Equipment'

// In renderModule():
case 'equipment': return <EquipmentModule eventBus={eventBus} masterData={masterData} />
```

**Step 3: Commit**

```bash
git add src/modules/Equipment/ src/App.tsx
git commit -m "feat: add Equipment module with E10 state matrix + SECS log

Dense table with 50 tools, live E10 state updates. Click row to open
DrillInPanel with mock SECS S2F41/S6F11 message log. Operator who
loaded recipe shown.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 17: SPC Module

**Files:**
- Create: `src/modules/SPC/index.tsx`

**Step 1: Implement SPC module with Recharts control chart**

Create `src/modules/SPC/index.tsx`:
```tsx
import { useEffect, useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import type { EventBus } from '../../lib/eventBus'
import type { SpcViolationEvent } from '../../lib/events'

interface SpcModuleProps {
  eventBus: EventBus
}

interface ChartPoint {
  index: number
  value: number
  isViolation: boolean
  ruleNumber?: 1 | 2 | 4
  severity?: string
}

const UCL = 55.0
const LCL = 45.0
const CENTERLINE = 50.0

export function SpcModule({ eventBus }: SpcModuleProps) {
  const [points, setPoints] = useState<ChartPoint[]>([])
  const [violations, setViolations] = useState<SpcViolationEvent[]>([])

  useEffect(() => {
    let idx = 0
    const sub = eventBus.ofTopic('spc.violation').subscribe(e => {
      const isViolation = e.severity === 'warn' || e.severity === 'critical'
      const point: ChartPoint = {
        index: idx++,
        value: e.controlPoint.value,
        isViolation,
        ruleNumber: isViolation ? e.ruleNumber : undefined,
        severity: e.severity,
      }
      setPoints(prev => [...prev.slice(-99), point])
      if (isViolation) {
        setViolations(prev => [e, ...prev].slice(0, 20))
      }
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  return (
    <div className="flex flex-col h-full">
      {/* Control Chart */}
      <div className="flex-1 p-4">
        <div className="h-full border border-[#D1D5DB] bg-white p-4">
          <div className="text-xs font-semibold text-[#6B7280] mb-2">
            Control Chart — CD Uniformity (nm)
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={points} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="index" tick={{ fontSize: 11 }} stroke="#6B7280" />
              <YAxis domain={[40, 60]} tick={{ fontSize: 11 }} stroke="#6B7280" />
              <Tooltip
                contentStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                formatter={(value: number) => [value.toFixed(2), 'Value']}
              />
              <ReferenceLine y={UCL} stroke="#DC2626" strokeDasharray="8 4" label={{ value: 'UCL', fill: '#DC2626', fontSize: 10, position: 'right' }} />
              <ReferenceLine y={LCL} stroke="#DC2626" strokeDasharray="8 4" label={{ value: 'LCL', fill: '#DC2626', fontSize: 10, position: 'right' }} />
              <ReferenceLine y={CENTERLINE} stroke="#0066B3" strokeDasharray="4 4" label={{ value: 'CL', fill: '#0066B3', fontSize: 10, position: 'right' }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0066B3"
                strokeWidth={1.5}
                dot={(props: any) => {
                  const { cx, cy, payload } = props
                  if (payload.isViolation) {
                    return <circle cx={cx} cy={cy} r={5} fill="#DC2626" stroke="#DC2626" />
                  }
                  return <circle cx={cx} cy={cy} r={2.5} fill="#0066B3" stroke="#0066B3" />
                }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Violation Log */}
      <div className="h-48 border-t border-[#D1D5DB] bg-white px-4 py-2 overflow-y-auto">
        <div className="text-xs font-semibold text-[#6B7280] mb-2">Violation Log</div>
        {violations.length === 0 && (
          <div className="text-xs text-[#9CA3AF] font-mono">No violations detected</div>
        )}
        {violations.map((v, i) => (
          <div key={i} className="flex items-center gap-2 py-1 text-xs border-b border-[#E5E7EB]">
            <span className={`px-1.5 py-0.5 rounded-sm text-white text-[10px] ${v.severity === 'critical' ? 'bg-[#DC2626]' : 'bg-[#B45309]'}`}>
              {v.severity.toUpperCase()}
            </span>
            <span className="font-mono text-[#6B7280]">t={v.t.toFixed(0)}s</span>
            <span className="text-[#303030]">Rule {v.ruleNumber}: {v.controlPoint.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Wire into App.tsx**

```typescript
import { SpcModule } from './modules/SPC'

// In renderModule():
case 'spc': return <SpcModule eventBus={eventBus} />
```

**Step 3: Commit**

```bash
git add src/modules/SPC/ src/App.tsx
git commit -m "feat: add SPC module with Recharts control chart

UCL/LCL/centerline reference lines. Violation points highlighted in
red. Western Electric Rule 1, 2, 4 violations shown in log strip.
Pre-roll data populates chart on first render.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**Step 4: Day 2 smoke gate**

Run: `npm run dev` — verify:
- Fab Floor hero shows tiles, KPI strip, event stream
- Equipment shows dense table, click opens SECS log drill-in
- SPC shows control chart with data points, violation at t=80s/105s
- All sidebar items clickable, no console errors

---

## Day 3 — Remaining Modules + Polish (Tasks 18-22)

---

### Task 18: Production Module

**Files:**
- Create: `src/modules/Production/index.tsx`

**Step 1: Implement Production module with lot table + genealogy**

Create `src/modules/Production/index.tsx`:
```tsx
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
          {r.priority === 'normal' ? '—' : r.priority.toUpperCase()}
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

            {/* Route steps */}
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

            {/* Genealogy */}
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
```

**Step 2: Wire into App.tsx and commit**

```bash
git add src/modules/Production/ src/App.tsx
git commit -m "feat: add Production module with lot table + genealogy drill-in

200 lots in virtualized DataTable with productCode, customerName,
route progress, priority, status columns. Drill-in panel shows route
steps, current step highlight, parent/child genealogy navigation.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 19: Alarms Module

**Files:**
- Create: `src/modules/Alarms/index.tsx`

**Step 1: Implement Alarms module**

Create `src/modules/Alarms/index.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import type { EventBus } from '../../lib/eventBus'
import type { AlarmRaisedEvent } from '../../lib/events'

interface AlarmsModuleProps {
  eventBus: EventBus
}

export function AlarmsModule({ eventBus }: AlarmsModuleProps) {
  const [alarms, setAlarms] = useState<AlarmRaisedEvent[]>([])
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  useEffect(() => {
    const sub = eventBus.ofTopic('alarm.raised').subscribe(alarm => {
      setAlarms(prev => [alarm, ...prev].slice(0, 100))
    })
    return () => sub.unsubscribe()
  }, [eventBus])

  const selectedAlarm = selectedEntity?.type === 'alarm'
    ? alarms.find(a => a.alarmId === selectedEntity.id)
    : null

  const severityStyle = (sev: string) =>
    sev === 'critical' ? 'bg-[#DC2626] text-white' :
    sev === 'major' ? 'bg-[#B45309] text-white' :
    'bg-[#6B7280] text-white'

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="text-xs font-semibold text-[#6B7280] mb-2">Alarm Desk — {alarms.length} alarms</div>
        {alarms.length === 0 && (
          <div className="text-xs text-[#9CA3AF] font-mono py-4">Alarm bus listening...</div>
        )}
        {alarms.map((alarm, i) => (
          <div
            key={`${alarm.alarmId}-${i}`}
            className="flex items-center gap-3 px-3 py-2 border-b border-[#E5E7EB] hover:bg-[#F3F6F9] cursor-pointer"
            onClick={() => selectEntity({ type: 'alarm', id: alarm.alarmId })}
          >
            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${severityStyle(alarm.severity)}`}>
              {alarm.severity.toUpperCase()}
            </span>
            <span className="font-mono text-xs text-[#6B7280] w-16 shrink-0">t={alarm.t.toFixed(0)}s</span>
            <span className="font-mono text-xs text-[#6B7280] w-28 shrink-0">{alarm.source}</span>
            <span className="text-xs text-[#303030] flex-1 truncate">{alarm.message}</span>
            {alarm.ackOperatorId && (
              <span className="text-[10px] text-[#16A34A] font-mono">ACK</span>
            )}
          </div>
        ))}
      </div>

      {selectedAlarm && (
        <DrillInPanel title={`Alarm ${selectedAlarm.alarmId}`}>
          <div className="space-y-3 text-xs">
            <div><span className="text-[#6B7280]">Severity:</span> <span className={`px-1.5 py-0.5 rounded-sm ${severityStyle(selectedAlarm.severity)}`}>{selectedAlarm.severity}</span></div>
            <div><span className="text-[#6B7280]">Source:</span> <span className="font-mono">{selectedAlarm.source}</span></div>
            <div><span className="text-[#6B7280]">Message:</span> {selectedAlarm.message}</div>
            {selectedAlarm.sopRef && <div><span className="text-[#6B7280]">SOP Reference:</span> <span className="font-mono text-[#0066B3]">{selectedAlarm.sopRef}</span></div>}
            {selectedAlarm.ackOperatorId && <div><span className="text-[#6B7280]">Acknowledged by:</span> <span className="font-mono">{selectedAlarm.ackOperatorId}</span></div>}
            <div><span className="text-[#6B7280]">Time:</span> <span className="font-mono">t={selectedAlarm.t.toFixed(1)}s</span></div>
          </div>
        </DrillInPanel>
      )}
    </div>
  )
}
```

**Step 2: Wire and commit**

```bash
git add src/modules/Alarms/ src/App.tsx
git commit -m "feat: add Alarms module with desk + drill-in

Real-time alarm desk with severity color routing. Drill-in shows
SOP reference, ack operator, message detail. Critical alarms from
spine beats visible at t=50s and t=105s.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 20: KPI Dashboard Module

**Files:**
- Create: `src/modules/KPI/index.tsx`

**Step 1: Implement KPI dashboard with tiles + sparklines**

Create `src/modules/KPI/index.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import type { EventBus } from '../../lib/eventBus'
import type { KpiTickEvent } from '../../lib/events'
import { computeKpis } from '../../lib/kpi'

interface KpiDashboardProps {
  eventBus: EventBus
  totalEquipment: number
}

interface TileConfig {
  key: keyof KpiTickEvent
  label: string
  format: (v: number) => string
  unit: string
}

const TILES: TileConfig[] = [
  { key: 'oee', label: 'OEE', format: v => (v * 100).toFixed(1), unit: '%' },
  { key: 'yieldPct', label: 'Yield', format: v => (v * 100).toFixed(1), unit: '%' },
  { key: 'throughputUnitsPerHour', label: 'Throughput', format: v => Math.round(v).toString(), unit: 'wph' },
  { key: 'mtbfMinutes', label: 'MTBF', format: v => Math.round(v / 60).toString(), unit: 'h' },
  { key: 'mttrMinutes', label: 'MTTR', format: v => Math.round(v).toString(), unit: 'min' },
  { key: 'wipTurn', label: 'WIP Turn', format: v => v.toFixed(1), unit: 'x' },
  { key: 'cycleTimeMinutes', label: 'Cycle Time', format: v => Math.round(v).toString(), unit: 'min' },
]

export function KpiDashboard({ eventBus, totalEquipment }: KpiDashboardProps) {
  const [history, setHistory] = useState<KpiTickEvent[]>([])
  const [currentKpi, setCurrentKpi] = useState<ReturnType<typeof computeKpis> | null>(null)

  useEffect(() => {
    const sub = eventBus.ringBuffer$().subscribe(buffer => {
      const kpi = computeKpis(buffer, totalEquipment)
      setCurrentKpi(kpi)

      // Synthesize a KpiTickEvent for sparkline history
      const tick: KpiTickEvent = {
        topic: 'kpi.tick',
        t: buffer.length > 0 ? buffer[buffer.length - 1].t : 0,
        ...kpi,
      }
      setHistory(prev => [...prev.slice(-60), tick])
    })
    return () => sub.unsubscribe()
  }, [eventBus, totalEquipment])

  return (
    <div className="p-4 grid grid-cols-4 gap-3 h-full auto-rows-min">
      {TILES.map(tile => {
        const value = currentKpi ? (currentKpi as any)[tile.key] : 0
        const sparkData = history.map(h => ({ v: (h as any)[tile.key] }))

        return (
          <div key={tile.key} className="border border-[#D1D5DB] bg-white p-4">
            <div className="text-xs text-[#6B7280] mb-1">{tile.label}</div>
            <div className="text-2xl font-semibold text-[#1A1A1A] font-mono">
              {currentKpi ? tile.format(value) : '—'}
              <span className="text-xs font-normal text-[#6B7280] ml-1">{tile.unit}</span>
            </div>
            <div className="h-12 mt-2">
              {sparkData.length > 2 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData}>
                    <Line type="monotone" dataKey="v" stroke="#0066B3" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Wire and commit**

```bash
git add src/modules/KPI/ src/App.tsx
git commit -m "feat: add KPI Dashboard with 7 tiles + sparklines

OEE, Yield, Throughput, MTBF, MTTR, WIP Turn, Cycle Time.
Computed from ring buffer via computeKpis(). Recharts sparklines
show 60-point rolling history. Recovery visible at t=150s.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 21: Recipe Module

**Files:**
- Create: `src/modules/Recipe/index.tsx`

**Step 1: Implement Recipe module with library + diff**

Create `src/modules/Recipe/index.tsx`:
```tsx
import { useMemo } from 'react'
import { DrillInPanel } from '../../components/DrillInPanel'
import { useUiStore } from '../../lib/uiStore'
import type { MasterData } from '../../data/master'
import type { Recipe } from '../../data/master/recipes'

interface RecipeModuleProps {
  masterData: MasterData
}

export function RecipeModule({ masterData }: RecipeModuleProps) {
  const selectEntity = useUiStore(s => s.selectEntity)
  const selectedEntity = useUiStore(s => s.selectedEntity)

  const grouped = useMemo(() => {
    const groups: Record<string, Recipe[]> = {}
    for (const recipe of masterData.recipes) {
      const type = recipe.toolType
      if (!groups[type]) groups[type] = []
      groups[type].push(recipe)
    }
    return groups
  }, [masterData])

  const selectedRecipe = selectedEntity?.type === 'recipe'
    ? masterData.recipes.find(r => r.recipeId === selectedEntity.id)
    : null

  return (
    <div className="flex h-full">
      {/* Recipe tree */}
      <div className="w-72 border-r border-[#D1D5DB] bg-white overflow-y-auto">
        <div className="px-3 py-2 text-xs font-semibold text-[#6B7280] border-b border-[#E5E7EB]">
          Recipe Library — {masterData.recipes.length} recipes
        </div>
        {Object.entries(grouped).map(([type, recipes]) => (
          <div key={type}>
            <div className="px-3 py-1.5 text-xs font-semibold text-[#6B7280] bg-[#F3F6F9]">{type}</div>
            {recipes.map(recipe => (
              <button
                key={recipe.recipeId}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#F3F6F9] border-b border-[#E5E7EB]
                  ${selectedEntity?.id === recipe.recipeId ? 'bg-[#0066B3] bg-opacity-10 text-[#0066B3]' : 'text-[#303030]'}`}
                onClick={() => selectEntity({ type: 'recipe', id: recipe.recipeId })}
              >
                <div className="font-mono">{recipe.recipeId}</div>
                <div className="text-[10px] text-[#6B7280]">{recipe.currentVersion}</div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Diff / detail area */}
      <div className="flex-1 p-4">
        {!selectedRecipe && (
          <div className="flex items-center justify-center h-full text-xs text-[#9CA3AF] font-mono">
            Select a recipe from the library
          </div>
        )}
        {selectedRecipe && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-[#1A1A1A]">
              {selectedRecipe.recipeName} — <span className="font-mono">{selectedRecipe.currentVersion}</span>
            </div>

            {/* Parameters */}
            <div>
              <div className="text-xs font-semibold text-[#6B7280] mb-1">Parameters</div>
              <div className="font-mono text-xs">
                {Object.entries(selectedRecipe.parameters).map(([key, value], i) => (
                  <div key={key} className={`flex px-2 py-1 ${i % 2 === 0 ? 'bg-[#FAFAFA]' : 'bg-white'}`}>
                    <span className="w-48 text-[#6B7280]">{key}</span>
                    <span className="text-[#1A1A1A]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Version diff (simplified — side by side) */}
            {selectedRecipe.versions.length >= 2 && (
              <div>
                <div className="text-xs font-semibold text-[#6B7280] mb-1">Version History (latest change)</div>
                <div className="font-mono text-xs border border-[#D1D5DB]">
                  {selectedRecipe.versions.slice(-2).map((ver, i) => (
                    <div key={ver.version} className={`px-2 py-1.5 ${i === 1 ? 'bg-[#DCFCE7]' : 'bg-[#FEF2F2]'} border-b border-[#E5E7EB]`}>
                      <div className="flex justify-between">
                        <span>{i === 0 ? '−' : '+'} {ver.version}</span>
                        <span className="text-[#6B7280]">{ver.author}</span>
                      </div>
                      <div className="text-[#6B7280] mt-0.5">{ver.changeNote}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sign-off chain */}
            <div>
              <div className="text-xs font-semibold text-[#6B7280] mb-1">Sign-off Chain</div>
              {selectedRecipe.versions.map(ver => (
                <div key={ver.version} className="flex items-center gap-2 py-1 text-xs border-b border-[#E5E7EB]">
                  <span className="font-mono text-[#0066B3]">{ver.version}</span>
                  <span className="text-[#6B7280]">by</span>
                  <span className="font-mono">{ver.author}</span>
                  <span className="text-[#9CA3AF] ml-auto">{ver.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Wire and commit**

```bash
git add src/modules/Recipe/ src/App.tsx
git commit -m "feat: add Recipe module with library tree + version diff

30 recipes grouped by tool type. Side-by-side version diff with
red/green line marks. Sign-off chain with author + timestamp.
Parameter view per recipe.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 22: Polish Pass + Build Verification

**Files:**
- Modify: `src/App.tsx` (final wiring check)
- Modify: various modules for visual consistency

**Step 1: Wire all remaining module imports in App.tsx**

Ensure all 7 module imports are in `App.tsx` and the `renderModule()` switch covers all cases with real components (no more Placeholder).

**Step 2: Add Google Fonts to index.html**

Add to `<head>` in `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Update `src/index.css` to set font families:
```css
@import "tailwindcss";

body {
  font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: #1A1A1A;
  background: #F3F6F9;
}

.font-mono {
  font-family: 'JetBrains Mono', ui-monospace, 'Cascadia Code', Consolas, monospace;
}
```

**Step 3: Add viewport fallback**

In `src/App.tsx`, add at the top of the render:
```tsx
const [windowWidth, setWindowWidth] = useState(window.innerWidth)
useEffect(() => {
  const handler = () => setWindowWidth(window.innerWidth)
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])

if (windowWidth < 1280) {
  return (
    <div className="flex items-center justify-center h-screen bg-[#F3F6F9] p-8 text-center">
      <div>
        <div className="text-4xl mb-4">🖥</div>
        <div className="text-sm text-[#6B7280]">
          FabPulse requires a viewport of 1280px or wider.<br />
          Open on a desktop or rotate your tablet.
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Run build and verify bundle size**

```bash
npm run build
```

Expected: `dist/` folder created. Check gzipped size:

```bash
du -sh dist/
find dist/assets -name '*.js' -o -name '*.css' | xargs gzip -k
ls -la dist/assets/*.gz
```

Target: total gzipped < 800KB. If over, check for accidental full-library imports of RxJS or Recharts.

**Step 5: Serve and test the 3-minute loop**

```bash
npx serve dist
```

Open in Chrome:
- [ ] Hero loads in < 1.5s
- [ ] All 7 sidebar items clickable and show real content
- [ ] Event stream shows live events with severity pinning
- [ ] Badge counts update on sidebar (Alarms badge at t=50s)
- [ ] At t=80s: SPC chart shows violation point
- [ ] At t=105s: Alarm escalation visible
- [ ] At t=130s: Recipe load event in Equipment SECS log
- [ ] At t=150s: KPI tiles recover
- [ ] At t=180s: loop restarts cleanly (no white flash, no unmount)
- [ ] No console errors throughout

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: polish pass + build verification

Google Fonts (IBM Plex Sans, JetBrains Mono), viewport fallback for
<1280px, all 7 modules wired. Bundle size verified < 800KB gzip.
3-minute loop plays end-to-end with all 6 dramatic beats firing.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Post-Build Checklist

After all tasks are complete, verify all 9 Success Criteria:

| # | Criterion | How to verify |
|---|-----------|---------------|
| 1 | dist/ <= 800KB gzip | `npm run build && du -sh dist/` |
| 2 | Hero loads < 1.5s | Chrome DevTools > Performance > Reload |
| 3 | 7 routes clickable + live content | Click each sidebar item |
| 4 | 6 beats fire in order | Watch event stream for 3 minutes |
| 5 | Background events >= 1/sec | Count events in stream over 30s |
| 6 | Loop boundary clean | Watch t=180s transition |
| 7 | Master data passes sniff test | Show to fab insider |
| 8 | Procurement click test | Click all 7 routes |
| 9 | Smoke gate (no console errors) | Chrome DevTools > Console |

---

## Test Summary

| Test file | Count | Covers |
|-----------|-------|--------|
| `src/data/prng.test.ts` | 5 | Determinism, range, distribution, hash |
| `src/lib/eventBus.test.ts` | 5 | Topic filtering, ring buffer, batch |
| `src/lib/westernElectric.test.ts` | 10 | Rules 1, 2, 4 detection + edge cases |
| `src/lib/kpi.test.ts` | 7 | OEE, Yield, MTBF, MTTR, event buffer |
| **Total** | **27** | Deterministic core |

Run all: `npx vitest run`
