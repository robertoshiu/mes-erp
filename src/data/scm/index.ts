import type { MasterData } from '../master'
import type { ErpData } from '../erp/types'
import type { ScmData } from './types'

import { generateNetworkNodes } from './networkNodes'
import { generateLanes } from './lanes'
import { generateForecasts } from './forecasts'
import { generateShipments } from './shipments'
import { generateScorecards } from './scorecards'
import { generateAtpPromises } from './atpPromises'

/**
 * Build the full SCM data set from the existing MES master data + the generated
 * ERP data, in dependency order so everything cross-references consistently:
 *   networkNodes (from ERP vendor/customer BPs)  -> lanes (wire the nodes)
 *   materials (FERT)                              -> forecasts
 *   nodes + lanes + purchase/sales orders         -> seeded in-flight shipments
 *   vendor BPs                                    -> supplier scorecards
 *   open sales orders                             -> ATP promises
 * Fully deterministic: given the same MES+ERP input it returns deep-equal output
 * (mirrors generateErpData). `masterData` is accepted for parity with the ERP
 * generator and future master-keyed extensions; SCM keys off ERP today.
 */
export function generateScmData(_masterData: MasterData, erpData: ErpData): ScmData {
  const networkNodes = generateNetworkNodes(erpData.businessPartners)
  const lanes = generateLanes(networkNodes)

  const forecasts = generateForecasts(erpData.materials)
  const shipments = generateShipments(
    networkNodes,
    lanes,
    erpData.purchaseOrders,
    erpData.salesOrders,
  )
  const scorecards = generateScorecards(erpData.businessPartners)
  const atpPromises = generateAtpPromises(erpData.salesOrders)

  return {
    networkNodes,
    lanes,
    forecasts,
    shipments,
    scorecards,
    atpPromises,
  }
}

// Re-export the entity types for convenience.
export type {
  NodeKind,
  NetworkNode,
  LaneMode,
  Lane,
  Forecast,
  ShipmentDirection,
  ShipmentStatus,
  Shipment,
  SupplierScorecard,
  AtpPromise,
  ScmData,
} from './types'
