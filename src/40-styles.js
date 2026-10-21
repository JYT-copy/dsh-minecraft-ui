
    /* ------------------------------------------------------------------ *
     * 4. Stylesheet
     *
     * Every component rule is scoped by `body[data-mc-theme="on"]`, so simply
     * removing the attribute restores the stock GUI instantly. The plugin's own
     * widgets live under `[data-mc-ui]`, whose class selectors outrank the
     * component rules above.
     * ------------------------------------------------------------------ */

    const MC_CSS = `
/* ============================ wallpaper layer ============================ */
#mc-wallpaper-layer {
  position: fixed;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  overflow: hidden;
  background: #0d0e10;
  contain: strict;
}
#mc-wallpaper-layer .mcu-wall {
  position: absolute;
  inset: -1px;
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
  image-rendering: pixelated;
  opacity: 0;
  transition: opacity var(--mc-fade, 1.8s) ease-in-out;
  will-change: opacity;
}
#mc-wallpaper-layer .mcu-wall.is-visible { opacity: 1; }
/* Photographs must scale smoothly; only the procedural scenes are pixel art. */
#mc-wallpaper-layer .mcu-wall.mcu-wall--photo { image-rendering: auto; }
#mc-wallpaper-layer .mcu-wall-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(10,11,13,0.05) 0%, rgba(10,11,13,0.08) 55%, rgba(10,11,13,0.1) 100%);
}
body[data-mc-scheme="light"] #mc-wallpaper-layer .mcu-wall-scrim {
  background: linear-gradient(180deg, rgba(252,250,246,0.05) 0%, rgba(252,250,246,0.08) 55%, rgba(250,247,241,0.1) 100%);
}
#mc-wallpaper-layer .mcu-wall-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(115% 85% at 50% 42%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.2) 100%);
}
#mc-particles {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0.85;
}
#mc-wallpaper-layer.is-off { display: none; }

/* Root + window frame must stop painting an opaque background or the wallpaper
   (a negative z-index layer) stays hidden behind the shell. */
body[data-mc-theme="on"] #root,
body[data-mc-theme="on"] [id="root"] { background: none !important; }
body[data-mc-theme="on"] [data-slot="root"],
body[data-mc-theme="on"] [data-dsh-surface="root"] { background: transparent !important; }
body[data-mc-theme="on"] [class*="_frame"] { background: transparent !important; }

/* Per-surface stone texture: barely visible grain that sells the material
   without hurting text contrast. */
body[data-mc-theme="on"] [data-dsh-surface="sidebar"],
body[data-mc-theme="on"] [data-dsh-surface="settings"] [class*="panel" i],
body[data-mc-theme="on"] [data-pane="sidebar"] {
  background-image:
    repeating-linear-gradient(0deg, rgba(255,255,255,0.016) 0 2px, rgba(0,0,0,0) 2px 5px),
    repeating-linear-gradient(90deg, rgba(0,0,0,0.045) 0 1px, rgba(0,0,0,0) 1px 26px);
}

/* ============================== buttons ================================ */
body[data-mc-theme="on"] button,
body[data-mc-theme="on"] [role="button"] {
  border-radius: 2px !important;
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 2px 0 0 rgba(0,0,0,0.34) !important;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.32);
  transition: background-color 0.12s ease, box-shadow 0.08s ease, transform 0.08s ease, color 0.12s ease;
}
body[data-mc-theme="on"] button:active:not(:disabled),
body[data-mc-theme="on"] [role="button"]:active:not([aria-disabled="true"]) {
  transform: translateY(2px);
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-dark),
    inset -2px -2px 0 0 rgba(255,255,255,0.06),
    0 0 0 0 rgba(0,0,0,0) !important;
}
body[data-mc-theme="on"] button:disabled,
body[data-mc-theme="on"] [aria-disabled="true"] {
  filter: saturate(0.55) brightness(0.9);
}

/* ============================== surfaces =============================== */
body[data-mc-theme="on"] [role="dialog"],
body[data-mc-theme="on"] [data-dsh-part="dialog"],
body[data-mc-theme="on"] [class*="dialog" i] {
  border-radius: 2px !important;
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 8px 0 0 rgba(0,0,0,0.22),
    0 18px 44px rgba(0,0,0,0.45) !important;
}
body[data-mc-theme="on"] [role="menu"],
body[data-mc-theme="on"] [role="listbox"],
body[data-mc-theme="on"] [class*="menu" i],
body[data-mc-theme="on"] [class*="popover" i] {
  border-radius: 2px !important;
  box-shadow:
    inset 1px 1px 0 0 rgba(255,255,255,0.08),
    inset -1px -1px 0 0 rgba(0,0,0,0.45),
    0 6px 18px rgba(0,0,0,0.42) !important;
}
body[data-mc-theme="on"] [class*="card" i]:not([class*="cardHeader"]):not([class*="cardBody"]):not([class*="cardFooter"]) {
  border-radius: 2px !important;
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 2px 0 0 rgba(0,0,0,0.26) !important;
}
body[data-mc-theme="on"] [role="tabpanel"],
body[data-mc-theme="on"] [role="tablist"] {
  border-radius: 2px;
}

/* ============================== form fields ============================ */
body[data-mc-theme="on"] input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),
body[data-mc-theme="on"] textarea,
body[data-mc-theme="on"] select {
  border-radius: 1px !important;
  box-shadow:
    inset 2px 2px 0 0 rgba(0,0,0,0.42),
    inset -1px -1px 0 0 rgba(255,255,255,0.05);
  text-shadow: none;
  transition: box-shadow 0.12s ease;
}
body[data-mc-theme="on"] input:focus-visible,
body[data-mc-theme="on"] textarea:focus-visible,
body[data-mc-theme="on"] select:focus-visible {
  box-shadow:
    inset 2px 2px 0 0 rgba(0,0,0,0.42),
    inset -1px -1px 0 0 rgba(255,255,255,0.05),
    0 0 0 2px var(--mc-accent);
}
body[data-mc-theme="on"] [data-composer-input],
body[data-mc-theme="on"] [contenteditable="true"] {
  border-radius: 1px !important;
}
body[data-mc-theme="on"] ::placeholder { color: var(--dsw-alias-label-dimmed); opacity: 1; }

/* ============================== navigation ============================= */
body[data-mc-theme="on"] [data-slot="sidebar"] [aria-current="true"],
body[data-mc-theme="on"] [data-slot="sidebar"] [aria-selected="true"],
body[data-mc-theme="on"] [data-pane="sidebar"] [aria-current="true"],
body[data-mc-theme="on"] [data-pane="sidebar"] [aria-selected="true"] {
  box-shadow:
    inset 3px 0 0 0 var(--mc-accent),
    inset 1px 1px 0 0 rgba(255,255,255,0.1),
    inset -1px -1px 0 0 rgba(0,0,0,0.32) !important;
  border-radius: 1px;
}
body[data-mc-theme="on"] [data-pane="sidebar"] { box-shadow: inset -2px 0 0 0 rgba(0,0,0,0.42); }
body[data-mc-theme="on"] [data-slot="conversation.session"],
body[data-mc-theme="on"] [data-slot="session-header"],
body[data-mc-theme="on"] [data-dsh-surface="session-header"] {
  box-shadow: inset 0 -2px 0 0 rgba(0,0,0,0.28);
}

/* ============================== scrollbars ============================= */
body[data-mc-theme="on"] ::-webkit-scrollbar { width: 12px; height: 12px; }
body[data-mc-theme="on"] ::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.2);
  box-shadow: inset 1px 1px 0 rgba(0,0,0,0.35);
}
body[data-mc-theme="on"] ::-webkit-scrollbar-thumb {
  background-color: var(--dsw-alias-scrollbar-bg-l2);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 0;
  box-shadow: inset 2px 2px 0 var(--mc-edge-light), inset -2px -2px 0 var(--mc-edge-dark);
}
body[data-mc-theme="on"] ::-webkit-scrollbar-thumb:hover {
  background-color: var(--dsw-alias-scrollbar-hover-l2);
  background-clip: padding-box;
}
body[data-mc-theme="on"] ::-webkit-scrollbar-corner { background: transparent; }

/* ============================ text, focus, code ======================== */
body[data-mc-theme="on"] ::selection { background: var(--mc-accent); color: #ffffff; }
body[data-mc-theme="on"][data-mc-scheme="light"] ::selection { background: var(--mc-accent); color: #ffffff; }
body[data-mc-theme="on"] :focus-visible {
  outline: 2px solid var(--mc-accent) !important;
  outline-offset: 2px !important;
}
body[data-mc-theme="on"] [role="tooltip"] {
  border-radius: 2px !important;
  border: 2px solid var(--mc-tooltip-edge) !important;
  background-color: var(--mc-tooltip-bg) !important;
  color: var(--dsw-alias-tooltip-fg) !important;
  box-shadow: 0 2px 0 rgba(0,0,0,0.35), inset 1px 1px 0 rgba(255,255,255,0.08) !important;
  image-rendering: pixelated;
}
body[data-mc-theme="on"] pre,
body[data-mc-theme="on"] [class*="md-code-block"] {
  border-radius: 1px !important;
  box-shadow:
    inset 1px 1px 0 0 rgba(0,0,0,0.35),
    inset -1px -1px 0 0 rgba(255,255,255,0.04) !important;
}
body[data-mc-theme="on"] code {
  text-shadow: none;
}
body[data-mc-theme="on"] hr {
  border: 0;
  border-top: 2px solid var(--dsw-alias-border-l2);
}

/* =========================== plugin widgets =========================== */
[data-mc-ui] {
  --mcu-font: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", system-ui, sans-serif;
  --mcu-mono: "Cascadia Mono", "Consolas", ui-monospace, monospace;
  font-family: var(--mcu-font);
  color: var(--mc-text);
  box-sizing: border-box;
}
[data-mc-ui] *, [data-mc-ui] *::before, [data-mc-ui] *::after { box-sizing: border-box; }
[data-mc-ui] .mcu-shadow {
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 3px 0 0 rgba(0,0,0,0.3);
}
[data-mc-ui] .mcu-title {
  font-weight: 700;
  letter-spacing: 0.05em;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.4);
}
[data-mc-ui][data-mc-scheme="light"] .mcu-title { text-shadow: 1px 1px 0 rgba(255,255,255,0.65); }

/* ---- HUD ---- */
/* The console is bottom-anchored: the collapse/expand button never moves, and
   the function panel grows upwards from it in a 3-column block grid (a 7-button
   horizontal row used to stretch across the composer). */
.mcu-hud {
  position: fixed;
  right: var(--mc-hud-right, 16px);
  bottom: var(--mc-hud-bottom, 64px);
  /* 往下挪自身长度的 2/3：34px 方块按钮约 23px，取 24px。用固定像素而非
     百分比，所以展开/收起改变高度时基准位置不会变。 */
  transform: translateY(var(--mc-hud-drop, 24px));
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}
.mcu-hud > * { pointer-events: auto; }
.mcu-hud-panel {
  display: grid;
  grid-template-columns: repeat(3, 34px);
  gap: 6px;
  padding: 8px;
  background: var(--mc-panel);
  border: 2px solid rgba(0,0,0,0.5);
  border-radius: 2px;
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 3px 0 0 rgba(0,0,0,0.32);
}
.mcu-hud-panel .mcu-btn { width: 34px; height: 34px; }
.mcu-hud-row { display: flex; align-items: center; gap: 6px; }.mcu-btn {
  -webkit-appearance: none;
  appearance: none;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  padding: 0;
  background: var(--mc-panel-2);
  color: var(--mc-text);
  border: 2px solid rgba(0,0,0,0.45);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-light), inset -2px -2px 0 0 var(--mc-edge-dark);
  transition: background-color 0.12s ease, transform 0.06s ease, box-shadow 0.06s ease;
}
.mcu-btn:hover { background: var(--mc-panel-3); }
.mcu-btn:active {
  transform: translateY(2px);
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-dark), inset -2px -2px 0 0 rgba(255,255,255,0.06);
}
.mcu-btn[aria-pressed="true"] {
  background: var(--mc-accent);
  color: #ffffff;
  box-shadow: inset 2px 2px 0 0 rgba(255,255,255,0.14), inset -2px -2px 0 0 rgba(0,0,0,0.5);
}
body[data-mc-scheme="light"] .mcu-btn[aria-pressed="true"] { background: var(--mc-accent); color: #ffffff; }
.mcu-btn svg { display: block; shape-rendering: crispEdges; }
.mcu-btn:focus-visible { outline: 2px solid var(--mc-accent); outline-offset: 2px; }

.mcu-textbtn {
  -webkit-appearance: none;
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 4px 12px;
  font-family: var(--mcu-font);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--mc-text);
  background: var(--mc-panel-2);
  border: 2px solid rgba(0,0,0,0.45);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-light), inset -2px -2px 0 0 var(--mc-edge-dark), 0 2px 0 rgba(0,0,0,0.3);
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  transition: background-color 0.12s ease, transform 0.06s ease;
}
.mcu-textbtn:hover { background: var(--mc-panel-3); }
.mcu-textbtn:active { transform: translateY(2px); box-shadow: inset 2px 2px 0 0 var(--mc-edge-dark); }
.mcu-textbtn.is-primary {
  background: var(--mc-accent);
  color: #ffffff;
  border-color: rgba(0,0,0,0.45);
}
.mcu-textbtn.is-primary:hover { filter: brightness(1.1); }
.mcu-textbtn.is-ghost { background: transparent; box-shadow: none; border-color: transparent; }
.mcu-textbtn.is-ghost:hover { background: var(--mc-panel-2); }
.mcu-textbtn:disabled { opacity: 0.55; cursor: not-allowed; }

/* ---- modal ---- */
.mcu-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0,0,0,0.55);
  /* shell.overlay is a click-through layer: opt back into pointer events or
     the backdrop and the dialog controls stop receiving clicks. */
  pointer-events: auto;
  animation: mcu-fade 0.16s ease-out;
}
.mcu-dialog {
  display: flex;
  flex-direction: column;
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  background: var(--mc-panel);
  color: var(--mc-text);
  border: 2px solid rgba(0,0,0,0.62);
  border-radius: 3px;
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 10px 0 0 rgba(0,0,0,0.2),
    0 20px 48px rgba(0,0,0,0.5);
  animation: mcu-pop 0.18s cubic-bezier(0.2, 1.4, 0.5, 1);
  overflow: hidden;
}
.mcu-dialog.mcu-dialog--wide { width: min(900px, calc(100vw - 32px)); }
.mcu-dialog--sheet { width: min(520px, calc(100vw - 32px)); }
.mcu-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--mc-panel-2);
  border-bottom: 2px solid rgba(0,0,0,0.34);
  box-shadow: inset 0 -2px 0 0 rgba(0,0,0,0.22), inset 0 2px 0 0 var(--mc-edge-light);
}
.mcu-dialog__head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.4);
}
.mcu-dialog__body {
  padding: 14px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.mcu-dialog__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 12px;
  background: var(--mc-panel-2);
  border-top: 2px solid rgba(0,0,0,0.34);
}
.mcu-iconbtn {
  -webkit-appearance: none;
  appearance: none;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  padding: 0;
  font-size: 15px;
  line-height: 1;
  color: var(--mc-text);
  background: var(--mc-panel-3);
  border: 2px solid rgba(0,0,0,0.45);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: inset 1px 1px 0 0 var(--mc-edge-light), inset -1px -1px 0 0 var(--mc-edge-dark);
}
.mcu-iconbtn:hover { background: var(--mc-panel-3); }

/* ---- settings / rows ---- */
.mcu-sheet { display: flex; flex-direction: column; gap: 16px; }
.mcu-section {
  background: var(--mc-panel-2);
  border: 2px solid rgba(0,0,0,0.42);
  border-radius: 2px;
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-light), inset -2px -2px 0 0 var(--mc-edge-dark);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mcu-section__title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--mc-accent);
  text-shadow: 1px 1px 0 rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  gap: 8px;
}
.mcu-section__title::before {
  content: "";
  width: 8px;
  height: 8px;
  background: var(--mc-accent);
  box-shadow: 2px 2px 0 rgba(0,0,0,0.4);
}
.mcu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 30px;
}
.mcu-row--stack { flex-direction: column; align-items: stretch; gap: 6px; }
.mcu-row__label { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mcu-row__name { font-size: 13px; font-weight: 600; }
.mcu-row__hint { font-size: 11px; color: var(--mc-text-dim); line-height: 1.45; }
.mcu-row__control { display: flex; align-items: center; gap: 8px; flex: none; }
.mcu-divider { height: 2px; background: rgba(0,0,0,0.28); box-shadow: 0 1px 0 rgba(255,255,255,0.06); }

/* ---- toggle ---- */
.mcu-toggle {
  -webkit-appearance: none;
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 74px;
  height: 26px;
  padding: 0 8px 0 6px;
  font-family: var(--mcu-font);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--mc-text-dim);
  background: var(--mc-slot);
  border: 2px solid rgba(0,0,0,0.5);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: inset 2px 2px 0 0 rgba(0,0,0,0.35), inset -1px -1px 0 0 rgba(255,255,255,0.05);
}
.mcu-toggle__dot { width: 10px; height: 10px; background: #5d6157; box-shadow: 0 0 0 2px rgba(0,0,0,0.35); flex: none; }
.mcu-toggle[aria-checked="true"] { color: #ffffff; background: var(--mc-accent); box-shadow: inset 2px 2px 0 0 rgba(255,255,255,0.12), inset -2px -2px 0 0 rgba(0,0,0,0.4); }
.mcu-toggle[aria-checked="true"] .mcu-toggle__dot { background: var(--mc-accent); box-shadow: 0 0 0 2px rgba(0,0,0,0.35), 0 0 8px rgba(138,201,90,0.55); }
body[data-mc-scheme="light"] .mcu-toggle[aria-checked="true"] { color: #ffffff; background: var(--mc-accent); }
.mcu-toggle:focus-visible { outline: 2px solid var(--mc-accent); outline-offset: 2px; }

/* ---- range ---- */
.mcu-range {
  -webkit-appearance: none;
  appearance: none;
  width: 148px;
  height: 20px;
  background: transparent;
  cursor: pointer;
}
.mcu-range::-webkit-slider-runnable-track {
  height: 10px;
  background: var(--mc-slot);
  border: 2px solid rgba(0,0,0,0.5);
  box-shadow: inset 1px 1px 0 rgba(0,0,0,0.4);
}
.mcu-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 20px;
  margin-top: -7px;
  background: var(--mc-panel-3);
  border: 2px solid rgba(0,0,0,0.6);
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-light), inset -2px -2px 0 0 var(--mc-edge-dark);
  cursor: grab;
}
.mcu-range:active::-webkit-slider-thumb { cursor: grabbing; background: var(--mc-accent); }

/* ---- segmented choices ---- */
.mcu-seg { display: inline-flex; gap: 4px; }
.mcu-seg .mcu-textbtn { min-height: 26px; padding: 2px 9px; font-size: 12px; }
.mcu-seg .mcu-textbtn[aria-pressed="true"] { background: var(--mc-accent); color: #ffffff; }
body[data-mc-scheme="light"] .mcu-seg .mcu-textbtn[aria-pressed="true"] { background: var(--mc-accent); color: #ffffff; }

/* ---- wallpaper picker ---- */
.mcu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
  gap: 10px;
}
.mcu-slot {
  -webkit-appearance: none;
  appearance: none;
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  padding: 0;
  overflow: hidden;
  background: var(--mc-slot);
  border: 2px solid rgba(0,0,0,0.5);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: inset 2px 2px 0 rgba(0,0,0,0.3), inset -2px -2px 0 var(--mc-edge-light);
}
.mcu-slot img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
  pointer-events: none;
}
/* Photo thumbnails are real photographs: keep them smooth. */
.mcu-slot--photo img { image-rendering: auto; }
/* Imported wallpaper tile: the delete button sits on top of the tile. */
.mcu-slotwrap { position: relative; display: block; }
.mcu-slotwrap .mcu-slot { width: 100%; }
.mcu-slot__del {
  -webkit-appearance: none;
  appearance: none;
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  color: #f4f6f4;
  background: rgba(0,0,0,0.62);
  border: 2px solid rgba(0,0,0,0.5);
  border-radius: 2px;
  box-shadow: inset 2px 2px 0 rgba(255,255,255,0.14), inset -2px -2px 0 rgba(0,0,0,0.45);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.14s ease;
}
.mcu-slotwrap:hover .mcu-slot__del,
.mcu-slot__del:focus-visible { opacity: 1; }
.mcu-slot__del:hover { background: #8a2f2f; }
.mcu-slot__del:active { transform: translateY(1px); }
/* Upload tile: same 16:9 footprint as a wallpaper slot. */
.mcu-slot--add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--mc-text-dim);
  background: repeating-linear-gradient(45deg, rgba(0,0,0,0.16) 0 6px, transparent 6px 12px), var(--mc-slot);
  border: 2px dashed rgba(255,255,255,0.3);
  box-shadow: inset 2px 2px 0 rgba(0,0,0,0.3);
}
.mcu-slot--add .mcu-slot__name {
  position: static;
  padding: 0;
  color: inherit;
  background: none;
  text-shadow: none;
}
.mcu-slot--add:hover { color: var(--mc-text); border-color: var(--mc-accent); }
.mcu-slot__name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 3px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #f2f6ec;
  background: rgba(8,10,8,0.62);
  text-shadow: 1px 1px 0 rgba(0,0,0,0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mcu-slot:hover { border-color: var(--mc-accent); }
.mcu-slot[aria-pressed="true"] {
  border-color: var(--mc-accent);
  box-shadow: 0 0 0 2px var(--mc-accent), inset 2px 2px 0 rgba(0,0,0,0.3);
}
.mcu-slot[aria-pressed="true"]::after {
  content: "";
  position: absolute;
  top: 4px;
  right: 4px;
  width: 12px;
  height: 12px;
  background: var(--mc-accent);
  box-shadow: 2px 2px 0 rgba(0,0,0,0.55);
}
.mcu-slot:focus-visible { outline: 2px solid var(--mc-accent); outline-offset: 2px; }

/* ---- achievement toast ---- */
.mcu-toast-stack {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 80;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.mcu-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 240px;
  max-width: 340px;
  padding: 10px 14px;
  background: #23272a;
  color: #f0f2ec;
  border: 2px solid #6f6f6f;
  border-radius: 2px;
  box-shadow: inset 2px 2px 0 rgba(255,255,255,0.18), inset -2px -2px 0 rgba(0,0,0,0.55), 0 6px 18px rgba(0,0,0,0.45);
  animation: mcu-toast-in 0.35s cubic-bezier(0.2, 1.5, 0.5, 1);
  font-family: var(--mcu-font);
}
.mcu-toast__icon {
  width: 22px;
  height: 22px;
  flex: none;
  background: #c9a227;
  box-shadow: 2px 2px 0 rgba(0,0,0,0.5), inset 2px 2px 0 rgba(255,255,255,0.35);
}
.mcu-toast__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mcu-toast__title { font-size: 12px; font-weight: 700; color: #ffd84a; letter-spacing: 0.06em; }
.mcu-toast__body { font-size: 12px; color: #dfe4da; line-height: 1.4; }

/* ---- misc ---- */
.mcu-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--mc-text-dim);
  background: var(--mc-slot);
  border: 1px solid rgba(0,0,0,0.4);
  box-shadow: inset 1px 1px 0 rgba(255,255,255,0.06);
}
.mcu-fine { font-size: 11px; color: var(--mc-text-dim); line-height: 1.5; }
.mcu-kbd {
  font-family: var(--mcu-mono);
  font-size: 11px;
  padding: 1px 4px;
  background: var(--mc-slot);
  border: 1px solid rgba(0,0,0,0.45);
  box-shadow: inset 1px 1px 0 rgba(255,255,255,0.06);
}

@keyframes mcu-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes mcu-pop { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes mcu-toast-in { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }

/* ---- widget state overrides ---------------------------------------------
   The stock component rules use !important on box-shadow (so the bevel wins
   over any app styling), which also outranks the widget states below. They
   are restated here with !important and a body-scoped selector, so only our
   own controls (.mcu-*) change state. */
body[data-mc-theme="on"] .mcu-btn:active {
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-dark), inset -2px -2px 0 0 rgba(255,255,255,0.06) !important;
}
body[data-mc-theme="on"] .mcu-btn[aria-pressed="true"] {
  box-shadow: inset 2px 2px 0 0 rgba(255,255,255,0.14), inset -2px -2px 0 0 rgba(0,0,0,0.5) !important;
}
body[data-mc-theme="on"] .mcu-toggle[aria-checked="true"] {
  box-shadow: inset 2px 2px 0 0 rgba(255,255,255,0.12), inset -2px -2px 0 0 rgba(0,0,0,0.4) !important;
}
body[data-mc-theme="on"] .mcu-slot[aria-pressed="true"] {
  box-shadow: 0 0 0 2px var(--mc-accent), inset 2px 2px 0 rgba(0,0,0,0.3) !important;
}

/* ---- in-app tab strips (conversation header) ----------------------------
   The stock tabs already draw their own selection frame; our bevel/accent
   shadows were painted *inside* that frame, which made the active box look
   narrower and clipped at the left edge. Keep the stock geometry intact. */
body[data-mc-theme="on"] [role="tablist"] {
  box-shadow: none !important;
}
body[data-mc-theme="on"] [role="tablist"] *,
body[data-mc-theme="on"] [role="tab"],
body[data-mc-theme="on"] [role="tab"]:hover,
body[data-mc-theme="on"] [role="tab"][aria-selected="true"],
body[data-mc-theme="on"] [role="tab"][aria-current="true"],
body[data-mc-theme="on"] button[aria-selected],
body[data-mc-theme="on"] button[aria-current="page"],
body[data-mc-theme="on"] button[aria-current="true"] {
  border-radius: 2px !important;
  box-shadow: none !important;
  background-image: none !important;
}

/* variant chooser can carry more buttons than one line */
.mcu-seg--wrap { flex-wrap: wrap; }

/* Local music library: one chip per uploaded track, plus the upload button. */
.mcu-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.mcu-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 3px 4px 3px 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--mc-text);
  background: var(--mc-slot);
  border: 2px solid rgba(255,255,255,0.16);
  border-radius: 2px;
  box-shadow: inset 1px 1px 0 rgba(0,0,0,0.35);
}
.mcu-chip__name {
  max-width: 168px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mcu-chip__del {
  -webkit-appearance: none;
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  color: var(--mc-text-dim);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 2px;
}
.mcu-chip__del:hover,
.mcu-chip__del:focus-visible {
  color: #fff;
  background: #8a2f2f;
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  #mc-wallpaper-layer .mcu-wall { transition: none; }
  .mcu-dialog, .mcu-overlay, .mcu-toast { animation: none; }
  body[data-mc-theme="on"] button:active:not(:disabled) { transform: none; }
}
`
