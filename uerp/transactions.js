const supabaseUrl = "https://xygdmszernmircmbqwke.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmxlIiwicmVmIjoieHlnZG1zemVy bW1pcmNtYnF3a2UiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4MTY1Njk1MCwiZXhwIjoyMDk3MjMyOTUwfQ.Cq5h2TignXwhsyOe8IYcMYvlayyTjH66tTiPznVOOY";
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

document.addEventListener('DOMContentLoaded', () => {
    setPeriod('TODAY', false);
    loadHeader();
    fetchTransactions();
    setupInfiniteScroll();
});

async function loadHeader() {
    try {
        const res = await fetch('uerpheader.html');
        if (!res.ok) throw new Error('Header file not found');
        const html = await res.text();
        const headerContainer = document.getElementById('headerContainer');
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

function formatDateFormatted(dateStr, isMobile = false) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);

    if (isNaN(d.getTime())) {
        const raw = String(dateStr).substring(0, 10);
        return isMobile ? raw.substring(2) : raw;
    }

    const iso = d.toISOString().split('T')[0];
    return isMobile ? iso.substring(2) : iso;
}

function formatMoney(val) {
    return '฿' + parseFloat(val || 0).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function updateStatus(msg, isError = false) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    statusIndicator.classList.remove('hidden');

    statusIndicator.className = isError
        ? "p-2 bg-red-50 rounded-lg border border-red-200 text-xs text-google-red"
        : "p-2 bg-blue-50 rounded-lg border border-blue-100 text-xs text-google-blue";

    statusText.innerText = msg;
}

function forceRefreshData() {
    localStorage.removeItem('uerp_orders_cache');
    localStorage.removeItem('uerp_orders_cache_time');
    fetchTransactions(true);
}

async function fetchTransactions(isManualRefresh = false) {
    const cacheKey = 'uerp_orders_cache';
    const timeKey = 'uerp_orders_cache_time';
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(timeKey);
    const nowTime = new Date().getTime();

    if (
        !isManualRefresh &&
        cachedData &&
        cachedTime &&
        (nowTime - Number(cachedTime) < 12 * 3600 * 1000)
    ) {
        allTransactions = JSON.parse(cachedData);
        document.getElementById('statusIndicator').classList.add('hidden');
        applyFilters();
        return;
    }

    updateStatus('กำลังโหลดข้อมูล...');

    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false })
            .limit(1000);

        if (error) throw error;

        allTransactions = (data || []).map((row, idx) => ({
            ...row,
            _rowId: row.id || `row_${idx}_${Date.now()}`
        }));

        localStorage.setItem(cacheKey, JSON.stringify(allTransactions));
        localStorage.setItem(timeKey, nowTime.toString());

        document.getElementById('statusIndicator').classList.add('hidden');

        applyFilters();

    } catch (err) {
        console.error("Supabase Query Error:", err);
        updateStatus(`เกิดข้อผิดพลาด: ${err.message}`, true);
    }
}

function setPeriod(period, shouldApply = true) {
    currentPeriod = period;

    document.getElementById('customDateContainer')
        .classList.toggle('hidden', period !== 'CUSTOM');

    document.querySelectorAll('.period-btn').forEach(btn => {
        const active = btn.dataset.period === period;

        btn.classList.toggle('bg-google-blue', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('border-google-blue', active);
        btn.classList.toggle('bg-white', !active);
        btn.classList.toggle('text-slate-600', !active);
        btn.classList.toggle('border-google-border', !active);
    });

    if (shouldApply) applyFilters();
}

function togglePeriodMenu() {
    document.getElementById('periodMenu').classList.toggle('hidden');
}

function handleCustomPeriodChange() {
    const period = document.getElementById('periodFilter').value;

    currentPeriod = period;

    document.getElementById('customDateContainer')
        .classList.toggle('hidden', period !== 'CUSTOM');

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

    applyFilters();
}

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
    const search =
        document.getElementById('searchInput').value
            .toLowerCase()
            .trim();

    const channel =
        document.getElementById('channelFilter').value;

    const status =
        document.getElementById('statusFilter').value;

    const period = currentPeriod;

    const showPKOnly =
        document.getElementById('showPKToggle').checked;

    const now = new Date();

    let startFilterDate = null;
    let endFilterDate = null;

    if (period === 'TODAY') {
        startFilterDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

    } else if (period === 'YESTERDAY') {
        startFilterDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1
        );

        endFilterDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1,
            23,
            59,
            59
        );

    } else if (period === 'THIS_WEEK') {
        const day = now.getDay() || 7;

        startFilterDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - day + 1
        );

    } else if (period === 'THIS_MONTH') {
        startFilterDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            1
        );

    } else if (period === 'LAST_MONTH') {
        startFilterDate = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            1
        );

        endFilterDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            0,
            23,
            59,
            59
        );

    } else if (period === 'THIS_YEAR') {
        startFilterDate = new Date(
            now.getFullYear(),
            0,
            1
        );

    } else if (period === 'CUSTOM') {
        const s = document.getElementById('startDate').value;
        const e = document.getElementById('endDate').value;

        if (s) {
            startFilterDate = new Date(
                s + 'T00:00:00'
            );
        }

        if (e) {
            endFilterDate = new Date(
                e + 'T23:59:59'
            );
        }
    }

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
        if (
            showPKOnly &&
            !selectedRowIds.has(item._rowId)
        ) {
            return false;
        }

        const itemChannel =
            String(item.channel || '');

        const itemStatus =
            String(item.status || 'PENDING');

        const textMatch =
            !search ||
            String(item.invoice_no || '')
                .toLowerCase()
                .includes(search) ||
            String(item.order_no || '')
                .toLowerCase()
                .includes(search) ||
            String(item.item_code || '')
                .toLowerCase()
                .includes(search) ||
            String(item.item_name || '')
                .toLowerCase()
                .includes(search);

        const channelMatch =
            channel === 'ALL' ||
            itemChannel.toLowerCase() ===
            channel.toLowerCase();

        const statusMatch =
            status === 'ALL' ||
            itemStatus.toUpperCase() ===
            status.toUpperCase();

        let dateMatch = true;

        if (startFilterDate || endFilterDate) {
            const rowDate = new Date(item.date);

            if (
                startFilterDate &&
                rowDate < startFilterDate
            ) {
                dateMatch = false;
            }

            if (
                endFilterDate &&
                rowDate > endFilterDate
            ) {
                dateMatch = false;
            }
        }

        item._isDuplicate =
            invoiceCounts[item.invoice_no] > 1 ||
            orderCounts[item.order_no] > 1;

        return (
            textMatch &&
            channelMatch &&
            statusMatch &&
            dateMatch
        );
    });

    filteredTransactions.sort((a, b) => {
        let valA = a[currentSortColumn] ?? '';
        let valB = b[currentSortColumn] ?? '';

        if (
            currentSortColumn === 'sales_amt' ||
            currentSortColumn === 'qty'
        ) {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) {
            return currentSortAsc ? -1 : 1;
        }

        if (valA > valB) {
            return currentSortAsc ? 1 : -1;
        }

        return 0;
    });

    updateSortIcons();

    filteredOrderGroups =
        getUniqueOrderGroups(filteredTransactions);

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
        const el =
            document.getElementById(`sort_${col}`);

        if (!el) return;

        if (col === currentSortColumn) {
            el.className =
                "ml-0.5 text-[10px] text-google-blue font-bold";

            el.innerHTML =
                currentSortAsc
                    ? `<i class="fa-solid fa-arrow-up-wide-short"></i>`
                    : `<i class="fa-solid fa-arrow-down-wide-short"></i>`;

        } else {
            el.className =
                "ml-0.5 text-[10px] text-slate-300";

            el.innerHTML =
                `<i class="fa-solid fa-arrow-down-wide-short"></i>`;
        }
    });
}

function renderTable() {
    const tbody =
        document.getElementById('txTableBody');

    tbody.innerHTML = '';

    const totalOrders =
        filteredOrderGroups.length;

    const visibleGroups =
        filteredOrderGroups.slice(
            0,
            displayLimit
        );

    const pageData =
        visibleGroups.flatMap(
            group => group.items
        );

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
            const isSelected =
                selectedRowIds.has(row._rowId);

            const isDup =
                row._isDuplicate;

            let channelBadgeClass =
                "bg-slate-100 text-slate-700 border-slate-200";

            const ch =
                String(row.channel || '')
                    .toLowerCase();

            if (ch.includes('shopee')) {
                channelBadgeClass =
                    "bg-shopee text-white";
            } else if (ch.includes('lazada')) {
                channelBadgeClass =
                    "bg-lazada text-white";
            } else if (ch.includes('tiktok')) {
                channelBadgeClass =
                    "bg-tiktok text-white";
            }

            const currentStatus =
                pendingStatusChanges[row._rowId] ||
                row.status ||
                'PENDING';

            const orderNo =
                String(row.order_no || '-');

            const orderPrefix =
                orderNo.length > 3
                    ? orderNo.slice(0, -3)
                    : '';

            const orderTail =
                orderNo.length > 3
                    ? orderNo.slice(-3)
                    : orderNo;

            const qty =
                Number(row.qty) || 0;

            const qtyClass =
                qty > 1
                    ? 'text-google-red'
                    : 'text-slate-900';

            const tr =
                document.createElement('tr');

            let rowBgClass =
                "hover:bg-slate-50";

            if (isDup) {
                rowBgClass =
                    "row-duplicate";
            }

            if (isSelected) {
                rowBgClass =
                    "row-selected";
            }

            tr.className =
                `transition-colors border-b border-slate-100 cursor-pointer ${rowBgClass}`;

            tr.onclick = (e) => {
                if (
                    e.target.tagName === 'SELECT' ||
                    e.target.tagName === 'OPTION' ||
                    e.target.tagName === 'INPUT'
                ) {
                    return;
                }

                toggleRowSelection(
                    row._rowId
                );
            };

            tr.innerHTML = `
                <td class="p-2 align-top font-mono text-[11px] text-slate-600">
                    <span class="sm:hidden block leading-tight">
                    <span class="block text-[13px] font-semibold">
                        ${formatDateFormatted(row.date, true).substring(0, 5)}
                    </span>

                    <span class="block text-[15px] font-bold">
    ${(() => {
        const day = parseInt(formatDateFormatted(row.date, true).substring(6), 10);
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
                        <div class="mobile-order-main font-bold text-slate-900 font-mono truncate" title="${row.invoice_no || ''}">
                            ${row.invoice_no || '-'}
                        </div>
                        <div class="text-[9px] text-google-gray font-mono truncate" title="${orderNo}">
                            ${orderPrefix}
                        </div>
                        <div class="mobile-order-tail font-mono text-slate-900">
                            ${orderTail}
                        </div>
                    </div>

                    <div class="hidden sm:block leading-tight">
                        <div class="font-bold text-slate-900 font-mono">
                            ${row.invoice_no || '-'}
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

                <td class="p-2 font-medium text-slate-800 hidden sm:table-cell max-w-[200px] truncate" title="${row.item_name || ''}">
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
                    <select onchange="handleStatusChange('${row._rowId}', this.value)" class="bg-white border border-google-border rounded px-1 py-0.5 text-[10px] font-semibold focus:outline-none focus:border-google-blue">
                        <option value="PENDING" ${currentStatus === 'PENDING' ? 'selected' : ''}>PENDING</option>
                        <option value="ACTIVE" ${currentStatus === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
                        <option value="VOID" ${currentStatus === 'VOID' ? 'selected' : ''}>VOID</option>
                    </select>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    document.getElementById('orderCountTop').innerHTML = `
        <i class="fa-solid fa-circle text-[6px] order-count-live-icon"></i>
        <span class="order-count-live">${totalOrders.toLocaleString()}</span>
        <span>Orders</span>
    `;

    document.getElementById('selectedCountText').innerText =
        selectedRowIds.size.toLocaleString();

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
    pendingStatusChanges[rowId] =
        newStatus;

    updatePendingChangesCount();
}

function updatePendingChangesCount() {
    const count =
        Object.keys(pendingStatusChanges).length;

    document.getElementById(
        'pendingChangesCount'
    ).innerText = count;

    document.getElementById(
        'submitBtn'
    ).disabled = count === 0;
}

async function submitChanges() {
    const count =
        Object.keys(pendingStatusChanges).length;

    if (count === 0) return;

    updateStatus(
        `กำลังบันทึก ${count} รายการลง Supabase...`
    );

    try {
        const updatePromises =
            Object.keys(pendingStatusChanges)
                .map(rowId => {
                    const item =
                        allTransactions.find(
                            t => t._rowId === rowId
                        );

                    if (!item || !item.id) {
                        return Promise.resolve();
                    }

                    const newStatus =
                        pendingStatusChanges[rowId];

                    return supabaseClient
                        .from('transactions')
                        .update({
                            status: newStatus
                        })
                        .eq('id', item.id);
                });

        const results =
            await Promise.all(
                updatePromises
            );

        Object.keys(
            pendingStatusChanges
        ).forEach(
            (rowId, index) => {
                const item =
                    allTransactions.find(
                        t => t._rowId === rowId
                    );

                if (
                    item &&
                    !results[index]?.error
                ) {
                    item.status =
                        pendingStatusChanges[rowId];
                }
            }
        );

        const failedResult =
            results.find(
                result => result?.error
            );

        if (failedResult?.error) {
            throw failedResult.error;
        }

        pendingStatusChanges = {};

        localStorage.setItem(
            'uerp_orders_cache',
            JSON.stringify(allTransactions)
        );

        updateStatus(
            'บันทึกเรียบร้อย!'
        );

        setTimeout(() => {
            document.getElementById(
                'statusIndicator'
            ).classList.add('hidden');
        }, 2000);

        applyFilters();

    } catch (err) {
        console.error(
            "Submit Error:",
            err
        );

        updateStatus(
            `เกิดข้อผิดพลาด: ${err.message}`,
            true
        );
    }
}

function setupInfiniteScroll() {
    const grid =
        document.querySelector('.transactions-grid');

    if (!grid) return;

    grid.addEventListener('scroll', () => {
        if (
            grid.scrollTop +
            grid.clientHeight >=
            grid.scrollHeight - 250
        ) {
            if (
                displayLimit <
                filteredOrderGroups.length
            ) {
                document.getElementById(
                    'infiniteLoader'
                ).classList.remove('hidden');

                setTimeout(() => {
                    displayLimit += limitStep;

                    renderTable();

                    document.getElementById(
                        'infiniteLoader'
                    ).classList.add('hidden');
                }, 150);
            }
        }
    });
}
