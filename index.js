/* =========================
   UNIMERCE HOME
   File: index.js
========================= */
/* =========================
   RECOMMENDED PRODUCTS
========================= */
const recommendedCodes = [
  "10002",
  "10006",
  "10019",
  "10056"
];
async function loadRecommendedProducts() {
  const grid =
    document.getElementById("recommend-grid");
  if (!grid) {
    return;
  }
  try {
    const products =
      await fetchAllProducts();
    /* =========================
       FILTER & SORT
    ========================= */
    const recommendedProducts =
      products
        .filter(p =>
          recommendedCodes.includes(
            String(p.item_code || "").trim()
          )
        )
        .sort((a, b) => {
          const codeA =
            String(a.item_code || "").trim();
          const codeB =
            String(b.item_code || "").trim();
          return (
            recommendedCodes.indexOf(codeA) -
            recommendedCodes.indexOf(codeB)
          );
        });
    /* =========================
       NO PRODUCTS
    ========================= */
    if (
      recommendedProducts.length === 0
    ) {
      grid.innerHTML =
        '<div class="loading">No recommended products found.</div>';
      return;
    }
    /* =========================
       CREATE CARDS
       ใช้ function จาก products.js
    ========================= */
    grid.innerHTML =
      recommendedProducts
        .map(createProductCard)
        .join("");
  }
  catch (error) {
    console.error(
      "Failed to load recommended products:",
      error
    );
    grid.innerHTML =
      '<div class="loading">Failed to load recommended products.</div>';
  }
}
/* =========================
   PARALLAX BACKGROUND
========================= */
function initParallax() {
  const bgLayer =
    document.querySelector(".bg");
  if (!bgLayer) {
    return;
  }
  window.addEventListener(
    "scroll",
    () => {
      const scrolled =
        window.scrollY;
      bgLayer.style.transform =
        `translateY(${scrolled * 0.12}px)`;
    },
    { passive: true }
  );
}
/* =========================
   INITIALIZE HOME
========================= */
window.addEventListener(
  "load",
  () => {
    loadRecommendedProducts();
    initParallax();
  }
);
