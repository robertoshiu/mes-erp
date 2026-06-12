# Changelog

All notable changes to FabPulse are documented in this file.

Format: `## [MAJOR.MINOR.PATCH.MICRO] - YYYY-MM-DD` with Added / Changed / Fixed / Removed sections.

## [1.0.0.0] - 2026-06-12

### Added
- **Guided tour** — a bilingual (繁中/EN) 42-step auto-navigating tour across all 21 modules in 5 chapters (Welcome, MES, ERP, SCM, cross-domain finale). The tour drives the app itself: it switches pages, spotlights the panel being explained, opens a real lot's drill-in detail, and holds on two steps until live simulation events (`equip.state`, `erp.goods.movement`) actually fire so the narration matches what's on screen.
- **Tour Center** — the `?` button (or `?` key) opens a catalog of four tours (full flow + MES / ERP / SCM) with estimated minutes and completion tracking that persists across visits.
- **Operations Handbook** — a new searchable reference page documenting every module plus four system topics (loop clock, event bus, MES→ERP bridge, SCM driver) in both languages, with "Open page" and "Tour this page" deep links.
- **First-visit welcome** — new visitors get a one-time prompt to start the full tour, browse the Tour Center, or skip.
- Keyboard control throughout: `←`/`→` step, `Space` pause/resume, `Esc` close, `?` help.

### Changed
- Tour and handbook content load on demand, keeping the initial bundle 27 kB smaller than before the feature.
- Clicking a sidebar route while a tour is auto-playing now pauses the tour instead of fighting your navigation; resume picks up where it left off.
