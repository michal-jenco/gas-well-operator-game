# 🛢 Gas Well Operator — Christmas Tree Simulator

A single-page browser game where you operate a gas wellhead **Christmas tree** at the **Trebišov TR-9** well in eastern Slovakia, guiding it through 19 years of production (1996–2015) compressed into a ~10-minute session.

> **[▶ Open `index.html` in any modern browser to play — no install, no build step, no server required.](#)**

---

## 🎮 Gameplay

You are the wellhead operator at Well TR-9 in the Trebišov gas field. Your job is to keep natural gas flowing to the Gas Collection Station (GCS) at Milhostov while keeping the wellhead safe.

**Controls:**
- **5 clickable valves** on an interactive SVG schematic — LMV, UMV, RWV, LWV, and Swab
- **Choke handwheel** — scroll to adjust flow restriction (0–100%)
- **Wellhead compressor** — unlocks when reservoir pressure declines, one-time use

**Objectives:**
- Match gas flow to shifting demand targets
- Respond to random operational events before they expire
- Keep wellhead pressure below 32 bar and annulus pressure below 20 bar
- Survive as long as possible — reach mid-2015 for the 🏆 Legend Operator bonus

### Events

Random events fire every 20–40 seconds, demanding quick operator action:

| Event | Action Required |
|---|---|
| ⬆ Overpressure Surge | Restrict choke or close RWV |
| 📉 Demand Spike / Drop | Adjust choke to match new demand |
| 🔴 Annulus Buildup | Open LWV to bleed casing pressure |
| 🪨 Sand Plug | Slam choke open to 90%+ |
| 🔧 Wireline Inspection | Close LMV, cycle Swab valve |
| 📊 Hydrate Formation | Close LWV, reduce choke |
| 🌀 Tubing Vibration | Reduce choke ≤40%, close LWV |
| ❄ Cold Weather Restart | Reopen valves in sequence + set choke |

After **3 minutes**, catastrophic events can occur (blowthrough, wellhead fire, water flood) — the session always ends, but a **Heroic Shut-In** (closing all bore valves in time) earns a **10× score bonus**.

---

## 📸 Features

- **Interactive SVG wellhead schematic** with animated gas particles, pressure gauge, and visual valve states
- **Real-time physics engine** — reservoir pressure decline, choke flow dynamics, annulus pressure model
- **Simulated calendar** — 1 real second ≈ 11.57 simulated days (Apr 1996 → mid-2015)
- **Live gas price** — fetches Henry Hub NG=F from Yahoo Finance, converts to EUR/m³ for earnings calculation
- **Procedural audio** — all sounds synthesized via Web Audio API (no audio files)
- **9-step interactive tutorial** covering every control, event type, and scoring mechanic
- **Session report card** with performance rating, stats grid, and incident analysis
- **Live chart** — Canvas 2D production history with event markers
- **PDF export** — full A4 session report via jsPDF
- **PNG chart export** — one-click download of production chart

---

## 🏗 Architecture

```
index.html      ← Full UI: SVG schematic, HUD, modals (inline styles)
game.js         ← All game logic in a single IIFE closure
game.css        ← Design tokens, resets, @keyframes (minimal)
export-pdf.js   ← PDF export using jsPDF CDN
```

### Key design decisions

- **Zero build tooling** — open `index.html` directly in a browser. No npm, no bundler, no framework.
- **Single IIFE closure** — all private state (`GS`, `CHART`, `SND`, events) is closure-scoped. Public API exposed via `window.*` for HTML `onclick` handlers.
- **Centralized state** — the `GS` object holds all game state. Physics, scoring, and UI all read from / write to `GS`.
- **Inline styles** — intentional for single-file portability. Almost no CSS classes.
- **Procedural sound** — Web Audio API oscillators and noise generators. Zero external audio files.
- **jsPDF** is the only external dependency (loaded via CDN `<script>` tag).

---

## 🚀 Getting Started

1. **Clone the repo:**
   ```bash
   git clone https://github.com/your-username/gas-well-operator-game.git
   cd gas-well-operator-game
   ```

2. **Open in browser:**
   ```bash
   open index.html        # macOS
   xdg-open index.html    # Linux
   start index.html       # Windows
   ```

   Or simply double-click `index.html` in your file manager.

That's it. No install, no build, no server.

> **Note:** PDF export requires an internet connection (jsPDF loads from CDN). Everything else works fully offline.

---

## 🎯 Scoring

Scoring uses a steep precision curve — the closer your flow is to exactly 100% of demand, the exponentially more you earn:

| Flow accuracy | Points/tick | Multiplier effect |
|---|---|---|
| Within 5% of demand | Maximum | Multiplier climbs |
| Within 15% | Moderate | Multiplier holds |
| Off by >15% | Minimal | Multiplier decays |

**Bonuses:**
- Resolving events awards 50–150 points and increases your multiplier (up to 1.3×)
- Failing events halves your score and multiplier
- **Heroic Shut-In** during a catastrophic event: **10× score**
- **Legend Operator** (surviving past mid-2015): **100× score and 100× multiplier**

---

## 🔧 Domain Context

This game simulates real operations at the Trebišov gas field operated by **NAFTA a.s.** in eastern Slovakia. The petroleum engineering content in event debriefs is based on actual field practices:

- **Christmas tree** — the assembly of valves, spools, and fittings at the wellhead that controls flow from a producing gas well
- **Choke** — a variable restriction that controls flow rate and back-pressure
- **Master valves (LMV/UMV)** — primary shut-off valves on the vertical bore
- **Wing valves (RWV/LWV)** — lateral valves; RWV leads to the flowline, LWV to the annulus bleed
- **Annulus pressure** — pressure in the space between production tubing and casing, monitored for well integrity
- **Reservoir pressure** starts at 28 bar and declines naturally over the well's lifetime, requiring a compressor in later years

---

## 🐛 Debugging

- Open browser DevTools console
- After game ends: `window._gameExportAPI.getSnapshot()` returns the full session state
- Mid-game state inspection: add `window._GS = GS;` inside the IIFE temporarily
- The game loop runs at 250ms intervals — see `physicsTick()` for all per-tick logic

---

## 📄 License

[CC BY-NC 4.0](LICENSE) — free to share and adapt for non-commercial use, with attribution.

---

<p align="center">
  <em>Built with vanilla HTML, CSS, and JavaScript. No frameworks harmed in the making of this game.</em>
</p>
