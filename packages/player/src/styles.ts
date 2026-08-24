// Base player styles (layer stacking + chrome), exported as a string so a lesson
// page or the preview server can inject them without a separate CSS asset.

export const PLAYER_CSS = `
.xv-shell { width: 100%; }
.xv-player { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #fafafa; overflow: hidden; user-select: none; }
.xv-player > canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
.xv-overlay { position: absolute; inset: 0; pointer-events: none; }
.xv-board { position: absolute; top: 0; right: 0; width: 28%; height: 100%; padding: 12px; box-sizing: border-box; overflow: auto; pointer-events: none; }
.xv-captions { position: absolute; left: 0; right: 0; bottom: 48px; text-align: center; font: 18px/1.4 sans-serif; color: #111; text-shadow: 0 1px 2px #fff; }
.xv-board-inner { display: flex; flex-direction: column; gap: 10px; }
.xv-board-item { transition: opacity 200ms ease; pointer-events: auto; }
.xv-board-item.xv-hidden { display: none; }
.xv-board-item.xv-shown { opacity: 1; }
.xv-board-item.xv-dimmed { opacity: 0.4; }
.xv-hl { background: #fff3a0; border-radius: 3px; }
.xv-start-overlay { position: absolute; inset: 0; z-index: 10; border: 0; background: rgba(0,0,0,0.42); color: #fff; font: 600 24px/1.2 sans-serif; cursor: pointer; }
.xv-start-overlay:hover { background: rgba(0,0,0,0.5); }
.xv-chrome { position: absolute; left: 0; right: 0; bottom: 0; height: 44px; display: flex; align-items: center; gap: 6px; padding: 0 8px; background: rgba(255,255,255,0.85); box-sizing: border-box; }
.xv-chrome button { border: none; background: none; cursor: pointer; color: #222; font-size: 18px; height: 34px; min-width: 34px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; border-radius: 4px; }
.xv-chrome button:hover { background: rgba(0,0,0,0.06); }
.xv-scrubber { flex: 1; height: 34px; cursor: pointer; }
.xv-elapsed { font: 12px monospace; color: #333; min-width: 90px; text-align: right; }
.xv-assistant { border: 1px solid #ddd; border-top: 0; padding: 10px; background: #fff; color: #222; font: 14px/1.4 sans-serif; }
.xv-assistant-transcript:empty { display: none; }
.xv-assistant-transcript { max-height: 180px; overflow: auto; margin-top: 8px; }
.xv-assistant-turn { border-left: 3px solid #ddd; padding-left: 9px; margin: 8px 0; }
.xv-assistant-question { margin: 0 0 4px; font-weight: 600; }
.xv-assistant-question::before { content: "You: "; }
.xv-assistant-answer { margin: 0; }
.xv-assistant-answer::before { content: "Narrator: "; font-weight: 600; }
.xv-assistant-form { display: flex; gap: 6px; }
.xv-assistant-input { flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid #aaa; border-radius: 4px; font: inherit; }
.xv-assistant-input:disabled { color: #777; background: #eee; }
.xv-assistant button { padding: 6px 10px; border: 1px solid #aaa; border-radius: 4px; background: #f7f7f7; cursor: pointer; }
.xv-assistant button:disabled { cursor: default; opacity: 0.5; }
.xv-assistant-footer { display: flex; justify-content: space-between; align-items: center; min-height: 28px; margin-top: 4px; color: #666; font-size: 12px; }
.xv-assistant-clear { border: 0 !important; background: transparent !important; color: inherit; }
`;
