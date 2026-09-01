let currentProductData = null;
let baseTotalLikes = 48;
function cleanNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const str = String(val).replace(/,/g, "").trim();
  if (str === "" || str === "-") return 0;
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}
function formatMoney(val) {
  const num = cleanNumber(val);
  return num > 0
    ? num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      })
    : "-";
}
function getLikeStatus(itemCode) {
  const likesData = JSON.parse(
    localStorage.getItem("unimerce_likes") || "{}"
  );
  return likesData[itemCode] || false;
}
function saveLikeStatus(itemCode, status) {
  const likesData = JSON.parse(
    localStorage.getItem("unimerce_likes") || "{}"
  );
  likesData[itemCode] = status;
  localStorage.setItem("unimerce_likes", JSON.stringify(likesData));
}
function escapeAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function getProductImages(product) {
  const images = [];
  if (product.image_link_01) {
    images.push(String(product.image_link_01).trim());
  }
  if (product.image_link_02) {
    images.push(String(product.image_link_02).trim());
  }
  if (product.image_link_03) {
    images.push(String(product.image_link_03).trim());
  }
  if (images.length === 0) {
    images.push(
      "https://via.placeholder.com/600x600?text=No+Image"
    );
  }
  return images;
}
function createMetaTable(product) {
  const itemCode = escapeAttr(product.item_code);
  const name = escapeAttr(product.name);
  const location = escapeAttr(product.location);
  return `
    <table class="meta-table">
      <tr>
        <td class="lbl">รหัสสินค้า</td>
        <td class="val">
          <span>${product.item_code || "-"}</span>
          <button
            class="btn-barcode-trigger"
            onclick="openBarcodeGenModal('${name}', '${itemCode}', '${location}', event)"
            title="Generate Barcode"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2f5ea8"
              stroke-linecap="round"
              stroke-linejoin="round"
              style="vertical-align: middle;"
            >
              <line x1="6" y1="7" x2="6" y2="17" stroke-width="2.5"/>
              <line x1="9.5" y1="7" x2="9.5" y2="17" stroke-width="1"/>
              <line x1="12" y1="7" x2="12" y2="17" stroke-width="2"/>
              <line x1="14.5" y1="7" x2="14.5" y2="17" stroke-width="1"/>
              <line x1="18" y1="7" x2="18" y2="17" stroke-width="3"/>
              <path d="M2 7V2H7" stroke-width="1.5"/>
              <path d="M17 2H22V7" stroke-width="1.5"/>
              <path d="M2 17V22H7" stroke-width="1.5"/>
              <path d="M17 22H22V17" stroke-width="1.5"/>
            </svg>
          </button>
        </td>
      </tr>
      <tr>
        <td class="lbl">แบรนด์</td>
        <td class="val">${product.index2_brand || "-"}</td>
      </tr>
      <tr>
        <td class="lbl">รุ่น</td>
        <td class="val">${product.index3_series || "-"}</td>
      </tr>
      <tr>
        <td class="lbl">หมวดหมู่</td>
        <td class="val">${product.main_category || "-"}</td>
      </tr>
    </table>
  `;
}
async function loadProductDetail() {
  const mainContent = document.getElementById("main-content");
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const productCode = urlParams.get("code");
    if (!productCode) {
      showError("ไม่พบรหัสสินค้าในลิงก์การเชื่อมต่อ");
      return;
    }
    const productsList = await window.supabaseFetch("products");
    const product = productsList.find(
      p =>
        String(p.item_code || "").trim() ===
        String(productCode).trim()
    );
    if (!product) {
      showError(`ไม่พบฐานข้อมูลของรหัสสินค้า: ${productCode}`);
      return;
    }
    currentProductData = product;
    const itemCode = String(product.item_code || "");
    const userHasLiked = getLikeStatus(itemCode);
    const productSeed =
      (itemCode.charCodeAt(0) || 1) +
      (itemCode.charCodeAt(itemCode.length - 1) || 1);
    const currentLikesTotal =
      baseTotalLikes +
      (productSeed % 35) +
      (userHasLiked ? 1 : 0);
    const productName = product.name || "Product Detail";
    document.title = `UNIMERCE | ${productName}`;
    const metaTitle = document.getElementById("meta-title");
    const ogTitle = document.getElementById("og-title");
    const metaDesc = document.getElementById("meta-desc");
    const ogDesc = document.getElementById("og-desc");
    const ogImage = document.getElementById("og-image");
    if (metaTitle) {
      metaTitle.setAttribute(
        "content",
        `UNIMERCE | ${productName}`
      );
      metaTitle.innerText = `UNIMERCE | ${productName}`;
    }
    if (ogTitle) {
      ogTitle.setAttribute(
        "content",
        `UNIMERCE | ${productName}`
      );
    }
    if (product.product_detail) {
      const description = String(product.product_detail)
        .replace(/<[^>]*>/g, "")
        .substring(0, 150);
      if (metaDesc) {
        metaDesc.setAttribute("content", description);
      }
      if (ogDesc) {
        ogDesc.setAttribute("content", description);
      }
    }
    if (product.image_link_01 && ogImage) {
      ogImage.setAttribute(
        "content",
        String(product.image_link_01).trim()
      );
    }
    const images = getProductImages(product);
    const listPriceFormatted = product.list_price
      ? formatMoney(product.list_price)
      : "";
    const promoPriceFormatted = product.promotion_price
      ? formatMoney(product.promotion_price)
      : "-";
    const tableTemplateHTML = createMetaTable(product);
    mainContent.innerHTML = `
      <div class="breadcrumb">
        <a href="/">HOME</a> /
        <a href="/products">PRODUCTS</a> /
        <span>${product.item_code || "-"}</span>
      </div>
      <div class="main-grid">
        <div class="image-gallery">
          <div class="main-img-wrap">
            <img
              id="view-main-img"
              src="${images[0]}"
              onerror="this.src='https://via.placeholder.com/600x600?text=No+Image'"
            />
          </div>
          ${
            images.length > 1
              ? `
                <div class="thumb-row">
                  ${images
                    .map(
                      (img, idx) => `
                        <div
                          class="thumb-box ${idx === 0 ? "active" : ""}"
                          onclick="switchThumb(this, '${escapeAttr(img)}')"
                        >
                          <img
                            src="${img}"
                            onerror="this.src='https://via.placeholder.com/100x100?text=No+Img'"
                          />
                        </div>
                      `
                    )
                    .join("")}
                </div>
              `
              : ""
          }
          <div class="mobile-dynamic-block">
            <h1 class="product-name">
              ${product.name || "-"}
            </h1>
            <div class="mobile-price-heart-row">
              <div class="mobile-price-left">
                ${
                  listPriceFormatted
                    ? `<div class="price-old">฿${listPriceFormatted}</div>`
                    : ""
                }
                <div class="price-new">
                  ฿${promoPriceFormatted}
                </div>
              </div>
              <div
                class="shopee-heart-wrapper ${
                  userHasLiked ? "liked" : ""
                }"
                id="mob-heart-wrap"
                onclick="toggleShopeeLike()"
              >
                <span class="shopee-heart-icon">♥</span>
                <span
                  class="shopee-like-counter"
                  id="mob-like-cnt"
                >
                  ${currentLikesTotal}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="info-zone">
          <h1 class="product-name">
            ${product.name || "-"}
          </h1>
          ${tableTemplateHTML}
          <div class="price-box-wrapper">
            <div class="price-box">
              ${
                listPriceFormatted
                  ? `<div class="price-old">฿${listPriceFormatted}</div>`
                  : ""
              }
              <div class="price-new">
                ฿${promoPriceFormatted}
              </div>
            </div>
            <div
              class="shopee-heart-wrapper ${
                userHasLiked ? "liked" : ""
              }"
              id="desk-heart-wrap"
              onclick="toggleShopeeLike()"
            >
              <span class="shopee-heart-icon">♥</span>
              <span
                class="shopee-like-counter"
                id="desk-like-cnt"
              >
                ${currentLikesTotal}
              </span>
            </div>
          </div>
          <div class="qty-row">
            <div class="qty-label">
              จำนวนสั่งซื้อ:
            </div>
            <div class="qty-control">
              <button
                class="qty-btn"
                onclick="updateQty(-1)"
              >
                -
              </button>
              <input
                type="number"
                id="order-qty"
                class="qty-input"
                value="1"
                min="1"
                readonly
              />
              <button
                class="qty-btn"
                onclick="updateQty(1)"
              >
                +
              </button>
            </div>
          </div>
          <div class="btn-group">
            <button
              class="btn-primary"
              onclick="openOrderModal()"
            >
              สั่งซื้อสินค้านี้
            </button>
            <button
              class="btn-cart"
              onclick="triggerAddToCartDummy()"
            >
              + เพิ่มใส่ตะกร้า
            </button>
          </div>
          <div
            class="mobile-table-placeholder"
            style="display:none;"
          >
            ${tableTemplateHTML}
          </div>
        </div>
      </div>
      <div class="detail-sections">
        <div class="sec-block">
          <h2>Product Detail</h2>
          <div class="body-text">
            ${product.product_detail || "-"}
          </div>
        </div>
      </div>
      <div class="contact-footer-bar">
        <div class="contact-footer-title">
          General Inquiries & Support
        </div>
        <a
          href="mailto:contact@unimercegroup.com"
          class="clean-email-link"
        >
          contact@unimercegroup.com
        </a>
      </div>
      <div class="modal-overlay" id="order-modal">
        <div class="modal-box">
          <div class="modal-header">
            <div class="modal-title">
              ขั้นตอนการสั่งซื้อและชำระเงิน
            </div>
            <button
              class="modal-close"
              onclick="closeOrderModal()"
            >
              ×
            </button>
          </div>
          <div class="email-row-info">
            <span>
              ส่งหา:
              <strong>sales@unimercegroup.com</strong>
            </span>
            <button
              class="btn-inline-copy"
              onclick="copyTextDirect(
                'sales@unimercegroup.com',
                'คัดลอกอีเมลฝ่ายขายเรียบร้อย!'
              )"
            >
              คัดลอกเมล
            </button>
          </div>
          <div class="copy-area-header-flex">
            <span>
              <strong>ขั้นตอนที่ 1:</strong>
              รายละเอียดสินค้าที่ต้องใช้สั่งซื้อ
            </span>
            <button
              class="btn-inline-copy"
              onclick="copyTextDirect(
                document.getElementById('copy-text-target').innerText,
                'คัดลอกรายละเอียดสินค้าเรียบร้อย!'
              )"
            >
              คัดลอก
            </button>
          </div>
          <div
            class="copy-area"
            id="copy-text-target"
          ></div>
          <p
            class="modal-instruction-text"
            style="margin-top:4px;"
          >
            <strong>ขั้นตอนที่ 2:</strong>
            สามารถชำระเงินและแนบหลักฐาน
            พร้อมส่งอีเมลมาได้เลยครับ
          </p>
          <div class="bank-payment-box">
            <div class="bank-title">
              ธนาคารกสิกรไทย (บัญชีบริษัท)
            </div>
            <div class="bank-detail-flex">
              <div>
                <strong>บจก. ยูนิเมิร์ซ</strong>
                <br>
                <span
                  style="
                    font-family:monospace;
                    font-size:14.5px;
                    letter-spacing:0.5px;
                    font-weight:600;
                  "
                >
                  232-1-70687-0
                </span>
              </div>
              <button
                class="btn-inline-copy kbank-btn-copy"
                onclick="copyTextDirect(
                  '2321706870',
                  'คัดลอกเลขบัญชี 2321706870 เรียบร้อย!'
                )"
              >
                คัดลอกเลขบัญชี
              </button>
            </div>
          </div>
          <button
            class="btn-primary"
            style="width:100%; border-radius:10px;"
            onclick="copyOrderTextToClipboard()"
          >
            คัดลอกรายละเอียดทั้งหมด & เปิดหน้าต่างอีเมล
          </button>
          <div
            class="toast-msg"
            id="toast-success"
          ></div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error(error);
    showError(
      "ไม่สามารถเรียกดูชุดข้อมูลสินค้าจากระบบเซิร์ฟเวอร์ได้"
    );
  }
}
window.switchThumb = function(element, imgSrc) {
  const mainImg = document.getElementById("view-main-img");
  if (mainImg) {
    mainImg.src = imgSrc;
  }
  document
    .querySelectorAll(".thumb-box")
    .forEach(box => box.classList.remove("active"));
  element.classList.add("active");
};
window.updateQty = function(amount) {
  const input = document.getElementById("order-qty");
  if (!input) return;
  let current = parseInt(input.value) || 1;
  current += amount;
  if (current < 1) {
    current = 1;
  }
  input.value = current;
};
window.toggleShopeeLike = function() {
  if (!currentProductData) return;
  const itemCode = currentProductData.item_code;
  let userHasLiked = getLikeStatus(itemCode);
  userHasLiked = !userHasLiked;
  saveLikeStatus(itemCode, userHasLiked);
  const deskWrap =
    document.getElementById("desk-heart-wrap");
  const mobWrap =
    document.getElementById("mob-heart-wrap");
  const deskCnt =
    document.getElementById("desk-like-cnt");
  const mobCnt =
    document.getElementById("mob-like-cnt");
  let currentVal = parseInt(
    deskCnt
      ? deskCnt.innerText
      : mobCnt
        ? mobCnt.innerText
        : "0"
  ) || 0;
  if (userHasLiked) {
    currentVal++;
    if (deskWrap) {
      deskWrap.classList.add("liked");
    }
    if (mobWrap) {
      mobWrap.classList.add("liked");
    }
  } else {
    currentVal--;
    if (deskWrap) {
      deskWrap.classList.remove("liked");
    }
    if (mobWrap) {
      mobWrap.classList.remove("liked");
    }
  }
  if (deskCnt) {
    deskCnt.innerText = currentVal;
  }
  if (mobCnt) {
    mobCnt.innerText = currentVal;
  }
};
window.triggerAddToCartDummy = function() {
  alert(
    "ระบบตะกร้าสินค้ากำลังอยู่ระหว่างการพัฒนาเพิ่มเติมครับ"
  );
};
window.openOrderModal = function() {
  if (!currentProductData) return;
  const qtyElement =
    document.getElementById("order-qty");
  const qty = qtyElement ? qtyElement.value : 1;
  const basePrice =
    currentProductData.promotion_price ||
    currentProductData.list_price ||
    "0";
  const priceUnitFormatted =
    formatMoney(basePrice);
  const totalPriceFormatted =
    formatMoney(cleanNumber(basePrice) * qty);
  const textTemplate =
`เรียน ฝ่ายขาย UNIMERCE GROUP,
ฉันมีความประสงค์ต้องการสั่งซื้อสินค้าชิ้นนี้ตามรายละเอียดดังต่อไปนี้:
-----------------------------------------
รหัสสินค้า (Item Code): ${currentProductData.item_code || "-"}
ชื่อสินค้า (Description): ${currentProductData.name || "-"}
แบรนด์ (Brand): ${currentProductData.index2_brand || "-"}
รุ่น (Series): ${currentProductData.index3_series || "-"}
หมวดหมู่ (Category): ${currentProductData.main_category || "-"}
จำนวนที่ต้องการ: ${qty} ${currentProductData.uom || "หน่วย"}
ราคาต่อหน่วย: ฿${priceUnitFormatted}
ราคารวมทั้งสิ้น: ฿${totalPriceFormatted}
-----------------------------------------
[แนบหลักฐานการชำระเงินโอนเข้าบัญชี บจก. ยูนิเมิร์ซ]
กรุณาตรวจสอบและจัดส่งตามที่อยู่นี้...
ชื่อผู้รับ:
เบอร์โทรศัพท์:
ที่อยู่จัดส่ง:`;
  const copyTarget =
    document.getElementById("copy-text-target");
  if (copyTarget) {
    copyTarget.innerText = textTemplate;
  }
  const modal =
    document.getElementById("order-modal");
  if (modal) {
    modal.classList.add("active");
  }
};
window.closeOrderModal = function() {
  const modal =
    document.getElementById("order-modal");
  if (modal) {
    modal.classList.remove("active");
  }
  const toast =
    document.getElementById("toast-success");
  if (toast) {
    toast.innerText = "";
  }
};
window.copyTextDirect = function(
  textToCopy,
  customMessage
) {
  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      const toastModal =
        document.getElementById("toast-success");
      const orderModal =
        document.getElementById("order-modal");
      if (
        toastModal &&
        orderModal &&
        orderModal.classList.contains("active")
      ) {
        toastModal.innerText = customMessage;
        setTimeout(() => {
          toastModal.innerText = "";
        }, 2500);
      }
    })
    .catch(error => {
      console.error("Copy failed:", error);
    });
};
window.copyOrderTextToClipboard = function() {
  const copyTarget =
    document.getElementById("copy-text-target");
  const qtyElement =
    document.getElementById("order-qty");
  if (!copyTarget) return;
  const text = copyTarget.innerText;
  const qty = qtyElement
    ? qtyElement.value
    : 1;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const toast =
        document.getElementById("toast-success");
      if (toast) {
        toast.innerText =
          "✓ คัดลอกรายละเอียดสินค้าแล้ว กำลังนำทางไปแอปพลิเคชันอีเมล...";
      }
      setTimeout(() => {
        const subject = encodeURIComponent(
          `สั่งซื้อสินค้า รหัส ${currentProductData.item_code} จำนวน ${qty} ชิ้น`
        );
        const body =
          encodeURIComponent(text);
        window.location.href =
          `mailto:sales@unimercegroup.com?subject=${subject}&body=${body}`;
      }, 1200);
    })
    .catch(error => {
      console.error("Copy failed:", error);
      window.location.href =
        `mailto:sales@unimercegroup.com`;
    });
};
function showError(message) {
  const mainContent =
    document.getElementById("main-content");
  if (!mainContent) return;
  mainContent.innerHTML = `
    <div class="status-container">
      <div class="error-text">
        ${message}
      </div>
      <a
        href="/products"
        class="back-btn"
      >
        กลับสู่หน้าสินค้าทั้งหมด
      </a>
    </div>
  `;
}
window.addEventListener("load", function() {
  let layoutCache = {
    header: "",
    footer: ""
  };
  function secureInject(
    targetId,
    filepath,
    cacheKey
  ) {
    const targetNode =
      document.getElementById(targetId);
    if (!targetNode) return;
    fetch(filepath)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.text();
      })
      .then(html => {
        if (!html) return;
        layoutCache[cacheKey] = html;
        targetNode.innerHTML = html;
        const observer =
          new MutationObserver(() => {
            if (
              targetNode.innerHTML !==
              layoutCache[cacheKey]
            ) {
              observer.disconnect();
              targetNode.innerHTML =
                layoutCache[cacheKey];
              observer.observe(
                targetNode,
                {
                  childList: true,
                  subtree: true,
                  characterData: true
                }
              );
              if (cacheKey === "header") {
                initMenuController();
              }
            }
          });
        observer.observe(
          targetNode,
          {
            childList: true,
            subtree: true,
            characterData: true
          }
        );
        if (cacheKey === "header") {
          initMenuController();
        }
      })
      .catch(error => {
        console.error(
          "[Secure Layout Error]",
          error
        );
      });
  }
  function initMenuController() {
    document.removeEventListener(
      "click",
      menuClickHandler
    );
    document.addEventListener(
      "click",
      menuClickHandler
    );
  }
  function menuClickHandler(event) {
    const menuBtn =
      event.target.closest("#menuBtn");
    const menuDropdown =
      document.getElementById("menuDropdown");
    if (
      menuBtn &&
      menuDropdown
    ) {
      event.preventDefault();
      event.stopPropagation();
      menuDropdown.classList.toggle("active");
    } else if (
      menuDropdown &&
      !menuDropdown.contains(event.target)
    ) {
      menuDropdown.classList.remove("active");
    }
  }
  secureInject(
    "header-placeholder",
    "/header.html",
    "header"
  );
  secureInject(
    "footer-placeholder",
    "/footer.html",
    "footer"
  );
  loadProductDetail();
});
