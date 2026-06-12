import { describe, it, expect } from 'vitest'
import { handbookEntries } from './handbook-content'
import type { ModuleRoute } from '@/lib/uiStore'
import type { AppTopic } from '@/lib/events'

/* ──────────────────────────────────────────────────────────────────────────
 * Handbook CONTENT invariants. The handbook is hand-authored data that claims
 * agreement with the real routes and bus topics; these tests pin that down.
 * ────────────────────────────────────────────────────────────────────────── */

const VALID_ROUTES: ReadonlySet<ModuleRoute> = new Set<ModuleRoute>([
  'fab-floor', 'production', 'equipment', 'spc', 'recipe', 'alarms', 'kpi',
  'erp-cockpit', 'materials', 'business-partners', 'bom', 'sales-orders', 'mrp',
  'production-orders', 'inventory', 'procurement', 'finance',
  'control-tower', 'shipments', 'demand-planning', 'supplier-scorecards',
  'handbook',
])

const VALID_TOPICS: ReadonlySet<string> = new Set<AppTopic>([
  'lot.move', 'equip.state', 'spc.violation', 'alarm.raised', 'alarm.ack',
  'recipe.load', 'kpi.tick', 'shift.boundary', 'lot.complete',
  'erp.order.created', 'erp.plannedorder.created', 'erp.mrp.run',
  'erp.prodorder.released', 'erp.prodorder.status', 'erp.goods.movement',
  'erp.invoice.created', 'erp.gl.posting', 'erp.po.created', 'erp.po.received',
  'scm.shipment.created', 'scm.shipment.departed', 'scm.shipment.arrived',
  'scm.shipment.delivered', 'scm.disruption.raised', 'scm.disruption.cleared',
  'scm.forecast.updated', 'scm.atp.promised', 'scm.supplier.asn',
] as AppTopic[])

const ids = new Set(handbookEntries.map(e => e.id))

describe('handbook-content', () => {
  it('has 21 module entries + 4 system topics (25 total)', () => {
    const modules = handbookEntries.filter(e => e.kind === 'module')
    const topics = handbookEntries.filter(e => e.kind === 'topic')
    expect(modules).toHaveLength(21)
    expect(topics).toHaveLength(4)
    expect(handbookEntries).toHaveLength(25)
  })

  it('has unique entry ids', () => {
    expect(ids.size).toBe(handbookEntries.length)
  })

  describe('module entries', () => {
    const modules = handbookEntries.filter(e => e.kind === 'module')

    it('every module entry carries a valid ModuleRoute (and id === route)', () => {
      for (const e of modules) {
        expect(e.route, `module ${e.id} missing route`).toBeDefined()
        expect(VALID_ROUTES.has(e.route as ModuleRoute), `module ${e.id} bad route ${e.route}`).toBe(true)
        expect(e.id, `module ${e.id} id != route`).toBe(e.route)
      }
    })

    it('covers every non-handbook ModuleRoute exactly once', () => {
      const covered = new Set(modules.map(m => m.route))
      for (const r of VALID_ROUTES) {
        if (r === 'handbook') continue // the handbook page documents others, not itself
        expect(covered.has(r), `no handbook entry for route ${r}`).toBe(true)
      }
    })

    it('has the standard 4 sections each', () => {
      for (const e of modules) {
        expect(e.sections, `module ${e.id} section count`).toHaveLength(4)
      }
    })
  })

  describe('system topics', () => {
    it('all four expected system topic slugs are present', () => {
      for (const slug of ['loop-clock', 'event-bus', 'mes-erp-bridge', 'scm-driver']) {
        expect(ids.has(slug), `missing system topic ${slug}`).toBe(true)
      }
    })

    it('system topics have domain SYSTEM and no route', () => {
      for (const e of handbookEntries.filter(e => e.kind === 'topic')) {
        expect(e.domain).toBe('SYSTEM')
        expect(e.route).toBeUndefined()
      }
    })
  })

  describe('events[]', () => {
    it('every listed event is a real bus topic', () => {
      const bad: string[] = []
      for (const e of handbookEntries) {
        for (const ev of e.events ?? []) {
          if (!VALID_TOPICS.has(ev)) bad.push(`${e.id} -> ${ev}`)
        }
      }
      expect(bad, `unknown event topics: ${bad.join(', ')}`).toEqual([])
    })
  })

  describe('related[]', () => {
    it('every related id resolves to a real entry', () => {
      const bad: string[] = []
      for (const e of handbookEntries) {
        for (const rel of e.related ?? []) {
          if (!ids.has(rel)) bad.push(`${e.id} -> ${rel}`)
        }
      }
      expect(bad, `dangling related ids: ${bad.join(', ')}`).toEqual([])
    })

    it('no entry lists itself as related', () => {
      for (const e of handbookEntries) {
        expect(e.related ?? [], `${e.id} relates to itself`).not.toContain(e.id)
      }
    })
  })

  describe('i18n completeness', () => {
    it('every I18nText field has both zh and en non-empty', () => {
      const check = (t: { zh: string; en: string } | undefined, where: string) => {
        expect(t?.zh?.length, `${where} missing zh`).toBeGreaterThan(0)
        expect(t?.en?.length, `${where} missing en`).toBeGreaterThan(0)
      }
      for (const e of handbookEntries) {
        check(e.title, `${e.id}.title`)
        check(e.tagline, `${e.id}.tagline`)
        for (const s of e.sections) {
          check(s.heading, `${e.id}.section.heading`)
          check(s.body, `${e.id}.section.body`)
        }
      }
    })
  })
})
