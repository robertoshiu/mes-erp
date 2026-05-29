# FabPulse 操作功能說明書（SA / 使用者操作手冊）

> 以「畫面」為單位之操作說明 · 版本 2026-05-29 · 對應分支 `master`
> 適用對象：操作人員、系統分析（SA）、教育訓練。
> 範圍：MES 7 + ERP 10 + SCM 4 共 21 個畫面（ATP 併於 ERP 銷售訂單畫面）。
> 說明：本系統為純前端展示系統，所有資料由 180 秒決定性模擬迴圈自動產生並即時更新，**操作者無需手動輸入或存檔；多數畫面為觀測與查詢（drill-in）導向**。

---

## 第一篇　通用操作說明（所有畫面共通）

### 1.1 系統進入與畫面門檻
1. 以桌機瀏覽器開啟系統首頁。
2. **視窗寬度需 ≥ 1280px**；若小於 1280px，畫面會以提示卡取代（「Requires a viewport ≥ 1280px」），請放大視窗或改用桌機。
3. 進入後預設停在 **MES > Fab Floor（廠房現場）** 畫面。

### 1.2 主畫面配置
| 區域 | 位置 | 說明 |
|------|------|------|
| 側邊導覽欄 | 左側固定 | 三域（MES / ERP / SCM）模組選單，可摺疊群組 |
| 頂欄 TopBar | 上方固定 | 廠別、生產狀態、任務時鐘、班別、在班人數、迴圈進度條 |
| 主內容區 | 中央 | 目前所選畫面 |
| 明細抽屜 DrillInPanel | 由右側滑入 | 點選資料列後出現，顯示該筆明細（部分畫面） |

### 1.3 導覽操作（側邊欄）
1. 側欄分三域：**MES**（青色標題）、**ERP**（青色標題）、**SCM**（靛色標題）。
2. 每域下有可摺疊**群組**；點群組標題（含展開箭頭）可**收合／展開**該群組。
3. 點任一**模組項目**即切換主內容區至該畫面；作用中項目左側顯示青色發光條與高亮。
4. 部分項目右側顯示**數字徽章**（即時計數）：
   - 紅色脈動：Alarms（警報）、MRP/Planning（缺料）、SCM Disruptions（航段中斷）— 需注意。
   - 琥珀色：Equipment（停機機台）、Procurement（逾期採購）、Shipments late（逾期在途）。
   - 青色：一般計數（如 In-Transit 在途、Open Orders 未結訂單、Production 在製批）。

### 1.4 頂欄資訊（TopBar）
- 左：`FAB-01` 廠別、`PRODUCTION` 生產中（綠點呼吸）、`Week 22 · 2026`。
- 中：**任務時鐘** `HH:MM:SS`（為 180 秒迴圈內的相對時間）＋ `Cycle NN · Live`（目前第幾個迴圈）。
- 右：`SHIFT-A/B/C` 班別（由模擬換班事件自動切換）、在班人數、`LIVE` 指示。
- 底：**迴圈進度條**（青色漸層，填滿一次代表一個 180 秒迴圈）。

### 1.5 共通互動方式
| 操作 | 方式 | 適用畫面 |
|------|------|----------|
| 切換畫面 | 點側欄模組項目 | 全部 |
| 表格排序 | 點可排序欄位表頭（再點一次反向） | 含密集表的畫面 |
| 查看明細 | 點資料列 → 右側明細抽屜滑入 | Production、Equipment、Recipe、Alarms、多數 ERP 主檔、SCM Shipments / Supplier Scorecards / Control Tower |
| 關閉明細抽屜 | 按 `Esc` 或抽屜右上 ✕ | 同上 |
| 暫停事件流捲動 | 滑鼠移入即時事件流區 | Fab Floor 右欄 |
| 查看提示 | 滑鼠移到圖元 / 圖表點 | Fab Floor 機台、各圖表、Control Tower 船運點 |

### 1.6 狀態與顏色對照表（全系統共通圖例）
**機台 E10 狀態**（顏色＋符號）：
| 狀態 | 中文 | 顏色 | 符號 |
|------|------|------|------|
| PROD | 生產中 | 綠 #34D399 | ● |
| STBY | 待機 | 琥珀 #FBBF24 | ◐ |
| SDT | 排程停機 | 玫瑰 #FB7185 | ■ |
| UDT | 非排程停機 | 紅 #EF4444 | ▨ |
| NSC | 非排程 | 灰 #64748B | ○ |
| ENG | 工程 | 藍 #60A5FA | ◆ |
| OUT | 離線 | 深灰 #334155 | ✕ |

> SDT / UDT 為「停機」狀態，會脈動並計入「Equipment」徽章。

**其他狀態圖例：**
| 類別 | 值 → 顏色語意 |
|------|----------------|
| 警報嚴重度 | critical 紅（脈動 sonar）／ major 琥珀 ／ minor 灰 |
| 批／訂單優先序 | super-hot 紅脈動＋sonar ／ hot 琥珀 ／ normal 一般 |
| 船運狀態 | created 灰 ／ in-transit 天藍（呼吸）／ arrived・delivered 綠 |
| ATP 承諾狀態 | confirmed 綠 ／ partial 琥珀 ／ shortfall 紅（脈動）|
| 採購單狀態 | open 青 ／ confirmed 天藍 ／ received 綠 ／ late 紅（脈動）|
| 銷售訂單狀態 | open / in-process / complete / hold |
| 資料列高亮 | `row-hot` 琥珀（需關注）／ `row-superhot` 玫瑰（最高優先 / 中斷 / 短缺）|

### 1.7 即時模擬說明
- 系統依 180 秒決定性迴圈持續產生事件，**畫面自動即時更新**，無需手動重新整理。
- 每個迴圈會重新開始（換班、投單、在途等重置），故同一畫面在不同迴圈會重演類似但可重現的劇情。
- 操作者主要動作為「**觀測**」與「**查詢明細**」；本系統無新增 / 修改 / 刪除 / 存檔等異動操作。

---

## 第二篇　MES（製造執行）畫面

### MES-01　Fab Floor（廠房現場）
- **畫面路徑**：MES > Operations > Fab Floor ／ **代碼** `fab-floor`（系統登陸首頁）
- **功能說明**：晶圓廠現場戰情登陸頁，總覽即時 KPI、機台 bay 地圖與全廠事件流。
- **畫面配置**：上方 KPI 列｜中央「FAB-01 · BAY MAP」地圖｜右欄「Live Events」即時事件流。
- **顯示說明**：
  | 區塊 | 內容 |
  |------|------|
  | KPI 列 | 5 卡：OEE（徑向錶）、Yield（徑向錶）、Throughput（wph）、MTBF（h）、WIP（lots）；首拍前顯示「—」|
  | Bay 地圖 | 8 個 bay（BAY-01~08），每機台一塊磚，**磚色＝E10 狀態**；停機機台（SDT/UDT）外加脈動環 |
  | 晶圓流動 | 每次批移動，一顆青色粒子由來源機台飛向目的機台（最多同時 14 顆）|
  | 事件流 | 全系統事件（含 MES/ERP/SCM），最新在上，重要事件（critical/major）置頂 10 秒 |
- **操作步驟**：
  1. 觀察 KPI 列即時數值（自動更新）。
  2. 在地圖上以**顏色＋符號**辨識各機台狀態；停機機台會脈動提醒。
  3. 滑鼠移到任一機台磚 → 顯示 `{機台代號 — 狀態}` 提示。
  4. 觀察晶圓粒子流動以掌握批流向。
  5. 於右欄事件流追蹤即時事件；**滑鼠移入可暫停自動捲動**以細看，移出恢復。
- **狀態/顏色**：見 §1.6（E10 狀態、事件嚴重度）。
- **注意事項**：本畫面無資料列點選 / drill-in。
- **關聯畫面**：MES-02 Production（批明細）、MES-03 Equipment（機台明細）、MES-07 KPI（KPI 細節）。

### MES-02　Production · WIP（在製品）
- **畫面路徑**：MES > Operations > Production ／ **代碼** `production`（徽章：在製批數）
- **功能說明**：追蹤所有晶圓批的即時途程進度、優先序與狀態，並可查批的途程步驟與族譜。
- **顯示欄位**：
  | 欄位 | 說明 |
  |------|------|
  | Lot ID | 批號（可排序）|
  | Product / Customer / Route | 產品 / 客戶 / 途程 |
  | Progress | 漸層進度條＋`步/總步`，隨批移動即時前進 |
  | Priority | super-hot（紅脈動＋sonar）/ hot（琥珀）/ normal |
  | Status | in-process 綠 / hold 琥珀 / complete 灰 / queued 靛 |
  | Wafers | 晶圓片數 |
- **操作步驟**：
  1. 進入畫面，瀏覽全批清單；列底色標示 hot / super-hot 批。
  2. 點欄位表頭排序（如依 Lot ID）。
  3. **點任一批列** → 右側明細抽屜開啟，顯示明細格、**途程步驟**（目前步驟以青色條＋「Current」標示）與**族譜**（父批 / 子批）。
  4. 於族譜點父批或子批 → 直接跳轉至該關聯批。
  5. 按 `Esc` 關閉明細。
- **即時行為**：批移動事件會即時更新進度條與目前步驟。
- **關聯畫面**：MES-01 Fab Floor、ERP-07 Production Orders（生產訂單對應批）。

### MES-03　Equipment · E10 State（機台狀態）
- **畫面路徑**：MES > Operations > Equipment ／ **代碼** `equipment`（徽章：停機機台數）
- **功能說明**：機台清冊與即時 E10 狀態，含全廠狀態分布條與每台機台的 SECS/GEM 訊息終端。
- **顯示欄位**：Tool ID（可排序）/ Bay / Type / Vendor / Model / E10 State（狀態點，停機脈動）。表頭右側為**狀態分布條**（各狀態佔比）＋機台總數。
- **操作步驟**：
  1. 由狀態分布條掌握全廠機台狀態比例。
  2. 於表中以狀態點辨識各機台；可依 Tool ID 排序。
  3. **點任一機台列** → 右側抽屜顯示「Current State」（大狀態點＋E10 說明）與「SECS Message Log」終端。
  4. SECS 終端**只顯示目前選取機台**的訊息：狀態轉換 → S6F11、配方載入 → S2F41；最新一行以**打字機效果逐字顯示**。
  5. 切換到另一台機台時，SECS log 會清空並重新開始串流。
- **注意事項**：SECS 訊息為外觀擬真（無真實傳輸）。
- **關聯畫面**：MES-05 Recipe（配方）、MES-04 SPC。

### MES-04　SPC / Quality（統計製程管制）
- **畫面路徑**：MES > Quality > SPC / Quality ／ **代碼** `spc`
- **功能說明**：CD（關鍵尺寸）均勻度的即時管制圖，含即時 Cp / Cpk 製程能力與違規記錄。
- **顯示說明**：
  | 區塊 | 說明 |
  |------|------|
  | 統計磚 ×4 | Current CD（最新值，違規時轉玫瑰）、Violations（違規數）、Cp、Cpk |
  | 管制圖 | 折線/面積圖；UCL 55 / LCL 45（玫瑰虛線）、CL 50（青虛線）；違規點以玫瑰大點標示 |
  | 違規記錄 | 最近 20 筆 warn/critical，含嚴重度 chip、時間、規則與數值 |
- **操作步驟**：
  1. 觀察 Cp / Cpk（≥8 點才計算）：≥1.33 綠（製程能力佳）、≥1.0 琥珀（勉強）、其餘玫瑰（不足）。
  2. 觀察管制圖點位是否逾越 UCL / LCL；違規點會以玫瑰標示。
  3. 滑鼠移到圖表點查看數值（單位 nm）。
  4. 於違規記錄區檢視最近違規明細。
- **注意事項**：純觀測畫面，無點列 / drill-in。
- **關聯畫面**：MES-06 Alarms、MES-01 Fab Floor。

### MES-05　Recipe Management（配方管理）
- **畫面路徑**：MES > Quality > Recipe Mgmt ／ **代碼** `recipe`
- **功能說明**：配方庫瀏覽、參數檢視、最新變更版本差異（diff）與版本歷史時間軸。
- **畫面配置**：左欄「Recipe Library」（依機型分組）｜右側配方明細。
- **操作步驟**：
  1. 在左欄依機型群組找到配方，**點配方項目**（顯示配方代碼＋目前版本）。
  2. 右側顯示：標題（配方名＋版本）、**Parameters**（參數鍵值表）、**最新變更 diff**（前版 → 現版＋bump 類型藥丸 MAJOR/MINOR/PATCH/INITIAL＋變更說明）、**Version History**（commit-graph 時間軸，目前版本較大並發光）。
  3. 未選配方時右側顯示「Select a recipe from the library」。
- **注意事項**：本畫面為**靜態**（不接收即時事件），資料不會自動變動。
- **關聯畫面**：MES-03 Equipment（配方載入於 SECS 終端呈現）。

### MES-06　Alarms（警報台）
- **畫面路徑**：MES > Command > Alarms ／ **代碼** `alarms`（徽章：未確認警報數，紅色脈動）
- **功能說明**：即時警報台，含嚴重度摘要、捲動警報流與警報明細（SOP 參照、確認資訊）。
- **顯示說明**：表頭顯示 Critical 徽章（有 critical 時，含 sonar 環）與總數；嚴重度摘要列（critical / major / minor 計數）；警報流（每筆含嚴重度條、時間、來源、訊息、ACK 標記）。
- **操作步驟**：
  1. 由嚴重度摘要掌握各級警報數；critical 會以 sonar 環脈動。
  2. 於警報流檢視即時警報；已確認者顯示 ACK 盾牌標記。
  3. **點任一警報列** → 右側抽屜顯示嚴重度橫幅、來源、完整訊息、**SOP 參照**、確認人、時間。
  4. 按 `Esc` 關閉。
- **注意事項**：警報確認狀態來自事件流（畫面內無手動確認按鈕）。
- **關聯畫面**：MES-04 SPC、MES-03 Equipment。

### MES-07　KPI Dashboard（KPI 儀表板）
- **畫面路徑**：MES > Command > KPI Dashboard ／ **代碼** `kpi`
- **功能說明**：生產 KPI 戰情儀表板——OEE / Yield 兩枚 hero 徑向錶、效能趨勢圖與含 sparkline 的指標磚。
- **顯示說明**：
  | 區塊 | 說明 |
  |------|------|
  | Hero 錶 ×2 | OEE（青）、Yield（綠），各含趨勢箭頭（上升/下降/持平與好壞配色）|
  | 效能趨勢圖 | 近 60 拍；左軸 % （OEE 面積＋Yield 線）、右軸吞吐量（虛線）|
  | 指標格 | Throughput / MTBF / MTTR / WIP Turn / Cycle Time，含 sparkline 與趨勢差值（MTTR、Cycle 為「越低越好」）|
- **操作步驟**：
  1. 觀察兩枚 hero 錶與趨勢箭頭掌握整體效能走向。
  2. 於趨勢圖檢視近 60 拍變化（資料不足時顯示「Awaiting telemetry…」）。
  3. 滑鼠移到圖表 / sparkline 看數值。
- **注意事項**：KPI 由系統依即時事件**自行推導**（並與基準混合以避免抖動）；純觀測畫面。
- **關聯畫面**：MES-01 Fab Floor（KPI 列為精簡版）。

---

## 第三篇　ERP（企業資源規劃）畫面

> ERP 主檔類畫面（Materials、Business Partners、Inventory、Procurement、Production Orders）操作模式一致：**密集表 + 點列開右側明細抽屜（Esc 關閉）+ 表頭排序**。以下逐畫面列出欄位與專屬重點。

### ERP-01　Cockpit · Document Flow（文件流，ERP Hero）
- **畫面路徑**：ERP > Planning > Document Flow ／ **代碼** `erp-cockpit`
- **功能說明**：即時「接單到收款（order-to-cash）」管線總覽——6 條固定泳道，依序為 Sales Order → Planned → Prod Order → Lot → Goods Receipt → Invoice。
- **顯示說明**：每條泳道為一欄，欄頂有滾動總數徽章；單據以「DocChip」呈現（狀態點＋單號＋子標籤，最新者帶「New」並淡入）；Lot 泳道置頂顯示在製批的進度條。
- **操作步驟**：
  1. 由左至右觀察單據在管線中流動（自動更新）。
  2. 由各泳道總數掌握該階段累積量；頂部顯示總文件數。
- **注意事項**：純即時監看，無點列 / drill-in。
- **關聯畫面**：ERP-05 Sales Orders、ERP-07 Production Orders、ERP-10 Finance。

### ERP-02　Materials（物料主檔）
- **路徑**：ERP > Master Data > Materials ／ `materials`
- **功能**：物料主檔瀏覽（SAP MM 風格），物料類型 FERT（製成）/ HALB（半成）/ ROH（原料）。
- **欄位**：Material / Type（型別 chip）/ Description / Group / UoM / Std Cost；表頭顯示三型計數。
- **操作**：點列 → 明細抽屜（Basic Data、Valuation；FERT 另顯示 BOM 組件）。可排序。
- **關聯畫面**：ERP-04 BOM、ERP-08 Inventory。

### ERP-03　Business Partners（商業夥伴）
- **路徑**：ERP > Master Data > Business Partners ／ `business-partners`
- **功能**：客戶與供應商主檔（SAP BP 風格）。
- **欄位**：BP No. / Role（customer / vendor / both chip）/ Name / Country / Terms / Incoterms；表頭顯示角色計數。
- **操作**：點列 → 明細抽屜（含信用額度）。

### ERP-04　BOM · Bill of Materials（物料清單）
- **路徑**：ERP > Master Data > Bill of Materials ／ `bom`
- **功能**：BOM 結構瀏覽（左清單 + 右組件樹，**雙欄版面**，非標準明細抽屜）。
- **操作步驟**：
  1. 左欄以搜尋框過濾 BOM（可比對表頭料號 / 描述 / BOM 代碼）。
  2. **點左欄 BOM** → 右側「Component Tree」顯示父料與縮排組件（樹狀連接線）、BOM meta（BOM ID / 表頭料 / 廠 + 單位）。
- **注意事項**：本畫面選取為畫面內部狀態（不影響其他畫面）。

### ERP-05　Sales Orders（銷售訂單，含 ATP / 訂單承諾）
- **路徑**：ERP > Planning > Sales Orders ／ `sales-orders`（徽章：未結訂單數）
- **功能**：銷售訂單簿（SAP SD）＋**可承諾量 ATP** 折頁。
- **顯示說明**：
  | 區塊 | 說明 |
  |------|------|
  | ATP 可用量面板（表上方）| 分段水平條：On Hand（綠）/ In Transit（天藍）/ Planned Prod.（靛）/ Shortfall（紅，脈動）＋涵蓋率徑向錶（available/demand）|
  | 表格 | Order No / Customer / Status / Priority / Requested / **Promised**（滑期變琥珀發光）/ **ATP**（chip：confirmed/partial/shortfall）/ Net Value |
  | 列高亮 | shortfall → row-superhot；partial → row-hot |
- **操作步驟**：
  1. 由 ATP 面板掌握整體可用量與短缺（shortfall 段脈動、涵蓋率錶轉色）。
  2. 檢視各訂單 ATP 狀態與承諾交期（Promised 滑期時以琥珀發光）。
  3. 點欄位排序（可依 Promised 或 ATP）。
  4. **點訂單列** → 明細抽屜（訂單表頭含 ATP / Requested / Promised＋明細行 Line Items）。
- **關聯畫面**：ERP-08 Inventory、SCM-02 Shipments（在途供給來源概念）。

### ERP-06　MRP / Material Coverage（物料需求規劃，SAP MD04 風格）
- **路徑**：ERP > Planning > MRP / Planning ／ `mrp`（徽章：缺料數，紅色脈動）
- **功能**：時間分相料件覆蓋矩陣，將委外需求攤於 5 個未來時段（B1~B5）並標示缺料。
- **顯示說明**：覆蓋矩陣（Material / On-Hand / B1~B5 投射在手；≤0 cell 發光紅、整列紅條）；表頭缺料 / 已覆蓋藥丸。
- **操作步驟**：
  1. 由矩陣找出在某時段轉為 ≤0（缺料破點）的料件（發光紅）。
  2. **點料件列** → 右側 aside（自有 ✕ 關閉鈕）顯示覆蓋快照、投射 5 桶、**需求**（消耗該料的生產單）、**供給**（未收貨採購單）。
- **注意事項**：此畫面右側為專屬 aside（非共通明細抽屜），請以其自有關閉鈕關閉。
- **關聯畫面**：ERP-08 Inventory、ERP-09 Procurement、ERP-07 Production Orders。

### ERP-07　Production Orders（生產訂單）
- **路徑**：ERP > Planning > Production Orders ／ `production-orders`
- **功能**：生產訂單簿（SAP PP），並**橋接 MES 現場顯示即時批進度**。
- **欄位**：Order No / Description / Route / Target Qty / Status（InProcess 脈動）/ **Live Progress**（在製批的即時進度條＋步/總步，或顯示「—」）。表頭顯示各狀態計數與「在線批數」。
- **操作步驟**：
  1. 由表頭掌握 Created / Released / In-Process / Completed 計數與在線批數。
  2. **點訂單列** → 明細抽屜（含 Linked Sales Order；有對應在製批時顯示 Live Floor Progress）。
- **即時行為**：當現場橋接的批推進 / 完工時，Live Progress 即時更新。
- **關聯畫面**：MES-02 Production、ERP-01 Cockpit。

### ERP-08　Inventory · Stock（庫存）
- **路徑**：ERP > Logistics > Inventory ／ `inventory`
- **功能**：料 × 儲位庫存瀏覽（SAP MMBE），短缺發光紅。
- **欄位**：Material / Description / Storage Loc / On Hand / Committed / Available（≤0 發光紅）。表頭顯示 SKU 數與短缺 / 已覆蓋徽章。
- **操作**：點列 → 明細抽屜（Stock Breakdown＋短缺 / 可承諾橫幅）。

### ERP-09　Procurement · Purchase Orders（採購）
- **路徑**：ERP > Logistics > Procurement ／ `procurement`（徽章：逾期採購數）
- **功能**：採購單簿（SAP MM 採購），逾期單脈動紅。
- **欄位**：PO No. / Vendor / Status（open/confirmed/received/late，late 脈動）/ Delivery / Net Value。表頭顯示逾期 / 準時徽章。
- **操作**：點列 → 明細抽屜（含 Line Items）。

### ERP-10　Finance（財務）
- **路徑**：ERP > Master Data > Finance ／ `finance`
- **功能**：FI/CO 財務戰情——KPI 磚、成本中心，與**即時總帳（GL）分錄帳本**。
- **顯示說明**：KPI 列（庫存價值、WIP、營收、應收）＋收款率徑向錶；成本中心表；**GL Postings · Live**（終端風格帳本：時間＋科目＋簽署金額，正綠負紅，最新列淡入）。
- **操作步驟**：
  1. 檢視 KPI 與收款率。
  2. 觀察 GL 即時帳本捲動（自動更新；空閒時顯示「Ledger is balanced and quiet」）。
- **注意事項**：無點列 drill-in；GL 帳本為即時串流，KPI 為快照。

---

## 第四篇　SCM（供應鏈管理）畫面

### SCM-01　Control Tower · 供應網控制塔（SCM Hero）
- **畫面路徑**：SCM > Control Tower > Control Tower ／ **代碼** `control-tower`（徽章：航段中斷數，紅色脈動）
- **功能說明**：互動式供應網地圖——顯示供應商、FAB-01（中央錨）、配銷中心（DC）、客戶區，及在航段上**即時滑動的船運點**；右上狀態徽章顯示 Nominal（綠）/ Alert（紅脈動）。
- **顯示說明**：
  | 區塊 | 說明 |
  |------|------|
  | KPI 列 ×5 | In Transit / Late / On-Time % / Disruptions / Delivered |
  | 節點 | 依類型分級配色：供應商（靛）、FAB-01（青，最大最亮＋角框）、DC（天藍）、客戶區（綠）|
  | 航段 | 曲線；**模式以筆觸區分**（air 虛線 / sea 點線 / truck 實線）＋方向箭頭；中斷航段轉紅脈動 |
  | 船運點 | 進貨青 / 出貨天藍的彗星點，沿航段滑動；抵達 / 交貨時於目的地閃綠色 sonar |
  | HUD 圖例 | 左下玻璃面板：節點類型、使用中的航段模式、中斷、即時計數 |
- **操作步驟**：
  1. 觀察船運點沿航段移動（進貨 供應商→FAB-01；出貨 FAB-01→DC→客戶）。
  2. **滑鼠移到船運點** → 顯示 ETA 提示（船運號、方向、參照單據、料×量、ETA 進度條）。
  3. **點節點** → 選取該節點並開啟明細抽屜（該節點相關船運）。
  4. **點航段或船運點** → 選取該船運 / 航段並**交叉過濾 SCM-02 Shipments 表**；明細抽屜顯示該航段上的船運。
  5. 中斷發生時，受影響航段轉紅並於中點脈動 sonar；抵達 / 交貨於目的地閃綠（WOW 拍）。
- **注意事項**：開啟系統「減少動態效果（reduced-motion）」時，船運點改為靜態定位、中斷仍以靜態紅筆觸可辨。畫面固定比例縮放，內容不會溢出框線。
- **關聯畫面**：SCM-02 Shipments、ERP-05 Sales Orders（出貨對應 SO）、ERP-09 Procurement（進貨對應 PO）。

### SCM-02　Shipments · 在途物流
- **畫面路徑**：SCM > Control Tower > Shipments ／ **代碼** `shipments`（徽章：在途數）
- **功能說明**：即時物流清單，每筆在飛船運一列，與控制塔地圖共用資料（地圖上的點＝此處的列）。
- **顯示欄位**：Shipment / Dir（In/Out 箭頭）/ From→To（模式圖示＋起訖名稱）/ Material / Qty / **Status**（chip：created/in-transit/arrived/delivered）/ **ETA**（依狀態顯示秒數 / Due / Pending / Arrived / Delivered）/ **Progress**（即時進度條）。
- **操作步驟**：
  1. 瀏覽在途船運；逾 ETA 列標 row-hot、受中斷航段列標 row-superhot。
  2. 由表頭排序；表頭右側顯示 In Transit / Late / Disrupted 即時計數。
  3. **點船運列** → 明細抽屜（Shipment / Lane / Reference 三段；中斷時 Lane 顯示「Lane under active disruption.」）。
- **即時行為**：狀態與進度隨模擬即時更新；由控制塔點選的船運會在此交叉高亮。
- **關聯畫面**：SCM-01 Control Tower。

### SCM-03　Demand Planning · 需求規劃（IBP 風格）
- **畫面路徑**：SCM > Planning > Demand Planning ／ **代碼** `demand-planning`
- **功能說明**：每個製成品（FERT）的預測 vs 實績（8 週），含熱力染色變異格與選定料的雙序列圖；即時預測更新會就地改寫。
- **顯示說明**：
  | 區塊 | 說明 |
  |------|------|
  | KPI 列 ×4 | Plan Volume / Forecast Accuracy % / Bias % / Materials Planned |
  | 預測 vs 實績圖 | Forecast 發光面積（靛）＋Actual 線（綠）；最大超量桶以虛線 spike 標記 |
  | IBP 變異格 | 每料三帶：Forecast / Actual / **Variance**（熱力染色：|v|<6% 琥珀、超量玫瑰、低量綠，含簽署 %）|
- **操作步驟**：
  1. 由 KPI 列掌握整體計畫量、預測準確度與偏差。
  2. **點變異格中任一料列** → 上方圖表切換至該料（預設第一個 FERT）。
  3. 觀察變異格熱力色快速辨識「超量 / 低量」料；即時預測更新時表頭顯示「N re-plans」。
- **注意事項**：此畫面之選取為畫面內部狀態（不影響其他畫面）。
- **關聯畫面**：ERP-06 MRP。

### SCM-04　Supplier Scorecards · 供應商評分
- **畫面路徑**：SCM > Planning > Supplier Scorecards ／ **代碼** `supplier-scorecards`
- **功能說明**：供應商協作板，每供應商一張卡，含三枚徑向錶（準時 / 品質 / 前置）＋準時趨勢 sparkline＋開放 ASN 數，並標示風險。
- **顯示說明**：響應式卡片格；每卡含名稱、風險旗標（At risk 紅 / Healthy 綠）、三錶（門檻配色）、趨勢線、開放 ASN 數。
- **操作步驟**：
  1. 掃視卡片，由錶面顏色辨識供應商健康度：
     - 準時 / 品質：≥95% 綠、≥85% 琥珀、其餘玫瑰。
     - 前置天數（越低越好）：≤14d 綠、≤30d 琥珀、否則玫瑰（長前置不會顯示綠）。
  2. 風險供應商（任一不達標）卡片標紅。
  3. **點任一卡片** → 明細抽屜（4 項門檻指標＋風險建議橫幅＋色彩門檻圖例）。
- **注意事項**：靜態畫面（不隨事件變動，趨勢線為決定性產生）。
- **關聯畫面**：SCM-01 Control Tower、ERP-03 Business Partners（供應商主檔）。

---

## 第五篇　操作注意事項彙整

1. **無異動操作**：本系統為展示 / 監看用途，所有畫面僅供觀測與查詢；無新增 / 編輯 / 刪除 / 匯出 / 列印之功能按鈕，亦無需存檔。
2. **自動更新**：畫面隨 180 秒模擬迴圈即時更新，無「重新整理」需求；切勿等待手動載入。
3. **明細抽屜**：以 `Esc` 或 ✕ 關閉；MRP（ERP-06）使用專屬右側 aside，請以其自有關閉鈕關閉。
4. **顏色即語意**：請對照 §1.6 圖例理解各色（紅＝critical / 短缺 / 逾期；琥珀＝警告 / 需關注；綠＝正常 / 完成；青 / 天藍 / 靛＝強調與分域）。
5. **桌機門檻**：視窗 < 1280px 將無法操作，請放大視窗。
6. **減少動態效果**：若作業系統開啟「減少動態」，動畫（粒子、sonar、脈動）會停用，但所有狀態仍以靜態顏色 / 文字可辨。

---

*本操作功能說明書依 2026-05-29 之 `master`（含 SCM 層 commit `5d4b628`）實機畫面與原始碼整理。技術架構細節另見 `docs/FabPulse-system-functional-spec.md`。*
