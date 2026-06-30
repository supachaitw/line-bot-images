# TANACHOK — แผนพัฒนาและ Migration

> โปรเจกต์: `tanachok-next` · Environment: `tanachok-dev` / `tanachok-sit`
> สถานะปัจจุบัน (จาก server topology): **DOWN ทั้ง stack** — ตั้ง config ไว้แต่ยังไม่ได้รัน
> เอกสารฉบับนี้เป็นแผนตั้งต้น (living document) ปรับแก้ได้ตามจริงเมื่อทีมรีวิว

---

## 1. ภาพรวมสถาปัตยกรรม (Current State)

TANACHOK รันบน WSL2 Ubuntu / Docker engine เดียวกับ GSB Local Dev อื่น ๆ และเข้าถึงผ่าน
`gsb-gateway (nginx)` ที่ route ตาม Host header: `tanachok*.gsb.or.th -> tanachok-gateway:8800`

| Service | Container | Port (host) | บทบาท |
|---|---|---|---|
| Gateway | `tanachok-gateway` | `8800 -> 80` | nginx เข้าวง, reverse proxy ภายใน stack |
| Frontend | `tanachok-web` | `5173` | Web (Vite dev server) |
| Backend | `tanachok-api` | `8085` | REST API |
| PDF service | `tanachok-pdf` | `7000` | สร้าง/เรนเดอร์เอกสาร PDF |
| Database | `tanachok-postgres` | `5432` | PostgreSQL |
| DB Admin | `tanachok-adminer` | `8081` | Adminer (จัดการ DB ตอน dev) |

**ข้อสังเกตเชิงสถาปัตยกรรม**
- Frontend ยังเป็น **Vite dev server (:5173)** → โหมด development ยังไม่ได้ build เป็น static + serve ผ่าน nginx
- ทุก service เป็น single-instance, ไม่มี HA/replica (เหมาะกับ local dev)
- ยังไม่เห็น cache/queue (เช่น redis) แยกของ TANACHOK เอง

---

## 2. เป้าหมายของแผน

1. **Development** — ทำให้ stack กลับมา **UP** และพัฒนาได้ต่อเนื่อง มี workflow ที่ทำซ้ำได้
2. **Migration** — ย้าย/เลื่อนระดับจาก `dev → sit → uat → prod` อย่างมีขั้นตอน ตรวจสอบได้ ย้อนกลับได้
3. **ลดความเสี่ยง** — schema migration, config/secret, การ rollback มีกระบวนการชัดเจน

---

## 3. แผนพัฒนา (Development Plan)

### 3.1 นำ stack กลับมา UP (Phase 0 — Bring-up)
- [ ] ตรวจ `docker compose` ของ project `tanachok-next` ว่า service ครบและ healthcheck ผ่าน
- [ ] ยืนยัน env/secret ครบ (DB credential, API base URL, gateway upstream)
- [ ] `docker compose up -d` แล้วไล่เช็คทีละ service:
  - postgres พร้อมรับ connection (`:5432`)
  - api เชื่อม DB ได้ (`:8085/health`)
  - web เรียก api ได้ (`:5173`)
  - pdf service ตอบ (`:7000`)
  - gateway route `:8800` เข้าถึง web/api ภายใน
- [ ] ทดสอบ end-to-end ผ่าน `tanachok-dev.gsb.or.th` (ผ่าน gsb-gateway)

### 3.2 มาตรฐานการพัฒนา
- [ ] **Branching** — `main` (release) ← `develop` ← `feature/*`, `fix/*`
- [ ] **Schema migration** — ใช้ migration tool (เช่น Flyway / Prisma / Alembic ตามภาษา backend) คุม versioned scripts ห้ามแก้ schema มือ
- [ ] **Config แยกจาก code** — ใช้ `.env.{dev,sit,uat,prod}` + secret store, ไม่ commit ค่า sensitive
- [ ] **Healthcheck** — ทุก service มี `/health` หรือ docker `healthcheck`
- [ ] **Logging** — log แบบ structured, รวมที่เดียวได้ภายหลัง

### 3.3 CI/CD (ผ่าน CI/CD Lab — gitlab / jenkins / nexus)
- [ ] Pipeline: `lint → test → build image → push to nexus (:8092) → deploy`
- [ ] Multibranch: build ทุก feature branch, deploy `develop` ลง dev อัตโนมัติ
- [ ] Frontend production: `vite build` → serve ผ่าน nginx (เลิกใช้ dev server บน env สูง)

---

## 4. แผน Migration (Promotion: dev → sit → uat → prod)

### 4.1 หลักการ
- **Immutable artifact** — build image ครั้งเดียว เลื่อนระดับ image เดิม เปลี่ยนแค่ config/secret ต่อ env
- **DB migration แยกขั้นจาก deploy** — รัน migration ก่อน/พร้อม deploy แบบ idempotent
- **ทุก env ต้องมี rollback path** ก่อนเริ่ม

### 4.2 ขั้นตอนต่อ env

| ขั้น | กิจกรรม | เกณฑ์ผ่าน (gate) |
|---|---|---|
| 1. เตรียม | freeze artifact tag, เตรียม `.env.{env}`, สำรอง DB | backup สำเร็จ + ตรวจ checksum |
| 2. DB migrate | รัน versioned migration บน DB ของ env นั้น | migration ผ่าน, ไม่มี pending |
| 3. Deploy | ดึง image tag เดิมขึ้น env | ทุก container healthy |
| 4. Smoke test | login, flow หลัก, สร้าง PDF, ตรวจ gateway route | ผ่านทุกเคสหลัก |
| 5. Sign-off | ผู้รับผิดชอบ env อนุมัติ | approve เป็นลายลักษณ์ |

### 4.3 ลำดับ environment
1. **dev** (`tanachok-dev`) — รวม feature, ทดสอบ integration
2. **sit** (`tanachok-sit`) — ทดสอบร่วมระบบอื่น (เช่น CBS/Sanchez, linkage) เน้น end-to-end
3. **uat** — ให้ผู้ใช้ทดสอบ ยึด data ใกล้ production
4. **prod** — deploy จริง, change window + rollback plan

### 4.4 Data / Schema migration
- เก็บ migration script แบบ versioned, รันเรียงลำดับ, **idempotent**
- ก่อน migrate prod: backup เต็ม + ทดสอบ migration เดิมบน sit/uat ให้ผ่านก่อน
- เปลี่ยน schema แบบ breaking → ใช้ **expand/contract** (เพิ่มก่อน, ย้าย data, ค่อยลบของเก่า) เพื่อ zero-downtime

### 4.5 Rollback
- App: deploy image tag ก่อนหน้า (artifact ยังอยู่ใน nexus)
- DB: restore จาก backup ก่อน migrate **หรือ** down-migration ที่เทสต์แล้ว
- เกณฑ์ตัดสิน rollback: smoke test ไม่ผ่าน / error rate พุ่ง / data inconsistency

---

## 5. Checklist ก่อนขึ้น Production
- [ ] Frontend serve แบบ production build (nginx) ไม่ใช่ Vite dev server
- [ ] Secret ทั้งหมดมาจาก secret store ไม่ใช่ไฟล์ใน repo
- [ ] Backup + restore ทดสอบสำเร็จจริง
- [ ] Healthcheck + monitoring + alert พร้อม
- [ ] Migration ทดสอบบน sit/uat ผ่าน
- [ ] Rollback plan เขียนชัด + เคยซ้อม
- [ ] กำหนด resource limit (cpu/mem) ของแต่ละ container
- [ ] กำหนดผู้รับผิดชอบ + change window

---

## 6. สิ่งที่ต้องยืนยันเพิ่ม (Open Questions)
- ภาษา/เฟรมเวิร์กของ `tanachok-api` และ `tanachok-pdf` (เพื่อเลือก migration tool ให้ตรง)
- `tanachok-next` มี dependency กับระบบอื่นไหม (CBS/Sanchez, linkage center)
- ปลายทาง production จริงคือที่ไหน (on-prem / k8s / VM) — มีผลกับวิธี deploy
- มีข้อมูล production เดิมต้อง migrate เข้ามาหรือเริ่ม fresh

---

_อัปเดตล่าสุด: 2026-06-30 — ฉบับร่างตั้งต้น รอทีมรีวิวและเติมรายละเอียดเชิงเทคนิคของแต่ละ service_
