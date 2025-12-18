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
    "CSP": { name: "Coldsnap", year: "2006/2024" }
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

  // Bold anything wrapped in backticks: `Vigilance` -> <strong>Vigilance</strong>
  s = s.replace(/`([^`]+)`/g, "<strong>$1</strong>");

  // Replace {Anything} with its icon (mana, keyword, etc.)
  s = s.replace(/\{([^}]+)\}/g, (m, tok) => iconIMGFromTok(tok));

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

  // Replace hair space (U+200A) and common HTML entity variant with regular spacing.
  // Using &nbsp; keeps spacing visible even when HTML collapses multiple spaces.
  s = s.replaceAll("\u200A", "&nbsp;&nbsp;").replaceAll("&hairsp;", "&nbsp;&nbsp;");

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

function cardMatches(card, q){
  if(!q) return true;
  const hay = [
    card.name, card.type, card.rules, card.flavor, card.cost, card.pt
  ].map(x => String(x ?? "")).join(" ").toLowerCase();
  return hay.includes(q);
}

function rarityKey(card){
  return String(card.rarity ?? "").trim().toUpperCase();
}

function render(){
  const grid = $("grid");
  if(!grid) return;

  grid.innerHTML = "";
  for(const card of FILTERED){
    const el = document.createElement("button");
    el.className = "card";
    el.type = "button";

    const imgSrc = assetURL(card.image || "");
    const title = escapeHtml(card.name || "");
    const type = escapeHtml(card.type || "");

    el.innerHTML = `
      <div class="thumbWrap">
        <img class="thumb" src="${imgSrc}" alt="${title}" loading="lazy"
          onerror="this.classList.add('missing'); this.alt=this.alt+' (missing image)';">
      </div>
      <div class="cardMeta">
        <div class="cardName">${title}</div>
        <div class="cardType">${type}</div>
      </div>
    `;
    el.addEventListener("click", () => openModal(card));
    grid.appendChild(el);
  }

  const status = $("status");
  if(status) status.textContent = `${FILTERED.length} cards`;
}

function applyFilters(){
  const q = ($("q")?.value || "").trim().toLowerCase();
  const r = ($("rarity")?.value || "").trim().toUpperCase();

  FILTERED = ALL_CARDS.filter(c => {
    if(q && !cardMatches(c, q)) return false;
    if(r && r !== "ALL" && rarityKey(c) !== r) return false;
    return true;
  });

  render();
}

// ---- modal ----
function modalEl(){
  return $("modal") || document.querySelector(".modal");
}

function openModal(card){
  const modal = modalEl();
  if(!modal) return;

  // Title & cost: prefer #mTitle, else inject into the first header area we can find
  const titleEl =
    $("mTitle") ||
    modal.querySelector("#mTitle") ||
    modal.querySelector(".modalTitle") ||
    modal.querySelector("h2") ||
    null;

  const costHTML = card.cost ? `<span class="nameCost">${richText(card.cost)}</span>` : "";
  if(titleEl){
    titleEl.innerHTML = `${escapeHtml(card.name || "")}${costHTML}`;
    attachIconFallbacks(titleEl);
  }

  // Image
  const imgEl = $("mImg") || modal.querySelector("#mImg") || modal.querySelector("img.modalCard") || modal.querySelector("img");
  if(imgEl){
    imgEl.src = assetURL(card.image || "");
    imgEl.alt = card.name || "";
  }

  // Meta line (type, pt, rarity, set full name, year+Atlantica Remasters, collector)
  const metaBits = [];
  if(card.type) metaBits.push(escapeHtml(card.type));
  if(card.pt) metaBits.push(escapeHtml(normalizeSlash(card.pt)));
  metaBits.push(escapeHtml(rarityLong(card.rarity)));
  const si = getSetInfo(card.set);
  if(si.name) metaBits.push(escapeHtml(si.name));
  if(si.year) metaBits.push(escapeHtml(`${si.year} Atlantica Remasters`));
  const col = cleanCollector(card.collector);
  if(col) metaBits.push(escapeHtml(col));

  const metaEl = $("mMeta") || modal.querySelector("#mMeta") || modal.querySelector(".modalMeta") || null;
  if(metaEl){
    metaEl.innerHTML = metaBits.join(" • ");
    attachIconFallbacks(metaEl);
  }

  // Blocks — hide empties
  setBlock("mRules", "Rules", card.rules);
  setBlock("mFlavor", "Flavor", card.flavor);

  // Hide any completely empty "block" containers that might be in the HTML template
  modal.querySelectorAll(".block").forEach(b => {
    const txt = (b.textContent || "").trim();
    if(!txt) b.style.display = "none";
  });

  // open
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(){
  const modal = modalEl();
  if(!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}


function initRarityDropdownTop(){
  const ddl = document.getElementById('rarity');
  if(!ddl) return;

  // Ensure readable menu colors in dark UI (browser-dependent)
  ddl.addEventListener('mousedown', ()=>{
    ddl.style.color = '#e6eefc';
    ddl.style.background = 'rgba(13,20,34,0.98)';
  });

  ddl.addEventListener('change', ()=>{
    state.rarity = ddl.value || '';
    applyFilters();
  });
}

function bindModalClose(){
  const modal = modalEl();
  if(!modal) return;

  // Close buttons: try a bunch of common selectors (your "X" button)
  const btns = modal.querySelectorAll(
    "#mClose, .close, .modalClose, button[aria-label='Close'], button[title='Close'], button[data-close='modal']"
  );
  btns.forEach(b => b.addEventListener("click", closeModal));

  // Clicking backdrop closes: if click hits the modal container itself or an element explicitly marked as backdrop
  modal.addEventListener("click", (e) => {
    const t = e.target;
    if(t === modal || t.id === "modalBackdrop" || t.classList.contains("backdrop")){
      closeModal();
    }
  });

  // ESC closes
  function initRarityDropdown(){
  const sel = $("rarity");
  const btn = $("rarityBtn");
  const label = $("rarityLabel");
  const menu = $("rarityMenu");

  if(!sel || !btn || !label || !menu) return;

  function setLabelFromValue(){
    const opt = Array.from(sel.options).find(o => o.value === sel.value);
    label.textContent = opt ? opt.textContent : "All rarities";
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

  document.addEventListener("click", () => closeMenu());

  // keep label in sync if code changes select
  sel.addEventListener("change", () => setLabelFromValue());

  setLabelFromValue();
}

document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeModal(); });
}

function setBlock(id, label, text){
  // Be tolerant of markup variations across patches (mRules vs modalRules, etc.).
  const candidates = [];
  if (id) candidates.push(id);
  if (id === "mRules") candidates.push("modalRules", "rules", "rulesBlock");
  if (id === "mFlavor") candidates.push("modalFlavor", "flavor", "flavorBlock");

  let el = null;
  for (const cid of candidates){
    el = document.getElementById(cid);
    if (el) break;
  }

  // Last resort: locate within the modal by common selectors.
  if (!el){
    const modal = document.getElementById("modal") || document.querySelector(".modal");
    if (modal){
      if (id === "mRules") el = modal.querySelector('[data-block="rules"], #modalRules, #mRules, #rules');
      if (id === "mFlavor") el = modal.querySelector('[data-block="flavor"], #modalFlavor, #mFlavor, #flavor');
    }
  }

  if (!el) return;

  let tRaw = (text || "");
  if(id === "mRules" || id === "mFlavor"){
    tRaw = sanitizeRulesFlavorText(tRaw);
  }
  const t = String(tRaw).trim();

  // Ensure base styling + type styling
  el.classList.add("block");
  el.classList.toggle("rulesBlock", id === "mRules");
  el.classList.toggle("flavorBlock", id === "mFlavor");

  if (!t){
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }

  el.style.display = "block";

  // If your HTML template already contains a body element, use it.
  const body = el.querySelector?.(".blockBody") || el.querySelector?.(".body") || null;
  if (body){
    body.innerHTML = richText(t);
  } else {
    el.innerHTML = `
      <div class="blockLabel">${escapeHtml(label || "")}</div>
      <div class="blockBody">${richText(t)}</div>
    `;
  }

  attachIconFallbacks(el);
}


// ---- Boot ----
async function init(){
  const status = $("status");
  try{
    if(status) status.textContent = "Loading cards…";
    const url = assetURL("data/cards.json");
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const data = await res.json();
    if(!Array.isArray(data)) throw new Error("cards.json is not an array");

    // sort once, globally
    data.sort((a,b) => sortKeyFromImage(a.image) - sortKeyFromImage(b.image));

    ALL_CARDS = data;
    FILTERED = data;

    $("q")?.addEventListener("input", applyFilters);
    $("rarity")?.addEventListener("change", applyFilters);
    $("clear")?.addEventListener("click", () => {
      if($("q")) $("q").value = "";
      if($("rarity")) $("rarity").value = "ALL";
      applyFilters();
    });

    initRarityDropdownTop();
    bindModalClose();
    applyFilters();
  }catch(err){
    console.error(err);
    if(status) status.textContent = `Failed to load cards: ${err?.message || err}`;
    if(status) status.style.opacity = "1";
  }
}

document.addEventListener("DOMContentLoaded", init);
