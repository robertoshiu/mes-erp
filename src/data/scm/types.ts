// SCM master + dynamic entity shapes. Mirrors the ERP master-data style.
// These are the data contracts the SCM generators, engine, shipment driver,
// useShipments store, and modules share. Keyed deterministically off MES+ERP.

export type NodeKind = 'supplier' | 'fab' | 'dc' | 'customer'

/** A node on the supply-network control-tower map. `x,y` are hand-placed,
 *  baked into the generator on a fixed SVG viewBox (no geo/layout library);
 *  `labelSide` drives the SVG <text> textAnchor so labels never collide. */
export interface NetworkNode {
  id: string
  kind: NodeKind
  name: string
  region: string
  x: number
  y: number
  labelSide: 'left' | 'right' | 'top' | 'bottom'
}

export type LaneMode = 'air' | 'sea' | 'truck'

export interface Lane {
  id: string
  from: string                 // NetworkNode.id
  to: string                   // NetworkNode.id
  mode: LaneMode
  transitDays: number
}

/** Per-material demand plan (IBP-style time buckets). `buckets` = forecast,
 *  `actuals` = realized; the Demand Planning grid tints the variance. */
export interface Forecast {
  materialNo: string
  buckets: number[]
  actuals: number[]
}

export type ShipmentDirection = 'inbound' | 'outbound'
export type ShipmentStatus = 'created' | 'in-transit' | 'arrived' | 'delivered'

/** DISCRETE shipment state only (plan ARCH-1) — there is NO stored `progress`
 *  field. Live map position is computed per animation frame from
 *  shipmentPosition(loopT, departureT, transitSeconds); the store fires only
 *  status transitions, mirroring useBridgedLots. */
export interface Shipment {
  shipmentNo: string
  direction: ShipmentDirection
  fromNode: string             // NetworkNode.id
  toNode: string               // NetworkNode.id
  laneId: string               // Lane.id
  refDoc: { poNo?: string; salesOrderNo?: string }
  materialNo: string
  qty: number
  status: ShipmentStatus
  departureT: number           // loop seconds at which the shipment departs
  transitSeconds: number       // loop seconds origin→destination
}

export interface SupplierScorecard {
  bpNo: string
  name: string
  onTimePct: number
  qualityPct: number
  avgLeadDays: number
  openAsns: number
}

export interface AtpPromise {
  salesOrderNo: string
  materialNo: string
  promisedDate: string
  available: number
}

export interface ScmData {
  networkNodes: NetworkNode[]
  lanes: Lane[]
  forecasts: Forecast[]
  /** The seeded initial in-flight shipment set (ARCH-2 first-paint population). */
  shipments: Shipment[]
  scorecards: SupplierScorecard[]
  atpPromises: AtpPromise[]
}
