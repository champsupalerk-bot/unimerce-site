/**
 * COUS AROMA - External Scripts
 */

// Function สำหรับโหลด Header
function loadHeader() {
  fetch("header.html")
    .then(res => {
      if (res.ok) return res.text();
      throw new Error('Header file not found');
    })
    .then(data => {
      const placeholder = document.getElementById("header-placeholder");
      if (!placeholder) return;
      
      placeholder.innerHTML = data;
      
      // เรียกใช้สคริปต์ย่อยที่ติดมากับ Header (ถ้ามี)
      const scripts = placeholder.querySelectorAll("script");
      scripts.forEach(oldScript => {
        const newScript = document.createElement("script");
        if (oldScript.src) { 
          newScript.src = oldScript.src; 
        } else { 
          newScript.textContent = oldScript.textContent; 
        }
        document.body.appendChild(newScript);
        oldScript.remove();
      });
    })
    .catch(err => console.log("Header external file template load skip:", err.message));
}

// Function สำหรับโหลด Footer
function loadFooter() {
  fetch("footer.html")
    .then(res => {
      if (res.ok) return res.text();
      throw new Error('Footer file not found');
    })
    .then(data => {
      const placeholder = document.getElementById("footer-placeholder");
      if (!placeholder) return;
      
      placeholder.innerHTML = data;
    })
    .catch(err => console.log("Footer external file template load skip:", err.message));
}

// เรียกใช้งานเมื่อ DOM พร้อม
document.addEventListener("DOMContentLoaded", () => {
  loadHeader();
  loadFooter();
});