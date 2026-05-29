import { create } from 'zustand'
import type { Shipment, ShipmentStatus } from '../data/scm/types'

// Reactive single source of truth for shipments the SCM shipment-driver puts in
// flight. The Control Tower map and the Shipments table both read this, so a
// shipment is one object shown in several places — hence a zustand store,
// mirroring useBridgedLots. DISCRETE state only (plan ARCH-1): the store holds
// status + departureT + transitSeconds, never a per-tick `progress`; live map
// position is computed in the animation layer from those discrete fields.

const MAX_SHIPMENTS = 40 // cap + recycle, a touch below MES MAX_BRIDGED=60

interface ShipmentsState {
  shipments: Shipment[]
  addShipment: (shipment: Shipment) => void
  transition: (shipmentNo: string, status: ShipmentStatus) => void
  /** Clear on loop boundary so in-flight shipments don't orphan at the 180s wrap. */
  reset: () => void
}

export const useShipments = create<ShipmentsState>((set) => ({
  shipments: [],
  addShipment: (shipment) =>
    set((s) => {
      const next = [...s.shipments, shipment]
      return { shipments: next.length > MAX_SHIPMENTS ? next.slice(next.length - MAX_SHIPMENTS) : next }
    }),
  transition: (shipmentNo, status) =>
    set((s) => ({
      shipments: s.shipments.map((sh) => (sh.shipmentNo === shipmentNo ? { ...sh, status } : sh)),
    })),
  reset: () => set({ shipments: [] }),
}))

export { MAX_SHIPMENTS }
