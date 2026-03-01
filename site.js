// site.js — shared navigation behavior (no card loading)

function $(id){ return document.getElementById(id); }

/* ==========================================================
   Synthetic “lowercaps” engine (match index/app.js behavior)
   ========================================================== */

function wrapOriginalCapsInTextNodes(root){
  if(!root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node){
        const p = node.parentElement;
        if(!p) return NodeFilter.FILTER_REJECT;

        // Never re-wrap inside existing wrappers / exclusions
        if(p.closest(".capInit")) return NodeFilter.FILTER_REJECT;
        if(p.closest(".noCapRescue")) return NodeFilter.FILTER_REJECT;

        // Skip empty or already-normalized nodes
        const s = node.nodeValue;
        if(!s || !/[A-Z]/.test(s)) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodes = [];
  while(walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(node => {
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();

    for(let i=0;i<text.length;i++){
      const ch = text[i];
      if(ch >= "A" && ch <= "Z"){
        const span = document.createElement("span");
        span.className = "capInit";
        span.textContent = ch;
        frag.appendChild(span);
      }else{
        frag.appendChild(document.createTextNode(ch));
      }
    }

    node.parentNode.replaceChild(frag, node);
  });
}

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
    "#guideLabel"
  ].join(",");

  // IMPORTANT: querySelectorAll() does not include the root element itself.
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

/* ==========================================================
   Guide dropdown behavior
   ========================================================== */

function initClickMenu(btnId, menuId){
  const btn = $(btnId);
  const menu = $(menuId);
  if(!btn || !menu) return;

  function open(){
    // Close other menus (avoid overlapping dropdowns)
    const rm = $("rarityMenu"); if(rm) rm.hidden = true;
    const rb = $("rarityBtn"); if(rb) rb.setAttribute("aria-expanded","false");
    const tm = $("typeMenu"); if(tm) tm.hidden = true;
    const tb = $("typeBtn"); if(tb) tb.setAttribute("aria-expanded","false");

    menu.hidden = false;
    btn.setAttribute("aria-expanded","true");

    // Ensure menu items are lowercapped on non-index pages too.
    applyLowercaps(menu);
  }

  function close(){
    menu.hidden = true;
    btn.setAttribute("aria-expanded","false");
  }

  btn.addEventListener("click", (e)=>{
    e.stopPropagation();
    if(menu.hidden) open();
    else close();
  });

  menu.addEventListener("click", (e)=>{
    // Let links work, but don't bubble to document and instantly close other menus weirdly
    e.stopPropagation();
  });

  document.addEventListener("click", ()=> close());
  document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") close(); });
}



/* ==========================================================
   Image compare sliders (About the Project)
   ========================================================== */


function initImgCompare(root = document){
  root.querySelectorAll(".imgCompare").forEach((wrap)=>{
    const slider = wrap.querySelector(".imgCompareSlider");
    if(!slider) return;

    const set = (val)=>{
      const v = Math.max(0, Math.min(100, Number(val)));
      wrap.style.setProperty("--pos", v + "%");
    };

    // Start position
    const start = wrap.getAttribute("data-start");
    if(start != null && slider.value === "50"){
      slider.value = start;
    }
    set(slider.value);

    slider.addEventListener("input", ()=> set(slider.value));
    slider.addEventListener("change", ()=> set(slider.value));
  });
}


/* ==========================================================
   Ensure "Attunement Codex" exists in Guide dropdown
   (so we don't have to hand-edit every page header)
   ========================================================== */

function ensureGuideAttunementLink(){
  const menu = $("guideMenu");
  if(!menu) return;

  // If the old link exists, upgrade it in-place (keeps order, avoids duplicates).
  const legacy = menu.querySelector('a.ddLink[href="confluence-codex.html"]');
  if(legacy){
    legacy.href = "attunement-codex.html";
    legacy.textContent = "Attunement Codex";
    legacy.setAttribute("role","menuitem");
    return;
  }

  // Already present?
  const existing = menu.querySelector('a.ddLink[href="attunement-codex.html"]');
  if(existing) return;

  const a = document.createElement("a");
  a.className = "ddLink";
  a.setAttribute("role", "menuitem");
  a.href = "attunement-codex.html";
  a.textContent = "Attunement Codex";

  // Insert after ElderForge Campaign if possible, otherwise append.
  const after = menu.querySelector('a.ddLink[href="campaign-setup.html"]');
  if(after){
    after.insertAdjacentElement("afterend", a);
  }else{
    menu.appendChild(a);
  }
}

/* ==========================================================
   Ensure "Poker Dice Stratagem" exists in Guide dropdown
   ========================================================== */

function ensureGuidePokerDiceStratagemLink(){
  const menu = $("guideMenu");
  if(!menu) return;

  // Already present?
  const existing = menu.querySelector('a.ddLink[href="poker-dice-stratagem.html"]');
  if(existing) return;

  const a = document.createElement("a");
  a.className = "ddLink";
  a.setAttribute("role", "menuitem");
  a.href = "poker-dice-stratagem.html";
  a.textContent = "Poker Dice Stratagem";

  // Insert after Basic Rules if possible, otherwise append.
  const after = menu.querySelector('a.ddLink[href="basic-rules.html"]');
  if(after){
    after.insertAdjacentElement("afterend", a);
  }else{
    menu.appendChild(a);
  }
}
document.addEventListener("DOMContentLoaded", ()=>{
  ensureGuideAttunementLink();
  ensureGuidePokerDiceStratagemLink();
  initClickMenu("guideBtn","guideMenu");
  initImgCompare(document);
  applyLowercaps(document);
});
