// DATA FUSE 數據熔合 — every tuning constant lives here (single source of truth).
export const GAME_ID = 'data-fuse';

export const SIZE = 4;                 // board is SIZE x SIZE
export const SPAWN_FOUR_CHANCE = 0.1;  // chance a new tile is a 4 instead of 2
export const START_TILES = 2;

// Undo: last N board states are kept; each undo costs one charge.
export const UNDO_DEPTH = 3;
export const UNDO_FREE = 2;            // free charges at the start of every run
export const UNDO_REWARD = 3;          // charges granted by one rewarded ad (web build: free)

// Milestones: reaching each tile value the first time in a run = new zone (colour theme + banner).
export const MILESTONES = [128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];

// Animation timings (seconds)
export const T_SLIDE = 0.11;
export const T_POP = 0.24;
export const T_SPAWN = 0.18;

// AI pacing (seconds per move)
export const AI_DEMO_INTERVAL = 0.26;     // ?demo=1
export const AI_ATTRACT_INTERVAL = 0.62;  // background play behind the start screen
export const AI_DEPTH = 2;

// 3D layout (world units)
export const CELL = 1.25;              // centre-to-centre spacing
export const TILE = 1.06;              // tile footprint
export const TILE_H = 0.5;             // tile height
export const BOARD_Y = 4.2;            // board top surface height above the street
export const BOARD_HALF = SIZE * CELL / 2 + 0.32;

// Ads (web build: no ads; Android build: AdMob via cyber-kit createAds)
export const ADS = {
  interstitialCooldownSec: 240,   // at most one interstitial every 4 minutes
  breaksBetweenInterstitials: 3,  // and only every 3rd game over
  graceSec: 180,                  // never in the first 3 minutes after launch
  // Fill in real AdMob unit ids before the Play release (leave unset = Google test ads)
  units: { android: { /* interstitial: 'ca-app-pub-XXXX/YYYY', rewarded: 'ca-app-pub-XXXX/ZZZZ' */ } },
};

// Tile colours by tier (log2 value). 2048 is white-gold; above 8192 the colour cycles.
export const TIER_COLORS = {
  1: 0x00e5ff, 2: 0x2f8bff, 3: 0x7a5cff, 4: 0xc03bff, 5: 0xff2bd6, 6: 0xff3b6b,
  7: 0xff7a2b, 8: 0xffc22b, 9: 0xc8ff2b, 10: 0x3bff8a, 11: 0xfff1b8, 12: 0xff4dff, 13: 0x4dfcff,
};
export const tierOf = (v) => Math.round(Math.log2(v));
export const colorOf = (v) => { const t = tierOf(v); return TIER_COLORS[t] ?? TIER_COLORS[11 + ((t - 11) % 3)]; };
