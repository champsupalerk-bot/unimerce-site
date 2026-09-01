/* ==========================================================================
   UERP - Quotation Module Engine
   File: /uerp/quotation.js
   ========================================================================== */
let cart = [];
let customerMode = 'db'; // 'db' | 'manual'
// Cache ในหน่วยความจำ
let cachedCustomers = [];
let cachedProducts = [];
let isDataLoaded = false;
// ==========================================================================
// INITIALIZE
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const lblDate = document.getElementById('lblDocDate');
    const lblNo = document.getElementById('lblDocNo');
    if (lblDate) {
        lblDate.innerText =
            new Date().toLocaleDateString('th-TH');
    }
    if (lblNo) {
        lblNo.innerText =
            'QT-' +
            new Date().toISOString().slice(0, 7).replace('-', '') +
            '-' +
            Math.floor(1000 + Math.random() * 9000);
    }
    await initLocalCache();
});
// ==========================================================================
// BATCH LOADING & CACHING ENGINE
// ==========================================================================
async function initLocalCache() {
    showSearchLoading(true);
    try {
        console.log(
            "UERP Engine: Starting Data Pre-load & Caching..."
        );
        // ------------------------------------------------------------------
        // CUSTOMER MASTER
        // ------------------------------------------------------------------
        cachedCustomers = await fetchAllBatches(
            '/customer_master?select=customer_code,customer_name,tax_id,phone,email,customer_address'
        );
        console.log(
            `Loaded Customers: ${cachedCustomers.length} records`
        );
        // ------------------------------------------------------------------
        // PRODUCTS
        // ------------------------------------------------------------------
        // ใช้ชื่อ Field ใหม่ตาม Supabase
        // ------------------------------------------------------------------
        cachedProducts = await fetchAllBatches(
            '/products?select=item_code,name,pricec,pricea,priceb,priced,pricel,promotion_price'
        );
        console.log(
            `Loaded Products: ${cachedProducts.length} records`
        );
        isDataLoaded = true;
    } catch (err) {
        console.error(
            "Cache Loading Error:",
            err
        );
    } finally {
        showSearchLoading(false);
    }
}
// ==========================================================================
// FETCH ALL BATCHES
// ==========================================================================
async function fetchAllBatches(endpointWithSelect) {
    let allData = [];
    let offset = 0;
    const limit = 1000;
    let keepFetching = true;
    while (keepFetching) {
        const separator =
            endpointWithSelect.includes('?')
                ? '&'
                : '?';
        const url =
            `${endpointWithSelect}${separator}` +
            `limit=${limit}&offset=${offset}`;
        const data =
            await window.supabaseFetch(url);
        if (
            Array.isArray(data) &&
            data.length > 0
        ) {
            allData =
                allData.concat(data);
            offset += limit;
            if (data.length < limit) {
                keepFetching = false;
            }
        } else {
            keepFetching = false;
        }
    }
    return allData;
}
// ==========================================================================
// SEARCH LOADING UI
// ==========================================================================
function showSearchLoading(isLoading) {
    const custInput =
        document.getElementById(
            'custSearchInput'
        );
    const prodInput =
        document.getElementById(
            'prodSearchInput'
        );
    if (isLoading) {
        if (custInput) {
            custInput.placeholder =
                "กำลังโหลดข้อมูลลูกค้า (กรุณารอสักครู่)...";
        }
        if (prodInput) {
            prodInput.placeholder =
                "กำลังโหลดข้อมูลสินค้า (กรุณารอสักครู่)...";
        }
    } else {
        if (custInput) {
            custInput.placeholder =
                "พิมพ์คำค้นหาลูกค้า (ชื่อ, รหัส, เบอร์โทร, เลขภาษี ฯลฯ)...";
        }
        if (prodInput) {
            prodInput.placeholder =
                "พิมพ์รหัสสินค้า (Item Code) หรือ ชื่อสินค้า (Name)...";
        }
    }
}
// ==========================================================================
// 1. CUSTOMER LOGIC
// ==========================================================================
function setCustomerMode(mode) {
    customerMode = mode;
    const btnDB =
        document.getElementById(
            'btnModeDB'
        );
    const btnManual =
        document.getElementById(
            'btnModeManual'
        );
    const searchContainer =
        document.getElementById(
            'customerSearchContainer'
        );
    if (mode === 'db') {
        if (btnDB) {
            btnDB.className =
                "px-3 py-1 rounded-md text-xs font-semibold bg-white text-blue-600 shadow-sm transition";
        }
        if (btnManual) {
            btnManual.className =
                "px-3 py-1 rounded-md text-xs font-semibold text-gray-600 transition";
        }
        if (searchContainer) {
            searchContainer.classList.remove(
                'hidden'
            );
        }
    } else {
        if (btnManual) {
            btnManual.className =
                "px-3 py-1 rounded-md text-xs font-semibold bg-white text-blue-600 shadow-sm transition";
        }
        if (btnDB) {
            btnDB.className =
                "px-3 py-1 rounded-md text-xs font-semibold text-gray-600 transition";
        }
        if (searchContainer) {
            searchContainer.classList.add(
                'hidden'
            );
        }
        clearCustomerFields();
    }
}
// ==========================================================================
// SEARCH CUSTOMERS
// ==========================================================================
function searchCustomers(query) {
    const dropdown =
        document.getElementById(
            'custDropdown'
        );
    const q =
        query.trim().toLowerCase();
    if (!q) {
        if (dropdown) {
            dropdown.classList.add(
                'hidden'
            );
        }
        return;
    }
    const filtered =
        cachedCustomers
            .filter(c =>
                (
                    c.customer_code &&
                    String(c.customer_code)
                        .toLowerCase()
                        .includes(q)
                )
                ||
                (
                    c.customer_name &&
                    String(c.customer_name)
                        .toLowerCase()
                        .includes(q)
                )
                ||
                (
                    c.phone &&
                    String(c.phone)
                        .includes(q)
                )
                ||
                (
                    c.email &&
                    String(c.email)
                        .toLowerCase()
                        .includes(q)
                )
                ||
                (
                    c.tax_id &&
                    String(c.tax_id)
                        .includes(q)
                )
            )
            .slice(0, 15);
    if (!dropdown) {
        return;
    }
    if (filtered.length === 0) {
        dropdown.innerHTML =
            `<div class="p-3 text-gray-400 text-xs">
                ไม่พบข้อมูลลูกค้า
             </div>`;
    } else {
        dropdown.innerHTML =
            filtered
                .map(c => `
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
                            ${c.customer_address || '-'}
                            | Tel: ${c.phone || '-'}
                        </div>
                    </div>
                `)
                .join('');
    }
    dropdown.classList.remove(
        'hidden'
    );
}
// ==========================================================================
// SELECT CUSTOMER
// ==========================================================================
function selectCustomer(cust) {
    const custName =
        document.getElementById(
            'custName'
        );
    const custTaxId =
        document.getElementById(
            'custTaxId'
        );
    const custPhone =
        document.getElementById(
            'custPhone'
        );
    const custAddress =
        document.getElementById(
            'custAddress'
        );
    const custEmail =
        document.getElementById(
            'custEmail'
        );
    if (custName) {
        custName.value =
            cust.customer_name || '';
    }
    if (custTaxId) {
        custTaxId.value =
            cust.tax_id || '';
    }
    if (custPhone) {
        custPhone.value =
            cust.phone || '';
    }
    if (custAddress) {
        custAddress.value =
            cust.customer_address || '';
    }
    if (custEmail) {
        custEmail.value =
            cust.email || '';
    }
    const dropdown =
        document.getElementById(
            'custDropdown'
        );
    const searchInput =
        document.getElementById(
            'custSearchInput'
        );
    if (dropdown) {
        dropdown.classList.add(
            'hidden'
        );
    }
    if (searchInput) {
        searchInput.value = '';
    }
}
// ==========================================================================
// CLEAR CUSTOMER
// ==========================================================================
function clearCustomerFields() {
    const ids = [
        'custName',
        'custTaxId',
        'custPhone',
        'custAddress',
        'custEmail'
    ];
    ids.forEach(id => {
        const el =
            document.getElementById(id);
        if (el) {
            el.value = '';
        }
    });
}
// ==========================================================================
// 2. PRODUCT SELECTION & CART LOGIC
// ==========================================================================
function searchProducts(query) {
    const dropdown =
        document.getElementById(
            'prodDropdown'
        );
    const q =
        query.trim().toLowerCase();
    if (!q) {
        if (dropdown) {
            dropdown.classList.add(
                'hidden'
            );
        }
        return;
    }
    const filtered =
        cachedProducts
            .filter(p =>
                (
                    p.item_code &&
                    String(p.item_code)
                        .toLowerCase()
                        .includes(q)
                )
                ||
                (
                    p.name &&
                    String(p.name)
                        .toLowerCase()
                        .includes(q)
                )
            )
            .slice(0, 15);
    if (!dropdown) {
        return;
    }
    if (filtered.length === 0) {
        dropdown.innerHTML =
            `<div class="p-3 text-gray-400 text-xs">
                ไม่พบรายการสินค้า
             </div>`;
    } else {
        dropdown.innerHTML =
            filtered
                .map(p => `
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
                                Price C:
                                ${(Number(p.pricec) || 0).toLocaleString()}
                                ฿
                            </span>
                        </div>
                    </div>
                `)
                .join('');
    }
    dropdown.classList.remove(
        'hidden'
    );
}
// ==========================================================================
// ADD PRODUCT TO CART
// ==========================================================================
function addProductToCart(product) {
    // Price C เป็น Default
    const defaultPrice =
        product.pricec ?? 0;
    const item = {
        id:
            Date.now() +
            Math.random(),
        item_code:
            product.item_code,
        name:
            product.name || '',
        productRef:
            product,
        selectedPriceTier:
            'pricec',
        unitPrice:
            parseFloat(defaultPrice) || 0,
        qty:
            1,
        discountVal:
            0,
        discountType:
            'THB'
    };
    cart.push(item);
    const dropdown =
        document.getElementById(
            'prodDropdown'
        );
    const searchInput =
        document.getElementById(
            'prodSearchInput'
        );
    if (dropdown) {
        dropdown.classList.add(
            'hidden'
        );
    }
    if (searchInput) {
        searchInput.value = '';
    }
    renderCart();
}
// ==========================================================================
// UPDATE PRICE TIER
// ==========================================================================
function updateTierPrice(
    cartId,
    tierName
) {
    const item =
        cart.find(
            i => i.id === cartId
        );
    if (!item) {
        return;
    }
    item.selectedPriceTier =
        tierName;
    if (tierName !== 'MANUAL') {
        item.unitPrice =
            parseFloat(
                item.productRef[tierName] || 0
            );
    }
    renderCart();
}
// ==========================================================================
// UPDATE MANUAL PRICE
// ==========================================================================
function updateUnitPrice(
    cartId,
    newPrice
) {
    const item =
        cart.find(
            i => i.id === cartId
        );
    if (item) {
        item.unitPrice =
            parseFloat(newPrice) || 0;
        item.selectedPriceTier =
            'MANUAL';
        calculateTotals();
    }
}
// ==========================================================================
// UPDATE QUANTITY
// ==========================================================================
function updateQty(
    cartId,
    qty
) {
    const item =
        cart.find(
            i => i.id === cartId
        );
    if (item) {
        item.qty =
            Math.max(
                1,
                parseInt(qty) || 1
            );
        calculateTotals();
    }
}
// ==========================================================================
// UPDATE ROW DISCOUNT
// ==========================================================================
function updateRowDiscount(
    cartId,
    val,
    type
) {
    const item =
        cart.find(
            i => i.id === cartId
        );
    if (item) {
        if (val !== null) {
            item.discountVal =
                parseFloat(val) || 0;
        }
        if (type !== null) {
            item.discountType =
                type;
        }
        calculateTotals();
    }
}
// ==========================================================================
// REMOVE CART ITEM
// ==========================================================================
function removeCartItem(cartId) {
    cart =
        cart.filter(
            i => i.id !== cartId
        );
    renderCart();
}
// ==========================================================================
// RENDER CART
// ==========================================================================
function renderCart() {
    const tbody =
        document.getElementById(
            'cartItemsTable'
        );
    if (!tbody) {
        return;
    }
    if (cart.length === 0) {
        tbody.innerHTML = `
            <tr id="emptyRow">
                <td
                    colspan="8"
                    class="text-center py-8 text-gray-400">
                    ยังไม่มีรายการสินค้า
                    กรุณาค้นหาและเลือกสินค้าด้านบน
                </td>
            </tr>
        `;
        calculateTotals();
        return;
    }
    tbody.innerHTML =
        cart
            .map(
                (item, index) => {
                    const lineTotal =
                        getLineTotal(item);
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
                                <option
                                    value="pricec"
                                    ${item.selectedPriceTier === 'pricec' ? 'selected' : ''}>
                                    Price C (Default)
                                </option>
                                <option
                                    value="pricea"
                                    ${item.selectedPriceTier === 'pricea' ? 'selected' : ''}>
                                    Price A
                                </option>
                                <option
                                    value="priceb"
                                    ${item.selectedPriceTier === 'priceb' ? 'selected' : ''}>
                                    Price B
                                </option>
                                <option
                                    value="priced"
                                    ${item.selectedPriceTier === 'priced' ? 'selected' : ''}>
                                    Price D
                                </option>
                                <option
                                    value="pricel"
                                    ${item.selectedPriceTier === 'pricel' ? 'selected' : ''}>
                                    Price L
                                </option>
                                <option
                                    value="promotion_price"
                                    ${item.selectedPriceTier === 'promotion_price' ? 'selected' : ''}>
                                    Promo Price
                                </option>
                                <option
                                    value="MANUAL"
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
                                    <option
                                        value="THB"
                                        ${item.discountType === 'THB' ? 'selected' : ''}>
                                        ฿
                                    </option>
                                    <option
                                        value="PERCENT"
                                        ${item.discountType === 'PERCENT' ? 'selected' : ''}>
                                        %
                                    </option>
                                </select>
                            </div>
                        </td>
                        <td
                            class="py-3 px-2 text-right font-bold text-slate-800"
                            id="lineTotal_${item.id}">
                            ${lineTotal.toLocaleString(
                                'th-TH',
                                {
                                    minimumFractionDigits: 2
                                }
                            )} ฿
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
                }
            )
            .join('');
    calculateTotals();
}
// ==========================================================================
// LINE TOTAL
// ==========================================================================
function getLineTotal(item) {
    const rawTotal =
        item.unitPrice *
        item.qty;
    let discount = 0;
    if (
        item.discountType ===
        'PERCENT'
    ) {
        discount =
            rawTotal *
            (item.discountVal / 100);
    } else {
        discount =
            item.discountVal;
    }
    return Math.max(
        0,
        rawTotal - discount
    );
}
// ==========================================================================
// 3. CALCULATIONS
// ไม่มี VAT
// ==========================================================================
function calculateTotals() {
    let subtotal = 0;
    cart.forEach(item => {
        const total =
            getLineTotal(item);
        const el =
            document.getElementById(
                `lineTotal_${item.id}`
            );
        if (el) {
            el.innerText =
                total.toLocaleString(
                    'th-TH',
                    {
                        minimumFractionDigits: 2
                    }
                ) + ' ฿';
        }
        subtotal += total;
    });
    const billDiscValInput =
        document.getElementById(
            'billDiscountVal'
        );
    const billDiscTypeInput =
        document.getElementById(
            'billDiscountType'
        );
    const billDiscVal =
        billDiscValInput
            ? parseFloat(
                billDiscValInput.value
            ) || 0
            : 0;
    const billDiscType =
        billDiscTypeInput
            ? billDiscTypeInput.value
            : 'THB';
    let billDiscountAmt = 0;
    if (
        billDiscType ===
        'PERCENT'
    ) {
        billDiscountAmt =
            subtotal *
            (billDiscVal / 100);
    } else {
        billDiscountAmt =
            billDiscVal;
    }
    const grandTotal =
        Math.max(
            0,
            subtotal - billDiscountAmt
        );
    const elSub =
        document.getElementById(
            'txtSubtotal'
        );
    const elGrand =
        document.getElementById(
            'txtGrandTotal'
        );
    if (elSub) {
        elSub.innerText =
            subtotal.toLocaleString(
                'th-TH',
                {
                    minimumFractionDigits: 2
                }
            ) + ' ฿';
    }
    if (elGrand) {
        elGrand.innerText =
            grandTotal.toLocaleString(
                'th-TH',
                {
                    minimumFractionDigits: 2
                }
            ) + ' ฿';
    }
    return {
        subtotal,
        billDiscountAmt,
        grandTotal
    };
}
// ==========================================================================
// 4. PREVIEW & EXPORT
// ==========================================================================
function openPreviewModal() {
    const custName =
        document.getElementById(
            'custName'
        )
            ? document.getElementById(
                'custName'
            ).value.trim()
            : '';
    if (!custName) {
        alert(
            'กรุณากรอกข้อมูลลูกค้าอย่างน้อยชื่อลูกค้าก่อนดู Preview'
        );
        return;
    }
    document.getElementById(
        'lblCustName'
    ).innerText =
        custName;
    document.getElementById(
        'lblCustAddress'
    ).innerText =
        document.getElementById(
            'custAddress'
        ).value
            ? 'ที่อยู่: ' +
              document.getElementById(
                  'custAddress'
              ).value
            : '';
    document.getElementById(
        'lblCustTax'
    ).innerText =
        document.getElementById(
            'custTaxId'
        ).value
            ? 'เลขประจำตัวผู้เสียภาษี: ' +
              document.getElementById(
                  'custTaxId'
              ).value
            : '';
    document.getElementById(
        'lblCustPhone'
    ).innerText =
        document.getElementById(
            'custPhone'
        ).value
            ? 'เบอร์โทร: ' +
              document.getElementById(
                  'custPhone'
              ).value
            : '';
    document.getElementById(
        'lblCustEmail'
    ).innerText =
        document.getElementById(
            'custEmail'
        ).value
            ? 'อีเมล: ' +
              document.getElementById(
                  'custEmail'
              ).value
            : '';
    document.getElementById(
        'lblDocRemark'
    ).innerText =
        document.getElementById(
            'docRemark'
        ).value || '-';
    const tbody =
        document.getElementById(
            'lblTableBody'
        );
    if (tbody) {
        tbody.innerHTML =
            cart
                .map(
                    (item, idx) => {
                        const lineTotal =
                            getLineTotal(item);
                        const discLabel =
                            item.discountVal > 0
                                ? (
                                    item.discountType ===
                                    'PERCENT'
                                        ? `${item.discountVal}%`
                                        : `${item.discountVal}฿`
                                  )
                                : '-';
                        return `
                        <tr>
                            <td class="py-2 px-2 text-center text-gray-500">
                                ${idx + 1}
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
                                ${item.unitPrice.toLocaleString(
                                    'th-TH',
                                    {
                                        minimumFractionDigits: 2
                                    }
                                )}
                            </td>
                            <td class="py-2 px-2 text-center">
                                ${item.qty}
                            </td>
                            <td class="py-2 px-2 text-center text-gray-600">
                                ${discLabel}
                            </td>
                            <td class="py-2 px-2 text-right font-medium">
                                ${lineTotal.toLocaleString(
                                    'th-TH',
                                    {
                                        minimumFractionDigits: 2
                                    }
                                )}
                            </td>
                        </tr>
                        `;
                    }
                )
                .join('');
    }
    const totals =
        calculateTotals();
    document.getElementById(
        'lblSubtotal'
    ).innerText =
        totals.subtotal.toLocaleString(
            'th-TH',
            {
                minimumFractionDigits: 2
            }
        );
    document.getElementById(
        'lblBillDiscount'
    ).innerText =
        totals.billDiscountAmt.toLocaleString(
            'th-TH',
            {
                minimumFractionDigits: 2
            }
        );
    document.getElementById(
        'lblGrandTotal'
    ).innerText =
        totals.grandTotal.toLocaleString(
            'th-TH',
            {
                minimumFractionDigits: 2
            }
        );
    document.getElementById(
        'previewModal'
    ).classList.remove(
        'hidden'
    );
}
// ==========================================================================
// CLOSE PREVIEW
// ==========================================================================
function closePreviewModal() {
    document.getElementById(
        'previewModal'
    ).classList.add(
        'hidden'
    );
}
// ==========================================================================
// DOWNLOAD DOCUMENT
// ==========================================================================
// PDF OPTIMIZATION
//
// เดิม:
// html2canvas scale: 2
// JPEG quality: 1.0
//
// ใหม่:
// html2canvas scale: 1.5
// JPEG quality: 0.75
// jsPDF compression: true
//
// ลดขนาด PDF ลงอย่างมาก โดยยังคงความคมชัดเพียงพอสำหรับ A4
// ==========================================================================
async function downloadDocument(type) {
    const paper =
        document.getElementById(
            'quotationPaper'
        );
    if (!paper) {
        return;
    }
    // ----------------------------------------------------------------------
    // Render HTML -> Canvas
    // ----------------------------------------------------------------------
    const canvas =
        await html2canvas(
            paper,
            {
                scale: 1.5,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            }
        );
    // ----------------------------------------------------------------------
    // JPEG
    // ----------------------------------------------------------------------
    if (type === 'jpeg') {
        const link =
            document.createElement('a');
        link.download =
            `Quotation_${
                document.getElementById(
                    'lblDocNo'
                ).innerText
            }.jpg`;
        link.href =
            canvas.toDataURL(
                'image/jpeg',
                0.85
            );
        link.click();
        return;
    }
    // ----------------------------------------------------------------------
    // PDF
    // ----------------------------------------------------------------------
    if (type === 'pdf') {
        const {
            jsPDF
        } = window.jspdf;
        // สร้าง A4 พร้อม compression
        const pdf =
            new jsPDF(
                {
                    orientation: 'p',
                    unit: 'mm',
                    format: 'a4',
                    compress: true
                }
            );
        // ------------------------------------------------------------------
        // JPEG สำหรับ PDF
        // ------------------------------------------------------------------
        // 0.75 ช่วยลดขนาดไฟล์ลงเยอะกว่าการใช้ 1.0
        // ------------------------------------------------------------------
        const imgData =
            canvas.toDataURL(
                'image/jpeg',
                0.75
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
        // ------------------------------------------------------------------
        // ใส่ภาพลง A4
        // ------------------------------------------------------------------
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
        // ------------------------------------------------------------------
        // Save
        // ------------------------------------------------------------------
        pdf.save(
            `Quotation_${
                document.getElementById(
                    'lblDocNo'
                ).innerText
            }.pdf`
        );
    }
}
// ==========================================================================
// RESET FORM
// ==========================================================================
function resetForm() {
    if (
        confirm(
            'คุณต้องการล้างข้อมูลในแบบฟอร์มทั้งหมดใช่หรือไม่?'
        )
    ) {
        cart = [];
        clearCustomerFields();
        const docRemark =
            document.getElementById(
                'docRemark'
            );
        const billDiscVal =
            document.getElementById(
                'billDiscountVal'
            );
        if (docRemark) {
            docRemark.value = '';
        }
        if (billDiscVal) {
            billDiscVal.value = '0';
        }
        renderCart();
    }
}
