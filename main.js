// ===================================
// Bremen Shift Management App
// ===================================

// ===================================
// Data Store
// ===================================
const STORAGE_KEYS = {
    USERS: 'bremen_users',
    SHIFTS: 'bremen_shifts',
    PRESETS: 'bremen_presets'
};

// Sample Users Data
const defaultUsers = [
    { id: 'u1', name: 'たいせい' },
    { id: 'u2', name: 'あじん' },
    { id: 'u3', name: 'さな' },
    { id: 'u4', name: 'いつき' }
];

// Default Time Presets
const defaultPresets = [
    { inTime: '11:00', outTime: '24:00', label: '11-24' },
    { inTime: '13:00', outTime: '18:00', label: '13-18' },
    { inTime: '17:00', outTime: '22:00', label: '17-22' }
];

// Sample Shifts Data (January 2026)
// Sample Shifts Data (Empty by default)
const defaultShifts = [];

// Store class
class Store {
    constructor() {
        this.initData();
    }

    initData() {
        if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));
        }
        if (!localStorage.getItem(STORAGE_KEYS.SHIFTS)) {
            localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(defaultShifts));
        }
    }

    getUsers() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
    }

    getUserById(id) {
        return this.getUsers().find(u => u.id === id);
    }

    getShifts() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.SHIFTS)) || [];
    }

    getShiftsByDate(date) {
        return this.getShifts().filter(s => s.date === date);
    }

    getShiftsByMonth(year, month) {
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        return this.getShifts().filter(s => s.date.startsWith(prefix));
    }

    saveShift(shift) {
        const shifts = this.getShifts();
        const existingIndex = shifts.findIndex(s => s.id === shift.id);

        if (existingIndex >= 0) {
            shifts[existingIndex] = shift;
        } else {
            shift.id = 's' + Date.now();
            shifts.push(shift);
        }

        localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));

        // Auto Sync Trigger
        if (window.syncManager) window.syncManager.autoSync();

        return shift;
    }

    deleteShift(shiftId) {
        const shifts = this.getShifts().filter(s => s.id !== shiftId);
        localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
        if (window.syncManager) window.syncManager.autoSync();
    }

    // User CRUD
    addUser(name) {
        const users = this.getUsers();
        const newUser = {
            id: 'u' + Date.now(),
            name
        };
        users.push(newUser);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        if (window.syncManager) window.syncManager.autoSync();
        return newUser;
    }

    updateUser(id, name) {
        const users = this.getUsers();
        const index = users.findIndex(u => u.id === id);
        if (index >= 0) {
            users[index] = { ...users[index], name };
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            if (window.syncManager) window.syncManager.autoSync();
        }
    }

    deleteUser(id) {
        const users = this.getUsers().filter(u => u.id !== id);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        if (window.syncManager) window.syncManager.autoSync();
    }

    // Preset Config
    getPresets() {
        const saved = localStorage.getItem(STORAGE_KEYS.PRESETS);
        return saved ? JSON.parse(saved) : defaultPresets;
    }

    addPreset(inTime, outTime) {
        const presets = this.getPresets();
        // Check duplicate
        if (presets.some(p => p.inTime === inTime && p.outTime === outTime)) return;

        presets.push({
            inTime,
            outTime,
            label: `${inTime.split(':')[0]}-${outTime.split(':')[0]}`
        });
        localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
    }

    deletePreset(index) {
        const presets = this.getPresets();
        presets.splice(index, 1);
        localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
    }

    // Import/Export for Sync
    getAllData() {
        return {
            users: this.getUsers(),
            shifts: this.getShifts()
        };
    }

    setAllData(data) {
        if (data.users && Array.isArray(data.users)) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
        }
        if (data.shifts && Array.isArray(data.shifts)) {
            localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(data.shifts));
        }
    }
}

const store = new Store();

// ===================================
// Sync Manager
// ===================================
class SyncManager {
    constructor() {
        this.statusEl = document.getElementById('sync-status');
        this.urlInput = document.getElementById('gas-url');

        // 配布設定: ここにGASのWebアプリURL（https://.../exec）を貼り付けると、スタッフ全員の初期設定が完了します
        const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbw33lRspaa717xCYcTJrTX3f7fQIntzmh6gELPgdF_dBWCSRsd_rNpMp6XFC0hJHMQsEA/exec";

        // Load saved URL
        const savedUrl = localStorage.getItem('bremen_gas_url');
        if (savedUrl) {
            this.urlInput.value = savedUrl;
        } else if (DEFAULT_GAS_URL) {
            this.urlInput.value = DEFAULT_GAS_URL;
            localStorage.setItem('bremen_gas_url', DEFAULT_GAS_URL);
        }

        this.urlInput.addEventListener('change', () => {
            localStorage.setItem('bremen_gas_url', this.urlInput.value);
        });
    }

    setStatus(msg, type = 'loading') {
        if (!this.statusEl) return;
        this.statusEl.textContent = msg;
        this.statusEl.className = `sync-status ${type}`;
    }

    getAppUrl() {
        const url = this.urlInput.value.trim();
        if (!url) {
            this.setStatus('GAS Web App URLを入力してください', 'error');
            return null;
        }
        return url;
    }

    // Auto Sync
    async autoSync() {
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.setStatus('保存中...', 'loading');

        this.syncTimeout = setTimeout(() => {
            this.upload().then(() => {
                this.setStatus('自動保存完了', 'success');
                setTimeout(() => {
                    this.setStatus('');
                }, 2000);
            });
        }, 1000); // 1 sec debounce
    }

    async upload() {
        const url = this.getAppUrl();
        if (!url) return;

        this.setStatus('アップロード中...', 'loading');

        try {
            const rawData = store.getAllData();

            // Sanitize data
            const sanitizedData = {
                users: rawData.users.map(u => {
                    const { hourlyRate, ...cleanUser } = u;
                    return cleanUser;
                }),
                shifts: rawData.shifts
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(sanitizedData)
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.setStatus('保存完了: ' + new Date().toLocaleTimeString(), 'success');
                showToast('クラウドに保存しました');
            } else {
                throw new Error(result.message || 'Unknown error');
            }
        } catch (e) {
            console.error(e);
            this.setStatus('送信エラー: ' + e.message, 'error');
            showToast('送信に失敗しました', 'error');
        }
    }

    async download(silent = false) {
        const url = this.getAppUrl();
        if (!url) return;

        if (!silent) this.setStatus('データを取得中...', 'loading');

        try {
            const response = await fetch(url + '?action=get');
            const result = await response.json();

            if (result.status === 'success' && result.data) {
                const cloudUsers = result.data.users || [];
                const cloudShifts = result.data.shifts || [];

                // Empty check only if manual download
                if (!silent && cloudUsers.length === 0 && cloudShifts.length === 0) {
                    if (!confirm('クラウド上のデータが空のようです。\n現在のデータを消去して上書きしますか？')) {
                        this.setStatus('キャンセルされました', 'error');
                        return;
                    }
                }

                // Check for updates (Simple JSON comparison)
                const currentData = store.getAllData();
                const currentStr = JSON.stringify({ users: currentData.users, shifts: currentData.shifts });
                const newStr = JSON.stringify({ users: cloudUsers, shifts: cloudShifts });

                if (currentStr !== newStr) {
                    store.setAllData(result.data);
                    this.setStatus('受信完了: ' + new Date().toLocaleTimeString(), 'success');
                    if (!silent) showToast('データを更新しました');

                    // Always refresh UI if updated
                    renderAdminView();
                    switchView(appState.currentView);
                } else {
                    if (!silent) {
                        this.setStatus('最新です', 'success');
                        showToast('データは最新です');
                    }
                }
            } else {
                throw new Error(result.message || 'Invalid data');
            }
        } catch (e) {
            if (!silent) {
                console.error(e);
                this.setStatus('受信エラー: ' + e.message, 'error');
                showToast('受信に失敗しました', 'error');
            }
        }
    }
}


// ===================================
// Utility Functions
// ===================================
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr) {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[d.getDay()];
    return `${month}月${day}日 (${weekday})`;
}

function formatMonth(year, month) {
    return `${year}年${month}月`;
}

function calculateHours(inTime, outTime) {
    if (!inTime || !outTime) return 0;
    // Guard against non-string inputs (e.g. if partial download occurred)
    if (typeof inTime !== 'string' || typeof outTime !== 'string') return 0;

    if (inTime === '00:00' && outTime === '00:00') return 0;

    const [inH, inM] = inTime.split(':').map(Number);
    let [outH, outM] = outTime.split(':').map(Number);

    // Check for parsing errors
    if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return 0;

    // Handle times past midnight (e.g., 24:00)
    // Legacy support: if out is 00:00 (midnight), treat as 24:00
    if (outH === 0 && outM === 0) {
        // If inTime is NOT 00:00 (special case), then 00:00 out means 24:00
        outH = 24;
    }

    // Normal calculation adjusting for next day logic handled by input values (24:00, 25:00 etc)
    // If input is like 01:00 (next day), logic needs to know context. 
    // Here we assume inputs >= 24:00 come as is.

    // If we receive "01:00" and inTime is "23:00", we should treat 01 as 25.
    // However, our dropdowns provide 25:00 values directly.
    if (outH < inH) outH += 24;

    const inMinutes = inH * 60 + inM;
    const outMinutes = outH * 60 + outM;

    const result = (outMinutes - inMinutes) / 60;
    return isNaN(result) ? 0 : result;
}

function formatTimeRange(inTime, outTime) {
    if (!inTime || !outTime) return '未設定';
    if (inTime === '00:00' && outTime === '00:00') return '-';
    return `${inTime} 〜 ${outTime}`;
}

function getWorkStatus(inTime, outTime) {
    if (!inTime || !outTime) return 'off';
    if (inTime === '00:00' && outTime === '00:00') return 'note';

    const now = new Date();
    let currentMinutes = now.getHours() * 60 + now.getMinutes();

    // If it's early morning (0-5am), add 24 hours to match the 24-29 range
    if (now.getHours() < 5) {
        currentMinutes += 24 * 60;
    }

    const [inH, inM] = inTime.split(':').map(Number);
    let [outH, outM] = outTime.split(':').map(Number);

    // Legacy mapping: 00:00 -> 24:00
    if (outH === 0 && outM === 0) outH = 24;
    if (outH < inH) outH += 24;

    const inMinutes = inH * 60 + inM;
    const outMinutes = outH * 60 + outM;

    if (currentMinutes >= inMinutes && currentMinutes < outMinutes) {
        return 'working';
    } else if (currentMinutes < inMinutes) {
        if (inMinutes - currentMinutes <= 120) return 'upcoming';
    }
    return 'off';
}

function getInitial(name) {
    return name ? name.charAt(0) : '?';
}

function generateTimeOptions() {
    const options = ['<option value="">--:--</option>'];
    for (let h = 9; h < 30; h++) { // 09:00 to 29:00
        for (let m = 0; m < 60; m += 30) {
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            // For saving, we might want to normalize >=24 to next day 00+, but for simplicity let's store as is
            // Display logic
            let displayStr = timeStr;
            options.push(`<option value="${timeStr}">${displayStr}</option>`);
        }
    }
    return options.join('');
}

// ===================================
// App State
// ===================================
const appState = {
    currentView: 'home',
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth() + 1,
    summaryYear: new Date().getFullYear(),
    summaryMonth: new Date().getMonth() + 1,
    selectedDate: null,
    editingShift: null
};

// ===================================
// View Rendering
// ===================================

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const view = document.getElementById(`${viewName}-view`);
    const btn = document.querySelector(`[data-view="${viewName}"]`);

    if (view) view.classList.add('active');
    if (btn) btn.classList.add('active');

    appState.currentView = viewName;

    // Render view content
    switch (viewName) {
        case 'home':
            renderHomeView();
            break;
        case 'calendar':
            renderCalendarView();
            break;
        case 'summary':
            renderSummaryView();
            break;
        case 'admin':
            renderAdminView();
            break;
    }
}

function renderHomeView() {
    const today = formatDate(new Date());
    const todayShifts = store.getShiftsByDate(today);

    document.getElementById('today-date').textContent = formatDisplayDate(today);

    const container = document.getElementById('today-staff-list');

    if (todayShifts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <p class="empty-text">本日の出勤者はいません</p>
            </div>
        `;
        return;
    }

    todayShifts.sort((a, b) => {
        if (a.inTime === '00:00') return 1;
        if (b.inTime === '00:00') return -1;
        return a.inTime.localeCompare(b.inTime);
    });

    container.innerHTML = todayShifts.map(shift => {
        const user = store.getUserById(shift.userId);
        if (!user) return ''; // Skip deleted users
        const status = getWorkStatus(shift.inTime, shift.outTime);
        const statusLabel = status === 'working' ? '勤務中' : status === 'upcoming' ? '出勤予定' : '';

        return `
            <div class="staff-card ${status} ${shift.note ? 'has-note' : ''}" data-shift-id="${shift.id}">
                <div class="staff-avatar">${getInitial(user.name)}</div>
                <div class="staff-info">
                    <div class="staff-name">${user.name}</div>
                    <div class="staff-time">${formatTimeRange(shift.inTime, shift.outTime)}</div>
                    ${shift.note ? `<div class="staff-note">${shift.note}</div>` : ''}
                </div>
                ${statusLabel ? `<span class="staff-status ${status}">${statusLabel}</span>` : ''}
            </div>
        `;
    }).join('');

    container.querySelectorAll('.staff-card').forEach(card => {
        card.addEventListener('click', () => {
            const shiftId = card.dataset.shiftId;
            openEditView(shiftId);
        });
    });
}

function renderCalendarView() {
    const { calendarYear, calendarMonth } = appState;
    document.getElementById('current-month').textContent = formatMonth(calendarYear, calendarMonth);

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    const firstDay = new Date(calendarYear, calendarMonth - 1, 1);
    const lastDay = new Date(calendarYear, calendarMonth, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const today = formatDate(new Date());
    const shiftsThisMonth = store.getShiftsByMonth(calendarYear, calendarMonth);

    // Prev month
    const prevMonthLastDay = new Date(calendarYear, calendarMonth - 1, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        grid.innerHTML += `<div class="calendar-cell other-month"><span class="cell-date">${day}</span></div>`;
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === today;
        const shiftsOnDay = shiftsThisMonth.filter(s => s.date === dateStr);

        // Sort shifts by time for better visual order
        shiftsOnDay.sort((a, b) => a.inTime.localeCompare(b.inTime));

        const membersHtml = shiftsOnDay.map(s => {
            const user = store.getUserById(s.userId);
            return user ? `<span class="member-dot" title="${user.name}">${getInitial(user.name)}</span>` : '';
        }).join('');

        grid.innerHTML += `
            <div class="calendar-cell ${isToday ? 'today' : ''}" data-date="${dateStr}">
                <span class="cell-date">${day}</span>
                <div class="cell-members">${membersHtml}</div>
            </div>
        `;
    }

    // Next month
    const totalCells = startDayOfWeek + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
        grid.innerHTML += `<div class="calendar-cell other-month"><span class="cell-date">${i}</span></div>`;
    }

    grid.querySelectorAll('.calendar-cell:not(.other-month)').forEach(cell => {
        cell.addEventListener('click', () => {
            const date = cell.dataset.date;
            if (date) openDayDetailView(date);
        });
    });
}

function openDayDetailView(date) {
    appState.selectedDate = date;
    document.getElementById('detail-date').textContent = formatDisplayDate(date);

    const shifts = store.getShiftsByDate(date);
    const container = document.getElementById('day-staff-list');

    if (shifts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p class="empty-text">この日のシフトはありません</p>
            </div>
        `;
    } else {
        container.innerHTML = shifts.map(shift => {
            const user = store.getUserById(shift.userId);
            if (!user) return `
                 <div class="staff-card disabled">
                    <div class="staff-avatar">?</div>
                    <div class="staff-info"><div class="staff-name">削除されたスタッフ</div></div>
                 </div>`;
            const hours = calculateHours(shift.inTime, shift.outTime);

            return `
                <div class="staff-card ${shift.note ? 'has-note' : ''}" data-shift-id="${shift.id}">
                    <div class="staff-avatar">${getInitial(user.name)}</div>
                    <div class="staff-info">
                        <div class="staff-name">${user.name}</div>
                        <div class="staff-time">
                            ${formatTimeRange(shift.inTime, shift.outTime)}
                            ${hours > 0 ? `<span style="color: var(--text-muted)">(${hours}h)</span>` : ''}
                        </div>
                        ${shift.note ? `<div class="staff-note">${shift.note}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.staff-card').forEach(card => {
            card.addEventListener('click', () => {
                const shiftId = card.dataset.shiftId;
                if (shiftId) openEditView(shiftId);
            });
        });
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('day-detail-view').classList.add('active');
}

// ===================================
// Admin / Staff Management
// ===================================
function renderAdminView() {
    const users = store.getUsers();
    const shifts = store.getShifts(); // Get all shifts for stats

    // Update stats
    const userCountEl = document.getElementById('user-count');
    const shiftCountEl = document.getElementById('shift-count');
    if (userCountEl) userCountEl.textContent = `${users.length}名`;
    if (shiftCountEl) shiftCountEl.textContent = `${shifts.length}件`;

    // Reset Button Logic
    const resetBtn = document.getElementById('reset-shifts-btn');
    if (resetBtn) {
        // Remove old listener to prevent duplicates (simple cloned replacement or just re-assigning onclick)
        resetBtn.onclick = function () {
            if (shifts.length === 0) {
                showToast('削除するデータがありません', 'error');
                return;
            }
            if (!confirm('【警告】\nすべてのシフト履歴（過去・未来含む）を削除します。\n一度削除すると復元できません。\n\n本当に実行しますか？')) {
                return;
            }
            if (!confirm('本当に削除してよろしいですか？\n念のため最終確認です。')) {
                return;
            }

            // Execute delete
            localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify([]));
            showToast('すべてのデータを削除しました', 'success');
            renderAdminView(); // Refresh stats
        };
    }

    const container = document.getElementById('admin-staff-list');

    if (container) {
        container.innerHTML = users.map(u => `
            <div class="admin-card">
                <div class="admin-card-info">
                    <div class="staff-avatar">${getInitial(u.name)}</div>
                    <div>
                        <div class="staff-name">${u.name}</div>
                    </div>
                </div>
                <button class="admin-action-btn" onclick="openStaffModal('${u.id}')">編集</button>
            </div>
        `).join('');
    }
}

// Modal Logic
window.openStaffModal = function (userId = null) {
    const modal = document.getElementById('staff-modal');
    const deleteBtn = document.getElementById('delete-staff-btn');
    const title = document.getElementById('staff-modal-title');

    if (userId) {
        const user = store.getUserById(userId);
        if (user) {
            document.getElementById('staff-id').value = user.id;
            document.getElementById('staff-name').value = user.name;
            title.textContent = 'スタッフ編集';
            deleteBtn.style.display = 'block';
        }
    } else {
        document.getElementById('staff-id').value = '';
        document.getElementById('staff-name').value = '';
        title.textContent = 'スタッフ追加';
        deleteBtn.style.display = 'none';
    }

    modal.classList.add('active');
};

window.closeStaffModal = function () {
    document.getElementById('staff-modal').classList.remove('active');
};

window.saveStaff = function () {
    const id = document.getElementById('staff-id').value;
    const name = document.getElementById('staff-name').value;

    if (!name) {
        showToast('名前を入力してください', 'error');
        return;
    }

    if (id) {
        store.updateUser(id, name);
        showToast('スタッフ情報を更新しました');
    } else {
        store.addUser(name);
        showToast('スタッフを追加しました');
    }

    closeStaffModal();
    renderAdminView();
};

window.deleteStaff = function () {
    const id = document.getElementById('staff-id').value;
    if (id && confirm('このスタッフを削除しますか？')) {
        store.deleteUser(id);
        showToast('スタッフを削除しました', 'success');
        closeStaffModal();
        renderAdminView();
    }
};

// ===================================
// Enhanced Edit View Logic
// ===================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success' ? '✅' : '⚠️';

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function renderStaffSelector(selectedId) {
    const users = store.getUsers();
    const container = document.getElementById('staff-selector');

    container.innerHTML = users.map(u => `
        <div class="staff-option ${u.id === selectedId ? 'selected' : ''}" data-id="${u.id}">
            <div class="staff-avatar">${getInitial(u.name)}</div>
            <div class="staff-name">${u.name}</div>
        </div>
    `).join('');

    // Add click listeners
    container.querySelectorAll('.staff-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.staff-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            document.getElementById('edit-staff').value = opt.dataset.id;
        });
    });
}

function renderAdminPresets() {
    const presets = store.getPresets();
    const container = document.getElementById('admin-preset-list');
    if (!container) return;

    container.innerHTML = presets.map((p, index) => `
        <div class="preset-item">
            <span class="preset-label">${p.inTime} 〜 ${p.outTime}</span>
            <button class="delete-btn text-only small" onclick="deletePreset(${index})">削除</button>
        </div>
    `).join('');
}

window.deletePreset = function (index) {
    if (confirm('このプリセットを削除しますか？')) {
        store.deletePreset(index);
        renderAdminView();
    }
};

function initPresetAdder() {
    const inSelect = document.getElementById('new-preset-in');
    const outSelect = document.getElementById('new-preset-out');
    const addBtn = document.getElementById('add-preset-btn');

    if (!inSelect || !outSelect || !addBtn) return;

    // Only populate if empty (prevent reset on re-render)
    if (inSelect.options.length === 0) {
        const optionsHTML = generateTimeOptions();
        inSelect.innerHTML = optionsHTML;
        outSelect.innerHTML = optionsHTML;
    }

    // Remove old listener
    addBtn.replaceWith(addBtn.cloneNode(true));
    document.getElementById('add-preset-btn').addEventListener('click', () => {
        const inTime = inSelect.value;
        const outTime = outSelect.value;
        if (!inTime || !outTime) {
            showToast('時間を設定してください', 'error');
            return;
        }
        store.addPreset(inTime, outTime);
        showToast('プリセットを追加しました');
        renderAdminView();
    });
}

function initTimePresets() {
    const inInput = document.getElementById('edit-in-time');
    const outInput = document.getElementById('edit-out-time');
    const container = document.getElementById('time-presets');

    // Populate dropdowns if empty
    if (inInput.options.length <= 1) {
        const optionsHtml = generateTimeOptions();
        inInput.innerHTML = optionsHtml;
        outInput.innerHTML = optionsHtml;
    }

    // Render Dynamic Presets
    const presets = store.getPresets();
    let html = presets.map(p =>
        `<button class="preset-btn" data-in="${p.inTime}" data-out="${p.outTime}">${p.label || (p.inTime + '-' + p.outTime)}</button>`
    ).join('');

    html += `<button class="preset-btn outline" id="clear-time-btn">クリア</button>`;
    container.innerHTML = html;

    // Attach Listeners
    container.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.id === 'clear-time-btn') {
                inInput.value = '';
                outInput.value = '';
                container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                return;
            }

            inInput.value = btn.dataset.in;
            outInput.value = btn.dataset.out;

            container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Remove active class when manually changed
    [inInput, outInput].forEach(input => {
        input.addEventListener('change', () => {
            container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        });
    });
}

function initNoteChips() {
    const noteInput = document.getElementById('edit-note');

    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const val = btn.dataset.val;
            if (val === '') {
                // "Normal" means no note, but user can still type in text field
                // If they previously selected a preset note, clear it only if it matches
                const currentNote = noteInput.value;
                if (['台湾出張', '休暇', '半休'].includes(currentNote)) {
                    noteInput.value = '';
                }
            } else {
                noteInput.value = val;
            }
        });
    });

    // Detect manual input to deselect chips if not matching
    noteInput.addEventListener('input', () => {
        const val = noteInput.value;
        document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));

        if (val === '') {
            document.querySelector('.chip-btn[data-val=""]').classList.add('active');
        } else {
            const match = document.querySelector(`.chip-btn[data-val="${val}"]`);
            if (match) match.classList.add('active');
        }
    });
}

function openEditView(shiftId = null) {
    const users = store.getUsers();
    let defaultStaffId = users.length > 0 ? users[0].id : null;

    if (shiftId) {
        const shift = store.getShifts().find(s => s.id === shiftId);
        if (shift) {
            appState.editingShift = shift;
            defaultStaffId = shift.userId;

            document.getElementById('edit-staff').value = shift.userId;
            renderStaffSelector(shift.userId);

            document.getElementById('edit-date').value = shift.date;
            document.getElementById('edit-in-time').value = shift.inTime;
            document.getElementById('edit-out-time').value = shift.outTime;
            document.getElementById('edit-note').value = shift.note || '';
            document.getElementById('delete-shift-btn').style.display = 'block';

            const noteVal = shift.note || '';
            document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
            const chip = document.querySelector(`.chip-btn[data-val="${noteVal}"]`) || document.querySelector('.chip-btn[data-val=""]');
            if (chip) chip.classList.add('active');
        }
    } else {
        appState.editingShift = null;
        document.getElementById('edit-staff').value = defaultStaffId;
        renderStaffSelector(defaultStaffId);

        document.getElementById('edit-date').value = appState.selectedDate || formatDate(new Date());
        document.getElementById('edit-in-time').value = '';
        document.getElementById('edit-out-time').value = '';
        document.getElementById('edit-note').value = '';

        document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.chip-btn[data-val=""]').classList.add('active');
        document.getElementById('delete-shift-btn').style.display = 'none';
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('edit-view').classList.add('active');
}

function validateShift(shift) {
    if (!shift.userId) return 'スタッフを選択してください';
    if (!shift.date) return '日付を選択してください';

    if (shift.inTime && shift.outTime) {
        if (shift.inTime === shift.outTime && shift.inTime !== '00:00') {
            return '出勤時間と退勤時間が同じです';
        }
    }
    return null;
}

function saveShift() {
    const shift = {
        id: appState.editingShift?.id || null,
        userId: document.getElementById('edit-staff').value,
        date: document.getElementById('edit-date').value,
        inTime: document.getElementById('edit-in-time').value || '00:00',
        outTime: document.getElementById('edit-out-time').value || '00:00',
        note: document.getElementById('edit-note').value
    };

    const error = validateShift(shift);
    if (error) {
        showToast(error, 'error');
        return;
    }

    store.saveShift(shift);
    showToast('シフトを保存しました');

    setTimeout(() => {
        if (appState.selectedDate && appState.selectedDate === shift.date) {
            openDayDetailView(shift.date);
        } else {
            switchView('calendar');
        }
    }, 800);
}

function deleteShift() {
    if (appState.editingShift && confirm('このシフトを削除しますか？')) {
        store.deleteShift(appState.editingShift.id);
        showToast('シフトを削除しました', 'success');

        setTimeout(() => {
            if (appState.selectedDate) {
                openDayDetailView(appState.selectedDate);
            } else {
                switchView('home');
            }
        }, 500);
    }
}

function renderSummaryView() {
    const { summaryYear, summaryMonth } = appState;
    document.getElementById('summary-month').textContent = formatMonth(summaryYear, summaryMonth);

    const users = store.getUsers();
    const container = document.getElementById('summary-container');

    container.innerHTML = users.map(user => {
        const userShifts = store.getShiftsByMonth(summaryYear, summaryMonth)
            .filter(s => s.userId === user.id);

        let firstHalfHours = 0;
        let secondHalfHours = 0;

        userShifts.forEach(shift => {
            const day = parseInt(shift.date.split('-')[2]);
            const hours = calculateHours(shift.inTime, shift.outTime);

            if (day <= 15) {
                firstHalfHours += hours;
            } else {
                secondHalfHours += hours;
            }
        });

        const totalHours = firstHalfHours + secondHalfHours;

        return `
            <div class="summary-card">
                <div class="summary-header">
                    <div class="summary-avatar">${getInitial(user.name)}</div>
                    <div class="summary-name">${user.name}</div>
                </div>
                <div class="summary-stats">
                    <div class="stat-item">
                        <div class="stat-label">前半計</div>
                        <div class="stat-value">${firstHalfHours}h</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">後半計</div>
                        <div class="stat-value">${secondHalfHours}h</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Total</div>
                        <div class="stat-value total">${totalHours}h</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ===================================
// Event Listeners
// ===================================
function initEventListeners() {
    // Admin & Modal
    const addStaffBtn = document.getElementById('add-staff-btn');
    if (addStaffBtn) addStaffBtn.addEventListener('click', () => openStaffModal(null));

    document.getElementById('close-modal-btn').addEventListener('click', closeStaffModal);
    document.getElementById('save-staff-btn').addEventListener('click', saveStaff);
    document.getElementById('delete-staff-btn').addEventListener('click', deleteStaff);

    // Sync Buttons
    // const syncManager = new SyncManager(); // Use global instance
    document.getElementById('sync-upload-btn').addEventListener('click', () => window.syncManager.upload());
    document.getElementById('sync-download-btn').addEventListener('click', () => window.syncManager.download());


    // Close modal on overlay click
    document.getElementById('staff-modal').addEventListener('click', (e) => {
        if (e.target.id === 'staff-modal') closeStaffModal();
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
        });
    });

    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', () => {
        appState.calendarMonth--;
        if (appState.calendarMonth < 1) {
            appState.calendarMonth = 12;
            appState.calendarYear--;
        }
        renderCalendarView();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        appState.calendarMonth++;
        if (appState.calendarMonth > 12) {
            appState.calendarMonth = 1;
            appState.calendarYear++;
        }
        renderCalendarView();
    });

    // Summary navigation
    document.getElementById('summary-prev-month').addEventListener('click', () => {
        appState.summaryMonth--;
        if (appState.summaryMonth < 1) {
            appState.summaryMonth = 12;
            appState.summaryYear--;
        }
        renderSummaryView();
    });

    document.getElementById('summary-next-month').addEventListener('click', () => {
        appState.summaryMonth++;
        if (appState.summaryMonth > 12) {
            appState.summaryMonth = 1;
            appState.summaryYear++;
        }
        renderSummaryView();
    });

    // Day detail back button
    document.getElementById('back-to-calendar').addEventListener('click', () => {
        switchView('calendar');
    });

    // Add shift button
    const addShiftBtn = document.getElementById('add-shift-btn');
    if (addShiftBtn) {
        addShiftBtn.addEventListener('click', () => {
            openEditView(null);
        });
    }

    // Edit view buttons
    document.getElementById('back-from-edit').addEventListener('click', () => {
        if (appState.selectedDate) {
            openDayDetailView(appState.selectedDate);
        } else {
            switchView('home');
        }
    });

    document.getElementById('save-shift-btn').addEventListener('click', saveShift);
    document.getElementById('delete-shift-btn').addEventListener('click', deleteShift);

    // Init new UI components
    initTimePresets();
    initNoteChips();
}

// ===================================
// Initialize App
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    renderHomeView();

    // Auto Sync Initialization
    window.syncManager = new SyncManager();
    // 1. Initial download
    window.syncManager.download(true);
    // 2. Polling every 60 seconds
    setInterval(() => {
        window.syncManager.download(true);
    }, 60000);
});
