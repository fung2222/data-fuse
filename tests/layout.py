"""390/360 px in-play HUD guard for DATA FUSE.

Fails if the bottom row overflows the viewport or if Mute is clipped.
Usage:
  python tests/layout.py [url] [outdir]
"""
from __future__ import annotations
import os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18940/data-fuse/'
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/data-fuse-layout')
OUT.mkdir(parents=True, exist_ok=True)
SHOTS = os.environ.get('SMOKE_SHOTS', '1') != '0'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
VIEWPORTS = [(360, 800, '360'), (390, 844, '390'), (412, 915, '412')]

fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for w, h, name in VIEWPORTS:
        c = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = c.new_page()
        errors = []
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.goto(URL, wait_until='domcontentloaded')
        pg.wait_for_function("() => {const l=document.getElementById('loading'); return l && (l.classList.contains('done')||l.classList.contains('hidden'));}", timeout=60000)
        pg.wait_for_timeout(500)
        pg.click('#btn-start')
        pg.wait_for_timeout(700)
        data = pg.evaluate("""() => {
          const ids = ['btn-undo','btn-pulse','btn-hint','btn-new','btn-pause','btn-mute'];
          const out = {};
          for (const id of ids) {
            const e = document.getElementById(id), r = e.getBoundingClientRect();
            out[id] = {x:r.x, right:r.right, w:r.width, visible:Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left))};
          }
          const bar = document.querySelector('.df-bar').getBoundingClientRect();
          return {vw:innerWidth, buttons:out, bar:{x:bar.x,right:bar.right}, docW:document.documentElement.scrollWidth};
        }""")
        print(name, data)
        check(data['docW'] <= w, f'{name}: no horizontal page overflow')
        for bid, r in data['buttons'].items():
            check(r['x'] >= 0 and r['right'] <= w + 0.5, f'{name}: {bid} fully inside viewport')
        check(data['buttons']['btn-mute']['visible'] >= 40, f'{name}: Mute has >=40px visible touch width')
        check(abs(data['buttons']['btn-mute']['visible'] - data['buttons']['btn-mute']['w']) < 1, f'{name}: Mute is not clipped')
        check(len(errors) == 0, f'{name}: zero console errors')
        if SHOTS:
            pg.screenshot(path=str(OUT / f'layout-{name}.png'), scale='css', timeout=60000)
        c.close()
    b.close()

print(f'\n{len(fails)} FAILED' if fails else '\nALL PASSED')
raise SystemExit(1 if fails else 0)
