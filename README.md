# 數據熔合 DATA FUSE

> 賽博朋克 3D 數字合併解壓遊戲 · cyberpunk 3D merge puzzle · Three.js · 手機優先

**試玩 Play:** https://fung2222.github.io/data-fuse/ · **自動示範 Demo:** https://fung2222.github.io/data-fuse/?demo=1

![DATA FUSE](docs/shots/desktop-play.png)

## 玩法 How to play
- 喺畫面任何位置**滑動**（或用方向鍵 / WASD），所有數據方塊會一齊滑向嗰邊。
- 兩粒相同數字嘅方塊相撞就會**熔合**成雙倍。每次熔合都有衝擊波同音效。
- 冇時間限制。慢慢諗，放鬆一下。
- 熔出 128、256、512… 會進入新**區域**，城市換色，仲會送你一次復原。
- **復原 UNDO**：每局有 2 次免費，最多倒返 3 步。用完可以補充（網頁版免費；App 版用自願觀看嘅獎勵廣告）。
- 冇得郁就「系統飽和」，可以倒帶 3 步繼續，或者再嚟一鋪。

## 操作 Controls
| 動作 Action | 手機 Touch | 鍵盤 Keyboard |
|---|---|---|
| 移動 Move | 滑動 Swipe | ↑↓←→ / WASD |
| 復原 Undo | 復原掣 | Z / U / Backspace |
| 暫停 Pause | ⏸ | P / Esc |
| 靜音 Mute | 🔊 | M |
| 新一局 New game | ⟳ | R |

## 網址參數 URL flags
`?demo=1` AI 自動玩 · `?seed=123` 固定隨機種子 · `?fps=1` 顯示 FPS · `?quality=low|med|high` · `?adsim=1` 模擬廣告流程 · `?reset=1` 清除本機紀錄 · `?mute=1`

## 技術 Tech
- Three.js r169 + [cyber-kit](https://github.com/fung2222/cyber-kit) v0.1.0（`vendor/cyber-kit/`），純 ES modules，冇 build step。
- 所有資源打包喺 repo 入面，可以離線運行（適合包成 Android App）。
- 遊戲邏輯 `js/logic.js` 完全獨立於畫面，有單元測試。

## 開發 Development
```bash
cd ..   # repo 嘅上一層
python3 -m http.server 18940
# 開 http://127.0.0.1:18940/data-fuse/
node data-fuse/tests/logic.test.mjs        # 規則測試
node data-fuse/tests/ai.bench.mjs          # AI 基準
python data-fuse/tests/smoke.py            # 無頭瀏覽器測試 (Playwright)
```

## 文件 Docs
- [docs/HANDOFF.md](docs/HANDOFF.md) — 設計、調校常數、檔案地圖、測試、Android 打包、廣告位置
- [privacy.html](privacy.html) — 私隱政策 Privacy policy

屬於 [CYBER ARCADE](https://github.com/fung2222/cyber-arcade) 系列。
