# 2026 濟州島旅遊 Web App

這是一個可部署到 GitHub Pages 的純前端 PWA，資料來源為 Google Sheet。

## 功能

- 密碼解鎖：輸入 `0808` 後進入 App。
- 登入者選擇：登入時選擇團員，登入後會顯示登入者名稱。
- 登出：主畫面右上角可登出並回到登入頁。
- PWA：支援 iOS Safari「加入主畫面」與 Android Chrome「安裝應用程式」。
- Google Sheet 資料：透過 Google Visualization JSONP 讀取 `itinerary`、`fleet`、`hotel` 分頁。
- 主畫面：公告、每日行程、車隊、重要記事。
- 每日行程：可用日期按鈕切換每天行程。
- 車隊：依車隊分組，並標示目前登入者。
- 同步資訊：頁首低調顯示最新資料同步時間。

## Google Sheet 欄位

目前程式使用的分頁設定在 `app.js` 的 `SOURCES`：

```js
const SOURCES = {
  itinerary: "itinerary",
  fleet: "fleet",
  notice: "hotel",
  notes: "hotel",
};
```

`itinerary` 建議欄位：

```text
date, time, title, location, group, memo
```

`fleet` 建議欄位：

```text
car_no, role, name, type1, type2, type3
```

公告與重要記事目前先讀取 `hotel` 分頁。若之後新增 `notice` 或 `notes` 分頁，只要把 `app.js` 內的 `SOURCES.notice`、`SOURCES.notes` 改成新的分頁名稱即可。

## 本機測試

在 PowerShell 進入專案資料夾後執行：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start-server.ps1
```

看到以下文字代表啟動成功：

```text
Jeju 2026 Web App server is running:
http://127.0.0.1:4173/
```

保持 PowerShell 視窗開啟，並用瀏覽器開啟：

```text
http://127.0.0.1:4173/
```

## GitHub Pages 部署

1. 建立 GitHub repository。
2. 上傳本專案所有檔案。
3. 到 GitHub repository 的 `Settings`。
4. 進入 `Pages`。
5. `Source` 選擇 `Deploy from a branch`。
6. Branch 選擇 `main`，資料夾選擇 `/root`。
7. 儲存後等待 GitHub 產生 Pages 網址。

## 手機安裝

iPhone：

1. 用 Safari 開啟 GitHub Pages 網址。
2. 點分享按鈕。
3. 選擇「加入主畫面」。

Android：

1. 用 Chrome 開啟 GitHub Pages 網址。
2. 點選右上選單。
3. 選擇「安裝應用程式」或「新增至主畫面」。

## 注意

Google Sheet 需要設定為「知道連結的任何人可檢視」，前端才可以直接讀取資料。
