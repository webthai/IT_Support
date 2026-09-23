const SHEET_NAME = "Web_ITSup";
const ADMINS_SHEET = "Admins";
const LOGS_SHEET = "Logs";
const HISTORY_SHEET = "ItemHistory";
const COMMENTS_SHEET = "Comments";
const USERS_SHEET = "Users";
const QUICKLOG_SHEET = "QuickLog";

// Web_ITSup column order:
// 1 ID | 2 Category | 3 SubCategory | 4 Title | 5 Description | 6 CodeContent
// 7 UpdatedDate | 8 Pinned | 9 Badge | 10 UpVotes | 11 DownVotes | 12 ItemType

function getSheet(){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME); }
function getAdminsSheet(){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ADMINS_SHEET); }
function getLogsSheet(){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOGS_SHEET); }
function getHistorySheet(){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HISTORY_SHEET); }
function getCommentsSheet(){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COMMENTS_SHEET); }
function getUsersSheet(){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET); }
function getQuickLogSheet(){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(QUICKLOG_SHEET); }

function doGet(e){
  const action = e.parameter.action;
  if(action === "getData")     return jsonResponse({ status:"ok", data: getAllData() });
  if(action === "publicData")  return jsonResponse({ status:"ok", data: getAllData() });
  if(action === "exportAll")   return jsonResponse({ status:"ok", data: getAllData() });
  if(action === "getStats")    return jsonResponse({ status:"ok", data: getStats() });
  if(action === "getHistory")  return jsonResponse({ status:"ok", data: getHistory(e.parameter.itemId) });
  if(action === "getComments") return jsonResponse({ status:"ok", data: getAllComments() });
  if(action === "getQuickLog") return jsonResponse({ status:"ok", data: getQuickLog() });
  if(action === "ipLookup")    return jsonResponse(ipLookup(e.parameter.ip));
  if(action === "uptimeStatus")return jsonResponse(getUptimeStatus());
  return jsonResponse({ status:"error", message:"invalid action" });
}

function doPost(e){
  const body = JSON.parse(e.postData.contents);
  const action = body.action;

  if(action === "login")           return jsonResponse(handleLogin(body));
  if(action === "teamLogin")       return jsonResponse(handleTeamLogin(body));
  if(action === "addItem")         return jsonResponse(handleAdd(body));
  if(action === "updateItem")      return jsonResponse(handleUpdate(body));
  if(action === "deleteItem")      return jsonResponse(handleDelete(body));
  if(action === "logCopy")         return jsonResponse(handleLogCopy(body));
  if(action === "importItems")     return jsonResponse(handleImport(body));
  if(action === "revertVersion")   return jsonResponse(handleRevert(body));
  if(action === "addComment")      return jsonResponse(handleAddComment(body));
  if(action === "voteItem")        return jsonResponse(handleVote(body));
  if(action === "addQuickLog")     return jsonResponse(handleAddQuickLog(body));
  if(action === "virusTotalCheck") return jsonResponse(virusTotalCheck(body.url));

  return jsonResponse({ status:"error", message:"invalid action" });
}

// ---- Auth: Admin ----
function hashPassword(pw){
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw);
  const hash = raw.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2,"0")).join("");
  Logger.log(hash);
  return hash;
}
function sha256Hex(pw){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw)
    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2,"0")).join("");
}
function handleLogin(body){
  const sheet = getAdminsSheet();
  const values = sheet.getDataRange().getValues();
  const inputHash = sha256Hex(body.password);
  for(let i=1;i<values.length;i++){
    if(values[i][0] === body.username && values[i][1] === inputHash){
      return { status:"ok", role: values[i][2] || "Editor" };
    }
  }
  return { status:"error", message:"invalid credentials" };
}
function handleTeamLogin(body){
  const sheet = getUsersSheet();
  if(!sheet) return { status:"error", message:"Users sheet not set up" };
  const values = sheet.getDataRange().getValues();
  const inputHash = sha256Hex(body.password);
  for(let i=1;i<values.length;i++){
    if(values[i][0] === body.username && values[i][1] === inputHash){
      return { status:"ok" };
    }
  }
  return { status:"error", message:"invalid credentials" };
}

// ---- Core Items ----
function getAllData(){
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);
  return rows.filter(r => r[0] !== "").map(r=>{
    const obj = {};
    headers.forEach((h,i)=> obj[h] = r[i]);
    return obj;
  });
}
function handleAdd(body){
  const sheet = getSheet();
  const id = Utilities.getUuid();
  sheet.appendRow([
    id, body.category, body.subCategory || "", body.title, body.description, body.codeContent,
    new Date().toISOString(), body.pinned ? true : false, body.badge || "", 0, 0, body.itemType || "code"
  ]);
  logAction("add", id, body.title, body.username || "");
  sendNotification(`➕ เพิ่มรายการใหม่: ${body.title} (${body.category})`);
  return { status:"ok", id };
}
function handleUpdate(body){
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  for(let i=1;i<values.length;i++){
    if(values[i][0] === body.id){
      snapshotHistory(values[i]);
      sheet.getRange(i+1,2,1,6).setValues([[
        body.category, body.subCategory || "", body.title, body.description, body.codeContent, new Date().toISOString()
      ]]);
      sheet.getRange(i+1,8,1,2).setValues([[ body.pinned ? true : false, body.badge || "" ]]);
      sheet.getRange(i+1,12).setValue(body.itemType || "code");
      logAction("edit", body.id, body.title, body.username || "");
      sendNotification(`✏️ แก้ไขรายการ: ${body.title}`);
      return { status:"ok" };
    }
  }
  return { status:"error", message:"not found" };
}
function handleDelete(body){
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  for(let i=1;i<values.length;i++){
    if(values[i][0] === body.id){
      const title = values[i][3];
      sheet.deleteRow(i+1);
      logAction("delete", body.id, title, body.username || "");
      return { status:"ok" };
    }
  }
  return { status:"error", message:"not found" };
}
function handleImport(body){
  const sheet = getSheet();
  const items = body.items || [];
  items.forEach(it=>{
    sheet.appendRow([
      Utilities.getUuid(), it.category || "", it.subCategory || "", it.title || "",
      it.description || "", it.codeContent || "", new Date().toISOString(), false, "", 0, 0, "code"
    ]);
  });
  logAction("import", "", `${items.length} items`, body.username || "");
  return { status:"ok", imported: items.length };
}

// ---- Logs ----
function logAction(action, itemId, itemTitle, user){
  const sheet = getLogsSheet();
  if(!sheet) return;
  sheet.appendRow([new Date().toISOString(), action, itemId, itemTitle, user || ""]);
}
function handleLogCopy(body){
  logAction("copy", body.id, body.title || "", body.username || "");
  return { status:"ok" };
}

// ---- Version History ----
function snapshotHistory(oldRow){
  const sheet = getHistorySheet();
  if(!sheet) return;
  sheet.appendRow([ new Date().toISOString(), oldRow[0], oldRow[1], oldRow[2], oldRow[3], oldRow[4], oldRow[5] ]);
}
function getHistory(itemId){
  const sheet = getHistorySheet();
  if(!sheet) return [];
  const rows = sheet.getDataRange().getValues().slice(1);
  return rows.filter(r => r[1] === itemId)
    .sort((a,b)=> new Date(b[0]) - new Date(a[0]))
    .map(r => ({ timestamp:r[0], category:r[2], subCategory:r[3], title:r[4], description:r[5], codeContent:r[6] }));
}
function handleRevert(body){
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const histSheet = getHistorySheet();
  const histRows = histSheet.getDataRange().getValues().slice(1);
  const snap = histRows.find(r => r[1] === body.id && r[0] === body.timestamp);
  if(!snap) return { status:"error", message:"version not found" };
  for(let i=1;i<values.length;i++){
    if(values[i][0] === body.id){
      snapshotHistory(values[i]);
      sheet.getRange(i+1,2,1,6).setValues([[ snap[2], snap[3], snap[4], snap[5], snap[6], new Date().toISOString() ]]);
      logAction("revert", body.id, snap[4], body.username || "");
      return { status:"ok" };
    }
  }
  return { status:"error", message:"item not found" };
}

// ---- Team Comments ----
function getAllComments(){
  const sheet = getCommentsSheet();
  if(!sheet) return [];
  return sheet.getDataRange().getValues().slice(1)
    .map(r => ({ timestamp:r[0], itemId:r[1], username:r[2], comment:r[3] }));
}
function handleAddComment(body){
  const sheet = getCommentsSheet();
  if(!sheet) return { status:"error", message:"Comments sheet not set up" };
  sheet.appendRow([new Date().toISOString(), body.itemId, body.username || "ไม่ระบุชื่อ", body.comment || ""]);
  return { status:"ok" };
}

// ---- Rating ----
function handleVote(body){
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const col = body.vote === "down" ? 11 : 10;
  for(let i=1;i<values.length;i++){
    if(values[i][0] === body.id){
      const current = values[i][col-1] || 0;
      sheet.getRange(i+1, col).setValue(current + 1);
      return { status:"ok" };
    }
  }
  return { status:"error", message:"not found" };
}

// ---- Quick Log ----
function handleAddQuickLog(body){
  const sheet = getQuickLogSheet();
  if(!sheet) return { status:"error", message:"QuickLog sheet not set up" };
  sheet.appendRow([new Date().toISOString(), body.machine || "", body.note || "", body.username || ""]);
  return { status:"ok" };
}
function getQuickLog(){
  const sheet = getQuickLogSheet();
  if(!sheet) return [];
  return sheet.getDataRange().getValues().slice(1)
    .map(r => ({ timestamp:r[0], machine:r[1], note:r[2], user:r[3] }))
    .sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp)).slice(0,50);
}

// ---- Notification (Phase 3 #17 + Phase 5 #25 — multi-channel) ----
// Enable any of these by setting the matching Script Properties key. All optional, all skip silently if unset.
function sendNotification(text){
  sendDiscord(text);
  sendTelegram(text);
  sendLineMessaging(text);
}
function sendDiscord(text){
  const url = PropertiesService.getScriptProperties().getProperty("DISCORD_WEBHOOK_URL");
  if(!url) return;
  try{
    UrlFetchApp.fetch(url, { method:"post", contentType:"application/json",
      payload: JSON.stringify({ content:text }), muteHttpExceptions:true });
  }catch(err){}
}
function sendTelegram(text){
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("TELEGRAM_BOT_TOKEN");
  const chatId = props.getProperty("TELEGRAM_CHAT_ID");
  if(!token || !chatId) return;
  try{
    UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:"post", contentType:"application/json",
      payload: JSON.stringify({ chat_id: chatId, text: text }), muteHttpExceptions:true
    });
  }catch(err){}
}
function sendLineMessaging(text){
  // LINE Notify was discontinued Mar 2025 — this uses LINE Messaging API (push message) instead.
  // Requires a LINE Official Account + Channel Access Token + target user/group ID.
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  const targetId = props.getProperty("LINE_TARGET_ID");
  if(!token || !targetId) return;
  try{
    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
      method:"post", contentType:"application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify({ to: targetId, messages:[{ type:"text", text }] }),
      muteHttpExceptions:true
    });
  }catch(err){}
}

// ---- IP Geolocation (Phase 5 #30) — proxied through Apps Script to avoid client-side CORS/mixed-content issues ----
function ipLookup(ip){
  try{
    const res = UrlFetchApp.fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { muteHttpExceptions:true });
    return { status:"ok", data: JSON.parse(res.getContentText()) };
  }catch(err){
    return { status:"error", message: String(err) };
  }
}

// ---- UptimeRobot (Phase 5 #26) ----
// Set Script Properties key UPTIMEROBOT_API_KEY (Main API Key from UptimeRobot dashboard).
function getUptimeStatus(){
  const apiKey = PropertiesService.getScriptProperties().getProperty("UPTIMEROBOT_API_KEY");
  if(!apiKey) return { status:"error", message:"UPTIMEROBOT_API_KEY not set in Script Properties" };
  try{
    const res = UrlFetchApp.fetch("https://api.uptimerobot.com/v2/getMonitors", {
      method:"post", contentType:"application/x-www-form-urlencoded",
      payload: `api_key=${apiKey}&format=json`, muteHttpExceptions:true
    });
    const data = JSON.parse(res.getContentText());
    const monitors = (data.monitors || []).map(m => ({
      name: m.friendly_name, url: m.url, status: m.status // 2 = up, 9 = down
    }));
    return { status:"ok", data: monitors };
  }catch(err){
    return { status:"error", message: String(err) };
  }
}

// ---- VirusTotal (Phase 5 #28) ----
// Set Script Properties key VIRUSTOTAL_API_KEY.
function virusTotalCheck(url){
  const apiKey = PropertiesService.getScriptProperties().getProperty("VIRUSTOTAL_API_KEY");
  if(!apiKey) return { status:"error", message:"VIRUSTOTAL_API_KEY not set in Script Properties" };
  try{
    const urlId = Utilities.base64EncodeWebSafe(url).replace(/=+$/,"");
    const res = UrlFetchApp.fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { "x-apikey": apiKey }, muteHttpExceptions:true
    });
    if(res.getResponseCode() === 404){
      // Not scanned yet — submit it for analysis, then ask the user to check again shortly.
      UrlFetchApp.fetch("https://www.virustotal.com/api/v3/urls", {
        method:"post", headers:{ "x-apikey":apiKey },
        payload: { url }, muteHttpExceptions:true
      });
      return { status:"pending", message:"ส่งไปสแกนแล้ว — ลองเช็คอีกครั้งใน 1-2 นาที" };
    }
    const data = JSON.parse(res.getContentText());
    const stats = data.data.attributes.last_analysis_stats;
    return { status:"ok", data: stats }; // {malicious, suspicious, harmless, undetected, timeout}
  }catch(err){
    return { status:"error", message: String(err) };
  }
}

// ---- Phase 5 #27 & #32: OAuth-based integrations (templates — need extra setup) ----
// Google Workspace Admin SDK requires enabling the "Admin SDK API" advanced service in
// Apps Script (Services > Admin SDK) and domain-wide delegation. Once enabled:
function listWorkspaceUsers(domain){
  // return AdminDirectory.Users.list({ domain: domain, maxResults: 50 });
  return { status:"error", message:"Enable Admin SDK advanced service first, then uncomment the call above." };
}

// Microsoft Graph API requires an Azure AD App Registration (client ID/secret, tenant ID)
// and an OAuth2 token exchange — the OAuth2 for Apps Script library is the easiest way:
// https://github.com/googleworkspace/apps-script-oauth2
function getGraphUserInfo(accessToken){
  // Pass a valid Graph access token obtained via the OAuth2 library above.
  try{
    const res = UrlFetchApp.fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: "Bearer " + accessToken }, muteHttpExceptions:true
    });
    return { status:"ok", data: JSON.parse(res.getContentText()) };
  }catch(err){
    return { status:"error", message: String(err) };
  }
}

// Freshservice / Jira Service Management — placeholder, fill in your domain + API key when scoped.
function fetchTickets(){
  // const res = UrlFetchApp.fetch("https://YOURDOMAIN.freshservice.com/api/v2/tickets", {
  //   headers: { Authorization: "Basic " + Utilities.base64Encode(API_KEY + ":X") }
  // });
  return { status:"error", message:"Not yet scoped — fill in domain/API key when ready to use this." };
}

// ---- Admin Dashboard Stats ----
function getStats(){
  const items = getAllData();
  const categories = new Set(items.map(i=>i.Category)).size;
  let copyCounts = {};
  const logsSheet = getLogsSheet();
  let recentEdits = [];
  if(logsSheet){
    const logs = logsSheet.getDataRange().getValues().slice(1);
    logs.forEach(r=>{ if(r[1] === "copy") copyCounts[r[2]] = (copyCounts[r[2]]||0) + 1; });
    recentEdits = logs.filter(r => r[1] === "edit" || r[1] === "add")
      .sort((a,b)=> new Date(b[0]) - new Date(a[0])).slice(0,5)
      .map(r => ({ time:r[0], action:r[1], title:r[3] }));
  }
  const unused = items.filter(i => !copyCounts[i.ID]).map(i=>i.Title);
  return { totalCategories: categories, totalItems: items.length, unusedItems: unused, recentEdits: recentEdits };
}

function jsonResponse(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
