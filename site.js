// site.js — shared navigation behavior (no card loading)

function $(id){ return document.getElementById(id); }

/* ==========================================================
   Synthetic “lowercaps” engine (same as card modal/grid)
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

    ".navBtn",
    ".ddBtn",
    ".ddMenu",
    ".ddItem",
    ".ddMenu a.ddLink",
    "#guideBtn",

    ".pagePanel h1",
    ".pagePanel h2",
    ".mapTitle",
    ".iconSectionTitle"
  ].join(",");

  // querySelectorAll() does not include the root element itself
  if(root instanceof Element && root.matches(sel)){
    root.classList.add("efLowercaps");
  }
  root.querySelectorAll(sel).forEach(el => el.classList.add("efLowercaps"));
}

function applyLowercaps(root = document){
  markLowercaps(root);

  const set = new Set();
  if(root instanceof Element && root.classList.contains("efLowercaps")) set.add(root);
  root.querySelectorAll(".efLowercaps").forEach(el => set.add(el));

  for(const el of set){
    if(el.querySelector(".capInit")) continue; // avoid re-wrapping
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

document.addEventListener("DOMContentLoaded", ()=>{
  initClickMenu("guideBtn","guideMenu");
  applyLowercaps(document);
});
