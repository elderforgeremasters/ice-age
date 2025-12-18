let ALL = [];
let FILTERED = [];

const $ = (id) => document.getElementById(id);

function norm(s){ return String(s || "").toLowerCase(); }

function matches(card, q){
  if(!q) return true;
  const hay = [
    card.name, card.type, card.rules, card.flavor, card.cost,
    card.rarity, card.artist, card.set
  ].map(norm).join(" • ");
  return hay.includes(q);
}

function applyFilters(){
  const q = norm($("q").value).trim();
  const r = $("rarity").value;

  FILTERED = ALL.filter(c => {
    if(r && String(c.rarity) !== r) return false;
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
  img.onerror = () => { img.src = ""; img.alt = `${card.name} (missing image)`; img.style.background = "#000"; };

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

function openModal(card){
  $("mImg").src = card.image;
  $("mImg").alt = card.name;
  $("mName").textContent = card.name;

  const metaBits = [];
  if(card.cost) metaBits.push(card.cost);
  if(card.type) metaBits.push(card.type);
  if(card.pt) metaBits.push(card.pt);
  if(card.rarity) metaBits.push(card.rarity);
  if(card.collector) metaBits.push(`#${card.collector}`);
  if(card.artist) metaBits.push(`Artist: ${card.artist}`);
  $("mMeta").textContent = metaBits.join(" • ");

  setBlock("mRules", card.rules, "Rules");
  setBlock("mFlavor", card.flavor, "Flavor");
  setBlock("mLore", card.lore, "Lore");
  setBlock("mArt", card.art, "Art");
  setBlock("mPlay", card.playNotes, "Play Notes");

  const modal = $("modal");
  modal.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}

function setBlock(id, text, label){
  const el = $(id);
  const t = String(text || "").trim();
  if(!t){ el.style.display = "none"; return; }
  el.style.display = "block";
  el.textContent = `${label}:\n${t}`;
}

function closeModal(){
  $("modal").setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
}

function escapeHtml(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function init(){
  try{
    const res = await fetch("data/cards.json", { cache: "no-store" });
    ALL = await res.json();
    // stable default order: by num then name
    ALL.sort((a,b) => (a.num ?? 1e9) - (b.num ?? 1e9) || String(a.name).localeCompare(String(b.name)));
    FILTERED = ALL;
    $("status").textContent = `${ALL.length} cards`;
    renderGrid();
  }catch(err){
    console.error(err);
    $("status").textContent = "Failed to load data/cards.json";
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

init();
