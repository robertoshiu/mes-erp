import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Search, ExternalLink, Compass, Link2 } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { ModuleHeader } from '../../components/ui/ModuleHeader'
import { SparkRing } from '../../components/ui/SparkRing'
import { useUiStore } from '../../lib/uiStore'
import { cn } from '../../lib/utils'
import { useTourStore } from '../../tour/tourStore'
import { LangToggle } from '../../tour/LangToggle'
import { loadModuleTour } from '../../tour/tours'
import {
  handbookEntries,
  type HandbookEntry,
  type HandbookSection,
} from '../../tour/handbook-content'
import { renderBody } from '../../tour/richText'
import type { Lang, TourDefinition } from '../../tour/types'

/* ──────────────────────────────────────────────────────────────────────────
 * FabPulse Operations Handbook — two-pane bilingual docs.
 * Left: search + domain-grouped nav. Right: selected entry (sections, events,
 * related links) + open-page / tour-this-page actions + lang toggle.
 *
 * Derived per-page tours: "Tour this page" derives an ad-hoc single-page mini
 * tour for the selected module (deriveModuleTour, scoped to the route's domain
 * chapter steps) and starts it directly via startTourDef — so the page tour runs
 * at the right altitude instead of the full master tour.
 * ────────────────────────────────────────────────────────────────────────── */

const DOMAIN_ORDER: HandbookEntry['domain'][] = ['MES', 'ERP', 'SCM', 'SYSTEM']

const DOMAIN_LABEL: Record<HandbookEntry['domain'], string> = {
  MES: 'MES',
  ERP: 'ERP',
  SCM: 'SCM',
  SYSTEM: 'SYSTEM',
}

/** Domain chip tone: MES/ERP cyan, SCM indigo, SYSTEM slate. */
const DOMAIN_CHIP: Record<HandbookEntry['domain'], string> = {
  MES: 'bg-accent/15 text-accent border-accent/30',
  ERP: 'bg-accent/15 text-accent border-accent/30',
  SCM: 'bg-accent-3/15 text-accent-3 border-accent-3/30',
  SYSTEM: 'bg-surface-3 text-ink-3 border-edge',
}

/** Build the searchable haystack for an entry (both languages, all sections). */
function entryHaystack(e: HandbookEntry): string {
  const parts: string[] = [
    e.title.zh, e.title.en, e.tagline.zh, e.tagline.en,
    ...(e.events ?? []),
  ]
  for (const s of e.sections) {
    parts.push(s.heading.zh, s.heading.en, s.body.zh, s.body.en)
  }
  return parts.join('\n').toLowerCase()
}

/** UI copy, bilingual. */
const UI = {
  searchPh: { zh: '搜尋模組或主題…', en: 'Search modules or topics…' },
  noResults: { zh: '找不到符合的條目', en: 'No matching entries' },
  noResultsHint: { zh: '試試其他關鍵字，或清除搜尋。', en: 'Try a different term, or clear the search.' },
  openPage: { zh: '開啟頁面', en: 'Open page' },
  tourPage: { zh: '導覽此頁', en: 'Tour this page' },
  events: { zh: '相關事件', en: 'Related events' },
  related: { zh: '延伸閱讀', en: 'Related' },
  title: { zh: '操作手冊', en: 'Operations Handbook' },
} as const

function Section({ section, lang, idx }: { section: HandbookSection; lang: Lang; idx: number }) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        <span className="accent-tick min-h-[12px] self-stretch" aria-hidden />
        {section.heading[lang]}
      </h2>
      <div className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
        {renderBody(section.body[lang], `s${idx}`)}
      </div>
    </section>
  )
}

export default function Handbook() {
  const lang = useTourStore(s => s.lang)
  const startTourDef = useTourStore(s => s.startTourDef)
  const setRoute = useUiStore(s => s.setRoute)

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>('fab-floor')
  // Per-session "read" progress: entry ids the operator has opened. Drives the
  // chapter-progress SparkRings in the nav (visited / total per domain).
  const [visited, setVisited] = useState<Set<string>>(() => new Set(['fab-floor']))
  const searchRef = useRef<HTMLInputElement>(null)

  // Select an entry and mark it read in the same event-handler tick — keeping
  // the "visited" set in lockstep with selection without setting state inside an
  // effect (the read progress drives the chapter SparkRings in the nav).
  const selectEntry = useCallback((id: string) => {
    setSelectedId(id)
    setVisited(prev => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [])

  // Total entries per domain (denominator for the progress rings), all entries.
  const domainTotals = useMemo(() => {
    const m = new Map<HandbookEntry['domain'], number>()
    for (const e of handbookEntries) m.set(e.domain, (m.get(e.domain) ?? 0) + 1)
    return m
  }, [])

  // Precompute haystacks once.
  const haystacks = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of handbookEntries) m.set(e.id, entryHaystack(e))
    return m
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return handbookEntries
    return handbookEntries.filter(e => haystacks.get(e.id)?.includes(q))
  }, [query, haystacks])

  // Group filtered entries by domain, preserving DOMAIN_ORDER.
  const grouped = useMemo(() => {
    const byDomain = new Map<HandbookEntry['domain'], HandbookEntry[]>()
    for (const e of filtered) {
      const list = byDomain.get(e.domain) ?? []
      list.push(e)
      byDomain.set(e.domain, list)
    }
    return DOMAIN_ORDER
      .map(d => ({ domain: d, entries: byDomain.get(d) ?? [] }))
      .filter(g => g.entries.length > 0)
  }, [filtered])

  // The selected entry — fall back to the first filtered result if the current
  // selection got filtered out (or never existed).
  const selected: HandbookEntry | null = useMemo(() => {
    const inFiltered = filtered.find(e => e.id === selectedId)
    if (inFiltered) return inFiltered
    return filtered[0] ?? null
  }, [filtered, selectedId])

  const secondaryLang: Lang = lang === 'zh' ? 'en' : 'zh'

  const handleOpenPage = () => {
    if (selected?.kind === 'module' && selected.route) setRoute(selected.route)
  }

  // Route for which a per-page mini-tour might exist (null when the selection is
  // not a routed module). Derived in render so the effect below only ever calls
  // setState from inside an async callback (no synchronous cascading renders).
  const tourRoute = selected?.kind === 'module' ? selected.route ?? null : null

  // The ad-hoc page mini-tour for the selected module (null when none). The
  // derivation lives in the lazily-loaded tour-content chunk, so it's resolved
  // asynchronously on route change rather than synchronously in render.
  const [pageTour, setPageTour] = useState<TourDefinition | null>(null)
  useEffect(() => {
    let live = true
    const resolve = tourRoute ? loadModuleTour(tourRoute) : Promise.resolve(null)
    resolve.then(t => {
      if (live) setPageTour(t)
    }).catch(err => {
      console.error('[handbook] failed to load page tour', err)
    })
    return () => { live = false }
  }, [tourRoute])

  const handleTourPage = () => {
    if (!pageTour) return
    startTourDef(pageTour)
  }

  // Is there a startable per-page tour for the selected module?
  const tourAvailable = pageTour !== null

  return (
    <div className="flex flex-col h-full gap-4 p-4 bg-canvas bg-bloom animate-rise">
      <ModuleHeader
        title={UI.title.en}
        subtitle={UI.title.zh + ' · FabPulse'}
        domain="HELP"
        icon={<BookOpen size={13} strokeWidth={2} />}
        pills={[
          { label: 'Entries', value: handbookEntries.length, tone: 'info' },
          { label: 'Read', value: visited.size, tone: 'success' },
        ]}
      />

      <div className="flex flex-1 min-h-0 gap-4">
      {/* ─────────────── Left pane: search + nav ─────────────── */}
      <Panel className="w-[260px] shrink-0 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-edge">
          <span className="accent-tick self-stretch min-h-[20px]" aria-hidden />
          <BookOpen size={15} strokeWidth={1.9} className="text-accent" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-2">
            {UI.title[lang]}
          </span>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-edge">
          <div className="relative">
            <Search
              size={13}
              strokeWidth={2}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={UI.searchPh[lang]}
              aria-label={UI.searchPh[lang]}
              className="w-full rounded-md border border-edge bg-surface-3/40 pl-8 pr-2.5 py-1.5 text-[12px] text-ink-1 placeholder:text-ink-3 focus:outline-none focus:border-edge-strong focus:ring-1 focus:ring-accent/40 transition-colors"
            />
          </div>
        </div>

        {/* Nav list */}
        <div className="flex-1 overflow-y-auto">
          {grouped.length === 0 && (
            <div className="px-3.5 py-6 text-center text-[11px] text-ink-3">
              {UI.noResults[lang]}
            </div>
          )}
          {grouped.map(({ domain, entries }) => {
            const total = domainTotals.get(domain) ?? entries.length
            const read = entries.reduce((acc, e) => acc + (visited.has(e.id) ? 1 : 0), 0)
            return (
            <div key={domain}>
              <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-ink-mute">
                  {DOMAIN_LABEL[domain]}
                </span>
                <span
                  className="ml-auto flex items-center gap-1"
                  title={`${read} / ${total} read`}
                >
                  <SparkRing value={read} max={total} size={16} tone="auto" />
                  <span className="font-mono text-[9px] text-ink-mute tabular-nums">{read}/{total}</span>
                </span>
              </div>
              {entries.map(e => {
                const active = selected?.id === e.id
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => selectEntry(e.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'group relative w-full text-left pl-4 pr-3 py-2 border-b border-edge/50 cursor-pointer transition-colors',
                      active ? 'bg-surface-3' : 'hover:bg-surface-3/50',
                    )}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent"
                        style={{ boxShadow: '0 0 8px var(--accent-glow)' }}
                        aria-hidden
                      />
                    )}
                    <div className={cn('text-[12px] leading-tight truncate', active ? 'text-accent font-semibold' : 'text-ink-1')}>
                      {e.title[lang]}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-tight text-ink-3 truncate">
                      {e.tagline[lang]}
                    </div>
                  </button>
                )
              })}
            </div>
            )
          })}
        </div>
      </Panel>

      {/* ─────────────── Right pane: content ─────────────── */}
      <Panel className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <BookOpen size={32} strokeWidth={1.5} className="text-ink-mute" />
            <div className="text-sm text-ink-2">{UI.noResults[lang]}</div>
            <div className="text-[12px] text-ink-3">{UI.noResultsHint[lang]}</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 px-4 py-3 border-b border-edge">
              <span className="accent-tick self-stretch min-h-[34px]" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[9px] font-semibold uppercase tracking-[0.14em]',
                      DOMAIN_CHIP[selected.domain],
                    )}
                  >
                    {DOMAIN_LABEL[selected.domain]}
                  </span>
                  <h1 className="text-base font-semibold text-ink-1 text-glow-soft truncate">
                    {selected.title[lang]}
                  </h1>
                  <span className="text-[12px] text-ink-3 truncate">{selected.title[secondaryLang]}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-ink-3 truncate">{selected.tagline[lang]}</p>
              </div>

              {/* Lang toggle */}
              <LangToggle />
            </div>

            {/* Action buttons */}
            {selected.kind === 'module' && (
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-edge">
                <button
                  type="button"
                  onClick={handleOpenPage}
                  className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-surface-3/50 px-2.5 py-1.5 text-[12px] text-ink-1 hover:border-edge-strong hover:bg-surface-3 cursor-pointer transition-colors"
                >
                  <ExternalLink size={13} strokeWidth={2} />
                  {UI.openPage.zh} / {UI.openPage.en}
                </button>
                {tourAvailable && (
                  <button
                    type="button"
                    onClick={handleTourPage}
                    className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 px-2.5 py-1.5 text-[12px] font-semibold text-accent hover:bg-accent/25 hover:border-accent/60 cursor-pointer transition-colors glow-cyan"
                  >
                    <Compass size={13} strokeWidth={2} />
                    {UI.tourPage.zh} / {UI.tourPage.en}
                  </button>
                )}
              </div>
            )}

            {/* Sections + events + related (own scroll) */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {selected.sections.map((s, i) => (
                <Section key={i} section={s} lang={lang} idx={i} />
              ))}

              {selected.events && selected.events.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                    <span className="accent-tick min-h-[12px] self-stretch" aria-hidden />
                    {UI.events[lang]}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.events.map(ev => (
                      <code
                        key={ev}
                        className="font-mono text-[11px] text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5"
                      >
                        {ev}
                      </code>
                    ))}
                  </div>
                </section>
              )}

              {selected.related && selected.related.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                    <span className="accent-tick min-h-[12px] self-stretch" aria-hidden />
                    {UI.related[lang]}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.related.map(rid => {
                      const target = handbookEntries.find(e => e.id === rid)
                      if (!target) return null
                      return (
                        <button
                          key={rid}
                          type="button"
                          onClick={() => selectEntry(rid)}
                          className="group inline-flex items-center gap-1 rounded-md border border-edge bg-surface-3/40 px-2 py-1 text-[11px] text-ink-2 hover:text-accent hover:border-accent/40 cursor-pointer transition-colors"
                        >
                          <Link2 size={11} strokeWidth={2} className="text-ink-mute group-hover:text-accent transition-colors" />
                          {target.title[lang]}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </Panel>
      </div>
    </div>
  )
}
