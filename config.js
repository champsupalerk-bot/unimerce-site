/**
 * Unimerce Core API Configuration
 * Setup: ฝังไฟล์นี้ไว้ใน Header ของ Layout เพื่อใช้งานร่วมกันทุกหน้า
 */
window.SUPABASE_URL = "https://xygdmszernmircmbqwke.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5Z2Rtc3plcm5taXJjbWJxd2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NTY5NTAsImV4cCI6MjA5NzIzMjk1MH0.Qcq5h2TignXwhsyOe8IYcMYvlayyTjH66tTiPznVOOY";

// ฟังก์ชันศูนย์กลางสำหรับยิงดึงข้อมูล (ดึงสิทธิ์และ URL จากด้านบนอัตโนมัติ)
window.supabaseFetch = async function(endpoint) {
    try {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        const response = await fetch(`${window.SUPABASE_URL}/rest/v1${cleanEndpoint}`, {
            method: 'GET',
            headers: {
                'apikey': window.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${window.SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Supabase Fetch Error:", error);
        throw error;
    }
};