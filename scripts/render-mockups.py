#!/usr/bin/env python3
"""เรนเดอร์หน้าจอตัวอย่างจาก docs/tanachok-mockups.html เป็นภาพ PNG
เพื่อนำไปแทรกในสไลด์ (.pptx)

ต้องมี: pip install playwright  (Chromium อยู่ที่ PLAYWRIGHT_BROWSERS_PATH แล้ว)
รัน: python3 scripts/render-mockups.py
"""
import os, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "tanachok-mockups.html"
OUT = ROOT / "docs" / "mockups"
OUT.mkdir(parents=True, exist_ok=True)

NAMES = ["screen1-dashboard", "screen2-search", "screen3-feed"]

# ใช้ Chromium ที่ติดตั้งไว้แล้วในเครื่อง (อย่ารัน `playwright install`)
CHROME = os.environ.get("CHROMIUM_PATH", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None)
    page = browser.new_page(viewport={"width": 1560, "height": 1000},
                            device_scale_factor=2)
    page.goto(SRC.as_uri())
    page.wait_for_timeout(1200)
    apps = page.query_selector_all("[data-app]")
    print("found", len(apps), "screens")
    for i, app in enumerate(apps):
        if i >= len(NAMES):
            break
        # ถ่ายเฉพาะกรอบหน้าจอ (canvas) ให้ได้สัดส่วน 1440x900 พอดี
        canvas = page.query_selector_all("[data-canvas]")[i]
        path = OUT / f"{NAMES[i]}.png"
        canvas.screenshot(path=str(path))
        print("wrote", path.relative_to(ROOT))
    browser.close()
