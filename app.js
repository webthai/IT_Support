const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwYWOmSkZHssBSlTpRKLANBEp3U4_JCjNFXPfIMdhq24R7NeKmF0nZExqeBdCum5dE6/exec";

const ASSET_DASHBOARD_URL = "https://webthai.github.io/IT/";

let DATA = [];
let COMMENTS = [];
let isAdmin = sessionStorage.getItem("itsup_admin") === "1";
let adminRole = sessionStorage.getItem("itsup_role") || "";
let adminUser = sessionStorage.getItem("itsup_user") || "";
let isTeam = sessionStorage.getItem("itsup_team") === "1";
let teamUser = sessionStorage.getItem("itsup_team_user") || "";
let showFavOnly = false;
let searchTerm = "";

const el = id => document.getElementById(id);

function toast(msg){
  const t = el("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(()=>t.classList.add("hidden"), 1800);
}

async function apiGet(action, params){
  let url = `${WEBAPP_URL}?action=${action}`;
  if(params) Object.keys(params).forEach(k => url += `&${k}=${encodeURIComponent(params[k])}`);
  const res = await fetch(url);
  return res.json();
}
async function apiPost(payload){
  const res = await fetch(WEBAPP_URL, { method:"POST", body: JSON.stringify(payload) });
  return res.json();
}

el("assetLink").href = ASSET_DASHBOARD_URL;

// ---- i18n ----
const DICT = {
  th: { logout:"ออกจากระบบ", favorites:"รายการโปรด", export:"Export", import:"Import CSV",
        addCategory:"+ เพิ่มหัวข้อใหญ่", search:"ค้นหา...", login:"เข้าสู่ระบบ", cancel:"ยกเลิก" },
  en: { logout:"Logout", favorites:"Favorites", export:"Export", import:"Import CSV",
        addCategory:"+ Add Category", search:"Search...", login:"Login", cancel:"Cancel" }
};
let currentLang = localStorage.getItem("itsup_lang") || "th";
function applyLang(){
  document.querySelectorAll("[data-i18n]").forEach(elm=>{
    const key = elm.getAttribute("data-i18n");
    if(DICT[currentLang][key]) elm.textContent = DICT[currentLang][key];
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(elm=>{
    const key = elm.getAttribute("data-i18n-ph");
    if(DICT[currentLang][key]) elm.placeholder = DICT[currentLang][key];
  });
  el("langToggleBtn").textContent = currentLang === "th" ? "EN" : "TH";
}
el("langToggleBtn").onclick = ()=>{
  currentLang = currentLang === "th" ? "en" : "th";
  localStorage.setItem("itsup_lang", currentLang);
  applyLang();
};

// ---- Theme toggle ----
let currentTheme = localStorage.getItem("itsup_theme") || "dark";
function applyTheme(){
  document.documentElement.setAttribute("data-theme", currentTheme);
  el("themeToggleBtn").textContent = currentTheme === "dark" ? "☀" : "🌙";
}
el("themeToggleBtn").onclick = ()=>{
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("itsup_theme", currentTheme);
  applyTheme();
};

// ---- Offline banner ----
function updateOnlineStatus(){ el("offlineBanner").classList.toggle("hidden", navigator.onLine); }
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

function updateAdminUI(){
  el("adminBadge").classList.toggle("hidden", !isAdmin);
  el("logoutBtn").classList.toggle("hidden", !isAdmin);
  el("addCategoryBtn").classList.toggle("hidden", !isAdmin);
  el("adminIcon").classList.toggle("hidden", isAdmin);
  el("importBtn").classList.toggle("hidden", !isAdmin);
  el("dashboardBtn").classList.toggle("hidden", adminRole !== "SuperAdmin");
  el("toolsBtn").classList.toggle("hidden", adminRole !== "SuperAdmin");
  el("quickLogBtn").classList.toggle("hidden", !isAdmin);
  el("teamIcon").style.opacity = isTeam ? "1" : "0.4";
}

// ---- Favorites ----
function getFavorites(){ return JSON.parse(localStorage.getItem("itsup_favorites") || "[]"); }
function toggleFavorite(id){
  let favs = getFavorites();
  favs = favs.includes(id) ? favs.filter(f=>f!==id) : [...favs, id];
  localStorage.setItem("itsup_favorites", JSON.stringify(favs));
  render();
}

// ---- Personal Notes ----
function getNote(id){ return (JSON.parse(localStorage.getItem("itsup_notes") || "{}"))[id] || ""; }
function saveNote(id, text){
  const notes = JSON.parse(localStorage.getItem("itsup_notes") || "{}");
  notes[id] = text;
  localStorage.setItem("itsup_notes", JSON.stringify(notes));
}

// ---- Checklist check-state ----
function getChecklistState(id){ return (JSON.parse(localStorage.getItem("itsup_checklist") || "{}"))[id] || {}; }
function toggleChecklistLine(id, idx){
  const all = JSON.parse(localStorage.getItem("itsup_checklist") || "{}");
  if(!all[id]) all[id] = {};
  all[id][idx] = !all[id][idx];
  localStorage.setItem("itsup_checklist", JSON.stringify(all));
}

// ---- Grouping ----
function groupByCategory(items){
  const map = {};
  items.forEach(it=>{
    if(!map[it.Category]) map[it.Category] = {};
    const sub = it.SubCategory || "__none__";
    if(!map[it.Category][sub]) map[it.Category][sub] = [];
    map[it.Category][sub].push(it);
  });
  Object.keys(map).forEach(cat=>{
    Object.keys(map[cat]).forEach(sub=>{
      map[cat][sub].sort((a,b)=> (b.Pinned === true) - (a.Pinned === true));
    });
  });
  return map;
}

function applyFilters(items){
  let result = items;
  if(showFavOnly){
    const favs = getFavorites();
    result = result.filter(i => favs.includes(i.ID));
  }
  if(searchTerm.trim()){
    const q = searchTerm.trim().toLowerCase();
    result = result.filter(i =>
      (i.Title||"").toLowerCase().includes(q) ||
      (i.Description||"").toLowerCase().includes(q) ||
      (i.CodeContent||"").toLowerCase().includes(q) ||
      (i.Category||"").toLowerCase().includes(q)
    );
  }
  return result;
}

function render(){
  const filtered = applyFilters(DATA);
  const grouped = groupByCategory(filtered);
  const container = el("categoryList");
  container.innerHTML = "";

  if(Object.keys(grouped).length === 0){
    container.innerHTML = `<div class="item-desc">ไม่พบรายการ</div>`;
    return;
  }

  Object.keys(grouped).forEach(cat=>{
    const block = document.createElement("div");
    block.className = "category-block";

    const header = document.createElement("div");
    header.className = "category-header";
    header.innerHTML = `<span class="category-title">${escapeHtml(cat)}</span>`;

    const actions = document.createElement("div");
    actions.className = "category-actions";
    if(isAdmin){
      const addBtn = document.createElement("button");
      addBtn.textContent = "+ เพิ่มรายการ";
      addBtn.onclick = (e)=>{ e.stopPropagation(); openItemModal(null, cat); };
      actions.appendChild(addBtn);
    }
    header.appendChild(actions);

    const body = document.createElement("div");
    header.onclick = ()=> body.classList.toggle("hidden");

    const subMap = grouped[cat];
    Object.keys(subMap).forEach(sub=>{
      if(sub !== "__none__"){
        const subLabel = document.createElement("div");
        subLabel.className = "subcategory-label";
        subLabel.textContent = sub;
        body.appendChild(subLabel);
      }
      subMap[sub].forEach(item => body.appendChild(renderItem(item)));
    });

    block.appendChild(header);
    block.appendChild(body);
    container.appendChild(block);
  });

  if(window.hljs){
    document.querySelectorAll(".item-code").forEach(b => hljs.highlightElement(b));
  }
}

function renderItem(item){
  const favs = getFavorites();
  const isFav = favs.includes(item.ID);
  const up = item.UpVotes || 0;
  const down = item.DownVotes || 0;
  const isChecklist = item.ItemType === "checklist";

  const card = document.createElement("div");
  card.className = "item-card";

  let contentHtml;
  if(isChecklist){
    const state = getChecklistState(item.ID);
    const lines = (item.CodeContent || "").split(/\r?\n/).filter(l=>l.trim());
    contentHtml = `<ul class="checklist">` + lines.map((line,idx)=>`
      <li><input type="checkbox" data-idx="${idx}" ${state[idx] ? "checked" : ""}> <span>${escapeHtml(line)}</span></li>
    `).join("") + `</ul>`;
  } else {
    contentHtml = `<pre class="item-code">${escapeHtml(item.CodeContent || "")}</pre>`;
  }

  card.innerHTML = `
    <div class="item-title">
      ${item.Pinned ? '<span class="pin-flag">📌</span>' : ''}
      ${escapeHtml(item.Title)}
      ${item.Badge ? `<span class="badge-tag">${escapeHtml(item.Badge)}</span>` : ''}
    </div>
    <div class="item-desc">${escapeHtml(item.Description || "")}</div>
    ${contentHtml}
  `;

  if(isChecklist){
    card.querySelectorAll('.checklist input[type="checkbox"]').forEach(cb=>{
      cb.onchange = ()=> toggleChecklistLine(item.ID, cb.getAttribute("data-idx"));
    });
  }

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const favBtn = document.createElement("button");
  favBtn.className = "btn-fav";
  favBtn.textContent = isFav ? "★" : "☆";
  favBtn.onclick = ()=> toggleFavorite(item.ID);
  actions.appendChild(favBtn);

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn-copy";
  copyBtn.textContent = "Copy";
  copyBtn.onclick = ()=>{
    navigator.clipboard.writeText(item.CodeContent || "");
    toast("คัดลอกแล้ว");
    apiPost({ action:"logCopy", id:item.ID, title:item.Title, username:adminUser });
  };
  actions.appendChild(copyBtn);

  if(!isChecklist){
    const downloadBtn = document.createElement("button");
    downloadBtn.className = "btn-download";
    downloadBtn.textContent = "Download";
    downloadBtn.onclick = ()=> downloadItemAsFile(item);
    actions.appendChild(downloadBtn);
  }

  if(isAdmin){
    const editBtn = document.createElement("button");
    editBtn.className = "btn-edit";
    editBtn.textContent = "Edit";
    editBtn.onclick = ()=> openItemModal(item);
    actions.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete";
    delBtn.textContent = "ลบ";
    delBtn.onclick = ()=> deleteItem(item.ID);
    actions.appendChild(delBtn);

    const histBtn = document.createElement("button");
    histBtn.className = "btn-history";
    histBtn.textContent = "History";
    histBtn.onclick = ()=> openHistoryModal(item);
    actions.appendChild(histBtn);
  }

  const ratingRow = document.createElement("div");
  ratingRow.className = "rating-row";
  const voted = JSON.parse(localStorage.getItem("itsup_voted")||"[]").includes(item.ID);
  ratingRow.innerHTML = `<span>👍 ${up}</span><span>👎 ${down}</span>`;
  if(!voted){
    const upBtn = document.createElement("button");
    upBtn.textContent = "ใช้ได้ผล";
    upBtn.onclick = ()=> vote(item.ID, "up");
    const downBtn = document.createElement("button");
    downBtn.textContent = "ใช้ไม่ได้";
    downBtn.onclick = ()=> vote(item.ID, "down");
    ratingRow.appendChild(upBtn);
    ratingRow.appendChild(downBtn);
  }
  actions.appendChild(ratingRow);

  card.appendChild(actions);

  const notesBox = document.createElement("textarea");
  notesBox.className = "notes-box";
  notesBox.rows = 2;
  notesBox.placeholder = "โน้ตส่วนตัว (เก็บเฉพาะเครื่องนี้)";
  notesBox.value = getNote(item.ID);
  notesBox.onchange = ()=> saveNote(item.ID, notesBox.value);
  card.appendChild(notesBox);

  const commentsBlock = document.createElement("div");
  commentsBlock.className = "comments-block";
  const itemComments = COMMENTS.filter(c => c.itemId === item.ID);
  commentsBlock.innerHTML = itemComments.map(c =>
    `<div class="comment-line"><b>${escapeHtml(c.username)}:</b> ${escapeHtml(c.comment)}</div>`
  ).join("") || `<div class="comment-line">ยังไม่มีคอมเมนต์</div>`;
  if(isTeam){
    const row = document.createElement("div");
    row.className = "comment-input-row";
    const input = document.createElement("input");
    input.placeholder = "แสดงความคิดเห็น...";
    const sendBtn = document.createElement("button");
    sendBtn.textContent = "ส่ง";
    sendBtn.onclick = async ()=>{
      if(!input.value.trim()) return;
      await apiPost({ action:"addComment", itemId:item.ID, username:teamUser, comment:input.value.trim() });
      input.value = "";
      await loadComments();
      render();
    };
    row.appendChild(input);
    row.appendChild(sendBtn);
    commentsBlock.appendChild(row);
  }
  card.appendChild(commentsBlock);

  return card;
}

async function vote(id, type){
  await apiPost({ action:"voteItem", id, vote:type });
  let voted = JSON.parse(localStorage.getItem("itsup_voted")||"[]");
  voted.push(id);
  localStorage.setItem("itsup_voted", JSON.stringify(voted));
  loadData();
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// ---- Download as file — guesses the right extension from the category name ----
function guessExtension(category){
  const c = (category || "").toLowerCase();
  if(c.includes(".bat") || c.includes("bat ")) return "bat";
  if(c.includes("powershell")) return "ps1";
  if(c.includes("registry") || c.includes(".reg")) return "reg";
  if(c.includes("python")) return "py";
  return "txt";
}
function downloadItemAsFile(item){
  const ext = guessExtension(item.Category);
  const safeName = (item.Title || "script").replace(/[\\/:*?"<>|]/g, "_").trim() || "script";
  const blob = new Blob([item.CodeContent || ""], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`ดาวน์โหลด ${safeName}.${ext} แล้ว`);
}

async function loadData(){
  const res = await apiGet("getData");
  if(res.status === "ok"){ DATA = res.data; render(); }
}
async function loadComments(){
  const res = await apiGet("getComments");
  if(res.status === "ok"){ COMMENTS = res.data; }
}

el("searchInput").oninput = (e)=>{ searchTerm = e.target.value; render(); };
el("favToggleBtn").onclick = ()=>{
  showFavOnly = !showFavOnly;
  el("favToggleBtn").style.opacity = showFavOnly ? "1" : "0.6";
  render();
};

// ---- Admin Login ----
el("adminIcon").onclick = ()=> el("loginModal").classList.remove("hidden");
el("loginCancel").onclick = ()=>{ el("loginModal").classList.add("hidden"); el("loginError").classList.add("hidden"); };
el("loginSubmit").onclick = async ()=>{
  const username = el("loginUser").value.trim();
  const password = el("loginPass").value.trim();
  const res = await apiPost({ action:"login", username, password });
  if(res.status === "ok"){
    isAdmin = true; adminRole = res.role || "Editor"; adminUser = username;
    sessionStorage.setItem("itsup_admin","1");
    sessionStorage.setItem("itsup_role", adminRole);
    sessionStorage.setItem("itsup_user", adminUser);
    el("loginModal").classList.add("hidden");
    el("loginUser").value = ""; el("loginPass").value = "";
    el("loginError").classList.add("hidden");
    updateAdminUI(); render();
    toast("เข้าสู่ระบบสำเร็จ");
  } else {
    el("loginError").classList.remove("hidden");
  }
};
el("logoutBtn").onclick = ()=>{
  isAdmin = false; adminRole = ""; adminUser = "";
  sessionStorage.removeItem("itsup_admin");
  sessionStorage.removeItem("itsup_role");
  sessionStorage.removeItem("itsup_user");
  updateAdminUI(); render();
};

// ---- Team Login ----
el("teamIcon").onclick = ()=>{
  if(isTeam){
    isTeam = false; teamUser = "";
    sessionStorage.removeItem("itsup_team");
    sessionStorage.removeItem("itsup_team_user");
    updateAdminUI(); render();
    toast("ออกจากระบบทีมแล้ว");
    return;
  }
  el("teamLoginModal").classList.remove("hidden");
};
el("teamLoginCancel").onclick = ()=>{ el("teamLoginModal").classList.add("hidden"); el("teamLoginError").classList.add("hidden"); };
el("teamLoginSubmit").onclick = async ()=>{
  const username = el("teamUser").value.trim();
  const password = el("teamPass").value.trim();
  const res = await apiPost({ action:"teamLogin", username, password });
  if(res.status === "ok"){
    isTeam = true; teamUser = username;
    sessionStorage.setItem("itsup_team","1");
    sessionStorage.setItem("itsup_team_user", teamUser);
    el("teamLoginModal").classList.add("hidden");
    el("teamUser").value = ""; el("teamPass").value = "";
    updateAdminUI(); render();
    toast("เข้าสู่ระบบทีมสำเร็จ");
  } else {
    el("teamLoginError").classList.remove("hidden");
  }
};

// ---- Item Modal ----
function openItemModal(item, presetCategory){
  el("itemModalTitle").textContent = item ? "แก้ไขรายการ" : "เพิ่มรายการ";
  el("itemId").value = item ? item.ID : "";
  el("itemCategory").value = item ? item.Category : (presetCategory || "");
  el("itemSubCategory").value = item ? (item.SubCategory || "") : "";
  el("itemTitle").value = item ? item.Title : "";
  el("itemDesc").value = item ? item.Description : "";
  el("itemCode").value = item ? item.CodeContent : "";
  el("itemType").value = item ? (item.ItemType || "code") : "code";
  el("itemPinned").checked = item ? !!item.Pinned : false;
  el("itemBadge").value = item ? (item.Badge || "") : "";
  el("itemModal").classList.remove("hidden");
}
el("itemCancel").onclick = ()=> el("itemModal").classList.add("hidden");
el("itemSave").onclick = async ()=>{
  const id = el("itemId").value;
  const payload = {
    action: id ? "updateItem" : "addItem",
    id, category: el("itemCategory").value.trim(),
    subCategory: el("itemSubCategory").value.trim(),
    title: el("itemTitle").value.trim(),
    description: el("itemDesc").value.trim(),
    codeContent: el("itemCode").value,
    itemType: el("itemType").value,
    pinned: el("itemPinned").checked,
    badge: el("itemBadge").value.trim(),
    username: adminUser
  };
  if(!payload.category || !payload.title){ toast("กรอกหัวข้อใหญ่และหัวข้อย่อยให้ครบ"); return; }
  const res = await apiPost(payload);
  if(res.status === "ok"){ el("itemModal").classList.add("hidden"); toast("บันทึกสำเร็จ"); loadData(); }
  else toast("เกิดข้อผิดพลาด");
};
async function deleteItem(id){
  if(!confirm("ยืนยันการลบรายการนี้?")) return;
  const res = await apiPost({ action:"deleteItem", id, username: adminUser });
  if(res.status === "ok"){ toast("ลบแล้ว"); loadData(); }
}
el("addCategoryBtn").onclick = ()=> openItemModal(null, "");

// ---- Version History ----
async function openHistoryModal(item){
  el("historyModal").classList.remove("hidden");
  el("historyContent").textContent = "กำลังโหลด...";
  const res = await apiGet("getHistory", { itemId: item.ID });
  if(res.status !== "ok" || res.data.length === 0){
    el("historyContent").textContent = "ยังไม่มีประวัติการแก้ไข";
    return;
  }
  el("historyContent").innerHTML = res.data.map(h => `
    <div class="history-entry">
      <div><b>${escapeHtml(h.title)}</b> — ${escapeHtml(h.timestamp)}</div>
      <div class="item-desc">${escapeHtml(h.description)}</div>
      <button onclick="revertVersion('${item.ID}','${h.timestamp}')">ย้อนกลับไปเวอร์ชันนี้</button>
    </div>
  `).join("");
}
async function revertVersion(id, timestamp){
  if(!confirm("ยืนยันการย้อนกลับเวอร์ชันนี้?")) return;
  const res = await apiPost({ action:"revertVersion", id, timestamp, username: adminUser });
  if(res.status === "ok"){ toast("ย้อนกลับสำเร็จ"); el("historyModal").classList.add("hidden"); loadData(); }
  else toast("ย้อนกลับไม่สำเร็จ");
}
el("historyClose").onclick = ()=> el("historyModal").classList.add("hidden");

// ---- Export / Import ----
el("exportBtn").onclick = async ()=>{
  const res = await apiGet("exportAll");
  if(res.status !== "ok") { toast("Export ล้มเหลว"); return; }
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "itsup_export.json"; a.click();
  URL.revokeObjectURL(url);
};
el("importBtn").onclick = ()=> el("importFile").click();
el("importFile").onchange = async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  const headers = lines[0].split(",").map(h=>h.trim().toLowerCase());
  const items = lines.slice(1).map(line=>{
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h,i)=> obj[h] = (cols[i]||"").trim());
    return {
      category: obj.category || "", subCategory: obj.subcategory || "",
      title: obj.title || "", description: obj.description || "",
      codeContent: obj.codecontent || obj.code || ""
    };
  });
  const res = await apiPost({ action:"importItems", items, username: adminUser });
  if(res.status === "ok"){ toast(`นำเข้า ${res.imported} รายการสำเร็จ`); loadData(); }
  else toast("Import ล้มเหลว");
  e.target.value = "";
};

// ---- Admin Dashboard ----
el("dashboardBtn").onclick = async ()=>{
  el("dashboardModal").classList.remove("hidden");
  el("dashboardContent").textContent = "กำลังโหลด...";
  const res = await apiGet("getStats");
  if(res.status !== "ok"){ el("dashboardContent").textContent = "โหลดข้อมูลไม่สำเร็จ"; return; }
  const s = res.data;
  el("dashboardContent").innerHTML = `
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num">${s.totalCategories}</div><div class="stat-label">Categories</div></div>
      <div class="stat-box"><div class="stat-num">${s.totalItems}</div><div class="stat-label">Items ทั้งหมด</div></div>
    </div>
    <div class="item-title">รายการที่ยังไม่เคยถูก copy (${s.unusedItems.length})</div>
    <div class="item-desc">${s.unusedItems.slice(0,10).map(escapeHtml).join(", ") || "-"}</div>
    <div class="item-title" style="margin-top:10px">แก้ไข/เพิ่มล่าสุด</div>
    <div class="item-desc">${
      s.recentEdits.length
        ? s.recentEdits.map(r=>`${escapeHtml(r.action)}: ${escapeHtml(r.title)} (${escapeHtml(r.time)})`).join("<br>")
        : "ยังไม่มี Logs sheet หรือยังไม่มีข้อมูล"
    }</div>
  `;
};
el("dashboardClose").onclick = ()=> el("dashboardModal").classList.add("hidden");

// ---- Quick Log ----
el("quickLogBtn").onclick = async ()=>{
  el("quickLogModal").classList.remove("hidden");
  await refreshQuickLog();
};
el("qlCancel").onclick = ()=> el("quickLogModal").classList.add("hidden");
el("qlSave").onclick = async ()=>{
  const machine = el("qlMachine").value.trim();
  const note = el("qlNote").value.trim();
  if(!machine || !note){ toast("กรอกชื่อเครื่องและบันทึกให้ครบ"); return; }
  const res = await apiPost({ action:"addQuickLog", machine, note, username: adminUser });
  if(res.status === "ok"){
    toast("บันทึกแล้ว");
    el("qlMachine").value = ""; el("qlNote").value = "";
    await refreshQuickLog();
  } else {
    toast("บันทึกไม่สำเร็จ — เช็คว่าสร้าง Sheet tab QuickLog แล้วหรือยัง");
  }
};
async function refreshQuickLog(){
  el("qlHistory").textContent = "กำลังโหลด...";
  const res = await apiGet("getQuickLog");
  if(res.status !== "ok"){ el("qlHistory").textContent = "โหลดไม่สำเร็จ"; return; }
  el("qlHistory").innerHTML = res.data.map(l => `
    <div class="quicklog-entry"><b>${escapeHtml(l.machine)}</b> — ${escapeHtml(l.note)}
      <div class="item-desc">${escapeHtml(l.user)} · ${escapeHtml(l.timestamp)}</div>
    </div>
  `).join("") || "ยังไม่มีบันทึก";
}

// ---- Admin Tools (Phase 5) ----
el("toolsBtn").onclick = ()=> el("toolsModal").classList.remove("hidden");
el("toolsClose").onclick = ()=> el("toolsModal").classList.add("hidden");

// #30 IP Geolocation (routed through Code.gs to avoid CORS/mixed-content issues)
el("ipLookupBtn").onclick = async ()=>{
  const ip = el("ipInput").value.trim();
  if(!ip){ return; }
  el("ipResult").textContent = "กำลังค้นหา...";
  const res = await apiGet("ipLookup", { ip });
  if(res.status !== "ok"){ el("ipResult").textContent = "ค้นหาไม่สำเร็จ: " + (res.message||""); return; }
  const d = res.data;
  el("ipResult").textContent = `${d.ip || ip}\nISP: ${d.org || "-"}\nเมือง: ${d.city || "-"}, ${d.region || "-"}, ${d.country_name || "-"}`;
};

// #31 DNS-over-HTTPS (direct client-side fetch to Cloudflare)
el("dnsLookupBtn").onclick = async ()=>{
  const domain = el("dnsInput").value.trim();
  if(!domain){ return; }
  el("dnsResult").textContent = "กำลังค้นหา...";
  try{
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { "Accept": "application/dns-json" }
    });
    const data = await res.json();
    const answers = (data.Answer || []).map(a => `${a.name} → ${a.data}`).join("\n");
    el("dnsResult").textContent = answers || "ไม่พบ A record";
  }catch(err){
    el("dnsResult").textContent = "เกิดข้อผิดพลาด: " + err;
  }
};

// #28 VirusTotal
el("vtCheckBtn").onclick = async ()=>{
  const url = el("vtInput").value.trim();
  if(!url){ return; }
  el("vtResult").textContent = "กำลังเช็ค...";
  const res = await apiPost({ action:"virusTotalCheck", url });
  if(res.status === "error"){ el("vtResult").textContent = res.message; return; }
  if(res.status === "pending"){ el("vtResult").textContent = res.message; return; }
  const s = res.data;
  el("vtResult").textContent = `malicious: ${s.malicious} | suspicious: ${s.suspicious} | harmless: ${s.harmless} | undetected: ${s.undetected}`;
};

// #26 UptimeRobot
el("uptimeRefreshBtn").onclick = async ()=>{
  el("uptimeResult").textContent = "กำลังโหลด...";
  const res = await apiGet("uptimeStatus");
  if(res.status !== "ok"){ el("uptimeResult").textContent = res.message; return; }
  el("uptimeResult").textContent = res.data.map(m =>
    `${m.status === 2 ? "🟢" : "🔴"} ${m.name} — ${m.url}`
  ).join("\n") || "ไม่มี monitor";
};

// ---- PWA Service Worker ----
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=> navigator.serviceWorker.register("sw.js").catch(()=>{}));
}

// ---- Init ----
applyLang();
applyTheme();
updateOnlineStatus();
updateAdminUI();
loadData();
loadComments();
