/**
 * UNIMERCE Barcode Label Engine
 * ฟังก์ชันสำหรับเจเนอเรตบาร์โค้ดและแสดง Preview ฉลากสินค้าขนาด 30x20mm
 * รองรับการแสดงผล Modal เหมือนกันทั้งบน Desktop และ Mobile
 */

function openBarcodeGenModal(productName, productCode, productLocation, event) {
  if (event) event.stopPropagation();

  // 1. ตรวจสอบว่ามี Elements ที่จำเป็นในหน้า HTML ครบถ้วนหรือไม่ (ป้องกันข้อผิดพลาด Cannot read properties of null)
  const lblProductName = document.getElementById('lblProductName');
  const lblLocationField = document.getElementById('lblLocationField');
  const stickerTarget = document.getElementById('stickerTarget');
  const imgContainer = document.getElementById('resultImageContainer');
  const barcodeModal = document.getElementById('barcodeModal');

  if (!lblProductName || !lblLocationField || !stickerTarget || !imgContainer || !barcodeModal) {
    console.error("Barcode Engine Error: โครงสร้าง HTML (IDs) สำหรับทำฉลากไม่ครบถ้วนในหน้านี้");
    alert("ระบบไม่สามารถสร้างฉลากได้ เนื่องจากโครงสร้างหน้าเว็บไม่สมบูรณ์");
    return;
  }

  // 2. เติมข้อมูลลงในโครงป้ายฉลากจำลอง (DOM Target)
  lblProductName.innerText = productName;
  lblLocationField.innerText = productLocation || ""; 

  // 3. สั่งวาดเส้นบาร์โค้ดด้วย JsBarcode ลงบน SVG
  try {
    JsBarcode("#barcodeSvgCanvas", productCode, {
      format: "CODE128",
      width: 2.3,   
      height: 65,   
      displayValue: true, 
      fontSize: 20, 
      fontOptions: "", 
      margin: 0
    });
  } catch (err) {
    console.error("JsBarcode Error:", err);
    imgContainer.innerHTML = "<span style='color:red;'>รหัสสินค้าไม่รองรับการสร้างบาร์โค้ด</span>";
    barcodeModal.style.display = 'flex';
    return;
  }

  // 4. แสดงข้อความระหว่างรอประมวลผลภาพ
  imgContainer.innerHTML = "<span style='font-size:13px; color:#aaa;'>กำลังประมวลผลฉลากสินค้า...</span>";
  
  // เปิดหน้าต่าง Modal รอไว้เลยเพื่อความต่อเนื่องของ UI
  barcodeModal.style.display = 'flex';

  // 5. ใช้ html2canvas แปลงจากกล่อง HTML ออกมาเป็นรูปภาพคุณภาพสูง (JPG)
  setTimeout(() => {
    html2canvas(stickerTarget, {
      backgroundColor: "#ffffff",
      scale: 3, // เพิ่มความคมชัดตอนเซฟไฟล์รูป
      logging: false
    }).then(canvas => {
      const imageData = canvas.toDataURL('image/jpeg', 1.0);
      
      // [แก้ไขจุดหลัก] ไม่แยกค่ายอุปกรณ์แล้ว ให้เปลี่ยนมาแสดงผลรูปภาพบน Modal เหมือนกันทั้งหมด
      imgContainer.innerHTML = `
        <div style="text-align: center; width: 100%;">
          <img src="${imageData}" style="width: 100%; max-width: 270px; border: 1px solid #e0e0e0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 6px;" />
          <div style="margin-top: 15px;">
            <a href="${imageData}" download="label-${productCode}.jpg" class="btn-download-trigger" style="display: inline-block; background: #2f5ea8; color: #fff; text-decoration: none; padding: 8px 16px; font-size: 13px; font-weight: bold; border-radius: 6px;">
              ดาวน์โหลดไฟล์ภาพฉลาก
            </a>
          </div>
        </div>
      `;
    }).catch(err => {
      console.error("html2canvas Error:", err);
      imgContainer.innerHTML = "<span style='color:red;'>เกิดข้อผิดพลาดในการโหลดรูปภาพฉลาก</span>";
    });
  }, 100); // ดีเลย์สั้นๆ เพื่อให้เบราว์เซอร์ Render บาร์โค้ดเสร็จสมบูรณ์ก่อน Snap
}

// ฟังก์ชันปิดหน้าต่างป็อปอัพบาร์โค้ด
function closeBarcodeModal() {
  const barcodeModal = document.getElementById('barcodeModal');
  if (barcodeModal) {
    barcodeModal.style.display = 'none';
  }
}

// ฟังก์ชันดักจับการคลิกนอกกรอบขาวของ Modal เพื่อกดปิดอัตโนมัติ
function closeModalOnOutsideClick(event) {
  const modalOverlay = document.getElementById('barcodeModal');
  if (event.target === modalOverlay) {
    closeBarcodeModal();
  }
}
