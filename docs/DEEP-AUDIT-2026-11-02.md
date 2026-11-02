# DATA FUSE — deep audit (2026-11-02)

Status: **read-only audit; no gameplay code changed.**  
Scope: `data-fuse` v1.2.3, 360 / 390 / 412 / 430 px, Playwright + pure-logic fuzz.  
Purpose: list only problems that can be shown by a measurement, a reproducible run, or a logic case. This is the first deep pass after the shallow layout/doc pass.

## Baseline checked

- `node tests/logic.test.mjs` — **ALL PASSED**.
- `node tests/ai.bench.mjs` — AI reached **2048** on seeds 1 and 2 (30,328 / 30,284 pts; 11.5 / 12.0 ms per move).
- 390 px start screen: no overlap, tagline visible, start button 240×70 at y=694, no console errors in the checked runs.
- Full two-viewport `tests/smoke.py` did **not** finish inside 7 minutes on this box (software WebGL); this is an environment limit, not a product result. Use `SMOKE_SHOTS=0` on a faster machine before shipping.

## Findings, in fix order

### 1. HIGH — mute button is off-screen on 360 / mostly clipped on 390

The in-play bottom row has five 44 px buttons plus the wide Undo button. The row is wider than the available width, so the last button overflows to the right.

Measured visible width of `#btn-mute` at 390×844 (CSS pixels):

| viewport | button x | right edge | visible width |
|---|---:|---:|---:|
| 360 | 370 | 414 | **0 / 44** |
| 390 | 370 | 414 | **20 / 44** |
| 412 | 370 | 414 | 42 / 44 |
| 430 | 370 | 414 | 44 / 44 |

At 360 px the button is completely unreachable by touch; at 390 px only the left 20 px is tappable. This is the only in-play mute control, so a mobile player cannot mute without a keyboard.

Cause: `css/game.css:6-7` (`.df-bar` + static `.hud-buttons`) and `vendor/cyber-kit/ui/hud.css:76` (gap 10px) put Undo (138 px) plus five buttons (5×44 + 4×10 = 260 px) into a 358 px row. The total is 398 px.

Fix direction: keep a single row but make it fit (wrap the icon group, reduce the undo width/gap at ≤390, or move Mute into the pause/settings sheet). Add a regression guard at 360 and 390, not only the existing 412 smoke viewport (`tests/smoke.py:93`).

### 2. HIGH — Pulse in a LOCK CORE zone can silently consume an Undo without moving

Reproduced at 390 px: board `[8,8,0,0 …]`, zone 4 (`LOCK CORE`), highest 8 locked at (0,0), another 8 at (0,1), undo = 2.

- `window.__fuse.api.pulse('left')` returned **false**.
- `moves` stayed **0** and the board did not change.
- `undo` dropped **2 → 1**.

Cause: `tryPulse()` uses a probe (`js/main.js:413-420`) whose `restore()` recreates tile ids, then copies the real `lockedId` onto the probe. The probe's id no longer matches any tile, so `_isLocked()` is false and the probe sees the locked 8+8 as a legal pulse. The real `_pulse()` (`js/logic.js:122-156`) correctly skips pairs involving the locked tile and returns null. The undo is decremented before `doMove()` returns false.

Fix direction: probe with a lock-aware clone that preserves the locked tile position/id, or only decrement after the real pulse succeeds. Add a deterministic test for “locked pair is not pulse-able, no undo spent”.

### 3. MEDIUM — HUD says “下一熔合 128” at the start, but the next actual merge is 4

At a fresh run `maxTile = 2`, `#hud-next` shows **128**. The value is the next zone milestone (`nextMilestone()` in `js/config.js:17`), not the next merge value. A new player can read this as “I need to make 128 before anything fuses”, which is false — 2+2 fuses to 4 immediately.

References: `index.html:41` (`hud-next`), `js/strings.js:5` (`nextFuse: ['下一熔合','NEXT FUSE']`), `js/main.js:100-106` (progress math).

Fix direction: rename the label to **下一區域 / NEXT ZONE** (or show the next mergeable core separately). Keep the progress bar; only the label is misleading.

### 4. MEDIUM / EDGE — LOCK CORE can leave a board that says “movable” but has no legal move

Pure-logic reproduction:

```
values = [8,8,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
armLock(1), lock the first 8
canMove() -> true
move('left') -> null
move('left', {pulse:true}) -> null
```

`canMove()` (`js/logic.js:191-198`) counts the locked tile's equal neighbour as a legal merge, but `_slide()` and `_pulse()` both refuse to merge a locked tile. The game therefore does not show “系統飽和” although the player has no normal move. In practice this needs a very specific late lock-zone board, but it is a correctness hole.

Fix direction: make `canMove()` ignore equal pairs that involve the locked tile, or end the lock early when no legal move exists. Add a unit test with the exact board above.

### 5. LOW — the first completed run never shows “NEW RECORD”

`js/main.js:253` only sets `S.newRecord` when `store.best > 0`. On a fresh install `store.best` is 0, so the first run’s result screen has `#newrecord` hidden even when the score is above zero. This is a small reward gap, not a blocker. If desired, treat `store.best === 0 && score > 0` as a first record.

## What is already good

- First 30 seconds are clear: the start screen says “滑動合併…” and the large start button is the obvious action; no overlay or clipping at 390 px.
- The core loop has useful feedback: slide nudge, merge pop, combo aura, haptics, zone banner, undo/rewind.
- No timer and no forced fail pressure fit the “relaxing commute” positioning.
- Pure logic tests and AI bench are healthy; no console errors in the checked browser runs.

## Not changed in this pass

No gameplay, CSS, strings or tests were modified. This commit is the audit only, so each fix can be reviewed and reverted separately.

## Suggested next sequence

1. Mute-row fit + 360/390 guard.
2. Pulse lock probe + undo guard.
3. `下一熔合` → `下一區域`.
4. Lock deadlock `canMove` + test.
5. First-run record (optional polish).
