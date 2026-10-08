/**
 * Unimerce Core API Configuration
 * Setup: ฝังไฟล์นี้ไว้ใน Header ของ Layout เพื่อใช้งานร่วมกันทุกหน้า
 */
window.SUPABASE_URL = "https://xygdmszernmircmbqwke.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_4Rj3PUJnjqKNvx18hLzbng_ZhOVJHBp";

// ฟังก์ชันศูนย์กลางสำหรับยิงดึงข้อมูล (ดึงสิทธิ์และ URL จากด้านบนอัตโนมัติ)
window.supabaseFetch = async function(endpoint) {
    try {
        let requestUrl = "";

        // ตรวจสอบว่า endpoint เป็น URL เต็ม หรือเป็น path ย่อย
        if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
            requestUrl = endpoint;
        } else {
            const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
            requestUrl = `${window.SUPABASE_URL}/rest/v1${cleanEndpoint}`;
        }

        const response = await fetch(requestUrl, {
            method: 'GET',
            headers: {
                'apikey': window.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${window.SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Supabase Fetch Error:", error);
        throw error;
    }
};
