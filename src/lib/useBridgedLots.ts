import { create } from 'zustand'
import type { BridgedLot } from '../data/erp/types'

// Reactive single source of truth for lots the ERP bridge drops onto the floor.
// Both the MES views (Fab Floor, Production) and ERP Production Orders read this,
// so a bridged lot is one object shown in several places. A bare module array
// would not trigger React re-renders — hence a zustand store, mirroring uiStore.

const MAX_BRIDGED = 60 // cap + recycle, like the MES ring buffer

interface BridgedLotsState {
  lots: BridgedLot[]
  addLot: (lot: BridgedLot) => void
  advanceLot: (lotId: string, step: number) => void
  completeLot: (lotId: string) => void
  /** Clear on loop boundary so in-flight lots don't orphan at the 180s wrap. */
  reset: () => void
}

export const useBridgedLots = create<BridgedLotsState>((set) => ({
  lots: [],
  addLot: (lot) =>
    set((s) => {
      const next = [...s.lots, lot]
      return { lots: next.length > MAX_BRIDGED ? next.slice(next.length - MAX_BRIDGED) : next }
    }),
  advanceLot: (lotId, step) =>
    set((s) => ({
      lots: s.lots.map((l) => (l.lotId === lotId ? { ...l, currentStep: step } : l)),
    })),
  completeLot: (lotId) =>
    set((s) => ({
      lots: s.lots.map((l) =>
        l.lotId === lotId ? { ...l, status: 'complete', currentStep: l.totalSteps } : l,
      ),
    })),
  reset: () => set({ lots: [] }),
}))
