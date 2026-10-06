/* ==========================================================================
   UERP - Quotation Module Engine
   File: /uerp/quotation.js
   ========================================================================== */

let cart = [];
let customerMode = 'db';
let cachedCustomers = [];
let cachedProducts = [];
let isDataLoaded = false;

const $ = id => document.getElementById(id);
const val = id => $(id)?.value?.trim() || '';
const setVal = (id, value) => {
    const el = $(id);
    if (el) el.value = value ?? '';
};
const money = n => (Number(n) || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2
});

/* ==========================================================================
   INITIALIZE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    const now = new Date();

    if ($('lblDocDate')) {
        $('lblDocDate').innerText = now.toLocaleDateString('th-TH');
    }

    if ($('lblDocNo')) {
        $('lblDocNo').innerText =
            `QT-${now.toISOString().slice(0, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    await initLocalCache();
});

/* ==========================================================================
   BATCH LOADING & CACHING
   ========================================================================== */

async function initLocalCache() {
    showSearchLoading(true);

    try {
        console.log('UERP Engine: Starting Data Pre-load & Caching...');

        cachedCustomers = await fetchAllBatches(
            '/customer_master?select=customer_code,customer_name,tax_id,phone,email,customer_address'
        );

        console.log(`Loaded Customers: ${cachedCustomers.length} records`);

        cachedProducts = await fetchAllBatches(
            '/itemmaster?select=item_code,name,pricec,pricea,priceb,priced,pricel,pricep'
        );

        console.log(`Loaded Products: ${cachedProducts.length} records`);

        isDataLoaded = true;
    } catch (err) {
        console.error('Cache Loading Error:', err);
    } finally {
        showSearchLoading(false);
    }
}

async function fetchAllBatches(endpoint) {
    const allData = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
        const separator = endpoint.includes('?') ? '&' : '?';
        const data = await window.supabaseFetch(
            `${endpoint}${separator}limit=${limit}&offset=${offset}`
        );

        if (!Array.isArray(data) || !data.length) break;

        allData.push(...data);
        offset += limit;

        if (data.length < limit) break;
    }

    return allData;
}

/* ==========================================================================
   SEARCH LOADING UI
   ========================================================================== */

function showSearchLoading(isLoading) {
    if ($('custSearchInput')) {
        $('custSearchInput').placeholder = isLoading
            ? 'กำลังโหลดข้อมูลลูกค้า (กรุณารอสักครู่)...'
            : 'พิมพ์คำค้นหาลูกค้า (ชื่อ, รหัส, เบอร์โทร, เลขภาษี ฯลฯ)...';
    }

    if ($('prodSearchInput')) {
        $('prodSearchInput').placeholder = isLoading
            ? 'กำลังโหลดข้อมูลสินค้า (กรุณารอสักครู่)...'
            : 'พิมพ์รหัสสินค้า (Item Code) หรือ ชื่อสินค้า (Name)...';
    }
}

/* ==========================================================================
   1. CUSTOMER LOGIC
   ========================================================================== */

function setCustomerMode(mode) {
    customerMode = mode;

    const db = $('btnModeDB');
    const manual = $('btnModeManual');
    const search = $('customerSearchContainer');

    const active =
        'px-3 py-1 rounded-md text-xs font-semibold bg-white text-blue-600 shadow-sm transition';

    const inactive =
        'px-3 py-1 rounded-md text-xs font-semibold text-gray-600 transition';

    if (mode === 'db') {
        if (db) db.className = active;
        if (manual) manual.className = inactive;
        search?.classList.remove('hidden');
    } else {
        if (manual) manual.className = active;
        if (db) db.className = inactive;
        search?.classList.add('hidden');
        clearCustomerFields();
    }
}

function searchCustomers(query) {
    const dropdown = $('custDropdown');
    const q = query.trim().toLowerCase();

    if (!q) {
        dropdown?.classList.add('hidden');
        return;
    }

    const filtered = cachedCustomers
        .filter(c =>
            String(c.customer_code || '').toLowerCase().includes(q) ||
            String(c.customer_name || '').toLowerCase().includes(q) ||
            String(c.phone || '').includes(q) ||
            String(c.email || '').toLowerCase().includes(q) ||
            String(c.tax_id || '').includes(q)
        )
        .slice(0, 15);

    if (!dropdown) return;

    dropdown.innerHTML = filtered.length
        ? filtered.map(c => `
            <div
                onclick='selectCustomer(${JSON.stringify(c).replace(/'/g, "&#39;")})'
                class="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0">
                <div class="font-bold text-slate-800 text-xs">
                    ${c.customer_name || 'ไม่ระบุชื่อ'}
                    <span class="text-gray-400 font-normal">
                        (${c.customer_code || '-'})
                    </span>
                </div>
                <div class="text-[11px] text-gray-500">
                    ${c.customer_address || '-'} | Tel: ${c.phone || '-'}
                </div>
            </div>
        `).join('')
        : `<div class="p-3 text-gray-400 text-xs">ไม่พบข้อมูลลูกค้า</div>`;

    dropdown.classList.remove('hidden');
}

function selectCustomer(cust) {
    setVal('custName', cust.customer_name);
    setVal('custTaxId', cust.tax_id);
    setVal('custPhone', cust.phone);
    setVal('custAddress', cust.customer_address);
    setVal('custEmail', cust.email);

    $('custDropdown')?.classList.add('hidden');
    setVal('custSearchInput', '');
}

function clearCustomerFields() {
    [
        'custName',
        'custTaxId',
        'custPhone',
        'custAddress',
        'custEmail'
    ].forEach(id => setVal(id, ''));
}

/* ==========================================================================
   2. PRODUCT SEARCH & CART
   ========================================================================== */

function searchProducts(query) {
    const dropdown = $('prodDropdown');
    const q = query.trim().toLowerCase();

    if (!q) {
        dropdown?.classList.add('hidden');
        return;
    }

    const filtered = cachedProducts
        .filter(p =>
            String(p.item_code || '').toLowerCase().includes(q) ||
            String(p.name || '').toLowerCase().includes(q)
        )
        .slice(0, 15);

    if (!dropdown) return;

    dropdown.innerHTML = filtered.length
        ? filtered.map(p => `
            <div
                onclick='addProductToCart(${JSON.stringify(p).replace(/'/g, "&#39;")})'
                class="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 flex justify-between items-center">
                <div>
                    <div class="font-bold text-slate-800 text-xs">
                        ${p.item_code || '-'}
                    </div>
                    <div class="text-xs text-gray-600">
                        ${p.name || '-'}
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-xs font-semibold text-blue-600">
                        Price C: ${money(p.pricec)} ฿
                    </span>
                </div>
            </div>
        `).join('')
        : `<div class="p-3 text-gray-400 text-xs">ไม่พบรายการสินค้า</div>`;

    dropdown.classList.remove('hidden');
}

function addProductToCart(product) {
    cart.push({
        id: Date.now() + Math.random(),
        item_code: product.item_code,
        name: product.name || '',
        productRef: product,
        selectedPriceTier: 'pricec',
        unitPrice: parseFloat(product.pricec) || 0,
        qty: 1,
        discountVal: 0,
        discountType: 'THB'
    });

    $('prodDropdown')?.classList.add('hidden');
    setVal('prodSearchInput', '');

    renderCart();
}

function updateTierPrice(cartId, tierName) {
    const item = cart.find(i => i.id === cartId);
    if (!item) return;

    item.selectedPriceTier = tierName;

    if (tierName !== 'MANUAL') {
        item.unitPrice = parseFloat(item.productRef[tierName]) || 0;
    }

    renderCart();
}

function updateUnitPrice(cartId, newPrice) {
    const item = cart.find(i => i.id === cartId);
    if (!item) return;

    item.unitPrice = parseFloat(newPrice) || 0;
    item.selectedPriceTier = 'MANUAL';

    calculateTotals();
}

function updateQty(cartId, qty) {
    const item = cart.find(i => i.id === cartId);
    if (!item) return;

    item.qty = Math.max(1, parseInt(qty) || 1);
    calculateTotals();
}

function updateRowDiscount(cartId, value, type) {
    const item = cart.find(i => i.id === cartId);
    if (!item) return;

    if (value !== null) {
        item.discountVal = parseFloat(value) || 0;
    }

    if (type !== null) {
        item.discountType = type;
    }

    calculateTotals();
}

function removeCartItem(cartId) {
    cart = cart.filter(i => i.id !== cartId);
    renderCart();
}

/* ==========================================================================
   CART RENDER
   ========================================================================== */

function renderCart() {
    const tbody = $('cartItemsTable');
    if (!tbody) return;

    if (!cart.length) {
        tbody.innerHTML = `
            <tr id="emptyRow">
                <td colspan="8" class="text-center py-8 text-gray-400">
                    ยังไม่มีรายการสินค้า
                    กรุณาค้นหาและเลือกสินค้าด้านบน
                </td>
            </tr>
        `;
        calculateTotals();
        return;
    }

    tbody.innerHTML = cart.map((item, index) => {
        const lineTotal = getLineTotal(item);

        return `
            <tr class="hover:bg-gray-50 text-xs">
                <td class="py-3 px-2 text-center font-semibold text-gray-500">
                    ${index + 1}
                </td>

                <td class="py-3 px-3">
                    <div class="font-bold text-slate-800">
                        ${item.item_code}
                    </div>
                    <div class="text-gray-500 text-[11px]">
                        ${item.name}
                    </div>
                </td>

                <td class="py-3 px-2 text-center">
                    <select
                        onchange="updateTierPrice(${item.id}, this.value)"
                        class="p-1 border rounded text-xs bg-white">

                        <option value="pricec"
                            ${item.selectedPriceTier === 'pricec' ? 'selected' : ''}>
                            Price C (Default)
                        </option>

                        <option value="pricea"
                            ${item.selectedPriceTier === 'pricea' ? 'selected' : ''}>
                            Price A
                        </option>

                        <option value="priceb"
                            ${item.selectedPriceTier === 'priceb' ? 'selected' : ''}>
                            Price B
                        </option>

                        <option value="priced"
                            ${item.selectedPriceTier === 'priced' ? 'selected' : ''}>
                            Price D
                        </option>

                        <option value="pricel"
                            ${item.selectedPriceTier === 'pricel' ? 'selected' : ''}>
                            Price L
                        </option>

                        <option value="pricep"
                            ${item.selectedPriceTier === 'pricep' ? 'selected' : ''}>
                            Promo Price
                        </option>

                        <option value="MANUAL"
                            ${item.selectedPriceTier === 'MANUAL' ? 'selected' : ''}>
                            Manual Edit
                        </option>
                    </select>
                </td>

                <td class="py-3 px-2 text-right">
                    <input
                        type="number"
                        value="${item.unitPrice}"
                        step="any"
                        onchange="updateUnitPrice(${item.id}, this.value)"
                        class="w-24 p-1 border rounded text-right text-xs">
                </td>

                <td class="py-3 px-2 text-center">
                    <input
                        type="number"
                        value="${item.qty}"
                        min="1"
                        onchange="updateQty(${item.id}, this.value)"
                        class="w-16 p-1 border rounded text-center text-xs">
                </td>

                <td class="py-3 px-2 text-center">
                    <div class="flex items-center gap-1 justify-center">
                        <input
                            type="number"
                            value="${item.discountVal}"
                            min="0"
                            oninput="updateRowDiscount(${item.id}, this.value, null)"
                            class="w-16 p-1 border rounded text-right text-xs">

                        <select
                            onchange="updateRowDiscount(${item.id}, null, this.value)"
                            class="p-1 border rounded text-[10px] bg-white">

                            <option value="THB"
                                ${item.discountType === 'THB' ? 'selected' : ''}>
                                ฿
                            </option>

                            <option value="PERCENT"
                                ${item.discountType === 'PERCENT' ? 'selected' : ''}>
                                %
                            </option>
                        </select>
                    </div>
                </td>

                <td
                    class="py-3 px-2 text-right font-bold text-slate-800"
                    id="lineTotal_${item.id}">
                    ${money(lineTotal)} ฿
                </td>

                <td class="py-3 px-2 text-center">
                    <button
                        onclick="removeCartItem(${item.id})"
                        class="text-red-500 hover:text-red-700 text-sm">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    calculateTotals();
}

/* ==========================================================================
   CALCULATIONS
   ========================================================================== */

function getLineTotal(item) {
    const rawTotal = item.unitPrice * item.qty;

    const discount = item.discountType === 'PERCENT'
        ? rawTotal * (item.discountVal / 100)
        : item.discountVal;

    return Math.max(0, rawTotal - discount);
}

function calculateTotals() {
    let subtotal = 0;

    cart.forEach(item => {
        const total = getLineTotal(item);
        const el = $(`lineTotal_${item.id}`);

        if (el) el.innerText = `${money(total)} ฿`;

        subtotal += total;
    });

    const billDiscVal = parseFloat(val('billDiscountVal')) || 0;
    const billDiscType = val('billDiscountType') || 'THB';

    const billDiscountAmt = billDiscType === 'PERCENT'
        ? subtotal * (billDiscVal / 100)
        : billDiscVal;

    const grandTotal = Math.max(0, subtotal - billDiscountAmt);

    if ($('txtSubtotal')) {
        $('txtSubtotal').innerText = `${money(subtotal)} ฿`;
    }

    if ($('txtGrandTotal')) {
        $('txtGrandTotal').innerText = `${money(grandTotal)} ฿`;
    }

    return {
        subtotal,
        billDiscountAmt,
        grandTotal
    };
}

/* ==========================================================================
   3. PREVIEW
   ========================================================================== */

function openPreviewModal() {
    const custName = val('custName');

    if (!custName) {
        alert('กรุณากรอกข้อมูลลูกค้าอย่างน้อยชื่อลูกค้าก่อนดู Preview');
        return;
    }

    if ($('lblCustName')) {
        $('lblCustName').innerText = custName;
    }

    if ($('lblCustAddress')) {
        $('lblCustAddress').innerText = val('custAddress')
            ? `ที่อยู่: ${val('custAddress')}`
            : '';
    }

    if ($('lblCustTax')) {
        $('lblCustTax').innerText = val('custTaxId')
            ? `เลขประจำตัวผู้เสียภาษี: ${val('custTaxId')}`
            : '';
    }

    if ($('lblCustPhone')) {
        $('lblCustPhone').innerText = val('custPhone')
            ? `เบอร์โทร: ${val('custPhone')}`
            : '';
    }

    if ($('lblCustEmail')) {
        $('lblCustEmail').innerText = val('custEmail')
            ? `อีเมล: ${val('custEmail')}`
            : '';
    }

    if ($('lblDocRemark')) {
        $('lblDocRemark').innerText = val('docRemark') || '-';
    }

    const tbody = $('lblTableBody');

    if (tbody) {
        tbody.innerHTML = cart.map((item, index) => {
            const lineTotal = getLineTotal(item);

            const discLabel = item.discountVal > 0
                ? item.discountType === 'PERCENT'
                    ? `${item.discountVal}%`
                    : `${item.discountVal}฿`
                : '-';

            return `
                <tr>
                    <td class="py-2 px-2 text-center text-gray-500">
                        ${index + 1}
                    </td>

                    <td class="py-2 px-3">
                        <div class="font-bold text-slate-800">
                            ${item.item_code}
                        </div>
                        <div class="text-gray-500 text-[10px]">
                            ${item.name}
                        </div>
                    </td>

                    <td class="py-2 px-2 text-right">
                        ${money(item.unitPrice)}
                    </td>

                    <td class="py-2 px-2 text-center">
                        ${item.qty}
                    </td>

                    <td class="py-2 px-2 text-center text-gray-600">
                        ${discLabel}
                    </td>

                    <td class="py-2 px-2 text-right font-medium">
                        ${money(lineTotal)}
                    </td>
                </tr>
            `;
        }).join('');
    }

    const totals = calculateTotals();

    if ($('lblSubtotal')) {
        $('lblSubtotal').innerText = money(totals.subtotal);
    }

    if ($('lblBillDiscount')) {
        $('lblBillDiscount').innerText = money(totals.billDiscountAmt);
    }

    if ($('lblGrandTotal')) {
        $('lblGrandTotal').innerText = money(totals.grandTotal);
    }

    $('previewModal')?.classList.remove('hidden');
}

function closePreviewModal() {
    $('previewModal')?.classList.add('hidden');
}

/* ==========================================================================
   4. DOWNLOAD DOCUMENT
   ========================================================================== */

async function downloadDocument(type) {
    const paper = $('quotationPaper');
    if (!paper) return;

    const canvas = await html2canvas(paper, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
    });

    const docNo = $('lblDocNo')?.innerText || 'Quotation';

    if (type === 'jpeg') {
        const link = document.createElement('a');

        link.download = `Quotation_${docNo}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 1.0);

        link.click();
        return;
    }

    if (type === 'pdf') {
        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
            compress: true
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.86);
        const imgProps = pdf.getImageProperties(imgData);

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight =
            (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(
            imgData,
            'JPEG',
            0,
            0,
            pdfWidth,
            pdfHeight,
            undefined,
            'FAST'
        );

        pdf.save(`Quotation_${docNo}.pdf`);
    }
}

/* ==========================================================================
   5. RESET
   ========================================================================== */

function resetForm() {
    if (!confirm('คุณต้องการล้างข้อมูลในแบบฟอร์มทั้งหมดใช่หรือไม่?')) {
        return;
    }

    cart = [];

    clearCustomerFields();

    setVal('docRemark', '');
    setVal('billDiscountVal', '0');

    renderCart();
}

/* ==========================================================================
   6. REFRESH PRODUCT CACHE
   ========================================================================== */

async function refreshProductCache() {
    const refreshIcon = $('refreshIcon');

    refreshIcon?.classList.add('fa-spin');

    try {
        cachedProducts = await fetchAllBatches(
            '/itemmaster?select=item_code,name,pricec,pricea,priceb,priced,pricel,pricep'
        );

        alert(
            `อัปเดตข้อมูลสำเร็จ! ปัจจุบันมีสินค้าในระบบ ${cachedProducts.length.toLocaleString()} รายการ`
        );
    } catch (err) {
        console.error('Refresh Cache Error:', err);
        alert('เกิดข้อผิดพลาดในการดึงข้อมูลสินค้าใหม่ กรุณาลองใหม่อีกครั้ง');
    } finally {
        refreshIcon?.classList.remove('fa-spin');
    }
}

