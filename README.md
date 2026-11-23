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
| `RESPOND_TRANSFER` | `recordId, decision`。決定值為 `accept` 或 `reject`，拒絕時附 `reason` | `recordId`、`status`，值為「已確認」或「已拒絕」 |

查詢欄位限於 `forecast/productId`、`transfer/machineId`、`transfer/receiverId`、
`performance/hospitalId` 和 `performance/productId`。查詢結果由後端按公司和權限篩選，
關聯 ID 送出時再次查驗。三種紀錄都有 `id, label, date`。預估紀錄另有
`quantity, status, note`。跟刀業績另有 `hospital, quantity, amount`。
交接紀錄另有 `sender, receiver, status, note, canRespond`。

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
