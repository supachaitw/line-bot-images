# Bitkub — สถานะโปรเจกต์ (12 ส.ค. 2569)

> ตรวจสถานะจากข้อมูลจริงที่ workflow เขียนลง Notion + repo บน GitLab
> เอกสารนี้เป็น snapshot ของวันที่ตรวจ ไม่ใช่เอกสารออกแบบ — ของออกแบบอยู่ใน Notion หน้า Phase 1 / Phase 2

---

## 1. ระบบที่รันอยู่

ตรวจ ณ 12 ส.ค. 2569 ~20:00 น. — **ทุกตัวเดินปกติ ไม่มีตัวไหนหยุด**

| ระบบ | รอบการทำงาน | ล่าสุด | สถานะ |
|---|---|---|---|
| Phase 1 — Price History Tracker | ทุก 2 ชม. × 11 เหรียญ | 12 ส.ค. 20:00 น. | 🟢 132 แถว/วัน ครบทุกวันติดต่อกัน 14 วัน |
| Phase 2 — Daily Indicators | 00:30 น. × 7 เหรียญ | ปิดวัน 11 ส.ค. | 🟢 ครบทุกวัน |
| Phase 2b — Intraday Signals | ตามเงื่อนไข | 11 ส.ค. 06:10 น. | 🟢 เป็น event-driven เว้นวันได้ปกติ |
| USDT Buyback Watch | ทุกชั่วโมง | 12 ส.ค. 19:59 น. | 🟢 |
| Swing Dashboard (web) | — | — | ⚪ ตรวจไม่ได้จาก session นี้ (network policy บล็อก VPS) |

**สัญญาณล่าสุด (ปิดวัน 11 ส.ค.)** — XRP ขึ้น `Buy` ตัวเดียว (RSI 35.9, Z −2.02, Swing Rank 1)
ที่เหลือ Hold ทั้งหมด · BTC/ETH/SOL/DOGE อยู่ใน Death Cross · ADA/BNB Golden Cross

**แผนซื้อคืน USDT** — ไม้ 1+2 fill แล้ว (ถือ 47.99 USDT ต้นทุนเฉลี่ย 33.33) ไม้ 3 @32.80 ยังค้าง
ราคา 32.98 ทำ low 24 ชม. ใหม่ที่ 32.97 · mark-to-market −1.06%

---

## 2. ปัญหาที่พบ

### 2.1 สัญญาณไม่เคยถูกวัดผล — และเมื่อวัดแล้วพบว่าไม่มี edge

สัญญาณ 148 รายการตั้งแต่ 7 มิ.ย. มีค่า `Outcome = Pending` ทั้งหมด ไม่มีอะไรเกรดย้อนหลังเลย

เกรดย้อนหลังแล้ว 109 รายการ (เทียบราคาที่ T+24 ชม. จาก Price History):

| ตัวชี้วัด | ค่า |
|---|---|
| อัตราถูก | **50.5%** (ช่วงความเชื่อมั่น 95% = 41.1–59.8%) |
| edge เฉลี่ยต่อไม้ | +0.31% (ช่วงความเชื่อมั่น 95% = −0.06% ถึง +0.68%, t = 1.63) |
| หักค่าธรรมเนียมไป-กลับ 0.5% | **−0.19% ต่อไม้ · รวม −20.8%** |

แยกตามเดือน: มิ.ย. +0.70% ต่อไม้ · ก.ค. +0.01% · ส.ค. +0.09%
edge ทั้งหมดมาจากเดือน มิ.ย. เดือนเดียว และ 3 ไม้ที่ดีที่สุดคิดเป็น 45% ของ edge รวม

**สรุป: สัญญาณตอนนี้แยกไม่ออกจากการโยนเหรียญ และติดลบเมื่อหักค่าธรรมเนียม**
รายละเอียดเต็ม + ข้อมูลดิบรายไม้: [`bitkub-ops/docs/signal-accuracy-2026-08-12.md`](https://gitlab.com/supachai.taweerat/bitkub-ops/-/blob/main/docs/signal-accuracy-2026-08-12.md)

### 2.2 ของที่รัน production ยังไม่อยู่ใน version control

| ของ | รันอยู่ | อยู่ใน git |
|---|---|---|
| n8n workflows (Phase 1/2, Intraday, Portfolio Watch, LINE sender) | 🟢 | ❌ อยู่ในเครื่อง n8n อย่างเดียว |
| Swing Dashboard (`bitkub-dashboard` :8090) | 🟢 | ❌ อยู่บนเครื่อง dev เครื่องเดียว |
| home-console | 🟢 | ✅ `supachai.taweerat/home-console` |

Dashboard เป็น web app เต็มตัว (Express + indicator + backtest) ที่มีสำเนาเดียวบนเครื่อง dev
ส่วน workflow ถ้าใครแก้ node พลาดก็ย้อนกลับไม่ได้ ไม่มี history

### 2.3 คุณภาพข้อมูล

- **`THB_OTHER` ยุบ 5,956 แถว** จากหลายเหรียญรวมกัน (NEAR, LUNA, EPIC, XLM, STG, XAUT) — วิเคราะห์รายเหรียญไม่ได้ และเป็นเหตุให้เกรดสัญญาณ 33 รายการไม่ได้
- **`Bitkub Daily Summary` มีแถวซ้ำ** — วันละ 15–16 แถว แต่มีแค่ 7 แถวที่มี indicator ครบ อีก 8–9 แถวมีแต่ Close (มีสองตัวเขียนลง DB เดียวกัน) กระทบ backtest Phase 4 ที่จะนับซ้ำ

### 2.4 เอกสารไม่ตรงของจริง

- หน้า Phase 1 เขียนว่าเก็บ snapshot ทุกชั่วโมง (`*/60 * * * *`) แต่ของจริงเก็บทุก 2 ชั่วโมง
- หน้า Phase 2 ยังเป็นสถาปัตยกรรมเก่า 2a + 2b พร้อม deploy checklist ที่ยังไม่ติ๊ก ทั้งที่ deploy ไปนานแล้ว

### 2.5 Secret

- n8n API key และ GitLab PAT เก็บเป็น plaintext ในหน้า Notion — ควรหมุนแล้วย้ายไป password manager จริง
- GitLab PAT ในหน้านั้น 5 ตัว ใช้ได้จริง 2 ตัว อีก 3 ตัวตายแล้ว ควรลบทิ้ง

---

## 3. ที่ทำไปแล้ว

สร้าง repo **[`supachai.taweerat/bitkub-ops`](https://gitlab.com/supachai.taweerat/bitkub-ops)** บน GitLab ประกอบด้วย

- `workflows/bitkub-signal-outcome-grader.json` — n8n workflow เกรด `Outcome` อัตโนมัติทุกวัน 01:00 น.
  ดึงราคาที่ T+24 ชม. จาก Bitkub public API โดยตรง จึงเกรดเหรียญที่ Price History เก็บไม่ครบได้ด้วย
  รันมือครั้งแรกจะไล่เกรดย้อนหลังทั้ง 148 รายการให้เอง
- `scripts/export-n8n-workflows.sh` — export workflow ทั้งหมดจาก n8n มา commit (มีตัวกันไม่ให้ secret หลุด)
- `scripts/import-dashboard.sh` — ดึงโค้ด `bitkub-dashboard` จากเครื่อง dev เข้า repo
- `docs/signal-accuracy-2026-08-12.md` + ข้อมูลดิบรายไม้ + สคริปต์คำนวณซ้ำ

---

## 4. ที่ต้องทำต่อ (ต้องรันจากเครื่องที่เข้า VPS/n8n ได้)

- [ ] import + เปิดใช้ `bitkub-signal-outcome-grader` ใน n8n แล้วรันมือ 1 รอบเพื่อเกรดย้อนหลัง
- [ ] รัน `export-n8n-workflows.sh` ครั้งแรก แล้วตั้งให้รันสัปดาห์ละครั้ง
- [ ] รัน `import-dashboard.sh` เอาโค้ด dashboard ขึ้น git
- [ ] แยก select option ของเหรียญที่ยุบใน `THB_OTHER`
- [ ] รวมตัวที่เขียน `Bitkub Daily Summary` ให้เหลือตัวเดียว หรือแยก DB
- [ ] อัปเดตหน้า Phase 1 / Phase 2 ใน Notion ให้ตรงของจริง
- [ ] หมุน n8n API key + ลบ GitLab PAT ที่ตายแล้วออกจากหน้า Notion

---

_อัปเดตล่าสุด: 2026-08-12_
