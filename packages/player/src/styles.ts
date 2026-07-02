// Base player styles (layer stacking + chrome), exported as a string so a lesson
// page or the preview server can inject them without a separate CSS asset.

export const PLAYER_CSS = `
.xv-player { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #fafafa; overflow: hidden; user-select: none; }
.xv-player > canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.xv-overlay { position: absolute; inset: 0; pointer-events: none; }
.xv-board { position: absolute; top: 0; right: 0; width: 28%; height: 100%; padding: 12px; box-sizing: border-box; overflow: auto; }
.xv-captions { position: absolute; left: 0; right: 0; bottom: 48px; text-align: center; font: 18px/1.4 sans-serif; color: #111; text-shadow: 0 1px 2px #fff; }
.xv-gate { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; }
.xv-chrome { position: absolute; left: 0; right: 0; bottom: 0; height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 8px; background: rgba(255,255,255,0.85); }
.xv-chrome button { border: none; background: none; font-size: 16px; cursor: pointer; }
.xv-scrubber { flex: 1; }
.xv-elapsed { font: 12px monospace; color: #333; min-width: 90px; text-align: right; }
`;
