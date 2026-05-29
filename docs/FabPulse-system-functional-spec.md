# FabPulse 系統功能說明書

> 半導體晶圓廠 MES → ERP → SCM 三層整合戰情中心（Command Center）
> 版本：2026-05-29 · 對應分支：`master` · 文件性質：完整系統功能說明書
> 本文所有功能、欄位、事件、參數均對照原始碼整理（非示意），檔案路徑以 `src/` 為基準。

---

## 1. 系統概述

**FabPulse** 是一套高擬真的半導體晶圓廠戰情中心展示系統，將製造執行（MES）、企業資源規劃（ERP）、供應鏈管理（SCM）三層整合於單一深色「Siemens Cyan」指揮中心介面。系統為**純前端（pure front-end）**，無後端、無資料庫、無網路請求——所有資料由種子化亂數（seeded PRNG）決定性產生，所有「即時動態」由一個 180 秒的決定性模擬迴圈驅動。

- **規模**：21 個功能模組（MES 7 + ERP 10 + SCM 4），外加 ATP 併入 ERP 銷售訂單。
- **核心特色**：三個互不關聯的模擬引擎共用一條 RxJS 事件匯流排與一個時鐘，串成一條完整的「採購單 → 進貨在途 → 收貨 / 生產投單 → 完工 → 出貨在途 → 交貨結案」端到端故事。
- **定位**：展示 / Demo（非生產系統）。SECS/GEM 訊息、GL 分錄、ATP 等皆為外觀擬真，無真實傳輸。
- **限制**：桌機專用，視窗寬度需 ≥ 1280px；單一深色主題，無淺色模式。

### 三層職責邊界

| 層 | 範疇 | 種子命名空間 |
|----|------|--------------|
| **MES** | 廠房現場：機台 E10 狀態、晶圓批流動、SPC、配方、警報、KPI | `seededRng(loopIndex, 0)` |
| **ERP** | 企業內部：主檔、銷售 / 採購 / 生產訂單、庫存、MRP、財務、文件流 | `seededRng(loopIndex, 1000)` |
| **SCM** | 跨企業供應網：供應商、需求規劃、在途物流、控制塔、ATP | `seededRng(loopIndex, 2000)` |

SCM **向外延伸而非重複** ERP：進貨在途引用 ERP 採購單、出貨在途引用完工批與銷售訂單、ATP 由 ERP 庫存推導；不另建採購 / 庫存模組。

---

## 2. 整體架構

### 2.1 執行時拓樸（單一時鐘、單一匯流排、五個模擬行為者）

`src/App.tsx` 以 `useMemo` 依序建構唯一實例：`masterData → erpData(masterData) → scmData(masterData, erpData) → clock → eventBus → MES 引擎 → ERP 引擎 → bridge → SCM 引擎 → shipment-driver`，再傳遞給所有模組與行為者。

```
                          createClock() — 180s 迴圈, onLoopBoundary(cb)
                                 │            │            │
        seed 0 ▼          seed 1000 ▼   (releases)   seed 2000 ▼
   ┌─────────────┐   ┌──────────────────┐        ┌────────────────────┐
   │ MES 引擎     │   │ ERP 引擎          │ prodorder │ SCM 引擎            │
   │ lot.move /  │   │ ambient+spine    │ .released │ forecast/asn/      │
   │ equip/spc.. │   │ +週期投單         │ ──────┐  │ disruption         │
   └──────┬──────┘   └────────┬─────────┘       ▼  └─────────┬──────────┘
          │                   │ po.created  ┌──────────┐      │
          ▼                   ▼  ───────┐   │ ERP bridge│ lot. │
   ┌───────────────────────────────┐   │   │ 批生命週期 │ complete   ▼
   │  eventBus (AppEvent, ring1000) │◄──┘   │ +up-path  │ ───┐ ┌──────────────────┐
   │  publish/ofTopic/ringBuffer$   │◄──────┴───┬───────┘    └►│ shipment-driver   │
   └───────────────┬───────────────┘  (訂閱先於引擎啟動)        │ 進貨:PO→船運→GR    │
                   │ all$()                                    │ 出貨:lot.complete │
                   ▼                                           │  →船運→交貨        │
       ┌────────────────┐   ┌──────────────────────┐  狀態轉換  │ +每迴圈 seed       │
       │ EventStream 即時流│   │ useShipments / 離散狀態│◄────────┤                   │
       └────────────────┘   └──────────┬────────────┘          └──────────────────┘
                                       │ 位置 = clamp01((loopT−departureT)/transitSeconds)
                                       ▼ 由動畫層每幀計算（不存進 store — ARCH-1）
                            ┌──────────────────────┐
                            │ Control Tower 地圖     │
                            │ Shipments 表          │
                            └──────────────────────┘
```

### 2.2 事件匯流排 `createEventBus`（`src/lib/eventBus.ts`）

- 以單一 RxJS `Subject<AppEvent>` 為核心；`AppEvent = MesEvent | ErpEvent | ScmEvent`（`src/lib/events.ts`）。
- **環形緩衝（ring buffer）**：固定大小（預設 1000）陣列 + `writePtr` 取模回繞 + 單調 `count`；`getBuffer()` 還原時序快照，供晚加入的消費者（如 KPI 儀表板）回填歷史。
- API：`publish` / `publishBatch`（批次只在結尾發一次 ring 快照）/ `all$()` / `ofTopic<T>(topic)`（型別收斂的過濾，例如 `ofTopic('equip.state')` 只得到 MES 變體）/ `ringBuffer$()` / `getBuffer()` / `destroy()`。
- 每個事件都帶 `t`（迴圈秒數），讓異質的 MES/ERP/SCM 事件能被統一讀取。

### 2.3 時鐘與 180 秒迴圈（`src/lib/clock.ts`）

- `LOOP_DURATION = 180` 秒（`LOOP_DURATION_S`）。
- `now()`＝自啟動起的秒數（基於 `performance.now()`）；`loopT() = now() % 180`（迴圈內位置）；`loopIndex() = floor(now()/180)`（單調計數 0,1,2…）。
- `start()` 記錄 `t0`、啟動 100ms 邊界輪詢、註冊 `visibilitychange`（分頁回到前景時補跑遺漏的邊界，對抗 `setInterval` 節流）。
- `onLoopBoundary(cb)` 在 `loopIndex` 改變時同步呼叫所有回呼；引擎 / bridge / driver 各自註冊以重置每迴圈狀態。

### 2.4 三個模擬引擎

| 引擎 | 檔案 | tick | 角色 |
|------|------|------|------|
| MES | `src/data/timeline-engine.ts` | 100ms | 9 拍腳本 SPINE + ~1 事件/秒 ambient |
| ERP | `src/data/erp/erp-timeline-engine.ts` | 200ms | ambient + 每 ~15s 投生產單 + 3 拍 spine（搶單 t=25 / MRP t=45 / 月結 t=155） |
| SCM | `src/data/scm/scm-timeline-engine.ts` | 200ms | ambient（預測 / ASN / 單一航段中斷）+ 2 拍 spine（港口延誤 t=20 / 需求暴衝 t=40） |

- **MES SPINE**（`src/data/timeline.ts`，9 拍）：t=0 換班 A → t=25 HOT 批插單 → t=50 CMP 機台 PM 逾期轉 SDT + 警報 → t=80 SPC rule 2 警告 + ETCH 轉 ENG → t=105 critical 警報 + SPC rule 1 critical（值 56.1 > UCL 55）→ t=130 配方更新 + ETCH 回 PROD → t=150 KPI 恢復 → t=175 換班 B → t=180 迴圈重啟。
- **ERP ambient**：roll <0.3 銷售訂單、<0.5 採購單（ROH/供應商）、<0.6 收 / 發貨（ARCH-3 已由 0.72 收窄）、<0.85 PO 收貨、其餘 GL 分錄。
- **SCM ambient**：roll <0.4 預測更新、<0.78 供應商 ASN、<0.9 且無進行中中斷時於某航段升起一筆中斷（同一時間僅一筆 ambient 中斷，FIFO 清除），其餘維持預測暖機。
- 三引擎種子命名空間 0 / 1000 / 2000 互不關聯；每迴圈邊界各自重新 seed + 重置 latch / accumulator + 重發 pre-roll。

### 2.5 ERP Bridge（`src/data/erp/bridge.ts`）——「主軸」

訂閱 `erp.prodorder.released`：

1. **onReleased**：依 `routeId` 找製程途程（途程缺漏或零步驟則靜默跳過，不丟錯），建立 `BridgedLot`（`LOT-ERP-N`）寫入 `useBridgedLots`，發 `erp.prodorder.status InProcess`。
2. **tick（200ms）**：每 `STEP_SECONDS = 2.4` 秒推進一個途程步驟，發 `lot.move`（驅動 Fab Floor 晶圓粒子動畫），更新 `useBridgedLots.advanceLot`。
3. **completeLot**：發 `lot.complete` + 「up-path」——`erp.goods.movement`（GR 入 FG）、`erp.prodorder.status Completed`、兩筆 `erp.gl.posting`（130000 製成品 +value / 120000 在製品 −value，value = qty × 標準成本）、若有銷售訂單則 `erp.invoice.created`（金額 = value × 1.35）。
4. **onBoundary**：清空 inFlight + `useBridgedLots.reset()`，在途批不會在 180s 換圈時成為孤兒。

### 2.6 SCM Shipment Driver（`src/data/scm/shipment-driver.ts`）——「SCM 主軸」

訂閱 `erp.po.created`（進貨）與 `lot.complete`（出貨）：

- **進貨 onPoCreated**：供應商 → FAB-01，建立 inbound 船運（`status 'created'`），發 `scm.shipment.created`。抵達時發 `scm.shipment.arrived` + **PO-keyed** `erp.goods.movement`（GR 入 RAW，SCM 主導進貨收貨時點，ARCH-3）。
- **出貨 onLotComplete**：FAB-01 → DC →（客戶），建立 outbound 船運；經 `soByProdOrder` 查回銷售訂單；交貨時發 `scm.shipment.delivered` + `scm.atp.promised`（ATP 對帳）。
- **tick（200ms）只發離散狀態轉換**（created → in-transit → arrived/delivered），**不發逐幀位置**。`TRANSIT_SECONDS_PER_DAY = 4`。
- **seedInitial**：啟動時與每個 180s 邊界，依 `seededRng(loopIndex, 2000)` 種入 `SEED_COUNT = 6` 筆「已在途」船運（`departureT = boundaryT − rng()×transitSeconds`，散佈於航段中段），讓控制塔地圖首畫面與每次換圈都不會空白（ARCH-2）。
- **守衛（GUARD）**：無法解析 node / lane 時跳過，不丟錯（仿 `bridge.ts`）。

### 2.7 zustand 狀態存放區

| Store | 檔案 | 容量 | 用途 |
|-------|------|------|------|
| `uiStore` | `src/lib/uiStore.ts` | — | `activeRoute`、`selectedEntity{type,id}`、`badges`（9 欄）、`currentShift` |
| `useBridgedLots` | `src/lib/useBridgedLots.ts` | `MAX_BRIDGED = 60` | bridge 投放的在途批單一真相；Fab Floor / Production / ERP 生產訂單共享 |
| `useShipments` | `src/lib/useShipments.ts` | `MAX_SHIPMENTS = 40` | driver 在途船運單一真相；只存離散狀態（無 `progress`）；控制塔 + Shipments 共享 |

`shipmentPosition(loopT, departureT, transitSeconds)`（`src/data/scm/shipmentPosition.ts`）＝ `clamp01((loopT − departureT)/transitSeconds)`：出發前 0、抵達後 1、`transitSeconds ≤ 0` 視為瞬時，避免除零。控制塔每動畫幀呼叫它計算點位（不重繪節點 / 航段層）。

### 2.8 App 啟動與外殼（`src/App.tsx`）

- **啟動順序（訂閱先於發送，關鍵）**：`engine.preRoll() → erpEngine.preRoll() → scmEngine.preRoll() → clock.start()` → `bridge.start()` 與 `scmDriver.start()`（先訂閱 ERP 主題）**先於** `engine.start() → erpEngine.start() → scmEngine.start()`，確保第一筆 `erp.po.created` / `lot.complete` 不被漏接。清理時反序停止。
- **路由與程式碼分割**：21 個模組全部 `React.lazy` 拆 chunk，包在 `<Suspense fallback={ModuleSkeleton}>` 與每路由 keyed `<ErrorBoundary>` 內。
- **三域側邊欄**：`DOMAINS`（MES / ERP / SCM）各含可摺疊群組；MES/ERP 群組標籤染青色 `text-accent/70`，SCM 染靛色 `text-accent-3/70`；作用中項目有青色發光左條 + 漸層高亮（導覽 affordance 全 app 維持青色）。
- **徽章（badge）**：三個 effect——(1) 由種子資料靜態算出 ERP 徽章（shortages / openOrders / latePOs）；(2) 1s 節流的 MES 徽章（alarms / production / equipmentDown）；(3) 1s 節流的 SCM 徽章（inTransit / lateShipments via `shipmentPosition` / disruptions）。`badgeClass` 語意上色：alarms/shortages/disruptions 紅色脈動、equipmentDown/latePOs/lateShipments 琥珀、計數 青色。
- `shift.boundary` → `uiStore.setShift`；視窗 < 1280px 顯示桌機門檻卡片。

---

## 3. 端到端 180 秒故事（每迴圈決定性）

- **進貨（採購 → 收貨）**：ERP 引擎發 `erp.po.created` → SCM driver 建立 supplier→fab 進貨船運（`scm.shipment.created`）→ 下一 tick `depart()`（`scm.shipment.departed`，點開始沿航段滑動）→ 行程比例 ≥1 時 `arrive()` 發 `scm.shipment.arrived` + PO-keyed `erp.goods.movement` GR（入 RAW）。
- **生產（投單 → 完工）**：ERP 引擎每 ~15s（首單 ~3s；另 t=25 搶單）發 `erp.prodorder.released` → bridge 建 `BridgedLot`，每 2.4s 發 `lot.move`（Fab Floor 粒子動畫）→ 末步 `completeLot` 發 `lot.complete` + up-path（GR FG / Completed / GL 130000+ 120000− / 若有 SO 則發票）。
- **出貨（出貨 → 交貨 → 結案）**：同一筆 `lot.complete` 被 SCM driver 接走 → 建 fab→DC→客戶 outbound 船運 → `depart()` → 抵達 `arrive()` 發 `scm.shipment.delivered`（帶 salesOrderNo）+ `scm.atp.promised`。
- **迴圈邊界（180s）**：bridge 與 driver 清空 inFlight 並重置 store；driver 重新種入 6 筆中段船運讓 hero 地圖不空白；三引擎依新 `loopIndex` 重新 seed。

**tick 節律**：MES 引擎與時鐘邊界輪詢 = 100ms；ERP 引擎、SCM 引擎、bridge、driver = 200ms。
**孤兒防護**：bridge/driver 的 `tick()` 另對「時鐘回繞（`loopT < departureT/lastStepT`）」加守衛，在邊界處理器觸發前先跳過陳舊工作。

---

## 4. 事件模型（完整主題目錄，共 27 主題）

所有事件皆帶 `t`（迴圈秒數）。定義：MES `src/lib/events.ts`、ERP `src/lib/erpEvents.ts`、SCM `src/lib/scmEvents.ts`。

### MES — `MesEvent`（8）
| 主題 | 關鍵欄位 |
|------|----------|
| `lot.move` | lotId, fromToolId, toToolId, routeStep, operatorId, productCode, customerName |
| `equip.state` | toolId, fromState, toState, reasonCode?（E10State = PROD\|STBY\|SDT\|UDT\|NSC\|ENG\|OUT） |
| `spc.violation` | measurementId, ruleNumber(1\|2\|4), severity(info\|warn\|critical), controlPoint{value,ucl,lcl,centerline} |
| `alarm.raised` | alarmId, source, severity(minor\|major\|critical), message, sopRef?, ackOperatorId? |
| `recipe.load` | toolId, recipeId, recipeVersion, approverOperatorId |
| `kpi.tick` | oee, yieldPct, mtbfMinutes, mttrMinutes, wipTurn, throughputUnitsPerHour, cycleTimeMinutes |
| `shift.boundary` | kind(start\|handover\|loop-restart), shiftCode(A\|B\|C) |
| `lot.complete` | lotId, prodOrderNo, materialNo, productCode, qty（由 bridge 在批完工時發；同時驅動 ERP up-path 與 SCM 出貨） |

### ERP — `ErpEvent`（10）
| 主題 | 關鍵欄位 / 備註 |
|------|----------------|
| `erp.order.created` | orderNo, bpNo, customerName, materialNo, qty |
| `erp.mrp.run` | shortages, plannedOrders |
| `erp.plannedorder.created` | plannedOrderNo, materialNo, qty（聯集中宣告，本範圍引擎未主動發送） |
| `erp.prodorder.released` | orderNo, materialNo, productCode, routeId, qty, salesOrderNo\|null（bridge 訂閱） |
| `erp.prodorder.status` | orderNo, status（bridge 發 InProcess 然後 Completed） |
| `erp.goods.movement` | movementType(GR\|GI), materialNo, qty, storageLoc（bridge GR→FG、SCM driver GR→RAW、引擎 ambient GR/GI） |
| `erp.po.created` | poNo, bpNo, vendorName, materialNo, qty（SCM driver 訂閱作進貨） |
| `erp.po.received` | poNo, materialNo, qty |
| `erp.gl.posting` | accountNo, accountName, amount, ref（bridge 發 130000+/120000−、月結 CLOSE-*） |
| `erp.invoice.created` | invoiceNo, orderNo, amount（bridge 於批帶 SO 時發，金額 = value×1.35） |

### SCM — `ScmEvent`（9，刻意不發逐幀進度——ARCH-1）
| 主題 | 關鍵欄位 |
|------|----------|
| `scm.forecast.updated` | materialNo, bucket, qty |
| `scm.shipment.created` | shipmentNo, direction(inbound\|outbound), fromNode, toNode, laneId, materialNo, qty, poNo\|null, salesOrderNo\|null |
| `scm.shipment.departed` | shipmentNo, fromNode, toNode, laneId, materialNo, qty |
| `scm.shipment.arrived` | shipmentNo, toNode, materialNo, qty, poNo\|null（進貨） |
| `scm.shipment.delivered` | shipmentNo, toNode, materialNo, qty, salesOrderNo\|null（出貨） |
| `scm.atp.promised` | salesOrderNo, materialNo, promisedDate, available |
| `scm.supplier.asn` | bpNo, supplierName, materialNo, qty, poNo\|null |
| `scm.disruption.raised` | laneId, fromNode, toNode, reason |
| `scm.disruption.cleared` | laneId, fromNode, toNode |

`EventStream` 對每個主題都有短碼與顏色（如 LOT/EQP/SPC/ALM/RCP/KPI/SFT/DONE、SO/MRP/PRD/MOV/PO/GL/INV、FCST/SHIP/ARRV/DLVD/ATP/ASN/DSRP/CLR）。

---

## 5. 資料模型與決定性產生

三層建構鏈 `generateMasterData() → generateErpData(masterData) → generateScmData(masterData, erpData)`，每一步皆純函數、決定性（相同輸入產生 deep-equal 輸出，由 `erp.test.ts` / `scm.test.ts` 驗證）。

**PRNG 核心（`src/data/prng.ts`）**：`mulberry32(seed)`（可種子 32-bit PRNG）、`cyrb53(str, seed)`（53-bit 字串雜湊，去關聯複合種子）、`seededRng(a,b)`＝`mulberry32(cyrb53(\`${a}:${b}\`))`、`pick` / `pickN`（Fisher-Yates）。**全程不使用系統時鐘或 `Math.random`**；所有日期由 `dateFromOffset` 錨定於 2026-05、月份夾為 28 天。種子依層級分段：MES 42/100/200/300/400、ERP 500/510/520/530/600/610/620/630、SCM 2010/2020/2030/2040/2050/2060。

### 5.1 MES 主檔（`src/data/master/*`）
| 實體 | 數量 | 關鍵欄位 |
|------|------|----------|
| Equipment | 50（8 bay：7,6,6,6,7,6,6,6） | toolId(`EQP-{type}-NN`), bay, bayIndex, slotInBay, toolType(LITHO/ETCH/CMP/CVD/PVD/DIFF/IMPL/INSP), vendor(ASML/LAM/AMAT/TEL/KLA/SCREEN), model, initialState(~70% PROD), x, y |
| Product | 12 | productCode(`DEV-{TECH}-…`), productName, technology(7/5/3/14/10/28nm), layers |
| Customer | 8 | customerId, customerName, displayName |
| Operator | 80 | operatorId, name(EN), nameZh(zh-TW), shift(A/B/C), role(operator/engineer/supervisor), certifiedTools[] |
| ProcessRoute | 5（RT-7NM-STD 8 步 … RT-28NM-RF 5 步） | routeId, routeName, technology, steps[]{stepIndex, stepName, toolType, nominalMinutes} |
| Recipe | 30 | recipeId, recipeName, toolType, currentVersion(semver), versions[]{version,author,changeNote,timestamp}, parameters（依機型不同） |
| Lot | 200 | lotId(`LOT-26{wk}W-NNNNN`), productCode, customerName, routeId, currentStep, totalSteps, waferCount, priority(~5% hot/~1% super-hot), status(~70% in-process), currentToolId, startTime, parentLotId, childLotIds[]（~10% 分批） |

### 5.2 ERP 實體（`src/data/erp/*`；`ErpData`）
依賴順序：plants + glAccounts（靜態）→ costCenters → workCenters → materials → businessPartners → boms + inventory → salesOrders → purchaseOrders → productionOrders。

| 實體 | 數量 | 關鍵欄位 |
|------|------|----------|
| Material | ~120-160 | materialNo, type(FERT/HALB/ROH), description, baseUoM, materialGroup, plant(FAB-01), valuationClass, standardCost, leadTimeDays, productCode?（FERT 連回 MES） |
| BusinessPartner | 8 客戶 + 14 供應商 | bpNo, role(customer/vendor/both), name, country, paymentTerms(NET30/45/60), incoterms(FOB/DDP/EXW), creditLimit |
| Bom / BomComponent | 每 FERT 一張 | bomId, headerMaterialNo, headerDescription, components[]{materialNo,description,qty,uom} |
| WorkCenter | 50 | workCenterId, name, toolType, costCenterId, bay, capacityHrs |
| CostCenter | 10（8 製程 + 設施 + 廠務間接） | costCenterId(`CC-{type}`), name, area, plant |
| GlAccount | 14（資產/負債/收入/費用） | accountNo, name, type |
| Plant | 2（FAB-01 新竹 / FAB-02 台南） | plantId, name, storageLocations[RAW,WIP,FG] |
| SalesOrder | 50 | orderNo(`SO-1xxxxx`), bpNo, customerName, orderDate, requestedDate, status, priority, lines[], netValue |
| PurchaseOrder | 35 | poNo(`PO-2xxxxx`), bpNo, vendorName, orderDate, deliveryDate, status(open/confirmed/received/late), lines[], netValue |
| ProductionOrder | 36 | orderNo(`PRO-3xxxxx`), materialNo, description, routeId, targetQty, status(Created/Released/InProcess/Completed), salesOrderNo?, lotId?（runtime 由 bridge 補） |
| InventoryRow | 每料一列 | materialNo, description, plant, storageLoc, onHand, committed, available（~10% 缺料） |
| **BridgedLot** | runtime | lotId, prodOrderNo, materialNo, productCode, routeId, totalSteps, currentStep, status, startedT（**唯一非 `generate*Data` 產生**，由 bridge 在 `erp.prodorder.released` 時建立） |

> 註：`workCenters` / `glAccounts` / `plants` 存在於 `ErpData` 但未被 10 個 ERP 模組做成獨立表格（glAccounts 僅透過 Finance 即時分錄出現）。

### 5.3 SCM 實體（`src/data/scm/*`；`ScmData`）
SCM 鍵接 ERP（`masterData` 僅為相容保留）。依賴順序：networkNodes → lanes；forecasts；shipments；scorecards；atpPromises。

| 實體 | 關鍵欄位 |
|------|----------|
| NetworkNode | id, kind(supplier/fab/dc/customer), name, region, x, y, labelSide。固定 1000×560 viewBox，x,y 全手放於 ≥24px 安全內距（無地圖庫）。供應商 ≤5（溢位 'SUP-OTHERS'）、FAB-01 中央錨、DC 2-3、客戶依國別 ≤4 區（溢位 'CUS-OTHERS'） |
| Lane | id(`LN-{from}->{to}`), from, to, mode(air/sea/truck), transitDays。拓樸：每供應商→FAB-01、FAB-01→每 DC、每 DC→每客戶區。modeFor：同區 truck、供應商來源 air、其他境外 sea；transitDays 依模式帶域（air 2-5 / sea 18-35 / truck 1-4）。**mode 以筆觸材質而非顏色呈現** |
| Forecast | materialNo, buckets[]（預測）, actuals[]（實績）。每 FERT 一筆，8 週桶（`FORECAST_BUCKETS`），季節擺動 + 抖動、四捨五入到 25 |
| Shipment | shipmentNo, direction, fromNode, toNode, laneId, refDoc{poNo?/salesOrderNo?}, materialNo, qty, status(created/in-transit/arrived/delivered), departureT, transitSeconds（**無 `progress` — ARCH-1**）。靜態種子集為 ARCH-2 首畫面族群（8 進貨 + 6 出貨，皆中段散佈） |
| SupplierScorecard | bpNo, name, onTimePct, qualityPct, avgLeadDays, openAsns（≤5 供應商，偏高，少數降至 amber/rose） |
| AtpPromise | salesOrderNo, materialNo, promisedDate, available（每張 open/in-process SO，~20% 短缺；注意：銷售訂單 ATP 折頁實際只用 `erpData` 推導，未消費此產生物） |

---

## 6. MES 模組（7）

### 6.1 Fab Floor（`fab-floor`，登陸首頁）
- **用途**：現場戰情登陸頁——KPI 列 + 動畫 bay 地圖 + 右側即時事件流。
- **功能**：`KpiStrip` 由 `kpi.tick` 驅動 5 卡（OEE / Yield 徑向 Gauge、Throughput/MTBF/WIP MetricTile）；`BayLayout` 1000×500 SVG 8 bay，每機台一塊磚（填色 = `e10Colors[state]` + 霓虹 bloom 暈，down 狀態 SDT/UDT 加脈動環）；**晶圓流動粒子**：每筆 `lot.move` 一顆 framer-motion 粒子由來源磚飛向目的磚（上限 14，`prefers-reduced-motion` 時關閉）；玻璃 E10 圖例；右欄 `EventStream` 渲染全部主題。
- **互動**：hover 磚看 `{toolId}—{state}`；hover 事件流暫停捲動。無 drill-in。

### 6.2 Production · WIP（`production`，徽章 `production`）
- **用途**：在製品批追蹤——密集表 + 途程 / 族譜 drill-in。
- **功能**：`DenseDataTable` 列出 `masterData.lots`；欄位 Lot ID / Product / Customer / Route / Progress（漸層發光進度條，step 由 `lot.move` 即時更新）/ Priority（super-hot 脈動 critical + sonar，hot 琥珀）/ Status / Wafers；列染色 `row-superhot`/`row-hot`。drill-in：明細格 + 途程步驟（highlight 目前步驟）+ 族譜（父 / 子批可點擊跳轉）。
- **互動**：點列選批；點父 / 子批跳轉；表頭排序。

### 6.3 Equipment · E10 State（`equipment`，徽章 `equipmentDown`）
- **用途**：機台清冊 + 即時 E10 狀態 + 狀態分布條 + 每機台 SECS/GEM 訊息終端。
- **功能**：表頭 `StateDistribution` 分段條（依 PROD/STBY/SDT/UDT/ENG/NSC/OUT 計數上色）；`DenseDataTable` 機台列（State cell = `StatusDot`，down 脈動）；drill-in 「Current State」+ **SECS 訊息終端**：只記目前選取機台，`equip.state` → 模擬 S6F11 CEID 1001、`recipe.load` → 模擬 S2F41 PP-SELECT，上限 50 行，最新行以打字機效果（3 字/18ms + 閃爍游標）逐字顯示。SECS 訊息為外觀擬真，無真實傳輸。
- **互動**：點機台啟動其 SECS 串流；切換機台會清空重啟 log。

### 6.4 SPC / Quality（`spc`，僅收 `eventBus`）
- **用途**：CD（關鍵尺寸）均勻度即時管制圖 + 即時 Cp/Cpk 製程能力 + 違規記錄。
- **功能**：管制限 UCL 55 / LCL 45 / CL 50；規格限 USL 56 / LSL 44（刻意較寬）。4 張統計磚（Current CD / Violations / Cp / Cpk）；**Cp/Cpk 實算**（`useMemo`，≥8 點才算）：mean、樣本標準差（n−1）、`Cp=(USL−LSL)/(6σ)`、`Cpk=min(USL−mean,mean−LSL)/(3σ)`，`capColor` 門檻 ≥1.33 emerald / ≥1.0 amber / 其餘 rose。recharts `AreaChart`（Y[40,60]、UCL/LCL/CL 虛線、違規點 rose r5 marker）；每筆 `spc.violation` 入 100 點視窗；違規記錄列最近 20 筆 warn/critical。
- **互動**：純觀測 + 圖表 tooltip。

### 6.5 Recipe Management（`recipe`，僅收 `masterData`，靜態）
- **用途**：配方庫瀏覽 + 參數 + 最新變更語意版本 diff + commit-graph 版本歷史。
- **功能**：左欄依 toolType 分組配方庫；右側參數 zebra 表；**版本 diff**：`prevVersion → currentVersion` 箭頭 + bump 類型藥丸（`bumpType` 解析 semver：major/minor/patch/initial，各自顏色）+ 變更說明；**版本歷史**：commit-graph 時間軸（節點顏色 = 相對前一版的 bump 類型，current 版較大且發光）。
- **互動**：點配方檢視；全靜態（不訂閱任何事件——唯一未接匯流排的 MES 模組）。

### 6.6 Alarms · 警報台（`alarms`，僅收 `eventBus`，徽章 `alarms`）
- **用途**：即時警報台——嚴重度摘要 + 捲動警報流 + drill-in（SOP 參照 + 確認）。
- **功能**：表頭 critical 徽章（雙重 sonar 環 + Siren，count>0 才現）；三 `SeverityChip`（critical 脈動 sonar / major / minor）；警報流每筆含左嚴重度條、嚴重度 chip、`t={t}s`、來源、訊息、ACK 徽章（有 `ackOperatorId` 時）；drill-in 顯示來源 / 全文 / SOP 參照 / 確認人 / 時間。**sonar 同心環脈動** 是 critical 的標誌視覺。
- **互動**：點列開 drill-in；確認狀態來自事件流（無手動 ack）。

### 6.7 KPI Dashboard（`kpi`）
- **用途**：生產 KPI 戰情——兩枚 hero 徑向 Gauge（OEE/Yield）+ 多序列趨勢圖 + 含 sparkline 與趨勢差值的指標磚格。
- **功能**：訂閱 `ringBuffer$()`（最多 1000 筆快照），以 `computeKpis`（`src/lib/kpi.ts`）**自行推導** KPI（不直接信 `kpi.tick`），並推入最近 ~60 拍歷史。`computeKpis`：由事件計數推導 OEE（availability×performance×quality）/ Yield / MTBF / MTTR / WIP turn / throughput / cycle time，與固定 BASELINE 依樣本量混合（`blendFactor = min(events/100,1)`）避免抖動。hero 兩 Gauge（size 148）含趨勢差值；趨勢圖 recharts `ComposedChart` 雙 Y 軸；指標格 Throughput/MTBF/MTTR/WIP/Cycle（MTTR 與 Cycle 為「越低越好」）。
- **互動**：純儀表板 + tooltip。

---

## 7. ERP 模組（10）

所有 ERP 模組接收 `{erpData, eventBus}`（`ErpModuleProps`）；實際使用 `eventBus` 者僅 Cockpit 與 Finance，Production Orders 改讀 `useBridgedLots`，其餘為靜態快照。選取 / drill-in 由 `uiStore.selectedEntity` 集中管理，`DrillInPanel` 為右側 420px 滑入抽屜（Esc 關閉）。

### 7.1 Cockpit · Document Flow（`erp-cockpit`，ERP hero）
- **用途**：即時 order-to-cash 管線——6 條固定泳道（Sales Order → Planned → Prod Order → Lot → Goods Receipt → Invoice）。
- **功能**：每泳道一個 `Panel` 含滾動總數徽章；`DocChip`（發光狀態點 + 單空 id + 子標籤，最新者帶「New」+ animate-rise）；Lot 泳道置頂釘住 `useBridgedLots` 在製批（`LotProgress` 漸層條）；各泳道暖空狀態；hero 標題列含 stage rail 與總文件數。
- **訂閱**：`erp.order.created`→SO、`erp.plannedorder.created`/`erp.mrp.run`→Planned、`erp.prodorder.released`/`erp.prodorder.status`→Prod、`lot.move`/`lot.complete`→Lot、`erp.goods.movement`(僅 GR)→GR、`erp.invoice.created`→Invoice。唯讀，無 drill-in。

### 7.2 Materials（`materials`）
- 物料主檔（SAP MM 風格）。`MasterDataModule`，`entityType='material'`。欄位 Material / Type（FERT/HALB/ROH chip）/ Description / Group / UoM / Std Cost；表頭顯示三型計數；drill-in 含 Basic Data + Valuation，FERT 另顯示 BOM 組件。

### 7.3 Business Partners（`business-partners`）
- 客戶與供應商主檔（SAP BP 風格）。`MasterDataModule`，`entityType='businessPartner'`。欄位 BP No. / Role（customer/vendor/both chip）/ Name / Country / Terms / Incoterms；drill-in 含信用額度（USD 格式）。

### 7.4 BOM · Bill of Materials（`bom`）
- BOM 結構瀏覽器（自訂雙欄，非 `MasterDataModule`，使用本地 state）。左欄可搜尋 BOM 清單；右欄「Component Tree」含父料 + 縮排組件（垂直 + 彎角樹狀連接線 + 節點點）；BOM meta 格。

### 7.5 Sales Orders（含 ATP 折頁）（`sales-orders`，徽章 `openOrders`）
- 銷售訂單簿（SAP SD）+ 併入的 ATP / 訂單承諾層（自訂版面以容納 ATP 面板，使用 `uiStore` + `DrillInPanel`）。
- **ATP** 僅由 `erpData` 推導（`deriveAtp`）：onHand（FERT 庫存）+ inTransit（open/confirmed PO 量）+ plannedProduction（Released/InProcess 生產單量），demand（open/in-process SO 量），shortfall = max(0, demand−available)。
- **功能**：表上 `AtpAvailabilityPanel`（分段水平條 On Hand/In Transit/Planned Prod/Shortfall + 涵蓋率 Gauge）；每單 ATP 狀態（confirmed/partial/shortfall，`cyrb53(orderNo)` 決定性）與承諾交期（partial +1~6d、shortfall +7~20d）；欄位含 Promised（滑期變 warn 發光）與 ATP chip；列染 `row-superhot`/`row-hot`。
- **互動**：點列開 drill-in；可排序 Promised / ATP。

### 7.6 MRP / Material Coverage（`mrp`，SAP MD04 風格，徽章 `shortages`）
- 時間分相料件覆蓋矩陣 + MD04 式需求 / 供給 pegging drill-in（自訂矩陣 + 右側 aside，本地 state）。`buildCoverage` 將 committed 依前置期攤於 5 桶（B1~B5），投射剩餘在手，首破點標記。功能：覆蓋矩陣（≤0 cell 發光 critical）；表頭 shortages / covered 藥丸；右側 aside 含覆蓋快照、投射 5 桶、需求（消耗該料的生產單）、供給（未收貨 PO）。

### 7.7 Production Orders（`production-orders`）
- 生產訂單簿（SAP PP）橋接 MES 現場。`MasterDataModule`，`entityType='prodOrder'`；**即時資料來自 `useBridgedLots` 而非匯流排**。欄位含 Live Progress（脈動 Live sonar 徽章 + 進度條 + `currentStep/totalSteps`）；drill-in 含 Linked Sales Order 與 Live Floor Progress（僅在有 bridged 批時出現）。

### 7.8 Inventory · Stock（`inventory`）
- 料 × 儲位庫存瀏覽器（SAP MMBE）。`MasterDataModule`，`rowKey='{materialNo}·{storageLoc}'`。欄位 Material / Description / Storage Loc / On Hand / Committed / Available（≤0 發光 critical）；drill-in 含 Stock Breakdown + 短缺 / 可承諾橫幅。

### 7.9 Procurement · Purchase Orders（`procurement`，徽章 `latePOs`）
- 採購單簿（SAP MM 採購）。`MasterDataModule<PurchaseOrder>`，`entityType='purchaseOrder'`。欄位 PO No. / Vendor / Status（late 含 sonar 脈動）/ Delivery / Net Value；drill-in 含 Line Items。

### 7.10 Finance（`finance`）
- FI/CO 財務戰情：KPI 磚 + 成本中心 + **即時 GL 分錄帳本**（由匯流排串流）。KPI（`useMemo`）：庫存價值、WIP、營收、應收、應付、收款率 Gauge；成本中心表；**GL Postings · Live**：終端風格帳本，訂閱 `erp.gl.posting` 即時前置（上限 40），每行 `t` 秒 + 科目 + 簽署金額（≥0 success / 否則 critical）。

---

## 8. SCM 模組（4 + ATP 折頁）

SCM 模組接收 `{scmData, eventBus}`（`ScmModuleProps`）。共用機制：船運只存離散狀態（ARCH-1，位置由 `shipmentPosition` 計算）；`useShipments` 為單一真相；driver 為主軸（200ms 只發狀態轉換，每邊界重新種入 6 筆，ARCH-2）。

### 8.1 Control Tower · 供應網控制塔（`control-tower`，SCM hero，徽章 `disruptions`）
- **用途**：bespoke 固定 viewBox（1000×560）SVG 網路地圖，於 `overflow-hidden` Panel 內（仿 BayLayout，內在裁切不溢出）。供應商 / FAB-01 錨 / DC / 客戶區 + 曲線分模式航段 + 即時船運點滑動。右上狀態徽章 Nominal（emerald）/ Alert（critical 脈動）。
- **功能**：
  - **KPI 列（5 MetricTile）**：In Transit / Late（`shipmentPosition≥1` 的在途點）/ On-Time % / Disruptions / Delivered。
  - **rAF 點滑動（ARCH-1）**：每 `requestAnimationFrame` 經 `dotRefs` 命令式 `setAttribute('transform', translate)`，**節點 / 航段層在途中完全不重繪**；`u = shipmentPosition(localClock.loopT(), departureT, transitSeconds)` 經 `bezierAt()` 取點 + 切線。
  - **彗星點精靈**：白熱核 `#CFFAFE` 透過 `feGaussianBlur` bloom + 方向色 drop-shadow（進貨青、出貨天藍）+ 模糊外暈 + 旋轉至航段切線的虛線尾跡；抵達 / 交貨時 opacity→0。
  - **曲線航段**：端點偏移節點半徑，避免點蓋住節點；確定性垂直 bow 分散平行航段；方向箭頭（色盲安全）；中斷航段轉 `#F43F5E` + 脈動。
  - **抵達 / 交貨 WOW 拍**：目的地 emerald `animate-sonar` 環 + `animate-pulse-glow`（由 `scm.shipment.arrived`/`delivered` 觸發）。
  - **FAB-01 錨**：最大最亮 + `hud-frame` 角框 + 內核；節點 labelSide 對齊標籤；玻璃 HUD 圖例；`scan-sweep` + 點陣背景；`prefers-reduced-motion` 時點貼靜態座標。
- **互動**：hover 點 → 玻璃 ETA tooltip（shipmentNo / direction / refDoc / 料×量 / ETA 進度條）；點節點 / 航段 / 點 → `selectEntity` 交叉過濾 Shipments；drill-in 顯示該節點 / 航段的相關船運。

### 8.2 Shipments · 在途物流（`shipments`，徽章 `inTransit`）
- **用途**：即時物流清單——每筆 driver 在飛的船運一列，與控制塔地圖共用 `useShipments`。
- **功能**：可排序 `DenseDataTable`（為轉發 `rowClassName` 而內嵌 `ShipmentsTable` 殼）：Shipment / Dir（In/Out 箭頭）/ From→To（模式圖示 + 名稱）/ Material / Qty / Status（`DocChip` 色調，in-transit 點脈動）/ ETA / Progress（`shipmentPosition×100`）；`etaLabel` 依狀態顯示秒數 / Due / Pending / Arrived / Delivered；列染 `row-superhot`（中斷航段）/ `row-hot`（過 ETA）；表頭即時計數 In Transit / Late / Disrupted；暖空狀態。
- **互動**：點列開 drill-in（Shipment / Lane / Reference 三段）。

### 8.3 Demand Planning · 需求規劃（`demand-planning`，IBP 風格）
- **用途**：每 FERT 料的預測 vs 實績曲線（8 週），熱力染色變異格 + 選定料的雙序列圖；即時預測覆蓋就地改桶。
- **功能**：KPI 列（Plan Volume / Forecast Accuracy % / Bias % / Materials Planned）；recharts `ComposedChart`（Forecast 發光 Area 靛色 + Actual Line 綠 + 雙域 Y 軸 + 最大超量桶 spike `ReferenceLine`）；IBP 格（`DenseDataTable` 每料三帶 Forecast/Actual/Variance）；**變異帶熱力染色** `varianceColor`（|v|<6% 琥珀、超量 rose、低量 emerald + 發光 textShadow + 簽署 %）；訂閱 `scm.forecast.updated` 即時覆蓋並增「N re-plans」徽章。
- **互動**：點任一列把圖切到該料（本地 state，非 `uiStore`）。

### 8.4 Supplier Scorecards · 供應商評分（`supplier-scorecards`，靜態）
- **用途**：供應商協作板——每供應商一張卡，三枚徑向 Gauge（準時 / 品質 / 前置）+ 準時趨勢 sparkline + 開放 ASN 數 + 風險旗標。
- **功能**：響應式卡片格（**非表格**）；`capColor`（準時 / 品質越高越好：≥95 emerald / ≥85 amber / 其餘 rose）、`capColorLowerBetter`（前置越低越好：≤14d emerald / ≤30d amber / 否則 rose，長前置永不變綠）；`isAtRisk = onTime<95 || quality<95 || lead>14` 加 `row-hot`；sparkline 由 `mulberry32` 種子（供應商 id）決定性產生；drill-in 4 列門檻指標 + 風險橫幅 + 色彩門檻圖例。
- **互動**：點卡開 drill-in。

### 8.5 ATP / Order Promising 折頁（`sales-orders` 內，見 §7.5）
- 依計畫 Issue 4（DRY）併入 ERP Sales Orders（因 SCM 船運 / atp 不在 `ErpModuleProps`），ATP 僅由 `erpData` 推導，不耦合 SCM。`scm.atp.promised` 事件雖由 driver 在出貨交貨時發送並於 EventStream 呈現，但此折頁未訂閱它，也未消費 `scmData.atpPromises`。

---

## 9. 設計系統（深色 Siemens Cyan 戰情主題）

CSS 為視覺單一真相（`src/index.css`），`src/lib/tokens.ts` 鏡射同一組常數供 TS/JS 使用（須保持同步）。**單一深色主題**，`:root` 與 `.dark` 刻意相同，無淺色模式 / 切換。

### 9.1 色彩 token
- **畫布 / 層級表面**（深藍）：`--canvas #0A0E18`、`--surface-1 #0E1422`（側欄 / 頂欄）、`--surface-2 #111A2C`（面板）、`--surface-3 #16223A`（懸浮）。
- **邊（青色髮絲）**：`--edge` / `--edge-strong`。
- **文字（slate 階）**：`--ink-1 #E8EEF7`、`--ink-2 #AEBBD0`、`--ink-3 #74849E`、`--ink-mute`。
- **強調（電青）**：`--accent #22D3EE`、`--accent-2 #38BDF8`（天藍）、`--accent-3 #818CF8`（靛，SCM 域色）、`--accent-glow`。
- **E10 霓虹狀態色**：PROD `#34D399`、STBY `#FBBF24`、SDT `#FB7185`、UDT `#EF4444`、NSC `#64748B`、ENG `#60A5FA`、OUT `#334155`。
- **語意**：`--sem-critical #F43F5E`；別名 info=accent-2、warn=e10-stby、critical=sem-critical、success=e10-prod。
- **圖表序列**：cyan / sky / indigo / emerald / amber（CSS 5 色，tokens.ts 加 rose 共 6）。
- 字體：標題 / 內文 `Geist Variable`，等寬 `JetBrains Mono`（tabular-nums / zero）。
- `tokens.ts` 另匯出 `e10Symbols`（●◐■▨○◆✕）、`e10Labels`、`e10Glow`、motion 時長 / easing 常數。
- 背景：固定雙徑向暈（青上中 / 靛右上）疊 40px 青色格線。

### 9.2 工具類（`@layer components`）
`.panel`（主表面 + 漸層高光 + 邊 + 陰影）、`.glass`（毛玻璃 backdrop-blur）、`.panel-hover`（懸浮抬升）、`.hud-frame`（兩個 14px 角框）、`.accent-tick`（青→天藍漸層發光豎條，面板標題前導）、`.glow-cyan`、`.text-glow`/`.text-glow-soft`、`.metric-value`（JetBrains Mono tabular-nums，KPI 數字）。

### 9.3 動效詞彙（全為 `fp-*` keyframe，全部 `prefers-reduced-motion` 時停用，惟 `animate-rise` 保留）
`animate-pulse-glow`（紅環脈動，警報 / 徽章）、`animate-pulse-soft`（呼吸，StatusDot / 頂欄）、`animate-rise`（淡入上移，EventStream 新列）、`animate-sonar`（同心環，警報 / 中斷 / 抵達 WOW）、`animate-blink`（SECS 游標）、`row-hot` / `row-superhot`（脈動左條內暈，僅 box-shadow 不搶列底色）、`scan-sweep`（對角青色掃描線）、`fp-flow`（offset-distance 流動點）。另含細青色捲軸與 recharts 暗色 tooltip 覆寫。

### 9.4 共用 UI 元件
| 元件 | 角色 |
|------|------|
| `Panel` / `PanelHeader` | 主表面包裝 + 標題列（`.accent-tick` + icon + 標題 + 右槽） |
| `MetricTile` | KPI 磚：標籤 + 發光單空值 + 趨勢差值 + 漸層 sparkline（recharts AreaChart） |
| `Gauge` | 徑向環 Gauge（發光弧，OEE/Yield/涵蓋率） |
| `StatusDot` | E10 霓虹狀態點（色 + 暈 + 可選 code/label，可脈動） |
| `DenseDataTable` | 虛擬化（`@tanstack/react-virtual`）可排序密集表；`rowClassName` 驅動 `row-hot/row-superhot`；zebra + 懸浮 + 選取左條 |
| `MasterDataModule` | 通用「密集表 + drill-in」外殼（零領域知識），選取透過 `uiStore` |
| `DrillInPanel` | 右側 420px framer-motion 玻璃抽屜，Esc 關閉，由 `uiStore.selectedEntity` 控制 |
| `EventStream` | 即時事件流：對全部主題有窮舉的訊息 / 短碼 / 顏色；critical/major 釘住 10s；hover 暫停 |
| `TopBar` | 全域頂欄：FAB-01 / PRODUCTION / 任務時鐘（HH:MM:SS）/ Cycle / 班別 / 在班人數 / 180s 進度條 |
| `ErrorBoundary` | 每模組錯誤邊界（深色 fallback + Reload module） |
| shadcn / base-ui primitives | button/input/table/badge/separator/sheet/dialog/scroll-area，純由 token bridge 套深色主題 |

---

## 10. 技術棧、建置與部署

- **前端**：React 19、TypeScript、Tailwind CSS 4。
- **狀態 / 反應**：RxJS 7.8（事件匯流排）、zustand 5（store）。
- **視覺**：recharts 3（圖表）、framer-motion 12 + gsap 3（動畫）、lucide-react（圖示）、`@tanstack/react-virtual`（虛擬化表）、`@fontsource-variable/geist`。
- **建置**：Vite 8（rolldown）；`vite.config.ts` 用 `@vitejs/plugin-react` + `@tailwindcss/vite`；`base = '/mes-erp/'`（GitHub Actions）否則 `'./'`；別名 `@`→`./src`。
- **測試**：Vitest，預設 `environment: 'node'`（現有測試皆純邏輯，需 DOM 時逐檔 `// @vitest-environment` 開啟）；目前 91 個測試（11 檔）全綠。
- **部署**：純靜態 SPA，push 至 `master` 由 GitHub Pages 建置部署（路徑前綴 `/mes-erp/`）。
- **指令**：`dev` / `build`（`tsc -b && vite build`）/ `lint` / `preview` / `test`（`vitest run`）/ `test:watch`。

---

## 11. 非功能性特性與限制

- **決定性**：全資料層由種子化 PRNG 產生，無系統時鐘 / `Math.random`；相同輸入 deep-equal。runtime 模擬亦由 `loopIndex` 重新 seed，每 180s 迴圈為「新但可重現」。
- **效能**：環形緩衝 1000、`useBridgedLots` 60、`useShipments` 40，皆 cap + recycle 以界定記憶體；控制塔點以 rAF 命令式更新 transform，途中不觸發 React 重繪（維持 ~60fps）；模組全 `React.lazy` 分割（hero 地圖 ~17.5KB / gz 5.7KB）。
- **可及性**：所有 `fp-*` 動效於 `prefers-reduced-motion` 停用（惟入場淡入保留）；控制塔 reduced-motion 時點貼靜態座標、中斷仍以靜態紅筆觸可辨；方向以箭頭、航段模式以筆觸材質（非僅顏色）輔助色盲。
- **桌機門檻**：視窗 < 1280px 全 app 以資訊卡取代。
- **韌性**：每模組 `ErrorBoundary` 隔離崩潰；訂閱先於發送避免漏接首筆；迴圈邊界守衛避免孤兒。

---

## 12. 附錄：關鍵檔案地圖

```
src/
├─ App.tsx                         三域外殼、啟動順序、徽章、視窗門檻
├─ index.css                       設計系統單一真相（token / 工具類 / keyframe）
├─ lib/
│  ├─ events.ts / erpEvents.ts / scmEvents.ts   事件聯集（27 主題）
│  ├─ eventBus.ts                  RxJS 匯流排 + 環形緩衝
│  ├─ clock.ts                     180s 迴圈時鐘
│  ├─ kpi.ts                       computeKpis（KPI 推導）
│  ├─ tokens.ts / secs.ts          視覺 token 鏡射 / SECS 格式器
│  ├─ uiStore.ts / useBridgedLots.ts / useShipments.ts   zustand
├─ data/
│  ├─ prng.ts                      mulberry32 / cyrb53 / seededRng
│  ├─ timeline-engine.ts, timeline.ts            MES 引擎 + SPINE
│  ├─ master/                      MES 主檔產生器
│  ├─ erp/                         ERP 型別 / 產生器 / erp-timeline-engine / bridge
│  └─ scm/                         SCM 型別 / 產生器 / scm-timeline-engine / shipment-driver / shipmentPosition
├─ modules/
│  ├─ FabFloor, Production, Equipment, SPC, Recipe, Alarms, KPI   (MES)
│  ├─ erp/  Cockpit, Materials, BusinessPartners, Bom, SalesOrders, Mrp, ProductionOrders, Inventory, Procurement, Finance
│  └─ scm/  ControlTower, Shipments, DemandPlanning, SupplierScorecards
└─ components/                     共用元件（DenseDataTable, MasterDataModule, DrillInPanel, EventStream, TopBar, ErrorBoundary, ui/*）
```

設計與規格文件：`docs/plans/2026-05-29-fabpulse-erp-extension.md`、`docs/plans/2026-05-29-fabpulse-scm-extension.md`。

---
*本說明書依 2026-05-29 之 `master`（含 SCM 層 commit `5d4b628`）原始碼整理。*
