import type { EventBus } from '../../lib/eventBus'
import type { ErpData } from '../../data/erp/types'

/** Shared props for every ERP module. Static screens use only `erpData`;
 *  live screens (Cockpit, Finance, MRP, Production Orders) also use `eventBus`. */
export interface ErpModuleProps {
  erpData: ErpData
  eventBus: EventBus
}
