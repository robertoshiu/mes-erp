# Changelog

All notable changes to FabPulse are documented in this file.

Format: `## [MAJOR.MINOR.PATCH.MICRO] - YYYY-MM-DD` with Added / Changed / Fixed / Removed sections.

## [1.1.3.0] - 2026-06-19

### Fixed
- **Guided tour now follows you when you pause and click through manually.** Pausing the tour and then stepping with Next / → used to leave the card describing a screen you weren't on — the step changed but the app never switched to that step's screen, so the highlight had nothing to point at and drifted to the center. Stepping while paused now navigates to each step's screen just like autoplay does, so the spotlight always frames the right thing. Clicking the sidebar to look around while paused still leaves you where you are until you advance a step or resume.

## [1.1.2.0] - 2026-06-19

### Fixed
- **Guided tour overlay no longer collides with the layout.** On screens whose hero fills most of the view (the document-flow swimlanes, and the other full-width heroes), the description card was clamping to the far-left edge and landing on top of the left navigation menu — far from the visual it was describing. The card now stays in the main content column and never covers the sidebar. The dim spotlight veil also kept the entire side menu darkened and un-clickable during the tour; it now leaves the sidebar bright and usable on every step, while still framing it correctly on the step that highlights the nav itself. And the highlight frame is re-measured once each screen's entrance animation settles, so it lands precisely on its target instead of a few pixels low while the hero animates in.

## [1.1.1.0] - 2026-06-13

### Fixed
- **Guided tour now matches the redesigned screens.** After the v1.1.0.0 visual upgrade the tour kept spotlighting the older tables and dimmed each screen's new hero visualization, so the highlight and the narration drifted out of sync with what's on screen. The tour now spotlights the new heroes directly — the equipment bay×tool state mosaic (previously a thin header sliver), the production-orders timeline, the inventory occupancy mosaic, the procurement PO pipeline, and the finance cash-position band — and 17 more steps now describe each screen's new visuals (WIP histogram, severity trend, KPI radar, seasonality heatmap, supplier podium, and more). The in-app Handbook copy was updated to match.

## [1.1.0.0] - 2026-06-13

### Added
- **Command-center headers on every screen** — all 21 modules now open with a cinematic header strip: a glowing display-font title (new Chakra Petch industrial typeface), a domain badge (MES / ERP / SCM), and live count-up KPI pills, so you can tell at a glance which area you're in and how it's performing.
- **A signature live visualization on every screen** — each page gained a purpose-built, real-data centerpiece: a storage-occupancy mosaic on Inventory, a purchase-order pipeline band on Procurement, a bay×tool equipment mosaic with 24-hour state history, an MRP coverage heatmap, an ATP coverage band on Sales Orders, an order timeline (Gantt) on Production Orders, a BOM cost roll-up tree, a cash-position band on Finance, document-flow lane sparklines on the Cockpit, a WIP-by-step histogram on Production, a recipe parameter radar, an alarm severity trend with a top-offenders ranking, sigma-zone bands and a CD distribution histogram on SPC, a normalized KPI radar, a shipment mode-split with busiest-lane ranking, a demand seasonality heatmap, and a supplier scorecard podium with per-supplier radar.
- **Denser data cells throughout** — tables and headers now carry inline heat bars, spark rings, trend deltas, ranked bar lists, and donut sparks instead of bare numbers.
- **Live event tickers** — Inventory, Procurement, Production, Finance, Shipments, and the Fab Floor now stream their domain events (movements, receipts, invoices, arrivals, wafer moves) across a ticker strip.

### Changed
- Every module was restyled to the dark "command center" system with ambient glow backdrops, animated accent rules, and staggered entrance reveals — a denser, higher-impact look benchmarked against industrial operations platforms.
- Headline numbers across the app now count up smoothly when their values change.

### Fixed
- Entrance and stagger motion is now fully suppressed for visitors who request reduced motion, matching the rest of the app's animations.
- Shipments and Inventory no longer re-subscribe their live event ticker on every clock tick, removing needless per-second churn.

### Removed
- Removed an unused internal table component left orphaned after the screen rewrites, and corrected the handbook copy that referenced it.

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
