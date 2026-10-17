// DATA FUSE string table {key: [zh-HK, en]} — cyber-kit i18n.
import { i18n } from 'cyber-kit';
i18n.add({
  'doc.title': ['數據熔合 DATA FUSE · 賽博朋克 3D 合併解壓', 'DATA FUSE · cyberpunk 3D merge puzzle'],
  score: ['分數', 'SCORE'], best: ['最高分', 'BEST'], zone: ['區域', 'ZONE'], core: ['核心', 'CORE'], nextFuse: ['下一熔合', 'NEXT FUSE'],
  undo: ['復原', 'UNDO'], undoS: ['UNDO · Z', 'Z'], undoTip: ['復原 (Z / Backspace)', 'Undo (Z / Backspace)'],
  newTip: ['新一局 (R)', 'New game (R)'], pauseTip: ['暫停 (P / Esc)', 'Pause (P / Esc)'], muteTip: ['靜音 (M)', 'Mute (M)'],
  title: ['數據熔合', 'DATA FUSE'], titleEn: ['DATA FUSE', '數據熔合'],
  tagline: ['滑動合併發光數據方塊，熔出更強嘅核心。<br>冇時間限制、冇終點 —— 區域無盡，慢慢嚟。', 'Swipe to merge glowing data blocks into stronger cores.<br>No timer, no finish line — zones go on forever. Relax.'],
  continue: ['繼續上局', 'CONTINUE'], continueS: ['{score} 分', '{score} PTS'], start: ['開始遊戲', 'START'], startS: ['START · ENTER', 'ENTER'],
  touchHint: ['手機：喺畫面任何位置滑動 · 長按滑動＝脈衝熔合', 'Touch: swipe anywhere · hold-swipe = Pulse Fuse'],
  keysHint: ['<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移動　長按＝脈衝　<kbd>Z</kbd> 復原　<kbd>H</kbd> 提示　<kbd>P</kbd> 暫停　<kbd>M</kbd> 靜音', '<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move　hold = Pulse　<kbd>Z</kbd> undo　<kbd>H</kbd> hint　<kbd>P</kbd> pause　<kbd>M</kbd> mute'],
  bestTile: ['最強核心', 'BEST CORE'], bestZone: ['最遠區域（無盡紀錄）', 'ENDLESS BEST ZONE'], bestTileRun: ['最強核心', 'BEST CORE'], moves: ['步數', 'MOVES'],
  pausedS: ['PAUSED', '已暫停'], saved: ['進度已儲存', 'progress saved'],
  overK: ['GRID SATURATED', '網格飽和'], over: ['系統飽和', 'NO MOVES'], overS: ['NO MOVES', '系統飽和'],
  rewind: ['倒帶 3 步繼續', 'REWIND 3 & CONTINUE'], rewindAd: ['睇段廣告', 'WATCH AD'], rewindFree: ['免費', 'FREE'], retry: ['再嚟一鋪', 'RETRY'],
  fuseN: ['{v} 熔合', '{v} FUSED'], zoneN: ['第 {n} 區 · 新區域', 'ZONE {n} · NEW DISTRICT'],
  legendary: ['傳說核心！', 'LEGENDARY CORE!'], beyond: ['超越極限', 'BEYOND LIMITS'], endlessZone: ['無盡區域 {n}', 'ENDLESS ZONE {n}'], entering: ['進入 {name}', 'ENTERING {name}'],
  zoneBonus: ['區域獎勵：復原 +1', 'ZONE BONUS: UNDO +1'], noReward: ['冇攞到獎勵', 'No reward'], rewound: ['已倒帶', 'REWOUND'], nothingUndo: ['冇步可以復原', 'Nothing to undo'],
  undoMoreQ: ['補充 3 次復原？', 'Refill 3 undos?'], undoMore: ['補充 3 次復原', 'Refill 3 undos'],
  adText: ['睇一段自願觀看嘅獎勵廣告即可補充。唔睇都可以照玩。', 'Watch an optional rewarded ad to refill. You can keep playing without it.'],
  freeText: ['網頁版免費補充。(App 版會用自願觀看嘅獎勵廣告。)', 'Free on the web. (The app uses an optional rewarded ad.)'], claim: ['領取', 'CLAIM'],
  newQ: ['開新一局？', 'Start a new game?'], newText: ['目前呢局會清除。', 'The current game will be cleared.'], newGame: ['開新一局', 'NEW GAME'], keepPlaying: ['繼續玩', 'KEEP PLAYING'],
  endless: ['無盡', 'ENDLESS'], fatal: ['載入失敗', 'Failed to start'],
  // v1.2 polish + twists
  combo: ['連熔', 'COMBO'], comboText: ['連熔 ×{n}', 'COMBO ×{n}'],
  pulse: ['脈衝熔合', 'PULSE FUSE'], pulseS: ['PULSE · HOLD', '長按'], pulseTip: ['脈衝熔合：長按方向鍵／滑動（消耗 1 次復原）', 'Pulse Fuse: hold direction / swipe (costs 1 undo)'],
  pulseNeed: ['脈衝需要 1 次復原', 'Pulse needs 1 undo'], pulseNo: ['呢邊冇得脈衝熔合', 'Nothing to pulse-fuse that way'],
  hintTip: ['合併提示 (H)', 'Merge hint (H)'],
  'mod.drift': ['數據漂移', 'DATA DRIFT'], 'mod.driftS': ['熔合後兩粒低階方塊會對調', 'After a merge, two low tiles soft-swap'],
  'mod.lock': ['鎖定核心', 'LOCK CORE'], 'mod.lockS': ['最強方塊固定 1 次滑動', 'Highest tile pinned for 1 swipe'],
  'mod.surge': ['分數超頻', 'SCORE SURGE'], 'mod.surgeS': ['本區熔合分數 ×1.5 · 復原 +1', 'Merge score ×1.5 · undo +1'],
  'mod.echo': ['回聲生成', 'ECHO SPAWN'], 'mod.echoS': ['新方塊出現前會先閃格預告', 'Next spawn cell telegraphs before appearing'],
  perfectFuse: ['完美熔合', 'PERFECT FUSE'],
  // How-to modal bodies (HTML)
  'help.rules': [
    '<ul><li>喺畫面<strong>任何位置滑動</strong>（或方向鍵／WASD），全部數據方塊一齊滑向嗰邊。</li><li>兩粒<strong>相同數字</strong>相撞就熔合成雙倍。同一趟唔會連環再熔。</li><li><strong>冇時間限制</strong>。熔出 128、256… 進入新<strong>區域</strong>（換色＋獎勵）。</li><li><strong>無盡模式</strong>：冇過關終點，區域一直開落去。</li><li>第 3 區起循環<strong>區規</strong>：漂移／鎖定核心／分數超頻／回聲生成。</li><li><strong>脈衝熔合</strong>（長按滑動／方向）：只熔相鄰同號，唔會成行滑動；消耗 1 次復原。</li><li>冇得郁＝系統飽和；可倒帶 3 步或重開。</li></ul>',
    '<ul><li><strong>Swipe anywhere</strong> (or arrows / WASD) to slide every data cube.</li><li>Two <strong>equal</strong> cubes fuse into double. No chain-merge in one move.</li><li><strong>No timer.</strong> Hitting 128, 256… opens a new <strong>zone</strong> (theme + bonus).</li><li><strong>Endless:</strong> no finish line — zones keep going.</li><li>From zone 3, cycling <strong>zone mods</strong>: Drift / Lock Core / Score Surge / Echo Spawn.</li><li><strong>Pulse Fuse</strong> (hold swipe / arrow): only adjacent equals fuse in place; costs 1 undo.</li><li>No moves = Grid Saturated; rewind 3 steps or retry.</li></ul>'
  ],
  'help.controls': [
    '<ul><li>移動：滑動 · <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / <kbd>WASD</kbd></li><li>脈衝熔合：<strong>長按</strong>滑動或方向鍵（或撳脈衝掣）</li><li>復原：復原掣 · <kbd>Z</kbd> / <kbd>U</kbd> / Backspace</li><li>合併提示：<kbd>H</kbd> 或提示掣（可開關）</li><li>暫停 <kbd>P</kbd>／Esc · 靜音 <kbd>M</kbd> · 新一局 <kbd>R</kbd></li></ul>',
    '<ul><li>Move: swipe · <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / <kbd>WASD</kbd></li><li>Pulse Fuse: <strong>hold</strong> swipe or arrow (or Pulse button)</li><li>Undo: button · <kbd>Z</kbd> / <kbd>U</kbd> / Backspace</li><li>Merge hint: <kbd>H</kbd> or hint button (toggle)</li><li>Pause <kbd>P</kbd>/Esc · Mute <kbd>M</kbd> · New game <kbd>R</kbd></li></ul>'
  ],
});
