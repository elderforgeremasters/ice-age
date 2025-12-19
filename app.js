// ElderForge — Ice Age (static card database)
// Single-file app.js for GitHub Pages project sites.
// Icons: /assets/icons/<TOKEN>.png  (PNG)
// Cards: /cards/*.webp
// Data: /data/cards.json

function $(id){ return document.getElementById(id); }

function assetURL(relPath){
  return new URL(relPath, document.baseURI).toString();
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function normalizePT(pt){
  if(!pt) return "";
  return String(pt).replace(/\\/g, "/");
}

function rarityLong(r){
  const v = String(r ?? "").trim().toUpperCase();
  if(v === "C") return "Common";
  if(v === "U") return "Uncommon";
  if(v === "R") return "Rare";
  if(v === "M") return "Mythic";
  if(v === "S") return "Special";
  return v || "—";
}

function getSetInfo(code){
  const c = String(code || "").trim().toUpperCase();
  const map = {
    "ICE": { name: "Ice Age", year: "1995/2024" },
    "IA":  { name: "Ice Age", year: "1995/2024" },
    "ALL": { name: "Alliances", year: "1996/2024" },
    "AL":  { name: "Alliances", year: "1996/2024" },
    "CSP": { name: "Coldsnap", year: "2006/2024" },
    "CS":  { name: "Coldsnap", year: "2006/2024" }
  };
  return map[c] || { name: (code || ""), year: "" };
}

function cleanCollector(v){
  // Convert things like "504\697" or "#504\697" to "504/697"
  return String(v || "").trim().replace(/^#\s*/,"").replaceAll("\\", "/");
}

function normalizeSlash(v){
  return String(v || "").replaceAll("\\", "/");
}

function iconIMGFromTok(tok){
  const safe = String(tok || "").trim();
  const src = `assets/icons/${safe}.png`;
  // alt intentionally blank so broken icons don't inject text into rules
  return `<img class="sym" src="${src}" alt="" title="${safe}" data-token="${safe}">`;
}

function attachIconFallbacks(root){
  if(!root) return;
  const imgs = root.querySelectorAll("img.sym[data-token]");
  imgs.forEach(img => {
    img.addEventListener("error", () => {
      const tok = (img.getAttribute("data-token") || "").trim();

      // numbers / X -> pip
      if(/^\d+$/.test(tok) || tok.toUpperCase() === "X"){
        const span = document.createElement("span");
        span.className = "pip";
        span.textContent = tok.toUpperCase();
        img.replaceWith(span);
        return;
      }

      // snow mana like 1s / Xs / Cs
      const snowMatch = tok.match(/^([0-9]+|X|C)s$/i);
      if(snowMatch){
        const span = document.createElement("span");
        span.className = "pip snow";
        span.textContent = snowMatch[1].toUpperCase();
        img.replaceWith(span);
        return;
      }

      // otherwise literal token text (precision)
      const span = document.createElement("span");
      span.className = "kw";
      span.textContent = tok;
      img.replaceWith(span);
    }, { once:true });
  });
}

function richText(str){
  if(!str) return "";
  let s = String(str);

  // Italics: anything between ##...## or #...# (used on printed cards)
  s = s.replace(/##([^#]+)##/g, "<em>$1</em>");
  s = s.replace(/#([^#]+)#/g, "<em>$1</em>");

  // Bold anything wrapped in backticks: `Vigilance` -> <strong>Vigilance</strong>
  s = s.replace(/`([^`]+)`/g, "<strong>$1</strong>");

  // Replace {Anything} with its icon (mana, keyword, etc.)
  s = s.replace(/\{([^}]+)\}/g, (m, tok) => iconIMGFromTok(tok));

  // Add a little breathing room between adjacent keyword chunks (when the source had no spaces)
  s = s.replace(/<\/strong>(?=<img class="sym")/g, "</strong>&nbsp;&nbsp;");

  // Preserve line breaks from JSON (\n becomes actual newline after JSON.parse)
  s = s.replace(/\r?\n/g, "<br>");

  return s;
}

// Only used for Rules / Flavor rendering (keeps other fields untouched)
function sanitizeRulesFlavorText(str){
  if(str == null) return "";
  let s = String(str);

  // Remove custom break tokens that shouldn't appear in the UI
  s = s.replaceAll("{BL}", "").replaceAll("{BL2}", "");

  // Strip print-centering whitespace used in exported text (web should not render it)
  // U+2007 figure space, U+200A hair space, U+2009 thin space, U+202F narrow no-break, U+00A0 nbsp
  s = s.replace(/[\u2007\u200A\u2009\u202F\u00A0]/g, "");
  s = s.replaceAll("&hairsp;", "");

  // Change {Tn} tokens to {Ts}
  s = s.replaceAll("{Tn}", "{Ts}");

  return s;
}

// ---- sorting (by filename prefix) ----
function sortKeyFromImage(imagePath){
  const base = String(imagePath || "").split("/").pop() || "";
  // 001-Name.webp
  let m = base.match(/^(\d{3})-/);
  if(m) return 0 * 1_000_000 + parseInt(m[1],10);

  // L01-Plains1.webp
  m = base.match(/^L(\d+)-/i);
  if(m) return 1_000_000 + parseInt(m[1],10);

  // T1-Token.webp
  m = base.match(/^T(\d+)-/i);
  if(m) return 2_000_000 + parseInt(m[1],10);

  // fallback: by name
  return 9_000_000 + base.toLowerCase().charCodeAt(0);
}

// ---- UI state ----
let ALL_CARDS = [];
let FILTERED = [];


// ------------------------------
// Content warnings (blur specific arts until clicked)
// ------------------------------
const CW_COLLECTORS = new Set([
  "4","51A","64A","119","184","208A","260","260A","260B","260C","292","401","471A","483A","494","494A","511A","542"
]);

// Session-only reveal (no persistence)
const CW_REVEALED = new Set();

function collectorKey(card){
  const raw = cleanCollector(card?.collector || "");
  return (raw.split("/")[0] || "").trim();
}

function cardNumber(card){
  // Prefer numeric `num` field; otherwise parse leading digits from collector like "718\697" or "51A\697"
  const n = Number(card?.num);
  if(Number.isFinite(n) && n > 0) return n;

  const raw = cleanCollector(card?.collector || "");
  const first = (raw.split("/")[0] || "").trim();
  const dm = first.match(/^(\d+)/);
  return dm ? parseInt(dm[1], 10) : 0;
}

function isNewCard(card){
  return cardNumber(card) >= 698;
}


function isContentWarn(card){
  return CW_COLLECTORS.has(collectorKey(card));
}

function isRevealed(card){
  return CW_REVEALED.has(collectorKey(card));
}

function revealCard(card){
  if(!card) return;
  CW_REVEALED.add(collectorKey(card));
}

let CURRENT_INDEX = -1;

function findFilteredIndex(card){
  if(!card) return -1;
  const tgtImage = String(card.image || "");
  const tgtCol = cleanCollector(card.collector || "");
  const tgtName = String(card.name || "");

  return FILTERED.findIndex(c =>
    c === card ||
    (tgtImage && String(c.image || "") === tgtImage) ||
    (tgtCol && cleanCollector(c.collector || "") === tgtCol && String(c.name || "") === tgtName)
  );
}

function gotoFilteredIndex(i){
  if(i < 0 || i >= FILTERED.length) return;
  openModal(FILTERED[i]);
}

function ensureModalNav(modal){
  const panel = modal?.querySelector?.(".modalPanel") || modal;
  if(!panel) return null;

  let nav = panel.querySelector(".modalNav");
  if(nav) return nav;

  nav = document.createElement("div");
  nav.className = "modalNav";

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "modalNavBtn";
  prev.setAttribute("aria-label", "Previous card");
  prev.textContent = "‹";

  const next = document.createElement("button");
  next.type = "button";
  next.className = "modalNavBtn";
  next.setAttribute("aria-label", "Next card");
  next.textContent = "›";

  prev.addEventListener("click", (e)=>{ e.stopPropagation(); gotoFilteredIndex(CURRENT_INDEX - 1); });
  next.addEventListener("click", (e)=>{ e.stopPropagation(); gotoFilteredIndex(CURRENT_INDEX + 1); });

  nav.appendChild(prev);
  nav.appendChild(next);

  panel.insertBefore(nav, panel.firstChild);
  return nav;
}

function updateModalNavState(modal){
  const nav = ensureModalNav(modal);
  if(!nav) return;

// ---- Rarity dropdown (custom) ----
let rarityUI = null;

function initRarityDropdown(){
  const sel = $("rarity");
  const btn = $("rarityBtn");
  const label = $("rarityLabel");
  const menu = $("rarityMenu");

  if(!sel || !btn || !label || !menu) return;

  function setLabelFromValue(){
    const opt = Array.from(sel.options).find(o => o.value === sel.value);
    label.textContent = opt ? opt.textContent : "All rarities";
    // reflect state for accessibility
    btn.setAttribute("aria-label", `Rarity: ${label.textContent}`);
  }

  function openMenu(){
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }

  function closeMenu(){
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  function toggleMenu(){
    if(menu.hidden) openMenu(); else closeMenu();
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  menu.addEventListener("click", (e) => {
    const t = e.target;
    if(!(t instanceof HTMLElement)) return;
    const val = t.getAttribute("data-value");
    if(val === null) return;
    sel.value = val;
    setLabelFromValue();
    applyFilters();
    closeMenu();
  });

  // close when clicking anywhere else
  document.addEventListener("click", () => closeMenu());

  // keep label synced if code changes the select
  sel.addEventListener("change", () => setLabelFromValue());

  setLabelFromValue();
  rarityUI = { setLabelFromValue, closeMenu };
}

function bindModalClose(){
  const modal = modalEl();
  if(!modal) return;

  // Close buttons: try a bunch of common selectors (your "X" button)
  const btns = modal.querySelectorAll(
    "#mClose, .close, .modalClose, button[aria-label='Close'], button[title='Close'], button[data-close='modal']"
  );
  btns.forEach(b => b.addEventListener("click", closeModal));

  // Clicking backdrop closes
  modal.addEventListener("click", (e) => {
    const t = e.target;
    if(t === modal || t.id === "modalBackdrop" || (t && t.classList && t.classList.contains("backdrop"))){
      closeModal();
    }
  });
}

// ESC closes modal
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape") closeModal();
});

// Mini helper: adjust stacked boxes (rules/flavor/lore) spacing
function setBlock(id, labelText, text){
  const el = $(id);
  if(!el) return;
  const has = (text || "").trim().length > 0;
  if(!has){ el.style.display = "none"; return; }
  el.style.display = "block";
  el.innerHTML = labelText ? `<strong>${labelText}</strong> ${escapeHtml(text)}` : escapeHtml(text);
}

async function init(){
  // load cards
  const res = await fetch("cards.json");
  ALL_CARDS = await res.json();

  // hook search + rarity
  $("q")?.addEventListener("input", applyFilters);
  $("rarity")?.addEventListener("change", () => {
    rarityUI?.setLabelFromValue?.();
    applyFilters();
  });

  // clear
  $("clear")?.addEventListener("click", () => {
    if($("q")) $("q").value = "";
    if($("rarity")) $("rarity").value = "";
    rarityUI?.setLabelFromValue?.();
    applyFilters();
  });

  initRarityDropdown();
  bindModalClose();

  // initial render
  applyFilters();
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error(err);
    const status = $("status");
    if(status) status.textContent = "Failed to load cards. Check console.";
  });
});
