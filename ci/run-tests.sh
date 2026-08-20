#!/usr/bin/env bash
# ตรวจไฟล์ที่จะถูกใส่ลง image ว่าครบและใช้ได้ (แทนที่ unit test ในขั้นซ้อม)
set -euo pipefail
fail=0
need() {
  if [ -f "$1" ]; then echo "  ✔ $1"; else echo "  ✖ ไม่พบ $1"; fail=1; fi
}
echo "[test] ตรวจไฟล์ที่ต้องมี"
need docs/tanachok-mockups.html
need docs/tanachok-system-review.html
need docker/nginx.conf
need docker/Dockerfile.web

echo "[test] ตรวจว่า HTML เปิดอ่านเป็น UTF-8 ได้"
for f in docs/*.html; do
  python3 - "$f" <<'PY' || fail=1
import sys
p = sys.argv[1]
try:
    t = open(p, encoding="utf-8").read()
except UnicodeDecodeError as e:
    print(f"  ✖ {p} ไม่ใช่ UTF-8: {e}"); sys.exit(1)
if t.count("<section") and t.count("<section") != t.count("</section>"):
    print(f"  ✖ {p} แท็ก <section> ไม่สมดุล"); sys.exit(1)
print(f"  ✔ {p} ({len(t)} ตัวอักษร)")
PY
done

[ "$fail" -eq 0 ] || { echo "[test] ไม่ผ่าน"; exit 1; }
echo "[test] ผ่านทั้งหมด"
