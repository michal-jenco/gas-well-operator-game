# AGENTS.md — Gas Well Operator Game

## Project Overview

Single-page browser game simulating a gas wellhead Christmas tree operator at the Trebišov TR-9 well (Slovakia, 1996–2015). Pure vanilla HTML/CSS/JS — no build tools, no frameworks, no bundler. Open `index.html` directly in a browser to run.

## Tool Usage Rules

**Never use double-quoted strings (`"`) or heredocs (`<<EOF`) when passing arguments to terminal/shell command tools.** They cause the tool to hang indefinitely. Use single quotes or write content to a file instead.

## Architecture

- **`index.html`** — Full UI: SVG wellhead schematic (interactive valves, compressor, particles, pressure gauge), HUD panels, choke handwheel SVG, tutorial modal, debrief modal, game-over report. Heavy use of inline styles; almost no CSS classes.
- **`game.js`** — All game logic inside a single IIFE closure. Contains: physics engine (`physicsTick` at 250ms), game state (`GS` object), event system (`EVENTS[]` + `CATASTROPHIC_EVENTS[]`), sound engine (Web Audio API, no audio files), scoring, charting (Canvas 2D), tutorial steps, session report, PNG export. Exposes globals via `window.*` for HTML `onclick` handlers.
- **`game.css`** — Minimal: CSS custom properties (design tokens), base resets, `@keyframes spin`. All game UI styling is inline in `index.html` and `game.js`.
- **`export-pdf.js`** — PDF export using jsPDF (loaded from CDN). Reads game data via `window._gameExportAPI` bridge object exposed by `game.js`.

## Key Patterns

- **State is centralized in `GS` object** (line ~7 of `game.js`). All physics, scoring, and UI reads from/writes to `GS`. Never create parallel state.
- **Events are self-contained objects** in `EVENTS[]` and `CATASTROPHIC_EVENTS[]` arrays. Each has `trigger()`, `check()`, `resolve()`, `expire()`, and optional `tickHold()`. Add new events by following this shape exactly.
- **DOM access uses `const $ = id => document.getElementById(id)`** — a single-character helper. All element IDs are prefixed with `g` (e.g., `gScore`, `gFlowBar`, `gv-rwv`).
- **Valve SVG groups** use ID pattern `gv-{id}` (e.g., `gv-lmv`, `gv-rwv`). Toggle via `window.gameToggleValve(id)`. Visual state is set by `setValveVisual(id, 'open'|'closed'|'locked')`.
- **Choke control** is scroll-only on the handwheel SVG (`#gChokeWheel`). Public setter: `window.gameSetChoke(value)`.
- **Sound is procedural** via Web Audio API oscillators/noise — no external audio files. All sounds are in the `SND` object.
- **Chart** uses raw Canvas 2D (`#gChart`), sampled every ~1s. Data stored in `CHART.data[]` with time-based x-axis positioning.
- **Simulated calendar**: 1 real second ≈ 11.57 simulated days. Session spans Apr 1996 – mid 2015 over ~10 min. Use `simDate()`, `formatSimDateShort()`, `formatSimDateLog()`.

## Critical Conventions

- **No build step.** Do not introduce webpack, vite, npm, or any tooling. Files are served as-is.
- **No external JS frameworks.** No React, no jQuery. Vanilla DOM manipulation only.
- **Inline styles dominate.** Don't refactor to CSS classes unless explicitly asked — the inline approach is intentional for single-file portability.
- **jsPDF is the only external dependency**, loaded via CDN `<script>` tag in `index.html`.
- **The IIFE closure in `game.js` is load-bearing.** All private state (`GS`, `CHART`, `SND`, `_fullLog`, etc.) is closure-scoped. Public API is attached to `window.*`. Don't break this encapsulation.
- **Event debrief objects** contain `wrong`, `shouldHave`, `controls[]`, and `context` fields with real petroleum engineering content specific to Slovak gas field operations. Maintain this domain accuracy.
- **Physics constants matter:** `reservoirP` starts at 28 bar, declines over 420s; compressor unlocks at 18 bar; game-over thresholds are 32 bar WHP and 20 bar annulus. Changes cascade through scoring and event balance.

## Adding a New Game Event

1. Add an object to `EVENTS[]` (or `CATASTROPHIC_EVENTS[]` if terminal) following the existing shape:
   ```js
   { id, title, desc, action, duration, pointers, debrief: { wrong, shouldHave, controls, context },
     trigger(), check(), resolve(), expire(), /* optional: tickHold(), independent, weight, catastrophic */ }
   ```
2. If the event needs a hold timer, implement `tickHold()` and create a progress bar in `trigger()` (see `demand` or `hydrate` events).
3. Add pointer arrow SVG group `gptr-{id}` in `index.html` inside `#gPointers` if a new control needs highlighting.
4. Test that `check()` is a pure predicate with no side effects — it's called from multiple places.

## Debugging Tips

- Open browser DevTools console; `window._gameExportAPI.getSnapshot()` returns current session state after game ends.
- `GS` is not directly accessible from console (closure-scoped). To inspect mid-game, add a temporary `window._GS = GS;` inside the IIFE.
- The game loop is `setInterval` at 250ms — look at `physicsTick()` for all per-tick logic.