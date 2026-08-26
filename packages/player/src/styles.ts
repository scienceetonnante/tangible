// Base player styles (layer stacking + chrome), exported as a string so a lesson
// page or the preview server can inject them without a separate CSS asset.

export const PLAYER_CSS = `
.xv-shell { width: min(100%, 177.7778vh); width: min(100%, 177.7778dvh); margin-inline: auto; }
/* Reserve the height of the closed assistant drawer below the 16:9 scene. */
.xv-shell.xv-with-assistant { width: min(100%, max(0px, calc(177.7778vh - 116px))); width: min(100%, max(0px, calc(177.7778dvh - 116px))); }
.xv-player { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #fafafa; overflow: hidden; user-select: none; }
.xv-player > canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
.xv-overlay { position: absolute; inset: 0; pointer-events: none; }
.xv-board { position: absolute; top: 0; right: 0; width: 28%; height: 100%; padding: 12px; box-sizing: border-box; overflow: auto; pointer-events: none; }
.xv-captions { position: absolute; left: 3%; right: 30%; bottom: 60px; padding: 3px 8px; text-align: center; font: clamp(15px, 2.1vw, 18px)/1.35 sans-serif; color: #111; text-shadow: 0 1px 2px #fff; pointer-events: none; }
.xv-board-inner { display: flex; flex-direction: column; gap: 10px; }
.xv-board-item { transition: opacity 200ms ease; pointer-events: auto; }
.xv-board-item.xv-hidden { display: none; }
.xv-board-item.xv-shown { opacity: 1; }
.xv-board-item.xv-dimmed { opacity: 0.4; }
.xv-hl { background: #fff3a0; border-radius: 3px; }
.xv-start-screen { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; overflow: auto; padding: clamp(14px, 3vw, 28px); box-sizing: border-box; background: rgba(4, 8, 15, 0.46); -webkit-backdrop-filter: grayscale(0.55) brightness(0.72); backdrop-filter: grayscale(0.55) brightness(0.72); color: #fff; font-family: system-ui, sans-serif; user-select: text; }
.xv-start-content { width: min(560px, 100%); padding: clamp(22px, 3.5vw, 34px); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 20px; box-sizing: border-box; background: rgba(18, 27, 41, 0.84); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.38); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
.xv-start-kind { margin-bottom: 10px; color: #b9d8ed; font-size: clamp(11px, 1.4vw, 13px); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.xv-start-title { max-width: 21ch; margin: 0; font-size: clamp(26px, 4.2vw, 40px); line-height: 1.05; letter-spacing: -0.025em; }
.xv-start-promise { max-width: 46ch; margin: 12px 0 0; font-size: clamp(16px, 2vw, 20px); line-height: 1.35; }
.xv-start-meta { margin: 12px 0 0; color: #cbd8e4; font-size: clamp(13px, 1.6vw, 15px); }
.xv-start-interactive { margin: 7px 0 0; color: #e5edf3; font-size: clamp(13px, 1.6vw, 15px); }
.xv-orientation-notice { display: none; margin: 12px 0 0; padding-left: 22px; color: #ffe6a6; font-size: 14px; line-height: 1.4; }
.xv-orientation-notice::before { content: "↻"; display: inline-block; width: 22px; margin-left: -22px; }
.xv-start-controls { display: flex; align-items: center; gap: 18px; margin-top: clamp(18px, 3vw, 28px); }
.xv-start-status { display: flex; flex: 1; align-items: center; gap: 10px; min-width: 0; color: #cbd8e4; font-size: 14px; }
.xv-start-screen[data-state="failed"] .xv-start-status { color: #ffd0c8; }
.xv-loading-spinner { width: 16px; height: 16px; flex: 0 0 auto; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: xv-spin 800ms linear infinite; }
.xv-loading-spinner[hidden] { display: none; }
.xv-start-button { min-width: 150px; min-height: 48px; padding: 12px 22px; border: 0; border-radius: 999px; background: #fff; color: #172033; font: 700 16px/1.2 system-ui, sans-serif; cursor: pointer; }
.xv-start-button:hover:not(:disabled) { background: #dff2ff; transform: translateY(-1px); }
.xv-start-button:focus-visible { outline: 3px solid #78c7ff; outline-offset: 3px; }
.xv-start-button:disabled { cursor: wait; opacity: 0.55; }
@keyframes xv-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .xv-loading-spinner { animation-duration: 1600ms; } .xv-start-button { transform: none !important; } }
@media (max-width: 700px) { .xv-orientation-notice { display: block; } }
@media (max-width: 520px) { .xv-start-screen { align-items: start; padding: 12px; } .xv-start-content { padding: 20px; border-radius: 16px; } .xv-start-controls { align-items: stretch; flex-direction: column-reverse; gap: 12px; margin-top: 18px; } .xv-start-button { width: 100%; } }
@media (max-height: 500px) and (orientation: landscape) {
  .xv-start-screen { align-items: start; padding: 8px; }
  .xv-start-content { padding: 14px 18px; border-radius: 14px; }
  .xv-start-kind { margin-bottom: 6px; font-size: 10px; }
  .xv-start-title { font-size: 28px; }
  .xv-start-promise { margin-top: 8px; font-size: 15px; line-height: 1.3; }
  .xv-start-meta { margin-top: 8px; font-size: 13px; }
  .xv-start-interactive { margin-top: 4px; font-size: 13px; }
  .xv-start-controls { margin-top: 12px; }
  .xv-start-button { min-height: 44px; }
}
.xv-chrome { position: absolute; left: 0; right: 0; bottom: 0; height: 52px; display: flex; align-items: center; gap: 6px; padding: 0 8px; background: rgba(255,255,255,0.88); box-sizing: border-box; }
.xv-chrome button { border: none; background: none; cursor: pointer; color: #222; font-size: 18px; height: 44px; min-width: 44px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; border-radius: 6px; }
.xv-chrome button:hover { background: rgba(0,0,0,0.06); }
.xv-chrome button:focus-visible, .xv-scrubber:focus-visible { outline: 3px solid #1677b8; outline-offset: 1px; }
.xv-scrubber { flex: 1; min-width: 44px; height: 44px; cursor: pointer; }
.xv-elapsed { font: 12px monospace; color: #333; min-width: 90px; text-align: right; }
.xv-portrait-message { display: none; }
.xv-assistant { border: 1px solid #cbd2da; border-top: 0; background: #f6f8fa; color: #20252c; font: 14px/1.4 system-ui, sans-serif; box-sizing: border-box; }
.xv-assistant-toggle { width: 100%; min-height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border: 0; background: transparent; color: inherit; font: 650 15px/1.2 system-ui, sans-serif; text-align: left; cursor: pointer; }
.xv-assistant-toggle::after { content: "⌄"; margin-left: 16px; font-size: 22px; line-height: 1; transition: transform 160ms ease; }
.xv-assistant-toggle[aria-expanded="true"]::after { transform: rotate(180deg); }
.xv-assistant-body { padding: 12px; border-top: 1px solid #cbd2da; }
.xv-assistant-body[hidden] { display: none; }
.xv-assistant-transcript:empty { display: none; }
.xv-assistant-transcript { max-height: min(240px, 30dvh); overflow: auto; margin-top: 8px; }
.xv-assistant-turn { border-left: 3px solid #ddd; padding-left: 9px; margin: 8px 0; }
.xv-assistant-question { margin: 0 0 4px; font-weight: 600; }
.xv-assistant-answer { margin: 0; }
.xv-assistant-form { display: flex; gap: 6px; }
.xv-assistant-input { flex: 1; min-width: 0; min-height: 44px; padding: 8px 10px; border: 1px solid #929ba5; border-radius: 6px; box-sizing: border-box; font: inherit; }
.xv-assistant-input:disabled { color: #777; background: #eee; }
.xv-assistant button:not(.xv-assistant-toggle) { min-height: 44px; padding: 6px 12px; border: 1px solid #929ba5; border-radius: 6px; background: #fff; color: inherit; cursor: pointer; }
.xv-assistant button:disabled { cursor: default; opacity: 0.5; }
.xv-assistant button:focus-visible, .xv-assistant-input:focus-visible { outline: 3px solid #1677b8; outline-offset: 2px; }
.xv-assistant-footer { display: flex; justify-content: space-between; align-items: center; min-height: 44px; margin-top: 4px; color: #5b626b; font-size: 12px; }
.xv-assistant-clear { border: 0 !important; background: transparent !important; color: inherit; }
@media (max-width: 520px) {
  .xv-assistant-form { display: grid; grid-template-columns: 1fr auto; }
  .xv-assistant-input { grid-column: 1 / -1; }
}
@media (max-width: 600px) and (orientation: portrait) {
  .xv-portrait-message { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; box-sizing: border-box; background: #111827; color: #f8fafc; text-align: center; font-family: system-ui, sans-serif; user-select: text; }
  .xv-portrait-title { font-size: 19px; line-height: 1.2; }
  .xv-portrait-explanation { max-width: 34ch; color: #d9e2ec; font-size: 15px; line-height: 1.4; }
}
`;
