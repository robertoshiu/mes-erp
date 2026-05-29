import type { MasterData } from '../master'
import type { ErpData } from './types'

import { generateMaterials } from './materials'
import { generateBusinessPartners } from './businessPartners'
import { generateBoms } from './bom'
import { generateCostCenters } from './costCenters'
import { generateWorkCenters } from './workCenters'
import { generateGlAccounts } from './glAccounts'
import { generatePlants } from './plants'
import { generateSalesOrders } from './salesOrders'
import { generatePurchaseOrders } from './purchaseOrders'
import { generateProductionOrders } from './productionOrders'
import { generateInventory } from './inventory'

// Fixed per-generator seeds — keep these stable to preserve determinism.
const SEED_SALES_ORDERS = 600
const SEED_PURCHASE_ORDERS = 610
const SEED_PRODUCTION_ORDERS = 620
const SEED_INVENTORY = 630

/**
 * Build the full ERP data set from the existing MES master data, in dependency
 * order so everything cross-references consistently:
 *   plants, glAccounts                  (independent)
 *   costCenters -> workCenters          (workCenters reference cost centers)
 *   materials   -> boms, inventory, orders
 *   businessPartners -> sales/purchase orders
 *   materials + routes + salesOrders -> productionOrders
 * Fully deterministic: given the same MasterData it returns deep-equal output.
 */
export function generateErpData(masterData: MasterData): ErpData {
  const plants = generatePlants()
  const glAccounts = generateGlAccounts()

  const costCenters = generateCostCenters(masterData)
  const workCenters = generateWorkCenters(masterData, costCenters)

  const materials = generateMaterials(masterData)
  const businessPartners = generateBusinessPartners(masterData)
  const boms = generateBoms(materials)
  const inventory = generateInventory(materials, plants, SEED_INVENTORY)

  const salesOrders = generateSalesOrders(materials, businessPartners, SEED_SALES_ORDERS)
  const purchaseOrders = generatePurchaseOrders(materials, businessPartners, SEED_PURCHASE_ORDERS)
  const productionOrders = generateProductionOrders(
    materials,
    masterData.routes,
    salesOrders,
    SEED_PRODUCTION_ORDERS,
  )

  return {
    materials,
    businessPartners,
    boms,
    workCenters,
    costCenters,
    glAccounts,
    plants,
    salesOrders,
    purchaseOrders,
    productionOrders,
    inventory,
  }
}

// Re-export the entity types for convenience.
export type {
  MaterialType,
  Material,
  BusinessPartner,
  BomComponent,
  Bom,
  WorkCenter,
  CostCenter,
  GlAccount,
  Plant,
  SalesOrderLine,
  OrderStatus,
  SalesOrder,
  PurchaseOrderLine,
  PurchaseOrder,
  ProdOrderStatus,
  ProductionOrder,
  InventoryRow,
  BridgedLot,
  ErpData,
} from './types'
