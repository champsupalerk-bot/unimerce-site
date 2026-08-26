/**
 * UERP Order Transactions Management Logic
 * Unimerce Co., Ltd.
 */

const supabaseUrl = "https://xygdmszernmircmbqwke.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5Z2Rtc3plcm5taXJjbWJxd2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NTY5NTAsImV4cCI6MjA5NzIzMjk1MH0.Qcq5h2TignXwhsyOe8IYcMYvlayyTjH66tTiPznVOOY";

// Initialize Supabase Client Safely
let supabaseClient = null;
if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
}

let allTransactions = [];
let filteredTransactions = [];
let selectedRowIds = new Set();
let pendingStatusChanges = {};
let currentSortColumn = 'date';
let currentSortAsc = false;

let displayLimit = 50;
const limitStep = 50;
const CACHE_KEY = 'uerp_orders_cache';
const CACHE_TIME_KEY = 'uerp_orders_cache_time';
const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 Hour Cache

document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
    fetchTransactions();
    setupInfiniteScroll();
});

async function loadHeader() {
    try {
        const res = await fetch('uerpheader.html');
        if (!res.ok) return;
        const html = await res.text();
        const headerContainer = document.getElementById('headerContainer');
        if (headerContainer) {
            headerContainer.innerHTML = html;
            const txTab = headerContainer.querySelector('[data-page="transactions"]');
            if (txTab) txTab.classList.add('chrome-tab-active');
            if (typeof window.initUerpLayout === 'function') {
                window.__uerpLayoutInitialized = false;
                window.initUerpLayout();
            }
        }
    } catch (err) {
        // Quiet catch for layout load
    }
}

function formatDateFormatted(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.substring(0, 10);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatMoney(val) {
    return '฿' + parseFloat(val || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncateLeftOrder(str) {
    if (!str) return '-';
    const s = String(str);
    if (s.length <= 6) return s;
    return '...' + s.slice(-4);
}

function updateStatus(msg, isError = false) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    if (!statusIndicator || !statusText) return;
    
    statusIndicator.classList.remove('hidden');
    statusIndicator.className = isError 
        ? "p-2 bg-red-50 rounded-md border border-red-200 text-xs text-google-red"
        : "p-2 bg-blue-50 rounded-md border border-blue-100 text-xs text-google-blue";
    statusText.innerText = msg;
}

function forceRefreshData() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
    fetchTransactions(true);
}

// Optimized Batch Fetching (1,000 Rows Chunk) with 1-Hour Cache
async function fetchTransactions(isManualRefresh = false) {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const nowTime = new Date().getTime();

    if (!isManualRefresh && cachedData && cachedTime && (nowTime - Number(cachedTime) < CACHE_EXPIRY_MS)) {
        allTransactions = JSON.parse(cachedData);
        const remainingMinutes = Math.round((CACHE_EXPIRY_MS - (nowTime - Number(cachedTime))) / 60000);
        updateExecutionLog(`Cached: ${allTransactions.length.toLocaleString()} rows (${remainingMinutes}m remaining)`);
        document.getElementById('statusIndicator').classList.add('hidden');
        applyFilters();
        return;
    }

    updateStatus('กำลังโหลดข้อมูลจาก Supabase...');
    updateExecutionLog('Fetching from Supabase DB...');

    try {
        let fetchedData = [];
        let batchSize = 1000;
        let from = 0;
        let to = batchSize - 1;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabaseClient
                .from('transactions')
                .select('*')
                .order('date', { ascending: false })
                .range(from, to);

            if (error) throw error;

            if (data && data.length > 0) {
                fetchedData = fetchedData.concat(data);
                from += batchSize;
                to += batchSize;
                if (data.length < batchSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        allTransactions = fetchedData.map((row, idx) => ({
            ...row,
            _rowId: row.id || `row_${idx}_${Date.now()}`
        }));

        localStorage.setItem(CACHE_KEY, JSON.stringify(allTransactions));
        localStorage.setItem(CACHE_TIME_KEY, nowTime.toString());

        updateExecutionLog(`Loaded: ${allTransactions.length.toLocaleString()} rows from DB`);
        document.getElementById('statusIndicator').classList.add('hidden');
        applyFilters();
    } catch (err) {
        console.error("Supabase Fetch Error:", err);
        updateStatus(`เกิดข้อผิดพลาดในการโหลด: ${err.message}`, true);
        updateExecutionLog(`Fetch Failed: ${err.message}`);
    }
}

function updateExecutionLog(msg) {
    const logEl = document.getElementById('executionLog');
    if (logEl) {
        logEl.innerHTML = `<i class="fa-solid fa-database text-google-blue"></i> ${msg}`;
    }
}

function handlePeriodChange() {
    const period = document.getElementById('periodFilter').value;
    const container = document.getElementById('customDateContainer');
    if (period === 'CUSTOM') {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
    applyFilters();
}

function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const channel = document.getElementById('channelFilter').value;
    const status = document.getElementById('statusFilter').value;
    const period = document.getElementById('periodFilter').value;
    const showPKOnly = document.getElementById('showPKToggle').checked;

    const now = new Date();
    let startFilterDate = null;
    let endFilterDate = null;

    if (period === 'TODAY') {
        startFilterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'YESTERDAY') {
        startFilterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endFilterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    } else if (period === 'THIS_WEEK') {
        const day = now.getDay() || 7;
        startFilterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
    } else if (period === 'THIS_MONTH') {
        startFilterDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'LAST_MONTH') {
        startFilterDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endFilterDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (period === 'THIS_YEAR') {
        startFilterDate = new Date(now.getFullYear(), 0, 1);
    } else if (period === 'CUSTOM') {
        const s = document.getElementById('startDate').value;
        const e = document.getElementById('endDate').value;
        if (s) startFilterDate = new Date(s);
        if (e) endFilterDate = new Date(e + 'T23:59:59');
    }

    // Map Duplicates for Invoice No & Order No
    const invoiceCounts = {};
    const orderCounts = {};
    allTransactions.forEach(item => {
        if (item.invoice_no) invoiceCounts[item.invoice_no] = (invoiceCounts[item.invoice_no] || 0) + 1;
        if (item.order_no) orderCounts[item.order_no] = (orderCounts[item.order_no] || 0) + 1;
    });

    filteredTransactions = allTransactions.filter(item => {
        if (showPKOnly && !selectedRowIds.has(item._rowId)) return false;

        const itemChannel = String(item.channel || '');
        const itemStatus = String(item.status || 'PENDING');
        
        const textMatch = !search || 
            String(item.invoice_no || '').toLowerCase().includes(search) ||
            String(item.order_no || '').toLowerCase().includes(search) ||
            String(item.item_code || '').toLowerCase().includes(search) ||
            String(item.item_name || '').toLowerCase().includes(search) ||
            String(item.customer_name || '').toLowerCase().includes(search) ||
            String(item.name || '').toLowerCase().includes(search);

        const channelMatch = (channel === 'ALL' || itemChannel.toLowerCase() === channel.toLowerCase());
        const statusMatch = (status === 'ALL' || itemStatus.toUpperCase() === status.toUpperCase());

        let dateMatch = true;
        if (startFilterDate || endFilterDate) {
            const rowDate = new Date(item.date);
            if (startFilterDate && rowDate < startFilterDate) dateMatch = false;
            if (endFilterDate && rowDate > endFilterDate) dateMatch = false;
        }

        item._isDuplicate = (invoiceCounts[item.invoice_no] > 1 || orderCounts[item.order_no] > 1);

        return textMatch && channelMatch && statusMatch && dateMatch;
    });

    // Sorting
    filteredTransactions.sort((a, b) => {
        let valA = a[currentSortColumn] ?? '';
        let valB = b[currentSortColumn] ?? '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return currentSortAsc ? -1 : 1;
        if (valA > valB) return currentSortAsc ? 1 : -1;
        return 0;
    });

    updateSortIcons();
    displayLimit = 50;
    renderTable();
}

function sortTable(column) {
    if (currentSortColumn === column) {
        currentSortAsc = !currentSortAsc;
    } else {
        currentSortColumn = column;
        currentSortAsc = true;
    }
    applyFilters();
}

function updateSortIcons() {
    ['date', 'invoice_no', 'item_code', 'item_name', 'sales_amt'].forEach(col => {
        const el = document.getElementById(`sort_${col}`);
        if (!el) return;
        if (col === currentSortColumn) {
            el.className = "ml-0.5 text-google-blue font-bold";
            el.innerHTML = currentSortAsc 
                ? `<i class="fa-solid fa-arrow-up-wide-short"></i>` 
                : `<i class="fa-solid fa-arrow-down-wide-short"></i>`;
        } else {
            el.className = "ml-0.5 text-slate-300";
            el.innerHTML = `<i class="fa-solid fa-arrow-down-wide-short"></i>`;
        }
    });
}

function renderTable() {
    const tbody = document.getElementById('txTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const total = filteredTransactions.length;
    const pageData = filteredTransactions.slice(0, displayLimit);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-google-gray">ไม่พบรายการคำสั่งซื้อ</td></tr>`;
    } else {
        pageData.forEach(row => {
            const isSelected = selectedRowIds.has(row._rowId);
            const isDup = row._isDuplicate;

            // Channel Badges
            let channelBadgeClass = "bg-slate-100 text-slate-700 border-slate-200";
            const ch = String(row.channel || '').toLowerCase();
            if (ch.includes('shopee')) channelBadgeClass = "bg-shopee text-white";
            else if (ch.includes('lazada')) channelBadgeClass = "bg-lazada text-white";
            else if (ch.includes('tiktok')) channelBadgeClass = "bg-tiktok text-white";

            const currentStatus = pendingStatusChanges[row._rowId] || row.status || 'PENDING';

            let rowBgClass = "hover:bg-slate-50";
            if (isDup) rowBgClass = "row-duplicate";
            if (isSelected) rowBgClass = "row-selected";

            const tr = document.createElement('tr');
            tr.className = `transition-colors border-b border-slate-100 cursor-pointer ${rowBgClass}`;
            
            tr.onclick = (e) => {
                if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION' || e.target.tagName === 'INPUT') return;
                toggleRowSelection(row._rowId);
            };

            tr.innerHTML = `
                <!-- Date -->
                <td class="p-2 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    ${formatDateFormatted(row.date)}
                </td>

                <!-- Invoice No (Primary Bold) & Order No (Secondary Small) -->
                <td class="p-2 text-center w-28">
                    <div class="font-bold text-slate-900 font-mono text-xs truncate max-w-[110px]" title="${row.invoice_no || '-'}">
                        ${row.invoice_no || '-'}
                    </div>
                    <div class="text-[10px] text-google-gray font-mono truncate max-w-[110px]" title="${row.order_no || '-'}">
                        ${truncateLeftOrder(row.order_no)}
                    </div>
                </td>

                <!-- Item Code -->
                <td class="p-2 text-center font-mono font-bold text-google-blue max-w-[95px] truncate" title="${row.item_code || '-'}">
                    ${row.item_code || '-'}
                    <div class="sm:hidden text-[10px] font-normal text-slate-500 truncate max-w-[95px]" title="${row.item_name || ''}">
                        ${row.item_name || ''}
                    </div>
                </td>

                <!-- Item Name -->
                <td class="p-2 text-left font-medium text-slate-800 max-w-[160px] sm:max-w-[240px] truncate" title="${row.item_name || '-'}">
                    ${row.item_name || '-'}
                </td>

                <!-- Sales Amount (Desktop Only) -->
                <td class="p-2 text-center font-bold text-slate-900 hidden sm:table-cell">
                    ${formatMoney(row.sales_amt)}
                </td>

                <!-- Channel Badge (Desktop Only) -->
                <td class="p-2 text-center hidden sm:table-cell">
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${channelBadgeClass}">
                        ${row.channel || 'Direct'}
                    </span>
                </td>

                <!-- Status Dropdown (Desktop Only) -->
                <td class="p-2 text-center hidden sm:table-cell">
                    <select onchange="handleStatusChange('${row._rowId}', this.value)" class="bg-white border border-google-border rounded px-1 py-0.5 text-[10px] font-semibold focus:outline-none focus:border-google-blue input-mobile-safe">
                        <option value="PENDING" ${currentStatus === 'PENDING' ? 'selected' : ''}>PENDING</option>
                        <option value="ACTIVE" ${currentStatus === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
                        <option value="VOID" ${currentStatus === 'VOID' ? 'selected' : ''}>VOID</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('renderedCount').innerText = pageData.length.toLocaleString();
    document.getElementById('recordCount').innerText = total.toLocaleString();
    document.getElementById('selectedCountText').innerText = selectedRowIds.size.toLocaleString();
    updatePendingChangesCount();
}

function toggleRowSelection(rowId) {
    if (selectedRowIds.has(rowId)) {
        selectedRowIds.delete(rowId);
    } else {
        selectedRowIds.add(rowId);
    }
    renderTable();
}

function handleStatusChange(rowId, newStatus) {
    pendingStatusChanges[rowId] = newStatus;
    updatePendingChangesCount();
}

function updatePendingChangesCount() {
    const count = Object.keys(pendingStatusChanges).length;
    const countEl = document.getElementById('pendingChangesCount');
    const submitBtn = document.getElementById('submitBtn');
    if (countEl) countEl.innerText = count;
    if (submitBtn) submitBtn.disabled = count === 0;
}

async function submitChanges() {
    const count = Object.keys(pendingStatusChanges).length;
    if (count === 0) return;

    updateStatus(`กำลังบันทึก ${count} รายการลง Supabase...`);

    try {
        const updatePromises = Object.keys(pendingStatusChanges).map(rowId => {
            const item = allTransactions.find(t => t._rowId === rowId);
            if (!item || !item.id) return Promise.resolve();

            const newStatus = pendingStatusChanges[rowId];
            return supabaseClient
                .from('transactions')
                .update({ status: newStatus })
                .eq('id', item.id);
        });

        await Promise.all(updatePromises);
        
        Object.keys(pendingStatusChanges).forEach(rowId => {
            const item = allTransactions.find(t => t._rowId === rowId);
            if (item) item.status = pendingStatusChanges[rowId];
        });

        pendingStatusChanges = {};
        localStorage.setItem(CACHE_KEY, JSON.stringify(allTransactions));
        
        updateStatus('บันทึกเรียบร้อย!');
        setTimeout(() => {
            const statusIndicator = document.getElementById('statusIndicator');
            if (statusIndicator) statusIndicator.classList.add('hidden');
        }, 2000);
        applyFilters();
    } catch (err) {
        console.error("Submit Error:", err);
        updateStatus(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`, true);
    }
}

function setupInfiniteScroll() {
    const container = document.querySelector('.sticky-table-container');
    if (!container) return;

    container.addEventListener('scroll', () => {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
            if (displayLimit < filteredTransactions.length) {
                const loader = document.getElementById('infiniteLoader');
                if (loader) loader.classList.remove('hidden');
                setTimeout(() => {
                    displayLimit += limitStep;
                    renderTable();
                    if (loader) loader.classList.add('hidden');
                }, 100);
            }
        }
    });
}