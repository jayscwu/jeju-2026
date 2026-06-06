const SHEET_ID = "16uPrVxpsC4TAQRvTiT566ekZ4M4BqKv92ztU06_KLGw";
const PASSWORD = "0808";
const APP_VERSION = "v1.7.3";
const SOURCES = {
  itinerary: "itinerary",
  fleet: "fleet",
  notice: "Note",
  notes: "Data",
};

const FALLBACK_TRAVELERS = [
  "雅晴",
  "阿飛",
  "貝",
  "凱哥",
  "士榤",
  "淑真",
  "茗程",
  "泡泡",
  "巧奇",
  "BOBO",
  "BEBE",
  "昱宏",
  "阿笑",
  "中良",
  "Ruby",
];

const state = {
  activeView: "noticeView",
  selectedDate: "",
  currentUser: "",
  noteQuery: "",
  noticeHeroDismissed: sessionStorage.getItem("jejuNoticeHeroDismissed") === "true",
  itinerary: [],
  fleet: [],
  notice: [],
  notes: [],
};

const pinnedNoteKeys = new Set(JSON.parse(localStorage.getItem("jejuPinnedNotes") || "[]"));
const unpinnedNoteKeys = new Set(JSON.parse(localStorage.getItem("jejuUnpinnedNotes") || "[]"));

const els = {
  lockScreen: document.querySelector("#lockScreen"),
  mainApp: document.querySelector("#mainApp"),
  form: document.querySelector("#passwordForm"),
  travelerInput: document.querySelector("#travelerInput"),
  selectedTraveler: document.querySelector("#selectedTraveler"),
  travelerGrid: document.querySelector("#travelerGrid"),
  passwordInput: document.querySelector("#passwordInput"),
  passwordToggle: document.querySelector("#passwordToggle"),
  passwordHint: document.querySelector("#passwordHint"),
  pageTitle: document.querySelector("#pageTitle"),
  pageCountBadge: document.querySelector("#pageCountBadge"),
  currentUser: document.querySelector("#currentUser"),
  menuCurrentUser: document.querySelector("#menuCurrentUser"),
  userAvatar: document.querySelector("#userAvatar"),
  appVersion: document.querySelector("#appVersion"),
  userMenuButton: document.querySelector("#userMenuButton"),
  userMenu: document.querySelector("#userMenu"),
  syncStatus: document.querySelector("#syncStatus"),
  refreshButton: document.querySelector("#refreshButton"),
  logoutButton: document.querySelector("#logoutButton"),
  noticeView: document.querySelector("#noticeView"),
  itineraryView: document.querySelector("#itineraryView"),
  fleetView: document.querySelector("#fleetView"),
  notesView: document.querySelector("#notesView"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
};

function sheetUrl(sheetName, callbackName) {
  const params = new URLSearchParams({
    tqx: `out:json;responseHandler:${callbackName}`,
    sheet: sheetName,
    cacheBust: String(Date.now()),
  });
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params}`;
}

function tableToObjects(table) {
  const headers = table.cols.map((col) => (col.label || col.id || "").trim());
  return table.rows.map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      const cell = row.c[index];
      item[header] = cell ? String(cell.f ?? cell.v ?? "").trim() : "";
    });
    return item;
  });
}

async function fetchSheet(sheetName) {
  const callbackName = `sheetCallback_${sheetName.replace(/\W/g, "")}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`讀取 ${sheetName} 逾時`));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      if (payload.status === "error") {
        reject(new Error(payload.errors?.[0]?.detailed_message || `讀取 ${sheetName} 失敗`));
        return;
      }
      resolve(tableToObjects(payload.table));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error(`讀取 ${sheetName} 失敗`));
    };

    script.src = sheetUrl(sheetName, callbackName);
    document.head.append(script);
  });
}

function normalizeItinerary(rows) {
  let currentDate = "";
  return rows
    .map((row) => {
      if (row.date) currentDate = row.date;
      return {
        date: currentDate,
        time: row.time || "",
        title: row.title || "",
        location: row.location || "",
        group: row.group || "",
        memo: row.memo || "",
      };
    })
    .filter((row) => row.title || row.location || row.memo);
}

function normalizeFleet(rows) {
  return rows
    .map((row) => ({
      carNo: row.car_no || "",
      role: row.role || "",
      name: row.name || "",
      type1: row.type1 || "",
      carName: row.type2 || "",
      group: row.type3 || "",
    }))
    .filter((row) => row.carNo || row.name);
}

function normalizeNotes(rows) {
  const titleKeys = ["title", "name", "item", "date", "hotel", "location"];
  const bodyKeys = ["context", "content", "memo", "note", "body", "description"];
  return rows
    .map((row) => {
      const titleKey = titleKeys.find((key) => row[key]);
      const title = titleKey ? row[titleKey] : Object.values(row).find(Boolean) || "";
      const bodyKey = bodyKeys.find((key) => row[key]);
      const body = bodyKey
        ? row[bodyKey]
        : Object.entries(row)
            .filter(([key, value]) => value && key !== titleKey && key !== "no")
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");
      return {
        title,
        body: body.replaceAll("\\", " / "),
        date: row.date || "",
      };
    })
    .filter((row) => row.title || row.body)
    .filter((row) => !/測試|test/i.test(`${row.title} ${row.body}`));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function groupBy(list, getKey) {
  return list.reduce((groups, item) => {
    const key = getKey(item) || "未分類";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date) {
  if (!date) return "未定日期";
  const parsed = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(parsed);
}

function formatSyncShort(date = new Date()) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getUserInitial(name) {
  return (name || "團").trim().slice(0, 1).toUpperCase();
}

function getPageCount() {
  if (state.activeView === "noticeView") return { text: `${state.notice.length}筆`, value: state.notice.length };
  if (state.activeView === "itineraryView") {
    const count = state.itinerary.filter((item) => item.date === state.selectedDate).length;
    return { text: `${count}項`, value: count };
  }
  if (state.activeView === "fleetView") {
    const carCount = unique(state.fleet.map((item) => item.carName || item.carNo)).length;
    return { text: `${carCount}車`, value: carCount };
  }
  if (state.activeView === "notesView") {
    const query = state.noteQuery.trim().toLowerCase();
    const count = query
      ? state.notes.filter((item) => `${item.title} ${item.body} ${getNoteCategory(item).label} ${getNoteDay(item)}`.toLowerCase().includes(query)).length
      : state.notes.length;
    return { text: `${count}筆`, value: count };
  }
  return { text: "", value: 0 };
}

function updateTopBar() {
  const count = getPageCount();
  els.pageCountBadge.textContent = count.text;
  els.pageCountBadge.hidden = !count.text;
}

function emptyState(title, body) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span></div>`;
}

function notesEmptyState() {
  return `
    <div class="empty-state notes-empty">
      <img src="車貼2.png" alt="" />
      <strong>今天過得很 Chill</strong>
      <span>目前沒有重要紀事喔！</span>
    </div>
  `;
}

function renderTravelerOptions(names) {
  const travelers = unique(names.length ? names : FALLBACK_TRAVELERS);
  const query = els.travelerInput.value.trim().toLowerCase();
  const filtered = travelers.filter((name) => name.toLowerCase().includes(query));

  els.travelerGrid.innerHTML = filtered.length
    ? filtered.map((name) => `
        <button class="traveler-chip ${els.selectedTraveler.value === name ? "selected" : ""}" type="button" data-name="${escapeHtml(name)}">
          <span>${escapeHtml(getUserInitial(name))}</span>
          <strong>${escapeHtml(name)}</strong>
        </button>
      `).join("")
    : `<p class="traveler-empty">找不到符合的團員</p>`;

  els.travelerGrid.querySelectorAll(".traveler-chip").forEach((button) => {
    button.addEventListener("click", () => {
      els.selectedTraveler.value = button.dataset.name;
      els.travelerInput.value = button.dataset.name;
      setFormMessage(`已選擇 ${button.dataset.name}`, "success");
      renderTravelerOptions(travelers);
      els.passwordInput.focus();
    });
  });
}

async function loadTravelerOptions() {
  renderTravelerOptions(FALLBACK_TRAVELERS);
  try {
    const rows = await fetchSheet(SOURCES.fleet);
    const names = normalizeFleet(rows)
      .filter((person) => person.type1 === "大人")
      .map((person) => person.name);
    renderTravelerOptions(names);
  } catch (error) {
    console.warn(error);
  }
}

function setFormMessage(message, type = "") {
  els.passwordHint.textContent = message;
  els.passwordHint.className = `form-message ${type}`.trim();
}

function renderNoticeHero() {
  if (state.noticeHeroDismissed) return "";
  return `
    <section class="notice-banner">
      <img src="車貼1.png" alt="Play hard in Jeju Island 車貼" />
      <div>
        <p class="eyebrow">Jeju Island</p>
        <h2>跟著晴姐遊濟州島</h2>
        <p>公告、行程、車隊與重要紀事都會從 Google Sheet 同步更新。</p>
      </div>
      <button id="dismissNoticeHero" class="dismiss-button" type="button" aria-label="關閉歡迎訊息">×</button>
    </section>
  `;
}

function getNoticeTags(item) {
  const text = `${item.title} ${item.body}`;
  const tags = [];
  if (/出國|出發|行前/.test(text)) tags.push("出發前");
  if (/駕照|開車|租車|車/.test(text)) tags.push("開車必看");
  if (/重要|注意|必/.test(text)) tags.push("重要");
  return tags.length ? tags : ["提醒"];
}

function getNoteKey(item) {
  return `${item.title || ""}|${item.body || ""}`.slice(0, 220);
}

function getNoteCategory(item) {
  const text = `${item.title} ${item.body}`;
  if (/飯店|酒店|Hotel|地址|入住/i.test(text)) return { icon: "🏨", label: "住宿" };
  if (/航班|起飛|機場|班機|虎航|德威/i.test(text)) return { icon: "✈️", label: "交通" };
  if (/租車|車牌|駕照|開車|保險/i.test(text)) return { icon: "🚗", label: "租車" };
  if (/費用|餐費|團費|付款|韓元|₩|收錢/i.test(text)) return { icon: "💰", label: "費用" };
  if (/電話|聯絡|緊急|救護/i.test(text)) return { icon: "☎️", label: "聯絡" };
  if (/英文|護照|姓名|全名/i.test(text)) return { icon: "🪪", label: "證件" };
  return { icon: "📝", label: "資料" };
}

function getNoteDay(item) {
  const text = `${item.title} ${item.body}`;
  const match = text.match(/(?:20)?26?[-/.]?(08|8)[-/.]?(\d{2})|(?:^|\D)(08|8)(\d{2})(?:\D|$)/);
  const dayText = match ? (match[2] || match[4]) : "";
  const day = Number(dayText);
  if (!day || day < 8 || day > 16) return "旅遊資料";
  return `Day ${day - 7} · 8/${day}`;
}

function isSuggestedPin(item) {
  const text = `${item.title} ${item.body}`;
  return /緊急|電話|聯絡|飯店|酒店|航班|租車|護照|英文全名/i.test(text);
}

function getMapLink(item) {
  const text = `${item.title}\n${item.body}`;
  const urlMatch = text.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps|maps\.google\.com)[^\s\]]+/i);
  if (urlMatch) return urlMatch[0];

  const addressMatch = text.match(/(?:地址|地點)[:：]\s*([^\n]+)/);
  if (addressMatch) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressMatch[1].trim())}`;
  }

  return "";
}

function getNotePreview(item) {
  const text = (item.body || "尚未填寫詳細內容。").replace(/\s+/g, " ").trim();
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}

function getMapHref(location, memo = "") {
  const text = `${location || ""}\n${memo || ""}`;
  const urlMatch = text.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps|maps\.google\.com)[^\s\]]+/i);
  if (urlMatch) return urlMatch[0];
  const mapLine = text.match(/Map(?:\s*link)?[:：]?\s*([^\n]+)/i);
  if (mapLine && /^https?:\/\//i.test(mapLine[1].trim())) return mapLine[1].trim();
  if (location && location.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.replace(/\n/g, " ").trim())}`;
  }
  return "";
}

function getFilteredImportantNotes() {
  const query = state.noteQuery.trim().toLowerCase();
  if (!query) return state.notes;
  return state.notes.filter((item) =>
    `${item.title} ${item.body} ${getNoteCategory(item).label} ${getNoteDay(item)}`.toLowerCase().includes(query)
  );
}

function importantNoteCard(item) {
  const mapLink = getMapLink(item);
  return `
    <details class="important-card ${item.pinned ? "pinned" : ""}" data-note-key="${escapeHtml(item.key)}">
      <summary>
        <span class="note-icon" aria-hidden="true">${item.category.icon}</span>
        <span class="important-summary">
          <span class="important-meta">
            ${item.pinned ? `<span class="pin-label">置頂</span>` : ""}
            <span>${escapeHtml(item.day)}</span>
            <span class="category-pill">${escapeHtml(item.category.label)}</span>
          </span>
          <strong>${escapeHtml(item.title || "未命名紀事")}</strong>
          <small>${escapeHtml(getNotePreview(item))}</small>
        </span>
      </summary>
      <div class="important-detail">
        ${item.body ? `<p>${escapeHtml(item.body)}</p>` : `<p class="muted-note">尚未填寫詳細內容。</p>`}
        <div class="note-actions">
          ${mapLink ? `<a class="map-note" href="${escapeHtml(mapLink)}" target="_blank" rel="noopener">📍 開啟地圖</a>` : ""}
          <button class="pin-note ${item.pinned ? "active" : ""}" type="button">${item.pinned ? "已置頂" : "置頂"}</button>
          <button class="copy-note" type="button">📋 複製</button>
        </div>
      </div>
    </details>
  `;
}

function bindImportantNoteActions(container) {
  container.querySelectorAll(".copy-note").forEach((button) => {
    button.addEventListener("click", async () => {
      const cardEl = button.closest(".important-card");
      const text = cardEl.querySelector(".important-summary strong").textContent + "\n" + cardEl.querySelector(".important-detail p").textContent;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement("textarea");
        input.value = text;
        document.body.append(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      button.textContent = "已複製";
      window.setTimeout(() => {
        button.textContent = "📋 複製";
      }, 1200);
    });
  });

  container.querySelectorAll(".pin-note").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.closest(".important-card").dataset.noteKey;
      const isPinned = button.classList.contains("active");
      if (isPinned) {
        pinnedNoteKeys.delete(key);
        unpinnedNoteKeys.add(key);
      } else {
        pinnedNoteKeys.add(key);
        unpinnedNoteKeys.delete(key);
      }
      localStorage.setItem("jejuPinnedNotes", JSON.stringify(Array.from(pinnedNoteKeys)));
      localStorage.setItem("jejuUnpinnedNotes", JSON.stringify(Array.from(unpinnedNoteKeys)));
      renderImportantNoteResults();
      updateTopBar();
    });
  });
}

function renderImportantNoteResults() {
  const resultsEl = document.querySelector("#notesResults");
  if (!resultsEl) return;

  const sourceNotes = getFilteredImportantNotes();
  if (!sourceNotes.length) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <strong>找不到符合的紀事</strong>
        <span>請換個關鍵字，或確認 Data 分頁內容。</span>
      </div>
    `;
    return;
  }

  const enriched = sourceNotes.map((item) => {
    const key = getNoteKey(item);
    return {
      ...item,
      key,
      category: getNoteCategory(item),
      day: getNoteDay(item),
      pinned: pinnedNoteKeys.has(key) || (isSuggestedPin(item) && !unpinnedNoteKeys.has(key)),
    };
  });

  const pinned = enriched.filter((item) => item.pinned);
  const normal = enriched.filter((item) => !item.pinned);
  const groups = groupBy(normal, (item) => item.day);

  resultsEl.innerHTML = `
    ${pinned.length ? `
      <section class="pinned-notes">
        <header>
          <h2>📌 置頂資訊</h2>
          <span class="badge">${pinned.length} 筆</span>
        </header>
        <div class="important-list">${pinned.map(importantNoteCard).join("")}</div>
      </section>
    ` : ""}
    ${Array.from(groups.entries()).map(([day, items]) => `
      <section class="timeline-group">
        <header>
          <span class="timeline-dot" aria-hidden="true"></span>
          <h2>${escapeHtml(day)}</h2>
          <span class="badge">${items.length} 筆</span>
        </header>
        <div class="important-list">${items.map(importantNoteCard).join("")}</div>
      </section>
    `).join("")}
  `;

  bindImportantNoteActions(resultsEl);
}

function renderImportantNotes() {
  if (!state.notes.length) {
    els.notesView.innerHTML = notesEmptyState();
    return;
  }

  els.notesView.innerHTML = `
    <section class="notes-search">
      <input id="notesSearchInput" type="search" value="${escapeHtml(state.noteQuery)}" placeholder="搜尋飯店、地址、航班、租車..." />
    </section>
    <div id="notesResults"></div>
    <button id="addNoteHint" class="fab-button" type="button" aria-label="新增重要紀事">＋</button>
  `;

  const searchInput = document.querySelector("#notesSearchInput");
  let isComposing = false;
  let searchTimer = 0;

  function updateResults(delay = 120) {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      renderImportantNoteResults();
      updateTopBar();
    }, delay);
  }

  searchInput.addEventListener("compositionstart", () => {
    isComposing = true;
  });

  searchInput.addEventListener("compositionend", (event) => {
    isComposing = false;
    state.noteQuery = event.target.value;
    updateResults(0);
  });

  searchInput.addEventListener("input", (event) => {
    state.noteQuery = event.target.value;
    if (!isComposing) updateResults();
  });

  renderImportantNoteResults();

  document.querySelector("#addNoteHint").addEventListener("click", () => {
    alert("目前重要紀事由 Google Sheet 的 Data 分頁管理，請到表格新增 no、title、content。");
  });
}

function renderItinerary() {
  const dates = unique(state.itinerary.map((item) => item.date));
  if (!state.selectedDate && dates.length) {
    state.selectedDate = dates[0];
  }

  const selectedEvents = state.itinerary.filter((item) => item.date === state.selectedDate);
  if (!state.itinerary.length) {
    els.itineraryView.innerHTML = emptyState("目前沒有行程資料", "請確認 itinerary 分頁是否已有資料。");
    return;
  }

  els.itineraryView.innerHTML = `
    <div class="day-switcher-wrap">
      <section class="day-switcher" aria-label="切換每日行程">
        ${dates.map((date) => `
          <button class="day-chip ${date === state.selectedDate ? "active" : ""}" type="button" data-date="${escapeHtml(date)}">
            ${escapeHtml(formatDate(date))}
          </button>
        `).join("")}
      </section>
    </div>
    <article class="day-group">
      <header class="day-heading">
        <h2>${escapeHtml(formatDate(state.selectedDate))}</h2>
        <span class="badge">${selectedEvents.length} 項</span>
      </header>
      <div class="event-list">
        ${selectedEvents.map((event) => {
          const mapHref = getMapHref(event.location, event.memo);
          return `
            <section class="event-card">
              <div class="event-top">
                <span class="time">${escapeHtml(event.time || "未定")}</span>
                <div class="event-main">
                  <p class="event-title">${escapeHtml(event.title || "未命名行程")}</p>
                  ${event.location ? `
                    <p class="event-location">
                      <span>📍 ${escapeHtml(event.location)}</span>
                      ${mapHref ? `<a class="map-link" href="${escapeHtml(mapHref)}" target="_blank" rel="noopener" aria-label="開啟地圖">🗺️</a>` : ""}
                    </p>
                  ` : ""}
                </div>
              </div>
              ${event.group ? `<div class="tag-row" aria-label="參與車隊">${event.group.split("、").map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
              ${event.memo ? `
                <details class="memo-box">
                  <summary>重要備註</summary>
                  <p>${escapeHtml(event.memo)}</p>
                </details>
              ` : ""}
            </section>
          `;
        }).join("")}
      </div>
    </article>
  `;

  els.itineraryView.querySelectorAll(".day-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDate = button.dataset.date;
      renderItinerary();
      updateTopBar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function renderFleet() {
  const groups = groupBy(state.fleet, (item) => item.carName || `第 ${item.carNo} 車`);
  if (!state.fleet.length) {
    els.fleetView.innerHTML = emptyState("目前沒有車隊資料", "請確認 fleet 分頁是否已有資料。");
    return;
  }

  els.fleetView.innerHTML = `
    ${Array.from(groups.entries()).map(([name, people]) => `
      <article class="fleet-group">
        <header class="fleet-heading">
          <div>
            <h2>${escapeHtml(name)}</h2>
            <p>${escapeHtml(people.find((person) => person.role === "車長")?.name || "未指定")} 車長</p>
          </div>
          <span class="badge">${people.length} 人</span>
        </header>
        <div class="people-list">
          ${people.map((person) => `
            <section class="person-row ${person.name === state.currentUser ? "current-person" : ""} ${person.role === "車長" ? "captain-row" : ""}">
              <div>
                <p class="person-name">${person.role === "車長" ? "🚗 " : ""}${person.type1 === "小孩" ? "👶 " : ""}${escapeHtml(person.name || "未命名")}</p>
                <div class="member-badges">
                  ${person.type1 ? `<span class="age-badge ${person.type1 === "小孩" ? "child" : "adult"}">${escapeHtml(person.type1)}</span>` : ""}
                  ${person.group ? `<span class="group-badge ${person.group.includes("爬山") ? "mountain" : "walk"}">${escapeHtml(person.group)}</span>` : ""}
                </div>
              </div>
              <span class="person-role">${escapeHtml(person.role || "乘客")}</span>
            </section>
          `).join("")}
        </div>
      </article>
    `).join("")}
  `;
}

function renderNotes(target, list, title, emptyTitle, emptyBody, options = {}) {
  if (!list.length) {
    target.innerHTML = emptyState(emptyTitle, emptyBody);
    return;
  }
  target.innerHTML = `
    <article class="info-block">
      <header class="block-heading">
        <h2>${escapeHtml(title)}</h2>
        <span class="badge">${list.length} 筆</span>
      </header>
      <div class="note-list">
        ${list.map((item) => `
          <section class="note-card">
            ${options.withTags ? `<div class="notice-tags">${getNoticeTags(item).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
            <p class="note-title">${escapeHtml(item.title || "未命名")}</p>
            ${item.date ? `<p class="note-date">${escapeHtml(formatDate(item.date))}</p>` : ""}
            ${item.body ? `<p class="note-body">${escapeHtml(item.body)}</p>` : ""}
          </section>
        `).join("")}
      </div>
    </article>
  `;
}

function renderAll() {
  renderNotes(
    els.noticeView,
    state.notice,
    "團長叮嚀",
    "目前沒有公告資料",
    "請確認 Note 分頁是否已有 no、date、title、context 欄位資料。",
    { withTags: true }
  );
  renderItinerary();
  renderFleet();
  renderImportantNotes();
  updateTopBar();
}

async function loadData() {
  els.syncStatus.textContent = "正在更新資料...";
  els.refreshButton.disabled = true;
  try {
    const [itinerary, fleet, notice, notes] = await Promise.all([
      fetchSheet(SOURCES.itinerary).then(normalizeItinerary),
      fetchSheet(SOURCES.fleet).then(normalizeFleet),
      fetchSheet(SOURCES.notice).then(normalizeNotes).catch(() => []),
      fetchSheet(SOURCES.notes).then(normalizeNotes).catch(() => []),
    ]);

    state.itinerary = itinerary;
    state.fleet = fleet;
    state.notice = notice;
    state.notes = notes;

    const dates = unique(state.itinerary.map((item) => item.date));
    if (!dates.includes(state.selectedDate)) {
      state.selectedDate = dates[0] || "";
    }

    renderAll();
    els.syncStatus.textContent = `點擊更新 · 最後同步 ${formatSyncShort()}`;
  } catch (error) {
    renderAll();
    els.syncStatus.textContent = "讀取失敗 · 點擊更新";
    els.noticeView.innerHTML = emptyState("Google Sheet 讀取失敗", "請確認試算表分享權限設為知道連結者可檢視。");
    console.error(error);
  } finally {
    els.refreshButton.disabled = false;
  }
}

function unlock(userName) {
  state.currentUser = userName;
  sessionStorage.setItem("jejuUnlocked", "true");
  sessionStorage.setItem("jejuUser", userName);
  els.currentUser.textContent = userName;
  els.menuCurrentUser.textContent = userName;
  els.userAvatar.textContent = getUserInitial(userName);
  els.lockScreen.hidden = true;
  els.mainApp.hidden = false;
  loadData();
}

function logout() {
  sessionStorage.removeItem("jejuUnlocked");
  sessionStorage.removeItem("jejuUser");
  state.currentUser = "";
  els.userMenu.hidden = true;
  els.userMenuButton.setAttribute("aria-expanded", "false");
  els.passwordInput.value = "";
  els.selectedTraveler.value = "";
  els.travelerInput.value = "";
  setFormMessage("您已登出，請重新登入。", "warning");
  renderTravelerOptions(FALLBACK_TRAVELERS);
  els.mainApp.hidden = true;
  els.lockScreen.hidden = false;
  els.travelerInput.focus();
}

function setupEvents() {
  els.appVersion.textContent = APP_VERSION;

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const userName = els.selectedTraveler.value;
    if (!userName) {
      setFormMessage("請先選擇您的名字。", "error");
      els.travelerInput.focus();
      return;
    }
    if (els.passwordInput.value !== PASSWORD) {
      setFormMessage("密碼錯誤，請再試一次。", "error");
      els.passwordInput.select();
      return;
    }
    setFormMessage("驗證成功，正在進入。", "success");
    unlock(userName);
  });

  els.travelerInput.addEventListener("input", () => {
    els.selectedTraveler.value = "";
    renderTravelerOptions(FALLBACK_TRAVELERS);
  });

  els.passwordToggle.addEventListener("click", () => {
    const shouldShow = els.passwordInput.type === "password";
    els.passwordInput.type = shouldShow ? "text" : "password";
    els.passwordToggle.textContent = shouldShow ? "🙈" : "👁️";
    els.passwordToggle.setAttribute("aria-label", shouldShow ? "隱藏密碼" : "顯示密碼");
  });

  els.refreshButton.addEventListener("click", loadData);
  els.logoutButton.addEventListener("click", logout);
  els.userMenuButton.addEventListener("click", () => {
    const isOpen = !els.userMenu.hidden;
    els.userMenu.hidden = isOpen;
    els.userMenuButton.setAttribute("aria-expanded", String(!isOpen));
  });

  document.addEventListener("click", (event) => {
    if (els.userMenu.hidden) return;
    if (event.target.closest(".user-menu-wrap")) return;
    els.userMenu.hidden = true;
    els.userMenuButton.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    els.userMenu.hidden = true;
    els.userMenuButton.setAttribute("aria-expanded", "false");
  });

  els.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      state.activeView = item.dataset.view;
      els.pageTitle.textContent = item.dataset.title;
      document.querySelectorAll(".view").forEach((view) => {
        view.classList.toggle("active-view", view.id === state.activeView);
      });
      els.navItems.forEach((navItem) => {
        navItem.classList.toggle("active", navItem === item);
      });
      updateTopBar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js?v=16").catch(console.error);
  });
}

setupEvents();
loadTravelerOptions();

if (sessionStorage.getItem("jejuUnlocked") === "true" && sessionStorage.getItem("jejuUser")) {
  unlock(sessionStorage.getItem("jejuUser"));
} else {
  els.travelerInput.focus();
}
