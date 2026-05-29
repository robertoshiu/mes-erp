// ERP event union — emitted by the ERP simulation engine + bridge onto the
// shared bus alongside MesEvent. Every variant carries `t` (loop seconds) so
// AppEvent consumers (KPI ring buffer, EventStream) can read it uniformly.
import type { ProdOrderStatus } from '../data/erp/types'

export type OrderCreatedEvent = {
  topic: 'erp.order.created'
  t: number
  orderNo: string
  bpNo: string
  customerName: string
  materialNo: string
  qty: number
}

export type MrpRunEvent = {
  topic: 'erp.mrp.run'
  t: number
  shortages: number
  plannedOrders: number
}

export type PlannedOrderCreatedEvent = {
  topic: 'erp.plannedorder.created'
  t: number
  plannedOrderNo: string
  materialNo: string
  qty: number
}

export type ProdOrderReleasedEvent = {
  topic: 'erp.prodorder.released'
  t: number
  orderNo: string
  materialNo: string
  productCode: string
  routeId: string
  qty: number
  salesOrderNo: string | null
}

export type ProdOrderStatusEvent = {
  topic: 'erp.prodorder.status'
  t: number
  orderNo: string
  status: ProdOrderStatus
}

export type GoodsMovementEvent = {
  topic: 'erp.goods.movement'
  t: number
  movementType: 'GR' | 'GI'   // goods receipt / goods issue
  materialNo: string
  qty: number
  storageLoc: string
}

export type PoCreatedEvent = {
  topic: 'erp.po.created'
  t: number
  poNo: string
  bpNo: string
  vendorName: string
  materialNo: string
  qty: number
}

export type PoReceivedEvent = {
  topic: 'erp.po.received'
  t: number
  poNo: string
  materialNo: string
  qty: number
}

export type GlPostingEvent = {
  topic: 'erp.gl.posting'
  t: number
  accountNo: string
  accountName: string
  amount: number
  ref: string
}

export type InvoiceCreatedEvent = {
  topic: 'erp.invoice.created'
  t: number
  invoiceNo: string
  orderNo: string
  amount: number
}

export type ErpEvent =
  | OrderCreatedEvent
  | MrpRunEvent
  | PlannedOrderCreatedEvent
  | ProdOrderReleasedEvent
  | ProdOrderStatusEvent
  | GoodsMovementEvent
  | PoCreatedEvent
  | PoReceivedEvent
  | GlPostingEvent
  | InvoiceCreatedEvent

export type ErpTopic = ErpEvent['topic']
