// ============================================================
// UNIMERCE - Transactions / Order Management
// File: /uerp/transactions.js
// ============================================================

const SUPABASE_URL = 'https://YOUR_SUPABASE_URL.supabase.co';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let allTransactions = [];
let filteredTransactions = [];
let filteredOrderGroups = [];
let selectedRowIds = new Set();
let pendingStatusChanges = {};

let currentSortColumn = 'date';
let currentSortDirection = 'desc';

let currentPeriod = 'TODAY';
let customStartDate = '';
let customEndDate = '';

let displayLimit = 100;

const TRANSACTION_CACHE_DB = 'uerp_transactions_cache_db';
const TRANSACTION_CACHE_VERSION = 1;
const TRANSACTION_CACHE_STORE = 'transactions';
const TRANSACTION_META_STORE = 'meta';
const TRANSACTION_CACHE_TTL = 24 * 60 * 60 * 1000;
const INITIAL_CACHE_DAYS = 60;
const FETCH_BATCH_SIZE = 1000;

// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    setPeriod('TODAY', false);
    loadHeader();
    fetchTransactions();
    setupInfiniteScroll();
});

// ============================================================
// HEADER
// ============================================================

async function loadHeader() {
    const header = document.getElementById('uerpHeader');
    if (!header) return;

    try {
        const response = await fetch('uerpheader.html');
        if (response.ok) {
            header.innerHTML = await response.text();
        }
    } catch (err) {
        console.error('Header Load Error:', err);
    }
}

// ============================================================
// BASIC HELPERS
// ============================================================

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatMoney(value) {
    const number = Number(value) || 0;
    return number.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString('th-TH');
}

function normalizeText(value) {
    return String(value ?? '').trim().toLowerCase();
}

function getRowId(row, index = 0) {
    if (row._rowId) return row._rowId;
    if (row.id !== undefined && row.id !== null) {
        return String(row.id);
    }

    return [
        row.date || '',
        row.invoice_no || '',
        row.item_code || '',
        index
    ].join('|');
}

// ============================================================
// INDEXED DB
// ============================================================

function openTransactionCacheDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(
            TRANSACTION_CACHE_DB,
            TRANSACTION_CACHE_VERSION
        );

        request.onupgradeneeded = event => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(TRANSACTION_CACHE_STORE)) {
                db.createObjectStore(
                    TRANSACTION_CACHE_STORE,
                    { keyPath: '_rowId' }
                );
            }

            if (!db.objectStoreNames.contains(TRANSACTION_META_STORE)) {
                db.createObjectStore(
                    TRANSACTION_META_STORE,
                    { keyPath: 'key' }
                );
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getCachedTransactions() {
    const db = await openTransactionCacheDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(
            TRANSACTION_CACHE_STORE,
            'readonly'
        );

        const store = tx.objectStore(
            TRANSACTION_CACHE_STORE
        );

        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function saveTransactionsToCache(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return;

    const db = await openTransactionCacheDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(
            TRANSACTION_CACHE_STORE,
            'readwrite'
        );

        const store = tx.objectStore(
            TRANSACTION_CACHE_STORE
        );

        rows.forEach(row => {
            store.put(row);
        });

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

async function clearTransactionCache() {
    const db = await openTransactionCacheDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(
            TRANSACTION_CACHE_STORE,
            'readwrite'
        );

        tx.objectStore(
            TRANSACTION_CACHE_STORE
        ).clear();

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

// ============================================================
// DATE RANGE
// ============================================================

function getDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    return `${y}-${m}-${d}`;
}

function getPeriodRange(period) {
    const now = new Date();

    now.setHours(0, 0, 0, 0);

    let start = new Date(now);
    let end = new Date(now);

    if (period === 'TODAY') {
        // already today
    } else if (period === 'YESTERDAY') {
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
    } else if (period === '7DAYS') {
        start.setDate(start.getDate() - 6);
    } else if (period === '30DAYS') {
        start.setDate(start.getDate() - 29);
    } else if (period === 'CUSTOM') {
        if (customStartDate) {
            start = new Date(`${customStartDate}T00:00:00`);
        }

        if (customEndDate) {
            end = new Date(`${customEndDate}T00:00:00`);
        }
    }

    end.setHours(23, 59, 59, 999);

    return {
        start: getDateString(start),
        end: getDateString(end)
    };
}

// ============================================================
// FETCH TRANSACTIONS
// ============================================================

async function fetchTransactionsFromSupabase(startDate, endDate) {
    let allRows = [];
    let offset = 0;

    while (true) {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .range(
                offset,
                offset + FETCH_BATCH_SIZE - 1
            );

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            break;
        }

        allRows = allRows.concat(data);

        if (data.length < FETCH_BATCH_SIZE) {
            break;
        }

        offset += FETCH_BATCH_SIZE;
    }

    return allRows;
}

async function loadTransactionsForRange(startDate, endDate) {
    const rows = await fetchTransactionsFromSupabase(
        startDate,
        endDate
    );

    const prepared = rows.map((row, index) => ({
        ...row,
        _rowId: getRowId(row, index)
    }));

    await saveTransactionsToCache(prepared);

    return prepared;
}

async function loadTwoYearsData() {
    const now = new Date();

    const endDate = getDateString(now);

    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 2);

    const startDate = getDateString(start);

    return loadTransactionsForRange(
        startDate,
        endDate
    );
}

async function fetchTransactions() {
    try {
        const cached = await getCachedTransactions();

        if (cached.length > 0) {
            allTransactions = cached.map((row, index) => ({
                ...row,
                _rowId: row._rowId || getRowId(row, index)
            }));

            applyFilters();

            ensureCurrentPeriodData();
        } else {
            allTransactions = await loadTwoYearsData();
            applyFilters();
        }
    } catch (err) {
        console.error('Fetch Transactions Error:', err);
        alert('ไม่สามารถโหลดข้อมูลรายการได้');
    }
}

async function ensureCurrentPeriodData() {
    try {
        const range = getPeriodRange(currentPeriod);

        const freshRows = await fetchTransactionsFromSupabase(
            range.start,
            range.end
        );

        const prepared = freshRows.map((row, index) => ({
            ...row,
            _rowId: getRowId(row, index)
        }));

        const map = new Map(
            allTransactions.map(row => [
                row._rowId,
                row
            ])
        );

        prepared.forEach(row => {
            map.set(row._rowId, row);
        });

        allTransactions = Array.from(map.values());

        await saveTransactionsToCache(prepared);

        applyFilters();
    } catch (err) {
        console.error('Current Period Refresh Error:', err);
    }
}

async function forceRefreshData() {
    try {
        await clearTransactionCache();

        allTransactions = [];
        filteredTransactions = [];

        await loadTwoYearsData();

        const cached = await getCachedTransactions();

        allTransactions = cached.map((row, index) => ({
            ...row,
            _rowId: row._rowId || getRowId(row, index)
        }));

        applyFilters();
    } catch (err) {
        console.error('Force Refresh Error:', err);
        alert('ไม่สามารถ Refresh ข้อมูลได้');
    }
}

// ============================================================
// PERIOD
// ============================================================

function setPeriod(period, refresh = true) {
    currentPeriod = period;

    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.toggle(
            'active',
            btn.dataset.period === period
        );
    });

    if (refresh) {
        applyFilters();
        ensureCurrentPeriodData();
    }
}

function toggleCustomPeriodMenu() {
    const menu = document.getElementById(
        'customPeriodMenu'
    );

    if (menu) {
        menu.classList.toggle('hidden');
    }
}

function applyCustomPeriod() {
    customStartDate =
        document.getElementById('customStartDate')?.value || '';

    customEndDate =
        document.getElementById('customEndDate')?.value || '';

    if (!customStartDate || !customEndDate) {
        alert('กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด');
        return;
    }

    currentPeriod = 'CUSTOM';

    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.toggle(
            'active',
            btn.dataset.period === 'CUSTOM'
        );
    });

    document.getElementById(
        'customPeriodMenu'
    )?.classList.add('hidden');

    applyFilters();
    ensureCurrentPeriodData();
}

// ============================================================
// ORDER GROUP
// ============================================================

function getUniqueOrderGroups(rows) {
    const groups = new Map();

    rows.forEach(row => {
        const orderNo = String(
            row.order_no ||
            row.invoice_no ||
            row._rowId
        );

        if (!groups.has(orderNo)) {
            groups.set(orderNo, []);
        }

        groups.get(orderNo).push(row);
    });

    return Array.from(groups.entries()).map(
        ([orderNo, items]) => ({
            orderNo,
            items
        })
    );
}

// ============================================================
// FILTER
// ============================================================

function applyFilters() {
    const search =
        normalizeText(
            document.getElementById('searchInput')?.value
        );

    const channel =
        document.getElementById('channelFilter')?.value || '';

    const status =
        document.getElementById('statusFilter')?.value || '';

    const showPKOnly =
        document.getElementById('showPKToggle')?.checked || false;

    const range = getPeriodRange(currentPeriod);

    let rows = allTransactions.filter(row => {
        const rowDate = String(row.date || '').slice(0, 10);

        if (
            rowDate < range.start ||
            rowDate > range.end
        ) {
            return false;
        }

        if (
            channel &&
            String(row.channel || '') !== channel
        ) {
            return false;
        }

        if (
            status &&
            String(row.status || '') !== status
        ) {
            return false;
        }

        if (search) {
            const haystack = [
                row.order_no,
                row.invoice_no,
                row.name,
                row.customer_name,
                row.item_code,
                row.item_name,
                row.channel,
                row.tracking_number
            ]
                .map(normalizeText)
                .join(' ');

            if (!haystack.includes(search)) {
                return false;
            }
        }

        if (showPKOnly) {
            if (!selectedRowIds.has(row._rowId)) {
                return false;
            }
        }

        return true;
    });

    rows.forEach(row => {
        row._isDuplicate = false;
    });

    const orderCounts = new Map();

    rows.forEach(row => {
        const orderNo = String(
            row.order_no ||
            row.invoice_no ||
            row._rowId
        );

        orderCounts.set(
            orderNo,
            (orderCounts.get(orderNo) || 0) + 1
        );
    });

    rows.forEach(row => {
        const orderNo = String(
            row.order_no ||
            row.invoice_no ||
            row._rowId
        );

        row._isDuplicate =
            (orderCounts.get(orderNo) || 0) > 1;
    });

    rows.sort((a, b) => {
        const av = a[currentSortColumn] ?? '';
        const bv = b[currentSortColumn] ?? '';

        if (currentSortColumn === 'date') {
            const ad = new Date(av).getTime();
            const bd = new Date(bv).getTime();

            return currentSortDirection === 'asc'
                ? ad - bd
                : bd - ad;
        }

        const comparison =
            String(av).localeCompare(
                String(bv),
                'th',
                {
                    numeric: true,
                    sensitivity: 'base'
                }
            );

        return currentSortDirection === 'asc'
            ? comparison
            : -comparison;
    });

    filteredTransactions = rows;
    filteredOrderGroups = getUniqueOrderGroups(rows);

    displayLimit = 100;

    renderTable();
    updateSortIcons();
}

// ============================================================
// SORT
// ============================================================

function sortTable(column) {
    if (currentSortColumn === column) {
        currentSortDirection =
            currentSortDirection === 'asc'
                ? 'desc'
                : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    applyFilters();
}

// ============================================================
// SORT ICON
// ============================================================

function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.className =
            'sort-icon fa-solid fa-sort text-[9px] ml-1';
    });
}

// ============================================================
// RENDER TABLE
// ============================================================

function renderTable() {
    const tbody =
        document.getElementById('txTableBody');

    if (!tbody) return;

    const visibleGroups =
        filteredOrderGroups.slice(
            0,
            displayLimit
        );

    const rowsToRender =
        visibleGroups.flatMap(group => group.items);

    tbody.innerHTML = rowsToRender.map(row => {
        const orderNo = row.order_no || '-';
        const invoiceNo = row.invoice_no || '-';

        const isSelected =
            selectedRowIds.has(row._rowId);

        const isDuplicate =
            row._isDuplicate;

        const selectedClass =
            isSelected
                ? 'row-selected'
                : '';

        const duplicateClass =
            isDuplicate
                ? 'row-duplicate'
                : '';

        const channel =
            row.channel || '-';

        const status =
            row.status || '';

        return `
            <tr
                class="${selectedClass} ${duplicateClass} border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
                data-row-id="${escapeHtml(row._rowId)}"
                onclick="handleTransactionRowClick(event, '${escapeHtml(row._rowId)}')"
            >
                <td class="px-3 py-2 whitespace-nowrap">
                    ${formatDate(row.date)}
                </td>

                <td class="px-3 py-2 whitespace-nowrap">
                    <div class="font-bold text-slate-900 font-mono">
                        ${escapeHtml(invoiceNo)}
                    </div>

                    <div
                        class="order-number-clickable text-[10px] text-google-gray font-mono"
                        title="สร้าง Shipping Label"
                        onclick="handleOrderNumberClick(event, '${escapeHtml(orderNo)}')"
                    >
                        ${escapeHtml(orderNo)}
                    </div>
                </td>

                <td class="px-3 py-2 whitespace-nowrap font-mono text-xs">
                    ${escapeHtml(row.item_code || '-')}
                </td>

                <td class="px-3 py-2">
                    ${escapeHtml(row.item_name || row.name || '-')}
                </td>

                <td class="px-3 py-2 text-right whitespace-nowrap">
                    ${Number(row.qty || 0).toLocaleString('th-TH')}
                </td>

                <td class="px-3 py-2 text-right whitespace-nowrap">
                    ${formatMoney(row.sales_amt)}
                </td>

                <td class="px-3 py-2 whitespace-nowrap">
                    <span class="text-xs">
                        ${escapeHtml(channel)}
                    </span>
                </td>

                <td class="px-3 py-2 whitespace-nowrap">
                    <select
                        class="status-select status-${normalizeText(status).replace(/\s+/g, '-')}"
                        onclick="event.stopPropagation()"
                        onchange="handleStatusChange('${escapeHtml(row._rowId)}', this.value)"
                    >
                        ${getStatusOptions(status)}
                    </select>
                </td>
            </tr>
        `;
    }).join('');

    const orderCount =
        filteredOrderGroups.length;

    const countEl =
        document.getElementById('orderCountTop');

    if (countEl) {
        countEl.innerText =
            `${orderCount.toLocaleString()} orders`;
    }

    const selectedCount =
        document.getElementById('selectedCountText');

    if (selectedCount) {
        selectedCount.innerText =
            selectedRowIds.size.toLocaleString();
    }
}

// ============================================================
// MOBILE / ROW CLICK
// ============================================================

function handleTransactionRowClick(event, rowId) {
    if (
        event.target.tagName === 'SELECT' ||
        event.target.tagName === 'OPTION' ||
        event.target.tagName === 'INPUT' ||
        event.target.closest('.order-number-clickable')
    ) {
        return;
    }

    toggleRowSelection(rowId);
}

// ============================================================
// ROW SELECTION
// ============================================================

function toggleRowSelection(rowId) {
    if (selectedRowIds.has(rowId)) {
        selectedRowIds.delete(rowId);
    } else {
        selectedRowIds.add(rowId);
    }

    applyFilters();
}

// ============================================================
// STATUS
// ============================================================

function getStatusOptions(currentStatus) {
    const statuses = [
        '',
        'Pending',
        'Processing',
        'Shipped',
        'Completed',
        'Cancelled'
    ];

    return statuses.map(status => `
        <option
            value="${escapeHtml(status)}"
            ${status === currentStatus ? 'selected' : ''}
        >
            ${status || '-'}
        </option>
    `).join('');
}

function handleStatusChange(rowId, newStatus) {
    pendingStatusChanges[rowId] = newStatus;

    const row = allTransactions.find(
        item => item._rowId === rowId
    );

    if (row) {
        row.status = newStatus;
    }

    applyFilters();
}

async function submitChanges() {
    const changes =
        Object.entries(pendingStatusChanges);

    if (changes.length === 0) {
        return;
    }

    try {
        for (const [rowId, status] of changes) {
            const row = allTransactions.find(
                item => item._rowId === rowId
            );

            if (!row) continue;

            let query = supabaseClient
                .from('transactions')
                .update({
                    status
                });

            if (row.id !== undefined && row.id !== null) {
                query = query.eq('id', row.id);
            } else {
                query = query
                    .eq('invoice_no', row.invoice_no || '')
                    .eq('item_code', row.item_code || '');
            }

            const { error } = await query;

            if (error) {
                throw error;
            }
        }

        pendingStatusChanges = {};

        await saveTransactionsToCache(
            allTransactions
        );

        applyFilters();

        alert('บันทึกข้อมูลเรียบร้อยแล้ว');
    } catch (err) {
        console.error('Save Status Error:', err);
        alert('ไม่สามารถบันทึกข้อมูลได้');
    }
}

// ============================================================
// INFINITE SCROLL
// ============================================================

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        const nearBottom =
            window.innerHeight +
            window.scrollY >=
            document.documentElement.scrollHeight - 500;

        if (!nearBottom) return;

        if (
            displayLimit >=
            filteredOrderGroups.length
        ) {
            return;
        }

        displayLimit += 100;
        renderTable();
    });
}

// ============================================================
// SHIPPING LABEL
// ============================================================

let currentShippingOrderNo = '';

function getTransactionsForOrder(orderNo) {
    const target = String(orderNo || '').trim();

    if (!target) {
        return [];
    }

    return allTransactions.filter(row =>
        String(row.order_no || '').trim() === target
    );
}

function handleOrderNumberClick(event, orderNo) {
    event.preventDefault();
    event.stopPropagation();

    const targetOrderNo =
        String(orderNo || '').trim();

    if (!targetOrderNo) {
        return;
    }

    openShippingLabel(targetOrderNo);
}

function openShippingLabel(orderNo) {
    const rows =
        getTransactionsForOrder(orderNo);

    if (!rows.length) {
        alert('ไม่พบข้อมูล Order นี้');
        return;
    }

    currentShippingOrderNo = orderNo;

    renderShippingLabel(rows);

    const modal =
        document.getElementById(
            'shippingLabelModal'
        );

    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }
}

function closeShippingLabelModal() {
    const modal =
        document.getElementById(
            'shippingLabelModal'
        );

    if (modal) {
        modal.classList.add('hidden');
    }

    document.body.classList.remove(
        'overflow-hidden'
    );

    currentShippingOrderNo = '';
}

// ============================================================
// SHIPPING LABEL DATA
// ============================================================

function getShippingCustomer(rows) {
    const first = rows[0] || {};

    return {
        name:
            first.customer_name ||
            first.name ||
            '-',

        phone:
            first.phone ||
            '-',

        address:
            first.customer_address ||
            first.address ||
            '-'
    };
}

function getShippingTracking(rows) {
    const tracking =
        rows.find(row =>
            String(
                row.tracking_number || ''
            ).trim()
        );

    return tracking
        ? String(
            tracking.tracking_number
        ).trim()
        : '';
}

function getShippingItems(rows) {
    return rows.map(row => ({
        itemCode:
            row.item_code ||
            '-',

        itemName:
            row.item_name ||
            row.name ||
            '-',

        qty:
            Number(row.qty || 0)
    }));
}

// ============================================================
// SHIPPING LABEL RENDER
// ============================================================

function renderShippingLabel(rows) {
    const paper =
        document.getElementById(
            'shippingLabelPaper'
        );

    if (!paper) return;

    const customer =
        getShippingCustomer(rows);

    const tracking =
        getShippingTracking(rows);

    const items =
        getShippingItems(rows);

    const orderNo =
        String(
            rows[0]?.order_no ||
            currentShippingOrderNo ||
            ''
        );

    const totalQty =
        items.reduce(
            (sum, item) => sum + item.qty,
            0
        );

    paper.innerHTML = `
        <div class="shipping-label-document">

            <div class="shipping-label-header">
                <div class="shipping-label-brand">
                    <img
                        src="https://res.cloudinary.com/dzgaej1wo/image/upload/v1789458148/unimerce_logo.png"
                        alt="UNIMERCE"
                        class="shipping-label-logo"
                    />

                    <div>
                        <div class="shipping-label-company">
                            UNIMERCE
                        </div>
                        <div class="shipping-label-document-title">
                            SHIPPING LABEL
                        </div>
                    </div>
                </div>

                <div class="shipping-label-order-box">
                    <div class="shipping-label-small-label">
                        ORDER NO.
                    </div>

                    <div class="shipping-label-order-text">
                        ${escapeHtml(orderNo)}
                    </div>

                    <svg
                        id="shippingOrderBarcode"
                        class="shipping-label-barcode"
                    ></svg>
                </div>
            </div>

            <div class="shipping-label-divider"></div>

            <div class="shipping-label-recipient-section">

                <div class="shipping-label-section-title">
                    SHIP TO
                </div>

                <div class="shipping-label-recipient-name">
                    ${escapeHtml(customer.name)}
                </div>

                <div class="shipping-label-recipient-phone">
                    ${escapeHtml(customer.phone)}
                </div>

                <div class="shipping-label-recipient-address">
                    ${escapeHtml(customer.address)}
                </div>

            </div>

            <div class="shipping-label-divider"></div>

            <div class="shipping-label-items-section">

                <div class="shipping-label-section-title">
                    ITEMS
                </div>

                <table class="shipping-label-items-table">

                    <thead>
                        <tr>
                            <th>ITEM CODE</th>
                            <th>ITEM</th>
                            <th>QTY</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td class="shipping-item-code">
                                    ${escapeHtml(item.itemCode)}
                                </td>

                                <td>
                                    ${escapeHtml(item.itemName)}
                                </td>

                                <td class="shipping-item-qty">
                                    ${item.qty.toLocaleString('th-TH')}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>

                </table>

            </div>

            <div class="shipping-label-summary">
                Total Qty:
                <strong>${totalQty.toLocaleString('th-TH')}</strong>
            </div>

            <div class="shipping-label-footer">

                <div class="shipping-label-tracking-area">
                    ${
                        tracking
                            ? `
                                <div class="shipping-label-section-title">
                                    TRACKING NUMBER
                                </div>

                                <div class="shipping-label-tracking-text">
                                    ${escapeHtml(tracking)}
                                </div>

                                <svg
                                    id="shippingTrackingBarcode"
                                    class="shipping-label-tracking-barcode"
                                ></svg>
                            `
                            : `
                                <div class="shipping-label-no-tracking">
                                    No tracking number
                                </div>
                            `
                    }
                </div>

                <div class="shipping-label-footer-brand">
                    UNIMERCE
                </div>

            </div>

        </div>
    `;

    requestAnimationFrame(() => {
        generateShippingBarcodes(
            orderNo,
            tracking
        );
    });
}

// ============================================================
// SHIPPING BARCODE
// ============================================================

function generateShippingBarcodes(
    orderNo,
    tracking
) {
    if (
        typeof JsBarcode === 'undefined'
    ) {
        console.error(
            'JsBarcode is not loaded.'
        );
        return;
    }

    const orderBarcode =
        document.getElementById(
            'shippingOrderBarcode'
        );

    if (
        orderBarcode &&
        orderNo
    ) {
        try {
            JsBarcode(
                orderBarcode,
                orderNo,
                {
                    format: 'CODE128',
                    displayValue: false,
                    margin: 0,
                    height: 42,
                    width: 1.5
                }
            );
        } catch (err) {
            console.error(
                'Order Barcode Error:',
                err
            );
        }
    }

    const trackingBarcode =
        document.getElementById(
            'shippingTrackingBarcode'
        );

    if (
        trackingBarcode &&
        tracking
    ) {
        try {
            JsBarcode(
                trackingBarcode,
                tracking,
                {
                    format: 'CODE128',
                    displayValue: false,
                    margin: 0,
                    height: 48,
                    width: 1.5
                }
            );
        } catch (err) {
            console.error(
                'Tracking Barcode Error:',
                err
            );
        }
    }
}

// ============================================================
// SHIPPING LABEL PDF
// ============================================================

async function downloadShippingLabelPDF() {
    const paper =
        document.getElementById(
            'shippingLabelPaper'
        );

    if (!paper) {
        return;
    }

    const orderNo =
        currentShippingOrderNo ||
        'Shipping_Label';

    try {
        const canvas =
            await html2canvas(
                paper,
                {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                }
            );

        const {
            jsPDF
        } = window.jspdf;

        const pdf =
            new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a5',
                compress: true
            });

        const imgData =
            canvas.toDataURL(
                'image/jpeg',
                0.86
            );

        const imgProps =
            pdf.getImageProperties(
                imgData
            );

        const pdfWidth =
            pdf.internal.pageSize.getWidth();

        const pdfHeight =
            (
                imgProps.height *
                pdfWidth
            ) /
            imgProps.width;

        const pageHeight =
            pdf.internal.pageSize.getHeight();

        const finalHeight =
            Math.min(
                pdfHeight,
                pageHeight
            );

        pdf.addImage(
            imgData,
            'JPEG',
            0,
            0,
            pdfWidth,
            finalHeight,
            undefined,
            'FAST'
        );

        pdf.save(
            `Shipping_Label_${orderNo}.pdf`
        );
    } catch (err) {
        console.error(
            'Shipping Label PDF Error:',
            err
        );

        alert(
            'ไม่สามารถสร้าง PDF ได้'
        );
    }
}
