// ⚠️ 請將下方的字串替換成你剛剛複製的 Google 試算表 ID
const SPREADSHEET_ID = '16uPrVxpsC4TAQRvTiT566ekZ4M4BqKv92ztU06_KLGw'; 

document.addEventListener("DOMContentLoaded", () => {
    const syncBtn = document.getElementById("sync-btn");
    
    // 初始化時自動載入資料
    loadTravelData();

    // 點擊手動同步按鈕
    syncBtn.addEventListener("click", () => {
        syncBtn.textContent = "🔄 同步中...";
        loadTravelData(true);
    });
});

// 主載入函式 (支援強制更新快取)
async function loadTravelData(forceRefresh = false) {
    const syncBtn = document.getElementById("sync-btn");
    
    // CSV 匯出網址
    const itineraryUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=itinerary`;
    const fleetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=fleet`;

    try {
        // 1. 抓取並渲染行程
        const itineraryData = await fetchCSV(itineraryUrl, 'itinerary_cache', forceRefresh);
        renderItinerary(itineraryData);

        // 2. 抓取並渲染車隊
        const fleetData = await fetchCSV(fleetUrl, 'fleet_cache', forceRefresh);
        renderFleet(fleetData);

        if(syncBtn) syncBtn.textContent = "🔄 同步成功";
        setTimeout(() => { if(syncBtn) syncBtn.textContent = "🔄 同步資料"; }, 2000);

    } catch (error) {
        console.error("資料載入失敗", error);
        if(syncBtn) syncBtn.textContent = "❌ 同步失敗";
        
        // 嘗試從本地 LocalStorage 撈舊資料防崩潰 (離線支援)
        const oldItinerary = localStorage.getItem('itinerary_cache');
        const oldFleet = localStorage.getItem('fleet_cache');
        if(oldItinerary) renderItinerary(JSON.parse(oldItinerary));
        if(oldFleet) renderFleet(JSON.parse(oldFleet));
    }
}

// 通用 Fetch CSV 並轉成 JSON 陣列的函式
async function fetchCSV(url, cacheKey, forceRefresh) {
    if (!forceRefresh && localStorage.getItem(cacheKey)) {
        return JSON.parse(localStorage.getItem(cacheKey));
    }

    const response = await fetch(url + `&cache_bust=${Date.now()}`);
    const text = await response.text();
    
    // 解析 CSV 文字成 JSON
    const lines = text.split('\n').map(line => {
        // 清理 Google CSV 匯出可能帶有的引號
        return line.split(',').map(cell => cell.replace(/^"(.*)"$/, '$1').trim());
    });

    const headers = lines[0];
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i][0]) continue; // 跳過空行
        let obj = {};
        headers.forEach((header, index) => {
            obj[header.toLowerCase()] = lines[i][index] || "";
        });
        result.push(obj);
    }

    // 存入 LocalStorage 做本地備份 (離線檢視用)
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
        // 如果是新的一天，印出日期大標題
        if (item.date !== currentTempDate) {
            currentTempDate = item.date;
            html += `<div class="date-header">📍 ${item.date}</div>`;
        }

        // 根據分組給予不同的視覺標籤
        let groupBadge = `<span class="badge badge-all">${item.group}</span>`;
        if (item.group.includes("漢拏山")) groupBadge = `<span class="badge badge-mountain">${item.group}</span>`;
        if (item.group.includes("休閒")) groupBadge = `<span class="badge badge-relax">${item.group}</span>`;

        html += `
            <div class="card">
                <div class="card-time">${item.time} ${groupBadge}</div>
                <div class="card-title">${item.title}</div>
                <div class="card-location">📍 ${item.location}</div>
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

    // 依據車號分組
    const cars = {};
    data.forEach(item => {
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
                        <span class="member-name">${member.name} ${isChild ? '👶' : ''}</span>
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