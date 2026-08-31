/* =========================
   UNIMERCE PRODUCTS
   Data source: Supabase products
========================= */
let rawProducts = [];
let filtered = [];
let currentPage = 1;
const itemsPerPage = 30;
/* =========================
   LOAD HEADER
========================= */
fetch("header.html")
  .then(res => res.text())
  .then(data => {
    const headerPlaceholder =
      document.getElementById("header-placeholder");
    if (headerPlaceholder) {
      headerPlaceholder.innerHTML = data;
    }
    const menuBtn =
      document.getElementById("menuBtn");
    const menuDropdown =
      document.getElementById("menuDropdown");
    if (menuBtn && menuDropdown) {
      menuBtn.addEventListener("click", () => {
        menuDropdown.classList.toggle("active");
      });
      window.addEventListener("click", (e) => {
        if (
          !menuBtn.contains(e.target) &&
          !menuDropdown.contains(e.target)
        ) {
          menuDropdown.classList.remove("active");
        }
      });
    }
  })
  .catch(err => {
    console.error("Header load error:", err);
  });
/* =========================
   LOAD FOOTER
========================= */
fetch("footer.html")
  .then(res => res.text())
  .then(data => {
    document.body.insertAdjacentHTML(
      "beforeend",
      data
    );
  })
  .catch(err => {
    console.error("Footer load error:", err);
  });
/* =========================
   CLEAN NUMBER
========================= */
function cleanNumber(val) {
  if (
    val === null ||
    val === undefined
  ) {
    return 0;
  }
  if (typeof val === "number") {
    return val;
  }
  let str =
    String(val)
      .replace(/,/g, "")
      .trim();
  if (
    str === "" ||
    str === "-"
  ) {
    return 0;
  }
  const parsed =
    parseFloat(str);
  return isNaN(parsed)
    ? 0
    : parsed;
}
/* =========================
   LOAD PRODUCTS
========================= */
async function loadProducts() {
  try {
    /*
      ดึงข้อมูลจาก Supabase table:
      products
      Field ที่ใช้ในหน้านี้:
      item_code
      name
      main_category
      image_link_01
      onhand
      list_price
      promotion_price
      stock_status
    */
    rawProducts =
      await window.supabaseFetch("products");
    console.log(
      "Products loaded:",
      rawProducts.length
    );
    /* =========================
       FILTER DISCONTINUED
    ========================= */
    filtered =
      rawProducts.filter(p => {
        const status =
          String(
            p.stock_status || ""
          )
          .trim()
          .toLowerCase();
        return status !== "discontinued";
      });
    processAndRender();
  }
  catch (e) {
    console.error(
      "Failed to load products:",
      e
    );
    document.getElementById(
      "product-grid"
    ).innerHTML =
      '<div class="loading">Failed to secure product master data.</div>';
  }
}
/* =========================
   PROMOTION CARD
========================= */
const promoCard = `
  <div class="promo-card">
    <div class="promo-tag">
      UNIMERCE SYSTEM
    </div>
    <div class="promo-title">
      Essential<br>
      Product<br>
      Collection
    </div>
  </div>
`;
/* =========================
   PROCESS & RENDER
========================= */
function processAndRender() {
  const searchBox =
    document.getElementById(
      "searchBox"
    );
  const q =
    searchBox
      ? searchBox.value
          .toLowerCase()
          .trim()
      : "";
  /* =========================
     SELECTED CATEGORIES
  ========================= */
  const checkedCategories =
    Array.from(
      document.querySelectorAll(
        ".cat-checkbox:checked"
      )
    )
    .map(cb => cb.value);
  let targetProducts =
    filtered;
  /* =========================
     FILTER BY MAIN CATEGORY
  ========================= */
  if (
    checkedCategories.length > 0
  ) {
    targetProducts =
      targetProducts.filter(p => {
        const category =
          String(
            p.main_category || ""
          ).trim();
        return checkedCategories.includes(
          category
        );
      });
  }
  /* =========================
     FILTER BY SEARCH
  ========================= */
  if (q) {
    targetProducts =
      targetProducts.filter(p => {
        const itemCode =
          String(
            p.item_code || ""
          )
          .toLowerCase();
        const name =
          String(
            p.name || ""
          )
          .toLowerCase();
        const description =
          String(
            p.index4_description || ""
          )
          .toLowerCase();
        return (
          itemCode.includes(q) ||
          name.includes(q) ||
          description.includes(q)
        );
      });
  }
  /* =========================
     PAGINATION
  ========================= */
  const totalItems =
    targetProducts.length;
  const totalPages =
    Math.ceil(
      totalItems / itemsPerPage
    ) || 1;
  if (
    currentPage > totalPages
  ) {
    currentPage = totalPages;
  }
  if (
    currentPage < 1
  ) {
    currentPage = 1;
  }
  const startIndex =
    (currentPage - 1) *
    itemsPerPage;
  const endIndex =
    startIndex +
    itemsPerPage;
  const paginatedProducts =
    targetProducts.slice(
      startIndex,
      endIndex
    );
  /* =========================
     PRODUCT GRID
  ========================= */
  const grid =
    document.getElementById(
      "product-grid"
    );
  if (
    paginatedProducts.length === 0
  ) {
    grid.innerHTML =
      '<div class="loading">No products found matching your criteria.</div>';
    renderPaginationControls(1);
    return;
  }
  /* =========================
     PRODUCT CARDS
  ========================= */
  const productCards =
    paginatedProducts
      .map(p => {
        /* =========================
           IMAGE
        ========================= */
        const img =
          String(
            p.image_link_01 || ""
          ).trim();
        /* =========================
           ITEM CODE
        ========================= */
        const sku =
          p.item_code || "-";
        /* =========================
           CATEGORY
        ========================= */
        const category =
          p.main_category || "-";
        /* =========================
           PRODUCT NAME
        ========================= */
        const productName =
          p.name ||
          p.index4_description ||
          "-";
        /* =========================
           ON HAND
        ========================= */
        let onhand =
          p.onhand;
        if (
          onhand === null ||
          onhand === undefined ||
          onhand === ""
        ) {
          onhand = "0";
        }
        else {
          onhand =
            cleanNumber(
              onhand
            ).toLocaleString();
        }
        /* =========================
           LIST PRICE
        ========================= */
        const listPrice =
          p.list_price;
        const listPriceFormatted =
          (
            listPrice !== null &&
            listPrice !== undefined &&
            listPrice !== ""
          )
            ? cleanNumber(
                listPrice
              ).toLocaleString()
            : "";
        /* =========================
           PROMOTION PRICE
        ========================= */
        const promotionPrice =
          p.promotion_price;
        const promoPriceFormatted =
          (
            promotionPrice !== null &&
            promotionPrice !== undefined &&
            promotionPrice !== ""
          )
            ? cleanNumber(
                promotionPrice
              ).toLocaleString()
            : "-";
        /* =========================
           ESCAPE URL
        ========================= */
        const detailUrl =
          "/productdetail.html?code=" +
          encodeURIComponent(
            String(sku).trim()
          );
        /* =========================
           IMAGE FALLBACK
        ========================= */
        const imageSrc =
          img ||
          "https://via.placeholder.com/600x600?text=No+Image";
        /* =========================
           RETURN CARD
        ========================= */
        return `
          <div
            class="card"
            onclick="window.location.href='${detailUrl}'"
          >
            <img
              src="${imageSrc}"
              alt="${productName}"
              onerror="this.src='https://via.placeholder.com/600x600?text=No+Image'"
            />
            <div class="content">
              <div class="top-info">
                <div class="sku">
                  ${sku}
                </div>
                <div class="category">
                  ${category}
                </div>
              </div>
              <div class="name">
                ${productName}
              </div>
              <div class="bottom-row">
                <div class="price-box">
                  <div class="price-old">
                    ${
                      listPriceFormatted
                        ? "฿" +
                          listPriceFormatted
                        : ""
                    }
                  </div>
                  <div class="price-new">
                    ${
                      promoPriceFormatted !== "-"
                        ? "฿" +
                          promoPriceFormatted
                        : "-"
                    }
                  </div>
                </div>
                <div class="stock-box">
                  <div class="stock-label">
                    คงเหลือ
                  </div>
                  <div class="stock-value">
                    ${onhand}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  /* =========================
     FINAL RENDER
  ========================= */
  grid.innerHTML =
    (
      currentPage === 1 &&
      !q &&
      checkedCategories.length === 0
    )
      ? promoCard + productCards
      : productCards;
  /* =========================
     PAGINATION
  ========================= */
  renderPaginationControls(
    totalPages
  );
}
/* =========================
   PAGINATION CONTROLS
========================= */
function renderPaginationControls(
  totalPages
) {
  const container =
    document.getElementById(
      "pagination-controls"
    );
  if (!container) {
    return;
  }
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }
  let html = "";
  /* =========================
     PREVIOUS
  ========================= */
  html += `
    <button
      class="page-btn nav-arrow"
      ${
        currentPage === 1
          ? "disabled"
          : ""
      }
      onclick="changePage(${currentPage - 1})"
    >
      ←
    </button>
  `;
  /* =========================
     PAGE NUMBERS
  ========================= */
  for (
    let i = 1;
    i <= totalPages;
    i++
  ) {
    html += `
      <button
        class="page-btn ${
          currentPage === i
            ? "active"
            : ""
        }"
        onclick="changePage(${i})"
      >
        ${i}
      </button>
    `;
  }
  /* =========================
     NEXT
  ========================= */
  html += `
    <button
      class="page-btn nav-arrow"
      ${
        currentPage === totalPages
          ? "disabled"
          : ""
      }
      onclick="changePage(${currentPage + 1})"
    >
      →
    </button>
  `;
  container.innerHTML =
    html;
}
/* =========================
   CHANGE PAGE
========================= */
window.changePage =
  function(page) {
    currentPage = page;
    processAndRender();
    window.scrollTo({
      top:0,
      behavior:"smooth"
    });
  };
/* =========================
   INIT EVENTS
========================= */
window.addEventListener(
  "load",
  () => {
    /* =========================
       SEARCH
    ========================= */
    const searchBox =
      document.getElementById(
        "searchBox"
      );
    if (searchBox) {
      searchBox.addEventListener(
        "input",
        () => {
          currentPage = 1;
          processAndRender();
        }
      );
    }
    /* =========================
       CATEGORY FILTER
    ========================= */
    document
      .querySelectorAll(
        ".cat-checkbox"
      )
      .forEach(cb => {
        cb.addEventListener(
          "change",
          () => {
            currentPage = 1;
            processAndRender();
          }
        );
      });
    /* =========================
       LOAD DATA
    ========================= */
    loadProducts();
  }
);
