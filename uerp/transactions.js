
const supabaseUrl = "https://xygdmszernmircmbqwke.supabase.co";
const supabaseKey = "sb_publishable_4Rj3PUJnjqKNvx18hLzbng_ZhOVJHBp";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let allTransactions = [];
let filteredTransactions = [];
let filteredOrderGroups = [];
let selectedRowIds = new Set();
let pendingStatusChanges = {};
let currentSortColumn = 'date';
let currentSortAsc = false;
let currentPeriod = 'TODAY';
let displayLimit = 25;

const limitStep = 25;
const TRANSACTION_CACHE_DB = 'uerp_transactions_cache_db';
const TRANSACTION_CACHE_STORE = 'transactions';
const TRANSACTION_CACHE_META = 'meta';
const TRANSACTION_CACHE_VERSION = 2;
const INITIAL_CACHE_YEARS = 2;
const FETCH_BATCH_SIZE = 1000;

let loadSequence = 0;
let isAppendingRows = false;
let activeLoadPromise = null;

document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
    setupInfiniteScroll();
    fetchTransactions();
});

async function loadHeader() {
    try {
        const res = await fetch('uerpheader.html');
        if (!res.ok) throw new Error('Header file not found');

        const html = await res.text();
        const headerContainer = document.getElementById('headerContainer');

        if (!headerContainer) return;

        headerContainer.innerHTML = html;

        const txTab = headerContainer.querySelector('[data-page="transactions"]');
        if (txTab) txTab.classList.add('chrome-tab-active');

        if (typeof window.initUerpLayout === 'function') {
            window.__uerpLayoutInitialized = false;
            window.initUerpLayout();
        }
    } catch (err) {
        console.warn('Header load error:', err);
    }
}

/* =========================
   DATE HELPERS
========================= */

function parseTransactionDate(dateStr) {
    if (!dateStr) return null;

    const raw = String(dateStr);

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [year, month, day] = raw.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

function formatDateFormatted(dateStr, isMobile = false) {
    if (!dateStr) return '-';

    const raw = String(dateStr);

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return isMobile ? raw.substring(2) : raw;
    }

    const d = parseTransactionDate(dateStr);

    if (!d) {
        return isMobile ? raw.substring(2) : raw.substring(0, 10);
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const formatted = `${year}-${month}-${day}`;

    return isMobile ? formatted.substring(2) : formatted;
}

function formatMoney(val) {
    return '฿' + parseFloat(val || 0).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getInitialCacheRange() {
    const now = new Date();

    return {
        start: new Date(
            now.getFullYear() - INITIAL_CACHE_YEARS,
            now.getMonth(),
            now.getDate()
        ),
        end: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23, 59, 59, 999
        )
    };
}

function getCurrentPeriodRange() {
    const now = new Date();
    let start = null;
    let end = null;

    end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23, 59, 59, 999
    );

    if (currentPeriod === 'TODAY') {
        start = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );
    } else if (currentPeriod === 'YESTERDAY') {
        start = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1
        );
        end = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1,
            23, 59, 59, 999
        );
    } else if (currentPeriod === 'DAY_BEFORE_YESTERDAY') {
        start = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 2
        );
        end = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 2,
            23, 59, 59, 999
        );
    } else if (currentPeriod === 'THIS_WEEK') {
        const day = now.getDay() || 7;

        start = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - day + 1
        );
    } else if (currentPeriod === 'THIS_MONTH') {
        start = new Date(
            now.getFullYear(),
            now.getMonth(),
            1
        );
    } else if (currentPeriod === 'LAST_MONTH') {
        start = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            1
        );
        end = new Date(
            now.getFullYear(),
            now.getMonth(),
            0,
            23, 59, 59, 999
        );
    } else if (currentPeriod === 'THIS_YEAR') {
        start = new Date(now.getFullYear(), 0, 1);
    } else if (currentPeriod === 'CUSTOM') {
        const s = document.getElementById('startDate')?.value;
        const e = document.getElementById('endDate')?.value;

        start = s ? new Date(s + 'T00:00:00') : null;
        end = e ? new Date(e + 'T23:59:59.999') : null;
    } else if (currentPeriod === 'ALL') {
        return getInitialCacheRange();
    }

    return { start, end };
}

function isLivePeriod(period = currentPeriod) {
    return [
        'TODAY',
        'YESTERDAY',
        'DAY_BEFORE_YESTERDAY',
        'THIS_WEEK'
    ].includes(period);
}

/* =========================
   STATUS
========================= */

function updateStatus(msg, isError = false) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    if (!statusIndicator || !statusText) return;

    statusIndicator.classList.remove('hidden');

    statusIndicator.className = isError
        ? 'p-2 bg-red-50 rounded-lg border border-red-200 text-xs text-google-red'
        : 'p-2 bg-blue-50 rounded-lg border border-blue-100 text-xs text-google-blue';

    statusText.innerText = msg;
}

function hideStatus() {
    document.getElementById('statusIndicator')?.classList.add('hidden');
}

/* =========================
   INDEXEDDB CACHE
========================= */

function openTransactionCacheDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(
            TRANSACTION_CACHE_DB,
            TRANSACTION_CACHE_VERSION
        );

        request.onupgradeneeded = event => {
            const db = event.target.result;
            const tx = event.target.transaction;

            if (!db.objectStoreNames.contains(TRANSACTION_CACHE_STORE)) {
                db.createObjectStore(
                    TRANSACTION_CACHE_STORE,
                    { keyPath: '_rowId' }
                );
            } else if (event.oldVersion < 2) {
                tx.objectStore(TRANSACTION_CACHE_STORE).clear();
            }

            if (!db.objectStoreNames.contains(TRANSACTION_CACHE_META)) {
                db.createObjectStore(
                    TRANSACTION_CACHE_META,
                    { keyPath: 'key' }
                );
            } else if (event.oldVersion < 2) {
                tx.objectStore(TRANSACTION_CACHE_META).clear();
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getTransactionCacheMeta() {
    const db = await openTransactionCacheDB();

    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(TRANSACTION_CACHE_META, 'readonly');
            const request = tx.objectStore(TRANSACTION_CACHE_META).get('cache_info');

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } finally {
        db.close();
    }
}

async function saveTransactionCacheMeta(meta) {
    const db = await openTransactionCacheDB();

    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(TRANSACTION_CACHE_META, 'readwrite');

            tx.objectStore(TRANSACTION_CACHE_META).put({
                key: 'cache_info',
                ...meta
            });

            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Cache meta update aborted'));
        });
    } finally {
        db.close();
    }
}

async function getAllCachedTransactions() {
    const db = await openTransactionCacheDB();

    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(TRANSACTION_CACHE_STORE, 'readonly');
            const request = tx.objectStore(TRANSACTION_CACHE_STORE).getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } finally {
        db.close();
    }
}

async function saveTransactionsToCache(rows) {
    if (!rows || rows.length === 0) return;

    const db = await openTransactionCacheDB();

    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(TRANSACTION_CACHE_STORE, 'readwrite');
            const store = tx.objectStore(TRANSACTION_CACHE_STORE);

            rows.forEach(row => store.put(row));

            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Cache save aborted'));
        });
    } finally {
        db.close();
    }
}

async function clearTransactionCache() {
    const db = await openTransactionCacheDB();

    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(
                [TRANSACTION_CACHE_STORE, TRANSACTION_CACHE_META],
                'readwrite'
            );

            tx.objectStore(TRANSACTION_CACHE_STORE).clear();
            tx.objectStore(TRANSACTION_CACHE_META).clear();

            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Cache clear aborted'));
        });
    } finally {
        db.close();
    }
}

/* =========================
   CACHE RANGE TRACKING
========================= */

function getMissingDateRanges(meta, requestedStart, requestedEnd) {
    if (!requestedStart || !requestedEnd) return [];

    const coveredRanges = (meta?.coveredRanges || [])
        .map(range => ({
            start: new Date(range.start),
            end: new Date(range.end)
        }))
        .filter(range =>
            !isNaN(range.start.getTime()) &&
            !isNaN(range.end.getTime())
        )
        .sort((a, b) => a.start - b.start);

    const missing = [];
    let cursor = requestedStart.getTime();
    const requestedEndTime = requestedEnd.getTime();

    for (const range of coveredRanges) {
        const rangeStart = range.start.getTime();
        const rangeEnd = range.end.getTime();

        if (rangeEnd < cursor) continue;
        if (rangeStart > requestedEndTime) break;

        if (rangeStart > cursor) {
            missing.push({
                start: new Date(cursor),
                end: new Date(Math.min(requestedEndTime, rangeStart - 1))
            });
        }

        cursor = Math.max(cursor, rangeEnd + 1);

        if (cursor > requestedEndTime) break;
    }

    if (cursor <= requestedEndTime) {
        missing.push({
            start: new Date(cursor),
            end: new Date(requestedEndTime)
        });
    }

    return missing.filter(range => range.start <= range.end);
}

function mergeCoveredRanges(existingRanges, newRange) {
    const ranges = [
        ...(existingRanges || []).map(range => ({
            start: new Date(range.start),
            end: new Date(range.end)
        })),
        {
            start: new Date(newRange.start),
            end: new Date(newRange.end)
        }
    ].sort((a, b) => a.start - b.start);

    const merged = [];

    for (const range of ranges) {
        const last = merged[merged.length - 1];

        if (!last || range.start.getTime() > last.end.getTime() + 1) {
            merged.push({
                start: range.start,
                end: range.end
            });
        } else if (range.end > last.end) {
            last.end = range.end;
        }
    }

    return merged.map(range => ({
        start: range.start.toISOString(),
        end: range.end.toISOString()
    }));
}

/* =========================
   SUPABASE FETCH
========================= */

function getStableRowId(row) {
    if (row.id !== undefined && row.id !== null) {
        return `id_${row.id}`;
    }

    if (row.invoice_item_id) {
        return `pk_${row.invoice_item_id}`;
    }

    return [
        row.invoice_no || '',
        row.order_no || '',
        row.item_code || '',
        row.date || '',
        row.qty ?? '',
        row.sales_amt ?? ''
    ].join('|');
}

function normalizeTransactionRows(rows) {
    const uniqueRows = new Map();

    (rows || []).forEach(row => {
        const normalized = {
            ...row,
            _rowId: getStableRowId(row)
        };

        uniqueRows.set(normalized._rowId, normalized);
    });

    return Array.from(uniqueRows.values());
}

async function fetchTransactionRange(startDate, endDate) {
    if (!startDate || !endDate) return [];

    const allRows = [];
    let from = 0;

    while (true) {
        const to = from + FETCH_BATCH_SIZE - 1;

        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .gte('date', startDate.toISOString())
            .lte('date', endDate.toISOString())
            .order('date', { ascending: false })
            .range(from, to);

        if (error) throw error;

        const rows = data || [];
        allRows.push(...rows);

        if (rows.length < FETCH_BATCH_SIZE) break;

        from += FETCH_BATCH_SIZE;
    }

    return normalizeTransactionRows(allRows);
}

async function loadTransactionsForRange(requestedStart, requestedEnd, token) {
    if (!requestedStart || !requestedEnd) return;

    let meta = await getTransactionCacheMeta();

    const missingRanges = getMissingDateRanges(
        meta,
        requestedStart,
        requestedEnd
    );

    for (const range of missingRanges) {
        if (token !== loadSequence) return;

        updateStatus('กำลังโหลดข้อมูลย้อนหลัง...');

        const rows = await fetchTransactionRange(range.start, range.end);

        if (token !== loadSequence) return;

        await saveTransactionsToCache(rows);

        meta = await getTransactionCacheMeta();

        const coveredRanges = mergeCoveredRanges(
            meta?.coveredRanges || [],
            range
        );

        await saveTransactionCacheMeta({
            coveredRanges
        });
    }

    if (token !== loadSequence) return;

    allTransactions = normalizeTransactionRows(
        await getAllCachedTransactions()
    );

    applyFilters();
}

/* =========================
   MAIN LOADING
========================= */

async function loadCurrentPeriodData(token) {
    const range = getCurrentPeriodRange();

    if (!range.start || !range.end) {
        allTransactions = normalizeTransactionRows(
            await getAllCachedTransactions()
        );
        applyFilters();
        hideStatus();
        return;
    }

    if (isLivePeriod()) {
        updateStatus('กำลังโหลดข้อมูลล่าสุดจาก Supabase...');

        const rows = await fetchTransactionRange(
            range.start,
            range.end
        );

        if (token !== loadSequence) return;

        // ช่วงข้อมูลล่าสุดไม่อ่านหรือเขียน Cache
        allTransactions = rows;
        applyFilters();
        hideStatus();
        return;
    }

    await loadTransactionsForRange(
        range.start,
        range.end,
        token
    );

    if (token === loadSequence) hideStatus();
}

function fetchTransactions(isManualRefresh = false) {
    if (activeLoadPromise) {
        return activeLoadPromise;
    }

    const token = ++loadSequence;

    activeLoadPromise = (async () => {
        try {
            if (isManualRefresh) {
                updateStatus('กำลังล้าง Cache และโหลดข้อมูลใหม่...');
                await clearTransactionCache();

                if (token !== loadSequence) return;
            }

            await loadCurrentPeriodData(token);
        } catch (err) {
            console.error('Supabase Query Error:', err);

            if (token !== loadSequence) return;

            const cachedRows = await getAllCachedTransactions().catch(() => []);

            if (cachedRows.length > 0 && !isLivePeriod()) {
                allTransactions = normalizeTransactionRows(cachedRows);
                applyFilters();

                updateStatus(
                    `โหลดข้อมูลไม่สำเร็จ ใช้ Cache เดิม (${cachedRows.length.toLocaleString()} รายการ)`,
                    true
                );
            } else {
                updateStatus(`เกิดข้อผิดพลาด: ${err.message}`, true);
            }
        } finally {
            if (token === loadSequence) {
                activeLoadPromise = null;
            }
        }
    })();

    return activeLoadPromise;
}

async function forceRefreshData() {
    if (activeLoadPromise) {
        updateStatus('กำลังโหลดข้อมูลอยู่ กรุณารอสักครู่');
        return;
    }

    await fetchTransactions(true);
}

async function ensureCurrentPeriodData() {
    if (activeLoadPromise) {
        // ไม่เริ่มโหลดซ้ำระหว่างที่คำขอก่อนหน้ายังทำงาน
        return;
    }

    await fetchTransactions(false);
}

/* =========================
   PERIOD FILTERS
========================= */

function setPeriod(period, shouldApply = true) {
    currentPeriod = currentPeriod === period ? 'ALL' : period;

    document.getElementById('customDateContainer')?.classList.toggle(
        'hidden',
        currentPeriod !== 'CUSTOM'
    );

    document.querySelectorAll('.period-btn').forEach(btn => {
        const active = btn.dataset.period === currentPeriod;

        btn.classList.toggle('bg-google-blue', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('border-google-blue', active);
        btn.classList.toggle('bg-white', !active);
        btn.classList.toggle('text-slate-600', !active);
        btn.classList.toggle('border-google-border', !active);
    });

    if (shouldApply) {
        ensureCurrentPeriodData();
    }
}

function togglePeriodMenu() {
    document.getElementById('periodMenu')?.classList.toggle('hidden');
}

function handleCustomPeriodChange() {
    currentPeriod = document.getElementById('periodFilter').value;

    document.getElementById('customDateContainer')?.classList.toggle(
        'hidden',
        currentPeriod !== 'CUSTOM'
    );

    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove(
            'bg-google-blue',
            'text-white',
            'border-google-blue'
        );

        btn.classList.add(
            'bg-white',
            'text-slate-600',
            'border-google-border'
        );
    });

    if (currentPeriod === 'CUSTOM') {
        const s = document.getElementById('startDate')?.value;
        const e = document.getElementById('endDate')?.value;

        if (s && e) {
            ensureCurrentPeriodData();
        } else {
            applyFilters();
        }

        return;
    }

    ensureCurrentPeriodData();
}

/* =========================
   FILTERING
========================= */

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

    return Array.from(groups.entries()).map(([orderNo, items]) => ({
        orderNo,
        items
    }));
}

function applyFilters() {
    const search = (document.getElementById('searchInput')?.value || '')
        .toLowerCase()
        .trim();

    const channel = document.getElementById('channelFilter')?.value || 'ALL';
    const status = document.getElementById('statusFilter')?.value || 'ALL';
    const period = currentPeriod;
    const showPKOnly = document.getElementById('showPKToggle')?.checked || false;

    const range = getCurrentPeriodRange();
    const startFilterDate = range.start;
    const endFilterDate = range.end;

    const invoiceCounts = {};
    const orderCounts = {};

    allTransactions.forEach(item => {
        if (item.invoice_no) {
            invoiceCounts[item.invoice_no] =
                (invoiceCounts[item.invoice_no] || 0) + 1;
        }

        if (item.order_no) {
            orderCounts[item.order_no] =
                (orderCounts[item.order_no] || 0) + 1;
        }
    });

    filteredTransactions = allTransactions.filter(item => {
        if (showPKOnly && !selectedRowIds.has(item._rowId)) {
            return false;
        }

        const itemChannel = String(item.channel || '');
        const itemStatus = String(item.status || 'PENDING');

        const textMatch =
            !search ||
            String(item.invoice_no || '').toLowerCase().includes(search) ||
            String(item.order_no || '').toLowerCase().includes(search) ||
            String(item.item_code || '').toLowerCase().includes(search) ||
            String(item.item_name || '').toLowerCase().includes(search) ||
            String(formatDateFormatted(item.date, false) || '')
                .toLowerCase()
                .includes(search);

        const channelMatch =
            channel === 'ALL' ||
            itemChannel.toLowerCase() === channel.toLowerCase();

        const statusMatch =
            status === 'ALL' ||
            itemStatus.toUpperCase() === status.toUpperCase();

        let dateMatch = true;

        if (startFilterDate || endFilterDate) {
            const rowDate = parseTransactionDate(item.date);

            if (!rowDate) {
                dateMatch = false;
            } else {
                if (startFilterDate && rowDate < startFilterDate) {
                    dateMatch = false;
                }

                if (endFilterDate && rowDate > endFilterDate) {
                    dateMatch = false;
                }
            }
        }

        item._isDuplicate =
            (item.invoice_no && invoiceCounts[item.invoice_no] > 1) ||
            (item.order_no && orderCounts[item.order_no] > 1);

        return textMatch && channelMatch && statusMatch && dateMatch;
    });

    filteredTransactions.sort((a, b) => {
        let valA = a[currentSortColumn] ?? '';
        let valB = b[currentSortColumn] ?? '';

        if (currentSortColumn === 'date') {
            valA = parseTransactionDate(a.date)?.getTime() || 0;
            valB = parseTransactionDate(b.date)?.getTime() || 0;
        } else if (
            currentSortColumn === 'sales_amt' ||
            currentSortColumn === 'qty'
        ) {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) return currentSortAsc ? -1 : 1;
        if (valA > valB) return currentSortAsc ? 1 : -1;
        return 0;
    });

    updateSortIcons();

    filteredOrderGroups = getUniqueOrderGroups(filteredTransactions);
    displayLimit = 25;

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
    [
        'date',
        'invoice_no',
        'item_code',
        'item_name',
        'qty',
        'sales_amt'
    ].forEach(col => {
        const el = document.getElementById(`sort_${col}`);
        if (!el) return;

        if (col === currentSortColumn) {
            el.className = 'ml-0.5 text-[10px] text-google-blue font-bold';
            el.innerHTML = currentSortAsc
                ? '<i class="fa-solid fa-arrow-up-wide-short"></i>'
                : '<i class="fa-solid fa-arrow-down-wide-short"></i>';
        } else {
            el.className = 'ml-0.5 text-[10px] text-slate-300';
            el.innerHTML = '<i class="fa-solid fa-arrow-down-wide-short"></i>';
        }
    });
}

/* =========================
   TABLE RENDERING
========================= */

function renderTable() {
    const tbody = document.getElementById('txTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const totalOrders = filteredOrderGroups.length;
    const visibleGroups = filteredOrderGroups.slice(0, displayLimit);
    const pageData = visibleGroups.flatMap(group => group.items);

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="p-6 text-center text-google-gray">
                    ไม่พบรายการคำสั่งซื้อ
                </td>
            </tr>
        `;
    } else {
        pageData.forEach(row => {
            const isSelected = selectedRowIds.has(row._rowId);
            const isDup = row._isDuplicate;

            let channelBadgeClass =
                'bg-slate-100 text-slate-700 border-slate-200';

            const ch = String(row.channel || '').toLowerCase();

            if (ch.includes('shopee')) {
                channelBadgeClass = 'bg-shopee text-white';
            } else if (ch.includes('lazada')) {
                channelBadgeClass = 'bg-lazada text-white';
            } else if (ch.includes('tiktok')) {
                channelBadgeClass = 'bg-tiktok text-white';
            }

            const currentStatus =
                pendingStatusChanges[row._rowId] ||
                row.status ||
                'PENDING';

            const orderNo = String(row.order_no || '-');
            const orderPrefix = orderNo.length > 3 ? orderNo.slice(0, -3) : '';
            const orderTail = orderNo.length > 3 ? orderNo.slice(-3) : orderNo;
            const qty = Number(row.qty) || 0;
            const qtyClass = qty > 1 ? 'text-google-red' : 'text-slate-900';

            const invoiceNo = String(row.invoice_no || '');
            const encodedInvoice = encodeURIComponent(invoiceNo);

            let rowBgClass = 'hover:bg-slate-50';
            if (isDup) rowBgClass = 'row-duplicate';
            if (isSelected) rowBgClass = 'row-selected';

            const tr = document.createElement('tr');

            tr.className =
                `transition-colors border-b border-slate-100 cursor-pointer ${rowBgClass}`;

            tr.onclick = e => {
                if (
                    e.target.tagName === 'SELECT' ||
                    e.target.tagName === 'OPTION' ||
                    e.target.tagName === 'INPUT'
                ) {
                    return;
                }

                toggleRowSelection(row._rowId);
            };

            tr.innerHTML = `
                <td class="p-2 align-top font-mono text-[11px] text-slate-600">
                    <span class="sm:hidden block leading-tight">
                        <span class="block text-[13px] font-semibold">
                            ${formatDateFormatted(row.date, true).substring(0, 5)}
                        </span>
                        <span class="block text-[15px] font-bold">
                            ${(() => {
                                const day = parseInt(
                                    formatDateFormatted(row.date, true).substring(6),
                                    10
                                );

                                const suffix =
                                    day % 100 >= 11 && day % 100 <= 13
                                        ? 'th'
                                        : day % 10 === 1
                                            ? 'st'
                                            : day % 10 === 2
                                                ? 'nd'
                                                : day % 10 === 3
                                                    ? 'rd'
                                                    : 'th';

                                return `${day}${suffix}`;
                            })()}
                        </span>
                    </span>
                    <span class="hidden sm:inline whitespace-nowrap">
                        ${formatDateFormatted(row.date, false)}
                    </span>
                </td>
                <td class="p-2 align-top">
                    <div class="sm:hidden leading-tight w-[78px] overflow-hidden">
                        <div
                            class="mobile-order-main font-bold text-slate-900 font-mono truncate"
                            title="${invoiceNo}"
                            onclick="event.stopPropagation(); window.open('/uerp/shipping-label.html?invoice_no=${encodedInvoice}', '_blank')"
                            style="cursor:pointer"
                        >
                            ${invoiceNo || '-'}
                        </div>
                        <div class="text-[9px] text-google-gray font-mono truncate" title="${orderNo}">
                            ${orderPrefix}
                        </div>
                        <div class="mobile-order-tail font-mono text-slate-900">
                            ${orderTail}
                        </div>
                    </div>
                    <div class="hidden sm:block leading-tight">
                        <div
                            class="font-bold text-slate-900 font-mono"
                            onclick="event.stopPropagation(); window.open('/uerp/shipping-label.html?invoice_no=${encodedInvoice}', '_blank')"
                            style="cursor:pointer"
                        >
                            ${invoiceNo || '-'}
                        </div>
                        <div class="text-[10px] text-google-gray font-mono">
                            ${row.order_no || '-'}
                        </div>
                    </div>
                </td>
                <td class="p-2 align-top sm:font-mono sm:font-bold sm:text-google-blue sm:max-w-[130px]">
                    <div class="mobile-item-code font-mono font-bold text-google-blue sm:hidden">
                        ${row.item_code || '-'}
                    </div>
                    <div class="mobile-item-name sm:hidden text-[15px] font-medium text-slate-800">
                        ${row.item_name || '-'}
                    </div>
                    <div class="hidden sm:block truncate" title="${row.item_code || ''}">
                        ${row.item_code || '-'}
                    </div>
                </td>
                <td
                    class="p-2 font-medium text-slate-800 hidden sm:table-cell max-w-[200px] truncate"
                    title="${row.item_name || ''}"
                >
                    ${row.item_name || '-'}
                </td>
                <td class="p-2 text-right font-bold ${qtyClass} text-[14px] whitespace-nowrap">
                    ${qty}
                </td>
                <td class="p-2 text-right font-bold text-slate-900 hidden sm:table-cell">
                    ${formatMoney(row.sales_amt)}
                </td>
                <td class="p-2 text-center hidden sm:table-cell">
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${channelBadgeClass}">
                        ${row.channel || 'Direct'}
                    </span>
                </td>
                <td class="p-2 text-center hidden sm:table-cell">
                    <select
                        onchange="handleStatusChange('${row._rowId}', this.value)"
                        class="bg-white border border-google-border rounded px-1 py-0.5 text-[10px] font-semibold focus:outline-none focus:border-google-blue"
                    >
                        <option value="PENDING" ${currentStatus === 'PENDING' ? 'selected' : ''}>PENDING</option>
                        <option value="ACTIVE" ${currentStatus === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
                        <option value="VOID" ${currentStatus === 'VOID' ? 'selected' : ''}>VOID</option>
                    </select>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    const countEl = document.getElementById('orderCountTop');

    if (countEl) {
        countEl.innerHTML = `
            <i class="fa-solid fa-circle text-[6px] order-count-live-icon"></i>
            <span class="order-count-live">${totalOrders.toLocaleString()}</span>
            <span>Orders</span>
        `;
    }

    const selectedEl = document.getElementById('selectedCountText');
    if (selectedEl) {
        selectedEl.innerText = selectedRowIds.size.toLocaleString();
    }

    updatePendingChangesCount();
}

/* =========================
   ROW SELECTION / STATUS
========================= */

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
    const rowIds = Object.keys(pendingStatusChanges);
    const count = rowIds.length;

    if (count === 0) return;

    updateStatus(`กำลังบันทึก ${count} รายการลง Supabase...`);

    try {
        const results = await Promise.all(
            rowIds.map(async rowId => {
                const item = allTransactions.find(t => t._rowId === rowId);

                if (!item || !item.id) {
                    return { rowId, error: new Error(`ไม่พบ ID ของรายการ ${rowId}`) };
                }

                const newStatus = pendingStatusChanges[rowId];

                const { error } = await supabaseClient
                    .from('transactions')
                    .update({ status: newStatus })
                    .eq('id', item.id);

                return { rowId, item, newStatus, error };
            })
        );

        const failed = results.find(result => result.error);

        results.forEach(result => {
            if (result.item && !result.error) {
                result.item.status = result.newStatus;
            }
        });

        if (failed) throw failed.error;

        pendingStatusChanges = {};

        await saveTransactionsToCache(
            normalizeTransactionRows(allTransactions)
        );

        updateStatus('บันทึกเรียบร้อย!');

        setTimeout(() => hideStatus(), 2000);

        applyFilters();
    } catch (err) {
        console.error('Submit Error:', err);
        updateStatus(`เกิดข้อผิดพลาด: ${err.message}`, true);
    }
}

/* =========================
   INFINITE SCROLL
========================= */

function setupInfiniteScroll() {
    const grid = document.querySelector('.transactions-grid');
    if (!grid || grid.dataset.infiniteScrollReady === 'true') return;

    grid.dataset.infiniteScrollReady = 'true';

    grid.addEventListener('scroll', () => {
        if (isAppendingRows) return;

        const nearBottom =
            grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 250;

        if (!nearBottom || displayLimit >= filteredOrderGroups.length) return;

        isAppendingRows = true;

        document.getElementById('infiniteLoader')?.classList.remove('hidden');

        setTimeout(() => {
            displayLimit = Math.min(
                displayLimit + limitStep,
                filteredOrderGroups.length
            );

            renderTable();

            document.getElementById('infiniteLoader')?.classList.add('hidden');
            isAppendingRows = false;
        }, 150);
    });
}
