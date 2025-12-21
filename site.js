// site.js — shared navigation behavior for all pages (no card loading)

function $(id){ return document.getElementById(id); }

/* ==========================================================
   Synthetic “lowercaps” engine
   - CSS sets all-small-caps on .efLowercaps
   - JS wraps ORIGINAL uppercase letters with <span class="capInit">…</span>
   ========================================================== */

function wrapOriginalCapsInTextNodes(root){
  if(!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while(walker.nextNode()){
    const node = walker.currentNode;
    const p = node.parentElement;
    if(!p) continue;
    if(p.closest('.capInit')) continue;
    if(p.closest('.noCapRescue')) continue;
    nodes.push(node);
  }

  for(const node of nodes){
    const txt = node.nodeValue || "";
    if(!txt) continue;
    if(!/\p{Lu}/u.test(txt)) continue;

    const wrapped = txt.replace(/(\p{Lu})/gu, (m, cap) => {
      return `<span class="capInit">${cap}</span>`;
    });
    if(wrapped === txt) continue;

    const span = document.createElement('span');
    span.innerHTML = wrapped;
    node.parentNode.replaceChild(span, node);
  }
}

function markLowercaps(root = document){
  // Keep this selector list in sync with app.js
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

    "#status"
  ].join(",");

  // querySelectorAll() doesn't include the root itself
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
    // Avoid rewrapping if already wrapped
    if(el.querySelector?.('.capInit')) continue;
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
    // Close other menus when present (index page)
    const rm = $("rarityMenu"); if(rm) rm.hidden = true;
    const rb = $("rarityBtn");  if(rb) rb.setAttribute("aria-expanded","false");
    const tm = $("typeMenu");   if(tm) tm.hidden = true;
    const tb = $("typeBtn");    if(tb) tb.setAttribute("aria-expanded","false");

    menu.hidden = false;
    btn.setAttribute("aria-expanded","true");

    // Ensure any dynamically revealed menu items are lowercapped
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
    e.stopPropagation();
  });

  document.addEventListener("click", ()=> close());
  document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") close(); });
}

document.addEventListener("DOMContentLoaded", ()=>{
  initClickMenu("guideBtn","guideMenu");
  applyLowercaps(document);
});
