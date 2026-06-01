// ⚠️ 請將下方的字串替換成你從 Google 試算表網址複製的 ID
const SPREADSHEET_ID = '你的Google試算表ID_填在這裡'; 

document.addEventListener("DOMContentLoaded", () => {
    const syncBtn = document.getElementById("sync-btn");
    
    // 初始化時自動載入資料
    loadTravelData();

    // 點擊手動同步按鈕
    if (syncBtn) {
        syncBtn.addEventListener("click", () => {
            syncBtn.textContent = "🔄 同步中...";
            loadTravelData(true);
        });
    }
});

// 主載入函式 (支援強制更新快取)
async function loadTravelData(forceRefresh = false) {
    const syncBtn = document.getElementById("sync-btn");
    console.log("🚀 [Sheets] 開始載入資料，目前的 SPREADSHEET_ID 爲:", SPREADSHEET_ID);

    // Google CSV 匯出網址
    const itineraryUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=itinerary`;
    const fleetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=fleet`;

    try {
        // 1. 抓取並渲染行程
        console.log("⏳ [Sheets] 正在請求行程資料 (itinerary)...");
        const itineraryData = await fetchCSV(itineraryUrl, 'itinerary_cache', forceRefresh);
        console.log("✅ [Sheets] 行程資料抓取成功，共", itineraryData.length, "筆:", itineraryData);
        renderItinerary(itineraryData);

        // 2. 抓取並渲染車隊
        console.log("⏳ [Sheets] 正在請求車隊資料 (fleet)...");
        const fleetData = await fetchCSV(fleetUrl, 'fleet_cache', forceRefresh);
        console.log("✅ [Sheets] 車隊資料抓取成功，共", fleetData.length, "筆:", fleetData);
        renderFleet(fleetData);

        if (syncBtn) syncBtn.textContent = "🔄 同步成功";
        setTimeout(() => { if (syncBtn) syncBtn.textContent = "🔄 同步資料"; }, 2000);

    } catch (error) {
        console.error("❌ [Sheets] 資料解析或連線失敗:", error);
        if (syncBtn) syncBtn.textContent = "❌ 同步失敗";
        
        // 離線防崩潰機制：嘗試從本地 LocalStorage 撈上一次成功的快取資料
        console.log("⚠️ [Sheets] 嘗試載入本地快取備份...");
        const oldItinerary = localStorage.getItem('itinerary_cache');
        const oldFleet = localStorage.getItem('fleet_cache');
        if (oldItinerary) renderItinerary(JSON.parse(oldItinerary));
        if (oldFleet) renderFleet(JSON.parse(oldFleet));
    }
}

// 通用 Fetch CSV 並轉成 JSON 陣列的函式 (修正跨平台換行相容性)
async function fetchCSV(url, cacheKey, forceRefresh) {
    // 如果不強制重新整理，且本地已有快取，就直接回傳快取
    if (!forceRefresh && localStorage.getItem(cacheKey)) {
        console.log(`📦 [Fetch] 偵測到 ${cacheKey} 的本地快取，直接啟用離線檢視`);
        return JSON.parse(localStorage.getItem(cacheKey));
    }

    const response = await fetch(url + `&cache_bust=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    
    const text = await response.text();
    
    // 使用正規表達式 /\r?\n/ 同時切開 Windows (\r\n) 與 Mac/Linux (\n) 的 CSV 換行
    const lines = text.split(/\r?\n/).map(line => {
        // 清理 Google CSV 匯出時可能夾帶的頭尾雙引號與空格
        return line.split(',').map(cell => cell.replace(/^"(.*)"$/, '$1').trim());
    });

    // 過濾掉完全空白的無效行
    const validLines = lines.filter(line => line.length > 0 && line[0] !== "");

    if (validLines.length === 0) {
        console.warn(`⚠️ [Fetch] 警告: 抓取的 CSV (${cacheKey}) 內容為空行`);
        return [];
    }

    // 將第一列欄位名稱全部轉小寫，當作 JSON 的 Key
    const headers = validLines[0].map(h => h.toLowerCase().trim());
    const result = [];

    // 從第二列開始解析實際資料
    for (let i = 1; i < validLines.length; i++) {
        let obj = {};
        headers.forEach((header, index) => {
            // 房呆機制：若對應欄位沒資料則給予空字串
            obj[header] = validLines[i][index] !== undefined ? validLines[i][index] : "";
        });
        result.push(obj);
    }

    // 寫入本地快取，供下次離線使用
    localStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
}

// 渲染行程表 UI
function renderItinerary(data) {
    const container = document.getElementById("tab-itinerary");
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = "<h2>📅 行程表目前沒有資料</h2><p>請檢查 Google Sheet 內 itinerary 分頁是否有確實填寫。</p>";
        return;
    }

    let html = `<h2>📅