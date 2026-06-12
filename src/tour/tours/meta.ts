import type { I18nText } from '../types'

/**
 * Eager, tiny tour catalog metadata. This module is intentionally free of any
 * step content so it can be statically imported by the eager app shell (the
 * TourCenter list) WITHOUT pulling the ~35KB bilingual `full-tour.ts` content
 * into the main chunk. The full content (chapters/steps) is loaded lazily via
 * `loadTourById` / `loadModuleTour` in `index.ts`.
 *
 * `full-tour.ts` imports these same title/description strings so the catalog
 * copy lives in exactly one place.
 */
export interface TourMeta {
  id: string
  title: I18nText
  description: I18nText
  estMinutes: number
  chapterCount: number
}

export const FULL_TOUR_META: TourMeta = {
  id: 'full-flow',
  title: { zh: '完整作業流程導覽', en: 'Full Operations Flow' },
  description: {
    zh: '從 MES 製造執行、ERP 企業資源到 SCM 供應鏈的端到端跨域導覽。',
    en: 'An end-to-end cross-domain walkthrough from MES execution through ERP to the SCM supply chain.',
  },
  estMinutes: 11,
  chapterCount: 5,
}

export const MES_TOUR_META: TourMeta = {
  id: 'mes-tour',
  title: { zh: 'MES 製造執行導覽', en: 'MES Execution Tour' },
  description: {
    zh: '聚焦製造執行:車間、生產、機台、SPC、配方、警報、KPI。',
    en: 'Focused on manufacturing execution: floor, production, equipment, SPC, recipe, alarms, KPI.',
  },
  estMinutes: 6,
  chapterCount: 2,
}

export const ERP_TOUR_META: TourMeta = {
  id: 'erp-tour',
  title: { zh: 'ERP 企業資源導覽', en: 'ERP Resource Planning Tour' },
  description: {
    zh: '聚焦企業資源:單據流、銷售訂單、MRP、生產單、庫存、採購、主檔、財務。',
    en: 'Focused on resource planning: document flow, sales orders, MRP, production orders, inventory, procurement, master data, finance.',
  },
  estMinutes: 6,
  chapterCount: 2,
}

export const SCM_TOUR_META: TourMeta = {
  id: 'scm-tour',
  title: { zh: 'SCM 供應鏈導覽', en: 'SCM Supply Chain Tour' },
  description: {
    zh: '聚焦供應鏈:控制塔網絡、出貨、需求規劃、供應商評分卡,並以跨域終章收尾。',
    en: 'Focused on the supply chain: control tower network, shipments, demand planning, supplier scorecards, capped by the cross-domain finale.',
  },
  estMinutes: 5,
  chapterCount: 3,
}

/** Catalog order shown in the Tour Center. */
export const tourMeta: TourMeta[] = [
  FULL_TOUR_META,
  MES_TOUR_META,
  ERP_TOUR_META,
  SCM_TOUR_META,
]
