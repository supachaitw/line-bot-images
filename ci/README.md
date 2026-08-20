# CI/CD ของ TANACHOK (ระบบงานสลากธนโชค)

โฟลเดอร์นี้มี 2 ส่วน แยกกันชัดเจน:

| ส่วน | ใช้ที่ไหน | ไฟล์ |
|---|---|---|
| **ของจริง** — ตามมาตรฐานธนาคาร | GitLab + Jenkins ของธนาคาร | `Jenkinsfile-sit/uat/prod.groovy` |
| **ซ้อมบนเครื่องตัวเอง** | GitLab + Jenkins ที่ติดตั้งเองบน WSL2 | `Jenkinsfile-local.groovy`, `local/` |

---

## ส่วนที่ 1 — ซ้อมบนเครื่องตัวเอง (GitLab → Jenkins → รันเว็บ)

เป้าหมาย: เดินสายงานให้ครบวงจรก่อน แล้วค่อยยกไปใช้ระบบของธนาคาร

### ขั้นที่ 1 — ส่ง source เข้า GitLab ของเครื่องตัวเอง

```bash
# สร้าง project ชื่อ tanachok ใน GitLab ก่อน (http://localhost:8929)
git remote add local http://localhost:8929/<group>/tanachok.git
git push -u local HEAD:main
git tag v0.1.00 && git push local v0.1.00
```

### ขั้นที่ 2 — เปิด Jenkins

```bash
docker compose -f ci/local/docker-compose.jenkins.yml up -d --build
docker compose -f ci/local/docker-compose.jenkins.yml logs -f jenkins
```

เปิด <http://localhost:8080> → ใส่รหัสผ่านครั้งแรกจาก log →
ติดตั้ง suggested plugins → สร้างผู้ใช้ผู้ดูแล

> ถ้า Jenkins ติดตั้งปลั๊กอินไม่ได้เพราะออกอินเทอร์เน็ตไม่ได้
> ข้ามขั้นตอนนั้นไปก่อน — pipeline นี้ใช้แค่ปลั๊กอิน Pipeline + Git ที่มีมาให้อยู่แล้ว

### ขั้นที่ 3 — สร้าง Pipeline job

`New Item` → ชื่อ `tanachok-local` → เลือก **Pipeline** → OK

ในหน้า config:

| ช่อง | ค่า |
|---|---|
| Definition | **Pipeline script from SCM** |
| SCM | **Git** |
| Repository URL | `http://host.docker.internal:8929/<group>/tanachok.git` |
| Credentials | ผู้ใช้ GitLab ของตัวเอง |
| Branch | `*/main` |
| Script Path | `ci/Jenkinsfile-local.groovy` |

> ใช้ `host.docker.internal` ไม่ใช่ `localhost` — เพราะ Jenkins อยู่ใน container
> `localhost` ของมันคือตัวมันเอง ไม่ใช่เครื่องเรา

### ขั้นที่ 4 — สั่ง Build

`Build with Parameters` → `TAG_VERSION = v0.1.00` → Build

pipeline จะทำตามลำดับ:

```
ตรวจ Tag → Checkout → ตรวจไฟล์ → Build image → Deploy → Health → ตรวจ version → Smoke test
```

### ขั้นที่ 5 — เปิดเว็บทดสอบ

<http://localhost:8802>

| URL | สิ่งที่เห็น |
|---|---|
| `/` | หน้าจอตัวอย่างโหมดจ่ายคืน + **ป้ายแสดง version มุมขวาล่าง** |
| `/tanachok-system-review.html` | เอกสารรีวิวฉบับรวม |
| `/version` | `{"app":"tanachok-web","version":"v0.1.00","commit":"..."}` |
| `/healthz` | `ok` |

### ทำเองโดยไม่ผ่าน Jenkins (ตรวจว่า image ใช้ได้ก่อน)

```bash
IMAGE_TAG=v0.1.00 ./deploy-local.sh build-only
./deploy-local.sh deploy-only v0.1.00
./deploy-local.sh health
./deploy-local.sh version
./deploy-local.sh rollback v0.0.99   # ซ้อมถอย
./deploy-local.sh logs
./deploy-local.sh down
```

---

## ส่วนที่ 2 — ของจริง ตามมาตรฐานธนาคาร

อ้างอิงโครงการ **Linkage Center 2** ซึ่งผ่านกระบวนการนี้มาแล้ว
รายละเอียดเต็มอยู่ใน [`docs/tanachok-system-review.md` ส่วนที่ 8](../docs/tanachok-system-review.md)

### Pipeline 4 ตัว

| Pipeline | ไฟล์ | ผู้รับผิดชอบ | กติกา |
|---|---|---|---|
| SIT | `Jenkinsfile-sit.groovy` | ทีมพัฒนา | build จาก Tag บน `main` เท่านั้น |
| UAT | `Jenkinsfile-uat.groovy` | ทีมพัฒนา | **ไม่มี stage build** — ใช้ image เดียวกับ SIT |
| SEC | (ของ Security Team) | Security Team | อนุมัติผลการ scan source code |
| PROD | `Jenkinsfile-prod.groovy` | ทีม Operation | ต้องผ่าน SEC + มีเลข PAR |

### สิ่งที่ต้องเติมก่อนใช้จริง

ไฟล์เหล่านี้ **จงใจ exit 1** เพื่อไม่ให้ pipeline ผ่านทั้งที่ยังไม่ได้ทำงานจริง —
ต้องเขียนใน Phase 3:

| ไฟล์ | ต้องทำอะไร |
|---|---|
| `db-backup.sh` | `pg_dump` + checksum · `--verify` ต้องทดสอบ restore จริง |
| `db-migrate.sh` | versioned migration แบบ idempotent (Flyway / Liquibase / Prisma) |
| `reconcile-balance.sh` | พิมพ์สรุปยอดคงเหลือผู้ถือสลาก — **PROD เรียก 2 ครั้ง ก่อน/หลัง deploy แล้ว diff ต้องตรงทุกบาท** |

### ค่าที่ต้องตั้งใน Jenkins (ห้าม hardcode ในไฟล์)

| ชนิด | ชื่อ | ใช้ทำอะไร |
|---|---|---|
| Global env | `NEXUS_REGISTRY` | ที่อยู่ registry ของธนาคาร |
| Global env | `GIT_REPO_URL` | GitLab ของธนาคาร |
| Credentials | `nexus-docker-credentials` | login Nexus |
| Credentials | `gitlab-ad-credentials` | บัญชี AD สำหรับ clone |
| Credentials | `tanachok-{sit,uat,prod}-db` | บัญชีฐานข้อมูลแต่ละ env |

### ข้อควรรู้ก่อนเริ่ม

- **Jenkins ของธนาคารไม่ต่ออินเทอร์เน็ต** — base image และ dependency ทั้งหมด
  ต้องจัดทำเป็น Base Image นำส่งธนาคารก่อน
- ติด **Tag version ได้ที่ branch `main` เท่านั้น** รูปแบบ `vx.x.xx`
  (ยืนยันจำนวนหลักกับทีม QA อีกครั้ง — บางโครงการของธนาคารใช้ 4 ส่วน)
- **Merge Request จาก `dev` → `main` ต้องอนุมัติโดยพนักงานธนาคาร**
- rollback ใช้การเปลี่ยน image tag แล้ว restart — **ห้ามใช้ `--force-recreate`**
- ตัดสินใจ rollback **ภายใน 15 นาที**
