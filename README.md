# 手機拍照記錄名片 MVP（React PWA + LIFF + GAS + Google Sheet/Drive）

此 repo 包含：

- `web/`：Vite + React + TypeScript PWA 前端（可嵌入 LINE LIFF）
- `gas/`：Google Apps Script Web App 後端（API）

## 1. 你要先準備的資源

1. Google Sheet（用來存名片欄位）
2. Google Drive 資料夾（用來存名片照片）
3. OpenAI API Key
4. 一組 API Token（自訂長字串）
5. LINE Developers Channel + LIFF App

### 如何找到 `SHEET_ID`

Google Sheet URL 範例：

`https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`

### 如何找到 `DRIVE_FOLDER_ID`

Google Drive 資料夾 URL 範例：

`https://drive.google.com/drive/folders/<DRIVE_FOLDER_ID>`

## 2. Apps Script 後端部署（/gas）

### 2.1 建立專案

1. 到 [Google Apps Script](https://script.google.com/)
2. 新增專案
3. 建立檔案 `Code.gs`、`OpenAI.gs`
4. 將本 repo 的 `/gas/Code.gs`、`/gas/OpenAI.gs` 內容貼上

### 2.2 設定 Script Properties

在 Apps Script 專案 `Project Settings -> Script Properties` 新增：

- `OPENAI_API_KEY`
- `SHEET_ID`
- `SHEET_TAB`（建議 `cards`）
- `DRIVE_FOLDER_ID`
- `API_TOKEN`

### 2.3 部署成 Web App

1. `Deploy -> New deployment`
2. Type 選 `Web app`
3. Execute as: `Me`
4. Who has access: `Anyone`
5. Deploy 後取得 `.../exec` URL（即前端 `VITE_API_BASE`）

## 3. 前端環境變數（/web）

建立 `web/.env`（可複製 `web/.env.example`）：

```env
VITE_API_BASE=https://script.googleusercontent.com/macros/echo?user_content_key=...&lib=...
VITE_API_POST_BASE=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec
VITE_API_TOKEN=replace_with_api_token
VITE_LIFF_ID=2000000000-xxxxxxxx
VITE_BASE_PATH=/
```

說明：

- `VITE_API_BASE`：給 `GET`（search/get）使用，可放 `script.googleusercontent.com` 最終 URL。
- `VITE_API_POST_BASE`：給 `POST`（add/update）使用，務必放 `script.google.com/.../exec`。

## 4. GitHub Pages 部署（建議正式使用）

本 repo 已提供 GitHub Actions：`/.github/workflows/deploy-web.yml`

### 4.1 設定 GitHub Secrets

在 repo Settings -> Secrets and variables -> Actions 新增：

- `VITE_API_BASE`
- `VITE_API_POST_BASE`
- `VITE_API_TOKEN`
- `VITE_LIFF_ID`

### 4.2 啟用 Pages

1. Repo Settings -> Pages
2. Source 選 `GitHub Actions`

### 4.3 觸發部署

推送到 `main` 後自動部署，拿到 Pages 網址：

`https://<username>.github.io/<repo>/`

## 5. LINE OA + LIFF 設定

目標：從 LINE 官方帳號點選按鈕，直接開啟你的名片系統。

### 5.1 建立 LIFF App

1. 到 [LINE Developers Console](https://developers.line.biz/)
2. 建立 Provider（若尚未有）
3. 建立 Channel（建議使用 Messaging API Channel）
4. 在 Channel 裡新增 LIFF App
5. Endpoint URL 設為你的 Pages 網址（例如 `https://<username>.github.io/<repo>/`）
6. 取得 LIFF ID，填入 `VITE_LIFF_ID`

### 5.2 在 LINE OA 放入口

在 LINE 官方帳號後台（Rich menu 或圖文選單）設定連結：

`https://liff.line.me/<LIFF_ID>`

使用者點擊後會在 LINE 內建瀏覽器開啟此系統。

## 6. API 路由（GAS）

使用 query 參數 `path`：

- `POST /exec?path=add`
- `GET /exec?path=search&q=&company=&tag=&from=&to=&sort=`
- `GET /exec?path=get&id=...`
- `POST /exec?path=update`

## 7. CORS 與傳輸策略

前端流程：

1. 優先嘗試 `fetch + X-API-TOKEN`
2. 若瀏覽器/GAS 發生跨網域限制，會自動 fallback 到 hidden iframe + `postMessage`

這是為了在手機瀏覽器與 LINE 內建瀏覽器都可穩定上傳與更新。

## 8. 本機開發（可選）

```bash
cd web
npm i
npm run dev -- --host
```

> 正式使用建議以 GitHub Pages + LIFF 進入，不依賴本機網址。

## 9. 功能對照

- 手機拍照：`<input accept="image/*" capture="environment">`
- 上傳前壓縮：JPEG，最大寬 `1500px`，quality `0.7`
- OpenAI Vision 固定 schema：`name/company/title/phone/email/address/website`
- 新增後可編輯並儲存（`add` -> `update`）
- 列表與進階搜尋：`q/company/tag/from/to/sort`
- 詳細頁可編輯 `tags/notes`，顯示 Drive 檔案 ID 與「在 Drive 開啟」
