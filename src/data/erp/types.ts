// ERP master + transactional entity shapes. Mirrors the MES master-data style.
// These are the data contracts the ERP generators, engine, bridge, and modules share.

export type MaterialType = 'FERT' | 'HALB' | 'ROH' // finished / semi / raw

export interface Material {
  materialNo: string
  type: MaterialType
  description: string
  baseUoM: string            // EA, WAF, L, KG, ...
  materialGroup: string
  plant: string
  valuationClass: string
  standardCost: number       // per base unit
  leadTimeDays: number
  /** Finished goods link back to the MES product code. */
  productCode?: string
}

export interface BusinessPartner {
  bpNo: string
  role: 'customer' | 'vendor' | 'both'
  name: string
  country: string
  paymentTerms: string       // NET30, NET60, ...
  incoterms: string          // FOB, DDP, ...
  creditLimit: number
}

export interface BomComponent {
  materialNo: string
  description: string
  qty: number
  uom: string
}

export interface Bom {
  bomId: string
  headerMaterialNo: string
  headerDescription: string
  components: BomComponent[]
}

export interface WorkCenter {
  workCenterId: string
  name: string
  toolType: string
  costCenterId: string
  bay: string
  capacityHrs: number
}

export interface CostCenter {
  costCenterId: string
  name: string
  area: string
  plant: string
}

export interface GlAccount {
  accountNo: string
  name: string
  type: 'asset' | 'liability' | 'revenue' | 'expense'
}

export interface Plant {
  plantId: string
  name: string
  storageLocations: string[]
}

export interface SalesOrderLine {
  lineNo: number
  materialNo: string
  description: string
  qty: number
  netPrice: number
}

export type OrderStatus = 'open' | 'in-process' | 'complete' | 'hold'

export interface SalesOrder {
  orderNo: string
  bpNo: string
  customerName: string
  orderDate: string
  requestedDate: string
  status: OrderStatus
  priority: 'normal' | 'hot' | 'super-hot'
  lines: SalesOrderLine[]
  netValue: number
}

export interface PurchaseOrderLine {
  lineNo: number
  materialNo: string
  description: string
  qty: number
  netPrice: number
}

export interface PurchaseOrder {
  poNo: string
  bpNo: string
  vendorName: string
  orderDate: string
  deliveryDate: string
  status: 'open' | 'confirmed' | 'received' | 'late'
  lines: PurchaseOrderLine[]
  netValue: number
}

export type ProdOrderStatus = 'Created' | 'Released' | 'InProcess' | 'Completed'

export interface ProductionOrder {
  orderNo: string
  materialNo: string
  description: string
  routeId: string
  targetQty: number
  status: ProdOrderStatus
  salesOrderNo: string | null
  /** Set once the bridge drops this order onto the floor as a lot. */
  lotId: string | null
}

export interface InventoryRow {
  materialNo: string
  description: string
  plant: string
  storageLoc: string
  onHand: number
  committed: number
  available: number
}

/** A lot created by the bridge from a released production order — the shared
 *  object shown on the Fab Floor, in Production, and in ERP Production Orders. */
export interface BridgedLot {
  lotId: string
  prodOrderNo: string
  materialNo: string
  productCode: string
  routeId: string
  totalSteps: number
  currentStep: number
  status: 'in-process' | 'complete'
  startedT: number
}

export interface ErpData {
  materials: Material[]
  businessPartners: BusinessPartner[]
  boms: Bom[]
  workCenters: WorkCenter[]
  costCenters: CostCenter[]
  glAccounts: GlAccount[]
  plants: Plant[]
  salesOrders: SalesOrder[]
  purchaseOrders: PurchaseOrder[]
  productionOrders: ProductionOrder[]
  inventory: InventoryRow[]
}
