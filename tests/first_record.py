"""First-run NEW RECORD guard for DATA FUSE.

A fresh install has store.best = 0. The first completed run with a positive
score must still show the NEW RECORD badge.

Usage:
  python tests/first_record.py [url]
"""
from __future__ import annotations
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18940/data-fuse/'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = c.new_page()
    errors = []
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(URL + '?lang=zh&reset=1', wait_until='domcontentloaded')
    pg.wait_for_function("() => {const l=document.getElementById('loading'); return l && (l.classList.contains('done')||l.classList.contains('hidden'));}", timeout=60000)
    pg.wait_for_timeout(600)
    pg.click('#btn-start')
    pg.wait_for_timeout(600)

    # Fresh store: make one scoring merge, then force the end screen.
    pg.evaluate("""() => {
      const S = window.__fuse;
      S.game.restore({values:[2,2,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], score:0, moves:0, maxTile:2});
      S.undo = 2; S.zone = 1; S.mod = null; S.newRecord = false;
      S.api.resync();
    }""")
    moved = pg.evaluate("() => __fuse.api.move('left')")
    pg.wait_for_timeout(250)
    st = pg.evaluate("() => ({score:__fuse.game.score, newRecord:__fuse.newRecord, best:document.querySelector('#hud-best').textContent})")
    check(moved is True, 'first scoring move succeeds')
    check(st['score'] > 0, 'first run has a positive score')
    check(st['newRecord'] is True, 'first run sets NEW RECORD flag from best = 0')

    pg.evaluate("() => __fuse.api.forceOver()")
    pg.wait_for_timeout(900)
    over = pg.evaluate("""() => ({
      state:__fuse.state,
      hidden:document.querySelector('#newrecord').classList.contains('hidden'),
      text:document.querySelector('#newrecord').textContent,
      score:document.querySelector('#over-score').textContent,
      best:document.querySelector('#over-best').textContent
    })""")
    check(over['state'] == 'over', 'first run reaches the game-over screen')
    check(over['hidden'] is False, 'first run shows the NEW RECORD badge')
    check(over['score'] == str(st['score']), 'first-run score is displayed')
    check(over['best'] == str(st['score']), 'first-run best is updated')
    check(len(errors) == 0, 'zero console errors')
    b.close()

print(f'\n{len(fails)} FAILED' if fails else '\nALL PASSED')
raise SystemExit(1 if fails else 0)
