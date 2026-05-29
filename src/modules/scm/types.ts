import type { EventBus } from '../../lib/eventBus'
import type { ScmData } from '../../data/scm/types'

/** Shared props for every SCM module. Static screens use only `scmData`;
 *  live screens (Control Tower, Shipments) also use `eventBus`. Mirrors ErpModuleProps. */
export interface ScmModuleProps {
  scmData: ScmData
  eventBus: EventBus
}
