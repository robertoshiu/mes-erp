// SCM event union — emitted by the SCM simulation engine + shipment driver onto
// the shared bus alongside MesEvent + ErpEvent. Every variant carries `t` (loop
// seconds) so AppEvent consumers (KPI ring buffer, EventStream) read it uniformly.
// 9 discrete-transition topics only — per-tick shipment progress is NOT a bus
// event (it lives in the useShipments store + computed position; see plan ARCH-1).

export type ForecastUpdatedEvent = {
  topic: 'scm.forecast.updated'
  t: number
  materialNo: string
  bucket: number
  qty: number
}

export type ShipmentCreatedEvent = {
  topic: 'scm.shipment.created'
  t: number
  shipmentNo: string
  direction: 'inbound' | 'outbound'
  fromNode: string
  toNode: string
  laneId: string
  materialNo: string
  qty: number
  poNo: string | null
  salesOrderNo: string | null
}

export type ShipmentDepartedEvent = {
  topic: 'scm.shipment.departed'
  t: number
  shipmentNo: string
  fromNode: string
  toNode: string
  laneId: string
  materialNo: string
  qty: number
}

export type ShipmentArrivedEvent = {
  topic: 'scm.shipment.arrived'
  t: number
  shipmentNo: string
  toNode: string
  materialNo: string
  qty: number
  poNo: string | null
}

export type ShipmentDeliveredEvent = {
  topic: 'scm.shipment.delivered'
  t: number
  shipmentNo: string
  toNode: string
  materialNo: string
  qty: number
  salesOrderNo: string | null
}

export type AtpPromisedEvent = {
  topic: 'scm.atp.promised'
  t: number
  salesOrderNo: string
  materialNo: string
  promisedDate: string
  available: number
}

export type SupplierAsnEvent = {
  topic: 'scm.supplier.asn'
  t: number
  bpNo: string
  supplierName: string
  materialNo: string
  qty: number
  poNo: string | null
}

export type DisruptionRaisedEvent = {
  topic: 'scm.disruption.raised'
  t: number
  laneId: string
  fromNode: string
  toNode: string
  reason: string
}

export type DisruptionClearedEvent = {
  topic: 'scm.disruption.cleared'
  t: number
  laneId: string
  fromNode: string
  toNode: string
}

export type ScmEvent =
  | ForecastUpdatedEvent
  | ShipmentCreatedEvent
  | ShipmentDepartedEvent
  | ShipmentArrivedEvent
  | ShipmentDeliveredEvent
  | AtpPromisedEvent
  | SupplierAsnEvent
  | DisruptionRaisedEvent
  | DisruptionClearedEvent

export type ScmTopic = ScmEvent['topic']
