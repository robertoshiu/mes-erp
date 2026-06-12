import type { ModuleRoute } from '@/lib/uiStore'
import type { TourDefinition } from '../types'

/**
 * Tour catalog entry point. This module is eager-safe: it statically imports
 * ONLY the tiny `meta.ts` catalog. The heavy bilingual step content in
 * `full-tour.ts` is pulled in exclusively through dynamic `import()` inside the
 * loaders below, so it lands in its own chunk and never bloats the main bundle.
 */
export { tourMeta, type TourMeta } from './meta'

/** Lazily load a fully-assembled tour by id (null when no such tour). */
export async function loadTourById(id: string): Promise<TourDefinition | null> {
  const m = await import('./full-tour')
  return m.getTourById(id)
}

/** Lazily derive the single-page mini-tour for a module route (null when none). */
export async function loadModuleTour(route: ModuleRoute): Promise<TourDefinition | null> {
  const m = await import('./full-tour')
  return m.deriveModuleTour(route)
}
