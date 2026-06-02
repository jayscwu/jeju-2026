// ==========================================
// 濟州島自駕冒險 2026 - 萬能記帳與分帳系統核心 (expense.js)
// ⚠️ 已徹底移除重複的 SPREADSHEET_ID 宣告，修正 SyntaxError
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // 延遲 600ms 初始化，給 sheets.js 留出從網路抓取或讀取快取的緩衝時間
    setTimeout(() => {
        initExpenseTab();
    }, 600);
    
    // 綁定記帳表單提交事件
    const form = document.getElementById("expense-form");
    if (form) {
        form.addEventListener("submit", handleAddExpense);
    }
});

// 初始化記帳頁面 (安全防呆補償版)
function initExpenseTab() {
    const fleetData = JSON.parse(localStorage.getItem('fleet_cache')) || [];
    
    if (fleetData.length === 0) {
        console.log("⚠️ [Expense] 偵測到手機尚未建立車隊名單快取，啟用防呆空架構");
        const payerSelect = document.getElementById("exp-payer");
        if (payerSelect) {
            payerSelect.innerHTML = `<option value="">-- 請先點擊右上角[同步資料] --</option>`;
        }
        renderSplitOptions();
        renderExpenseList(); 
        return;
    }
    
    // 若已有快取名單，則執行標準初始化
    renderPayerOptions();
    renderSplitOptions();
    renderExpenseList();
}

// 供外部（如 sheets.js）名單更新成功後，跨檔案呼叫的公開介面
window.refreshPayerDropdown = function() {
    console.log("🔄 [Expense] 接收到來自 Sheets 的更新通知，執行安全刷新...");
    renderPayerOptions(); 
};

// 動態渲染「付款人」下拉選單 (點擊自主刷新防呆版)
function renderPayerOptions() {
    const payerSelect = document.getElementById("exp-payer");
    if (!payerSelect) return;
    
    // 當使用者「點擊/聚焦」這個下拉選單時，立刻強行再去讀取一次最新快取，解決非同步時間差
    payerSelect.addEventListener("focus", () => {
        const currentFleet = JSON.parse(localStorage.getItem('fleet_cache')) || [];
        if (currentFleet.length > 0) {
            console.log("⚡ [Expense] 偵測到使用者點擊選單，自主即時刷新人員名單！");
            rebuildPayerList(payerSelect, currentFleet);
        }
    });
    
    // 初始載入時的渲染
    const fleetData = JSON.parse(localStorage.getItem('fleet_cache')) || [];
    rebuildPayerList(payerSelect, fleetData);
}

// 建立名單 HTML 的輔助函式 (全自動欄位辨識防呆版)
function rebuildPayerList(selectElement, fleetData) {
    if (fleetData.length === 0) {
        selectElement.innerHTML = `<option value="">-- 請先點擊右上角[同步資料] --</option>`;
        return;
    }
    
    let html = '<option value="">-- 選擇付款人 --</option>';
    let memberCount = 0;

    fleetData.forEach(m => {
        // 萬能相容支援：自動嘗試抓取各種可能打錯的欄位名稱 (大小寫、空格或中文)
        let name = m.name || m.Name || m.NAME || m["name "] || m["姓名"] || "";
        let role = m.role || m.Role || m.ROLE || m["role "] || m["職稱"] || m["職務"] || "成員";
        
        // 去除頭尾可能不小心誤打的空白字元
        name = name.toString().trim();
        role = role.toString().trim();

        if (name && name !== "undefined" && name !== "") {
            html += `<option value="${name}">${name} (${role})</option>`;
            memberCount++;
        }
    });
    
    // 如果過濾完發現還是沒有效名單，顯示欄位錯誤提示
    if (memberCount === 0) {
        selectElement.innerHTML = `<option value="">-- 試算表欄位名稱不符，請檢查標題 --</option>`;
        return;
    }
    
    selectElement.innerHTML = html;
}

// 動態渲染「分攤對象」下拉選單
function renderSplitOptions() {
    const splitSelect = document.getElementById("exp-split-type");
    if (!splitSelect) return;
    
    splitSelect.innerHTML = `
        <option value="all">全員平分 (20人)</option>
        <option value="adult">僅限大人平分</option>
        <option value="car_1">第 1 號車成員平分</option>
        <option value="car_2">第 2 號車成員平分</option>
        <option value="car_3">第 3 號車成員平分</option>
        <option value="car_4">第 4 號車成員平分</option>
        <option value="car_5">第 5 號車成員平分</option>
        <option value="mountain">漢拏山登山組平分</option>
    `;
}

// 處理表單提交（含手機相機拍照與 Base64 轉換）
function handleAddExpense(e) {
    e.preventDefault(); 
    
    const title = document.getElementById("exp-title").value.trim();
    const amount = parseFloat(document.getElementById("exp-amount").value);
    const currency = document.getElementById("exp-currency").value;
    const payer = document.getElementById("exp-payer").value;
    const splitType = document.getElementById("exp-split-type").value;
    const receiptInput = document.getElementById("exp-receipt");
    
    if (!title || !amount || !payer) {
        alert("請填寫完整的品項、金額與付款人！");
        return;
    }

    const newExpense = {
        id: Date.now(), 
        title: title,
        amount: amount,
        currency: currency,
        payer: payer,
        splitType: splitType,
        date: new Date().toLocaleDateString(),
        receipt: "" 
    };

    if (receiptInput.files && receiptInput.files[0]) {
        const file = receiptInput.files[0];
        const reader = new FileReader();
        
        reader.onloadend = function() {
            newExpense.receipt = reader.result; 
            saveAndRefresh(newExpense);
        };
        reader.readAsDataURL(file); 
    } else {
        saveAndRefresh(newExpense); 
    }
}

// 儲存資料並刷新介面
function saveAndRefresh(newExpense) {
    const expenses = JSON.parse(localStorage.getItem("jeju_expenses")) || [];
    expenses.unshift(newExpense); 
    localStorage.setItem("jeju_expenses", JSON.stringify(expenses));
    
    document.getElementById("expense-form").reset();
    renderExpenseList();
}

// 渲染流水帳列表與驅動算帳引擎
function renderExpenseList() {
    const listContainer = document.getElementById("expense-list");
    const reportContainer = document.getElementById("expense-report");
    if (!listContainer || !reportContainer) return;

    const expenses = JSON.parse(localStorage.getItem("jeju_expenses")) || [];
    const fleetData = JSON.parse(localStorage.getItem('fleet_cache')) || [];

    if (expenses.length === 0) {
        listContainer.innerHTML = "<p style='color:#6b7280; text-align:center; padding: 20px 0;'>📊 目前尚無記帳紀錄，快去輸入第一筆吧！</p>";
        reportContainer.innerHTML = "<div class='report-box'><p style='color:#6b7280;'>等待記帳數據產生結算報告...</p></div>";
        return;
    }

    const TWD_TO_KRW = 42; 

    let listHtml = "";
    expenses.forEach(exp => {
        let originalPrice = `${exp.amount.toLocaleString()} ${exp.currency === "KRW" ? "₩" : "$"}`;
        let convertedPrice = exp.currency === "KRW" 
            ? `(約合 NT$ ${Math.round(exp.amount / TWD_TO_KRW).toLocaleString()})`
            : `(約合 ₩ ${Math.round(exp.amount * TWD_TO_KRW).toLocaleString()})`;

        let splitText = getSplitTypeText(exp.splitType);

        listHtml += `
            <div class="card expense-card">
                <div class="expense-main">
                    <div>
                        <div class="card-title">${exp.title}</div>
                        <div class="expense-meta">💰 付款人: <b>${exp.payer}</b> | 分攤: <span class="badge badge-all">${splitText}</span></div>
                        <div style="font-size:12px; color:#9ca3af; margin-top:2px;">⏱️ ${exp.date}</div>
                    </div>
                    <div class="expense-amount-box">
                        <div class="exp-price">${originalPrice}</div>
                        <div class="exp-sub-price">${convertedPrice}</div>
                    </div>
                </div>
                ${exp.receipt ? `
                    <div class="receipt-preview-box">
                        <button type="button" class="btn-view-receipt" onclick="toggleReceipt('${exp.id}')">🧾 查看收據照片</button>
                        <img id="img-${exp.id}" src="${exp.receipt}" class="receipt-img hidden" alt="發票收據">
                    </div>
                ` : ''}
            </div>
        `;
    });
    listContainer.innerHTML = listHtml;

    calculateDebts(expenses, fleetData, reportContainer);
}

function getSplitTypeText(type) {
    const map = {
        all: "全員平分", adult: "僅限大人",
        car_1: "1號車平分", car_2: "2號車平分", car_3: "3號車平分", car_4: "4號車平分", car_5: "5號車平分",
        mountain: "漢拏山組"
    };
    return map[type] || "自訂分攤";
}

window.toggleReceipt = function(id) {
    const img = document.getElementById(`img-${id}`);
    if (img) img.classList.toggle("hidden");
};

function calculateDebts(expenses, fleet, reportContainer) {
    if (fleet.length === 0) {
        reportContainer.innerHTML = `
            <div class='report-box'>
                <p style='color:#ef4444;'>⚠️ 偵測到手機尚未同步成員名單。</p>
            </div>`;
        return;
    }

    const TWD_TO_KRW = 42;
    const balances = {};
    
    fleet.forEach(m => {
        let name = m.name || m.Name || m.NAME || m["name "] || m["姓名"] || "";
        name = name.toString().trim();
        if(name) balances[name] = 0;
    });

    expenses.forEach(exp => {
        let amountInKRW = exp.currency === "TWD" ? exp.amount * TWD_TO_KRW : exp.amount;
        
        if (balances[exp.payer] !== undefined) {
            balances[exp.payer] += amountInKRW;
        }

        let targetMembers = [];
        if (exp.splitType === "all") {
            targetMembers = fleet;
        } else if (exp.splitType === "adult") {
            targetMembers = fleet.filter(m => {
                let type = m.type || m.Type || m["身分"] || m["類型"] || "";
                return type.toString().trim() !== "小孩";
            });
        } else if (exp.splitType.startsWith("car_")) {
            const carNo = exp.splitType.split("_")[1];
            targetMembers = fleet.filter(m => {
                let cNo = m.car_no || m.Car_no || m["car_no "] || m["車號"] || "";
                return cNo.toString().trim() === carNo;
            });
        } else if (exp.splitType === "mountain") {
            targetMembers = fleet.filter(m => {
                let cNo = m.car_no || m.Car_no || m["car_no "] || m["車號"] || "";
                cNo = cNo.toString().trim();
                return cNo === "1" || cNo === "2";
            });
        }

        if (targetMembers.length === 0) targetMembers = fleet;

        let perShare = amountInKRW / targetMembers.length;
        targetMembers.forEach(m => {
            let name = m.name || m.Name || m.NAME || m["name "] || m["姓名"] || "";
            name = name.toString().trim();
            if (name && balances[name] !== undefined) {
                balances[name] -= perShare; 
            }
        });
    });

    let creditors = [];
    let debtors = [];

    Object.keys(balances).forEach(name => {
        let bal = balances[name];
        if (bal > 1) { 
            creditors.push({ name, amount: bal });
        } else if (bal < -1) {
            debtors.push({ name, amount: -bal });
        }
    });

    let reportHtml = `<h3>📊 最佳化結算方案 (統一以韓元結算)</h3><div class="report-box">`;
    let c = 0, d = 0;
    let hasTransactions = false;

    while (c < creditors.length && d < debtors.length) {
        let creditor = creditors[c];
        let debtor = debtors[d];
        
        let amount = Math.min(creditor.amount, debtor.amount);
        if (amount > 10) { 
            hasTransactions = true;
            let twdEst = Math.round(amount / TWD_TO_KRW);
            reportHtml += `
                <div class="report-row">
                    💸 <b>${debtor.name}</b> ➡️ 應給 <b>${creditor.name}</b>：
                    <span class="text-krw">₩ ${Math.round(amount).toLocaleString()}</span> 
                    <small style="color:#6b7280">(約 NT$ ${twdEst})</small>
                </div>`;
        }

        creditor.amount -= amount;
        debtor.amount -= amount;

        if (creditor.amount <= 1) c++;
        if (debtor.amount <= 1) d++;
    }

    if (!hasTransactions) {
        reportHtml += `<p style='color:#10b981; text-align:center;'>🎉 目前帳務完美平衡，大家都互不相欠囉！</p>`;
    }

    reportHtml += `</div><button type="button" class="btn-clear-all" onclick="clearAllExpenses()">🧹 清空所有帳目(重設)</button>`;
    reportContainer.innerHTML = reportHtml;
}

window.clearAllExpenses = function() {
    if (confirm("確定要清空這趟旅程的所有記帳紀錄嗎？此動作無法復原！")) {
        localStorage.removeItem("jeju_expenses");
        renderExpenseList();
    }
};