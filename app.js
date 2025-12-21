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

function wrapOriginalTitleCaps(nameSpan){
  // Wrap ONLY word-initial uppercase letters that already exist in the title text.
  // "Kjeldoran Skycaptain" -> K and S get wrapped
  // "Kjeldoran skycaptain" -> only K gets wrapped
  if(!nameSpan) return;

  const txt = nameSpan.textContent || "";

  // Replace word-initial uppercase letters (Unicode-aware).
  const wrapped = txt.replace(/(\p{Lu})/gu, (m, cap) => {
    return `<span class=\"capInit\">${cap}</span>`;
  });

  nameSpan.innerHTML = wrapped;
}

function wrapOriginalCapsInTextNodes(root){
  if(!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while(walker.nextNode()){
    const node = walker.currentNode;
    const p = node.parentElement;
    if(!p) continue;
    if(p.closest('.capInit')) continue;
    if(p.closest('.ptLabel') || p.closest('.ptVal')) continue;
    nodes.push(node);
  }

  for(const node of nodes){
    const txt = node.nodeValue || "";
    if(!txt) continue;

    const wrapped = txt.replace(/(\p{Lu})/gu, (m, cap) => {
      return `<span class=\"capInit\">${cap}</span>`;
    });

    if(wrapped === txt) continue;

    const span = document.createElement('span');
    span.innerHTML = wrapped;
    node.parentNode.replaceChild(span, node);
  }
}


/* ==========================================================
   Synthetic “lowercaps” engine (global)
   Uses the same trick as the modal title/meta:
   - CSS sets all-small-caps on .efLowercaps
   - JS wraps only ORIGINAL word-initial capitals with <span class="capInit">
   ========================================================== */

function markLowercaps(root = document){
  const sel = [
    ".brand .title",
    ".uiSmallCaps",
    ".brand .subtitle",

    ".pagePanel h1",
    ".pagePanel h2",
    ".mapTitle",
    ".iconSectionTitle",

    ".navBtn",
    ".ddBtn",
    ".ddMenu",
    ".ddItem",
    ".ddMenu a.ddLink",
    "#rarityLabel",
    "#typeLabel",
    "#guideLabel",

    ".cardName",
    ".cardType",
    "#status"
  ].join(",");

  // IMPORTANT: querySelectorAll() does not include the root element itself,
  // so explicitly tag root when we call applyLowercaps(btn/menu).
  if(root instanceof Element && root.matches(sel)){
    root.classList.add("efLowercaps");
  }

  root.querySelectorAll(sel).forEach(el => el.classList.add("efLowercaps"));
}

function applyLowercaps(root = document){
  markLowercaps(root);

  const set = new Set();

  if(root instanceof Element && root.classList.contains("efLowercaps")){
    set.add(root);
  }
  root.querySelectorAll(".efLowercaps").forEach(el => set.add(el));

  // Wrap original capitals inside any element that opted in
  for(const el of set){
    wrapOriginalCapsInTextNodes(el);
  }
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

  // Planeswalker loyalty costs: make "+1:" / "-2:" / "-X:" stand out at line starts.
  // Supports ASCII "-" and Unicode minus "−" (U+2212). Also matches literal <br> tags in source text.
  const LOY_RE = /(^|\n|\r|<br\s*\/?>)\s*([+\-−](?:\d+|X)):/gi;
  s = s.replace(LOY_RE, (m, pre, num) => {
    const n = String(num).toUpperCase();
    const sign = n.trim()[0];
    const cls = (sign === "+") ? "loy loyPlus" : "loy loyMinus";
    return `${pre}<span class="${cls}">${n}:</span>`;
  });

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
  s = s.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, "");
  s = s.replaceAll("&hairsp;", "");

  // Change {Tn} tokens to {Ts}
  s = s.replaceAll("{Tn}", "{Ts}");

  return s;
}

// Lore display sanitizer: same as rules/flavor, plus tighter em-dash typography
function sanitizeLoreText(str){
  if(str == null) return "";
  let s = sanitizeRulesFlavorText(str);
  s = s.replace(/\s*—\s*/g, "—");
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
  const raw = cleanCollector(card?.collector || "").trim();

  // Many cards use "N/697" while some special sheets use "N/60" etc.
  // Only collapse to the left side when the denominator is 697; otherwise keep the full string.
  if(raw.includes("/")){
    const [left, right] = raw.split("/", 2).map(s => (s || "").trim());
    return (right === "697") ? left : raw;
  }
  return raw;
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
  const btns = nav.querySelectorAll(".modalNavBtn");
  const prev = btns[0];
  const next = btns[1];
  if(prev) prev.disabled = !(CURRENT_INDEX > 0);
  if(next) next.disabled = !(CURRENT_INDEX >= 0 && CURRENT_INDEX < FILTERED.length - 1);
}

function setModalContentWarning(modal, card){
  const imgEl = $("mImg") || modal.querySelector("#mImg") || modal.querySelector("img.modalCard") || modal.querySelector("img");
  const left = modal.querySelector(".modalLeft") || imgEl?.parentElement;

  // remove old overlay
  left?.querySelector?.(".cwOverlay")?.remove();

  if(!imgEl) return;

  const needs = isContentWarn(card) && !isRevealed(card);
  imgEl.classList.toggle("cwBlur", !!needs);

  if(!needs) return;

  if(left){
    const ov = document.createElement("div");
    ov.className = "cwOverlay";
    ov.innerHTML = `<div class="cwMsg">Potentially NSFW artwork.<br>Click to reveal.</div>`;
    ov.addEventListener("click", (e)=>{
      e.stopPropagation();
      revealCard(card);
      setModalContentWarning(modal, card);
      // update grid to unblur this card too
      render();
    });
    left.appendChild(ov);
  }
}

function bindModalNavKeys(){
  // one global handler; only active when modal is open
  document.addEventListener("keydown", (e)=>{
    const modal = modalEl();
    if(!modal || !modal.classList.contains("open")) return;
    if(e.key === "ArrowLeft"){ e.preventDefault(); gotoFilteredIndex(CURRENT_INDEX - 1); }
    if(e.key === "ArrowRight"){ e.preventDefault(); gotoFilteredIndex(CURRENT_INDEX + 1); }
  });
}

function cardMatches(card, q){
  if(!q) return true;
  const hay = [
    card.name, card.type, card.rules, card.flavor, card.lore, card.art, card.cost, card.pt
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

    const cw = isContentWarn(card) && !isRevealed(card);
    el.innerHTML = `
      <div class="thumbWrap${cw ? " cw" : ""}">
        <img class="thumb${cw ? " cwBlur" : ""}" src="${imgSrc}" alt="${title}" loading="lazy"
          onerror="this.classList.add('missing'); this.alt=this.alt+' (missing image)';">
        ${cw ? `<div class="cwOverlay"><div class="cwMsg">Potentially NSFW artwork.<br>Click to reveal.</div></div>` : ``}
      </div>
      <div class="cardMeta">
        <div class="cardName efLowercaps">${title}</div>
        <div class="cardType efLowercaps">${type}</div>
      </div>
    `;

    el.addEventListener("click", (e) => {
      if(isContentWarn(card) && !isRevealed(card)){
        e.preventDefault();
        e.stopPropagation();
        revealCard(card);
        render();
        return;
      }
      openModal(card);
    });

    grid.appendChild(el);
  }

  const status = $("status");
  if(status) status.textContent = `${FILTERED.length} cards`;

  // Apply lowercaps styling to newly rendered cards + status line
  applyLowercaps(grid);
  if(status) applyLowercaps(status);
}

function applyFilters(){
  const q = ($("q")?.value || "").trim().toLowerCase();
  const r = ($("rarity")?.value || "").trim().toUpperCase();
  const t = ($("type")?.value || "").trim();

  FILTERED = ALL_CARDS.filter(c => {
    if(q && !cardMatches(c, q)) return false;
    if(r && rarityKey(c) !== r) return false;
    if(t){
      const ct = String(c.type || "").toLowerCase();
      if(!ct.includes(t.toLowerCase())) return false;
    }
    return true;
  });

  render();
}

function ensureLoreArtBlocks(modal){
  // Ensure Lore/Art blocks exist in the modal (only shown when text exists)
  // Desired order: Rules, Flavor, Lore
  const right = modal?.querySelector?.(".modalRight");
  if(!right) return;

  const rulesEl = document.getElementById("mRules") || right.querySelector("#mRules");
  const flavorEl = document.getElementById("mFlavor") || right.querySelector("#mFlavor");

  function insertAfter(refEl, el){
    if(refEl && refEl.parentElement){
      if(refEl.nextSibling) refEl.parentElement.insertBefore(el, refEl.nextSibling);
      else refEl.parentElement.appendChild(el);
      return;
    }
    right.appendChild(el);
  }

  function ensure(id, className, afterEl){
    let el = document.getElementById(id) || right.querySelector(`#${id}`);
    if(el) return el;

    el = document.createElement("div");
    el.id = id;
    el.className = `block ${className}`;

    if(afterEl){
      insertAfter(afterEl, el);
    } else if(flavorEl){
      insertAfter(flavorEl, el);
    } else if(rulesEl){
      insertAfter(rulesEl, el);
    } else {
      right.appendChild(el);
    }
    return el;
  }
  const loreEl = ensure("mLore", "loreBlock", flavorEl);

  // If an Art block exists from older builds, hide it.
  const art = document.getElementById("mArt") || right.querySelector("#mArt");
  if(art) art.style.display = "none";
}



// ---- modal ----
function modalEl(){
  return $("modal") || document.querySelector(".modal");
}

function openModal(card){
  const modal = modalEl();
  if(!modal) return;

  CURRENT_INDEX = findFilteredIndex(card);
  if(CURRENT_INDEX < 0) CURRENT_INDEX = 0;

  // Title & cost: prefer #mTitle, else inject into the first header area we can find
  const titleEl =
    $("mTitle") ||
    modal.querySelector("#mTitle") ||
    modal.querySelector(".modalTitle") ||
    modal.querySelector("h2") ||
    null;

  const costHTML = card.cost ? `<span class="nameCost">${richText(card.cost)}</span>` : "";
  if(titleEl){
    titleEl.innerHTML = `<span class="titleName"><span class="nameText">${escapeHtml(card.name || "")}</span></span>${costHTML}`;
    wrapOriginalTitleCaps(titleEl.querySelector(".nameText"));
    attachIconFallbacks(titleEl);
  }

  // Image
  const imgEl =
    $("mImg") ||
    modal.querySelector("#mImg") ||
    modal.querySelector("img.modalCard") ||
    modal.querySelector("img");

  if(imgEl){
    imgEl.src = assetURL(card.image || "");
    imgEl.alt = card.name || "";
  }

  // Blur overlay (content warnings)
  setModalContentWarning(modal, card);

  // Meta line (type, pt, rarity, set full name, year+Atlantica Remasters, collector)
  const metaBits = [];
  if(card.type) metaBits.push(escapeHtml(card.type));
    if(card.pt){
    const ptVal = escapeHtml(normalizeSlash(card.pt));
    metaBits.push(`<span class=\"ptVal\">${ptVal}</span>`);
  }
metaBits.push(escapeHtml(rarityLong(card.rarity)));
  const si = getSetInfo(card.set);
  if(si.name) metaBits.push(escapeHtml(si.name));
  if(isNewCard(card)){
    metaBits.push(escapeHtml(`2024 Atlantica Remasters`));
  } else if(si.year){
    metaBits.push(escapeHtml(`${si.year} Atlantica Remasters`));
  }
  const col = cleanCollector(card.collector);
  if(col) metaBits.push(escapeHtml(col));

  
const metaEl = $("mMeta") || modal.querySelector("#mMeta") || modal.querySelector(".modalMeta") || null;
if(metaEl){
  metaEl.innerHTML = `<span class="metaText">${metaBits.join(" • ")}</span>`;
  // Wrap original capitals in the meta line (but DON'T touch the explicit P/T label/value)
  wrapOriginalCapsInTextNodes(metaEl.querySelector('.metaText'));
  attachIconFallbacks(metaEl);
}

// Blocks — hide empties
  ensureLoreArtBlocks(modal);
  setBlock("mRules", "Rules", card.rules);
  setBlock("mFlavor", "Flavor", card.flavor);
  setBlock("mLore", "Lore", card.lore);
  // Hide any completely empty "block" containers that might be in the HTML template
  modal.querySelectorAll(".block").forEach(b => {
    const txt = (b.textContent || "").trim();
    if(!txt) b.style.display = "none";
  });

  // Nav buttons
  updateModalNavState(modal);

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



function initRarityDropdown(){
  const sel = $("rarity");
  const btn = $("rarityBtn");
  const label = $("rarityLabel");
  const menu = $("rarityMenu");
  if(!sel || !btn || !label || !menu) return;

  function setLabelFromValue(){
    const opt = Array.from(sel.options).find(o => o.value === sel.value);
    label.textContent = opt ? opt.textContent : "All rarities";
    label.classList.add("efLowercaps");
    wrapOriginalCapsInTextNodes(label);
  }

  function openMenu(){
    // Close other menus (avoid overlapping dropdowns)
    const tm = $("typeMenu"); if(tm) tm.hidden = true;
    const tb = $("typeBtn"); if(tb) tb.setAttribute("aria-expanded","false");
    const gm = $("guideMenu"); if(gm) gm.hidden = true;
    const gb = $("guideBtn"); if(gb) gb.setAttribute("aria-expanded","false");

    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }
  function closeMenu(){
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if(menu.hidden) openMenu(); else closeMenu();
  });

  menu.addEventListener("click", (e) => {
    e.stopPropagation();
    const t = e.target;
    if(!(t instanceof HTMLElement)) return;
    const val = t.getAttribute("data-value");
    if(val === null) return;
    sel.value = val;
    sel.dispatchEvent(new Event("change"));
    closeMenu();
  });

  // Close on outside click
  document.addEventListener("click", () => closeMenu());

  // Close on Escape (without interfering with modal Escape)
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeMenu();
  });

  // Keep label in sync if code changes select value
  sel.addEventListener("change", () => setLabelFromValue());

  setLabelFromValue();
  applyLowercaps(btn);
  applyLowercaps(menu);
}


function initTypeDropdown(){
  const sel = $("type");
  const btn = $("typeBtn");
  const label = $("typeLabel");
  const menu = $("typeMenu");
  if(!sel || !btn || !label || !menu) return;

  function setLabelFromValue(){
    const opt = Array.from(sel.options).find(o => o.value === sel.value);
    label.textContent = opt ? opt.textContent : "All types";
    label.classList.add("efLowercaps");
    wrapOriginalCapsInTextNodes(label);
  }

  function openMenu(){
    // Close other menus (avoid overlapping dropdowns)
    const rm = $("rarityMenu"); if(rm) rm.hidden = true;
    const rb = $("rarityBtn"); if(rb) rb.setAttribute("aria-expanded","false");
    const gm = $("guideMenu"); if(gm) gm.hidden = true;
    const gb = $("guideBtn"); if(gb) gb.setAttribute("aria-expanded","false");

    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }
  function closeMenu(){
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if(menu.hidden) openMenu(); else closeMenu();
  });

  menu.addEventListener("click", (e) => {
    e.stopPropagation();
    const t = e.target;
    if(!(t instanceof HTMLElement)) return;
    const val = t.getAttribute("data-value");
    if(val === null) return;
    sel.value = val;
    sel.dispatchEvent(new Event("change"));
    closeMenu();
  });

  document.addEventListener("click", () => closeMenu());
  document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeMenu(); });

  sel.addEventListener("change", () => setLabelFromValue());
  setLabelFromValue();
  applyLowercaps(btn);
  applyLowercaps(menu);
}

function bindModalClose(){
  const modal = modalEl();
  if(!modal) return;

  // Close buttons
  const btns = modal.querySelectorAll(
    "#mClose, .close, .modalClose, button[aria-label='Close'], button[title='Close'], button[data-close='modal']"
  );
  btns.forEach(b => b.addEventListener("click", closeModal));

  // Clicking backdrop closes
  modal.addEventListener("click", (e) => {
    const t = e.target;
    if(t === modal || t.dataset?.close === "modal" || t.classList.contains("modalBackdrop")){
      closeModal();
    }
  });

  // ESC closes (modal only)
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape"){
      const m = modalEl();
      if(m && m.classList.contains("open")){
        e.preventDefault();
        closeModal();
      }
    }
  });
}

function setBlock(id, label, text){
  // Art block is intentionally omitted from the web viewer.
  if(id === "mArt" || id === "modalArt") return;
  // Be tolerant of markup variations across patches (mRules vs modalRules, etc.).
  const candidates = [];
  if (id) candidates.push(id);
  if (id === "mRules") candidates.push("modalRules", "rules", "rulesBlock");
  if (id === "mFlavor") candidates.push("modalFlavor", "flavor", "flavorBlock");
  if (id === "mLore") candidates.push("modalLore", "lore", "loreBlock");
  if (id === "mArt") candidates.push("modalArt", "art", "artBlock");

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
      if (id === "mLore") el = modal.querySelector('[data-block="lore"], #modalLore, #mLore, #lore');
      if (id === "mArt") el = modal.querySelector('[data-block="art"], #modalArt, #mArt, #art');
    }
  }

  if (!el) return;

  let tRaw = (text || "");
  if(id === "mLore"){
    tRaw = sanitizeLoreText(tRaw);
  } else if(id === "mRules" || id === "mFlavor" || id === "mArt"){
    tRaw = sanitizeRulesFlavorText(tRaw);
  }
  const t = String(tRaw).trim();

  // Ensure base styling + type styling
  el.classList.add("block");
  el.classList.toggle("rulesBlock", id === "mRules");
  el.classList.toggle("flavorBlock", id === "mFlavor");
  el.classList.toggle("loreBlock", id === "mLore");
  el.classList.toggle("artBlock", id === "mArt");

  if (!t){
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }

  el.style.display = "block";

  let bodyHtml = richText(t);
  if(id === "mLore") bodyHtml = `<span class="lead loreLead">Lore:</span> ` + bodyHtml;
  if(id === "mArt")  bodyHtml = `<span class="lead artLead">Art:</span> ` + bodyHtml;

  // If your HTML template already contains a body element, use it.
  const body = el.querySelector?.(".blockBody") || el.querySelector?.(".body") || null;
  if (body){
    body.innerHTML = bodyHtml;
  } else {
    el.innerHTML = `
      <div class="blockLabel">${escapeHtml(label || "")}</div>
      <div class="blockBody">${bodyHtml}</div>
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
    $("type")?.addEventListener("change", applyFilters);
    $("clearBtn")?.addEventListener("click", () => {
      if($("q")) $("q").value = "";
      if($("rarity")) { $("rarity").value = ""; $("rarity").dispatchEvent(new Event("change")); }
      if($("type")) { $("type").value = ""; $("type").dispatchEvent(new Event("change")); }
      applyFilters();
    });

    initRarityDropdown();
    initTypeDropdown();
    // Apply the “lowercaps” system across static UI (header, dropdowns, etc.)
    applyLowercaps(document);
    bindModalClose();
    bindModalNavKeys();
    applyFilters();
  }catch(err){
    console.error(err);
    if(status) status.textContent = `Failed to load cards: ${err?.message || err}`;
    if(status) status.style.opacity = "1";
  }
}

document.addEventListener("DOMContentLoaded", init);