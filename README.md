# 捷旭醫療 LIFF V3

全新建立的業務行動入口，部署目標為 GitHub Pages。

## 功能

- 拜訪紀錄
- 機台查詢
- 訂貨預估
- 我的標案
- 機台交接
- 跟刀業績
- 產品介紹

## 安全原則

- 前端不存放 Odoo API Key。
- 前端只呼叫 Make Webhook。
- API URL 與 LIFF ID 只在 `src/config.js` 設定。

## 本機預覽

在此資料夾執行：

```bash
python3 -m http.server 8080
```

再開啟 `http://localhost:8080`。

## 上線前設定

1. 建立新的 LINE LIFF App，將 LIFF ID 填入 `src/config.js`。
2. 建立 Make Webhook，將 Webhook URL 填入 `src/config.js`。
3. 以 GitHub Pages 部署此資料夾內容。

## V3 後續功能接線

前端透過現有 LINE 驗證 Gateway 送出 `auth`。逐一完成 Make 存取控制與
LINE 驗收後，在 `CONFIG.operationPages` 加入對應頁面代碼
`forecast`、`transfer`、`report` 或 `performance`。

| 動作 | 傳入的 `model` 與 `data` | 成功回應欄位（含 `ok: true`） |
| --- | --- | --- |
| `SEARCH_REFERENCES` | `forecast`、`transfer` 或 `performance`。傳入 `field`、`keyword` | `options: [{id, label}]` |
| `CREATE_RECORD` | `forecast` 傳 `month, productId, quantity, note, requestId`。月份為 `YYYY-MM` | `recordId` 正整數 |
| `CREATE_RECORD` | `transfer` 傳 `machineId, receiverId, plannedDate, note, requestId` | `recordId` 正整數 |
| `CREATE_RECORD` | `performance` 傳 `serviceDate, hospitalId, productId, quantity, amount, note, requestId` | `recordId` 正整數 |
| `LIST_OWN_RECORDS` | `forecast` 或 `performance` 傳 `month`，`transfer` 依交接人或接收人查詢。下一頁另傳 `cursor` | `records`、`nextCursor`。業績額外提供整月 `totalAmount` |
| `RESPOND_TRANSFER` | `model=transfer`，`data` 傳入 `recordId, decision`。決定值為 `accept` 或 `reject`，拒絕時附 `reason` | `recordId`、`status`，值為「已確認」或「已拒絕」 |

查詢欄位限於 `forecast/productId`、`transfer/machineId`、`transfer/receiverId`、
`performance/hospitalId` 和 `performance/productId`。查詢結果由後端按公司和權限篩選，
關聯 ID 送出時再次查驗。三種紀錄都有 `id, label, date`。預估紀錄另有
`quantity, status, note`。跟刀業績另有 `hospital, quantity, amount`。
交接紀錄另有 `sender, receiver, status, note, canRespond`。

### 我的機台交接紀錄

接收 `LIST_OWN_RECORDS` 且 `model=transfer` 後，沿用 LINE 員工對照與授權流程。
以 Odoo 的 `x_1213/search_read` 查詢：

- 公司 `x_studio_selection_1` 等於後端對照的公司代碼。
- `x_studio_many2one_2`（交接人）或 `x_studio_many2one_3`（接收人）等於後端對照的員工 ID。
- 依 `id desc` 排序，最多取 51 筆。下一頁傳入正整數字串 `cursor`，查詢再加入 `id < cursor`。

回傳 `{ok: true, transfers: [...]}`，保留 Odoo 陣列格式。需讀取 `id`、`x_name`、
`x_studio_many2one_1`（機台）、`x_studio_many2one_2`、`x_studio_many2one_3`、
`x_studio_many2one_4`（目前保管人）、`x_studio_date_3`（預計交接日期）、
`x_studio_selection_2`（狀態）、`x_studio_text_1`（拒絕原因）、`x_studio_text_2`（備註）。
前端顯示 50 筆，第 51 筆用於判斷是否顯示「載入更多」。

回傳 `respondableIds` 時，僅列出本頁資料中登入員工為接收人且狀態為「待確認」的 ID。
缺少此欄位時，LINE 不顯示處理按鈕。填報權限仍由 `senderName` 控制。
正式 LINE 驗收時，用交接人、接收人與無關帳號各測一次，
並確認其他公司的紀錄無法讀取。查詢路由備妥後才啟用 `transfer` 頁面。

### 確認接收與拒絕交接

Make 的機台交接路由以 `model=transfer`、`action=RESPOND_TRANSFER`、正整數交接單 ID，
以及 `accept`／`reject` 驗證請求。現有驗收路由若按單號篩選，切換時須停用重疊路由，
保證一次請求只呼叫一個 Odoo 動作。查詢與處理採用相同的員工授權範圍。

Make 先以 Worker 驗證的 LINE ID 唯一比對同公司、已啟用且已開放 LINE 的員工。
從 Odoo 查詢指定交接單時，同時限制公司和接收人，並核對 `待確認` 狀態。
相同決定的重送可回傳已完成的原結果。相反決定或其他狀態回覆錯誤。
只將本頁中符合相同接收資格且狀態為「待確認」的 ID 放進 `respondableIds`。
前端提供的交接單 ID 只用於查詢目標，員工與公司均由後端比對取得。

建立 Odoo Studio 的程式碼動作，模型綁定 `x_1213`，並限制整合帳號的執行權限。
伺服器動作的 `active_model` 固定為 `x_1213`，`active_id` 與 `active_ids` 以已核對的
單一交接單帶入。從 Make 的員工查詢帶入 `line_employee_id`、`line_company_id`、
`line_transfer_company`（交接模型的公司選項值），再傳 `line_transfer_decision` 與
`line_transfer_reason`。LINE 客戶端僅可傳交接單編號、決定和拒絕原因。

確認時在同一次 Odoo 交易換保管人並完成交接單。拒絕時僅更新交接單。Make 在動作
成功後，再讀取正式紀錄並回傳 `recordId` 與 `status`。第一輪驗收應涵蓋本人接收、
拒絕、他人操作、舊保管人已更新、相同決定重送與兩人同時操作。

### 後端資料對照與驗收

- 以 Worker 驗證後的 LINE ID 做授權，再以伺服端對照取得 Odoo 員工 ID 與所屬公司。
  帳號未設定員工對照時拒絕新功能。寫入時由後端帶入員工與公司。
- 訂貨預估使用 `x_1214`。預估月份寫 Odoo Date 的當月第一日，
  產品是 `product.product` 關聯，數量是 Float。確認送出後寫「已送出」。
  公司 Selection 值按各模型實際代碼映射。
- 機台交接使用 `x_1213`，交接機台關聯模型為 `x_`。建立時核對機台保管人、
  接收人與公司，初始狀態為「待確認」。接收人處理前再檢查紀錄狀態和機台保管人，
  確認時同步機台台帳的保管人。須驗證交接狀態與台帳更新的一致性，以及並發確認和重試。
- 跟刀業績使用 `x_1216`，客戶和產品分別關聯 `res.partner`、`product.product`。
  「我的業績」第一版依此模型統計本人跟刀金額。查詢篩選以授權員工與公司為準，
  以月份起日（含）到下月起日（不含）統計 TWD 金額。
- 實作建立請求的重試去重。以員工、功能與 `requestId` 識別請求，
  相同請求回傳原紀錄 ID。Odoo 證實建立成功後才回傳正整數 `recordId`。
- 驗收包含同一請求重送、非本人查詢、非接收人確認交接、查無資料、Odoo 失敗與庫存／標案回歸。

### 跟刀業績與本人月報

Odoo「跟刀業績」模型為 `x_1216`。下表是現有表單的欄位對照。

| Odoo 欄位 | 來源 |
| --- | --- |
| `x_name` | 後端以業務名稱、產品名稱與跟刀日期組成說明 |
| `x_studio_` | 所屬公司 Selection，使用 `x_1216` 的實際選項值 |
| `x_studio_many2one_1` | LINE 驗證後對照的 `hr.employee` ID |
| `x_studio_date_1` | `serviceDate`，格式 `YYYY-MM-DD` |
| `x_studio_many2one_2` | `hospitalId`，從授權範圍內的 `res.partner` 選取 |
| `x_studio_many2one_3` | `productId`，從授權範圍內的 `product.product` 選取 |
| `x_studio_float_1` | `quantity`，正數 |
| `x_studio_monetary_1` | `amount`，非負 TWD 金額，最多兩位小數 |
| `x_studio_text_1` | `note`，最多 1,000 字 |

Make 使用 `model=performance` 處理客戶／產品搜尋、寫入以及本人查詢。寫入前以同一授權範圍
重新核對客戶及產品，並於該模型確認公司選項值、金額欄位的幣別及去重機制後再開放正式填報。

本人月報的 Odoo domain 同時比對 `x_studio_`、`x_studio_many2one_1`，並使用
`x_studio_date_1 >= 月初` 與 `x_studio_date_1 < 下月月初`。`totalAmount` 在第一頁回傳，
應由相同條件計算整月金額，空結果回傳 `0`。明細依 `id desc` 分頁，取 51 筆並回傳最多
50 筆，以最後一筆回傳紀錄的 `id` 作為後續游標，最後一頁回傳 `nextCursor: null`。
明細的 `label` 使用產品名稱，`date`、`hospital`、`quantity` 和 `amount` 取自上述對照。
正式驗收須比對同月份不同業務、跨月邊界、有多頁的整月金額及一筆資料重送。

#### Make 試用路由

Odoo 以 [`performance_gateway.py`](integrations/odoo/performance_gateway.py) 建立執行程式碼的
伺服器動作，模型為 `x_1216`。以整合帳號執行，使用固定動作 ID，先測試於未啟用的
Make 情境。Odoo 動作無須加入一般使用者的動作選單。

Worker 在完成 LINE 驗證後，沿用現有動作白名單，對 `model=performance` 僅放行
`SEARCH_REFERENCES`、`CREATE_RECORD` 和 `LIST_OWN_RECORDS`。Make 新分支置於既有 Gateway
密鑰檢查與 LINE 員工授權之後。初次試用以 Make 明確指定的員工名單為準，查到唯一啟用中的員工才執行。
客戶與產品搜尋都以公司及 Odoo 存取規則過濾，共用的客戶與產品也可供選擇。

| JSON-2 欄位 | Make 來源 |
| --- | --- |
| `ids` | 單一固定的跟刀業績伺服器動作 ID |
| `context.line_performance_operation` | 已核准的 Gateway `action` |
| `context.line_performance_data` | 只映射此動作需要的 `data` 欄位，保留 JSON 型別 |
| `context.line_employee_id` | Make 查到的員工 ID |
| `context.line_company_id` | 同一筆員工在 Odoo 的公司 ID |
| `context.line_performance_company` | 後端公司 ID 對照 `x_1216.x_studio_` 的實際 Selection 鍵 |
| `context.line_verified_user_id` | Gateway 驗證後的 LINE 使用者 ID |

HTTP 模組使用既有 Odoo 連線認證，POST `/json/2/ir.actions.server/run`。Webhook 200
回傳 Odoo 動作的 `params` 物件。Odoo 錯誤由 Make 統一轉為失敗回應，避免回傳堆疊或憑證。
權限拒絕由 Make 回傳 403，參數錯誤回傳 400，暫時性後端錯誤回傳 503。

寫入一筆跟刀紀錄與儲存該次請求的 Odoo 外部識別碼在同一個交易內完成。重送沿用首次的
`requestId`，識別碼依公司與員工隔離。併發的重複識別碼若使一筆寫入失敗，該交易應回滾，
Make 保留可重試失敗回應，讓前端用同一識別碼重送以取得原紀錄 ID。若曾用不同幣別登錄，
本人月報只加總和列出 TWD 紀錄。啟用前在 Odoo 實測幣別欄位可寫入、外部識別碼權限，
並用兩筆同時送出的相同請求核對只新增一筆。確認 Make 與 Gateway 完成後再開啟兩個 LINE 入口。
