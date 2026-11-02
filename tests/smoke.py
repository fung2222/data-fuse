"""Headless smoke test for DATA FUSE.
Usage:  python tests/smoke.py [base_url] [out_dir]
  base_url defaults to http://127.0.0.1:18940/data-fuse/  (serve the repo parent dir with `python3 -m http.server`)
Checks: zero console errors / page errors, start -> keyboard moves change the board, swipe works on a touch
viewport, undo restores, game-over screen + rewind, pause, demo mode autoplays, language toggle zh-HK/en + persistence,
endless zone beyond the authored milestone list (131072+131072 -> 262144 = zone 13). Saves screenshots.
"""
import sys, os, json
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18940/data-fuse/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'docs/shots'
os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
SHOTS = os.environ.get('SMOKE_SHOTS', '1') != '0'
fails = []

def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

def set_lang(pg, value):
    """Language now lives in the gear settings sheet, not a start-screen #btn-lang."""
    pg.wait_for_selector('#btn-settings-home')
    pg.click('#btn-settings-home')
    pg.wait_for_selector('.ck-settings')
    pg.click(f'.ck-seg[data-set="lang"] button[data-v="{value}"]')
    pg.wait_for_timeout(200)
    pg.click('.ck-settings [data-ok]')
    pg.wait_for_timeout(350)

def shot(pg, path):
    # CSS-scale capture keeps SwiftShader WebGL tests fast; SMOKE_SHOTS=0 skips images for CI speed.
    if not SHOTS: return
    pg.screenshot(path=path, scale='css')

def run(p, name, w, h, mobile):
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); errs = []
    pg.set_default_timeout(60000)  # SwiftShader WebGL screenshots can take ~20s at DPR 2
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '?reset=1'); pg.wait_for_timeout(4500)
    shot(pg, path=f'{OUT}/{name}-start-en.png')
    lang = lambda: pg.evaluate('document.documentElement.dataset.lang')
    check(lang() == 'en' and 'START' in pg.inner_text('#btn-start'), f'{name}: default language en (navigator)')
    set_lang(pg, 'zh-HK')
    check(lang() == 'zh' and '開始' in pg.inner_text('#btn-start'), f'{name}: settings -> zh-HK live')
    pg.reload(); pg.wait_for_timeout(3500)
    check(lang() == 'zh' and pg.evaluate("localStorage.getItem('cyber.lang')") == 'zh-HK', f'{name}: language persisted')
    shot(pg, path=f'{OUT}/{name}-start-zh.png')
    if name == 'desktop':
        set_lang(pg, 'en'); check(lang() == 'en', f'{name}: settings -> en')
    pg.click('#btn-start'); pg.wait_for_timeout(800)
    st = lambda: pg.evaluate('({s: __fuse.state, score: __fuse.game.score, moves: __fuse.game.moves, vals: __fuse.game.values(), hist: __fuse.history.length, undo: __fuse.undo})')
    check(st()['s'] == 'playing', f'{name}: start -> playing')
    if mobile:
        cx, cy = w // 2, h // 2
        before = st()['moves']
        for d in [(0, -1), (1, 0), (0, 1), (-1, 0)] * 3:
            pg.touchscreen.tap  # ensure touch is available
            pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + d[0] * 120, cy + d[1] * 120, steps=6); pg.mouse.up(); pg.wait_for_timeout(250)
        check(st()['moves'] > before, f'{name}: swipes move tiles ({st()["moves"]} moves)')
    keys = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'] * 10
    for k in keys: pg.keyboard.press(k); pg.wait_for_timeout(60)
    pg.wait_for_timeout(700)
    s = st(); check(s['moves'] > 5, f'{name}: keyboard moves ({s["moves"]})')
    shot(pg, path=f'{OUT}/{name}-play.png')
    v0 = s['vals']; pg.keyboard.press('ArrowUp'); pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(300)
    s1 = st(); pg.keyboard.press('z'); pg.wait_for_timeout(400)
    s2 = st(); check(s2['moves'] < s1['moves'] or s1['moves'] == s['moves'], f'{name}: undo ({s1["moves"]} -> {s2["moves"]})')
    pg.keyboard.press('p'); pg.wait_for_timeout(300); check(st()['s'] == 'paused', f'{name}: pause')
    pg.keyboard.press('p'); pg.wait_for_timeout(300); check(st()['s'] == 'playing', f'{name}: resume')
    pg.evaluate('__fuse.api.endlessTest()'); pg.wait_for_timeout(1500)
    z = pg.evaluate('[__fuse.zone, __fuse.game.maxTile, __fuse.game.fourChance]')
    check(z[0] == 13 and z[1] == 262144, f'{name}: endless zone 13 beyond old end (zone {z[0]}, core {z[1]}, 4-chance {z[2]})')
    shot(pg, path=f'{OUT}/{name}-endless.png')
    pg.evaluate('__fuse.api.forceOver()'); pg.wait_for_timeout(1400)
    check(st()['s'] == 'over', f'{name}: game over screen')
    shot(pg, path=f'{OUT}/{name}-over.png')
    if pg.is_visible('#btn-revive'):
        pg.click('#btn-revive'); pg.wait_for_timeout(700); check(st()['s'] == 'playing', f'{name}: rewind continues')
    pg.goto(BASE); pg.wait_for_timeout(3500)
    check(pg.is_visible('#btn-continue'), f'{name}: saved run offers CONTINUE')
    pg.goto(BASE + '?demo=1'); pg.wait_for_timeout(9000)
    d = st(); check(d['moves'] > 2, f'{name}: demo autoplays ({d["moves"]} moves)')
    shot(pg, path=f'{OUT}/{name}-demo.png')
    check(not errs, f'{name}: zero console errors {errs[:3]}')
    b.close()

with sync_playwright() as p:
    run(p, 'mobile', 412, 915, True)
    run(p, 'desktop', 1280, 800, False)
print('ALL PASSED' if not fails else f'{len(fails)} FAILED')
sys.exit(1 if fails else 0)
