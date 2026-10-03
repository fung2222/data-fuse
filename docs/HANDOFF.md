# DATA FUSE 數據熔合 — Handoff

Status: **web build done (v1.0)** · live https://fung2222.github.io/data-fuse/ · not yet packaged for Android.
Part of CYBER ARCADE (see `fung2222/cyber-arcade/docs/ARCADE-HANDOFF.md` for the series rules: never port code from `sono`, AdMob policy, naming).

## 1. Design
A slide-and-merge number puzzle (the classic 4×4 merge genre) rebuilt from scratch as a relaxing commute game:
- Glass data cubes on a floating holo board above a rainy neon Kowloon street.
- Every merge: chime pitched by tier, particle burst, floor shockwave, socket heat glow, popup for ≥16. Merges of 128+ add camera shake + haptic.
- **No timer, no fail pressure.** Milestone tiles (128, 256, … 131072) open a new *zone*: the city colour theme changes (6 HK district palettes from cyber-kit), banner, +1 undo (up to the free cap).
- **Undo**: up to 3 steps back; 2 free charges per run; refill +3 via rewarded hook (web: free claim dialog).
- **Game over** "系統飽和 GRID SATURATED": gentle descending pad (not a crash). Offers "rewind 3 steps" (rewarded hook) or retry.
- **Attract mode**: the AI plays quietly behind the start screen. `?demo=1` = full AI autoplay loop (store video / screenshots).
- Save/resume: the run is saved after every move (`cyber.data-fuse.save`); the start screen offers CONTINUE.
- Store name must NOT contain "2048" (trademark / spam risk). Use 數據熔合 DATA FUSE.

## 2. Controls
Swipe anywhere (one direction per finger-down, 22 px threshold) · arrows/WASD · Z/U/Backspace undo · P/Esc pause · M mute · R new game (confirm) · Enter/Space start/resume/retry · F fps. Android back: closes dialog → pause → resume; on menu → minimise (cyber-kit Platform).

## 3. Tuning constants (`js/config.js` — the only place to tune)
| Constant | Value | Meaning |
|---|---|---|
| `SIZE` | 4 | board size |
| `SPAWN_FOUR_CHANCE` | 0.1 | chance a spawn is a 4 |
| `UNDO_DEPTH` / `UNDO_FREE` / `UNDO_REWARD` | 3 / 2 / 3 | history depth, free charges per run, charges per rewarded |
| `MILESTONES` | 128 … 131072 | authored zone thresholds (kept for reference/tests) |
| `zoneForTile(v)` / `nextMilestone(v)` | log2(v) − 5 / next power of two ≥ 128 | **endless**: procedural zones forever (262144 = zone 13 …) |
| `fourChanceFor(zone)` | 0.1 + 1 %/zone beyond zone 6, cap 0.2 | endless difficulty curve (applied in `updateHUD`) |
| `T_SLIDE` / `T_POP` / `T_SPAWN` | 0.11 / 0.24 / 0.18 s | animation timings |
| `AI_DEMO_INTERVAL` / `AI_ATTRACT_INTERVAL` / `AI_DEPTH` | 0.26 / 0.62 s / 2 | autopilot pacing and expectimax depth |
| `CELL` / `TILE` / `TILE_H` / `BOARD_Y` | 1.25 / 1.06 / 0.5 / 4.2 | 3D layout |
| `ADS` | cooldown 240 s, every 3rd break, 180 s grace | interstitial caps |
| `TIER_COLORS` | per log2 tier | tile colours (2048 = white-gold) |

Camera framing lives in `frameCamera()` in `js/main.js` (portrait: board fills the width; landscape: centred; attract: orbit, board to the right of the hero panel on desktop).

## 3b. Endless mode & i18n (v1.1)
- No win state. Zones are procedural (`zoneForTile`), so a new district banner + theme shift + undo bonus arrives at every doubling with no ceiling; labels switch to `ENDLESS ZONE n` beyond 131072. Records: `bestTile` (best core) and derived best zone on the start screen.
- Difficulty: `fourChanceFor` raises the 4-spawn chance slowly after 2048, capped at 20 %. Test hook: `__fuse.api.endlessTest()` fuses 131072+131072.
- Strings: `js/strings.js` (cyber-kit v0.2.1 i18n, `{key: [zh-HK, en]}`); HTML uses `data-i18n*`; toggles `#btn-lang` (start) / `#btn-lang2` (pause); `?lang=en|zh`.
- Natural ad breaks unchanged: game over (Retry/Menu). Never at a zone banner.

## 4. File map
```
index.html          HUD + screens + import map (three, cyber-kit)
css/game.css        game-specific layout on top of vendor/cyber-kit/ui/hud.css
js/config.js        all constants
js/logic.js         FuseGame: pure rules (ids, move records, snapshot/restore, seeded rng)
js/ai.js            expectimax autoplayer (demo / attract)
js/board.js         BoardView: slab, socket shader, glass tile pool, slide/merge/spawn animation, tilt spring
js/labels.js        number textures (Orbitron, cached canvases)
js/audio.js         FuseAudio extends cyber-kit SynthAudio ('chill' music, tiered chimes)
js/main.js          states (attract/playing/paused/over), input, undo, milestones, effects, camera, saves, ads hooks
vendor/cyber-kit/   cyber-kit v0.1.0 (includes three r169) — do not edit here; update from the kit repo
tests/              logic.test.mjs, ai.bench.mjs, smoke.py
privacy.html        zh-HK + EN privacy policy (localStorage only; future AdMob)
```
Test hook: `window.__fuse` (state, game, history, undo, `api.move/undo/forceOver`).

## 5. Tests
```bash
python3 -m http.server 18940          # from the parent folder
node tests/logic.test.mjs             # rules: slides, double merges, no chain merge, spawn, game over, snapshot
node tests/ai.bench.mjs               # AI reaches 2048 (≈3–4 ms / move)
python tests/smoke.py [url] [outdir]  # Playwright: 412×915 touch + 1280×800 — start, swipe, keys, undo, pause,
                                      # game over, rewind, continue after reload, demo, language toggle/persist,
                                      # endless zone 13 (beyond 131072), zero console errors
```
Last run 2026-10-02 (v1.1): logic ALL PASSED (incl. endless zone/curve tests) · smoke ALL PASSED (both viewports, zero console errors).

## 6. Android / Capacitor packaging outline
1. `npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/app @capacitor/haptics @capacitor-community/admob@^8` (Capacitor 8).
2. `npx cap init "數據熔合 DATA FUSE" hk.fung2222.datafuse --web-dir=www`; copy `index.html css js vendor privacy.html` into `www/` (a 5-line copy script; no bundler needed).
3. `npx cap add android`; add the AdMob App ID to `AndroidManifest.xml` (`com.google.android.gms.ads.APPLICATION_ID`); portrait lock; immersive theme.
4. Fill real ad unit ids in `js/config.js` → `ADS.units.android` and set `testing: false` in the release build only.
5. `npx cap sync && npx cap open android` → signed AAB.
cyber-kit's `Platform` / `createAds` already wire back button, pause/resume, haptics, UMP consent and the AdMob calls; the web build stays ad-free.

## 7. Ad placement points (policy: AdMob only, never AdSense)
| Placement | Type | Where in code | Rule |
|---|---|---|---|
| `gameover` | interstitial | `retry()` / `overToMenu()` → `ads.naturalBreak('gameover')` | only after the player taps Retry/Menu; capped (240 s cooldown, every 3rd game over, 180 s grace). Never at launch, exit or game start. |
| `undo` | rewarded | `undo()` when charges = 0 | opt-in dialog, reward = +3 undo |
| `revive` | rewarded | `revive()` on game over | opt-in, reward = rewind 3 steps |
Also needed for Play: privacy options entry (`ads.privacyOptionsRequired` → button on the start screen), Data safety form (ads ID collected by AdMob), target audience 13+, app-ads.txt after AdMob linking.

## 8. Known issues / next steps
- Headless SwiftShader runs at ~3 FPS so screenshots show some motion blur in aberration; real phones run 60 FPS (auto-quality drops pixel ratio if needed).
- No privacy-options button yet (only needed in the native build — add when packaging).
- Possible polish: haptics toggle in a settings panel; colour-blind friendly tile glyph mode; daily seed challenge.

## Audio loudness + glow (cyber-kit v0.3.0, 2026-10-03)
- Audio: kit loudness model (music ≈ −20 LUFS integrated, median SFX ≈ music level). This game: music 'chill', sfxTrimDb 7.5 in `js/audio.js`. Re-measure after changing sounds: `python3 ../cyber-kit/tests/loudness.py http://127.0.0.1:18940 <dir>:<AudioClass> --kit /cyber-kit` (see kit docs/API.md "Loudness"). Keep music −20 ± 1 LUFS and SFX/BGM 0 ± 2 dB.
- Glow: `createStage` values are the HIGH look; default is LOW (crisp). Shared pref `localStorage cyber.glow`, `?glow=low|high`. Pause screen has a GLOW: LOW/HIGH button (`ui.glowToggle(stage)`).
