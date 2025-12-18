

function assetURL(relPath){
  // Robustly resolve assets when hosted under a subpath (GitHub Pages project sites)
  // Example: https://<user>.github.io/ice-age/ -> assets resolve under /ice-age/
  return new URL(relPath, document.baseURI).toString();
}
let ALL = [];
let FILTERED = [];

const $ = (id) => document.getElementById(id);
const norm = (s) => String(s || "").toLowerCase();

function isToken(card){ return norm(card.type).startsWith("token"); }
function isBasic(card){ return norm(card.type).startsWith("basic land"); }

function category(card){
  if(isToken(card)) return 2;
  if(isBasic(card)) return 1;
  return 0;
}

function numFromCollector(card){
  return (typeof card.num === "number") ? card.num : 1e9;
}

function collectorStr(card){ return String(card.collector || ""); }

function versionNum(card){
  const v = Number(card.version);
  return Number.isFinite(v) ? v : 1;
}

function rarityCode(card){
  const r = String(card.rarity || "").toUpperCase().trim();
  if(["C","U","R","M"].includes(r)) return r;
  // tolerate words
  if(r.startsWith("COM")) return "C";
  if(r.startsWith("UNC")) return "U";
  if(r.startsWith("RARE")) return "R";
  if(r.startsWith("MYT")) return "M";
  return r || "";
}

function rarityName(code){
  switch(String(code||"").toUpperCase()){
    case "C": return "Common";
    case "U": return "Uncommon";
    case "R": return "Rare";
    case "M": return "Mythic";
    default: return code || "";
  }
}

function prettySlash(s){
  return String(s || "").replaceAll("\\", "/");
}

// Set display mapping
function setInfo(setCode){
  const code = String(setCode || "").toUpperCase().trim();
  const map = {
    "ICE": { name:"Ice Age", year:"1995/2024" },
    "ALL": { name:"Alliances", year:"1996/2024" },
    "CSP": { name:"Coldsnap", year:"2006/2024" },
  };
  const hit = map[code];
  if(!hit) return { name: code || "Set", year: "" };
  return hit;
}

function escapeHtml(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* === Inline SVG icons (simple, readable) === */
function manaIMG(key){
  // Expects PNG icons in /assets/icons/, named:
  // W.png U.png B.png R.png G.png C.png S.png T.png
  // For hybrids, you can add e.g. W-U.png or 2-W.png if you like (optional).
  const k = String(key || "").toUpperCase().trim();
  if(!k) return null;
  const file = `${k}.png`;
  return `<img class="mana" src="${assetURL(`assets/icons/${file}`)}" alt="${escapeHtml(k)}" loading="lazy">`;
}

function pip(text, snow=false){
  const cls = snow ? "pip snow" : "pip";
  return `<span class="${cls}" aria-label="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
}

// Replace `{...}` tokens with icons/pips, and `...` with bold.
function iconFileCandidates(tok){
  const t = String(tok || "").trim();
  if(!t) return [];
  const candidates = [];

  // 1) exact token (case-sensitive)
  candidates.push(t);

  // 2) filename-friendly variant (slashes/spaces -> hyphens)
  candidates.push(t.replaceAll("/", "-").replaceAll(" ", "-"));

  // 3) uppercased (useful for mana letters)
  candidates.push(t.toUpperCase());

  // 4) uppercased + normalized
  candidates.push(t.toUpperCase().replaceAll("/", "-").replaceAll(" ", "-"));

  // Deduplicate while preserving order
  return [...new Set(candidates)];
}

function iconIMGFromTok(tok){
  // ANY token inside {...} tries to load an icon PNG from /assets/icons/<token>.png
  // We prefer a normalized filename (slashes/spaces -> hyphens).
  const t = String(tok || "").trim();
  const cand = iconFileCandidates(t);
  const file = (cand[1] || cand[0] || "").trim(); // prefer normalized
  if(!file) return null;
  return `<img class="sym" src="${assetURL(`assets/icons/${encodeURIComponent(file)}.png`)}" alt="${escapeHtml(t)}" data-token="${escapeHtml(t)}" loading="lazy">`;
}

function attachIconFallbacks(root){
  if(!root) return;
  const imgs = root.querySelectorAll("img.sym[data-token]");
  imgs.forEach(img => {
    img.addEventListener("error", () => {
      const tok = (img.getAttribute("data-token") || "").trim();

      // numbers and X -> pill
      if(/^\d+$/.test(tok) || tok.toUpperCase() === "X"){
        const span = document.createElement("span");
        span.className = "pip";
        span.textContent = tok.toUpperCase();
        img.replaceWith(span);
        return;
      }

      // snow-marked like 1s/Xs/Cs -> snow pill
      const snowMatch = tok.match(/^([0-9]+|X|C)(s)$/i);
      if(snowMatch){
        const span = document.createElement("span");
        span.className = "pip snow";
        span.textContent = snowMatch[1].toUpperCase();
        img.replaceWith(span);
        return;
      }

      // Otherwise keyword text
      const span = document.createElement("span");
      span.className = "kw";
      span.textContent = tok;
      img.replaceWith(span);
    }, { once:true });
  });
}

function richText(raw){
  if(!raw) return "";
  let s = escapeHtml(String(raw));

  // backticks -> bold
  s = s.replace(/`+([^`]+)`+/g, (_,inner) => `<strong>${inner}</strong>`);

  // braces -> try icon for ANY token
  s = s.replace(/\{([^}]+)\}/g, (_,tok) => {
    const t = String(tok).trim();
    if(!t) return "";
    const img = iconIMGFromTok(t);
    if(img) return img;

    // ultra-safe fallback:
    if(/^\d+$/.test(t) || t.toUpperCase()==="X") return `<span class="pip">${escapeHtml(t.toUpperCase())}</span>`;
    return `<span class="kw">${escapeHtml(t)}</span>`;
  });

  s = s.replaceAll("\n", "<br>");
  return s;
}

function matches(card, q){
  if(!q) return true;
  const hay = [
    card.name, card.type, card.rules, card.flavor, card.cost,
    rarityName(rarityCode(card)), card.set
  ].map(norm).join(" • ");
  return hay.includes(q);
}

function applyFilters(){
  const q = norm($("q").value).trim();
  const r = $("rarity").value; // "C/U/R/M" or ""
  FILTERED = ALL.filter(c => {
    if(r && rarityCode(c) !== r) return false;
    if(!matches(c, q)) return false;
    return true;
  });

  renderGrid();
  $("status").textContent = `${FILTERED.length} / ${ALL.length} cards`;
}

function cardThumb(card){
  const div = document.createElement("div");
  div.className = "card";
  div.tabIndex = 0;
  div.setAttribute("role", "button");
  div.setAttribute("aria-label", card.name);

  const img = document.createElement("img");
  img.className = "thumb";
  img.loading = "lazy";
  img.src = card.image;
  img.alt = card.name;
  img.onerror = () => {
    img.removeAttribute("src");
    img.alt = `${card.name} (missing image)`;
    img.style.background = "#000";
  };

  const info = document.createElement("div");
  info.className = "cInfo";
  info.innerHTML = `
    <div class="cName">${escapeHtml(card.name)}</div>
    <div class="cMeta">${escapeHtml(card.type || "")}</div>
  `;

  div.appendChild(img);
  div.appendChild(info);

  const open = () => openModal(card);
  div.addEventListener("click", open);
  div.addEventListener("keydown", (e) => {
    if(e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });

  return div;
}

function renderGrid(){
  const grid = $("grid");
  grid.innerHTML = "";
  const frag = document.createDocumentFragment();
  for(const c of FILTERED){
    frag.appendChild(cardThumb(c));
  }
  grid.appendChild(frag);
}

function setBlock(id, text, label){
  const el = $(id);
  const t = String(text || "").trim();
  if(!t){ el.style.display = "none"; return; }
  el.style.display = "block";
  el.innerHTML = `<div style="font-weight:800; margin-bottom:6px;">${escapeHtml(label)}:</div>${richText(t)}`;
  attachIconFallbacks(el);
}

function openModal(card){
  $("mImg").src = card.image;
  $("mImg").alt = card.name;

  // Name + mana cost icons
  const nameEl = $("mName");
  if(nameEl){
    const costHtml = card.cost ? ` <span class="mCost">${richText(card.cost)}</span>` : "";
    nameEl.innerHTML = `<span class="mTitleText">${escapeHtml(card.name)}</span>${costHtml}`;
    attachIconFallbacks(nameEl);
  }

  const metaBits = [];
  // meta line: Type • P/T • Rarity • Set • 1995/2024 Atlantica Remasters • 1/697
  if(card.type) metaBits.push(escapeHtml(card.type));
  if(card.pt) metaBits.push(escapeHtml(String(card.pt).replaceAll("\","/")));
  metaBits.push(escapeHtml(rarityLong(card.rarity)));
  const si = getSetInfo(card.set);
  if(si.name) metaBits.push(escapeHtml(si.name));
  if(si.year) metaBits.push(escapeHtml(`${si.year} Atlantica Remasters`));
  const col = cleanCollector(card.collector);
  if(col) metaBits.push(escapeHtml(col));
  $("mMeta").innerHTML = metaBits.join(" • ");
  attachIconFallbacks($("mMeta"));

  setBlock("mRules", card.rules, "Rules");
  setBlock("mFlavor", card.flavor, "Flavor");
  setBlock("mLore", card.lore, "Lore");
  setBlock("mArt", card.art, "Art");
  setBlock("mPlay", card.playNotes, "Play Notes");

  const modal = $("modal");
  if(modal){
    modal.setAttribute("aria-hidden","false");
    modal.classList.add("open"); // supports CSS that uses .open instead of aria-hidden
  }
  document.body.style.overflow = "hidden";
}

function closeModal(){
  const modal = $("modal");
  if(modal){
    modal.setAttribute("aria-hidden","true");
    modal.classList.remove("open");
  }
  document.body.style.overflow = "";
}

async async function init(){
  try{
    const res = await fetch("data/cards.json", { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status} loading data/cards.json`);
    ALL = await res.json();

    // ordering: normal cards (collector #), then basics (L...), then tokens
    ALL.sort((a,b) => {
      const ca = category(a), cb = category(b);
      if(ca !== cb) return ca - cb;

      const na = numFromCollector(a), nb = numFromCollector(b);
      if(na !== nb) return na - nb;

      if(ca === 0){
        const sa = collectorStr(a).localeCompare(collectorStr(b));
        if(sa !== 0) return sa;
        const va = versionNum(a), vb = versionNum(b);
        if(va !== vb) return va - vb;
      } else if(ca === 1){
        const sn = String(a.name||"").localeCompare(String(b.name||""));
        if(sn !== 0) return sn;
        const va = versionNum(a), vb = versionNum(b);
        if(va !== vb) return va - vb;
      } else {
        const sn = String(a.name||"").localeCompare(String(b.name||""));
        if(sn !== 0) return sn;
      }
      return String(a.name||"").localeCompare(String(b.name||""));
    });

    FILTERED = ALL;
    $("status").textContent = `${ALL.length} cards`;
    renderGrid();
  }catch(err){
    console.error(err);
    $("status").textContent = "Failed to load data/cards.json: " + err;
  }

  $("q").addEventListener("input", applyFilters);
  $("rarity").addEventListener("change", applyFilters);
  $("clear").addEventListener("click", () => {
    $("q").value = "";
    $("rarity").value = "";
    applyFilters();
  });

  $("close").addEventListener("click", closeModal);
  $("modal").addEventListener("click", (e) => {
    if(e.target === $("modal")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeModal();
  });
}

init();function getSetInfo(code){
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


