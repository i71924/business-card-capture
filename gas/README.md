# GAS 後端檔案

將此資料夾的檔案貼到 Google Apps Script 專案中：

- `Code.gs`
- `OpenAI.gs`
- `appsscript.json`（選用，可用 clasp 推送）

## Router 規則

Web App 使用 `?path=` 作為路由：

- `POST .../exec?path=add`
- `GET .../exec?path=search`
- `GET .../exec?path=get&id=...`
- `POST .../exec?path=update`

前端 fallback transport（處理 CORS）：

- 可加 `transport=postmessage&callback_id=...`
- GAS 會回傳可嵌入 iframe 的 HTML，並用 `window.postMessage` 把 JSON 結果送回前端

## Script Properties

必填：

- `OPENAI_API_KEY`
- `SHEET_ID`
- `SHEET_TAB`（可省略，預設 `cards`）
- `DRIVE_FOLDER_ID`
- `API_TOKEN`

## 驗證

API token 會以 `X-API-TOKEN` 比對 `API_TOKEN`。
