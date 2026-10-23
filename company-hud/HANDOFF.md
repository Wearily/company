# COMPANY — HUD redesign handoff

These are **design mockups, not production code**. Rebuild the HUD by hand as a plain HTML/CSS DOM overlay on the existing full-screen map canvas. Don't change the game itself: the map, unit symbols, side colours and game rules stay as they are.

## What's in this folder

- `screens/` — 100 mockups as HTML files. Open any one in a browser to view it. Each is a fixed-size artboard (1440×900 desktop, 400×860 phone) with inline styles. Read them for layout, copy and states. Don't copy their absolute positioning; rebuild the layout with flex/grid.
- `assets/` — the map plate (cropped from a real game screenshot, used only as a backdrop), the logo in ink and light versions, and stand-in overlay drawings.
- `tokens.css` — colours, type, spacing, radius and shadow tokens for light and dark, plus the floating/docked switch. Start from this.
- `screens/A9-Spec.dc.html` and `screens/B9-Spec.dc.html` — the full spec sheets: tokens, type scale, spacing, radius and shadow rules, breakpoints, and component states (default, hover, active, disabled, collapsed).
- `screens/Open-Questions.dc.html` — things that still need the owner's confirmation. Don't invent answers; leave TODOs.

## The four looks (two settings)

| Row | Appearance | Layout | Notes |
|---|---|---|---|
| **A** | Light | **Floating** | **Default.** Build this first. |
| B | Dark | Docked | Toolbar and command dock flush to the edges; outliner and inspector slide in from the sides. |
| C | Dark | Floating | A's layout in B's colours. Recoloured in code; not yet reviewed. |
| D | Light | Docked | B's layout in A's colours. Recoloured in code; not yet reviewed. |

Settings → **Interface layout: Floating (default) / Docked** and **Appearance: Light / Dark / Auto** (Appearance is a proposal). See `Settings-Layout.dc.html`, `A10-Settings.dc.html`. Use `data-layout` and `data-appearance` on `<html>` with `tokens.css`.

## Screen index (same numbering in every row; `m` = phone)

1 in battle, minimal · 2 selection with panels open · 3 everything collapsed · 4 defender deployment (trench tool, budget, Undo ⌘Z, Begin battle) · 5 New game · 5.2 (`5b`) New game with the map shown and settings as a sidebar · 6 Victory · 6b Defeat · 6c Draw · 7 Replay · 10 Settings popover · 11 Controls popover · 9 spec sheet (A and B only).

## Rules the design depends on

- Font: Inter only, `font-variant-numeric: tabular-nums` on every number. Apple-style language: capsule buttons, segmented controls, inset grouped lists, frosted glass (`backdrop-filter: blur(30px) saturate(180%)`).
- Rounding: buttons and capsules use height ÷ 2; panels 22px; sheets 28px; groups 12px; tiles and fields 10px; segmented 10/8. A nested element's radius is the outer radius minus its padding. Docked bars are flush (radius 0), but everything inside them is rounded exactly like Floating.
- Gaps: 16px from the screen edge; 10px between stacked capsules.
- Every panel collapses to a slim pill, icon or edge tab and expands again. Nothing permanently covers the middle of the map. Keep bottom centre clear on desktop, because the units start there. **U** hides the whole interface (a proposal).
- Event log: plain white text straight on the map, bottom left, with a text shadow. Newest line bold at the bottom; older lines fade. No panel behind it.
- Shortcut letters show quietly on buttons (in the corner of order tools when floating, after the label when docked). Hide them on touch-only devices.
- Touch targets are at least 44px on touch screens. Command rows scroll sideways on narrow screens.
- Game code field: a single-line read-only input that scrolls sideways; never wraps.
- Side colours stay #17181c (attacker) and #7a2cbf (defender). On dark surfaces, use the lighter ring and text tints from `tokens.css`, and give attacker icons a white edge.

## Placeholders

Scenario descriptions, end-of-battle reasons, stats, enemy-plan text, event wording, defender counts and replay data are example copy. Wire them to real game data. See Open Questions.

## Viewing note

The mockups were authored for a design canvas. Map bindings have been swapped for `../assets/map-real.jpg`, so each file opens directly in a browser. The `<x-dc>` and `<helmet>` wrapper tags are harmless and can be ignored.
