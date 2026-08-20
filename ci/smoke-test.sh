#!/usr/bin/env bash
# ยิง URL หลักหลัง deploy ยืนยันว่าเว็บทำงานจริง
set -euo pipefail
ENV_NAME="${1:-local}"
PORT="${APP_PORT:-8802}"
BASE="http://localhost:$PORT"

echo "[smoke] $ENV_NAME -> $BASE"
fail=0
check() {
  local path="$1" want="$2"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path" || echo 000)"
  if [ "$code" = "$want" ]; then
    echo "  ✔ $path -> HTTP $code"
  else
    echo "  ✖ $path -> HTTP $code (คาดหวัง $want)"; fail=1
  fi
}

check /            200
check /healthz     200
check /version     200
check /tanachok-system-review.html 200
check /tanachok-mockups.html       200
check /ไม่มีหน้านี้ 404

echo "[smoke] ตรวจว่าภาษาไทยไม่เพี้ยน"
if curl -sf "$BASE/" | grep -q "ธนโชค"; then
  echo "  ✔ อ่านภาษาไทยจากหน้าเว็บได้"
else
  echo "  ✖ ไม่พบข้อความภาษาไทยในหน้าเว็บ"; fail=1
fi

[ "$fail" -eq 0 ] || { echo "[smoke] ไม่ผ่าน"; exit 1; }
echo "[smoke] ผ่านทั้งหมด"
