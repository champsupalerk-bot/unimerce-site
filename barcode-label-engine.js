/**
 * ====================================================================
 * V-ERP SYSTEM - Barcode Label Engine
 * Developed for UNIMERCE Co., Ltd.
 * Description: ระบบจัดการฉลากบาร์โค้ดส่วนกลาง (ขนาดมาตรฐาน 30x20mm)
 * ใช้งานร่วมกันทั้งหน้า Inventory และ Product Detail
 * ====================================================================
 */

// 1. Initializer: สร้าง CSS และโครงสร้าง HTML ต้นแบบฉลากฝังเข้าระบบอัตโนมัติ
(function initBarcodeEngine() {
    // ป้องกันการโหลดซ้ำหากไฟล์ถูกเรียกใช้หลายครั้ง
    if (document.getElementById('hiddenStickerWrapper')) return;

    // สร้าง CSS Styles สำหรับโครงสร้างฉลากและ Modal
    const style = document.createElement('style');
    style.innerHTML = `
        /* สไตล์ปุ่มไอคอนบาร์โค้ดในตาราง */
        .btn-barcode-trigger {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px 6px;
            margin-left: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            vertical-align: middle;
            border-radius: 6px;
            transition: background 0.15s ease;
        }
        .btn-barcode-trigger:hover {
            background: rgba(0, 0, 0, 0.05);
        }

        /* ซ่อนกล่องสติกเกอร์ต้นแบบที่ใช้ Render รูปภาพ (ซ่อนไว้หลบสายตา) */
        #hiddenStickerWrapper {
            position: absolute;
            left: -9999px;
            top: -9999px;
            opacity: 0;
            z-index: -1;
        }

        /* โครงสร้างป้ายสติกเกอร์ขนาดจริง สัดส่วนตรงกับ 30x20 mm */
        .actual-sticker-target {
            width: 300px;
            height: 200px;
            background: #ffffff;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: left;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #000000;
            padding: 12px 14px;
        }
        .sticker-p-name {
            font-size: 14px;
            font-weight: bold;
            line-height: 1.25;
            margin: 0;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            word-break: break-word;
        }
        .sticker-barcode-area {
            text-align: center;
            margin: auto 0;
            width: 100%;
        }
        .sticker-barcode-area svg {
            width: 100%;
            max-height: 85px;
        }
        .sticker-footer-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 12px;
            font-weight: bold;
        }
        .sticker-web-url {
            color: #111111;
        }
        .sticker-location-field {
            color: #444444;
            background: #f0f0f0;
            padding: 1px 5px;
            border-radius: 3px;
        }

        /* สไตล์หน้าต่างป๊อปอัป (Modal) สำหรับการใช้งานบนมือถือ */
        .barcode-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 99999;
            justify-content: center;
            align-items: center;
            padding: 16px;
            box-sizing: border-box;
        }
        .barcode-modal-content {
            background: #ffffff;
            padding: 24px;
            border-radius: 16px;
            width: 100%;
            max-width: 340px;
            text-align: center;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            animation: barcodeModalFadeIn 0.2s ease-out;
        }
        @keyframes barcodeModalFadeIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .barcode-modal-title {
            margin: 0 0 4px 0;
            font-size: 16px;
            font-weight: bold;
            color: #2f5ea8;
        }
        .barcode-modal-subtitle {
            margin: 0 0 16px 0;
            font-size: 13px;
            color: #666666;
        }
        .btn-cancel-modal {
            background: #f1f3f5;
            border: none;
            color: #495057;
            font-size: 14px;
            font-weight: 500;
            width: 100%;
            padding: 10px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.1s;
            margin-top: 8px;
        }
        .btn-cancel-modal:hover {
            background: #e9ecef;
        }
    `;
    document.head.appendChild(style);

    // สร้างโครงสร้าง HTML เผื่อไว้ใน DOM ทันที
    const container = document.createElement('div');
    container.innerHTML = `
        <div id="hiddenStickerWrapper">
          <div id="stickerTarget" class="actual-sticker-target">
            <div id="lblProductName" class="sticker-p-name"></div>
            <div class="sticker-barcode-area"><svg id="barcodeSvgCanvas"></svg></div>
            <div class="sticker-footer-row">
              <span class="sticker-web-url">www.unimercegroup.com</span>
              <span id="lblLocationField" class="sticker-location-field"></span>
            </div>
          </div>
        </div>

        <div id="barcodeModal" class="barcode-modal-overlay" onclick="if(event.target===this) closeBarcodeModal()">
          <div class="barcode-modal-content">
            <div class="barcode-modal-title">บาร์โค้ดพร้อมใช้งาน</div>
            <div class="barcode-modal-subtitle">แตะค้างที่รูปภาพด้านล่างเพื่อบันทึก</div>
            <div style="margin: 15px 0; display: flex; justify-content: center; min-height: 150px; align-items: center;" id="resultImageContainer"></div>
            <button class="btn-cancel-modal" onclick="closeBarcodeModal()">ปิดหน้าต่าง</button>
          </div>
        </div>
    `;
    document.body.appendChild(container);
})();

/**
 * ฟังก์ชันหลักสำหรับเปิดใช้งานเพื่อเจนบาร์โค้ด
 * @param {string} productName - ชื่อสินค้า
 * @param {string} productCode - รหัสสินค้า / รหัสบาร์โค้ด
 * @param {string} locationField - โซนหรือพิกัดจัดเก็บสินค้า
 * @param {Event} event - ตัวแปร Event ของปุ่มกดเพื่อทำ stopPropagation
 */
window.openBarcodeGenModal = function(productName, productCode, locationField, event) {
    if (event) event.stopPropagation();
    
    // ตรวจสอบ Library ปลายทางว่าติดตั้งครบถ้วนหรือไม่
    if (typeof JsBarcode !== 'function' || typeof html2canvas !== 'function') {
        alert('เกิดข้อผิดพลาด: กรุณาโหลดโปรแกรม JsBarcode และ html2canvas ให้เรียบร้อยก่อนใช้งาน');
        return;
    }

    // 1. นำข้อมูลไปหยอดใส่ต้นแบบ HTML ของสติกเกอร์
    document.getElementById('lblProductName').innerText = productName;
    document.getElementById('lblLocationField').innerText = locationField || "-";

    // 2. สั่งวาดเส้นบาร์โค้ดลงบน SVG ด้วยรหัสสินค้า
    JsBarcode("#barcodeSvgCanvas", productCode, {
        format: "CODE128",
        width: 2.3,
        height: 65,
        displayValue: true,
        fontSize: 20,
        margin: 0
    });

    // 3. ดึง Element ต้นแบบเพื่อเตรียมเปลี่ยนเป็นรูปภาพคุณภาพสูง
    const element = document.getElementById('stickerTarget');
    const imgContainer = document.getElementById('resultImageContainer');
    imgContainer.innerHTML = "<span style='font-size:13px; color:#888;'>กำลังประมวลผลระบบฉลาก...</span>";

    // 4. สั่งแปลง HTML เป็นภาพวาด Canvas (ขยายสเกล x3 เพื่อความคมชัดสูงเวลาพิมพ์จริง)
    html2canvas(element, { 
        backgroundColor: "#ffffff", 
        scale: 3, 
        logging: false,
        useCORS: true 
    }).then(canvas => {
        // แปลงผลลัพธ์จาก Canvas เป็นไฟล์รูปภาพฟอร์แมต JPG
        const imageData = canvas.toDataURL('image/jpeg', 1.0);
        
        // ตรวจสอบว่าเป็นอุปกรณ์พกพา/มือถือ หรือไม่
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            // บนมือถือ: แสดงผลใน Modal เพื่อให้ผู้ใช้งานใช้นิ้วกดค้างเพื่อเซฟรูปได้ง่ายๆ
            imgContainer.innerHTML = `<img src="${imageData}" style="width: 100%; max-width: 270px; border: 1px solid #e0e0e0; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px;" alt="Barcode Sticker" />`;
            document.getElementById('barcodeModal').style.display = 'flex';
        } else {
            // บน Desktop: ทำการดาวน์โหลดลงเครื่องอัตโนมัติทันทีเพื่อความรวดเร็ว
            imgContainer.innerHTML = "";
            const link = document.createElement('a');
            link.download = `label-${productCode}.jpg`;
            link.href = imageData; 
            link.click();
        }
    }).catch(err => {
        console.error("Barcode Render Error:", err);
        imgContainer.innerHTML = "<span style='color:#dc3545; font-size:13px;'>เกิดข้อผิดพลาดในการสร้างไฟล์รูปภาพ</span>";
    });
};

/**
 * ฟังก์ชันสำหรับสั่งปิดหน้าต่างป๊อปอัปบาร์โค้ด
 */
window.closeBarcodeModal = function() {
    document.getElementById('barcodeModal').style.display = 'none';
};