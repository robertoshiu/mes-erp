/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  fullTour,
  allTours,
  getTourById,
  deriveModuleTour,
  chapterWelcome,
  chapterMes,
  chapterErp,
  chapterScm,
  chapterFinale,
} from './full-tour'
import { tourMeta } from './meta'
import type { ModuleRoute } from '@/lib/uiStore'
import type { AppTopic } from '@/lib/events'

/* ──────────────────────────────────────────────────────────────────────────
 * Tour CONTENT invariants. These assert that the authored tour content stays
 * in agreement with the rest of the codebase (routes, bus topics, and the
 * `data-tour` attributes actually tagged in the modules) — the things a manual
 * smoke test can't exhaustively guarantee.
 * ────────────────────────────────────────────────────────────────────────── */

const SRC_DIR = path.resolve(__dirname, '../..') // .../src

// The set of valid ModuleRoute strings (kept in sync with uiStore.ModuleRoute).
const VALID_ROUTES: ReadonlySet<ModuleRoute> = new Set<ModuleRoute>([
  'fab-floor', 'production', 'equipment', 'spc', 'recipe', 'alarms', 'kpi',
  'erp-cockpit', 'materials', 'business-partners', 'bom', 'sales-orders', 'mrp',
  'production-orders', 'inventory', 'procurement', 'finance',
  'control-tower', 'shipments', 'demand-planning', 'supplier-scorecards',
  'handbook',
])

// The set of valid bus topics (kept in sync with AppEvent['topic']).
const VALID_TOPICS: ReadonlySet<AppTopic> = new Set<AppTopic>([
  // MES
  'lot.move', 'equip.state', 'spc.violation', 'alarm.raised', 'alarm.ack',
  'recipe.load', 'kpi.tick', 'shift.boundary', 'lot.complete',
  // ERP
  'erp.order.created', 'erp.plannedorder.created', 'erp.mrp.run',
  'erp.prodorder.released', 'erp.prodorder.status', 'erp.goods.movement',
  'erp.invoice.created', 'erp.gl.posting', 'erp.po.created', 'erp.po.received',
  // SCM
  'scm.shipment.created', 'scm.shipment.departed', 'scm.shipment.arrived',
  'scm.shipment.delivered', 'scm.disruption.raised', 'scm.disruption.cleared',
  'scm.forecast.updated', 'scm.atp.promised', 'scm.supplier.asn',
] as AppTopic[])

/** Recursively collect every data-tour / dataTour value tagged under src/. */
function collectDataTourTargets(dir: string, acc: Set<string>): Set<string> {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectDataTourTargets(full, acc)
      continue
    }
    if (!/\.(tsx?|jsx?)$/.test(name)) continue
    // Skip the tour content/test files themselves — they reference targets as
    // string literals, not as rendered attributes.
    if (full.includes(path.join('tour', 'tours'))) continue
    const src = readFileSync(full, 'utf8')
    // Matches both <div data-tour="x"> and the MasterDataModule dataTour="x" prop.
    const re = /\bdata-?[Tt]our=["']([^"']+)["']/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      // Ignore the dynamic `${step.target}` spread in TourController.
      if (m[1].includes('${')) continue
      acc.add(m[1])
    }
  }
  return acc
}

const TAGGED_TARGETS = collectDataTourTargets(SRC_DIR, new Set<string>())

const allSteps = fullTour.chapters.flatMap(c => c.steps)

describe('full-tour content', () => {
  it('sanity: collected a non-trivial set of data-tour targets from src/', () => {
    expect(TAGGED_TARGETS.size).toBeGreaterThan(20)
  })

  describe('step.route', () => {
    it('every step route is a valid ModuleRoute', () => {
      for (const step of allSteps) {
        if (step.route === undefined) continue
        expect(VALID_ROUTES.has(step.route), `bad route on step ${step.id}: ${step.route}`).toBe(true)
      }
    })
  })

  describe('step.target', () => {
    it('every step target appears as a data-tour attribute somewhere under src/', () => {
      const missing: string[] = []
      for (const step of allSteps) {
        if (!step.target) continue
        if (!TAGGED_TARGETS.has(step.target)) missing.push(`${step.id} -> ${step.target}`)
      }
      expect(missing, `targets with no data-tour attribute: ${missing.join(', ')}`).toEqual([])
    })
  })

  describe('step.waitFor', () => {
    it('every waitFor.topic is a valid bus topic', () => {
      for (const step of allSteps) {
        if (!step.waitFor) continue
        expect(VALID_TOPICS.has(step.waitFor.topic), `bad waitFor topic on ${step.id}: ${step.waitFor.topic}`).toBe(true)
        expect(step.waitFor.timeoutMs).toBeGreaterThan(0)
      }
    })
  })

  describe('step ids', () => {
    it('are globally unique across the full tour', () => {
      const ids = allSteps.map(s => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('assembled tour structure', () => {
    it('fullTour has the 5 expected chapters in order', () => {
      expect(fullTour.chapters.map(c => c.id)).toEqual(['welcome', 'mes', 'erp', 'scm', 'finale'])
    })

    it('chapter step counts are stable', () => {
      // Actual authored counts (the inline header comments are approximate).
      expect(chapterWelcome.steps).toHaveLength(5)
      expect(chapterMes.steps).toHaveLength(14)
      expect(chapterErp.steps).toHaveLength(12)
      expect(chapterScm.steps).toHaveLength(5)
      expect(chapterFinale.steps).toHaveLength(6)
    })
  })

  describe('meta / chapterCount consistency', () => {
    it('each tour meta chapterCount matches its assembled tour chapter count', () => {
      for (const meta of tourMeta) {
        const tour = getTourById(meta.id)
        expect(tour, `no tour for meta ${meta.id}`).not.toBeNull()
        expect(tour!.chapters.length, `chapterCount mismatch for ${meta.id}`).toBe(meta.chapterCount)
      }
    })

    it('getTourById returns null for an unknown id', () => {
      expect(getTourById('nope')).toBeNull()
    })

    it('every catalog meta id resolves to a real assembled tour', () => {
      for (const meta of tourMeta) {
        expect(allTours.some(t => t.id === meta.id)).toBe(true)
      }
    })
  })

  describe('deriveModuleTour', () => {
    it('returns a single-chapter tour whose steps all share the route', () => {
      const t = deriveModuleTour('production')
      expect(t).not.toBeNull()
      expect(t!.chapters).toHaveLength(1)
      expect(t!.chapters[0].steps.every(s => s.route === 'production')).toBe(true)
      expect(t!.id).toBe('module:production')
    })

    it('excludes welcome and finale chapters (no fab-floor welcome bleed-in)', () => {
      // fab-floor appears in the welcome chapter (orientation) AND as the first
      // MES step. Only the MES-domain fab-floor step should derive.
      const welcomeFabFloorIds = chapterWelcome.steps.filter(s => s.route === 'fab-floor').map(s => s.id)
      const t = deriveModuleTour('fab-floor')
      expect(t).not.toBeNull()
      const derivedIds = t!.chapters[0].steps.map(s => s.id)
      for (const id of welcomeFabFloorIds) {
        expect(derivedIds, `welcome step ${id} bled into module tour`).not.toContain(id)
      }
      // And the finale's erp-cockpit recap steps must not appear in an erp-cockpit tour.
      const finaleCockpitIds = chapterFinale.steps.filter(s => s.route === 'erp-cockpit').map(s => s.id)
      const ct = deriveModuleTour('erp-cockpit')
      const ctIds = ct!.chapters[0].steps.map(s => s.id)
      for (const id of finaleCockpitIds) {
        expect(ctIds, `finale step ${id} bled into module tour`).not.toContain(id)
      }
    })

    it('returns null for a route with no domain-chapter steps', () => {
      expect(deriveModuleTour('handbook')).toBeNull()
    })
  })
})
