// ElderForge — Ice Age (static card database)
// Robust loader + modal + symbol rendering (PNG icons in /assets/icons/)

function $(id){ return document.getElementById(id); }

function assetURL(relPath){
  // Works for GitHub Pages project sites under subpaths (/ice-age/)
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
  return String(v || "").trim().replace(/^#\s*/, "");
}

function iconFileCandidates(tok){
  const t = String(tok || "").trim();
  if(!t) return [];
  const candidates = [];
  candidates.push(t);
  candidates.push(t.replaceAll("/", "-").replaceAll(" ", "-"));
  candidates.push(t.toUpperCase());
  candidates.push(t.toUpperCase().replaceAll("/", "-").replaceAll(" ", "-"));
  return [...new Set(candidates)];
}

function iconIMGFromTok(tok){
  const t = String(tok || "").trim();
  const cand = iconFileCandidates(t);
  // Prefer exact token first; if that fails the browser will try nothing else,
  // so we pick the most likely filename deterministically:
  const file = (cand[0] || "").trim();
  if(!file) return null;
  const src = assetURL(`assets/icons/${encodeURIComponent(file)}.png`);
  return `<img class="sym" src="${src}" alt="${escapeHtml(t)}" data-token="${escapeHtml(t)}" loading="lazy">`;
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

      // Otherwise show token text (precise, no aliases)
      const span = document.createElement("span");
      span.className = "kw";
      span.textContent = tok;
      img.replaceWith(span);
    }, { once:true });
  });
}

function richText(raw){
  if(raw === null || raw === undefined) return "";
  let s = escapeHtml(String(raw));

  // backticks -> bold
  s = s.replace(/`+([^`]+)`+/g, (_,inner) => `<strong>${inner}</strong>`);

  // braces -> icon (PNG)
  s = s.replace(/\{([^}]+)\}/g, (_,tok) => {
    const t = String(tok).trim();
    if(!t) return "";
    const img = iconIMGFromTok(t);
    return img || `<span class="kw">${escapeHtml(t)}</span>`;
  });

  s = s.replaceAll("\\n", "<br>");
  return s;
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
        <img class="thumb" src="${imgSrc}" alt="${title}" loading="lazy" onerror="this.classList.add('missing'); this.alt=this.alt+' (missing image)';">
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

function openModal(card){
  const modal = $("modal");
  if(!modal) return;

  // Title + mana cost
  const title = $("mTitle");
  if(title){
    title.innerHTML = `${escapeHtml(card.name || "")}<span class="nameCost">${richText(card.cost || "")}</span>`;
    attachIconFallbacks(title);
  }

  // Image
  const mImg = $("mImg");
  if(mImg){
    mImg.src = assetURL(card.image || "");
    mImg.alt = card.name || "";
  }

  // Meta line (no #, full set name, year+Atlantica Remasters)
  const metaBits = [];
  if(card.type) metaBits.push(escapeHtml(card.type));
  if(card.pt) metaBits.push(escapeHtml(String(card.pt).replaceAll("\\","/")));
  metaBits.push(escapeHtml(rarityLong(card.rarity)));
  const si = getSetInfo(card.set);
  if(si.name) metaBits.push(escapeHtml(si.name));
  if(si.year) metaBits.push(escapeHtml(`${si.year} Atlantica Remasters`));
  const col = cleanCollector(card.collector);
  if(col) metaBits.push(escapeHtml(col));

  const mMeta = $("mMeta");
  if(mMeta){
    mMeta.innerHTML = metaBits.join(" • ");
    attachIconFallbacks(mMeta);
  }

  // Blocks
  setBlock("mRules", "Rules", card.rules);
  setBlock("mFlavor", "Flavor", card.flavor);

  // open
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(){
  const modal = $("modal");
  if(!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function setBlock(id, label, text){
  const el = $(id);
  if(!el) return;
  const t = (text === null || text === undefined || String(text).trim()==="" || String(text).toLowerCase()==="nan") ? "" : String(text);
  if(!t){
    el.innerHTML = "";
    el.style.display = "none";
    return;
  }
  el.style.display = "";
  el.innerHTML = `<div class="blockLabel">${escapeHtml(label)}:</div><div class="blockBody">${richText(t)}</div>`;
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
    ALL_CARDS = data;
    FILTERED = data;

    // Wire controls
    $("q")?.addEventListener("input", applyFilters);
    $("rarity")?.addEventListener("change", applyFilters);
    $("clear")?.addEventListener("click", () => {
      if($("q")) $("q").value = "";
      if($("rarity")) $("rarity").value = "ALL";
      applyFilters();
    });

    // Modal close
    $("mClose")?.addEventListener("click", closeModal);
    $("modalBackdrop")?.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeModal(); });

    // First paint
    applyFilters();
  }catch(err){
    console.error(err);
    if(status) status.textContent = `Failed to load cards: ${err?.message || err}`;
    // make it visible even if CSS hides status
    if(status) status.style.opacity = "1";
  }
}

window.addEventListener("error", (e) => {
  const status = $("status");
  if(status) status.textContent = `Script error: ${e.message || "unknown"}`;
});

document.addEventListener("DOMContentLoaded", init);
