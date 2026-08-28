/**
 * COUS AROMA - External Component Loader
 * Dynamic Header & Footer Includer
 */

// ฟังก์ชันโหลด HTML Template อเนกประสงค์
async function loadComponent(elementId, fileUrl) {
  const container = document.getElementById(elementId);
  if (!container) return;

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to load ${fileUrl}: ${response.statusText}`);
    
    const html = await response.text();
    container.innerHTML = html;

    // รัน JavaScript ที่อาจจะแถมมากับตัว Template (เช่น สคริปต์ใน Header)
    const scripts = container.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      if (oldScript.src) {
        newScript.src = oldScript.src;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      document.body.appendChild(newScript);
      oldScript.remove();
    });
  } catch (error) {
    console.warn(`[Template Loader] Skip loading ${fileUrl}:`, error.message);
  }
}

// เริ่มทำงานเมื่อ DOM โหลดโครงสร้างสำเร็จ
document.addEventListener("DOMContentLoaded", () => {
  loadComponent("header-placeholder", "header.html");
  loadComponent("footer-placeholder", "footer.html");
});
