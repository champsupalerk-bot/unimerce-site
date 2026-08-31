/* =========================
   LOAD HEADER
========================= */
fetch('uerpheader.html')
  .then(res => {
    if (!res.ok) throw new Error("Header not found");
    return res.text();
  })
  .then(data => {
    const placeholder =
      document.getElementById("headerContainer");
    if (placeholder) {
      placeholder.innerHTML = data;
      if (typeof window.initUerpLayout === "function") {
        window.__uerpLayoutInitialized = false;
        window.initUerpLayout();
      }
    }
  })
  .catch(err => {
    console.error(
      "Error loading header:",
      err
    );
  });
/* =========================
   GLOBAL DATA
========================= */
let rawData = [];
let filteredData = [];
let viewData = [];
let selectedItemCodes = new Set();
let sortState = {
  key: null,
  dir: "asc"
};
/* =========================
   UTILITIES
========================= */
function updateLog(msg) {
  const el =
    document.getElementById("execLog");
  if (el) {
    el.textContent = msg;
  }
}
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
      .replace(/,/g, '')
      .trim();
  if (
    str === "" ||
    str === "-"
  ) {
    return 0;
  }
  let parsed =
    parseFloat(str);
  return isNaN(parsed)
    ? 0
    : parsed;
}
function escapeRegExp(string) {
  return string.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}
function highlightText(text, query) {
  if (!text) {
    return "-";
  }
  if (!query) {
    return text;
  }
  const safeQuery =
    escapeRegExp(query);
  const regex =
    new RegExp(
      `(${safeQuery})`,
      'gi'
    );
  return text.replace(
    regex,
    '<mark class="bg-yellow-200 text-black rounded-sm px-0.5 font-medium">$1</mark>'
  );
}
/* =========================
   CACHE
========================= */
const CACHE_KEY =
  "uerp_itemmaster_cache_data";
const CACHE_TIME_KEY =
  "uerp_itemmaster_cache_timestamp";
const ONE_DAY_MS =
  24 * 60 * 60 * 1000;
/* =========================
   LOAD DATA
   TABLE: itemmaster
   BATCH: 1000
========================= */
async function fetchAllFromSupabaseInBatches() {
  const BATCH_SIZE = 1000;
  let offset = 0;
  let allRows = [];
  let fetchMore = true;
  let batchIndex = 1;
  while (fetchMore) {
    updateLog(
      `Fetching ${batchIndex}...`
    );
    const pageData =
      await window.supabaseFetch(
        'itemmaster',
        {
          limit: BATCH_SIZE,
          offset: offset
        }
      );
    if (
      Array.isArray(pageData) &&
      pageData.length > 0
    ) {
      allRows =
        allRows.concat(pageData);
      if (
        pageData.length < BATCH_SIZE
      ) {
        fetchMore = false;
      } else {
        offset += BATCH_SIZE;
        batchIndex++;
      }
    } else {
      fetchMore = false;
    }
  }
  return allRows;
}
/* =========================
   LOAD TABLE
========================= */
async function loadTable(
  forceRefresh = false
) {
  try {
    if (
      typeof window.supabaseFetch !==
      'function'
    ) {
      throw new Error(
        "window.supabaseFetch is not defined. Check config.js path."
      );
    }
    const now =
      Date.now();
    const cachedTime =
      localStorage.getItem(
        CACHE_TIME_KEY
      );
    const cachedData =
      localStorage.getItem(
        CACHE_KEY
      );
    const isCacheValid =
      cachedTime &&
      cachedData &&
      (
        now -
        parseInt(
          cachedTime,
          10
        )
        <
        ONE_DAY_MS
      );
    /* =========================
       USE CACHE
    ========================= */
    if (
      !forceRefresh &&
      isCacheValid
    ) {
      rawData =
        JSON.parse(
          cachedData
        );
      updateLog(
        `${rawData.length.toLocaleString()} rows (Cache)`
      );
    /* =========================
       FETCH LIVE
    ========================= */
    } else {
      updateLog(
        "Connecting..."
      );
      rawData =
        await fetchAllFromSupabaseInBatches();
      if (
        rawData.length > 0
      ) {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify(rawData)
        );
        localStorage.setItem(
          CACHE_TIME_KEY,
          now.toString()
        );
        updateLog(
          `${rawData.length.toLocaleString()} rows (Live)`
        );
      } else if (
        cachedData
      ) {
        rawData =
          JSON.parse(
            cachedData
          );
        updateLog(
          `${rawData.length.toLocaleString()} rows (Fallback)`
        );
      }
    }
    applyAll();
  } catch (e) {
    console.error(
      "Supabase Connection Error:",
      e
    );
    updateLog(
      "Fetch Failed!"
    );
    const cachedData =
      localStorage.getItem(
        CACHE_KEY
      );
    if (cachedData) {
      rawData =
        JSON.parse(
          cachedData
        );
      updateLog(
        `${rawData.length.toLocaleString()} rows (Offline)`
      );
      applyAll();
    } else {
      document.getElementById(
        "table-body"
      ).innerHTML =
        '<tr><td colspan="3" style="text-align:center; padding:20px;">Failed to load secure assets.</td></tr>';
    }
  }
}
/* =========================
   FORCE REFRESH
========================= */
function forceRefreshData() {
  const icon =
    document.querySelector(
      "#btnRefresh i"
    );
  if (icon) {
    icon.classList.add(
      "fa-spin"
    );
  }
  loadTable(true)
    .finally(() => {
      if (icon) {
        icon.classList.remove(
          "fa-spin"
        );
      }
    });
}
/* =========================
   APPLY ALL FILTERS
========================= */
function applyAll() {
  const q =
    document.getElementById(
      "searchBox"
    )
    .value
    .toLowerCase()
    .trim();
  const hideZero =
    document.getElementById(
      "hideZero"
    ).checked;
  const showOnlySelected =
    document.getElementById(
      "showOnlySelected"
    ).checked;
  const currentCol3 =
    document.getElementById(
      "column3Select"
    ).value;
  const checkedCategories =
    Array.from(
      document.querySelectorAll(
        '.cat-checkbox:checked'
      )
    )
    .map(
      cb => cb.value
    );
  let result =
    rawData;
  /* =========================
     CATEGORY FILTER
  ========================= */
  if (
    checkedCategories.length > 0
  ) {
    result =
      result.filter(i => {
        const cat =
          String(
            i.maincategory || ""
          ).trim();
        return checkedCategories.includes(
          cat
        );
      });
  }
  /* =========================
     SEARCH
  ========================= */
  if (q) {
    result =
      result.filter(i => {
        return (
          String(
            i.item_code || ""
          )
          .toLowerCase()
          .includes(q)
          ||
          String(
            i.name || ""
          )
          .toLowerCase()
          .includes(q)
          ||
          String(
            i[currentCol3] || ""
          )
          .toLowerCase()
          .includes(q)
        );
      });
  }
  /* =========================
     HIDE ZERO
     FIELD: onhand
  ========================= */
  if (hideZero) {
    result =
      result.filter(i => {
        const rawVal =
          i.onhand;
        if (
          rawVal === undefined ||
          rawVal === null
        ) {
          return false;
        }
        const vStr =
          String(
            rawVal
          ).trim();
        if (
          vStr === "" ||
          vStr === "-"
        ) {
          return false;
        }
        const n =
          cleanNumber(
            rawVal
          );
        if (n === 0) {
          return false;
        }
        return true;
      });
  }
  /* =========================
     SHOW ONLY SELECTED
  ========================= */
  if (
    showOnlySelected
  ) {
    result =
      result.filter(i =>
        selectedItemCodes.has(
          String(
            i.item_code || ""
          )
        )
      );
  }
  filteredData =
    result;
  if (
    sortState.key
  ) {
    applySortOnFiltered();
  } else {
    viewData =
      filteredData;
    renderTable(
      viewData
    );
  }
}
/* =========================
   SORT
========================= */
function sortTable(key) {
  if (
    sortState.key === key
  ) {
    sortState.dir =
      sortState.dir === "asc"
        ? "desc"
        : "asc";
  } else {
    sortState.key =
      key;
    sortState.dir =
      "asc";
  }
  applySortOnFiltered();
}
/* =========================
   SORT FILTERED DATA
========================= */
function applySortOnFiltered() {
  const key =
    sortState.key;
  const dir =
    sortState.dir;
  viewData =
    [...filteredData]
      .sort((a, b) => {
        let v1 =
          a[key] ?? "";
        let v2 =
          b[key] ?? "";
        /* NUMERIC FIELDS */
        if (
          key === "onhand" ||
          key === "listprice" ||
          key === "pricep" ||
          key === "pricec" ||
          key === "pricel" ||
          key === "priced" ||
          key === "priceb" ||
          key === "pricea" ||
          key === "pricex" ||
          key === "prices" ||
          key === "price_ctn" ||
          key === "packcode_rounding" ||
          key === "weight_kg" ||
          key === "salecost" ||
          key === "avgsalecost" ||
          key === "onhandcost" ||
          key === "netreceived" ||
          key === "gpm_percent_from_netreceived" ||
          key === "marginx_percent" ||
          key === "margins_percent" ||
          key === "avg_qtyout_3m"
        ) {
          const n1 =
            cleanNumber(v1);
          const n2 =
            cleanNumber(v2);
          return dir === "asc"
            ? n1 - n2
            : n2 - n1;
        }
        /* TRY NUMERIC */
        const n1 =
          parseFloat(v1);
        const n2 =
          parseFloat(v2);
        if (
          !isNaN(n1) &&
          !isNaN(n2)
        ) {
          return dir === "asc"
            ? n1 - n2
            : n2 - n1;
        }
        /* STRING */
        v1 =
          String(v1)
            .toLowerCase();
        v2 =
          String(v2)
            .toLowerCase();
        if (
          v1 < v2
        ) {
          return dir === "asc"
            ? -1
            : 1;
        }
        if (
          v1 > v2
        ) {
          return dir === "asc"
            ? 1
            : -1;
        }
        return 0;
      });
  updateArrows(
    key,
    dir
  );
  renderTable(
    viewData
  );
}
/* =========================
   RENDER TABLE
========================= */
function renderTable(data) {
  const tbody =
    document.getElementById(
      "table-body"
    );
  const currentCol3 =
    document.getElementById(
      "column3Select"
    ).value;
  const q =
    document.getElementById(
      "searchBox"
    )
    .value
    .trim();
  if (
    !data ||
    data.length === 0
  ) {
    tbody.innerHTML =
      '<tr><td colspan="3" style="text-align:center;color:#aaa;padding:20px;">No results found.</td></tr>';
    return;
  }
  tbody.innerHTML =
    data.map(p => {
      let cellValue =
        p[currentCol3] !== undefined &&
        p[currentCol3] !== null
          ? p[currentCol3]
          : "-";
      let cellClass =
        "col-stock";
      /* =========================
         NUMBER FORMATTING
      ========================= */
      if (
        currentCol3 === "onhand" ||
        currentCol3 === "pricep" ||
        currentCol3 === "pricec" ||
        currentCol3 === "listprice" ||
        currentCol3 === "avgsalecost" ||
        currentCol3 === "price_ctn"
      ) {
        if (
          cellValue !== "-"
        ) {
          const num =
            cleanNumber(
              cellValue
            );
          cellValue =
            num.toLocaleString();
        }
      }
      /* =========================
         ITEM DATA
      ========================= */
      const itemCode =
        String(
          p.item_code || "-"
        );
      const desc =
        String(
          p.name || "-"
        );
      const location =
        String(
          p.location || ""
        );
      /* =========================
         ESCAPE VALUES
      ========================= */
      const safeItemCode =
        itemCode
          .replace(
            /'/g,
            "\\'"
          )
          .replace(
            /"/g,
            "&quot;"
          );
      const safeDesc =
        desc
          .replace(
            /'/g,
            "\\'"
          )
          .replace(
            /"/g,
            "&quot;"
          );
      const safeLocation =
        location
          .replace(
            /'/g,
            "\\'"
          )
          .replace(
            /"/g,
            "&quot;"
          );
      /* =========================
         HIGHLIGHT
      ========================= */
      const highlightedCode =
        highlightText(
          itemCode,
          q
        );
      const highlightedDesc =
        highlightText(
          desc,
          q
        );
      /* =========================
         SELECTED
      ========================= */
      const isSelected =
        selectedItemCodes.has(
          itemCode
        );
      const rowClass =
        isSelected
          ? "row-selected"
          : "";
      /* =========================
         ROW HTML
      ========================= */
      return `
        <tr
          class="${rowClass}"
          onclick="toggleRowSelection(this, '${safeItemCode}', event)"
        >
          <td class="col-code">
            <span>
              ${highlightedCode}
            </span>
            <button
              class="btn-barcode-trigger"
              onclick="openBarcodeGenModal('${safeDesc}', '${safeItemCode}', '${safeLocation}', event)"
              title="Generate Barcode"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111111"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="vertical-align: middle;"
              >
                <line
                  x1="6"
                  y1="7"
                  x2="6"
                  y2="17"
                  stroke-width="2.5"
                />
                <line
                  x1="9.5"
                  y1="7"
                  x2="9.5"
                  y2="17"
                  stroke-width="1"
                />
                <line
                  x1="12"
                  y1="7"
                  x2="12"
                  y2="17"
                  stroke-width="2"
                />
                <line
                  x1="14.5"
                  y1="7"
                  x2="14.5"
                  y2="17"
                  stroke-width="1"
                />
                <line
                  x1="18"
                  y1="7"
                  x2="18"
                  y2="17"
                  stroke-width="3"
                />
                <path
                  d="M 2,7 V 2 H 7"
                  stroke-width="1.5"
                />
                <path
                  d="M 17,2 H 22 V 7"
                  stroke-width="1.5"
                />
                <path
                  d="M 2,17 V 22 H 7"
                  stroke-width="1.5"
                />
                <path
                  d="M 17,22 H 22 V 17"
                  stroke-width="1.5"
                />
              </svg>
            </button>
          </td>
          <td class="col-desc">
            ${highlightedDesc}
          </td>
          <td class="${cellClass}">
            ${cellValue}
          </td>
        </tr>
      `;
    })
    .join("");
}
/* =========================
   ROW SELECTION
========================= */
function toggleRowSelection(
  rowElement,
  itemCode,
  event
) {
  if (
    event.target.closest(
      '.btn-barcode-trigger'
    )
  ) {
    return;
  }
  if (
    selectedItemCodes.has(
      itemCode
    )
  ) {
    selectedItemCodes.delete(
      itemCode
    );
    rowElement.classList.remove(
      'row-selected'
    );
  } else {
    selectedItemCodes.add(
      itemCode
    );
    rowElement.classList.add(
      'row-selected'
    );
    copyRowText(
      rowElement
    );
  }
  document.getElementById(
    'selectedCount'
  ).textContent =
    selectedItemCodes.size;
  if (
    document.getElementById(
      'showOnlySelected'
    ).checked
  ) {
    applyAll();
  }
}
/* =========================
   COPY ROW
========================= */
function copyRowText(
  rowElement
) {
  const tds =
    rowElement.getElementsByTagName(
      "td"
    );
  let text = "";
  for (
    let i = 0;
    i < tds.length;
    i++
  ) {
    let tempTd =
      tds[i].cloneNode(
        true
      );
    const btn =
      tempTd.querySelector(
        '.btn-barcode-trigger'
      );
    if (btn) {
      btn.remove();
    }
    text +=
      tempTd.innerText.trim() +
      (
        i === tds.length - 1
          ? ""
          : " "
      );
  }
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showToast(
        "Copied to clipboard"
      );
    });
}
/* =========================
   TOAST
========================= */
function showToast(msg) {
  const toast =
    document.getElementById(
      "toast"
    );
  toast.textContent =
    msg;
  toast.style.display =
    "block";
  setTimeout(() => {
    toast.style.display =
      "none";
  }, 1500);
}
/* =========================
   CLEAR ALL SELECTIONS
========================= */
function clearAllSelections() {
  if (
    selectedItemCodes.size === 0
  ) {
    return;
  }
  selectedItemCodes.clear();
  document.getElementById(
    'selectedCount'
  ).textContent =
    "0";
  showToast(
    "Cleared All Selections"
  );
  applyAll();
}
/* =========================
   HELP MODAL
========================= */
function openHelpModal() {
  document.getElementById(
    'helpModal'
  ).style.display =
    'flex';
}
function closeHelpModal() {
  document.getElementById(
    'helpModal'
  ).style.display =
    'none';
}
/* =========================
   ARROWS
   & HEADER
========================= */
function updateArrows(
  active,
  dir
) {
  const currentCol3 =
    document.getElementById(
      "column3Select"
    ).value;
  const selectElement =
    document.getElementById(
      "column3Select"
    );
  const selectedText =
    selectElement
      .options[
        selectElement.selectedIndex
      ]
      .text;
  document.getElementById(
    "col3HeaderName"
  ).textContent =
    selectedText === "OnHand"
      ? "OH"
      : selectedText;
  [
    "item_code",
    "name"
  ]
  .forEach(k => {
    const arrowId =
      k === "item_code"
        ? "arrow-Item_Code"
        : "arrow-Description";
    const el =
      document.getElementById(
        arrowId
      );
    if (el) {
      el.textContent =
        k === active
          ? (
              dir === "asc"
                ? "↑"
                : "↓"
            )
          : "↕";
    }
  });
  const el3 =
    document.getElementById(
      "arrow-Col3"
    );
  if (el3) {
    el3.textContent =
      currentCol3 === active
        ? (
            dir === "asc"
              ? "↑"
              : "↓"
          )
        : "↕";
  }
}
/* =========================
   INIT EVENTS
========================= */
window.addEventListener(
  "load",
  () => {
    document
      .getElementById(
        "searchBox"
      )
      .addEventListener(
        "input",
        () => {
          applyAll();
        }
      );
    document
      .getElementById(
        "hideZero"
      )
      .addEventListener(
        "change",
        () => {
          applyAll();
        }
      );
    document
      .getElementById(
        "showOnlySelected"
      )
      .addEventListener(
        "change",
        () => {
          applyAll();
        }
      );
    document
      .getElementById(
        "column3Select"
      )
      .addEventListener(
        "change",
        (e) => {
          sortState.key =
            e.target.value;
          applyAll();
        }
      );
    document
      .querySelectorAll(
        '.cat-checkbox'
      )
      .forEach(cb => {
        cb.addEventListener(
          "change",
          () => {
            applyAll();
          }
        );
      });
    document
      .getElementById(
        "tableWrapContainer"
      )
      .addEventListener(
        "dblclick",
        () => {
          clearAllSelections();
        }
      );
    loadTable();
  }
);
