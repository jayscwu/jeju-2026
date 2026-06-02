// ⚠️ 請確保此處為您正確的 Google 試算表 ID
const SPREADSHEET_ID = '16uPrVxpsC4TAQRvTiT566ekZ4M4BqKv92ztU06_KLGw'; // 👈 請換成您實際的 ID

document.addEventListener("DOMContentLoaded", () => {
    const syncBtn = document.getElementById("sync-btn");
    
    // 延遲 500ms 載入，確保 DOM 完全穩定
    setTimeout(() => {
        loadTravelData();
    }, 500);

    if (syncBtn) {
        syncBtn.addEventListener("click", () => {
            syncBtn.textContent = "🔄 同步中...";
            loadTravelData(true);
        });
    }
});

async function loadTravelData(forceRefresh = false) {
    const syncBtn = document.getElementById("sync-btn");
    const itineraryContainer = document.getElementById("tab-itinerary");

    const itineraryUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=itinerary`;
    const fleetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=fleet`;

    try {
        // 1. 抓取行程資料
        const itineraryData = await fetchGoogleSheet(itineraryUrl, 'itinerary_cache', forceRefresh);
        renderItinerary(itineraryData);

        // 2. 抓取車隊資料
        const fleetData = await fetchGoogleSheet(fleetUrl, 'fleet_cache', forceRefresh);
        renderFleet(fleetData);

        if (syncBtn) syncBtn.textContent = "🔄 同步成功";
        setTimeout(() => { if (syncBtn) syncBtn.textContent = "🔄 同步資料"; }, 2000);

    } catch (error) {
        console.error("❌ 載入失敗:", error);
        if (syncBtn) syncBtn.textContent = "❌ 同步失敗";
        
        if (itineraryContainer) {
            itineraryContainer.innerHTML = `
                <div class="card" style="border-left: 5px solid #ef4444; background: #fee2e2;">
                    <h3 style="color:#b91c1c;">❌ 資料載入發生錯誤</h3>
                    <p style="font-size:13px; color:#7f1d1d; margin-top:5px;">錯誤原因: ${error.message}</p>
                </div>
            `;
        }

        // 嘗試讀取快取
        const oldItinerary = localStorage.getItem('itinerary_cache');
        const oldFleet = localStorage.getItem('fleet_cache');
        if (oldItinerary) renderItinerary(JSON.parse(oldItinerary));
        if (oldFleet) renderFleet(JSON.parse(oldFleet));
    }
}

// 解析 Google Sheet JSON 格式的函式
async function fetchGoogleSheet(url, cacheKey, forceRefresh) {
    if (!forceRefresh && localStorage.getItem(cacheKey)) {
        return JSON.parse(localStorage.getItem(cacheKey));
    }

    const response = await fetch(url + `&cb=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    
    const responseText = await response.text();
    
    const jsonMatch = responseText.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);/);
    if (!jsonMatch) throw new Error("無法解析 Google Sheet 回傳的資料結構");
    
    const jsonObj = JSON.parse(jsonMatch[1]);
    const table = jsonObj.table;
    
    const headers = table.cols.map(col => (col.label ? col.label.toLowerCase().trim() : ''));
    const result = [];
    
    table.rows.forEach(row => {
        let obj = {};
        headers.forEach((header, index) => {
            if (!header) return;
            const cell = row.c[index];
            obj[header] = cell ? (cell.f || cell.v || "") : "";
        });
        if (obj[headers[0]]) {
            result.push(obj);
        }
    });

    localStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
}

// 渲染行程表 UI
function renderItinerary(data) {
    const container = document.getElementById("tab-itinerary");
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = "<h2>📅 行程表目前沒有資料</h2>";
        return;
    }

    let html = `<h2>📅 每日行程規劃</h2>`;
    let currentTempDate = "";

    data.forEach(item => {
        if (item.date !== currentTempDate) {
            currentTempDate = item.date;
            html += `<div class="date-header">📍 ${item.date}</div>`;
        }

        let groupText = item.group || "全員";
        let groupBadge = `<span class="badge badge-all">${groupText}</span>`;
        if (groupText.includes("漢拏山")) groupBadge = `<span class="badge badge-mountain">${groupText}</span>`;
        if (groupText.includes("休閒")) groupBadge = `<span class="badge badge-relax">${groupText}</span>`;

        html += `
            <div class="card">
                <div class="card-time">${item.time || "未定"} ${groupBadge}</div>
                <div class="card-title">${item.title || "無主題"}</div>
                <div class="card-location">📍 ${item.location || "未定"}</div>
                ${item.memo ? `<div class="card-memo">📝 ${item.memo}</div>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

// 渲染車隊名單 UI
function renderFleet(data) {
    const container = document.getElementById("tab-fleet");
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = "<h2>🚗 車隊名單目前沒有資料</h2>";
        return;
    }

    const cars = {};
    data.forEach(item => {
        if (!item.car_no) return;
        if (!cars[item.car_no]) cars[item.car_no] = [];
        cars[item.car_no].push(item);
    });

    let html = `<h2>🚗 車隊編組名單</h2>`;

    Object.keys(cars).sort().forEach(carNo => {
        html += `<div class="car-section"><h3>🚘 第 ${carNo} 號車</h3>`;
        cars[carNo].forEach(member => {
            const isLeader = member.role === "車長";
            const isChild = member.type === "小孩";
            html += `
                <div class="member-row ${isLeader ? 'leader' : ''}">
                    <div class="member-info">
                        <span class="member-role">${isLeader ? '😎 車長' : '👤 乘客'}</span>
                        <span class="member-name">${member.name || "未命名"} ${isChild ? '👶' : ''}</span>
                    </div>
                    <div class="member-contact">
                        ${member.phone ? `<a href="tel:${member.phone}" class="btn-call">📞 撥打</a>` : ''}
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    });

    container.innerHTML = html;
}