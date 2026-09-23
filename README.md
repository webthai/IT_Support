# ITSup — IT Support Hub

## Current Version
v5.0.0 — Phase 1-5 เขียนโค้ดจริงครบแล้ว (ยกเว้นข้อ 15 Remote Execution ที่งดให้ด้วยเหตุผลความปลอดภัย)

## สถานะ
โค้ดทั้งหมดอยู่ในไฟล์แนบ พร้อม deploy หลังตั้งค่า Sheet/Script Properties ตาม "Setup Checklist" ด้านล่าง — ยังไม่เคย deploy จริงมาก่อน แนะนำให้ทดสอบทีละ Phase (เปิดใช้ Phase 1 ให้รันได้ก่อน แล้วค่อยเพิ่ม Sheet tab ทีละอันตาม Phase)

## ภาพรวมโปรเจกต์
เว็บ Hub รวบรวม code/script/checklist สำหรับงาน IT Support จัดกลุ่มตาม Category → Sub-category ผู้ใช้ทั่วไปดู + copy ได้ สมาชิกทีม (login แยก) คอมเมนต์ได้ Admin (2 ระดับ) จัดการเนื้อหา + ดู dashboard/tools ได้เต็มรูปแบบ

## Directory Tree
```
/
├── index.html
├── style.css
├── app.js
├── Code.gs        (deploy แยกบน Apps Script)
├── manifest.json  (PWA)
├── sw.js          (Service Worker — offline cache)
├── logo.jpg       (ต้องอัปโหลดเอง)
└── README.md
```
ทุกไฟล์อยู่ตำแหน่งเดียวกัน ไม่มีโฟลเดอร์ย่อย

## Config หลัก
| รายการ | ค่า |
|---|---|
| Web App URL | `https://script.google.com/macros/s/AKfycbwYWOmSkZHssBSlTpRKLANBEp3U4_JCjNFXPfIMdhq24R7NeKmF0nZExqeBdCum5dE6/exec` |
| Google Sheet | `Web_ITSup` |
| ASSET_DASHBOARD_URL (ใน app.js) | placeholder — ต้องแก้เป็น URL จริงของโปรเจกต์ IT Asset Dashboard |
| Theme | True Black + Light mode toggle |

## Setup Checklist (ทำตามลำดับ)

**1. Sheet `Web_ITSup` — เนื้อหาหลัก (11 คอลัมน์)**
```
ID, Category, SubCategory, Title, Description, CodeContent, UpdatedDate, Pinned, Badge, UpVotes, DownVotes, ItemType
```
(`ItemType` = `code` หรือ `checklist`)

**2. Sheet tab เพิ่มเติม (สร้างทีละ Phase ตามต้องการ)**
| Tab | Columns | ใช้กับ |
|---|---|---|
| `Admins` | Username, PasswordHash, Role | Multi-level admin (SuperAdmin/Editor) |
| `Logs` | Timestamp, Action, ItemID, ItemTitle, User | Usage history, Admin Dashboard |
| `ItemHistory` | Timestamp, ItemID, Category, SubCategory, Title, Description, CodeContent | Version history/revert |
| `Comments` | Timestamp, ItemID, Username, Comment | Team comments |
| `Users` | Username, PasswordHash | Team login (แยกจาก Admin) |
| `QuickLog` | Timestamp, Machine, Note, User | Quick Log (งานที่แก้วันนี้) |

**3. สร้าง Admin account แรก**
- เปิด Apps Script Editor → เลือกฟังก์ชัน `hashPassword` → พิมพ์ `hashPassword("5340")` ใน console หรือรันแล้วดู Logger.log
- copy hash ที่ได้ → ใส่แถวใน Sheet `Admins`: `meen | <hash> | SuperAdmin`
- ทำแบบเดียวกันกับ Sheet `Users` ถ้าต้องการให้สมาชิกทีมคอมเมนต์ได้

**4. Script Properties (Apps Script → Project Settings → Script Properties)**
| Key | จำเป็นสำหรับ | บังคับ/ไม่บังคับ |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | แจ้งเตือนผ่าน Discord | ไม่บังคับ |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | แจ้งเตือนผ่าน Telegram | ไม่บังคับ |
| `LINE_CHANNEL_ACCESS_TOKEN` + `LINE_TARGET_ID` | แจ้งเตือนผ่าน LINE (Messaging API — LINE Notify ยุติแล้ว) | ไม่บังคับ |
| `UPTIMEROBOT_API_KEY` | Admin Tools → Uptime status | ไม่บังคับ |
| `VIRUSTOTAL_API_KEY` | Admin Tools → VirusTotal check | ไม่บังคับ |

ไม่ตั้งค่าตัวไหนก็ข้ามฟีเจอร์นั้นไปเงียบๆ ไม่กระทบส่วนอื่น

**5. แก้ `ASSET_DASHBOARD_URL`** ในบรรทัดบนสุดของ `app.js` เป็น URL จริงของโปรเจกต์ IT Asset Dashboard

**6. อัปโหลด `logo.jpg`** เข้า repo เอง (ชื่อไฟล์ fixed)

**7. Deploy Code.gs เป็น Web App** — Execute as: Me, Who has access: Anyone

## ฟีเจอร์ทั้งหมด (32 ข้อ — เขียนโค้ดจริงแล้ว 31 ข้อ)

**Core (Phase 1)** — Category/Item CRUD, Admin login (server-side), View + Copy สำหรับ user ทั่วไป

**Phase 2** — Search/Filter, Favorite (localStorage), Usage Log, Multi-level Admin, Export/Import CSV, Pin & Badge, Syntax Highlighting (highlight.js), PWA (manifest+Service Worker), Personal Notes, Admin Dashboard

**Phase 3** — TH/EN Toggle, Version History + Revert, Team Comments (login แยก), Sub-category, ~~Remote Execution~~ (งดให้ — ความเสี่ยงสูง), Public Read-only API, Notification (Discord/Telegram/LINE), Rating, Dark/Light Toggle, Offline Mode

**Phase 4** — Quick Log, Checklist Template (ItemType), Asset Dashboard Quick Link, Quick Launch Shortcuts (ใช้โครงสร้างเดิม ไม่ต้องแก้โค้ด)

**Phase 5** — IP Geolocation (ipapi.co, ใช้ได้เลย), DNS Lookup (Cloudflare DoH, ใช้ได้เลย), VirusTotal Check (ต้องมี key), UptimeRobot Status (ต้องมี key), Google Workspace Admin SDK (template — ต้องตั้งค่า Advanced Service เพิ่ม), Microsoft Graph API (template — ต้องทำ Azure AD App Registration), Freshservice/Jira (placeholder — รอ scope ชัดเจน)

## Known Limitations
- CSV Import ใช้ simple `split(",")` — ไฟล์ที่มี comma อยู่ในเนื้อหาโค้ดจะ parse ผิด แนะนำใช้ JSON export/import แทนถ้าเนื้อหามี comma เยอะ
- ข้อ 27, 29, 32 เป็น template ฟังก์ชัน ยังไม่ได้เชื่อมต่อจริง ต้อง setup credential เพิ่มก่อนใช้งาน
- ข้อ 15 (Remote Execution) ไม่มีโค้ดให้ — เป็นการตัดสินใจเรื่องความปลอดภัย แนะนำใช้เครื่องมือสำเร็จรูป (Intune/PDQ Deploy) แทน

## Workflow ที่ใช้
- เสนอแผน + ถามคำถามก่อนเขียนโค้ดเสมอ ยืนยันก่อนเริ่ม implement
- ส่งไฟล์เต็มทุกครั้งที่แก้ ไม่ตัดทอน, เช็ค syntax ทุกไฟล์ก่อนส่ง
- ไฟล์ binary (logo.jpg) ที่อัปโหลดแล้วไม่ต้องส่งซ้ำ
