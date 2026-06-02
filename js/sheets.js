// ==========================================
// 濟州島自駕冒險 2026 - Google Sheet 資料同步核心 (sheets.js)
// ==========================================

// ⚠️ 請確保此處為您正確的 Google 試算表 ID
const SPREADSHEET_ID = '16uPrVxpsC4TAQRvTiT566ekZ4M4BqKv92ztU06_KLGw'; // 👈 請換成您實際的 ID

document.addEventListener("DOMContentLoaded", () => {
    const syncBtn = document.getElementById("sync-btn");
    
    // 延遲 500ms 載入，確保前端 DOM 樹完全穩定
    setTimeout(() => {
        loadTravelData();
    }, 500);

    if (syncBtn) {
        syncBtn.addEventListener("click", () => {
            syncBtn.textContent = "🔄 同步中...";
            loadTravelData(true); // 傳入 true 代表強制刷新網路資料，不讀取本地快取
        });
    }
});

// 主載入與快取控制函式
async function loadTravelData(forceRefresh = false) {
    const syncBtn = document.getElementById("sync-btn");
    const itineraryContainer = document.getElementById("tab-itinerary");

    // 建立 Google Visualization API 的 JSON 請求網址
    const itineraryUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=itinerary`;
    const fleetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=fleet`;

    try {
        // 1. 抓取並渲染「行程資料」
        console.log("⏳ [Sheets] 正在請求 Google 行程資料...");
        const itineraryData = await fetchGoogleSheet(itineraryUrl, 'itinerary_cache', forceRefresh);
        console.log("✅ [Sheets] 行程資料解析成功:", itineraryData);
        renderItinerary(itineraryData);

        // 2. 抓取並渲染「車隊名單資料」
        console.log("⏳ [Sheets] 正在請求 Google 車隊資料...");
        const fleetData = await fetchGoogleSheet(fleetUrl, 'fleet_cache', forceRefresh);
        console.log("✅ [Sheets] 車隊資料解析成功:", fleetData);
        renderFleet(fleetData);

        // 成功後的按鈕動畫回饋
        if (syncBtn) syncBtn.textContent = "🔄 同步成功";
        setTimeout(() => { if (syncBtn) syncBtn.textContent = "🔄 同步資料"; }, 2000);

    } catch (error) {
        console.error("❌ [Sheets] 資料載入或解析失敗:", error);
        if (syncBtn) syncBtn.textContent = "❌ 同步失敗";
        
        // 前端安全報警網頁渲染 (方便手機 Debug)
        if (itineraryContainer) {
            itineraryContainer.innerHTML = `
                <div class="card" style="border-left: 5px solid #ef4444; background: #fee2e2; padding: 15px;">
                    <h3 style="color:#b91c1c; margin-bottom:5px;">❌ 資料載入發生錯誤</h3>
                    <p style="font-size:13px; color:#7f1d1d;">錯誤原因: ${error.message}</p>
                    <p style="font-size:12px; color:#4b5563; margin-top:5px;">App 已自動啟用上一次成功的離線快取資料。</p>
                </div>
            `;
        }

        // 離線防護機制：從本地 LocalStorage 撈上一次成功的快取歷史
        const oldItinerary = localStorage.getItem('itinerary_cache');
        const oldFleet = localStorage.getItem('fleet_cache');
        if (oldItinerary) renderItinerary(JSON.parse(oldItinerary));
        if (oldFleet) renderFleet(JSON.parse(oldFleet));
    }
}

// 萬能網路請求與 Google JSON 解碼核心函式
async function fetchGoogleSheet(url, cacheKey, forceRefresh) {
    // 如果不需要強制更新，且手機原本就有快取，直接回傳快取 (極速開啟與離線支援)
    if (!forceRefresh && localStorage.getItem(cacheKey)) {
        console.log(`📦 [Sheets] 偵測到 ${cacheKey} 本地快取，已直接啟用離線模式。`);
        return JSON.parse(localStorage.getItem(cacheKey));
    }

    // 加上時間戳記避開瀏覽器緩存，強迫跟 Google 伺服器拿最新資料
    const response = await fetch(url + `&cb=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    
    const responseText = await response.text();
    
    // 用正規表達式切出 Google 包裹在 Query.setResponse() 內的純 JSON 結構
    const jsonMatch = responseText.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);/);
    if (!jsonMatch) throw new Error("無法解析 Google Sheet 回傳的 Query 資料結構");
    
    const jsonObj = JSON.parse(jsonMatch[1]);
    const table = jsonObj.table;
    
    // 提取欄位名稱並強制轉小寫去除頭尾空白
    const headers = table.cols.map(col => (col.label ? col.label.toLowerCase().trim() : ''));
    const result = [];
    
    // 橫向橫掃解析每列資料
    table.rows.forEach(row => {
        let obj = {};
        headers.forEach((header, index) => {
            if (!header) return;
            const cell = row.c[index];
            // Google Sheet 的儲存格格式數值存在 v 或 f
            obj[header] = cell ? (cell.f || cell.v || "") : "";
        });
        // 防呆：只要這一列的第一個欄位有資料，就判定為有效列
        if (obj[headers[0]]) {
            result.push(obj);
        }
    });

    // 解析成功，同步更新本地 LocalStorage 離線空間
    localStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
}

// 渲染「行程表」前端 UI 介面
function renderItinerary(data) {
    const container = document.getElementById("tab-itinerary");
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = "<h2>📅 行程表目前沒有資料</h2><p>請確認您的試算表 itinerary 分頁是否有內容。</p>";
        return;
    }

    let html = `<h2>📅 每日行程規劃</h2>`;
    let currentTempDate = "";

    data.forEach(item => {
        // 自動判斷並插入日期大標題
        let dateVal = item.date || "未定日期";
        if (dateVal !== currentTempDate) {
            currentTempDate = dateVal;
            html += `<div class="date-header">📍 ${dateVal}</div>`;
        }

        let groupText = item.group || "全員";
        let groupBadge = `<span class="badge badge-all">${groupText}</span>`;
        if (groupText.includes("漢拏山")) groupBadge = `<span class="badge badge-mountain">${groupText}</span>`;
        if (groupText.includes("休閒")) groupBadge = `<span class="badge badge-relax">${groupText}</span>`;

        html += `
            <div class="card">
                <div class="card-time">${item.time || "時間未定"} ${groupBadge}</div>
                <div class="card-title">${item.title || "無主題"}</div>
                <div class="card-location">📍 ${item.location || "未定"}</div>
                ${item.memo ? `<div class="card-memo">📝 ${item.memo}</div>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

// 渲染「車隊名單」前端 UI 介面
function renderFleet(data) {
    const container = document.getElementById("tab-fleet");
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = "<h2>🚗 車隊名單目前沒有資料</h2><p>請確認您的試算表 fleet 分頁是否有內容。</p>";
        return;
    }

    // 依據車號進行分類分組
    const cars = {};
    data.forEach(item => {
        let carNo = item.car_no || item.car_no || "";
        carNo = carNo.toString().trim();
        if (!carNo) return;
        
        if (!cars[carNo]) cars[carNo] = [];
        cars[carNo].push(item);
    });

    let html = `<h2>🚗 車隊編組名單</h2>`;

    // 依據車子號碼排序印出卡片
    Object.keys(cars).sort().forEach(carNo => {
        html += `<div class="car-section"><h3>🚘 第 ${carNo} 號車</h3>`;
        
        cars[carNo].forEach(member => {
            // 自動相容欄位提取
            let name = member.name || member.name || "未命名";
            let role = member.role || member.role || "乘客";
            let type = member.type || member.type || "大人";
            let phone = member.phone || member.phone || "";

            const isLeader = role.trim() === "車長";
            const isChild = type.trim() === "小孩";
            
            html += `
                <div class="member-row ${isLeader ? 'leader' : ''}">
                    <div class="member-info">
                        <span class="member-role">${isLeader ? '😎 車長' : '👤 乘客'}</span>
                        <span class="member-name">${name} ${isChild ? '👶' : ''}</span>
                    </div>
                    <div class="member-contact">
                        ${phone ? `<a href="tel:${phone}" class="btn-call">📞 撥打</a>` : ''}
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    });

    container.innerHTML = html;

    // ✨【安全非同步閉合點】：名單渲染成功後，主動去喚醒新窗口名字，且不再造成死循環！
    if (typeof window.refreshPayerDropdown === "function") {
        console.log("🔗 [Sheets] 車隊名單渲染完成，正在安全傳遞通知至記帳模組...");
        window.refreshPayerDropdown();
    }
}