import type { ModuleRoute } from '@/lib/uiStore'
import type { I18nText } from './types'

/* ──────────────────────────────────────────────────────────────────────────
 * FabPulse Operations Handbook — bilingual (zh-TW primary, EN) documentation
 * data. One entry per module (21) + 4 SYSTEM topics describing the simulation
 * substrate (loop clock, event bus, MES→ERP bridge, SCM shipment driver).
 *
 * Every description reflects what the module ACTUALLY renders and which real
 * event topics it consumes/emits — sourced from the module source and the
 * events.ts / erpEvents.ts / scmEvents.ts unions.
 * ────────────────────────────────────────────────────────────────────────── */

export interface HandbookSection {
  /** Section heading, e.g. 用途 / Purpose. */
  heading: I18nText
  /** Body text — supports `**bold**`, `` `code` `` and double-newline paragraphs. */
  body: I18nText
}

export interface HandbookEntry {
  /** Route id for modules ('fab-floor'…) or a topic slug ('event-bus'). */
  id: string
  kind: 'module' | 'topic'
  domain: 'MES' | 'ERP' | 'SCM' | 'SYSTEM'
  /** For kind:'module' — enables "open page" + "tour this page". */
  route?: ModuleRoute
  title: I18nText
  /** One-liner for the index list. */
  tagline: I18nText
  /** 用途 Purpose / 主要面板 Key panels / 操作方式 How to use / 資料來源 Data & events. */
  sections: HandbookSection[]
  /** Related bus event topics, e.g. ['lot.move','equip.state']. */
  events?: string[]
  /** ids of related entries. */
  related?: string[]
}

/* Reusable section headings — keep wording consistent across all entries. */
const H_PURPOSE: I18nText = { zh: '用途', en: 'Purpose' }
const H_PANELS: I18nText = { zh: '主要面板', en: 'Key panels' }
const H_HOWTO: I18nText = { zh: '操作方式', en: 'How to use' }
const H_DATA: I18nText = { zh: '資料來源與事件', en: 'Data & events' }

/** Helper to assemble the standard 4-section module body. */
function sections(
  purpose: I18nText,
  panels: I18nText,
  howto: I18nText,
  data: I18nText,
): HandbookSection[] {
  return [
    { heading: H_PURPOSE, body: purpose },
    { heading: H_PANELS, body: panels },
    { heading: H_HOWTO, body: howto },
    { heading: H_DATA, body: data },
  ]
}

export const handbookEntries: HandbookEntry[] = [
  /* ═══════════════════════════ MES ═══════════════════════════ */
  {
    id: 'fab-floor',
    kind: 'module',
    domain: 'MES',
    route: 'fab-floor',
    title: { zh: '車間總覽', en: 'Fab Floor' },
    tagline: { zh: 'Bay 佈局即時設備狀態與在製品流動', en: 'Live bay map of tool state and WIP flow' },
    sections: sections(
      {
        zh: '車間總覽是 MES 的入口畫面，以單一畫面呈現整個 **FAB-01** 廠房的即時脈動。它把設備狀態、批次移動與產線 KPI 收斂在一處，讓值班人員一眼掌握全場節奏。',
        en: 'The Fab Floor is the MES landing screen — a single command view of the whole **FAB-01** plant. It binds tool state, lot movement and line KPIs into one pane so the shift can read the floor at a glance.',
      },
      {
        zh: '上方是即時 KPI 帶 (`KpiStrip`)；中央 **Bay Map** (`BayLayout`) 以發光節點繪出各機台，晶圓批次以彗星軌跡在機台間流動；右側 **Live Events** 串流面板逐筆列出總線上的所有事件。',
        en: 'A live KPI strip sits on top; the central **Bay Map** (`BayLayout`) draws each tool as a glowing node with wafer lots streaming between them as comet trails; the right-hand **Live Events** panel lists every event on the bus in real time.',
      },
      {
        zh: '此頁為唯讀總覽，無需點選即可觀察。設備節點顏色對應 E10 狀態；事件串流會在進入頁面時以環形緩衝區回填近期歷史，因此不會從空白開始。若要深入單一機台或批次，請切換至設備或生產頁。',
        en: 'This is a read-only overview — just watch. Node colors follow E10 state; the event stream backfills recent history from the ring buffer on mount, so it never starts blank. Drill into a single tool or lot from the Equipment or Production pages.',
      },
      {
        zh: '訂閱 `equip.state` 與 `lot.move` 驅動 Bay Map 動畫，事件串流訂閱整條總線 (`all$`)。設備清單來自 `masterData.equipment`。',
        en: 'Subscribes to `equip.state` and `lot.move` to animate the bay map; the event stream subscribes to the whole bus (`all$`). The tool roster comes from `masterData.equipment`.',
      },
    ),
    events: ['equip.state', 'lot.move', 'kpi.tick'],
    related: ['equipment', 'production', 'kpi', 'event-bus'],
  },
  {
    id: 'production',
    kind: 'module',
    domain: 'MES',
    route: 'production',
    title: { zh: '生產 / 在製品', en: 'Production / WIP' },
    tagline: { zh: '批次清單、路線進度與批次族譜', en: 'Lot table, route progress and genealogy' },
    sections: sections(
      {
        zh: '生產頁追蹤所有在製批次 (WIP)，是現場排程與插單決策的依據。每筆批次顯示產品、客戶、路線、進度與優先級，急件 (**hot** / **super-hot**) 會以脈動高亮提示。',
        en: 'The Production page tracks every work-in-process lot — the basis for floor scheduling and hot-lot decisions. Each row shows product, customer, route, progress and priority; expedite lots (**hot** / **super-hot**) pulse to draw the eye.',
      },
      {
        zh: '主面板是密集批次表 (`DenseDataTable`)，含發光的進度條與優先級晶片；標題列顯示**平均 WIP 進度**與累計移動數。點選任一列開啟右側 **Drill-In** 詳情，內含路線步驟與批次族譜 (parent/child)。',
        en: 'The main panel is a dense lot table with glowing progress bars and priority chips; the header shows **average WIP progress** and a running move count. Selecting a row opens the **Drill-In** detail panel with route steps and lot genealogy (parent/child).',
      },
      {
        zh: '點選批次列即選中該批次並開啟詳情；在 Drill-In 內點選父批或子批可跳轉。進度欄會持續推進——背景每秒輪流推進一批活躍批次，使看板永遠呈現流動狀態，而非凍結。',
        en: 'Click a lot row to select it and open the detail panel; inside the Drill-In, click a parent or child lot to jump. The progress column keeps moving — a rotating batch of active lots advances each second so the board always reads live rather than frozen.',
      },
      {
        zh: '訂閱 `lot.move` 即時更新各批次路線步數；批次資料來自 `masterData.lots`、路線來自 `masterData.routes`。選取狀態透過 `uiStore.selectEntity` 與其他頁共享。',
        en: 'Subscribes to `lot.move` to advance per-lot route steps live; lot data comes from `masterData.lots`, routes from `masterData.routes`. Selection is shared with other pages via `uiStore.selectEntity`.',
      },
    ),
    events: ['lot.move', 'lot.complete'],
    related: ['fab-floor', 'equipment', 'production-orders', 'mes-erp-bridge'],
  },
  {
    id: 'equipment',
    kind: 'module',
    domain: 'MES',
    route: 'equipment',
    title: { zh: '設備 / E10 狀態', en: 'Equipment / E10 State' },
    tagline: { zh: 'SEMI E10 狀態分布與 SECS 訊息台', en: 'SEMI E10 state distribution and SECS console' },
    sections: sections(
      {
        zh: '設備頁以 **SEMI E10** 標準狀態模型監看每台機台的即時狀態，是稼動率與停機分析的基礎。狀態涵蓋 PROD(生產)、STBY(待命)、SDT(排程停機)、UDT(非排程停機)、NSC(無人作業)、ENG(工程)、OUT(離線)。',
        en: 'The Equipment page monitors every tool against the **SEMI E10** standard state model — the foundation for utilization and downtime analysis. States span PROD, STBY (standby), SDT (scheduled downtime), UDT (unscheduled downtime), NSC (non-scheduled), ENG (engineering) and OUT.',
      },
      {
        zh: '標題列有即時 **E10 狀態分布條**，按比例顯示各狀態機台數；主面板是機台清單，狀態欄以發光圓點呈現，SDT/UDT 會脈動。選取機台後 Drill-In 顯示目前狀態與一個 **SECS 訊息台**——以打字機效果逐字播放狀態轉移與配方載入訊息。',
        en: 'The header carries a live **E10 state-distribution bar** showing the share of tools in each state; the main panel is the tool roster with a glowing state dot per row (SDT/UDT pulse). Selecting a tool opens a Drill-In with its current state and a **SECS message console** that types out state transitions and recipe loads like a live terminal.',
      },
      {
        zh: '點選機台列開啟 Drill-In 並清空 SECS 台，之後僅該機台的事件會逐筆打字顯示。狀態分布條無需點選即時更新；脈動圓點代表需要關注的停機機台。',
        en: 'Click a tool row to open its Drill-In and clear the SECS console; thereafter only that tool\'s events type out line by line. The distribution bar updates live without selection; pulsing dots flag down tools that need attention.',
      },
      {
        zh: '訂閱 `equip.state` 維護狀態地圖，並訂閱 `recipe.load` 將配方事件寫入選取機台的 SECS 台。初始狀態來自 `masterData.equipment[].initialState`；訊息格式由 `lib/secs` 產生。',
        en: 'Subscribes to `equip.state` to maintain the state map and to `recipe.load` to log recipe events into the selected tool\'s SECS console. Initial states come from `masterData.equipment[].initialState`; message formatting is from `lib/secs`.',
      },
    ),
    events: ['equip.state', 'recipe.load'],
    related: ['fab-floor', 'recipe', 'kpi', 'event-bus'],
  },
  {
    id: 'spc',
    kind: 'module',
    domain: 'MES',
    route: 'spc',
    title: { zh: 'SPC / 品質', en: 'SPC / Quality' },
    tagline: { zh: '管制圖、西方電氣法則違規與製程能力', en: 'Control chart, Western-Electric rules and Cp/Cpk' },
    sections: sections(
      {
        zh: 'SPC 頁是統計製程管制中心，以 **CD 線寬均勻度 (nm)** 為例監看製程是否在管制界限內，並即時偵測**西方電氣法則 (Western Electric)** 違規。',
        en: 'The SPC page is the statistical process-control desk. It tracks a process — **CD uniformity (nm)** in the demo — against control limits and flags **Western-Electric rule** violations in real time.',
      },
      {
        zh: '頂部四格摘要顯示 Current CD、違規數、**Cp** 與 **Cpk**（依能力上色：≥1.33 綠、≥1.0 黃、否則紅）。中央是即時管制圖，標出 UCL/LCL/CL 參考線，違規點以發光玫紅標記；下方違規記錄列出各筆違規的法則編號與量測值。',
        en: 'A four-tile summary shows Current CD, violation count, **Cp** and **Cpk** (color-gated: ≥1.33 emerald, ≥1.0 amber, else rose). The central live control chart marks UCL/LCL/CL reference lines with violation points glowing rose; a violation log below lists each violation\'s rule number and measured value.',
      },
      {
        zh: '此頁為即時監看，無需互動。管制點隨產線流入；進入頁面時會由環形緩衝區回填最近 100 點，因此不會看到空白圖。違規記錄為新到優先。三種法則：1 = 單點越過 3σ；2 = 連續 9 點同側；4 = 連續 14 點交替。',
        en: 'This page is for live monitoring — no interaction needed. Control points stream in as the line runs; the last 100 are backfilled from the ring buffer on mount so you never see a blank chart. The violation log is newest-first. Three rules fire: 1 = one point beyond 3σ; 2 = nine consecutive points one side of CL; 4 = fourteen alternating points.',
      },
      {
        zh: '訂閱 `spc.violation`；每個事件帶 `ruleNumber` (1|2|4)、`severity` 與 `controlPoint` (value/ucl/lcl/centerline)。Cp/Cpk 由目前點窗即時計算，無外部資料來源。',
        en: 'Subscribes to `spc.violation`; each event carries `ruleNumber` (1|2|4), `severity` and a `controlPoint` (value/ucl/lcl/centerline). Cp/Cpk are computed live over the current point window — no external data source.',
      },
    ),
    events: ['spc.violation'],
    related: ['kpi', 'recipe', 'alarms', 'event-bus'],
  },
  {
    id: 'recipe',
    kind: 'module',
    domain: 'MES',
    route: 'recipe',
    title: { zh: '配方管理', en: 'Recipe Management' },
    tagline: { zh: '配方庫、參數與版本變更歷史', en: 'Recipe library, parameters and version history' },
    sections: sections(
      {
        zh: '配方管理頁是製程配方的單一真實來源，依機台類型分組瀏覽，並提供完整的版本控管與變更稽核軌跡——這是製程變更管理 (MOC) 的核心。',
        en: 'Recipe Management is the single source of truth for process recipes, browsable grouped by tool type with full version control and a change audit trail — the heart of management-of-change (MOC).',
      },
      {
        zh: '左側是依 LITHO/ETCH/CMP/CVD/PVD/INSP 分組的**配方庫**清單；右側顯示選取配方的參數表、最新變更摘要 (依語意判定 MAJOR/MINOR/PATCH)，以及 **commit-graph 版本歷史**時間軸，標出作者、時間戳與變更說明。',
        en: 'The left pane is the **recipe library** grouped by LITHO/ETCH/CMP/CVD/PVD/INSP; the right pane shows the selected recipe\'s parameter table, a latest-change summary (semantically classified MAJOR/MINOR/PATCH), and a **commit-graph version-history** timeline with author, timestamp and change note.',
      },
      {
        zh: '在左側清單點選任一配方即載入右側詳情；目前版本以 CURRENT 標籤與較大發光節點標示。此頁為靜態主資料瀏覽，不訂閱即時事件。',
        en: 'Click any recipe in the left list to load its detail on the right; the current version is tagged CURRENT with a larger glowing node. This page browses static master data and does not subscribe to live events.',
      },
      {
        zh: '完全由 `masterData.recipes` 驅動（含 `parameters`、`versions`、`currentVersion`）。雖然不訂閱事件，配方載入動作會在設備頁 SECS 台以 `recipe.load` 事件呈現。',
        en: 'Driven entirely by `masterData.recipes` (including `parameters`, `versions`, `currentVersion`). It does not subscribe to events, but recipe loads surface as `recipe.load` events in the Equipment SECS console.',
      },
    ),
    events: ['recipe.load'],
    related: ['equipment', 'spc', 'bom'],
  },
  {
    id: 'alarms',
    kind: 'module',
    domain: 'MES',
    route: 'alarms',
    title: { zh: '警報台', en: 'Alarm Desk' },
    tagline: { zh: '即時警報串流、嚴重度分級與確認', en: 'Live alarm stream, severity tiers and acknowledge' },
    sections: sections(
      {
        zh: '警報台集中呈現現場所有 `alarm.raised` 警報，依 critical / major / minor 三級分類，並支援操作員**確認 (ACK)**——它對應側欄的警報徽章計數。',
        en: 'The Alarm Desk centralizes every `alarm.raised` alarm on the floor, tiered critical / major / minor, with operator **acknowledge (ACK)** — it mirrors the alarm badge count in the sidebar.',
      },
      {
        zh: '頂部摘要條以晶片顯示各嚴重度計數，critical 會以聲納環脈動；下方是警報列清單，含嚴重度晶片、時間戳、來源與訊息，已確認者標 ACK。點選警報開啟 Drill-In，顯示 SOP 參考並提供**確認**按鈕。',
        en: 'A summary strip shows per-severity counts as chips, with critical pinging a sonar ring; below it a list of alarm rows carries a severity chip, timestamp, source and message, with an ACK badge once acknowledged. Selecting an alarm opens a Drill-In with the SOP reference and an **Acknowledge** button.',
      },
      {
        zh: '點選警報列選取並開啟詳情；按 **Acknowledge** 會以迴圈時鐘時間 (`clock.loopT()`) 發布 `alarm.ack` 事件，列上隨即出現 ACK 標記。進入頁面時會由環形緩衝區回填歷史警報並還原其確認狀態，與側欄徽章一致。',
        en: 'Click an alarm row to select and open detail; pressing **Acknowledge** publishes an `alarm.ack` event stamped with loop-clock time (`clock.loopT()`), and the row immediately shows an ACK marker. On mount it backfills historical alarms from the ring buffer and restores their ack state, matching the sidebar badge.',
      },
      {
        zh: '訂閱 `alarm.raised` 與 `alarm.ack`；確認動作會 `eventBus.publish` 一筆 `alarm.ack`。徽章計數在 App 層由緩衝區重算（distinct 未確認 alarmId），所以 180s 重播不會漂移。',
        en: 'Subscribes to `alarm.raised` and `alarm.ack`; acknowledging `eventBus.publish`-es an `alarm.ack`. The badge count is recomputed from the buffer in App (distinct unacked alarmIds), so the 180s replay can\'t make it drift.',
      },
    ),
    events: ['alarm.raised', 'alarm.ack'],
    related: ['equipment', 'spc', 'kpi', 'loop-clock'],
  },
  {
    id: 'kpi',
    kind: 'module',
    domain: 'MES',
    route: 'kpi',
    title: { zh: 'KPI 儀表板', en: 'KPI Dashboard' },
    tagline: { zh: 'OEE / 良率 / 產出等生產績效指標', en: 'OEE / yield / throughput production metrics' },
    sections: sections(
      {
        zh: 'KPI 儀表板把即時生產績效濃縮為一組指標：OEE、良率、產出 (wph)、MTBF、MTTR、WIP 周轉與週期時間，是管理層掌握全場效率的窗口。',
        en: 'The KPI Dashboard distills live production performance into one metric set: OEE, yield, throughput (wph), MTBF, MTTR, WIP turn and cycle time — management\'s window on overall efficiency.',
      },
      {
        zh: '英雄列是 **OEE 與良率**兩個放射狀儀表，附趨勢漲跌；中央是多序列**績效趨勢圖** (OEE / 良率 / 產出，最近 60 tick)；下方是其餘指標的迷你卡，各帶火花線與漲跌標示。',
        en: 'A hero row carries two radial gauges for **OEE and Yield** with trend deltas; a multi-series **performance-trend chart** (OEE / yield / throughput, last 60 ticks) sits centrally; metric mini-tiles with sparklines and deltas line up below.',
      },
      {
        zh: '此頁為即時儀表，無需互動。進入頁面時由環形緩衝區計算首幀數值（不會停在「Priming…」）；之後每次 `ringBuffer$` 推送都會重算全部 KPI 並推進趨勢圖。',
        en: 'A live dashboard — no interaction needed. On mount it computes the first frame from the ring buffer (so it doesn\'t sit on "Priming…"); thereafter each `ringBuffer$` push recomputes all KPIs and advances the trend chart.',
      },
      {
        zh: '不直接訂閱單一 topic，而是訂閱 `eventBus.ringBuffer$()`，以 `lib/kpi.computeKpis(buffer, totalEquipment)` 從整個事件緩衝區衍生指標。概念上對應 `kpi.tick` 事件型別。',
        en: 'Rather than a single topic, it subscribes to `eventBus.ringBuffer$()` and derives metrics from the whole event buffer via `lib/kpi.computeKpis(buffer, totalEquipment)`. Conceptually it maps to the `kpi.tick` event shape.',
      },
    ),
    events: ['kpi.tick'],
    related: ['fab-floor', 'equipment', 'spc', 'event-bus'],
  },

  /* ═══════════════════════════ ERP ═══════════════════════════ */
  {
    id: 'erp-cockpit',
    kind: 'module',
    domain: 'ERP',
    route: 'erp-cockpit',
    title: { zh: '單據流駕駛艙', en: 'Document Flow Cockpit' },
    tagline: { zh: 'SO→計畫→生產單→批次→收料→發票泳道', en: 'SO→Planned→ProdOrder→Lot→GR→Invoice swimlanes' },
    sections: sections(
      {
        zh: '單據流駕駛艙是 ERP 域的旗艦畫面，以六條泳道完整呈現**接單到收款 (order-to-cash)** 的單據鏈：銷售訂單 → 計畫單 → 生產單 → 批次 → 收料 (GR) → 發票。它讓你即時看見整條跨域價值流的脈動。',
        en: 'The Document Flow Cockpit is the ERP flagship. Six swimlanes render the full **order-to-cash** document chain: Sales Order → Planned → Prod Order → Lot → Goods Receipt → Invoice — a live, end-to-end view of the value stream pulsing across domains.',
      },
      {
        zh: '每條泳道保有一個滾動**累計計數**（總覽）與最近約 6 筆單據的發光晶片（動態）。最新晶片帶 New 標籤與強光環；**批次**泳道額外從共享 zustand 橋接 store 讀取在製批次並顯示迷你進度條。',
        en: 'Each lane keeps a rolling **count** (the overview) and the most recent ~6 documents as glowing chips (the motion). The freshest chip carries a New tag and a glow ring; the **Lot** lane additionally reads in-flight bridged lots from the shared zustand bridge store and shows a mini progress bar.',
      },
      {
        zh: '可點選的晶片（SO、生產單、批次、收料）會跨域深連結到對應頁面與實體；計畫單與發票晶片為靜態。整頁無隨機性，計數由靜態快照種子化後再由總線即時遞增。',
        en: 'Clickable chips (SO, Prod Order, Lot, GR) deep-link cross-domain to the matching page and entity; Planned and Invoice chips are static. The page is deterministic — counts are seeded from the static snapshot then incremented live from the bus.',
      },
      {
        zh: '訂閱多個 topic 驅動各泳道：`erp.order.created`、`erp.plannedorder.created`/`erp.mrp.run`、`erp.prodorder.released`/`.status`、`lot.move`/`lot.complete`、`erp.goods.movement` (GR)、`erp.invoice.created`。批次泳道另讀 `useBridgedLots` store。',
        en: 'Subscribes to many topics, one feed per lane: `erp.order.created`; `erp.plannedorder.created`/`erp.mrp.run`; `erp.prodorder.released`/`.status`; `lot.move`/`lot.complete`; `erp.goods.movement` (GR); `erp.invoice.created`. The Lot lane also reads the `useBridgedLots` store.',
      },
    ),
    events: [
      'erp.order.created',
      'erp.plannedorder.created',
      'erp.mrp.run',
      'erp.prodorder.released',
      'erp.prodorder.status',
      'lot.move',
      'lot.complete',
      'erp.goods.movement',
      'erp.invoice.created',
    ],
    related: ['sales-orders', 'production-orders', 'mrp', 'finance', 'mes-erp-bridge'],
  },
  {
    id: 'mrp',
    kind: 'module',
    domain: 'ERP',
    route: 'mrp',
    title: { zh: 'MRP / 物料規劃', en: 'MRP / Material Planning' },
    tagline: { zh: '物料覆蓋率矩陣與需求/供給分解', en: 'Material coverage matrix with demand/supply' },
    sections: sections(
      {
        zh: 'MRP 頁執行物料需求規劃的核心問題：**每項物料的庫存能否覆蓋未來需求？** 以多時段投影矩陣呈現可用量與短缺，是採購與排程的觸發點。',
        en: 'The MRP page answers material-requirements planning\'s core question: **will each material\'s stock cover future demand?** It projects available-to-promise and shortages across time buckets — the trigger for purchasing and scheduling.',
      },
      {
        zh: '主面板是**物料覆蓋率矩陣**：每列一項物料，欄為現有量、可用量 (ATP) 與多個時段投影；任何 ≤0 的格子發光紅標示短缺。選取物料後右側面板分解其**需求**（消耗該料的生產單）與**供給**（補料的採購單）。',
        en: 'The main panel is a **material-coverage matrix**: one row per material with columns for on-hand, available (ATP) and several bucket projections; any cell ≤0 glows critical to flag a shortage. Selecting a material opens a side panel decomposing its **demand** (production orders consuming it) and **supply** (purchase orders replenishing it).',
      },
      {
        zh: '點選任一物料列開啟右側分解面板，含投影條、需求清單與供給清單；按 X 關閉。標題列顯示短缺總數徽章。當全部覆蓋時顯示「all covered」綠色空狀態。',
        en: 'Click any material row to open the side decomposition panel with the projection strip, demand list and supply list; press X to close. The header shows a shortage-count badge, and an emerald "all covered" empty state appears when nothing is short.',
      },
      {
        zh: '覆蓋率由 `data/erp/coverage.buildCoverage(inventory, materials)` 計算（純函式，無隨機）。需求來自未完成的 `productionOrders`，供給來自未收料的 `purchaseOrders`。對應 `erp.mrp.run` 事件型別。',
        en: 'Coverage is computed by `data/erp/coverage.buildCoverage(inventory, materials)` (pure, no randomness). Demand comes from open `productionOrders`, supply from not-yet-received `purchaseOrders`. Maps to the `erp.mrp.run` event shape.',
      },
    ),
    events: ['erp.mrp.run', 'erp.plannedorder.created'],
    related: ['inventory', 'procurement', 'production-orders', 'materials'],
  },
  {
    id: 'sales-orders',
    kind: 'module',
    domain: 'ERP',
    route: 'sales-orders',
    title: { zh: '銷售訂單', en: 'Sales Orders' },
    tagline: { zh: '訂單簿、ATP 可承諾量與交期承諾', en: 'Order book, ATP availability and date promising' },
    sections: sections(
      {
        zh: '銷售訂單頁是客戶訂單簿，並內建 **ATP (Available-to-Promise) 可承諾量**分析，回答「這張訂單能不能準時交、要不要延期」這個業務最關鍵的問題。',
        en: 'The Sales Orders page is the customer order book with built-in **ATP (Available-to-Promise)** analysis — answering sales\' most critical question: can this order ship on time, or must the date slip?',
      },
      {
        zh: '頂部 **ATP 可用量面板**以分段條呈現現有量 / 在途 / 計畫產出 / 短缺，搭配覆蓋率放射儀表；下方訂單表含狀態、優先級、需求/承諾日與 ATP 承諾晶片 (Confirmed/Partial/Shortfall)，short fall 列會脈動。點選訂單開啟 Drill-In 顯示行項目。',
        en: 'A top **ATP availability panel** shows a segmented bar (on-hand / in-transit / planned production / shortfall) with a coverage gauge; the order table below carries status, priority, requested/promised dates and an ATP promise chip (Confirmed/Partial/Shortfall), with shortfall rows pulsing. Selecting an order opens a Drill-In with its line items.',
      },
      {
        zh: 'ATP 條的各分段可點選並跳轉到對應頁（在途→Shipments、計畫→生產單、短缺→MRP）。點選訂單列開啟詳情。承諾日與承諾狀態以 `cyrb53(orderNo)` 確定性衍生，重載後保持一致。',
        en: 'Each ATP bar segment is clickable and routes to the relevant page (in-transit→Shipments, planned→Production Orders, shortfall→MRP). Click an order row for detail. Promise dates and statuses are derived deterministically via `cyrb53(orderNo)`, stable across reloads.',
      },
      {
        zh: '訂閱 `erp.order.created` 把新訂單加入訂單簿（進入頁面時由環形緩衝區回填並去重，因 ERP 引擎每迴圈重置序號）。ATP 由 `erpData` 快照衍生，不耦合 SCM。',
        en: 'Subscribes to `erp.order.created` to append new orders to the book (backfilled and deduped from the ring buffer on mount, since the ERP engine resets sequence each loop). ATP is derived from the `erpData` snapshot — no SCM coupling.',
      },
    ),
    events: ['erp.order.created', 'scm.atp.promised'],
    related: ['erp-cockpit', 'mrp', 'inventory', 'shipments', 'business-partners'],
  },
  {
    id: 'production-orders',
    kind: 'module',
    domain: 'ERP',
    route: 'production-orders',
    title: { zh: '生產單', en: 'Production Orders' },
    tagline: { zh: '生產單狀態與橋接批次的即時進度', en: 'Prod order status and live bridged-lot progress' },
    sections: sections(
      {
        zh: '生產單頁是 ERP 與 MES 的交會點：每張生產單代表一筆要在車間製造的訂單，其狀態 (Created→Released→InProcess→Completed) 與**橋接批次的即時進度**直接反映現場執行情況。',
        en: 'The Production Orders page is where ERP meets MES: each production order represents work to be made on the floor, and its status (Created→Released→InProcess→Completed) plus **live bridged-lot progress** reflects shop-floor execution directly.',
      },
      {
        zh: '主面板是生產單表（沿用 `MasterDataModule` 框架），狀態以晶片呈現，InProcess 脈動；當生產單有橋接的在製批次時，會顯示一個發光的 **Live** 進度條與步數。點選生產單開啟 Drill-In。',
        en: 'The main panel is a production-order table (on the `MasterDataModule` frame) with status chips (InProcess pulses); when an order has a bridged in-flight lot, a glowing **Live** progress bar and step count appear. Selecting an order opens a Drill-In.',
      },
      {
        zh: '點選列查看單據詳情。Live 進度欄反映橋接 store (`useBridgedLots`) 中的批次步數——這正是 MES→ERP 橋接把車間進度回灌到 ERP 的可視化結果。',
        en: 'Click a row for order detail. The Live progress column reflects lot steps in the bridge store (`useBridgedLots`) — the visible result of the MES→ERP bridge feeding shop-floor progress back into ERP.',
      },
      {
        zh: '生產單來自 `erpData.productionOrders`；即時進度與狀態來自 `useBridgedLots` store，由橋接在收到 `erp.prodorder.released` 後建立批次、並隨 `lot.move`/`lot.complete` 更新。',
        en: 'Production orders come from `erpData.productionOrders`; live progress and status come from the `useBridgedLots` store, which the bridge populates on `erp.prodorder.released` and updates on `lot.move`/`lot.complete`.',
      },
    ),
    events: ['erp.prodorder.released', 'erp.prodorder.status', 'lot.move', 'lot.complete'],
    related: ['production', 'erp-cockpit', 'mrp', 'mes-erp-bridge'],
  },
  {
    id: 'inventory',
    kind: 'module',
    domain: 'ERP',
    route: 'inventory',
    title: { zh: '庫存', en: 'Inventory' },
    tagline: { zh: '各儲位現有量、承諾量與可用量', en: 'On-hand, committed and available stock by storage loc' },
    sections: sections(
      {
        zh: '庫存頁呈現各物料在各儲位的現有量、承諾量與可用量，是判斷物料是否短缺、能否出貨的庫存帳。',
        en: 'The Inventory page shows on-hand, committed and available stock per material and storage location — the stock ledger for judging shortages and shipping readiness.',
      },
      {
        zh: '主面板是密集庫存表，含物料、描述、儲位晶片與數量欄；當可用量 ≤0 時數字發光紅並標示短缺。點選列開啟 Drill-In 顯示該庫存列詳情。',
        en: 'The main panel is a dense inventory table with material, description, storage-location chips and quantity columns; when available stock ≤0 the figure glows critical to flag a shortage. Selecting a row opens a Drill-In with that inventory line\'s detail.',
      },
      {
        zh: '點選庫存列查看詳情。庫存為靜態快照（無雙重收料）；MES→ERP 橋接的收料動作以 `erp.goods.movement` (GR) 事件呈現於駕駛艙，而非直接改寫此表。',
        en: 'Click an inventory row for detail. Inventory is a static snapshot (no double goods-receipt); the bridge\'s receipts surface as `erp.goods.movement` (GR) events in the Cockpit rather than mutating this table directly.',
      },
      {
        zh: '由 `erpData.inventory` 驅動，每列含 `onHand`/`committed`/`available`。相關事件為 `erp.goods.movement`（收料 GR / 發料 GI）。',
        en: 'Driven by `erpData.inventory`, each row carrying `onHand`/`committed`/`available`. The related event is `erp.goods.movement` (goods receipt GR / goods issue GI).',
      },
    ),
    events: ['erp.goods.movement'],
    related: ['mrp', 'procurement', 'materials', 'finance'],
  },
  {
    id: 'procurement',
    kind: 'module',
    domain: 'ERP',
    route: 'procurement',
    title: { zh: '採購', en: 'Procurement' },
    tagline: { zh: '採購單狀態、交期與延遲監控', en: 'Purchase orders, delivery dates and late tracking' },
    sections: sections(
      {
        zh: '採購頁追蹤所有對供應商的採購單 (PO)，監看其狀態與交期，**逾期 (late)** 單會醒目脈動——這對應側欄的逾期 PO 徽章。',
        en: 'The Procurement page tracks every purchase order (PO) to suppliers, watching status and delivery dates; **late** POs pulse to stand out — mirroring the late-PO badge in the sidebar.',
      },
      {
        zh: '主面板是採購單表（`MasterDataModule` 框架），狀態晶片區分 open / confirmed / received / late，late 以聲納環脈動。點選 PO 開啟 Drill-In 查看行項目與供應商資訊。',
        en: 'The main panel is a PO table (on the `MasterDataModule` frame) with status chips for open / confirmed / received / late, late pinging a sonar ring. Selecting a PO opens a Drill-In with line items and vendor info.',
      },
      {
        zh: '點選 PO 列查看詳情。採購單的 open/confirmed 量會被 MRP 與銷售訂單 ATP 計為「在途供給」，因此延遲的 PO 會連帶影響可承諾量。',
        en: 'Click a PO row for detail. Open/confirmed PO quantities count as "in-transit supply" for MRP and Sales-Order ATP, so a late PO ripples into available-to-promise downstream.',
      },
      {
        zh: '由 `erpData.purchaseOrders` 驅動。相關事件：`erp.po.created`、`erp.po.received`；其中 `erp.po.created` 也是 SCM 入庫貨運的觸發訊號（見供應鏈驅動器）。',
        en: 'Driven by `erpData.purchaseOrders`. Related events: `erp.po.created`, `erp.po.received`; `erp.po.created` is also the trigger for SCM inbound shipments (see the shipment driver).',
      },
    ),
    events: ['erp.po.created', 'erp.po.received'],
    related: ['mrp', 'inventory', 'business-partners', 'scm-driver', 'control-tower'],
  },
  {
    id: 'materials',
    kind: 'module',
    domain: 'ERP',
    route: 'materials',
    title: { zh: '物料主檔', en: 'Materials' },
    tagline: { zh: 'FERT/HALB/ROH 物料主資料與標準成本', en: 'FERT/HALB/ROH material master and standard cost' },
    sections: sections(
      {
        zh: '物料主檔是所有物料的主資料目錄，依類型分為 **FERT**（成品）、**HALB**（半成品）、**ROH**（原料），是 BOM、庫存、MRP 與成本計算共同引用的基礎。',
        en: 'Materials is the master catalog of every material, typed **FERT** (finished), **HALB** (semi-finished) and **ROH** (raw) — the shared foundation referenced by BOM, inventory, MRP and costing.',
      },
      {
        zh: '主面板是物料表，含物料號、描述、類型晶片（色彩編碼）與標準成本等欄。點選物料開啟 Drill-In 顯示主資料屬性，並可帶出其 BOM 關聯。',
        en: 'The main panel is a material table with material number, description, a color-coded type chip and standard cost. Selecting a material opens a Drill-In with master-data attributes and any BOM linkage.',
      },
      {
        zh: '點選物料列查看詳情。此頁為靜態主資料瀏覽，是其他 ERP 頁的字典來源——例如庫存與 MRP 的物料描述、Finance 的標準成本都來自此處。',
        en: 'Click a material row for detail. This is a static master-data browser and the dictionary for other ERP pages — inventory and MRP descriptions, and Finance standard costs, all resolve here.',
      },
      {
        zh: '由 `erpData.materials` 驅動，每列含 `type`、`standardCost`、`baseUoM` 等。不訂閱即時事件。',
        en: 'Driven by `erpData.materials`, each row carrying `type`, `standardCost`, `baseUoM` and more. No live-event subscriptions.',
      },
    ),
    related: ['bom', 'inventory', 'mrp', 'finance'],
  },
  {
    id: 'business-partners',
    kind: 'module',
    domain: 'ERP',
    route: 'business-partners',
    title: { zh: '商業夥伴', en: 'Business Partners' },
    tagline: { zh: '客戶 / 供應商 / 雙重角色主檔', en: 'Customer / vendor / both partner master' },
    sections: sections(
      {
        zh: '商業夥伴頁是客戶與供應商的統一主檔，每個夥伴標記角色為 **customer**、**vendor** 或 **both**，是銷售訂單與採購單共同引用的對象。',
        en: 'The Business Partners page is the unified master for customers and vendors; each partner is tagged **customer**, **vendor** or **both** — the counterparty referenced by both sales and purchase orders.',
      },
      {
        zh: '頂部摘要顯示客戶 / 供應商 / 雙重角色的計數；主面板是夥伴表，角色以色彩晶片區分。點選夥伴開啟 Drill-In 顯示聯絡與交易屬性。',
        en: 'A header summary counts customers / vendors / both; the main panel is a partner table with role-colored chips. Selecting a partner opens a Drill-In with contact and transaction attributes.',
      },
      {
        zh: '點選夥伴列查看詳情。銷售訂單的客戶 (`bpNo`/`customerName`) 與採購單的供應商 (`bpNo`/`vendorName`) 都指向此主檔。',
        en: 'Click a partner row for detail. A sales order\'s customer (`bpNo`/`customerName`) and a PO\'s vendor (`bpNo`/`vendorName`) both point back to this master.',
      },
      {
        zh: '由 `erpData.businessPartners` 驅動（含 `role`）。不訂閱即時事件。',
        en: 'Driven by `erpData.businessPartners` (including `role`). No live-event subscriptions.',
      },
    ),
    related: ['sales-orders', 'procurement', 'supplier-scorecards'],
  },
  {
    id: 'bom',
    kind: 'module',
    domain: 'ERP',
    route: 'bom',
    title: { zh: '物料清單 (BOM)', en: 'Bill of Materials' },
    tagline: { zh: '成品的組件結構與用量展開', en: 'Component structure and quantity explosion' },
    sections: sections(
      {
        zh: '物料清單 (BOM) 頁定義每個成品由哪些組件、以多少用量組成，是 MRP 需求展開與成本累積的結構基礎。',
        en: 'The Bill of Materials page defines which components, in what quantities, make up each finished good — the structural basis for MRP requirements explosion and cost roll-up.',
      },
      {
        zh: '左側是可搜尋的 BOM 清單（依表頭物料），右側顯示選取 BOM 的組件結構，每個組件帶類型晶片 (FERT/HALB/ROH) 與用量。',
        en: 'The left pane is a searchable BOM list (by header material); the right pane shows the selected BOM\'s component structure, each component with a type chip (FERT/HALB/ROH) and quantity.',
      },
      {
        zh: '在左側搜尋或點選 BOM 載入右側結構。組件物料號可對照物料主檔；BOM 用量決定 MRP 把成品需求展開成多少組件需求。',
        en: 'Search or click a BOM on the left to load its structure on the right. Component material numbers resolve against the Materials master; BOM quantities drive how MRP explodes finished-good demand into component demand.',
      },
      {
        zh: '由 `erpData.boms` 與 `erpData.materials` 驅動。不訂閱即時事件。',
        en: 'Driven by `erpData.boms` and `erpData.materials`. No live-event subscriptions.',
      },
    ),
    related: ['materials', 'mrp', 'recipe'],
  },
  {
    id: 'finance',
    kind: 'module',
    domain: 'ERP',
    route: 'finance',
    title: { zh: '財務', en: 'Finance' },
    tagline: { zh: '庫存價值、WIP、營收與即時總帳分錄', en: 'Inventory value, WIP, revenue and live GL postings' },
    sections: sections(
      {
        zh: '財務頁把營運活動翻譯成會計語言：庫存價值、在製品 (WIP) 價值、營收、應收 (AR)、應付 (AP)，並即時呈現由製造完工觸發的**總帳 (GL) 分錄**。',
        en: 'The Finance page translates operations into accounting: inventory value, WIP value, revenue, accounts receivable (AR) and payable (AP) — plus a live ledger of **general-ledger (GL) postings** triggered by manufacturing completion.',
      },
      {
        zh: '頂部是財務 KPI 卡（庫存值、WIP、營收、開放 AR/AP）與一個 AR 收款健康度儀表；下方是**即時 GL 分錄帳**，逐筆顯示科目、金額與參考單號。',
        en: 'Finance KPI tiles (inventory value, WIP, revenue, open AR/AP) and an AR-collection-health gauge sit on top; a **live GL-postings ledger** below lists each posting\'s account, amount and reference document.',
      },
      {
        zh: '此頁為唯讀財務儀表。GL 帳在進入頁面時由環形緩衝區回填（新到優先，上限 40 筆）；當批次完工時，橋接會發布成品入帳與 WIP 沖轉兩筆對應分錄，可在此即時看見。',
        en: 'A read-only finance dashboard. The GL ledger backfills from the ring buffer on mount (newest-first, capped at 40); when a lot completes, the bridge posts matching finished-goods and WIP-reversal entries, visible here live.',
      },
      {
        zh: 'KPI 由 `erpData` (materials/inventory/salesOrders/purchaseOrders) 確定性計算。GL 帳訂閱 `erp.gl.posting`——這些分錄由 MES→ERP 橋接在 `lot.complete` 時發出（成品 130000 / WIP 120000）。',
        en: 'KPIs are computed deterministically from `erpData` (materials/inventory/salesOrders/purchaseOrders). The ledger subscribes to `erp.gl.posting` — entries the MES→ERP bridge emits on `lot.complete` (Finished Goods 130000 / WIP 120000).',
      },
    ),
    events: ['erp.gl.posting', 'erp.invoice.created'],
    related: ['erp-cockpit', 'inventory', 'sales-orders', 'mes-erp-bridge'],
  },

  /* ═══════════════════════════ SCM ═══════════════════════════ */
  {
    id: 'control-tower',
    kind: 'module',
    domain: 'SCM',
    route: 'control-tower',
    title: { zh: '供應鏈控制塔', en: 'Control Tower' },
    tagline: { zh: '供應商→廠→配送中心→客戶網絡地圖', en: 'Supplier→fab→DC→customer network map' },
    sections: sections(
      {
        zh: '控制塔是 SCM 域的旗艦畫面，以一張**供應網絡地圖**呈現從供應商 → FAB-01 廠 → 配送中心 (DC) → 客戶的整條物流網，並即時顯示在途貨運與中斷事件。',
        en: 'The Control Tower is the SCM flagship — a **supply-network map** rendering the full logistics web from suppliers → FAB-01 → distribution centers (DC) → customers, with live in-transit shipments and disruptions.',
      },
      {
        zh: '核心是一張固定 viewBox 的 **SVG 網絡圖**：分層節點（供應商 / 廠 / DC / 客戶）以發光圓點呈現，曲線航線依運輸模式有不同筆觸（空運虛線、海運點線、陸運實線）；貨運以彗星點沿航線移動。中斷的航線會以**行軍蟻 (marching-ants)** 般的危急筆觸脈動。',
        en: 'At its core is a fixed-viewBox **SVG network map**: tiered nodes (supplier / fab / DC / customer) as glowing glyphs, curved lanes textured by mode (air dashed, sea dotted, truck solid); shipments move as comet dots along the lanes. A disrupted lane pulses in critical with a **marching-ants** stroke.',
      },
      {
        zh: '點選節點或貨運開啟 Drill-In 詳情。貨運點位置以 `shipmentPosition(loopT, departureT, transitSeconds)` 每幀計算，因此航線與節點層在運輸過程中不重繪。遵循 prefers-reduced-motion：動畫關閉時點位靜態定位。',
        en: 'Click a node or shipment to open a Drill-In. Shipment dot positions are computed per frame from `shipmentPosition(loopT, departureT, transitSeconds)`, so the lane/node layer never re-renders during transit. It honors prefers-reduced-motion — dots snap to a static coord when motion is off.',
      },
      {
        zh: '貨運狀態讀自共享 `useShipments` store（非總線——每 tick 進度不是事件）；節點/航線來自 `scmData`。中斷由 `scm.disruption.raised`/`.cleared` 驅動；到貨/送達由 `scm.shipment.arrived`/`.delivered` 觸發成功聲納。',
        en: 'Shipment state is read from the shared `useShipments` store (not the bus — per-tick progress is not an event); nodes/lanes come from `scmData`. Disruptions are driven by `scm.disruption.raised`/`.cleared`; arrival/delivery (`scm.shipment.arrived`/`.delivered`) fire a success sonar.',
      },
    ),
    events: [
      'scm.shipment.created',
      'scm.shipment.departed',
      'scm.shipment.arrived',
      'scm.shipment.delivered',
      'scm.disruption.raised',
      'scm.disruption.cleared',
    ],
    related: ['shipments', 'demand-planning', 'supplier-scorecards', 'scm-driver'],
  },
  {
    id: 'shipments',
    kind: 'module',
    domain: 'SCM',
    route: 'shipments',
    title: { zh: '貨運 / 在途', en: 'Shipments / In-Transit' },
    tagline: { zh: '逐筆貨運狀態與即時運輸進度', en: 'Per-shipment status and live transit progress' },
    sections: sections(
      {
        zh: '貨運頁是即時物流明細表，逐筆列出供應鏈驅動器送上路的每筆貨運，呈現其狀態、航線、物料與**即時運輸進度**。',
        en: 'The Shipments page is the live logistics table — one row per shipment the SCM driver puts in flight, showing status, lane, material and **live transit progress**.',
      },
      {
        zh: '主面板是貨運表，狀態晶片沿用控制塔的色調（created→灰、in-transit→青藍脈動、arrived/delivered→綠）；in-transit 進度條以 from-accent-2→accent 漸層呈現。逾期列標 row-hot、受中斷影響列標 row-superhot。點選開啟 Drill-In。',
        en: 'The main panel is a shipment table; status chips reuse the Control Tower tone map (created→slate, in-transit→cyan pulsing, arrived/delivered→emerald); the in-transit bar uses the from-accent-2→accent gradient. Late rows flag row-hot, disruption-hit rows flag row-superhot. Selecting opens a Drill-In.',
      },
      {
        zh: '點選貨運列查看詳情。進度為**計算值**（由 `shipmentPosition(loopT, departureT, transitSeconds)` 推導），非儲存欄位——這是刻意的設計，使進度與全域迴圈時鐘同步。',
        en: 'Click a shipment row for detail. Progress is **computed** (from `shipmentPosition(loopT, departureT, transitSeconds)`), not a stored field — a deliberate choice that keeps progress in lockstep with the global loop clock.',
      },
      {
        zh: '貨運讀自 `useShipments` store；狀態轉移事件 (`scm.shipment.*`) 由供應鏈驅動器發布。逾期判定使用 `LOOP_DURATION_S` 與計算位置。',
        en: 'Shipments are read from the `useShipments` store; status-transition events (`scm.shipment.*`) are published by the shipment driver. Late detection uses `LOOP_DURATION_S` and the computed position.',
      },
    ),
    events: [
      'scm.shipment.created',
      'scm.shipment.departed',
      'scm.shipment.arrived',
      'scm.shipment.delivered',
    ],
    related: ['control-tower', 'procurement', 'sales-orders', 'scm-driver'],
  },
  {
    id: 'demand-planning',
    kind: 'module',
    domain: 'SCM',
    route: 'demand-planning',
    title: { zh: '需求規劃', en: 'Demand Planning' },
    tagline: { zh: '週度需求預測對比實際與變異', en: 'Weekly forecast vs actuals with variance' },
    sections: sections(
      {
        zh: '需求規劃頁是整合式營運規劃 (IBP) 的需求側：以週為桶比較**預測**與**實際**需求，量化變異，是供應鏈備料與產能規劃的起點。',
        en: 'The Demand Planning page is the demand side of integrated business planning (IBP): it compares **forecast** against **actual** demand in weekly buckets and quantifies variance — the starting point for supply and capacity planning.',
      },
      {
        zh: '頂部摘要卡呈現規劃指標；中央是多序列**預測 vs 實際**組合圖（IBP 週度展望），實際高於預測（需求超出計畫）以玫紅、低於以綠呈現變異。下方表列各物料的桶值與實際。',
        en: 'Summary tiles show planning metrics on top; a multi-series **forecast-vs-actual** composed chart (weekly IBP horizon) sits centrally, coloring variance rose when actuals run over plan and emerald when under. A table below lists each material\'s bucket values and actuals.',
      },
      {
        zh: '此頁為規劃儀表。變異色階沿用 SPC 的能力色階概念（接近計畫為黃、偏離為紅/綠）。預測會隨即時事件更新對應桶位。',
        en: 'A planning dashboard. The variance color scale follows the SPC capability-color idea (near-plan amber, deviation rose/emerald). Forecasts update the relevant bucket on live events.',
      },
      {
        zh: '計畫資料來自 `scmData`；訂閱 `scm.forecast.updated` 將即時預測覆蓋疊加到對應 `materialNo`/`bucket`。',
        en: 'Plan data comes from `scmData`; subscribes to `scm.forecast.updated` to overlay live forecast updates onto the matching `materialNo`/`bucket`.',
      },
    ),
    events: ['scm.forecast.updated', 'scm.atp.promised'],
    related: ['control-tower', 'mrp', 'sales-orders'],
  },
  {
    id: 'supplier-scorecards',
    kind: 'module',
    domain: 'SCM',
    route: 'supplier-scorecards',
    title: { zh: '供應商計分卡', en: 'Supplier Scorecards' },
    tagline: { zh: '準時率、品質與前置天數供應商評比', en: 'On-time, quality and lead-time supplier rating' },
    sections: sections(
      {
        zh: '供應商計分卡頁以三項指標評比每個供應商：**準時交貨率**、**品質合格率**與**平均前置天數**，是供應商管理與風險識別的依據。',
        en: 'The Supplier Scorecards page rates each supplier on three metrics: **on-time delivery**, **quality** and **average lead days** — the basis for supplier management and risk identification.',
      },
      {
        zh: '每個供應商以一組放射儀表呈現三項指標，採色彩門檻上色：準時/品質 ≥95% 綠、≥85% 黃、否則紅；前置天數則相反（短為綠、長為紅）。任一項低於健康門檻即標記**at-risk**。點選開啟 Drill-In。',
        en: 'Each supplier shows three radial gauges color-gated by threshold: on-time/quality ≥95% emerald, ≥85% amber, else rose; lead days invert (short emerald, long rose). Any metric below healthy flags the supplier **at-risk**. Selecting opens a Drill-In.',
      },
      {
        zh: '點選供應商卡查看詳情。前置天數刻意使用「低為佳」色階，避免冗長前置時間在預設青色儀表上誤顯為綠色。',
        en: 'Click a supplier card for detail. Lead days deliberately use a lower-is-better scale so a long lead time never reads green on the default cyan gauge.',
      },
      {
        zh: '計分卡資料來自 `scmData`；每個供應商以 `bpNo` 鹽值產生穩定相位的微幅漂移。相關事件 `scm.supplier.asn`（供應商出貨通知）。',
        en: 'Scorecard data comes from `scmData`; each supplier drifts on its own stable phase salted by `bpNo`. Related event: `scm.supplier.asn` (advance shipment notice).',
      },
    ),
    events: ['scm.supplier.asn'],
    related: ['procurement', 'business-partners', 'control-tower'],
  },

  /* ═══════════════════════════ SYSTEM ═══════════════════════════ */
  {
    id: 'loop-clock',
    kind: 'topic',
    domain: 'SYSTEM',
    title: { zh: '迴圈時鐘', en: 'Loop Clock' },
    tagline: { zh: '180 秒確定性模擬迴圈', en: 'The 180-second deterministic simulation loop' },
    sections: sections(
      {
        zh: 'FabPulse 並非串接真實系統，而是以一個 **180 秒確定性迴圈**重播一整班的營運活動。每次重播完全一致——沒有亂數、沒有牆鐘時間進入渲染——這讓展示可重現、可教學。',
        en: 'FabPulse does not wire to live systems — it replays a full shift of operations on a **180-second deterministic loop**. Every replay is identical (no randomness, no wall-clock in render), which makes the demo reproducible and teachable.',
      },
      {
        zh: '迴圈時鐘提供兩個關鍵讀數：`loopT()`（本迴圈內已過秒數 0–180）與 `loopIndex`（第幾次重播）。TopBar 的時鐘與進度軌即由此驅動，所有事件都帶 `t`（迴圈秒）以便對齊。',
        en: 'The loop clock exposes two key readings: `loopT()` (seconds elapsed within this loop, 0–180) and `loopIndex` (which replay). The TopBar clock and progress track are driven by it, and every event carries `t` (loop seconds) for alignment.',
      },
      {
        zh: '一般使用無需操作。**簡報模式**：在網址加上 `?present` 可啟用適合演示的呈現方式。迴圈在 180 秒時重啟，發布 `shift.boundary` (loop-restart)，各模組據此自我修復狀態，不會跨迴圈漂移。',
        en: 'No action is needed in normal use. **Presenter mode**: append `?present` to the URL to enable a presentation-friendly rendering. The loop restarts at 180s, publishing `shift.boundary` (loop-restart); modules self-heal their state on it so nothing drifts across loops.',
      },
      {
        zh: '由 `lib/clock.createClock()` 實作，在 `App` 掛載時 `start()`、卸載時 `destroy()`。引擎在 `start()` 前先 `preRoll()` 預填歷史，使畫面一進入就有資料。',
        en: 'Implemented by `lib/clock.createClock()`, `start()`-ed on `App` mount and `destroy()`-ed on unmount. Engines `preRoll()` before `start()` to pre-fill history so screens have data the moment you arrive.',
      },
    ),
    events: ['shift.boundary', 'kpi.tick'],
    related: ['event-bus', 'fab-floor', 'kpi'],
  },
  {
    id: 'event-bus',
    kind: 'topic',
    domain: 'SYSTEM',
    title: { zh: '事件總線', en: 'Event Bus' },
    tagline: { zh: 'RxJS 環形緩衝區與回填模式', en: 'RxJS ring buffer and backfill-on-mount pattern' },
    sections: sections(
      {
        zh: '事件總線是 FabPulse 的中樞神經：所有 MES、ERP、SCM 事件都流經單一 RxJS 總線。模組透過訂閱事件 (`ofTopic`) 而非互相直接呼叫來解耦——這正是即時跨域聯動的基礎。',
        en: 'The event bus is FabPulse\'s central nervous system: all MES, ERP and SCM events flow through a single RxJS bus. Modules decouple by subscribing to events (`ofTopic`) rather than calling each other — the basis for live cross-domain choreography.',
      },
      {
        zh: '總線維護一個容量 **1000 筆的環形緩衝區**。核心 API：`publish(event)` 發布、`ofTopic(topic)` 訂閱單一主題（型別自動收斂）、`all$()` 訂閱全部、`getBuffer()` 取得歷史快照、`ringBuffer$()` 訂閱整個緩衝區（KPI 用）。',
        en: 'The bus maintains a **1000-entry ring buffer**. Core API: `publish(event)`; `ofTopic(topic)` to subscribe to one topic (with type narrowing); `all$()` for everything; `getBuffer()` for a history snapshot; `ringBuffer$()` to subscribe to the whole buffer (used by KPI).',
      },
      {
        zh: '關鍵模式是**掛載即回填 (backfill-on-mount)**：`ofTopic` 只推送掛載後的新事件，因此模組在掛載時先以 `getBuffer()` 種子化近期歷史，再訂閱即時流——這樣切換頁面後畫面不會從空白開始。',
        en: 'The key pattern is **backfill-on-mount**: `ofTopic` only pushes events after subscription, so modules seed recent history from `getBuffer()` on mount, then subscribe to the live stream — that\'s why screens never start blank after navigation.',
      },
      {
        zh: '由 `lib/eventBus.createEventBus()` 實作，型別為 `AppEvent`（MES + ERP + SCM 三個聯集）。事件主題見 `lib/events.ts`、`erpEvents.ts`、`scmEvents.ts`。',
        en: 'Implemented by `lib/eventBus.createEventBus()`, typed over `AppEvent` (the union of MES + ERP + SCM). Topics live in `lib/events.ts`, `erpEvents.ts` and `scmEvents.ts`.',
      },
    ),
    events: ['lot.move', 'equip.state', 'erp.order.created', 'scm.shipment.created'],
    related: ['loop-clock', 'mes-erp-bridge', 'scm-driver', 'fab-floor'],
  },
  {
    id: 'mes-erp-bridge',
    kind: 'topic',
    domain: 'SYSTEM',
    title: { zh: 'MES→ERP 橋接', en: 'MES→ERP Bridge' },
    tagline: { zh: '批次完工觸發收料與總帳分錄', en: 'Lot completion drives goods receipt and GL posting' },
    sections: sections(
      {
        zh: 'MES→ERP 橋接是讓「製造」與「企業資源」對話的關鍵元件。當 ERP 釋放生產單，橋接在車間建立並推進一個批次；當該批次完工，橋接把結果**回灌**成 ERP 的收料與會計分錄。',
        en: 'The MES→ERP bridge is what lets manufacturing and enterprise resources talk. When ERP releases a production order, the bridge creates and advances a lot on the floor; when that lot finishes, it feeds the result **back up** as ERP goods receipt and accounting entries.',
      },
      {
        zh: '「下行」路徑：收到 `erp.prodorder.released` → 建立批次、發 `erp.prodorder.status` (InProcess)、隨節奏發 `lot.move`。「上行」路徑：批次完工發 `lot.complete` → 收料 `erp.goods.movement` (GR) → 生產單 Completed → 兩筆 `erp.gl.posting`（成品 130000 / WIP 120000）→ 若有訂單則 `erp.invoice.created`。',
        en: 'The "down" path: on `erp.prodorder.released` → create a lot, emit `erp.prodorder.status` (InProcess), and pace out `lot.move`. The "up" path: lot completion emits `lot.complete` → goods receipt `erp.goods.movement` (GR) → prod order Completed → two `erp.gl.posting` entries (Finished Goods 130000 / WIP 120000) → and `erp.invoice.created` if an order exists.',
      },
      {
        zh: '橋接無需操作，但其效果可見於多處：生產單頁的 Live 進度、駕駛艙的批次/收料/發票泳道、財務頁的 GL 帳。**關鍵順序 (subscribe-before-emit)**：橋接必須在 ERP 引擎發出事件「之前」訂閱，否則第一筆會被丟失。',
        en: 'The bridge needs no operation, but its effects show up widely: Live progress on Production Orders, the Lot/GR/Invoice lanes in the Cockpit, the GL ledger in Finance. **Critical ordering (subscribe-before-emit)**: the bridge must subscribe before the ERP engine emits, or the first event is dropped.',
      },
      {
        zh: '由 `data/erp/bridge.createBridge(clock, eventBus, masterData, erpData)` 實作，在 `App` 中於 `erpEngine.start()` 前 `bridge.start()`。進度透過 `useBridgedLots` zustand store 暴露給生產單與駕駛艙。',
        en: 'Implemented by `data/erp/bridge.createBridge(clock, eventBus, masterData, erpData)`, with `bridge.start()` called before `erpEngine.start()` in `App`. Progress is exposed to Production Orders and the Cockpit via the `useBridgedLots` zustand store.',
      },
    ),
    events: [
      'erp.prodorder.released',
      'lot.complete',
      'erp.goods.movement',
      'erp.gl.posting',
      'erp.invoice.created',
    ],
    related: ['production-orders', 'erp-cockpit', 'finance', 'event-bus'],
  },
  {
    id: 'scm-driver',
    kind: 'topic',
    domain: 'SYSTEM',
    title: { zh: '供應鏈驅動器', en: 'SCM Shipment Driver' },
    tagline: { zh: 'ERP 事件觸發入庫與出貨貨運', en: 'ERP events spawn inbound and outbound shipments' },
    sections: sections(
      {
        zh: '供應鏈驅動器是 SCM 域的脊樑：它監聽 ERP 事件，把企業活動轉換成實體物流。採購觸發**入庫**貨運，生產單釋放觸發**出貨**貨運，使第三層供應鏈與前兩層連動。',
        en: 'The SCM shipment driver is the SCM spine: it listens to ERP events and turns enterprise activity into physical logistics. Procurement spawns **inbound** shipments and production-order releases spawn **outbound** shipments, linking the third (SCM) layer to the first two.',
      },
      {
        zh: '收到 `erp.po.created` → 建立供應商→FAB-01 的入庫貨運；收到 `erp.prodorder.released` → 建立 FAB→DC→客戶的出貨貨運。驅動器管理整個貨運生命週期（created→in-transit→arrived→delivered）並對應發出 `scm.shipment.*` 事件。',
        en: 'On `erp.po.created` → create a supplier→FAB-01 inbound shipment; on `erp.prodorder.released` → create a FAB→DC→customer outbound shipment. The driver owns the full lifecycle (created→in-transit→arrived→delivered), emitting the matching `scm.shipment.*` events.',
      },
      {
        zh: '無需操作；效果見於控制塔與貨運頁。**關鍵設計**：貨運狀態存於 zustand `useShipments` store（非總線），每 tick 進度為計算值而非事件——避免總線被高頻進度更新淹沒。驅動器同樣必須 subscribe-before-emit。',
        en: 'No operation needed; effects appear in the Control Tower and Shipments pages. **Key design**: shipment state lives in the zustand `useShipments` store (not the bus), and per-tick progress is computed rather than an event — keeping the bus free of high-frequency progress noise. The driver also subscribes before the ERP engine emits.',
      },
      {
        zh: '由 `data/scm/shipment-driver.createShipmentDriver(...)` 實作，在 `App` 中於 `erpEngine.start()` 前 `scmDriver.start()`。狀態經 `useShipments` store 暴露；位置由 `data/scm/shipmentPosition.shipmentPosition()` 計算。',
        en: 'Implemented by `data/scm/shipment-driver.createShipmentDriver(...)`, with `scmDriver.start()` called before `erpEngine.start()` in `App`. State is exposed via the `useShipments` store; position is computed by `data/scm/shipmentPosition.shipmentPosition()`.',
      },
    ),
    events: [
      'erp.po.created',
      'erp.prodorder.released',
      'scm.shipment.created',
      'scm.shipment.departed',
      'scm.shipment.arrived',
      'scm.shipment.delivered',
    ],
    related: ['control-tower', 'shipments', 'procurement', 'event-bus'],
  },
]
