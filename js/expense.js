// ==========================================
// 濟州島自駕冒險 2026 - 萬能記帳與分帳系統核心 (expense.js)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // 延遲 500ms 初始化，確保從 Google Sheet 抓過來的車隊名單快取已經穩定
    setTimeout(() => {
        initExpenseTab();
    }, 500);
    
    // 綁定記帳表單提交事件
    const form = document.getElementById("expense-form");
    if (form) {
        form.addEventListener("submit", handleAddExpense);
    }
});

// 初始化記帳頁面
function initExpenseTab() {
    renderPayerOptions();
    renderSplitOptions();
    renderExpenseList();
}

// 供外部（如 sheets.js）名單同步成功後，公開呼叫更新付款人選單的防呆機制
window.renderPayerOptions = function() {
    renderPayerOptions();
};

// 【步驟一延伸】從手機快取名單撈出「付款人」下拉選單選項
function renderPayerOptions() {
    const payerSelect = document.getElementById("exp-payer");
    if (!payerSelect) return;
    
    const fleetData = JSON.parse(localStorage.getItem('fleet_cache')) || [];
    if (fleetData.length === 0) {
        payerSelect.innerHTML = `<option value="">--請先至車隊頁面同步名單--</option>`;
        return;
    }
    
    let html = '<option value="">-- 選擇付款人 --</option>';
    fleetData.forEach(m => {
        if(m.name) {
            html += `<option value="${m.name}">${m.name} (${m.role || '成員'})</option>`;
        }
    });
    payerSelect.innerHTML = html;
}

// 動態渲染分攤對象選項
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

// 【步驟三】處理新增記帳（包含手機相機拍照與 Base64 轉換）
function handleAddExpense(e) {
    e.preventDefault(); // 阻止網頁重整
    
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

    // 【步驟一】建立標準資料結構物件
    const newExpense = {
        id: Date.now(), // 唯一識別碼
        title: title,
        amount: amount,
        currency: currency,
        payer: payer,
        splitType: splitType,
        date: new Date().toLocaleDateString(),
        receipt: "" // 預設無照片
    };

    // 處理收據相片讀取
    if (receiptInput.files && receiptInput.files[0]) {
        const file = receiptInput.files[0];
        const reader = new FileReader();
        
        // 圖片讀取完成後，注入 Base64 字串並儲存
        reader.onloadend = function() {
            newExpense.receipt = reader.result; 
            saveAndRefresh(newExpense);
        };
        reader.readAsDataURL(file); // 執行讀取
    } else {
        saveAndRefresh(newExpense); // 無相片直接儲存
    }
}

// 核心儲存與畫面重整控制
function saveAndRefresh(newExpense) {
    const expenses = JSON.parse(localStorage.getItem("jeju_expenses")) || [];
    expenses.unshift(newExpense); // 讓新項目顯示在流水帳最上方
    localStorage.setItem("jeju_expenses", JSON.stringify(expenses));
    
    // 重設 HTML 表單欄位
    document.getElementById("expense-form").reset();
    
    // 重新渲染列表與計算結算
    renderExpenseList();
}

// 渲染流水帳列表與呼叫分帳引擎
function renderExpenseList() {
    const listContainer = document.getElementById("expense-list");
    const reportContainer = document.getElementById("expense-report");
    if (!listContainer || !reportContainer) return;

    const expenses = JSON.parse(localStorage.getItem("jeju_expenses")) || [];
    const fleetData = JSON.parse(localStorage.getItem('fleet_cache')) || [];

    if (expenses.length === 0) {
        listContainer.innerHTML = "<p style='color:#6b7280; text-align:center;'>📊 目前尚無記帳紀錄，快去輸入第一筆吧！</p>";
        reportContainer.innerHTML = "<p style='color:#6b7280;'>等待記帳數據產生結算報告...</p>";
        return;
    }

    // 2026年 旅遊即時雙幣別匯率基準 (1 台幣 ≒ 42 韓元)
    const TWD_TO_KRW = 42; 

    // 1. 渲染消費流水帳明細
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

    // 2. 【步驟二】驅動核心分帳最佳化矩陣算帳
    calculateDebts(expenses, fleetData, reportContainer);
}

// 輔助翻譯中文標籤
function getSplitTypeText(type) {
    const map = {
        all: "全員平分", adult: "僅限大人",
        car_1: "1號車平分", car_2: "2號車平分", car_3: "3號車平分", car_4: "4號車平分", car_5: "5號車平分",
        mountain: "漢拏山組"
    };
    return map[type] || "自訂分攤";
}

// 點擊看照片隱藏切換
window.toggleReceipt = function(id) {
    const img = document.getElementById(`img-${id}`);
    if (img) img.classList.toggle("hidden");
};

// 【步驟二】核心分帳最佳化清償路徑演算法 (雙指針貪婪對沖)
function calculateDebts(expenses, fleet, reportContainer) {
    if (fleet.length === 0) {
        reportContainer.innerHTML = "<p style='color:#ef4444;'>⚠️ 請先至車隊頁面同步成員名單，才能計算結算報告。</p>";
        return;
    }

    const TWD_TO_KRW = 42;
    
    // 初始化每個人在記帳模組中的收支平衡淨值 (Balance)
    const balances = {};
    fleet.forEach(m => {
        if(m.name) balances[m.name] = 0;
    });

    // 掃描流水帳，權重分拆
    expenses.forEach(exp => {
        let amountInKRW = exp.currency === "TWD" ? exp.amount * TWD_TO_KRW : exp.amount;
        
        // 代墊人賺回此金額 (資產淨值增加)
        if (balances[exp.payer] !== undefined) {
            balances[exp.payer] += amountInKRW;
        }

        // 過濾找出需要平攤此消費的目標人員
        let targetMembers = [];
        if (exp.splitType === "all") {
            targetMembers = fleet;
        } else if (exp.splitType === "adult") {
            targetMembers = fleet.filter(m => m.type !== "小孩");
        } else if (exp.splitType.startsWith("car_")) {
            const carNo = exp.splitType.split("_")[1];
            targetMembers = fleet.filter(m => m.car_no === carNo);
        } else if (exp.splitType === "mountain") {
            // 漢拏山組：默認由 1 號車和 2 號車（包含登山人員與支援車隊）共同承擔
            targetMembers = fleet.filter(m => m.car_no === "1" || m.car_no === "2");
        }

        if (targetMembers.length === 0) targetMembers = fleet; // 房防呆

        // 扣除每個人自己應承擔的份額
        let perShare = amountInKRW / targetMembers.length;
        targetMembers.forEach(m => {
            if (m.name && balances[m.name] !== undefined) {
                balances[m.name] -= perShare; 
            }
        });
    });

    // 將所有人拆入「正值(債權)陣營」與「負值(債務)陣營」
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

    // 進行雙陣營對沖
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

// 全域清空紀錄
window.clearAllExpenses = function() {
    if (confirm("確定要清空這趟旅程的所有記帳紀錄嗎？此動作無法復原！")) {
        localStorage.removeItem("jeju_expenses");
        renderExpenseList();
    }
};