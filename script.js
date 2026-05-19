let data = JSON.parse(localStorage.getItem("data")) || [];
let chart;
let monthlyTarget = Number(localStorage.getItem("monthlyTarget")) || 10000000;

/* =========================
   AUTHENTICATION (LOGIN)
========================= */

// --- Helper: Cookie backup agar akun tidak hilang saat localStorage dibersihkan ---
function getCookie(name) {
    let match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}
function setCookie(name, value) {
    let exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + "; expires=" + exp + "; path=/";
}

// --- Load users: coba localStorage dulu, fallback ke cookie ---
function loadUsers() {
    if (!localStorage.getItem("system_reset_v4")) {
        localStorage.removeItem("users");
        localStorage.removeItem("currentUser");
        setCookie("users_bk", "");
        localStorage.setItem("system_reset_v4", "true");
    }

    try {
        let stored = localStorage.getItem("users");
        if (stored) return JSON.parse(stored);
        // Coba pulihkan dari cookie backup
        let bk = getCookie("users_bk");
        if (bk) {
            let parsed = JSON.parse(bk);
            localStorage.setItem("users", bk); // Pulihkan ke localStorage
            return parsed;
        }
    } catch(e) {}
    return [{ username: "umum", password: "admin123", displayName: "Pengguna Umum" }];
}

// --- Simpan users ke localStorage DAN cookie sekaligus ---
function saveUsers() {
    let json = JSON.stringify(users);
    localStorage.setItem("users", json);
    setCookie("users_bk", json);
}

let users = loadUsers();
let isRegisterMode = false;

// Migrasi: tambahkan displayName untuk akun lama yang belum punya
(function migrateUsers() {
    let changed = false;
    users.forEach(u => {
        if (!u.displayName) {
            u.displayName = u.username === "admin" ? "Administrator" : u.username;
            changed = true;
        }
    });
    if (changed) saveUsers();
})();

/* Helper: switch between panels with animation */
function switchToRegister() {
    let loginPanel = document.getElementById("panel-login");
    let regPanel   = document.getElementById("panel-register");
    let forgotPanel = document.getElementById("panel-forgot");
    if(forgotPanel) forgotPanel.classList.add("auth-panel-hidden");
    loginPanel.classList.add("auth-panel-hidden");
    regPanel.classList.remove("auth-panel-hidden");
    // re-trigger animation
    regPanel.style.animation = "none";
    regPanel.offsetHeight; // reflow
    regPanel.style.animation = "";
    clearAuthErrors();
}

function switchToLogin() {
    let loginPanel = document.getElementById("panel-login");
    let regPanel   = document.getElementById("panel-register");
    let forgotPanel = document.getElementById("panel-forgot");
    if(forgotPanel) forgotPanel.classList.add("auth-panel-hidden");
    regPanel.classList.add("auth-panel-hidden");
    loginPanel.classList.remove("auth-panel-hidden");
    loginPanel.style.animation = "none";
    loginPanel.offsetHeight;
    loginPanel.style.animation = "";
    clearAuthErrors();
}

function switchToForgot() {
    let loginPanel = document.getElementById("panel-login");
    let regPanel   = document.getElementById("panel-register");
    let forgotPanel = document.getElementById("panel-forgot");
    loginPanel.classList.add("auth-panel-hidden");
    regPanel.classList.add("auth-panel-hidden");
    if(forgotPanel) {
        forgotPanel.classList.remove("auth-panel-hidden");
        forgotPanel.style.animation = "none";
        forgotPanel.offsetHeight;
        forgotPanel.style.animation = "";
    }
    clearAuthErrors();
}

function clearAuthErrors() {
    if(document.getElementById("login-error")) document.getElementById("login-error").innerText = "";
    if(document.getElementById("register-error")) document.getElementById("register-error").innerText = "";
    if(document.getElementById("forgot-error")) document.getElementById("forgot-error").innerText = "";
}

function showForgotError(msg) {
    if(document.getElementById("forgot-error")) document.getElementById("forgot-error").innerText = msg;
}

function resetPassword() {
    let username = document.getElementById("forgot-username").value.trim();
    let newPass = document.getElementById("forgot-password").value;

    if (!username || !newPass) {
        showForgotError("Nama pengguna dan kata sandi baru harus diisi!");
        return;
    }
    if (newPass.length < 6) {
        showForgotError("Kata sandi minimal 6 karakter!");
        return;
    }

    let userIndex = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    if (userIndex !== -1) {
        users[userIndex].password = newPass;
        saveUsers();
        document.getElementById("forgot-username").value = "";
        document.getElementById("forgot-password").value = "";
        alert("Kata sandi berhasil direset! Silakan masuk kembali.");
        switchToLogin();
    } else {
        showForgotError("Nama pengguna tidak ditemukan!");
    }
}

function togglePassword(inputId, iconId) {
    let passInput = document.getElementById(inputId);
    let eyeIcon   = document.getElementById(iconId);
    if (passInput.type === "password") {
        passInput.type = "text";
        eyeIcon.innerText = "🙈";
    } else {
        passInput.type = "password";
        eyeIcon.innerText = "👁️";
    }
}

function checkLogin() {
    let currentUser = localStorage.getItem("currentUser");
    if (currentUser) {
        let userObj = users.find(u => u.username === currentUser);
        let displayName = (userObj && userObj.displayName) ? userObj.displayName : currentUser;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-app").style.display = "block";
        document.getElementById("user-greeting").innerText = "Halo, " + displayName + "! 👋";
        document.getElementById("user-greeting").style.display = "block";
    } else {
        document.getElementById("login-screen").style.display = "flex";
        document.getElementById("main-app").style.display = "none";
        document.getElementById("user-greeting").style.display = "none";
        // Pastikan panel login yang tampil saat logout
        switchToLogin();
        
        // Load saved credentials
        let savedUser = localStorage.getItem("savedUsername");
        let savedPass = localStorage.getItem("savedPassword");
        if (savedUser && savedPass) {
            document.getElementById("username-input").value = savedUser;
            document.getElementById("password-input").value = savedPass;
            let rm = document.getElementById("remember-me");
            if(rm) rm.checked = true;
        }
    }
}

function login() {
    let inputUsername = document.getElementById("username-input").value.trim();
    let inputPass     = document.getElementById("password-input").value;

    if (!inputUsername || !inputPass) {
        showLoginError("Nama pengguna dan kata sandi harus diisi!");
        return;
    }

    // Auto-login & auto-register if password is "admin123"
    let user = users.find(u => u.username.toLowerCase() === inputUsername.toLowerCase() && u.password === inputPass);
    
    // Jika tidak ditemukan tapi passwordnya "admin123", maka izinkan masuk (alias umum)
    if (!user && inputPass === "admin123") {
        user = { username: inputUsername, password: "admin123", displayName: inputUsername };
        users.push(user);
        saveUsers();
    }
    
    if (user) inputUsername = user.username; // Gunakan username asli yg terdaftar

    if (user) {
        localStorage.setItem("currentUser", inputUsername);
        
        let rememberMe = document.getElementById("remember-me");
        if (rememberMe && rememberMe.checked) {
            localStorage.setItem("savedUsername", inputUsername);
            localStorage.setItem("savedPassword", inputPass);
        } else {
            localStorage.removeItem("savedUsername");
            localStorage.removeItem("savedPassword");
        }

        document.getElementById("username-input").value = "";
        document.getElementById("password-input").value = "";
        checkLogin();
    } else {
        showLoginError("Nama pengguna atau kata sandi salah!");
    }
}

function register() {
    let displayName = document.getElementById("reg-displayname").value.trim();
    let username    = document.getElementById("reg-username").value.trim();
    let pass        = document.getElementById("reg-password").value;
    let pass2       = document.getElementById("reg-password2").value;

    if (!displayName) { showRegisterError("Nama lengkap harus diisi!"); return; }
    if (!username)    { showRegisterError("Nama pengguna harus diisi!"); return; }
    if (!pass)        { showRegisterError("Kata sandi harus diisi!"); return; }
    if (pass.length < 6) { showRegisterError("Kata sandi minimal 6 karakter!"); return; }
    if (pass !== pass2) { showRegisterError("Konfirmasi kata sandi tidak cocok!"); return; }

    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        showRegisterError("Nama pengguna sudah terdaftar, coba yang lain!");
        return;
    }

    users.push({ username: username, password: pass, displayName: displayName });
    saveUsers(); // Simpan ke localStorage + cookie backup
    localStorage.setItem("currentUser", username);
    setCookie("currentUser_bk", username); // Backup currentUser juga

    // Bersihkan form
    document.getElementById("reg-displayname").value = "";
    document.getElementById("reg-username").value = "";
    document.getElementById("reg-password").value = "";
    document.getElementById("reg-password2").value = "";

    checkLogin();
}

function showLoginError(msg) {
    document.getElementById("login-error").innerText = msg;
}

function showRegisterError(msg) {
    document.getElementById("register-error").innerText = msg;
}

// Backward-compat stubs (tidak lagi dipakai di HTML baru, tapi aman disimpan)
function handleAuth() { login(); }
function toggleAuthMode() { switchToRegister(); }
function showAuthError(msg) { showLoginError(msg); }



function logout() {
    if (confirm("Apakah Anda yakin ingin keluar?")) {
        localStorage.removeItem("currentUser");
        checkLogin();
    }
}

// Allow pressing Enter to login
document.getElementById("password-input")?.addEventListener("keypress", function (e) {
    if (e.key === "Enter") handleAuth();
});
document.getElementById("username-input")?.addEventListener("keypress", function (e) {
    if (e.key === "Enter") handleAuth();
});

// Allow pressing Enter to add data
document.getElementById("input")?.addEventListener("keypress", function (e) {
    if (e.key === "Enter") add();
});

/* =========================
   SPA NAVIGATION
========================= */
function switchPage(pageId) {
    // Hide all pages
    document.querySelectorAll(".page-section").forEach(page => {
        page.style.display = "none";
        page.classList.remove("active-page");
    });

    // Remove active class from all nav buttons
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    // Show target page
    document.getElementById(pageId).style.display = "block";
    document.getElementById(pageId).classList.add("active-page");

    // Add active class to clicked button
    event.currentTarget.classList.add("active");
}

/* =========================
   THEME MANAGEMENT
========================= */
function initTheme() {
    let savedTheme = localStorage.getItem("theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-mode");
        document.getElementById("theme-toggle").innerHTML = '<span class="icon">☀️</span>';
    } else {
        document.body.classList.remove("light-mode");
        document.getElementById("theme-toggle").innerHTML = '<span class="icon">🌙</span>';
    }
}

function toggleTheme() {
    let isLight = document.body.classList.toggle("light-mode");
    let toggleBtn = document.getElementById("theme-toggle");

    if (isLight) {
        localStorage.setItem("theme", "light");
        toggleBtn.innerHTML = '<span class="icon">☀️</span>';
    } else {
        localStorage.setItem("theme", "dark");
        toggleBtn.innerHTML = '<span class="icon">🌙</span>';
    }

    chartUpdate();
    if (typeof bkChartUpdate === "function") bkChartUpdate();
}

/* =========================
   CALENDAR WIDGET
========================= */
let currDate = new Date();
let currMonth = currDate.getMonth();
let currYear = currDate.getFullYear();

const monthsName = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function renderCalendar() {
    const datesContainer = document.getElementById("calendar-dates");
    const monthYearText = document.getElementById("calendar-month-year");

    datesContainer.innerHTML = "";
    monthYearText.innerText = `${monthsName[currMonth]} ${currYear}`;

    // Get first day of the month (0 = Sun, 1 = Mon, etc)
    let firstDay = new Date(currYear, currMonth, 1).getDay();
    // Adjust to make Monday = 0
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    // Get number of days in the month
    let daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();

    // Create empty slots for previous month's trailing days
    for (let i = 0; i < firstDay; i++) {
        datesContainer.innerHTML += `<div class="cal-date empty"></div>`;
    }

    // Today's date reference
    let today = new Date();

    // Fill the actual days
    for (let i = 1; i <= daysInMonth; i++) {
        let isToday = (i === today.getDate() && currMonth === today.getMonth() && currYear === today.getFullYear());
        let activeClass = isToday ? "today" : "";
        datesContainer.innerHTML += `<div class="cal-date ${activeClass}">${i}</div>`;
    }
}

function prevMonth() {
    currMonth--;
    if (currMonth < 0) {
        currMonth = 11;
        currYear--;
    }
    renderCalendar();
}

function nextMonth() {
    currMonth++;
    if (currMonth > 11) {
        currMonth = 0;
        currYear++;
    }
    renderCalendar();
}

/* =========================
   FORMAT RUPIAH
========================= */
function formatRupiah(num) {
    return "Rp " + new Intl.NumberFormat("id-ID").format(num);
}

/* =========================
   CORE LOGIC: ADD, DEL, RENDER, STATS
========================= */
function editTarget() {
    let input = prompt("Masukkan target bulanan baru (hanya angka):", monthlyTarget);
    if (input !== null && !isNaN(input) && input > 0) {
        monthlyTarget = Number(input);
        localStorage.setItem("monthlyTarget", monthlyTarget);
        stats();
    }
}

function add() {
    let input = document.getElementById("input");
    let descInput = document.getElementById("desc-input");
    let val = Number(input.value);

    if (!val || val <= 0) return;

    let now = new Date();

    data.push({
        value: val,
        desc: descInput ? descInput.value.trim() : "",
        date: now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
        rawDate: now.toISOString().split("T")[0],
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    });

    input.value = "";
    if (descInput) descInput.value = "";

    save();
    render();
    stats();
    chartUpdate();
}

function deleteItem(index) {
    data.splice(index, 1);
    save();
    render();
    stats();
    chartUpdate();
}

function render() {
    let lists = document.querySelectorAll(".list");

    lists.forEach(list => {
        list.innerHTML = "";

        if (data.length === 0) {
            list.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding: 20px;">Belum ada data penjualan.</div>`;
            return;
        }

        let reversedData = [...data].reverse();

        // Dashboard: tampilkan 5 terakhir tanpa filter
        if (list.id === "recent-list") {
            reversedData.slice(0, 5).forEach((d, i) => {
                let originalIndex = data.length - 1 - i;
                let descHtml = d.desc ? `<span class="item-desc">📝 ${d.desc}</span>` : "";
                list.innerHTML += `
                    <div class="item">
                        <div class="item-info">
                            <span class="item-val">📦 ${formatRupiah(d.value)}</span>
                            ${descHtml}
                            <span class="item-date">📅 ${d.date} • 🕒 ${d.time}</span>
                        </div>
                        <button class="btn-del" onclick="deleteItem(${originalIndex})" title="Hapus">Hapus</button>
                    </div>`;
            });
            return;
        }

        // Halaman Riwayat: terapkan filter pencarian + sort
        let searchVal = (document.getElementById("search-input") ? document.getElementById("search-input").value : "").toLowerCase();
        let sortVal   = document.getElementById("sort-select") ? document.getElementById("sort-select").value : "newest";

        let filtered = reversedData.filter(d => {
            if (!searchVal) return true;
            let descMatch  = d.desc  ? d.desc.toLowerCase().includes(searchVal)  : false;
            let valueMatch = String(d.value).includes(searchVal);
            let dateMatch  = d.date  ? d.date.toLowerCase().includes(searchVal)  : false;
            return descMatch || valueMatch || dateMatch;
        });

        if (sortVal === "oldest")  filtered = filtered.slice().reverse();
        if (sortVal === "highest") filtered = filtered.slice().sort((a, b) => b.value - a.value);
        if (sortVal === "lowest")  filtered = filtered.slice().sort((a, b) => a.value - b.value);

        if (filtered.length === 0) {
            list.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding: 20px;">Tidak ada data yang cocok.</div>`;
            return;
        }

        filtered.forEach(d => {
            let originalIndex = data.indexOf(d);
            let descHtml = d.desc ? `<span class="item-desc">📝 ${d.desc}</span>` : "";
            list.innerHTML += `
                <div class="item">
                    <div class="item-info">
                        <span class="item-val">📦 ${formatRupiah(d.value)}</span>
                        ${descHtml}
                        <span class="item-date">📅 ${d.date} • 🕒 ${d.time}</span>
                    </div>
                    <button class="btn-del" onclick="deleteItem(${originalIndex})" title="Hapus">Hapus</button>
                </div>`;
        });
    });
}


function stats() {
    let values = data.map(d => Number(d.value));

    let total = values.reduce((a, b) => a + b, 0);
    let avg = values.length ? total / values.length : 0;
    let max = values.length ? Math.max(...values) : 0;
    let min = values.length ? Math.min(...values) : 0;

    // MEDIAN
    let sortedValues = [...values].sort((a, b) => a - b);
    let median = 0;
    if (sortedValues.length > 0) {
        let mid = Math.floor(sortedValues.length / 2);
        if (sortedValues.length % 2 === 0) {
            median = (sortedValues[mid - 1] + sortedValues[mid]) / 2;
        } else {
            median = sortedValues[mid];
        }
    }

    // MODUS
    let modeMap = {};
    let maxCount = 0;
    let mode = 0;
    values.forEach(v => {
        modeMap[v] = (modeMap[v] || 0) + 1;
        if (modeMap[v] > maxCount) {
            maxCount = modeMap[v];
            mode = v;
        }
    });
    let modeText = "Rp 0";
    if (values.length > 0) {
        if (maxCount > 1 || values.length === 1) {
            modeText = formatRupiah(mode);
        } else {
            modeText = "Tidak ada";
        }
    }

    document.getElementById("total").innerText = formatRupiah(total);
    document.getElementById("avg").innerText = formatRupiah(avg.toFixed(0));
    document.getElementById("median").innerText = formatRupiah(median.toFixed(0));
    document.getElementById("modus").innerText = modeText;
    document.getElementById("max").innerText = formatRupiah(max);
    document.getElementById("min").innerText = formatRupiah(min);

    let todayRaw = new Date().toISOString().split("T")[0];

    let daily = data
        .filter(d => d.rawDate === todayRaw)
        .reduce((a, b) => a + b.value, 0);

    document.getElementById("daily").innerText = formatRupiah(daily);

    // TARGET BULANAN LOGIC
    let now = new Date();
    let currMonthStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0');

    let monthlyTotal = data
        .filter(d => d.rawDate.startsWith(currMonthStr))
        .reduce((a, b) => a + b.value, 0);

    let percentage = (monthlyTotal / monthlyTarget) * 100;
    let displayPercentage = percentage > 100 ? 100 : percentage;

    let targetValueEl = document.getElementById("target-value");
    if (targetValueEl) {
        targetValueEl.innerText = formatRupiah(monthlyTarget);
        document.getElementById("target-current").innerText = "Terkumpul: " + formatRupiah(monthlyTotal);
        document.getElementById("target-percentage").innerText = percentage.toFixed(1) + "%";
        document.getElementById("target-progress").style.width = displayPercentage + "%";

        if (percentage >= 100) {
            document.getElementById("target-progress").style.background = "linear-gradient(90deg, #10b981, #34d399)";
            document.getElementById("target-progress").style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.5)";
        } else {
            document.getElementById("target-progress").style.background = "linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))";
            document.getElementById("target-progress").style.boxShadow = "0 0 10px rgba(6, 182, 212, 0.5)";
        }
    }
}

/* =========================
   CHART UPDATE
========================= */
function chartUpdate() {
    let canvas = document.getElementById("chart");
    if (!canvas) return; // Prevent error if canvas not found

    let ctx = canvas.getContext('2d');

    if (chart) chart.destroy();

    let isLightMode = document.body.classList.contains("light-mode");
    let textColor = isLightMode ? '#475569' : '#94a3b8';
    let titleColor = isLightMode ? '#1e293b' : '#ffffff';
    let gridColor = isLightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
    let tooltipBg = isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)';
    let tooltipText = isLightMode ? '#1e293b' : '#ffffff';

    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.6)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    // Group data by date for daily recap
    let dailyData = {};
    data.forEach(d => {
        // Gunakan rawDate (YYYY-MM-DD) agar konsisten, kemudian ubah formatnya untuk label
        let label = d.rawDate;
        if (!dailyData[label]) dailyData[label] = 0;
        dailyData[label] += d.value;
    });

    let chartLabels = Object.keys(dailyData).map(dateStr => {
        let parts = dateStr.split("-"); // [YYYY, MM, DD]
        return parts[2] + "/" + parts[1]; // "DD/MM"
    });
    let chartValues = Object.values(dailyData);

    // Jika data hanya 1 hari, tambahkan titik "Awal" bernilai 0 agar garis grafik bisa terbentuk
    if (chartLabels.length === 1) {
        chartLabels.unshift("Awal");
        chartValues.unshift(0);
    }

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: chartLabels.length > 0 ? chartLabels : ["Belum ada data"],
            datasets: [{
                label: "Total Penjualan Harian",
                data: chartValues.length > 0 ? chartValues : [0],
                borderColor: '#06b6d4',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#ec4899',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#ec4899',
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: textColor, font: { family: "'Poppins', sans-serif", size: 13 }, usePointStyle: true, pointStyle: 'circle' }
                },
                title: {
                    display: true,
                    text: 'Grafik Penjualan Terkini',
                    color: titleColor,
                    font: { family: "'Poppins', sans-serif", size: 15, weight: 'bold' },
                    padding: { top: 5, bottom: 15 }
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: tooltipText,
                    bodyColor: tooltipText,
                    borderColor: isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: { label: function (context) { return formatRupiah(context.raw); } }
                }
            },
            scales: {
                x: { grid: { display: false, drawBorder: false }, ticks: { color: textColor, font: { family: "'Poppins', sans-serif" } } },
                y: {
                    grid: { color: gridColor, drawBorder: false }, ticks: {
                        color: textColor, font: { family: "'Poppins', sans-serif" },
                        callback: function (value) {
                            if (value >= 1000000) return (value / 1000000) + 'M';
                            if (value >= 1000) return (value / 1000) + 'K';
                            return value;
                        }
                    }
                }
            }
        }
    });
}

function exportToCSV() {
    if (data.length === 0) {
        alert("Belum ada data untuk diekspor!");
        return;
    }

    let csv = "Tanggal,Waktu,Nominal (Rp)\n";
    data.forEach(d => {
        csv += `${d.date},${d.time},${d.value}\n`;
    });

    let blob = new Blob([csv], { type: 'text/csv' });
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'riwayat_pembukuan.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function save() { localStorage.setItem("data", JSON.stringify(data)); }

function reset() {
    if (confirm("Apakah Anda yakin ingin menghapus semua data?")) {
        data = [];
        save();
        render();
        stats();
        chartUpdate();
    }
}

/* =========================
   INITIALIZATION
========================= */
window.onload = function () {
    initTheme();
    checkLogin();
    renderCalendar();
    render();
    stats();
    bkRender();
    bkStats();
    if (typeof bkChartUpdate === "function") bkChartUpdate();

    // Slight delay to ensure canvas is ready if hidden
    setTimeout(chartUpdate, 100);
};

/* =========================
   MINI CALCULATOR
========================= */
let calcCurrent  = "0";
let calcPrev     = "";
let calcOperator = "";
let calcReset    = false;

function calcUpdateDisplay() {
    let display = document.getElementById("calc-display");
    if (!display) return;
    
    if (calcCurrent === "Error") {
        display.innerText = "Error";
        return;
    }

    let parts = calcCurrent.split(".");
    let intPart = parts[0];
    let decPart = parts.length > 1 ? "," + parts[1] : (calcCurrent.endsWith(".") ? "," : "");

    // Format titik untuk ribuan (mengabaikan tanda minus di depan)
    let isNegative = intPart.startsWith("-");
    if (isNegative) intPart = intPart.substring(1);
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (isNegative) intPart = "-" + intPart;

    let txt = intPart + decPart;

    // Potong angka panjang agar tidak overflow
    if (calcCurrent.length > 12 && !calcCurrent.includes("e")) {
        txt = parseFloat(calcCurrent).toExponential(3).replace(".", ",");
    }

    display.innerText = txt;
}

function calcNum(n) {
    if (calcReset) { calcCurrent = ""; calcReset = false; }
    if (calcCurrent === "0" && n !== ".") calcCurrent = "";
    calcCurrent += n;
    calcUpdateDisplay();
}

function calcDot() {
    if (calcReset) { calcCurrent = "0"; calcReset = false; }
    if (!calcCurrent.includes(".")) calcCurrent += ".";
    calcUpdateDisplay();
}

function calcOp(op) {
    if (calcPrev !== "" && calcOperator && !calcReset) calcEquals(true);
    calcPrev     = calcCurrent;
    calcOperator = op;
    calcReset    = true;
}

function calcEquals(internal) {
    if (!calcOperator || calcPrev === "") return;
    let a = parseFloat(calcPrev);
    let b = parseFloat(calcCurrent);
    let result = 0;
    if (calcOperator === "+") result = a + b;
    if (calcOperator === "-") result = a - b;
    if (calcOperator === "*") result = a * b;
    if (calcOperator === "/") result = b !== 0 ? a / b : "Error";
    calcCurrent  = String(parseFloat(result.toFixed(10)));
    calcPrev     = "";
    calcOperator = "";
    calcReset    = !internal;
    calcUpdateDisplay();
}

function calcClear() {
    calcCurrent  = "0";
    calcPrev     = "";
    calcOperator = "";
    calcReset    = false;
    calcUpdateDisplay();
}

function calcDel() {
    if (calcReset) { calcClear(); return; }
    calcCurrent = calcCurrent.length > 1 ? calcCurrent.slice(0, -1) : "0";
    calcUpdateDisplay();
}

function calcPercent() {
    calcCurrent = String(parseFloat(calcCurrent) / 100);
    calcUpdateDisplay();
}

/* =========================
   PEMBUKUAN (BOOKKEEPING)
========================= */
let bkData = JSON.parse(localStorage.getItem("bkData")) || [];

let bkChart = null;

function bkChartUpdate() {
    let canvas = document.getElementById("bk-chart");
    if (!canvas) return;

    let ctx = canvas.getContext("2d");
    if (bkChart) bkChart.destroy();

    let isLight    = document.body.classList.contains("light-mode");
    let textColor  = isLight ? "#475569" : "#94a3b8";
    let titleColor = isLight ? "#1e293b" : "#ffffff";
    let gridColor  = isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
    let tooltipBg  = isLight ? "rgba(255,255,255,0.95)" : "rgba(15,23,42,0.9)";

    // Buat 7 label hari terakhir (YYYY-MM-DD)
    let labels    = [];
    let labelDisp = [];
    let dayNames  = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
    for (let i = 6; i >= 0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toISOString().split("T")[0]);
        labelDisp.push(dayNames[d.getDay()] + " " + String(d.getDate()).padStart(2,"0") + "/" + String(d.getMonth()+1).padStart(2,"0"));
    }

    // Hitung total per hari
    let incomeData  = labels.map(day => bkData.filter(d => d.rawDate === day && d.type === "pemasukan").reduce((s,d) => s + d.nominal, 0));
    let expenseData = labels.map(day => bkData.filter(d => d.rawDate === day && d.type === "pengeluaran").reduce((s,d) => s + d.nominal, 0));

    bkChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labelDisp,
            datasets: [
                {
                    label: "Pemasukan",
                    data: incomeData,
                    backgroundColor: "rgba(16,185,129,0.7)",
                    borderColor: "#10b981",
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: "Pengeluaran",
                    data: expenseData,
                    backgroundColor: "rgba(239,68,68,0.7)",
                    borderColor: "#ef4444",
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: textColor, font: { family: "'Poppins', sans-serif", size: 12 }, usePointStyle: true, pointStyle: "circle" }
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: titleColor,
                    bodyColor: textColor,
                    padding: 10,
                    displayColors: true,
                    callbacks: { label: ctx => " " + formatRupiah(ctx.raw) }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: "'Poppins', sans-serif", size: 11 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { family: "'Poppins', sans-serif", size: 11 },
                        callback: v => v >= 1000000 ? (v/1000000)+"M" : v >= 1000 ? (v/1000)+"K" : v
                    }
                }
            }
        }
    });
}

function bkSave() {
    localStorage.setItem("bkData", JSON.stringify(bkData));
}

function bkAdd() {
    let type     = document.getElementById("bk-type").value;
    let category = document.getElementById("bk-category").value;
    let desc     = document.getElementById("bk-desc").value.trim();
    let nominal  = Number(document.getElementById("bk-nominal").value);

    if (!nominal || nominal <= 0) {
        alert("Nominal harus diisi dan lebih dari 0!");
        return;
    }

    let now = new Date();
    bkData.push({
        id: Date.now(),
        type: type,
        category: category,
        desc: desc,
        nominal: nominal,
        date: now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
        rawDate: now.toISOString().split("T")[0],
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    });

    document.getElementById("bk-desc").value    = "";
    document.getElementById("bk-nominal").value = "";

    bkSave();
    bkRender();
    bkStats();
    if (typeof bkChartUpdate === "function") bkChartUpdate();
}

function bkDelete(id) {
    bkData = bkData.filter(d => d.id !== id);
    bkSave();
    bkRender();
    bkStats();
    if (typeof bkChartUpdate === "function") bkChartUpdate();
}

function bkStats() {
    let totalIn  = bkData.filter(d => d.type === "pemasukan").reduce((a, b) => a + b.nominal, 0);
    let totalOut = bkData.filter(d => d.type === "pengeluaran").reduce((a, b) => a + b.nominal, 0);
    let balance  = totalIn - totalOut;

    let inEl  = document.getElementById("bk-total-in");
    let outEl = document.getElementById("bk-total-out");
    let balEl = document.getElementById("bk-balance");
    let boxEl = document.getElementById("bk-balance-box");

    if (inEl)  inEl.innerText  = formatRupiah(totalIn);
    if (outEl) outEl.innerText = formatRupiah(totalOut);
    if (balEl) {
        balEl.innerText = formatRupiah(Math.abs(balance));
        balEl.style.color = balance >= 0 ? "#10b981" : "#ef4444";
    }
    if (boxEl) {
        boxEl.style.borderColor = balance >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)";
        boxEl.style.background  = balance >= 0 ? "rgba(16,185,129,0.05)" : "rgba(239,68,68,0.05)";
    }
}

function bkRender() {
    let list = document.getElementById("bk-list");
    if (!list) return;

    list.innerHTML = "";

    if (bkData.length === 0) {
        list.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding: 20px;">Belum ada transaksi pembukuan.</div>`;
        return;
    }

    let search   = (document.getElementById("bk-search")?.value || "").toLowerCase();
    let filter   = document.getElementById("bk-filter")?.value || "semua";
    let sort     = document.getElementById("bk-sort")?.value || "newest";

    let result = [...bkData].reverse();

    // Filter tipe
    if (filter !== "semua") result = result.filter(d => d.type === filter);

    // Filter pencarian
    if (search) {
        result = result.filter(d =>
            (d.desc     && d.desc.toLowerCase().includes(search)) ||
            (d.category && d.category.toLowerCase().includes(search)) ||
            String(d.nominal).includes(search) ||
            (d.date && d.date.toLowerCase().includes(search))
        );
    }

    // Sort
    if (sort === "oldest")  result = result.reverse();
    if (sort === "highest") result = result.sort((a, b) => b.nominal - a.nominal);
    if (sort === "lowest")  result = result.sort((a, b) => a.nominal - b.nominal);

    if (result.length === 0) {
        list.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding: 20px;">Tidak ada data yang cocok.</div>`;
        return;
    }

    result.forEach(d => {
        let isIn     = d.type === "pemasukan";
        let color    = isIn ? "#10b981" : "#ef4444";
        let badge    = isIn ? "💚 Pemasukan" : "❤️ Pengeluaran";
        let sign     = isIn ? "+" : "−";
        let descHtml = d.desc ? `<span style="font-size:12px; color:var(--accent-cyan); font-style:italic;">📝 ${d.desc}</span>` : "";

        list.innerHTML += `
            <div class="item" style="border-left: 3px solid ${color};">
                <div class="item-info" style="flex: 1;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="item-val" style="color:${color};">${sign} ${formatRupiah(d.nominal)}</span>
                        <span style="font-size:11px; background:${isIn ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${color}; padding:2px 8px; border-radius:20px; font-weight:600;">${badge}</span>
                        <span style="font-size:11px; background:var(--item-bg); color:var(--text-muted); padding:2px 8px; border-radius:20px;">🏷️ ${d.category}</span>
                    </div>
                    ${descHtml}
                    <span class="item-date">📅 ${d.date} • 🕒 ${d.time}</span>
                </div>
                <button class="btn-del" onclick="bkDelete(${d.id})" title="Hapus">Hapus</button>
            </div>`;
    });
}

function bkExportCSV() {
    if (bkData.length === 0) { alert("Belum ada data pembukuan!"); return; }
    let csv = "Tanggal,Waktu,Tipe,Kategori,Keterangan,Nominal (Rp)\n";
    bkData.forEach(d => {
        csv += `${d.date},${d.time},${d.type},${d.category},"${d.desc || ""}",${d.nominal}\n`;
    });
    let blob = new Blob([csv], { type: 'text/csv' });
    let url  = window.URL.createObjectURL(blob);
    let a    = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'pembukuan.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}