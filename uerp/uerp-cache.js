/**
 * UERP Global Cache Engine
 * File: /uerp/uerp-cache.js
 *
 * หน้าที่:
 * - เก็บ Customer / Product Cache ใน Browser
 * - Cache อายุ 3 ชั่วโมง
 * - หมดอายุแล้วโหลดจาก Supabase ใหม่
 * - รองรับ Manual Refresh
 * - มี Execution Log แบบสั้น
 */

window.UERPCache = (() => {

    // ====================================================
    // CONFIG
    // ====================================================

    const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 ชั่วโมง

    const CACHE_KEYS = {
        customers: 'uerp_cache_customers',
        products: 'uerp_cache_products',
        timestamp: 'uerp_cache_timestamp'
    };


    // ====================================================
    // INTERNAL HELPERS
    // ====================================================

    function getTimestamp() {
        return parseInt(
            localStorage.getItem(CACHE_KEYS.timestamp) || '0',
            10
        );
    }

    function isCacheValid() {
        const timestamp = getTimestamp();

        if (!timestamp) return false;

        return (Date.now() - timestamp) < CACHE_TTL;
    }

    function getCacheAge() {
        const timestamp = getTimestamp();

        if (!timestamp) return null;

        const minutes = Math.floor(
            (Date.now() - timestamp) / 60000
        );

        return minutes;
    }

    function formatAge(minutes) {

        if (minutes === null) {
            return '-';
        }

        if (minutes < 60) {
            return `${minutes}m`;
        }

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        return `${hours}h ${mins}m`;
    }


    // ====================================================
    // READ CACHE
    // ====================================================

    function getCustomersFromCache() {

        try {
            const data = localStorage.getItem(
                CACHE_KEYS.customers
            );

            return data ? JSON.parse(data) : null;

        } catch (error) {

            console.warn(
                '[UERP Cache] Customer cache invalid'
            );

            return null;
        }
    }


    function getProductsFromCache() {

        try {
            const data = localStorage.getItem(
                CACHE_KEYS.products
            );

            return data ? JSON.parse(data) : null;

        } catch (error) {

            console.warn(
                '[UERP Cache] Product cache invalid'
            );

            return null;
        }
    }


    // ====================================================
    // LOAD FROM SUPABASE
    // ====================================================

    async function fetchAllBatches(endpointWithSelect) {

        let allData = [];
        let offset = 0;

        const limit = 1000;

        while (true) {

            const separator =
                endpointWithSelect.includes('?')
                    ? '&'
                    : '?';

            const url =
                `${endpointWithSelect}` +
                `${separator}limit=${limit}&offset=${offset}`;

            const data =
                await window.supabaseFetch(url);

            if (!Array.isArray(data) || data.length === 0) {
                break;
            }

            allData = allData.concat(data);

            offset += limit;

            if (data.length < limit) {
                break;
            }
        }

        return allData;
    }


    // ====================================================
    // LOAD ALL CACHE
    // ====================================================

    async function load(forceRefresh = false) {

        // -----------------------------------------------
        // ใช้ Cache เดิม
        // -----------------------------------------------

        if (!forceRefresh && isCacheValid()) {

            const customers = getCustomersFromCache();
            const products = getProductsFromCache();

            if (customers && products) {

                console.log(
                    `[UERP Cache] Customer: ${customers.length.toLocaleString()} cached`
                );

                console.log(
                    `[UERP Cache] Product: ${products.length.toLocaleString()} cached`
                );

                console.log(
                    `[UERP Cache] Ready ✓ | Cache age: ${formatAge(getCacheAge())}`
                );

                return {
                    customers,
                    products,
                    fromCache: true
                };
            }
        }


        // -----------------------------------------------
        // โหลดใหม่จาก Database
        // -----------------------------------------------

        const startTime = performance.now();

        console.log(
            '[UERP Cache] Loading fresh data...'
        );

        try {

            const customers =
                await fetchAllBatches(
                    '/customer_master?select=customer_code,customer_name,tax_id,phone,email,customer_address'
                );

            console.log(
                `[UERP Cache] Customer: ${customers.length.toLocaleString()} loaded ✓`
            );


            const products =
                await fetchAllBatches(
                    '/products?select=Item_Code,Description,PriceC,PriceA,PriceB,PriceD,PriceL,PromotionPrice'
                );

            console.log(
                `[UERP Cache] Product: ${products.length.toLocaleString()} loaded ✓`
            );


            // -------------------------------------------
            // บันทึก Cache
            // -------------------------------------------

            localStorage.setItem(
                CACHE_KEYS.customers,
                JSON.stringify(customers)
            );

            localStorage.setItem(
                CACHE_KEYS.products,
                JSON.stringify(products)
            );

            localStorage.setItem(
                CACHE_KEYS.timestamp,
                String(Date.now())
            );


            const seconds =
                ((performance.now() - startTime) / 1000)
                .toFixed(1);


            console.log(
                `[UERP Cache] Complete ✓ | ` +
                `${(customers.length + products.length).toLocaleString()} records | ` +
                `${seconds}s`
            );


            return {
                customers,
                products,
                fromCache: false
            };

        } catch (error) {

            console.error(
                '[UERP Cache] Load failed ✕',
                error
            );

            // -------------------------------------------
            // ถ้ามี Cache เก่า ให้ใช้ต่อได้
            // -------------------------------------------

            const oldCustomers =
                getCustomersFromCache();

            const oldProducts =
                getProductsFromCache();

            if (oldCustomers && oldProducts) {

                console.warn(
                    '[UERP Cache] Using previous cached data ⚠'
                );

                return {
                    customers: oldCustomers,
                    products: oldProducts,
                    fromCache: true,
                    stale: true
                };
            }

            throw error;
        }
    }


    // ====================================================
    // MANUAL REFRESH
    // ====================================================

    async function refresh() {

        console.log(
            '[UERP Cache] Manual refresh requested...'
        );

        return await load(true);
    }


    // ====================================================
    // CLEAR CACHE
    // ====================================================

    function clear() {

        localStorage.removeItem(
            CACHE_KEYS.customers
        );

        localStorage.removeItem(
            CACHE_KEYS.products
        );

        localStorage.removeItem(
            CACHE_KEYS.timestamp
        );

        console.log(
            '[UERP Cache] Cleared ✓'
        );
    }


    // ====================================================
    // PUBLIC API
    // ====================================================

    return {

        load,
        refresh,
        clear,

        getCustomers: getCustomersFromCache,
        getProducts: getProductsFromCache,

        isValid: isCacheValid
    };

})();