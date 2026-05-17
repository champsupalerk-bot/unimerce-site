// =========================
// LAYOUT CONTROLLER (CLEAN VERSION)
// =========================

document.addEventListener("DOMContentLoaded", () => {
  initLayout();
});

let layoutInitialized = false;

async function initLayout() {

  // กัน init ซ้ำทั้งระบบ (สำคัญมาก)
  if (layoutInitialized) return;
  layoutInitialized = true;

  // =========================
  // LOAD HEADER
  // =========================
  const headerPlaceholder = document.getElementById("header-placeholder");

  if (headerPlaceholder && !headerPlaceholder.dataset.loaded) {

    const headerRes = await fetch("header.html");
    const headerHtml = await headerRes.text();

    headerPlaceholder.innerHTML = headerHtml;
    headerPlaceholder.dataset.loaded = "true";
  }

  // =========================
  // LOAD FOOTER
  // =========================
  const footerPlaceholder = document.getElementById("footer-placeholder");

  if (footerPlaceholder && !footerPlaceholder.dataset.loaded) {

    const footerRes = await fetch("footer.html");
    const footerHtml = await footerRes.text();

    footerPlaceholder.innerHTML = footerHtml;
    footerPlaceholder.dataset.loaded = "true";
  }

  // =========================
  // INIT INTERACTIONS (AFTER INJECT)
  // =========================
  initHamburgerMenu();
}


// =========================
// HAMBURGER MENU (SAFE VERSION)
// =========================

let hamburgerBound = false;
let outsideClickBound = false;

function initHamburgerMenu() {

  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");

  if (!menuBtn || !menuDropdown) return;

  // กัน bind ซ้ำ
  if (hamburgerBound) return;
  hamburgerBound = true;

  // toggle menu
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle("active");
  });

  // กัน bind window click ซ้ำ
  if (!outsideClickBound) {

    window.addEventListener("click", (e) => {
      const menuBtnLive = document.getElementById("menuBtn");
      const menuDropdownLive = document.getElementById("menuDropdown");

      if (!menuBtnLive || !menuDropdownLive) return;

      if (
        !menuBtnLive.contains(e.target) &&
        !menuDropdownLive.contains(e.target)
      ) {
        menuDropdownLive.classList.remove("active");
      }
    });

    outsideClickBound = true;
  }
}