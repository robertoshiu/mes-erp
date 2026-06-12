# TODOS

## Dashboard UI/UX

### Execute the 30-item UI/UX improvement plan

**What:** Work through `.omo/plans/ui-ux-improvements.md` — 30 reviewed tasks covering badge unbounding, cross-domain click-through, ring-buffer backfill, a11y baseline (ARIA), error handling.

**Why:** The plan was reviewed and expanded (13→30 tasks) but never executed. It fixes known paper cuts: sidebar alarm/equipment badges climbing every 180s loop, DrillInPanel occlusion, keyboard/focus/aria-sort gaps.

**Context:** Plan file has the full dependency graph (Task 1 → Task 14 → Task 2 → chains). All in-place edits, no new dependencies. Estimated 4-6 focused sessions.

**Effort:** XL
**Priority:** P2
**Depends on:** None

### Remove recharts width(-1) console warning

**What:** Eliminate the recurring `The width(-1) and height(-1) of chart should be greater than 0` console warning from Recharts ResponsiveContainer.

**Why:** Noise in every QA session; masks real console errors during testing.

**Context:** Fires when chart containers measure before layout settles (seen on KPI/SPC navigation). Already tracked as a task inside the UI/UX plan; listed separately because it pollutes automated QA console checks.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Guided Tour

### Tune finale waitFor timeout against loop phase

**What:** `finale-watch-live` holds up to 30s waiting for `erp.goods.movement`; depending on where the 180s loop clock sits, users may wait the full timeout staring at the "waiting for live event" line.

**Why:** A 30s dead-end on the second-to-last tour step is a weak ending for an otherwise tight flagship tour.

**Context:** Adversarial review INVESTIGATE finding. Options: shorten timeout, pick a more frequent topic, or narrate the wait with loop-phase awareness (clock is deterministic — `loopT()` is available).

**Effort:** S
**Priority:** P3
**Depends on:** None

## Completed
