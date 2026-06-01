document.addEventListener("DOMContentLoaded", () => {
    const lockScreen = document.getElementById("lock-screen");
    const mainApp = document.getElementById("main-app");
    const passwordInput = document.getElementById("password-input");
    const unlockBtn = document.getElementById("unlock-btn");
    const errorMsg = document.getElementById("error-msg");

    // 1. 檢查之前是否成功解鎖過 (記住裝置)
    if (localStorage.getItem("jeju_unlocked") === "true") {
        lockScreen.classList.add("hidden");
        mainApp.classList.remove("hidden");
    }

    // 2. 解鎖事件
    unlockBtn.addEventListener("click", () => {
        const password = passwordInput.value.trim();
        if (password === "08080816") {
            localStorage.setItem("jeju_unlocked", "true");
            lockScreen.classList.add("hidden");
            mainApp.classList.remove("hidden");
        } else {
            errorMsg.textContent = "密碼錯誤，請重新輸入！";
            passwordInput.value = "";
        }
    });

    // 3. 底部導覽列分頁切換邏輯
    const navItems = document.querySelectorAll(".nav-item");
    const tabContents = document.querySelectorAll(".tab-content");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            // 切換按鈕高亮
            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");

            // 切換內容顯示
            const targetTab = item.getAttribute("data-target");
            tabContents.forEach(tab => {
                if (tab.id === targetTab) {
                    tab.classList.remove("hidden");
                } else {
                    tab.classList.add("hidden");
                }
            });
        });
    });

    // 4. 註冊 PWA Service Worker (確保離線可用)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log("Service Worker 註冊成功"))
            .catch(err => console.error("Service Worker 註冊失敗", err));
    }
});