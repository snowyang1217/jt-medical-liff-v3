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
