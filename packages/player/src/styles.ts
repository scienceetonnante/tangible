// Base player styles (layer stacking + chrome), exported as a string so a lesson
// page or the preview server can inject them without a separate CSS asset.

export const PLAYER_CSS = `
.xv-player { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #fafafa; overflow: hidden; user-select: none; }
.xv-player > canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.xv-overlay { position: absolute; inset: 0; pointer-events: none; }
.xv-board { position: absolute; top: 0; right: 0; width: 28%; height: 100%; padding: 12px; box-sizing: border-box; overflow: auto; }
.xv-captions { position: absolute; left: 0; right: 0; bottom: 48px; text-align: center; font: 18px/1.4 sans-serif; color: #111; text-shadow: 0 1px 2px #fff; }
.xv-board-inner { display: flex; flex-direction: column; gap: 10px; }
.xv-board-item { transition: opacity 200ms ease; }
.xv-board-item.xv-hidden { display: none; }
.xv-board-item.xv-shown { opacity: 1; }
.xv-board-item.xv-dimmed { opacity: 0.4; }
.xv-hl { background: #fff3a0; border-radius: 3px; }
.xv-gate { position: absolute; inset: 0; display: none; align-items: flex-end; justify-content: center; pointer-events: none; padding-bottom: 60px; }
.xv-gate-box { pointer-events: auto; background: rgba(20,20,20,0.9); color: #fff; padding: 12px 16px; border-radius: 8px; display: flex; gap: 12px; align-items: center; }
.xv-gate-box button { background: #fff; border: none; border-radius: 4px; padding: 4px 10px; cursor: pointer; }
.xv-chrome { position: absolute; left: 0; right: 0; bottom: 0; height: 44px; display: flex; align-items: center; gap: 6px; padding: 0 8px; background: rgba(255,255,255,0.85); box-sizing: border-box; }
.xv-chrome button { border: none; background: none; cursor: pointer; color: #222; font-size: 18px; height: 34px; min-width: 34px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; border-radius: 4px; }
.xv-chrome button:hover { background: rgba(0,0,0,0.06); }
.xv-scrubber { flex: 1; height: 34px; cursor: pointer; }
.xv-elapsed { font: 12px monospace; color: #333; min-width: 90px; text-align: right; }
`;
