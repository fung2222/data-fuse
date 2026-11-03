"""Pulse + LOCK CORE regression guard for DATA FUSE.

A locked pair is not pulse-able. The old probe approved it, then the real
_pulse() returned null after Undo had already been spent.

Usage:
  python tests/pulse_lock.py [url]
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
    pg.wait_for_function("() => {const l=document.getElementById('loading'); return !l || l.classList.contains('done')||l.classList.contains('hidden');}", timeout=60000)
    pg.wait_for_timeout(600)
    pg.click('#btn-start')
    pg.wait_for_timeout(600)

    # Lock the first 8; the adjacent 8 must NOT be pulse-able and must not cost Undo.
    pg.evaluate("""() => {
      const S = window.__fuse;
      S.game.restore({values:[8,8,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], score:0, moves:0, maxTile:8});
      S.undo = 2; S.zone = 4; S.mod = 'lock';
      S.game.armLock(1);
      const t = S.game.cells[0][0];
      S.game.lockedId = t.id; S.game.lockLeft = 1;
      S.api.resync();
    }""")
    pg.evaluate("""() => {
      const S = window.__fuse;
      const t = S.game.cells[0][0];
      S.game.lockedId = t.id; S.game.lockLeft = 1;
    }""")
    res = pg.evaluate("() => __fuse.api.pulse('left')")
    pg.wait_for_timeout(350)
    st = pg.evaluate("() => ({undo:__fuse.undo, moves:__fuse.game.moves, values:__fuse.game.values()})")
    check(res is False, 'locked pair pulse is rejected')
    check(st['undo'] == 2, 'locked pulse does not spend Undo')
    check(st['moves'] == 0, 'locked pulse does not count a move')
    check(st['values'] == [8,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 'locked pulse leaves the board unchanged')

    # A real adjacent pair still pulses and spends exactly one Undo.
    pg.evaluate("""() => {
      const S = window.__fuse;
      S.game.restore({values:[2,2,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], score:0, moves:0, maxTile:2});
      S.undo = 2; S.zone = 1; S.mod = null; S.game.clearLock();
      S.api.resync();
    }""")
    pg.wait_for_timeout(250)
    res2 = pg.evaluate("() => __fuse.api.pulse('left')")
    pg.wait_for_timeout(450)
    st2 = pg.evaluate("() => ({undo:__fuse.undo, moves:__fuse.game.moves, values:__fuse.game.values()})")
    check(res2 is True, 'normal adjacent pair pulse succeeds')
    check(st2['undo'] == 1, 'normal pulse spends one Undo')
    check(st2['moves'] == 1, 'normal pulse counts one move')
    check(st2['values'][0] == 4, 'normal pulse leaves a 4 in place')

    # Arming LOCK CORE on a full board whose only pair is the locked core must
    # end the run instead of leaving the player with no legal input.
    pg.evaluate("""() => {
      const S = window.__fuse;
      S.game.restore({values:[512,512,2,4, 4,2,4,2, 2,4,2,4, 4,2,4,2], score:0, moves:0, maxTile:512});
      S.undo = 2; S.zone = 4; S.mod = null;
      S.api.resync();
    }""")
    pg.wait_for_timeout(900)
    st3 = pg.evaluate("() => ({state:__fuse.state, over:__fuse.game.over, canMove:__fuse.game.canMove()})")
    check(st3['over'] is True, 'lock arming sets game over on a dead board')
    check(st3['state'] == 'over', 'lock dead board shows the game-over screen')
    check(len(errors) == 0, 'zero console errors')
    b.close()

print(f'\n{len(fails)} FAILED' if fails else '\nALL PASSED')
raise SystemExit(1 if fails else 0)
