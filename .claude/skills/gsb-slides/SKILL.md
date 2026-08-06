---
name: gsb-slides
description: >
  สร้างสไลด์นำเสนอ (.pptx) ธีมธนาคารออมสิน (GSB) ที่ภาษาไทยไม่เพี้ยน.
  Use whenever the user asks to make/build/generate a presentation, slide deck,
  or "สไลด์"/"เด็ค"/"พรีเซนต์" for GSB / ออมสิน — especially Thai-language decks,
  BU/exec meetings, or project/plan decks. Prefer this over Canva/Figma AI slide
  generation for Thai content, because those tools garble Thai glyphs (สระ/วรรณยุกต์)
  and cannot lock the GSB brand palette. Produces a real .pptx via python-pptx.
---

# gsb-slides — สไลด์ธีมออมสิน ภาษาไทยไม่เพี้ยน

## ใช้เมื่อไหร่
ผู้ใช้ขอทำ "สไลด์ / เด็ค / พรีเซนต์ / presentation / .pptx" โดยเฉพาะ **เนื้อหาภาษาไทย**
และ/หรือ **ธีมออมสิน (GSB)** เช่น เด็คประชุม BU, เด็คแผนโครงการ, เด็คผู้บริหาร

## ทำไมไม่ใช้ Canva / Figma AI generate
ผ่านการลองจริงแล้ว: เครื่องมือ AI generate สไลด์ (Canva `generate-design-structured`,
Figma) **เรนเดอร์ภาษาไทยเพี้ยน** — สระบน/ล่างและวรรณยุกต์หลุดตำแหน่ง, คุมสีแบรนด์
GSB ให้ตรงเป๊ะไม่ได้, และมักย่อเนื้อหาจนไม่ครบ. ให้ใช้ python-pptx (ไฟล์ `gsb_slides.py`
ในโฟลเดอร์นี้) แทน — ได้ `.pptx` จริง เปิด/แก้ใน PowerPoint ได้

> Figma ยังมีประโยชน์สำหรับ **UI mockup / prototype หน้าจอระบบ** (คนละงานกับสไลด์)
> ใช้ Figma ทำจอ แล้ว export ภาพมาแปะในเด็คที่สร้างด้วย skill นี้

## หัวใจที่กันไทยเพี้ยน (สำคัญที่สุด)
python-pptx ตั้งฟอนต์ให้แค่ **latin** โดย default. พอเจอสระ/วรรณยุกต์ไทย PowerPoint
ถือเป็น **complex-script** แล้ว fallback ไปฟอนต์ธีม → เพี้ยน. `gsb_slides.py` แก้โดย
ตั้ง `a:cs` (complex-script) + `a:latin` + `a:ea` เป็น **Tahoma** ทุก run
(ดูฟังก์ชัน `_set_font`). ห้ามลบส่วนนี้ออก. ถ้าจะเปลี่ยนฟอนต์ ให้ใช้ฟอนต์ที่มี glyph
ไทยครบ (Tahoma / Sarabun / Noto Sans Thai / TH Sarabun New)

## ธีม GSB (ล็อกไว้แล้วใน palette)
- ชมพูมาเจนต้าหลัก `#EC008C` (PINK) · เข้ม `#B3006A` (PINKD) · อ่อน `#EC9CC8`
- สีรอง: BLUE `#234D80`, AMBER `#B98612`, UP/เขียว `#2E7D46`, DOWN/แดง `#B13A3F`
- 16:9 (13.333×7.5"), header แถบชมพู + เส้นใต้เข้ม, footer ชื่อเรื่อง + เลขหน้า

## วิธีใช้ (โค้ด)
เขียนสคริปต์สั้น ๆ import `gsb_slides` แล้วเรียกทีละสไลด์:

```python
import sys; sys.path.insert(0, ".claude/skills/gsb-slides")
from gsb_slides import Deck, PINK, BLUE, AMBER, UP

d = Deck("ชื่อเรื่องเด็ค", subtitle="คำโปรย", meta="โปรเจกต์ · env · วันที่")
d.title()
d.agenda(["1. หัวข้อ", ("2. หัวข้อ", " — คำอธิบาย"), ...])
d.section(1, "ชื่อบท", "คำโปรยบท")                   # สไลด์คั่นบท
d.cards("ภาพรวมระบบ", [("ชื่อ","ซับ","บรรทัดล่าง"), ...], cols=3, intro="อธิบายสั้น")
d.bullets("หัวข้อ", [("ตัวหนา"," — ส่วนอธิบาย"), "ข้อความล้วน"], intro="เกริ่น")
d.compare("AS IS → TO BE", [("ด้าน","ปัจจุบัน","เป้าหมาย"), ...])  # ตาราง 3 คอลัมน์
d.scorecard("ความพร้อม Production", [("ด้าน","ready|partial|gap","สิ่งที่ต้องทำ"), ...])
d.kpis("ตัวเลขสำคัญ", [("12","สัปดาห์","ถึง Go-Live"), ...])
d.phases("แผนเป็นเฟส", [("Phase 0","ชื่อ","รายละเอียด"), ...])
d.envflow("Migration", [("dev","รวมงาน"),("sit","ทดสอบร่วม"),("uat","ผู้ใช้ทดสอบ"),("prod","ใช้จริง")],
          principles=[("Build ครั้งเดียว"," — เลื่อน image เดิม")])
d.table("ความเสี่ยง", ["ความเสี่ยง","การควบคุม"], [("ความเสี่ยง A","คุม A"), ...],
        widths=[5,7])                                  # widths/sizes ปรับคอลัมน์ได้
d.closing("ขอบคุณครับ", "Q & A")
d.save("docs/ชื่อไฟล์.pptx")
```

รันด้วย `python3 สคริปต์.py` (ต้องมี `python-pptx`: `pip install python-pptx`)

ประเภทสไลด์ที่มีให้: `title, section, agenda, bullets, cards, compare, scorecard,
kpis, phases, envflow, table, closing`
ถ้าต้องการเลย์เอาต์ใหม่ ให้เพิ่มเมธอดใน `gsb_slides.py` โดยยึด helper `_box/_text/_header/_footer`
(ซึ่งตั้งฟอนต์ไทยถูกให้อยู่แล้ว)

## เช็กลิสต์ "เนื้อหาครบก่อนคุยกับผู้ฟัง"
ก่อนส่งเด็ค ตรวจว่าเนื้อหาครบ (โดยเฉพาะเด็คแผน/โครงการสำหรับ BU/ผู้บริหาร):
1. **ปก** — ชื่อระบบ, ชนิดเอกสาร, ผู้ฟัง, โปรเจกต์/env/วันที่
2. **Agenda** — หัวข้อทั้งหมดที่จะพูด
3. **ภาพรวมระบบ** — ระบบคืออะไร มีองค์ประกอบ/บริการอะไรบ้าง
4. **สถานะปัจจุบัน** — ตอนนี้อยู่ตรงไหน (UP/DOWN, พร้อม/ไม่พร้อม)
5. **AS IS → TO BE** — เทียบให้เห็นภาพว่าจะเปลี่ยนอะไร
6. **เป้าหมาย** — จะไปทางไหน (ชัด วัดได้)
7. **แผนงานเป็นเฟส + timeline** — ทำอะไร ลำดับไหน ใช้เวลาเท่าไร
8. **Migration/Deployment** — เส้นทาง env, หลักการ, gate
9. **ความเสี่ยง + การควบคุม** — คู่กันเสมอ
10. **กิจกรรมเตรียมโครงการ** — เช็กลิสต์งานเตรียม (คงเฉพาะที่อยู่ในขอบเขตระบบนั้น)
11. **สิ่งที่ต้องการจากผู้ฟัง** — การตัดสินใจ/สนับสนุนที่ต้องขอ + ขั้นถัดไป
12. **ปิด/Q&A**

### เพิ่มเติมเมื่อคุยกับ "เจ้าของระบบ (system owner)" เพื่อขึ้น Production
- **Production readiness scorecard** — ด้านไหนพร้อม/บางส่วน/ยังไม่มี (ใช้ `scorecard`)
- **ตัวอย่างหน้าจอจริง** — mockup ให้เห็นภาพ ไม่ใช่พูดลอย ๆ
- **NFR ที่ต้องตกลง** — ผู้ใช้กี่คน, ชั่วโมงทำการ, RTO/RPO, การเก็บ log/ข้อมูลกี่ปี
- **บทบาทและความรับผิดชอบ** — ใครอนุมัติ ใครดูแลหลัง go-live
- **สิ่งที่ต้องตัดสินใจวันนี้** — ให้จบเป็นข้อ ๆ พร้อมกำหนดวัน

## อย่าทำ (บทเรียนจริง)
- อย่าเอากิจกรรม/ชื่อเฉพาะของ **ระบบอื่น** มาใส่ปน (เช่น ThaiD/DOPA/F5 ของ Linkage Center
  ในเด็คของ TANACHOK) — ผู้ฟังจะสับสนว่า "สองระบบปนกัน". คงเฉพาะสิ่งที่อยู่ในขอบเขตจริง
- อย่าใช้ AI generate ภาษาไทยแล้วส่งเลยโดยไม่ตรวจ glyph
- อย่าลืม `d.save(...)` เขียนลง `docs/` **แล้ว commit ทันที** — งานที่ไม่ commit
  หายได้จริงถ้า container ถูกเก็บคืน (เคยเกิดมาแล้ว)

## ตัวอย่างอ้างอิง
- `scripts/gen-tanachok-slides.py` — เด็คประชุม BU (แผนพัฒนา+migration)
- `scripts/gen-tanachok-prod-slides.py` — เด็คคุยเจ้าของระบบเพื่อขึ้น production
- รันเดโมพิสูจน์ไทย: `python3 .claude/skills/gsb-slides/gsb_slides.py` → `gsb-slides-demo.pptx`
