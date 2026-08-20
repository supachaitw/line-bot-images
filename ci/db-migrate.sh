#!/usr/bin/env bash
# -----------------------------------------------------------------------------
#  ci/db-migrate.sh — ยังไม่ได้เขียน (TODO ของ Phase 3)
#  Jenkinsfile ของ SIT/UAT/PROD เรียกสคริปต์นี้
#
#  สิ่งที่ต้องทำ: รัน versioned migration (Flyway / Liquibase / Prisma) 
#    - ต้องรันซ้ำได้ไม่พัง (idempotent)
#    - แยกขั้นจาก deploy
#    - schema เปลี่ยนแบบ breaking ให้ใช้ expand/contract
#  สคริปต์จงใจ exit 1 เพื่อไม่ให้ pipeline ผ่านไปทั้งที่ยังไม่ได้ทำงานจริง
# -----------------------------------------------------------------------------
set -euo pipefail
echo "[db-migrate] ยังไม่ได้เขียนสคริปต์นี้ — ต้องทำใน Phase 3 ก่อนใช้กับข้อมูลจริง" >&2
exit 1
