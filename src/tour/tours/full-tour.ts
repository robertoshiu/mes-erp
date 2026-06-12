import type { ModuleRoute } from '@/lib/uiStore'
import type { TourChapter, TourDefinition } from '../types'
import {
  FULL_TOUR_META,
  MES_TOUR_META,
  ERP_TOUR_META,
  SCM_TOUR_META,
} from './meta'

/* ──────────────────────────────────────────────────────────────────────────
 * Master guided-tour content. Bilingual zh-TW (primary) + EN.
 *
 * Authoring rules honored here:
 *  - Every `target` references a real `data-tour` attribute tagged in the modules.
 *  - `route` drives navigation; `target` undefined → centered modal step.
 *  - `body` supports **bold**, `code`, and double-newline paragraphs.
 *  - `waitFor` gates autoplay on a real bus event (with a timeout fallback).
 *  - `action.selectEntity` opens a DrillInPanel via uiStore (SelectedEntity shape).
 *  - `pulse` adds a sonar ring on the spotlight.
 *
 * The five chapters are exported individually so the domain tours
 * (mes/erp/scm) can re-group them WITHOUT duplicating step content.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── Chapter 0 · 歡迎 Welcome (5 steps) ─────────────────────────────────────── */
export const chapterWelcome: TourChapter = {
  id: 'welcome',
  title: { zh: '歡迎', en: 'Welcome' },
  steps: [
    {
      id: 'welcome-intro',
      route: 'fab-floor',
      title: { zh: '歡迎使用 FabPulse', en: 'Welcome to FabPulse' },
      body: {
        zh: 'FabPulse 把 **MES 製造執行**、**ERP 企業資源規劃**與 **SCM 供應鏈**整合進同一個指揮中心。\n\n本導覽將帶你走過一條完整的營運資料流——從晶圓批次在機台間流動，到單據在 ERP 結算，再到貨物在供應鏈網絡上移動。',
        en: 'FabPulse fuses **MES** (manufacturing execution), **ERP** (resource planning), and **SCM** (supply chain) into one command center.\n\nThis tour walks the full operations data flow — from wafer lots moving across tools, to documents settling in ERP, to goods moving across the supply network.',
      },
      duration: 12,
    },
    {
      id: 'welcome-loop',
      route: 'fab-floor',
      target: 'topbar.loop-rail',
      placement: 'bottom',
      pulse: true,
      title: { zh: '180 秒確定性迴圈', en: 'The 180-Second Loop' },
      body: {
        zh: '畫面上的一切都由一個 **180 秒**的確定性模擬迴圈驅動。底部這條進度軌顯示迴圈在整班生產中的進度，到底後自動重播。\n\n「確定性」代表每次重播都產生完全相同的事件序列——適合教學與展示。',
        en: 'Everything you see is driven by a **180-second** deterministic simulation loop. This bottom rail tracks the loop’s progress through a full shift, then replays.\n\nDeterministic means every replay emits the exact same event sequence — ideal for teaching and demos.',
      },
      duration: 12,
    },
    {
      id: 'welcome-clock',
      route: 'fab-floor',
      target: 'topbar.clock',
      placement: 'bottom',
      title: { zh: '任務時鐘', en: 'Mission Clock' },
      body: {
        zh: '中央的**任務時鐘**顯示目前迴圈的時間 (`loopT`) 與週期數。所有事件都帶有 `t`(迴圈秒數)時間戳，畫面上的動態與這個時鐘同步。',
        en: 'The center **mission clock** shows the current loop time (`loopT`) and cycle index. Every event carries a `t` (loop-seconds) timestamp, and the live UI is slaved to this clock.',
      },
      duration: 8,
    },
    {
      id: 'welcome-sidebar',
      route: 'fab-floor',
      target: 'nav.sidebar',
      placement: 'right',
      title: { zh: '三域側欄', en: 'The Three-Domain Sidebar' },
      body: {
        zh: '左側導覽依 **MES / ERP / SCM** 三域分組，每組再依機能展開。徽章數字即時反映警報、缺料、延遲出貨等待辦事項。',
        en: 'The left nav is grouped into the **MES / ERP / SCM** domains, each broken down by function. The badge counts reflect live work — alarms, shortages, late shipments — as they happen.',
      },
      duration: 10,
    },
    {
      id: 'welcome-help',
      route: 'fab-floor',
      target: 'topbar.help',
      placement: 'bottom',
      pulse: true,
      title: { zh: '隨時重開導覽', en: 'Reopen the Tour Anytime' },
      body: {
        zh: '右上角的 **`?`** 按鈕隨時可開啟導覽中心,重播本導覽或切換到各模組的迷你導覽。\n\n鍵盤:`←` `→` 切換步驟、`Space` 播放/暫停、`Esc` 結束。',
        en: 'The **`?`** button (top-right) reopens the tour center anytime — replay this tour or jump into a per-module mini-tour.\n\nKeyboard: `←` `→` to step, `Space` to play/pause, `Esc` to exit.',
      },
      duration: 10,
    },
  ],
}

/* ── Chapter 1 · MES 製造執行 (14 steps) ───────────────────────────────────── */
export const chapterMes: TourChapter = {
  id: 'mes',
  title: { zh: 'MES 製造執行', en: 'MES Execution' },
  steps: [
    {
      id: 'mes-fab-floor',
      route: 'fab-floor',
      title: { zh: '車間總覽', en: 'The Fab Floor' },
      body: {
        zh: '我們從**車間總覽**開始。這是即時的廠房地圖,顯示機台佈局、批次流動與事件串流——也是整個 MES 的起點。',
        en: 'We begin on the **fab floor** — the live shop-floor map showing the tool layout, lot flow, and the event stream. This is where the whole MES story starts.',
      },
      duration: 10,
    },
    {
      id: 'mes-kpi-strip',
      route: 'fab-floor',
      target: 'fab-floor.kpi-strip',
      placement: 'bottom',
      pulse: true,
      title: { zh: '即時 KPI 帶', en: 'Live KPI Strip' },
      body: {
        zh: '頂部的 **KPI 帶**隨 `kpi.tick` 事件即時更新:產出、稼動率 (`OEE`)、在製品 (WIP) 等指標每秒由事件環狀緩衝區重算。',
        en: 'The top **KPI strip** updates live on each `kpi.tick`: throughput, utilization (`OEE`), and WIP are recomputed every second from the event ring buffer.',
      },
      duration: 10,
    },
    {
      id: 'mes-bay-map',
      route: 'fab-floor',
      target: 'fab-floor.bay-map',
      placement: 'auto',
      title: { zh: 'Bay 佈局地圖', en: 'Bay Layout Map' },
      body: {
        zh: '**Bay 地圖**把每台機台畫成一個節點,顏色就是它的 `E10` 狀態。批次在機台間移動 (`lot.move`) 時,會有一道彗星軌跡掠過——這就是晶圓在產線上流動的視覺化。',
        en: 'The **bay map** renders each tool as a node colored by its `E10` state. When a lot moves between tools (`lot.move`), a comet trail sweeps across — wafer flow on the line, visualized.',
      },
      duration: 12,
    },
    {
      id: 'mes-production',
      route: 'production',
      target: 'production.lot-table',
      placement: 'auto',
      title: { zh: '生產批次 WIP', en: 'Production WIP' },
      body: {
        zh: '**生產**頁追蹤每一個在製批次(lot)。表格欄位涵蓋產品、客戶、製程途程 (route)、進度與優先序;超急件 (super-hot) 會以紅色脈動標示。',
        en: 'The **Production** board tracks every work-in-process lot. Columns cover product, customer, process route, progress, and priority — super-hot lots pulse critical red.',
      },
      duration: 12,
    },
    {
      id: 'mes-production-drill',
      route: 'production',
      target: 'production.lot-table',
      placement: 'auto',
      action: { type: 'selectEntity', entity: { type: 'lot', id: 'LOT-2622W-00001' } },
      title: { zh: '選取批次', en: 'Select a Lot' },
      body: {
        zh: '點選表格中任一列即可選取該批次,並在右側開啟 **Drill-In** 詳情面板。我們已替你選取第一個批次——回到表格,點任一列即可換批次。',
        en: 'Click any row in the table to select that lot and open its **Drill-In** detail panel on the right. We’ve selected the first lot for you — back in the table, click any row to switch lots.',
      },
      duration: 12,
    },
    {
      id: 'mes-production-drillin-panel',
      route: 'production',
      target: 'drillin.panel',
      placement: 'left',
      action: { type: 'selectEntity', entity: { type: 'lot', id: 'LOT-2622W-00001' } },
      title: { zh: '批次 Drill-In 面板', en: 'Lot Drill-In Panel' },
      body: {
        zh: '右側的 **Drill-In** 面板顯示所選批次的詳情:產品、客戶、途程 (route)、晶圓數、優先序與狀態等欄位;**Route Steps** 區段逐步列出製程途程,目前步驟以 accent 高亮並標示 **Current**;若有母/子批次,**Genealogy** 區段會列出批次族譜。\n\n按面板右上角的 **✕** 或鍵盤 **Esc** 即可關閉面板。',
        en: 'The **Drill-In** panel on the right shows the selected lot’s detail: product, customer, route, wafer count, priority, and status fields; the **Route Steps** section lists each process step with the current one highlighted in accent and tagged **Current**; if the lot has parent/child lots, a **Genealogy** section lists its lineage.\n\nPress the **✕** at the panel’s top-right or the keyboard **Esc** to close it.',
      },
      duration: 14,
    },
    {
      id: 'mes-equipment',
      route: 'equipment',
      target: 'equipment.roster',
      placement: 'auto',
      action: { type: 'clearSelection' },
      title: { zh: '機台 E10 狀態', en: 'Equipment E10 State' },
      body: {
        zh: '**機台**頁以 SEMI `E10` 標準追蹤每台機台的狀態:`PROD`(生產)、`STBY`(待命)、`SDT`/`UDT`(計畫/非計畫停機)、`ENG`(工程)、`NSC`(無排程)、`OUT`(離線)。停機狀態會脈動示警。',
        en: 'The **Equipment** roster tracks each tool against the SEMI `E10` standard: `PROD`, `STBY`, `SDT`/`UDT` (scheduled/unscheduled downtime), `ENG`, `NSC`, `OUT`. Down states pulse to draw the eye.',
      },
      duration: 12,
    },
    {
      id: 'mes-equipment-dist',
      route: 'equipment',
      target: 'equipment.state-dist',
      placement: 'bottom',
      waitFor: { topic: 'equip.state', timeoutMs: 20000 },
      title: { zh: '狀態分佈 · 即時轉態', en: 'State Distribution · Live Transition' },
      body: {
        zh: '標題列的**狀態分佈條**即時呈現整廠機台落在各 `E10` 狀態的比例。\n\n稍候片刻——當下一個 `equip.state` 事件抵達,某台機台會轉態,分佈條會隨之重新分配。點選機台還能在 Drill-In 看到它的 SECS 訊息逐字打字。',
        en: 'The **state-distribution bar** in the header shows the live fleet split across the `E10` states.\n\nHold for a moment — when the next `equip.state` event lands, a tool transitions and the bar redistributes. Select a tool to watch its SECS messages type out live in the drill-in.',
      },
      duration: 14,
    },
    {
      id: 'mes-spc',
      route: 'spc',
      target: 'spc.control-chart',
      placement: 'auto',
      title: { zh: 'SPC 管制圖', en: 'SPC Control Chart' },
      body: {
        zh: '**SPC / 品質**頁即時繪製關鍵尺寸 (CD) 的管制圖。每個 `spc.violation` 事件成為一個量測點;落在管制上下限 (`UCL`/`LCL`) 之外的點以玫瑰紅標示為違規。',
        en: 'The **SPC / Quality** screen plots a live control chart of critical-dimension (CD) uniformity. Each `spc.violation` event becomes a point; points beyond the control limits (`UCL`/`LCL`) flag rose-red as violations.',
      },
      duration: 12,
    },
    {
      id: 'mes-spc-cap',
      route: 'spc',
      target: 'spc.stats',
      placement: 'bottom',
      title: { zh: '製程能力 Cp / Cpk', en: 'Process Capability Cp / Cpk' },
      body: {
        zh: '上方統計磚顯示**製程能力** `Cp` 與 `Cpk`,以及違規計數。違規依西方電氣規則分類:**規則 1**(超出 3σ)、**規則 2**(連續 9 點同側)、**規則 4**(14 點交替)。`Cpk` ≥ 1.33 為良好(綠)。',
        en: 'The stat tiles show **process capability** `Cp` and `Cpk` plus the violation count. Violations classify by Western Electric rules: **Rule 1** (beyond 3σ), **Rule 2** (9 consecutive same-side), **Rule 4** (14 alternating). `Cpk` ≥ 1.33 reads green (capable).',
      },
      duration: 12,
    },
    {
      id: 'mes-recipe',
      route: 'recipe',
      target: 'recipe.library',
      placement: 'right',
      title: { zh: '配方管理', en: 'Recipe Management' },
      body: {
        zh: '**配方管理**頁依機台類型 (`LITHO`、`ETCH`、`CMP`…) 分組陳列製程配方。點選任一配方即可查看其參數與**版本歷史**——一條 commit-graph 風格的時間軸,標示每次主/次/修訂版變更與簽核者。',
        en: 'The **Recipe Management** screen lists process recipes grouped by tool type (`LITHO`, `ETCH`, `CMP`…). Select a recipe to see its parameters and **version history** — a commit-graph timeline marking each major/minor/patch bump and its author.',
      },
      duration: 12,
    },
    {
      id: 'mes-alarms',
      route: 'alarms',
      target: 'alarms.feed',
      placement: 'auto',
      title: { zh: '警報台', en: 'Alarm Desk' },
      body: {
        zh: '**警報**頁串流 `alarm.raised` 事件,依嚴重度分級:**critical**(脈動紅)、**major**(琥珀)、**minor**(灰)。頂部摘要列即時統計各級數量。',
        en: 'The **Alarms** desk streams `alarm.raised` events, ranked by severity: **critical** (pulsing red), **major** (amber), **minor** (grey). The summary strip tallies each level live.',
      },
      duration: 11,
    },
    {
      id: 'mes-alarms-ack',
      route: 'alarms',
      target: 'alarms.feed',
      placement: 'auto',
      title: { zh: '警報確認流程', en: 'Alarm Acknowledge Flow' },
      body: {
        zh: '點選任一警報會開啟 Drill-In,顯示來源、訊息與 **SOP 參考**。按 **Acknowledge** 會發出一個 `alarm.ack` 事件,把該警報標記為已確認 (ACK)——側欄的警報徽章數也會隨之下降。',
        en: 'Clicking an alarm opens its drill-in with the source, message, and **SOP reference**. Pressing **Acknowledge** emits an `alarm.ack` event that stamps the alarm as ACK’d — and the sidebar alarm badge drops accordingly.',
      },
      duration: 12,
    },
    {
      id: 'mes-kpi',
      route: 'kpi',
      target: 'kpi.hero',
      placement: 'bottom',
      title: { zh: 'KPI 儀表板 · OEE', en: 'KPI Dashboard · OEE' },
      body: {
        zh: 'MES 的最後一站是 **KPI 儀表板**。兩個英雄量表是 **`OEE`**(整體設備效率)與**良率 (Yield)**。`OEE = 可用率 × 效能 × 良率`——同時涵蓋停機、速度與品質損失,是產線健康的單一綜合指標。下方趨勢圖與指標磚補足 MTBF、MTTR、週期時間等細節。',
        en: 'The last MES stop is the **KPI Dashboard**. The two hero gauges are **`OEE`** (Overall Equipment Effectiveness) and **Yield**. `OEE = Availability × Performance × Quality` — one number folding downtime, speed, and quality loss. The trend chart and metric tiles below fill in MTBF, MTTR, and cycle time.',
      },
      duration: 14,
    },
  ],
}

/* ── Chapter 2 · ERP 企業資源 (12 steps) ───────────────────────────────────── */
export const chapterErp: TourChapter = {
  id: 'erp',
  title: { zh: 'ERP 企業資源', en: 'ERP Resource Planning' },
  steps: [
    {
      id: 'erp-cockpit-intro',
      route: 'erp-cockpit',
      title: { zh: '進入 ERP 領域', en: 'Entering the ERP Domain' },
      body: {
        zh: '製造現場的活動會即時投射到 **ERP**。第二章從**單據流駕駛艙**開始——這是 ERP 的英雄畫面,也是 order-to-cash(訂單到收款)管線的全景。',
        en: 'Activity on the floor projects live into **ERP**. Chapter two opens at the **Document-Flow Cockpit** — the ERP hero screen and a panorama of the order-to-cash pipeline.',
      },
      duration: 10,
    },
    {
      id: 'erp-cockpit-lanes',
      route: 'erp-cockpit',
      target: 'erp-cockpit.swimlane',
      placement: 'auto',
      title: { zh: '單據流泳道', en: 'The Document Swimlanes' },
      body: {
        zh: '駕駛艙以六條**泳道**呈現單據鏈:**Sales Order → Planned → Prod Order → Lot → Goods Receipt → Invoice**。每條泳道保留一個累計**計數**(總覽)與最近約 6 筆單據的發光晶片(動態)。',
        en: 'The cockpit lays the document chain across six **swimlanes**: **Sales Order → Planned → Prod Order → Lot → Goods Receipt → Invoice**. Each lane keeps a rolling **count** (the overview) plus the latest ~6 docs as glowing chips (the motion).',
      },
      duration: 13,
    },
    {
      id: 'erp-cockpit-glow',
      route: 'erp-cockpit',
      target: 'erp-cockpit.swimlane',
      placement: 'auto',
      title: { zh: '事件驅動的即時亮燈', en: 'Event-Driven Glow' },
      body: {
        zh: '泳道完全由事件驅動:`erp.order.created` 點亮 Sales Order、`erp.prodorder.released` 點亮 Prod Order、`lot.complete` 與 `erp.goods.movement` 點亮 Lot 與 Goods Receipt。最新的晶片帶 accent 光暈並標示 **New**;點晶片可跨域深連到該單據。',
        en: 'The lanes are entirely event-driven: `erp.order.created` lights Sales Order, `erp.prodorder.released` lights Prod Order, and `lot.complete` plus `erp.goods.movement` light Lot and Goods Receipt. The freshest chip carries an accent glow tagged **New**; clicking a chip deep-links cross-domain to that document.',
      },
      duration: 13,
    },
    {
      id: 'erp-sales-orders',
      route: 'sales-orders',
      target: 'sales-orders.atp',
      placement: 'bottom',
      title: { zh: '銷售訂單 · ATP', en: 'Sales Orders · ATP' },
      body: {
        zh: '**銷售訂單**頁是訂單簿。頂部的 **ATP (可承諾量)** 面板把供給拆解為:現有庫存、在途、計畫產出,對上已承諾需求;覆蓋率不足時缺口段會脈動紅光。每筆訂單還帶 ATP 承諾狀態與可能順延的承諾日。',
        en: 'The **Sales Orders** screen is the order book. The top **ATP (Available-to-Promise)** panel decomposes supply — on-hand, in-transit, planned production — against committed demand; the shortfall segment pulses red when coverage is short. Each order carries an ATP promise status and a (possibly slipped) promised date.',
      },
      duration: 13,
    },
    {
      id: 'erp-mrp',
      route: 'mrp',
      target: 'mrp.matrix',
      placement: 'auto',
      title: { zh: 'MRP 物料覆蓋', en: 'MRP Material Coverage' },
      body: {
        zh: '**MRP / 規劃**頁以覆蓋矩陣呈現每項物料的供需平衡。讀法是三個桶:**需求**(消耗此料的生產單)、**供給**(補料的採購單)、**可用 (Available)**(現有減已承諾)。任一時段桶的投影在製 (projected on-hand) 跌至 0 以下,即以紅光標示為缺料。',
        en: 'The **MRP / Planning** screen shows each material’s supply-demand balance as a coverage matrix. Read it as three buckets: **demand** (production orders consuming the material), **supply** (purchase orders replenishing it), and **available** (on-hand less committed). Any time-bucket whose projected on-hand drops to zero or below glows critical as a shortage.',
      },
      duration: 14,
    },
    {
      id: 'erp-production-orders',
      route: 'production-orders',
      target: 'production-orders.table',
      placement: 'auto',
      title: { zh: '生產單 · 橋接 MES 進度', en: 'Production Orders · Bridged MES Progress' },
      body: {
        zh: '**生產單**頁是 ERP 與 MES 交會之處。`erp.prodorder.released` 釋出的生產單,一旦被橋接到車間的批次,**Live Progress** 欄就會出現一條即時進度條——直接反映該 lot 在 fab floor 上的步驟進度。這就是 ERP 計畫與實際製造的接點。',
        en: 'The **Production Orders** screen is where ERP meets MES. Once an order released via `erp.prodorder.released` is bridged to a floor lot, the **Live Progress** column shows a real-time bar — reflecting that lot’s step progress on the fab floor. This is the seam between the ERP plan and actual execution.',
      },
      duration: 14,
    },
    {
      id: 'erp-inventory',
      route: 'inventory',
      target: 'inventory.table',
      placement: 'auto',
      title: { zh: '庫存與儲位', en: 'Inventory & Stock' },
      body: {
        zh: '**庫存**頁以物料 × 儲位呈現現有 (on-hand)、已承諾 (committed)、可用 (available) 三量。可用量跌至 0 以下的列會閃紅燈並計入頂部缺料計數——與 MRP 的缺料判讀一致。',
        en: 'The **Inventory** screen browses stock by material × storage location: on-hand, committed, and available. Rows whose available drops to zero or below flash red and roll into the header shortage count — consistent with the MRP reading.',
      },
      duration: 11,
    },
    {
      id: 'erp-procurement',
      route: 'procurement',
      target: 'procurement.table',
      placement: 'auto',
      title: { zh: '採購 · 採購單', en: 'Procurement · Purchase Orders' },
      body: {
        zh: '**採購**頁追蹤對供應商的採購單 (PO),狀態分 open / confirmed / received / **late**。延遲的 PO 以脈動紅光標示——這些正是稍後在 SCM 端會驅動入庫貨運的單據。',
        en: 'The **Procurement** screen tracks purchase orders to suppliers, with status open / confirmed / received / **late**. Late POs pulse critical red — and these are the very documents that drive inbound shipments on the SCM side later.',
      },
      duration: 11,
    },
    {
      id: 'erp-materials',
      route: 'materials',
      target: 'materials.table',
      placement: 'auto',
      title: { zh: '物料主檔', en: 'Material Master' },
      body: {
        zh: '**物料**主檔依類型分:**FERT**(成品)、**HALB**(半成品)、**ROH**(原料)。之後在此頁點選任一 FERT,即可在 Drill-In 看到它的 BOM 組成。標準成本欄稍後會餵入財務的庫存估值。',
        en: 'The **Materials** master is typed: **FERT** (finished), **HALB** (semi-finished), **ROH** (raw). After the tour, select any FERT here to inspect its BOM components in the drill-in. The standard-cost column later feeds Finance’s inventory valuation.',
      },
      duration: 11,
    },
    {
      id: 'erp-business-partners',
      route: 'business-partners',
      target: 'business-partners.table',
      placement: 'auto',
      title: { zh: '商業夥伴', en: 'Business Partners' },
      body: {
        zh: '**商業夥伴**主檔涵蓋客戶與供應商,角色分 customer / vendor / both,並記錄國別、付款條件 (terms) 與貿易條件 (incoterms)。銷售訂單與採購單都以此處的夥伴編號 (`bpNo`) 為對象。',
        en: 'The **Business Partners** master covers customers and vendors, with role customer / vendor / both, plus country, payment terms, and incoterms. Both sales orders and purchase orders reference the partner number (`bpNo`) defined here.',
      },
      duration: 11,
    },
    {
      id: 'erp-bom',
      route: 'bom',
      target: 'bom.tree',
      placement: 'auto',
      title: { zh: '物料清單 BOM', en: 'Bill of Materials' },
      body: {
        zh: '**BOM** 頁以樹狀結構展開成品的物料清單:選取左側一個結構,右側即畫出母件與其組件(含用量與單位)的層級樹。這條結構正是 MRP 把成品需求展開成原料需求的依據。',
        en: 'The **BOM** screen expands a finished good’s structure as a tree: pick a structure on the left and the right pane draws the header material and its components (with quantities and units). This structure is exactly what MRP explodes a finished-good demand into raw-material demand against.',
      },
      duration: 12,
    },
    {
      id: 'erp-finance',
      route: 'finance',
      target: 'finance.ledger',
      placement: 'left',
      title: { zh: '財務 · 總帳過帳', en: 'Finance · GL Postings' },
      body: {
        zh: 'ERP 的終點是**財務**。右側的 **GL 過帳**分錄帳本完全由事件驅動:每筆 `erp.gl.posting` 隨訂單、收貨、發票結算而流入,即時記入總帳。左側的成本中心與上方的庫存值、WIP、營收、應收 (AR) 指標磚,構成這條金流的全貌。',
        en: 'ERP ends at **Finance**. The **GL Postings** ledger on the right is fully event-driven: each `erp.gl.posting` streams in as orders, receipts, and invoices settle, posting to the general ledger live. The cost centers on the left and the inventory-value / WIP / revenue / AR tiles up top complete the money picture.',
      },
      duration: 13,
    },
  ],
}

/* ── Chapter 3 · SCM 供應鏈 (5 steps) ──────────────────────────────────────── */
export const chapterScm: TourChapter = {
  id: 'scm',
  title: { zh: 'SCM 供應鏈', en: 'SCM Supply Chain' },
  steps: [
    {
      id: 'scm-control-tower',
      route: 'control-tower',
      target: 'control-tower.network',
      placement: 'auto',
      title: { zh: '供應網絡控制塔', en: 'Supply Network Control Tower' },
      body: {
        zh: '歡迎來到 **SCM** 的英雄畫面——**控制塔**。這張網絡圖把供應鏈畫成節點與航道:**供應商**(上游)、**FAB-01**(中央錨點)、**配送中心 DC**、**客戶**(終點)。航道的線條紋理代表運輸模式:空運虛線、海運點線、陸運實線。',
        en: 'Welcome to the **SCM** hero — the **Control Tower**. This network map draws the supply chain as nodes and lanes: **suppliers** (upstream), **FAB-01** (the center anchor), **distribution centers**, and **customers** (the endpoints). A lane’s stroke texture encodes its mode: air dashed, sea dotted, truck solid.',
      },
      duration: 14,
    },
    {
      id: 'scm-control-tower-dots',
      route: 'control-tower',
      target: 'control-tower.network',
      placement: 'auto',
      title: { zh: '貨運點與斷鏈警示', en: 'Shipment Dots & Disruptions' },
      body: {
        zh: '航道上滑行的發光**貨運點**就是在途貨件,位置由 `shipmentPosition(t, …)` 每一幀計算——抵達時節點會閃出綠色聲納波。當某條航道發生斷鏈,它會轉為紅色並以 **marching-ants**(行進虛線)動畫脈動,同時在左上角列出原因。',
        en: 'The glowing **shipment dots** gliding along the lanes are in-transit shipments, positioned every frame from `shipmentPosition(t, …)`; an arrival fires a green success sonar at the node. When a lane is disrupted it turns red and pulses with a **marching-ants** animation, with the reason listed top-left.',
      },
      duration: 14,
    },
    {
      id: 'scm-shipments',
      route: 'shipments',
      target: 'shipments.table',
      placement: 'auto',
      title: { zh: '出貨 / 在途', en: 'Shipments / In-Transit' },
      body: {
        zh: '**出貨**頁是控制塔的表格視圖:每一列是一筆貨件,方向分 **inbound**(供應商→廠)與 **outbound**(廠→客戶)。進度條與 ETA 同樣由 `shipmentPosition` 計算(非儲存欄位);逾 ETA 的列閃 row-hot,受斷鏈影響的列閃 row-superhot。',
        en: 'The **Shipments** screen is the Control Tower’s table view: one row per shipment, direction **inbound** (supplier→fab) or **outbound** (fab→customer). The progress bar and ETA are computed from `shipmentPosition` (never a stored field); rows past ETA flash row-hot, disruption-affected rows flash row-superhot.',
      },
      duration: 13,
    },
    {
      id: 'scm-demand-planning',
      route: 'demand-planning',
      target: 'demand-planning.chart',
      placement: 'bottom',
      title: { zh: '需求規劃 · 預測 vs 實際', en: 'Demand Planning · Forecast vs Actual' },
      body: {
        zh: '**需求規劃**頁把每項成品的**預測**與**實際**疊在同一張圖上,跨整個規劃週期 (W1…Wn)。`scm.forecast.updated` 事件會即時重畫某個時段的預測;偏離最大的需求高峰會以 **SPIKE** 參考線標出。下方網格以綠/琥珀/紅熱度標示變異 (variance)。',
        en: 'The **Demand Planning** screen overlays each finished good’s **forecast** against **actuals** across the planning horizon (W1…Wn). A `scm.forecast.updated` event re-plans a bucket live; the largest over-plan demand spike is marked with a **SPIKE** reference line. The grid below heat-tints variance green / amber / red.',
      },
      duration: 14,
    },
    {
      id: 'scm-supplier-scorecards',
      route: 'supplier-scorecards',
      target: 'supplier-scorecards.grid',
      placement: 'auto',
      title: { zh: '供應商評分卡 · ASN', en: 'Supplier Scorecards · ASN' },
      body: {
        zh: '**供應商評分卡**為每家供應商呈現三個量表:**準時率**、**品質**、**平均前置時間 (lead)**。`scm.supplier.asn`(預先到貨通知)事件抵達時,會推升該供應商的 Open-ASN 計數並微調量表。任一指標低於門檻,整張卡標示為 **At risk**。',
        en: 'The **Supplier Scorecards** show three gauges per vendor: **on-time**, **quality**, and **average lead time**. An incoming `scm.supplier.asn` (advance ship notice) bumps that vendor’s open-ASN count and nudges the gauges. If any metric falls below target, the whole card flags **At risk**.',
      },
      duration: 13,
    },
  ],
}

/* ── Chapter 4 · 跨域資料流 終章 Finale (6 steps) ──────────────────────────── */
export const chapterFinale: TourChapter = {
  id: 'finale',
  title: { zh: '跨域資料流 · 終章', en: 'Cross-Domain Data Flow · Finale' },
  steps: [
    {
      id: 'finale-intro',
      route: 'erp-cockpit',
      action: { type: 'clearSelection' },
      title: { zh: '把整條線串起來', en: 'Threading the Whole Line' },
      body: {
        zh: '我們回到**單據流駕駛艙**,把走過的每一站串成一條完整的資料流。先看正向(訂單到出貨)的這一條主線:',
        en: 'We return to the **Document-Flow Cockpit** to thread every stop we’ve seen into one data flow. First, the forward (order-to-ship) spine:',
      },
      duration: 10,
    },
    {
      id: 'finale-forward',
      route: 'erp-cockpit',
      target: 'erp-cockpit.swimlane',
      placement: 'auto',
      title: { zh: '正向主線 · SO → 發票', en: 'Forward Spine · SO → Invoice' },
      body: {
        zh: '**銷售訂單 (`erp.order.created`)** 觸發 **MRP** 規劃,產出**計畫訂單**;釋出為**生產單 (`erp.prodorder.released`)** 後,橋接到 fab floor 成為一個 **MES 批次 (lot)**。批次在機台間流動,進度即時回饋到生產單那一欄。',
        en: 'A **Sales Order (`erp.order.created`)** triggers **MRP**, which yields a **planned order**; released as a **production order (`erp.prodorder.released`)**, it bridges to the fab floor as an **MES lot**. The lot flows across tools, its progress feeding back to the production-order column live.',
      },
      duration: 14,
    },
    {
      id: 'finale-watch-live',
      route: 'erp-cockpit',
      target: 'erp-cockpit.swimlane',
      placement: 'auto',
      waitFor: { topic: 'erp.goods.movement', timeoutMs: 30000 },
      pulse: true,
      title: { zh: '即時見證 · 批次完成 → 收貨', en: 'Watch It Happen · Lot Complete → Receipt' },
      body: {
        zh: '稍候——當一個批次在車間跑完途程,橋接層會發出 `lot.complete`,接著觸發**收貨 (Goods Receipt)** 與一筆 `erp.gl.posting` 總帳過帳,最後開立**發票 (`erp.invoice.created`)**。\n\n我們正在等下一個 `erp.goods.movement` 事件——看 **Goods Receipt** 泳道亮起新晶片,這就是整條線在你眼前合龍。',
        en: 'Hold on — when a lot finishes its route on the floor, the bridge emits `lot.complete`, which triggers a **Goods Receipt** plus an `erp.gl.posting` to the ledger, and finally an **invoice (`erp.invoice.created`)**.\n\nWe’re waiting on the next `erp.goods.movement` — watch the **Goods Receipt** lane light a fresh chip. That’s the whole line closing the loop in front of you.',
      },
      duration: 16,
    },
    {
      id: 'finale-reverse',
      route: 'erp-cockpit',
      target: 'erp-cockpit.swimlane',
      placement: 'auto',
      title: { zh: '反向支線 · 採購 → 入庫貨運', en: 'Reverse Leg · PO → Inbound Shipment' },
      body: {
        zh: '還有一條反向支線:當 ERP 發出採購單 (`erp.po.created`),SCM 的 **shipment driver** 會據此建立一筆 **inbound 貨運**,讓供應商的料件沿著控制塔的航道送進 FAB-01。ERP 的計畫,就這樣化為 SCM 網絡上實際移動的貨物。',
        en: 'There’s also a reverse leg: when ERP issues a purchase order (`erp.po.created`), the SCM **shipment driver** creates an **inbound shipment**, carrying supplier material along a Control Tower lane into FAB-01. The ERP plan becomes goods actually moving across the SCM network.',
      },
      duration: 13,
    },
    {
      id: 'finale-recap',
      route: 'erp-cockpit',
      title: { zh: '全貌回顧', en: 'The Full Picture' },
      body: {
        zh: '至此你已看過整條線:**MES** 把晶圓變成完成的批次、**ERP** 把製造活動結算成單據與金流、**SCM** 把計畫化為網絡上移動的貨物——三域共用同一條 RxJS 事件匯流排,因此每個動作都即時、跨域、彼此呼應。',
        en: 'You’ve now seen the whole line: **MES** turns wafers into finished lots, **ERP** settles that activity into documents and money, and **SCM** turns plans into goods moving across the network — all three sharing one RxJS event bus, so every action is live, cross-domain, and mutually aware.',
      },
      duration: 12,
    },
    {
      id: 'finale-done',
      route: 'erp-cockpit',
      target: 'topbar.help',
      placement: 'bottom',
      pulse: true,
      title: { zh: '導覽完成 🎉', en: 'Tour Complete 🎉' },
      body: {
        zh: '恭喜——你已走完 FabPulse 的完整營運流程!此導覽的完成狀態已**自動儲存**。\n\n想深入了解任何主題,翻閱 **Handbook**(側欄 HELP 群組);要重播導覽或開啟單一模組的迷你導覽,隨時點右上角的 **`?`** 按鈕。',
        en: 'Congratulations — you’ve completed the full FabPulse operations flow! This tour’s completion is **saved automatically**.\n\nTo go deeper on any topic, browse the **Handbook** (HELP group in the sidebar); to replay the tour or launch a per-module mini-tour, hit the **`?`** button top-right anytime.',
      },
      duration: 12,
    },
  ],
}

/* ── Assembled master tour ──────────────────────────────────────────────────── */
export const fullTour: TourDefinition = {
  ...FULL_TOUR_META,
  chapters: [chapterWelcome, chapterMes, chapterErp, chapterScm, chapterFinale],
}

/* ── Domain mini-tours ──────────────────────────────────────────────────────────
 * These do NOT duplicate any step content — they re-group the very same chapter
 * objects above. Each opens with the shared Welcome chapter for orientation,
 * then the domain's chapter. Titles/descriptions come from `meta.ts`.
 * ──────────────────────────────────────────────────────────────────────────── */
const mesTour: TourDefinition = {
  ...MES_TOUR_META,
  chapters: [chapterWelcome, chapterMes],
}

const erpTour: TourDefinition = {
  ...ERP_TOUR_META,
  chapters: [chapterWelcome, chapterErp],
}

const scmTour: TourDefinition = {
  ...SCM_TOUR_META,
  chapters: [chapterWelcome, chapterScm, chapterFinale],
}

/** All assembled tours, keyed lookup. Used only by the lazy loaders in index.ts. */
export const allTours: TourDefinition[] = [fullTour, mesTour, erpTour, scmTour]

export function getTourById(id: string): TourDefinition | null {
  return allTours.find(t => t.id === id) ?? null
}

/**
 * Derive a single-chapter mini-tour for one module by filtering the DOMAIN
 * chapters' steps (MES / ERP / SCM) down to those whose `route` matches.
 *
 * Only the domain chapters are scanned — never welcome/finale — so steps that
 * merely set a `route` for navigation/orientation (e.g. the welcome chapter's
 * `fab-floor` steps, or the finale's `erp-cockpit` recap) don't bleed into a
 * page tour at the wrong altitude. Returns null when no steps match.
 */
const DOMAIN_CHAPTERS = [chapterMes, chapterErp, chapterScm]

export function deriveModuleTour(route: ModuleRoute): TourDefinition | null {
  const steps = DOMAIN_CHAPTERS
    .flatMap(c => c.steps)
    .filter(s => s.route === route)
  if (steps.length === 0) return null
  return {
    id: `module:${route}`,
    title: fullTour.title,
    description: fullTour.description,
    estMinutes: Math.max(1, Math.round(steps.length * 0.4)),
    chapters: [{ id: route, title: fullTour.title, steps }],
  }
}
