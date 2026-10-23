# COMPANY

The game is named **COMPANY** (it was called Bridgehead; the files keep their old names). Real-time, pausable 2D military strategy game played on a top-down paper-map view of a procedurally generated battlefield. One side attacks from the south and the other defends from the north across a west–east front line. The fight is over three objectives: a crossing (a bridge, a causeway or a crossroads), the town, and a hill. There are six battlefield types (`MAP_MODES`) and three difficulty levels (`DIFFICULTY`).

## Current state

- **Hosting:** https://companymap.vercel.app/, deployed by Vercel from the GitHub repo (Wearily/company). `vercel.json` publishes only the game: its build copies `index.html` and the contents of `public/` (the favicon set from RealFaviconGenerator and `site.webmanifest`, linked from the top of `index.html`) into `dist/` (git-ignored) and Vercel serves that folder, so CLAUDE.md, `bridgehead.html`, `company-hud/` and anything else in the repo stay off the site. A file the page needs at runtime must be added to that `buildCommand`. The GitHub repo itself is public.
- The game is `index.html`, where all current work happens (the satellite copy described below). `bridgehead.html` is the older, paper-only version. Each is one file: one inline `<script>` with plain JS and Canvas 2D, no build step and no dependencies apart from Google Fonts.
- The file has no `<html>`, `<head>` or `<body>` tags, because the claude.ai artifact host wraps it.
- It has **not been played end to end**, so expect runtime bugs and balance problems. Fix those before adding features.

## Satellite copy (`index.html`, formerly `bridgehead satalite map.html`)

- **Name and logo:** the page title, the scenario card and the New game and end sheets say COMPANY and show the logo from `COMPANY.svg`. It's embedded once as an inline `<symbol id="logo">` (cropped to `viewBox="90 176 730 220"`, white background dropped; the wordmark's fill is `var(--logo-ink)`, so it turns white in Dark) and drawn with `<svg class="logo"><use href="#logo"/></svg>`. `bridgehead.html` still says BRIDGEHEAD.
- An experimental copy of `bridgehead.html` (made Oct 12, 2026) that adds a generated satellite style for the terrain. `bridgehead.html` itself is unchanged and still paper-only. Port changes between the two by hand until they're merged.
- Settings has a **Map view** switch, *Satellite | Strategic*, also on key `T` (`setView`). It sets `settings.style` to `'satellite'` (default) or `'paper'`; Strategic is the original `bridgehead.html` printed map. `renderTerrain()` calls `renderSatellite()` or `renderPaper()`, and only the drawing changes, never the battle.
- **Supply differs from `bridgehead.html` here:**
  - It follows the army. A side's supply reaches its own half of the battlefield (by `M.side`), and on the enemy's half only ground it has taken (`G.claim[s]`, kept up by `updateClaim` each supply tick).
  - Taking ground: each unit floods out over land it could walk to (bridges and pontoons count, open water doesn't) up to `SUPPLY.claim` (140 px). A cell becomes the side's when one of its units is nearer than any enemy unit it can see, and goes back when a visible enemy unit is nearer than any of its own.
  - Taken ground stays taken after the units move on, so the road behind an advance keeps carrying supply. A couple of units slipping across a bridge take only the ground around them, not the enemy's town. A unit that cuts far cross-country away from roads is out of supply, as it would be on its own half.
  - Only enemy units the side can currently see (`G.vis[s]`) hold ground against it in `enemyHeld`. An unseen enemy neither cuts supply nor shows up as a hole in the supply overlay, so the overlay can't reveal hidden positions; once spotted, it cuts supply as before.
- `renderSatellite()` is seeded from the map seed, so a map always renders the same, and takes about 0.3–0.5 s. Everything is sized in metres through `SAT_M(m)` (1 px = 2.5 m), and colours live in `SAT`.
  - Per pixel: farmland is 1 km regions (a jittered Voronoi grid), each cut along its own direction into strips, staggered rectangles or large fields, with tracks and hedges. Each parcel is crop or grass outright, weighted by the field mask. On top come forest canopy textured at crown size, rock with tripled relief shading and scrub, and town ground with gardens. All land gets hill shading lit from the north-west. The river has tree-lined banks and gravel bars on wide stretches; lakes are darker open water. A final grade lowers saturation slightly.
  - Vector layers on top: streams under broken tree lines; buildings from `satBuildings()` along every street, typed by district (terraced red-roofed core, apartment slabs, industrial estate, village houses), each with a south-east shadow and pitched or flat roofs; then streets, roads and highways in asphalt at their real widths, and bridge decks.
- The dynamic layer adapts: fallen bridges are filled with `M.satWater`, the cratered-road gap shows the climate's broken ground (`M.satRubble`), and unit outlines are 2 px.
- **Line of control** (toolbar button or `L`, `settings.front`): a display-only front line from the player's point of view. `updateFront()` keeps `G.ctrl` (1 = held by the player), starting with each side holding its own half. Every 0.5 s of game time it changes hands with the same flood rule as taken ground (`updateClaim(..., all=true)`, over both halves, visible enemies only). Open water takes the owner of the bank on its own side.
  - It persists, so salients, pockets and encircled units show as closed loops.
  - **Style** (Settings, `settings.frontStyle`): `'one'` is the single shared line above. `'two'` (the default) keeps `G.ctrlP` (held by the player) and `G.ctrlE` (held by the enemy, as the player knows it). Each starts as its side's half minus a band `FRONT_GAP` (110 px) deep from the river bank (or the front line on a dry map); that band and the river are no-man's land. The same flood (`updateClaim(..., ex=[P, E])`) moves cells between them, and cells nobody has reached stay neutral. Water counts as held only when one side holds both banks. Each side's line is drawn in its own colour just inside its ground, with enemy ground tinted and no-man's land a faint grey.
  - `frontShape()` eases `G.ctrlS` toward `G.ctrl`, blurs it and traces the 0.5 contour with marching squares into `G.frontSeg`. It's drawn as a white casing with the player's colour on the player's side and the enemy's colour on the other, over a faint tint on enemy-held ground.
  - About 2 ms per update.
- **Climates (`CLIMATES`, palettes in `SATK`):** temperate, arid, desert, winter (`snow`) and tundra, picked on the setup screen and combinable with any battlefield. `setClimate(c)` sets `M.climate` and `M.offroad`; the map itself is unchanged, so forest still gives cover however it's drawn.
  - Rules: off-road movement × `offroad` (desert 0.9, winter 0.8, tundra 0.85; applied in `mult`, roads unaffected) and vision × `vision` (arid 1.05, desert 1.15, winter 0.9, tundra 1.05).
  - **Frozen water** (`frozen: true`, Winter only; `M.frozen`, set in `setClimate`): the river and lakes are frozen over. Infantry and engineers can walk on the ice at `ICE.move` (0.45; `mult`); armor and artillery can't (still bridges and pontoons only), so flow fields send infantry straight across where that's quicker. On the ice there is no cover: a unit there fires at `ICE.fire` (0.7), takes `ICE.exposed` (1.25) × the damage from fire, shells and bombs (`cover`, shell and bomb hits), and is seen from `ICE.seen` (1.25) × as far even when it isn't firing (`computeVis`). `iceAt(i)` / `onIce(u)` test for it. No trenches on ice. Taken ground (`updateClaim`), supply coverage (`computeSupply`; supply roads still don't cross) and the line of control treat the ice as land, and the line's open-water fill is skipped. AI waiting slots (`slotPos`, via `nearestPassable(..., dry=true)`) and cover spots (`coverNear`) avoid the ice. The inspector shows "On the ice · exposed" and the legend gets an ice entry.
  - Drawing: in a frozen climate the satellite view lays ice over all the water (`K.ice`, greyer `K.iceDark` down the channel, thin cracks). Fallen-bridge patches use the ice colour, the strategic view draws frozen water pale blue (`COL.ice`), and lake names turn dark slate on ice.
  - Arid: dusty parcels, irrigated plots, orchards on a 7 m grid, scrub, greenhouse clusters near settlements, flat pale roofs, dirt minor roads, dry streambeds, a reed fringe on the river.
  - Desert: no field parcels; dune seas along one wind direction and gravel plains, crop circles up to 500 m across in crop parcels, palm groves, a green irrigated valley about 350 m wide along the river.
  - Winter: snow-white parcels with faint field edges, snowy conifer forest, blue relief shadows, dark rock only on shaded steep faces, the river and lakes frozen over (white ice, greyer down the channel), ploughed roads between snowbanks, white roofs with long blue shadows.
  - Tundra: no field parcels; mottled moss with bog and lichen, sparse taiga crowns, gravel roads, muted coloured metal roofs. Its water stays open (it's not a winter climate).

- **Scenery ring (`genOuter`, `OUT`):** terrain past the border, 896 px east and west and 600 px north and south, so the battlefield sits in a continuous landscape. It's scenery only: `orderAt` ignores clicks past the border (no orders, strikes, pontoons or repairs), and `inZone` keeps trenches inside.
  - The battlefield is untouched. `genMap` only stores read-only inputs in `M.gen` (its noise functions, river and height parameters, hills, ridges, height range, land-use thresholds). The ring uses its own random stream, so the same seed still produces exactly the same battlefield; this was checked against fingerprints of the generated map and of every terrain draw call.
  - Generation, anchored to world coordinates so features carry across the border: the river runs on past both edges (same meander formula, slope cap and smoothing, started from the edge values); height and land use use the battlefield's formulas and thresholds; every road that leaves the map continues outward, bending away from the border; small towns on most highways, villages along roads with lanes to the network, streams, bridges, and contours for the paper style.
  - Rendering: `innerDom()` and the ring are both *domains* (`{x0, y0, gw, gh, cls, lu, hgt, road, ry, rw, water, streets, roads, bridges, streams, contours, D, cellOf, outer}`) drawn by the same `satRender` / `paperRender`. The ring goes into canvas `oc` at `OUT.ts` (0.5) with the battlefield area left transparent; `draw()` paints `oc`, then `tc`, then a light veil over the ring, then the black border. Farm regions beyond the battlefield's own come from a hash of their grid position.
  - It's cached on `M.outer` and redrawn with the terrain (style or climate changes); a full terrain redraw takes about 1 s.

- **Scenarios (`SCENARIOS`, picked on the setup screen, playable from either side):**
  - **Standard Battle:** the original rules.
  - **Last Stand:** 12 min, attacker +3 infantry +1 tank, defender reinforcements at its depot at 4:00 and 8:00; the defender wins by keeping one objective.
  - **Blitz:** 8 min, attacker +2 tanks, defender −3 infantry; the attacker must take all three.
  - **Seize the Crossing:** 10 min, defender +1 air strike; the attacker wins by holding objective A for 2 minutes without a break (`G.holdA`).
  - **Counterattack:** the attacker starts holding A and B with all its infantry and half its armour (`u.holdAt` keeps the AI's units there), the defender's nearby units start pushed north, and defender reinforcements arrive at 3:00; standard 2-of-3 rule.
  - **Meeting Engagement:** 12 min, neutral objectives (owner `'N'`), no trenches or deployment, both sides at their depots; the defender's line units' posts are the objectives; more objectives at the end wins, and a tie is a draw (`end(null, …)`).
  - **Night Assault:** vision ×0.55, no air strikes, a darkened map, attacker +2 infantry.
  - Fields: `limit` (replaces `TIME_LIMIT`, stored in `G.limit`), `need`, `holdA`, `forces`, `air`, `reinf` (`reinforce()`, `addUnit()`), `counter`, `neutral`, `deploy`, `trenches`, `night`, `vision`, `noAir`. Start positions are set in `scenarioSetup()`, and the panel shows the player's goal, the A hold timer and the next reinforcements.
- **Game codes:** `encodeGame` / `decodeGame` pack scenario, battlefield, climate, side, strength, difficulty and seed as `SC-MODE-CLIMATE-{side}{strength}{difficulty}-SEED36`, for example `LS-LN-WI-DHH-15RA`.
  - The setup screen shows the code, copies a link, and accepts a pasted code.
  - The page address is kept as `#game=CODE` (`syncCode`, `history.replaceState`, falling back to `location.replace`), so it never reloads the page or adds history entries. A page opened with `#game=CODE`, or an older `?game=CODE` link (rewritten to the hash), starts from those options (`gameCode()`). Changing just the `#game=` part in the address bar opens New game with that code, without a reload (`hashchange`). Copy Link copies the `#game=` form.
  - A link to a local file only works on the same machine; share the code itself instead.

- **Replay (satellite copy):** the end screen has **Watch replay**.
  - Recording: `recInit` / `recScan` / `recFrame` keep `G.rec`. A snapshot every `REC_DT` (0.5 s) holds unit ids, positions, health, flags and firing targets, objectives, pontoons, bridge health and air strikes left. Timestamped lists hold shell launches, impacts, air strikes, the full log, road-damage keyframes, bridges falling and timeline events (captures, air, bridges, pontoons, reinforcements). A defender game restarts the recording when the battle begins. About 0.6 MB for a full game.
  - Playback: `startReplay` swaps `G` for a view object (`RP.RV`, `replay: true`, `phase: 'over'`, so no fog and no orders) that `replayView(t)` fills from the recording, so the normal `draw()` and `updateHUD()` show it. Units are interpolated between snapshots, and firing flickers along recorded shooter→target pairs. `exitReplay` restores the real `G` and the end screen; starting a new game also ends a replay.
  - Controls: a replay bar replaces the command dock, with restart, ±15 s, play/pause, speed 1–16×, time, and a timeline canvas (`buildTimeline`) showing each side's strength, three rounded bands for who held each objective (orange while contested), and event markers. The timeline redraws itself whenever its on-screen width differs from the width it was drawn at (`drawTimelineHead`); `startReplay` un-hides the HUD before measuring it. Click or drag the timeline to seek; clicking a marker jumps to 3 s before it. Keys: Space, `,` / `.`, `[` / `]`, Home, Esc. Pan and zoom work as usual.

- **HUD (satellite copy):** rebuilt from the design handoff in `company-hud/` (`HANDOFF.md`, `tokens.css`, mockups in `screens/`; direction A, light and floating, is the default). A DOM overlay on the full-screen canvas; the engine never touches it.
  - Look: Inter for all HUD text, tabular figures for numbers; frosted glass (`.gl`: `backdrop-filter: blur(30px) saturate(180%)`), capsule buttons, segmented controls, inset grouped lists. Colours are tokens on `:root`, swapped by `data-appearance` (`light` | `dark`) on `<html>`. The canvas still draws map labels with `--display`, `--body` and `--mono` (the old fonts), and the side colours are unchanged; on dark glass, attacker icons get a white edge and attacker rings turn light (`--atk-ring`).
  - Floating layout (`data-layout="floating"`): scenario card top left (logo, Attacking/Defending badge, goal, scenario · battlefield · climate · game code), status capsule top center (clock, objectives A/B/C as rings, next reinforcements or the A hold timer), controls top right (pause, speed, settings, controls, hide interface, new game). Below the card, either the inspector (selection and forces; collapsible sections) or a rail of round buttons that opens it. The map legend is in the Controls popover (`?`), under the controls, laid out in four columns. Bottom right: select by type with the supply and line-of-control toggles, then the order tools (or, while deploying, Dig Trench, the trench budget, Undo and Begin Battle). Event log bottom left as white text on the map, newest at the bottom: a four-line window that scrolls (wheel or touch) back through the last 40 events, fades older lines toward its top (full strength while hovered), and jumps back to the newest whenever a new event comes in (`lastLogNew`). The same message repeated within 2 s (several units cut off at once) shows once with a count (×3).
  - Docked layout (`data-layout="docked"`): `applyLayout()` moves the same pieces into a flush top bar, a left outliner (`#sideL`: objectives, goal, forces) and a right inspector (`#sideR`: selection), with one command dock along the bottom.
  - Objective rings (`ring()`): owner colour, filled as far as the owner's hold (`takeFrac`); orange arc while contested, with the taker's progress as a percentage once it is above 0; dotted grey when neutral. The map draws the same ring for each objective in `draw()` (no background: a light track, a soft shadow and a white halo on the Inter letter keep it readable), with its name below in Inter, inside the dashed capture circle. Clicking an objective pans the map to it. Callouts (`updateCallouts`, `placeCallouts`) that pointed at an objective being taken are commented out, along with their calls in `updateHUD`, `frame` and the `#callouts` click handler; the markup and CSS are still there. (Their "% taken" read 0% at the start of a capture.)
  - Collapsing: clicking the scenario card shrinks it to a logo pill; clicking the clock shrinks the status and the controls together (the controls then show pause, speed and a More menu); the chevron at the end of the order tools hides their labels and shrinks the select bar to a pill; the inspector's chevron closes it to the rail; clicking the event log shows only the newest line. The inspector opens by itself when you select units unless you closed it (`ui.panel`: `auto` | `open` | `closed`).
  - Preferences (`ui`): layout, appearance (Light, Dark, Auto follows the system), collapsed panels and open sections, saved to `localStorage` key `company.ui` when the browser allows it.
  - Keys added: `U` hides or shows the whole interface, `?` opens Controls, Esc closes a popover first. Double-clicking a unit selects every unit of its type. Tooltips (`data-tip`, `data-key`) show a label and its key for mouse users; key hints are hidden on touch-only devices.
  - Order tools are disabled when they can't be used: Move, Attack-move and Hold need a selection, Fire needs artillery, Pontoon and Repair need engineers, Air strike needs strikes left. Pause and speed are disabled while deploying. Settings, Controls and More are popovers and don't pause the game; the New game sheet does.
  - **Game modifiers** (`#mods`, `setupMods(opts)`, `renderMods`, refreshed from `syncCode` and `showStart`): a small panel (250 px) at the top right of the New game screen listing only what the chosen setup changes from a standard game (Standard Battle, River Town, Temperate, Normal, standard defense), from the player's side. One line each: a coloured icon inline (`MODIC`, no tile), what changes, and the value; the reason is in the row's tooltip. Possible rows: time limit, what wins, your and the enemy's force as changes against the standard one (from `forceFor(side, base, o)`, which takes an optional setup so it matches what spawns), air strikes (only if not 2 each, or none; `airFor(side, o)`), vision, off-road movement, frozen water, no river / lake (no pontoons) / rock ridges, no trenches, the trench budget (always shown to a defender who deploys, coloured only when it differs from the standard 2.0 km), no deployment, counterattack or neutral starts, each reinforcement wave, and difficulty (only if not Normal). A standard game shows "None: standard rules". Its header collapses it to a pill (`ui.compact.mods`). It's the same floating glass card, 16 px from the corner, in both layouts (a flush docked version was tried and dropped); in Docked, the New game sidebar (Show Map) still runs flush down the left edge. The centered sheet moves left to make room at 1210 px and wider; below that the panel shows only with the map shown; it's hidden on phones. With the map shown, the zoom buttons sit above the Satellite / Strategic switch at the bottom right.
  - New game sheet (`#startModal`): scenario list with descriptions, battlefield tiles, climate, side, difficulty, defense strength, seed and game code (still editable, so a friend's code can be pasted). Show Map turns it into a sidebar with the map live behind it (pan, zoom buttons, Satellite / Strategic). End sheet (`showEnd`): result icon and title, reason, final objective rings, battle time and losses, a summary list, the enemy's plan with a one-line description (`DOCTRINE_DESC`, defender games), and Watch Replay, New Map, Play Again.
  - Responsive: under 1360 px the status shows rings without names; under 1024 px the order tools are icon-only; under 600 px (phones) the top capsules are compact, the scenario card opens from an info button, the inspector is a bottom sheet with Selection / Forces tabs, and the command rows run full width and scroll sideways.
  - The canvas scale bar is drawn white just above the command dock (`scaleAnchor`, `drawScale`).
  - Not settled yet (from `company-hud/screens/Open-Questions.dc.html`): the U key, the Appearance setting and the touch gestures are the designer's proposals; the Dark and Docked looks other than the ones mocked up, and the paper map under the glass, haven't been reviewed by eye.

## Target stack (when splitting the file)

- Vite + TypeScript. The engine is framework-agnostic TS with no React or DOM imports in engine modules.
- React + Tailwind + Zustand are for the HUD and menus only. The canvas render loop stays outside React.
- Suggested modules, matching the `/* --- section --- */` headers in the current file:
  - `engine/constants.ts`: world size, unit stats, terrain cost tables, forces.
  - `engine/mapgen.ts`: `genMap(seed)`, which must stay pure and deterministic.
  - `engine/pathing.ts`: flow fields, `descend`, `route`, `nearestPassable`.
  - `engine/sim.ts`: `step(dt)`, combat, vision, supply, capture, win check.
  - `engine/ai.ts`: `aiDefender`, `aiAttacker`.
  - `engine/orders.ts`: `order`, `deployMove`, `hold`, fire missions.
  - `render/terrain.ts`: the one-time prerender to an offscreen canvas.
  - `render/draw.ts`: the per-frame dynamic layer.
  - `input/`: pointer, touch and keyboard handling, plus the camera.
  - `ui/`: HUD, panel, log and modals.

## World model

- **World size:** 2000 × 1400 px, where 1 px = 2.5 m (so the map is 5 × 3.5 km).
- **Logic grid:** cells of `C = 8` px, giving 250 × 175 cells. Index is `cy * GW + cx`; use `cellOf(x, y)` and `cc(i)` (cell center).
- **Terrain class (`M.cls`):** `OPEN 0`, `FIELD 1`, `FOREST 2`, `URBAN 3`, `WATER 4`, `STREAM 5`, `ROCK 6`. Rock (mountain ridges only) is slow for infantry and engineers and impassable for armor and artillery.
- **Road flag (`M.road`):** `0` none, `1` road, `2` highway, `3` bridge (a road over water), `4` pontoon.
  - Bridges move at highway speed and pontoons at road speed, so crossing water never slows a column.
  - Cratered road (`M.dmg`, which is the same array as `G.dmg`) moves at `ROAD_DMG.move` × the off-road speed of the ground under it, so it's slower than leaving the road, and it doesn't carry supply.
  - Where a road crosses a stream, the stream cells beside it also get the road flag, so a column spreading off the carriageway doesn't wade.
  - `M.road` changes during a game as bridges fall and pontoons are finished. `M.road0` keeps the generated grid, and `applyCrossings()` rebuilds `M.road` from it plus `G.bridges` and `G.pontoons` (and clears the flow-field cache). Call it whenever crossings change or `M` is regenerated mid-game.
  - Roads override terrain for movement.
  - Town streets also set road flag `1`, so they speed movement and carry supply. They are drawn from `M.streets`, not `M.roads`.
  - Highways are rasterized about two cells wide. Every road's cell chain is kept 4-connected so narrow bridges stay passable.
- **Height and trenches:**
  - `M.hgt` is height normalized to 0–1. High ground (`HILL`, `hillK`) gives bonuses that grow with height from `.62` to full at `.95`: up to +40% direct-fire range, +20% artillery range, +35% vision, and 12% less damage taken. `rangeOf(u)` is a unit's effective range where it stands.
  - Selected units (up to 8) show a dashed range ring, amber when they have a high-ground bonus, and the panel shows the best bonus in the selection.
  - `M.trench` is a mask rebuilt from trench polylines (cells within about 12 px of a trench line).
  - **Dug in** (`dugIn(u)`, constants in `TRENCH`; satellite copy): a unit on a trench cell that isn't moving. Dug-in units take ×0.42 direct fire, ×0.45 shells and ×0.5 bombs, and are seen at ×0.6 enemy vision range. A unit passing through a trench gets none of this.
  - An order aimed within `TRENCH.snap` (40 px) of a trench puts the units onto the trench line, `TRENCH.gap` (18 px) apart around the point clicked, during deployment and in play (`trenchNear`, `trenchSpots`).
  - Dug-in units show a brown arc on the side facing the enemy; the selection panel counts them, and the help screen explains trenches.
- **Front line and river:** `M.ry(x)` and `M.rw(x)` give the front line's center and the river's width there. It's a function of x, so `M.water(x, y)` and `M.side(x, y)` are cheap to call (`-1` is north). On a dry map (`M.wet` false) the line keeps its curve but `rw` is 0, so there's no water, no bridges and no pontoons, and everything that uses `ry` (deployment limit, sides, AI pin points) still works.
- **Sides:**
  - `'A'` is the attacker: south, depot at the south end of the main highway, color `#17181c`.
  - `'D'` is the defender: north, color `#7a2cbf`.

## Battlefields (`MAP_MODES`)

- `genMap(seed, mode)`; the rng is seeded with `seed + mode.salt`, and River Town's salt is 0. Each mode sets generation parameters (river width and bumps, an optional lake, valley strength, hills, ridges and rock height, town scale and extra quarters, downtown bridges, villages, streams, forest and field shares, objective C distance) and rules (force changes per side, trench budget multiplier, vision multiplier, air strike change, and the attack plans the AI may draw).
- **River Town:** the original map.
- **Lake Narrows:** one huge widening of the river into a lake, crossed by the main highway as a long causeway; the flank crossings stay narrow. Pontoons can't span the lake (`PONTOON.maxLen`).
- **City Fight:** a bigger town with four extra outer quarters and two downtown bridges. Infantry-heavy forces, 80% trench budget, slightly shorter vision.
- **Open Steppe:** dry (no river). A lateral road runs along the front line and crosses the main highway at objective A, a crossroads. Mostly fields, many villages. More armor, 140% trench budget, longer vision; streams may run off the map edge.
- **Mountain Pass:** rocky ridges down both flanks (rock above `rockH`); roads are the passes. Infantry-heavy forces.
- **Deep Woods:** about 40% forest, a narrow river, a small town. Vision ×0.8.
- Objective A has `kind` `'bridge'` or `'crossroads'`. `M.waterLabel` and `M.waterAt` place the river or lake label.

## Difficulty (`DIFFICULTY`)

- Applies only to the computer's side: force size (`forceFor`), air strikes (`airFor`), the AI air cooldown, and how much of an assault group must be left before it breaks off (`breakAt`).
- Force order: base table (`FORCES[strength]` for the defender, `ATK` for the attacker), then the battlefield's changes, then difficulty if the computer plays that side.

## Map generation rules

- `genMap(seed, mode)` uses only the seeded `rng` (mulberry32) and `makeNoise`, never `Math.random`. The same seed and mode must produce the same map.
- Build order: river → height and hills → streams → town quarters → highways and flank crossings → villages → country roads → land use → farm tracks → street road flags → terrain classes → bridges → contours → objectives.
- **River:** meanders with a capped slope, stays narrow in open country and widens through the town.
- **Height:** a valley around the river plus noise plus a few hills. One hill is placed north of the town for objective C.
- **Streams:** start on high ground and descend the height gradient, biased toward the river. Each ends in the river or joins another stream (or leaves the map, on a dry map), and carves a shallow valley. A stream that curls back within 16 px of its own earlier course is discarded, so none loop.
- **Town:** quarters on both banks around the main bridge (`D[0]` is the north core). Each `M.D` entry has a `side`, and its urban cells and streets are clipped to that bank.
- **Roads:** each road is rasterized as it's added (`addRoad`). Country roads, village links, edge entries and farm tracks come from a least-cost search (`cheapest`) that avoids slopes, water, the river bank, the town and the map border. Only the stretches off the existing network become new roads (`commit`).
- **Land use (`M.lu`):** `0` open, `1` field, `2` forest, `3` rock (cells above the mode's `rockH`, except roads and towns). Cells are scored with noise plus terrain and proximity terms, each class takes a fixed share of the land, and components under 24 cells are dropped. Forests and fields keep clear of towns and of each other.
- Terrain classes are then set in this priority order: land use → urban → streams → water. Roads live in `M.road`, separate from `M.cls`.
- Road crossings over water automatically become bridges. Each crossing is also recorded in `M.bridges`, which is used for the bridge map symbol.
- `M.spans` groups the river bridge cells (road flag `3`) by the bridge symbol they belong to. Each game copies them into `G.bridges`, which can be destroyed.
- Objectives are built in this order:
  - `objs[0]`: the main highway bridge nearest the town.
  - `objs[1]`: the center of the north town district.
  - `objs[2]`: the highest non-urban cell north of the river, 260–720 px from the town.

## Simulation

- **Timing:**
  - The sim runs at a fixed step `STEP = 1/20` s, multiplied by the game speed (1×, 2× or 4×). Nothing advances while paused.
  - Throttled systems run on accumulators: vision every 0.2 s, supply every 1 s, AI every 2 s, capture every 0.5 s.
  - The game ends at `TIME_LIMIT = 15 min` of game time.
- **Unit types:** infantry, armor, artillery and engineers (`UNIT_TYPES`). The attacker has 2 engineers (`ATK.eng`) and the defender has 1 (`FORCES.*.eng`).
- **Units:** plain objects with:
  - Identity and position: `side`, `type`, `x`, `y`, `hp`, `max`.
  - Movement: `path` (a list of points), `mode` (`idle` | `move` | `amove` | `hold`) and `queue` (queued legs `{x, y, fx, fy, mode}`, player only).
  - Combat state: `tgt`, `sup` (in supply), `rev` (seconds remaining of being revealed by firing), `fireAt` (artillery).
  - AI fields: `role` (`line`, `reserve`, `art` or `eng`), `post`, `home`, `obj`, `via`.
  - Engineering: `build` (pontoon id), `buildEnd` and `buildFrom` (the bank end being worked from).
- **Movement:** speed is `TYPES[t].speed * mult(type, cell)` (cost tables `MOVE` and `ROADMOVE`). A multiplier of 0 means impassable.
  - Units in `amove` stop while they have a target.
  - Units in `move` keep going and fire at 60% effectiveness.
- **Streams:** slow movement (see `MOVE`). A unit standing in a stream (not on a road) fires at `STREAM_FIRE`, takes `STREAM_EXPOSED` × damage, and artillery can't set up there. The main river is impassable everywhere except bridges and pontoons, unless it is frozen in Winter (see Climates in the satellite copy section).
- **Direct fire:** damage per second from the `DPS[attacker][target]` table, multiplied by the target's cover. Lower is better cover:
  - trench `.42`
  - urban `.55`
  - forest `.7`
  - a moving target takes 15% more damage
  - Being out of supply cuts output to 60%.
  - Damage output also scales down with the shooter's lost HP.
- **Artillery:**
  - Needs 3 s stationary to deploy, with a minimum range of 90 and a maximum of 430.
  - Shells fly as projectiles and do 62 damage at the center of a 44 px blast, falling off to the edge.
  - Armor takes 45% of shell damage.
  - A `fireAt` point takes priority over visible targets.
- **Vision:**
  - An enemy is visible if it is inside any friendly unit's vision radius after concealment: forest `.5`, urban and trench `.6`.
  - Firing sets `rev`, which cancels concealment.
  - Enemies that drop out of sight leave ghost markers for 30 s.
- **Supply (`computeSupply`, constants in `SUPPLY`):**
  - Zone of control (`enemyHeld`): a cell is enemy-held when an enemy unit is within `SUPPLY.zoc` (56 px) and closer than any friendly unit (ties go to the friendly side, so ground in contact isn't lost).
  - Each side runs a breadth-first search from its depot over road cells, including bridges and pontoons, that can't enter enemy-held cells or cratered cells (`G.dmg`). Supply detours by other roads where it can; a strike on a road with no way round (the depot's exit, a dead-end road) cuts everything beyond until engineers repair it.
  - Coverage (`G.cov`) spreads from supplied roads over land: up to `SUPPLY.major` (160 px) from a supplied highway, bridge or pontoon cell, up to `SUPPLY.minor` (96 px) from a supplied minor road, and up to `SUPPLY.depot` (240 px) from the depot. It never passes through enemy-held cells and never crosses water except on a bridge or pontoon. A unit is in supply if it stands in covered ground.
  - So units ringed by enemies spaced closer than about 110 px are encircled and lose supply, while a single enemy in contact cuts nothing.
  - A finished pontoon whose near landing is covered carries supply across. Its span is supplied, so its far landing covers like a highway, and roads within `SUPPLY.link` (96 px) of either landing join the network so supply flows on into the far bank. Pontoons chain. A pontoon with no supply reaching it carries nothing.
  - Supply recomputes every second, and at once when a pontoon is finished or a crossing falls. `S` shows the covered area as a light tint under the supplied roads.
  - Units in supply heal 1.2 HP/s after 10 s without being hit.
- **Capture:**
  - Each objective has a 75 px radius and a progress value `p` from `-1` (attacker) to `1` (defender).
  - Progress moves at `CAPTURE.rate × min(3, units present)` per second. The owner's units count out to `CAPTURE.hold` (110 px, so the trenches around an objective hold it), while the other side's count within `CAPTURE.radius` (75 px).
  - Artillery does not count toward capture.
  - Ownership flips only when `p` reaches ±1.
- **Pontoons (`G.pontoons`):**
  - `pontoonSite(x)` lays a crossing along the river's normal, bank to bank, as two lanes of 4-connected cell chains, so columns don't jam. It's refused if it is wider than `PONTOON.maxLen`, has no land at an end, or is within 35 px of another crossing.
  - An engineer works from the bank end on its own side. While it stands within `PONTOON.reach` and isn't moving, it adds `dt / PONTOON.time` progress (60% of that out of supply), and several engineers stack.
  - Any other order clears an engineer's `build`. An idle engineer standing at the bank end of an unfinished site of its side picks the job back up (`resumeBuild`). A `P` click anywhere along an unfinished site's outline joins it rather than starting a new one.
  - A finished pontoon sets road flag `4` on its cells. Either side can use it, and it carries supply.
- **Air strikes (`G.strikes`):**
  - Each side has `AIR.count`. A strike lands `AIR.delay` seconds after the call and drops four bombs in a line along a random heading.
  - Each bomb damages every unit within `AIR.radius`, on either side. Cover reduces the damage and armor takes 60%.
  - Any bomb within `AIR.bridgeHit` of an intact bridge's or a finished pontoon's span destroys it (`strikable()`). Unbuilt pontoon sites can't be targeted or destroyed. `crossingsFell` then throws units off the span (25% damage) and replans routes that crossed it.
  - Bombs crater ordinary road and highway cells within `ROAD_DMG.radius`. Engineers repair them (`R` mode / `startRepair` / `repairStep`), one cell per `ROAD_DMG.cellTime` s, working on every cratered cell within 90 px of the point clicked. Bridges can't be repaired, only replaced by a pontoon. AI engineers with nothing else to do repair cratered road on their own bank (`aiRepair`).
  - Crossings have health (`CROSSING_HP`). A bomb on the span destroys it outright. A fire-mission shell (one aimed at `fireAt`, not at a spotted unit) within `SHELL_VS.hit` of a span takes `SHELL_VS.bridge` or `.pontoon` off it (`shellOnInfrastructure`), so about ten shells drop a bridge and four a pontoon. A damaged crossing shows its remaining health on the map. Fire-mission shells landing on road crater it with probability `SHELL_VS.crater`.
  - The attacker AI's artillery aims at the far bank beyond any crossing near its objective, so it doesn't wear down bridges it needs.
- **Win conditions:**
  - The attacker wins by holding all 3 objectives at any time.
  - Either side wins if the enemy is wiped out.
  - When time runs out, the attacker wins with 2 of 3 objectives and the defender wins otherwise.

## Pathing

- `flowField(type, targetCell)` runs Dijkstra over the 8-connected grid and blocks diagonal moves that cut a corner.
  - Fields are LRU-cached (24 entries) keyed by unit type and target cell. Each one costs roughly 10–25 ms.
  - Costs are stored as `Float32Array`, so new costs are rounded with `Math.fround` before comparing, and each cell is expanded once. Without both, the search either drops live heap entries or re-queues cells forever.
- `descend()` walks the field downhill. Off-road it keeps only the cells where the direction changes. On a road cell it uses that cell's nearest point on the drawn road or street line (`M.rpx`, `M.rpy`, `M.rpOk`, recorded during map generation), so units trace the real curve instead of a staircase beside it. Points closer than 5 px are dropped.
- `route(u, x, y, mode, fx, fy)` builds a unit's full path with `descend`.
  - `fx, fy` is the field target and `x, y` is the final point.
  - AI code must pass the objective center as `fx, fy` and add its random jitter only to `x, y`. Otherwise every unit misses the cache and the game hitches.
- Group orders compute one field per unit type and keep the formation by offsetting each unit's final point (offset capped at 70 px).
- `separate()` pushes units apart only onto passable ground, and never pushes a unit from a road cell onto a non-road cell (`canPush`). A column bunches along the road instead of spilling onto the slow ground beside it.
- `descend()` never takes a diagonal step that cuts the corner of an unreachable cell. That's the same rule `flowField` uses, and it matters on narrow pontoons.
- A path's straight last leg to the exact point clicked is kept only if it stays on passable ground (`clearLeg` / `finish`). Otherwise a formation offset on the far bank would walk a unit across the river.
- `moveUnit` never steps from dry ground into an impassable cell. It slides along one axis instead, or drops the route if both axes are blocked.

## AI

The AI below is the version in `index.html`; `bridgehead.html` still has the older, simpler AI.

- **Shared:**
  - Each AI side plans from what it has seen. `aiSee(side)` keeps `G.seen[side]`, the last position of every enemy unit it has seen, for up to a minute; unseen units are never used.
  - `W8` weighs unit types when comparing forces (tank 2, infantry 1, artillery and engineers 0.6).
  - `coverNear(p, r, type, side)` finds the best covered standing spot nearby (trench, then town, then forest).
  - `slotPos` lays waiting units out in a loose line across the direction of the enemy, 44 px apart with ranks 64 px apart. No four are then within an air strike's reach, so the AI's own clustering rule never finds them.
  - `aiArtillery` picks fire missions: the remembered enemy cluster with the most weight in range, favouring fresh sightings and enemies near the focus point. It never aims within 70 px of friendly troops, or near a crossing the attacker still needs.
- **`aiDefender`** (the player attacks):
  - Threat per objective comes from recently seen attackers near it, counted double inside it and higher on the defender's bank.
  - The reserve waits under cover behind the town (`G.dai.stage`), in formation. When an objective is threatened it moves to a covered blocking position behind it. It counterattacks (`defendSpot`; a bridge is held from the north bank) only when the objective is actually being taken and its strength plus half the local defenders is at least 0.85 of the attackers there (0.6 if the objective has already fallen). It never crosses to the attacker's bank. Reserve units under 30% HP fall back to heal.
  - Line infantry hold their trench posts. Posts on the far bank are given up for the near bank when visible attackers outnumber the local defenders 2.5 to 1 (and are at least 3 strong). When an objective is under attack and has fewer than 4 line units, up to two shift to it from the quietest objective, which keeps at least two. Hurt line units that aren't fighting pull back to heal.
  - Artillery fires missions on remembered attackers near the threatened objective. After 40 s with nothing in range it moves up behind that objective, clear of the reserve and away from known attackers.
  - The engineer repairs cratered road.
- **`aiAttacker`** (the player defends) follows a plan from `planAttack()`, built at game start. It draws one doctrine at random, with random flank sides, group sizes, timings and objective order; the end screen shows which one.
  - The battlefield limits which doctrines can be drawn (`doctrines`), and the surprise crossing is never drawn on a dry map.
  - Doctrines: broad front (all three crossings at once); feint, then main thrust; flank hook (a pinning group at the main bridge, the main body through a flank); bombard, then assault (two late waves); surprise river crossing (engineers bridge a gap far from the bridges while the main body waits); probe and exploit (three small probes, with the reserve committed behind the one that gets furthest).
  - Groups gather 240 px back from the river, each unit in its formation slot, and move off once 70% of their units are there, or after a minute.
  - Stances: `assault`, `probe` (falls back to `pin` if halved), `pin` (holds the south bank opposite its crossing in formation, then joins the assault), and `reserve`.
  - A unit inside an objective it hasn't taken holds on while the capture runs. If the capture has been stuck for 20 s (`P.stall`; the defenders holding it are out of reach, as across a lake), it goes after the defenders known to be within the hold radius, or pushes through to the objective's far side.
  - Objectives with no ground to stand on inside the capture zone (a causeway objective once its causeway is down) are skipped. With nothing left to take, a group waits at its assembly area.
  - An assault that falls to `breakAt` of its strength breaks off, regroups and heals for 1–2 minutes, then goes again. Units under 30% HP fall back to heal and rejoin above 80%.
  - Artillery supports the biggest group on the move: it closes to about 300 px of that group's objective and shells defenders it can see, otherwise the objective area (beyond any crossing there).
  - Units drop a crossing they can't reach (its bridge is down) and head straight for the objective.
- **Attacker engineers (`aiEngineer`):** build a pontoon 50–90 px beside any fallen bridge that has no attacker pontoon nearby, help finish an open one, repair cratered road, or otherwise wait 300 px back from the main bridge.
- **How the AI was tuned:** AI-against-AI games were run in the Node harness, with the simulation's random numbers seeded per game so before-and-after comparisons are exact. Each test covered 32 games on River Town, Open Steppe, Mountain Pass and Lake Narrows, plus a check on City Fight and Deep Woods. Results, in attacker wins out of 32:
  - old attacker against old defender: 24
  - current attacker against old defender: 23, with fewer attacker losses (7.4 against 8.4)
  - old attacker against current defender: 18
  - current attacker against current defender: 19 (on City Fight and Deep Woods: 10 of 24, against 7 for the old attacker)
  - current attacker against a defender that gives no orders: 32, in about 6 minutes
  - Tried and rejected for the attacker, because each made the attack slower and together cost about 10 wins against the current defender: gathering further back in cover, an artillery stand-off position, switching to the weakest crossing, holding leaders back until the group caught up, and leaving garrisons on captured objectives.
- **`aiAir`** runs on the AI tick, at most once per `AIR.aiCooldown`. It uses enemies seen in the last 8 s. It never strikes within 90 px of its own units, and the attacker never bombs next to a crossing it still needs.
  - The defender strikes, in priority order: attacker pontoons it can see, then bridges with 3 or more visible attackers within 220 px on the south bank, then clusters.
  - A cluster is the heaviest group within 65 px of one another, weighing at least 4 (tanks count double).
- **Moving into a crowd:** a unit counts its last waypoint as reached once within 16 px if a friendly unit already stands on it. Otherwise units sent to one point push each other off it forever.

## Player defender deployment

- `G.phase` is `'deploy'`, then `'play'`, then `'over'`.
- During deployment, orders teleport units. Units must stay north of `M.ry(x) + ZONE` (where `ZONE = 260`).
- The trench tool spends `G.budget`, measured in px; the HUD shows it in km.
- Undo (button or `Cmd/Ctrl+Z`) pops `G.undo`. During deployment it can restore unit positions or remove a trench and refund the budget spent drawing it. The stack is cleared when the battle begins.

## Rendering

- **Terrain:** drawn once into an offscreen canvas `tc` at 1.25–1.5× scale, then shown each frame with `drawImage` under the camera transform.
  - Fields and forests come from `M.lu`: each class mask is blurred and thresholded per pixel, which rounds the outlines and leaves white gaps where classes meet.
- **Crossings:** a fallen bridge is painted over with water, clipped to the river, leaving the bridge symbol's bank ends as stubs.
  - Pontoons are drawn as boats under a white deck, with unbuilt length dashed and a percentage label. Enemy sites appear once your units can see them.
  - Your own inbound strikes show a dashed target ring with a countdown. Planes fly through for 1.5 s either side of impact.
- **Cratered road:** a white gap in the road. Inside a clip of small discs around the damaged cells, the nearby road and street lines (`G.dmgLines`) are stroked again in their white casing width, so the red line breaks without spilling past the road's edges. One small grey × marks each stretch (`G.dmgSpots`, holes within 40 px merged), placed on a damaged cell.
- **Order arrows:** each of the player's units with a path gets an arrow along it. It's solid while paused and faint while running.
- **Hint banner (`#banner`):** what a click on the map will do now (`<b>Move</b> · Click the map to …`), top center below the status capsule (Docked: plain text on the map). It fades while the mouse is near it.
- **Errors:** `frame()` schedules the next frame first and catches errors. An error pauses the game and posts to the log instead of freezing the loop.
- **Dynamic layer:** everything else (units, trenches, objectives, labels, effects) is drawn in screen space through `ws(x, y)`, so line widths and symbols stay a constant size at any zoom.
- **Camera:** `cam = {x, y, z}`, with `s2w` for screen-to-world conversion. Zoom ranges from the fit level to 4×.
- **Map style:**
  - white paper background
  - red roads with white casing (thick for highways)
  - blue water `#0b57f0`
  - forest `#0d7a2e`
  - fields `#f8c9a0`
  - trenches as brown zigzags
- **Unit symbols:** infantry circle, armor square, artillery triangle, engineer hexagon. The HUD fonts lack a hexagon glyph, so the HUD uses the inline SVG `HEX`.
  - A dashed red outline means out of supply.
  - A white bar means holding.
- **HUD:** see "HUD (satellite copy)" above. `bridgehead.html` still has the printed map-legend boxes.

## Controls

- **Mouse:**
  - Left-drag to box-select; click a unit to select it, with Shift to add.
  - Left-click the map gives the current order to the selected units. Right-click does too; right-drag pans.
  - Ctrl- or Cmd-click (left or right) is a straight-line move or attack-move (satellite copy). `flowField(type, ti, true)` gives every passable cell the same cost, so the route ignores roads but still goes round water and other ground the unit can't cross. `descendDirect` then pulls it tight with `clearLeg`. The flag travels with the order (`u.direct`, a queued leg's `direct`), so Shift+Ctrl-click queues a straight leg. Straight-line order markers are dashed.
  - Shift-click (or Shift-right-click) the map queues a move or attack-move after each unit's current orders (`queueOrder`, `u.queue`); a plain order replaces the queue. Each queued leg is routed only when the previous one ends, from where it ends, and keeps the formation. Queued legs draw as dashed arrows.
  - Selecting units that lack the current mode's unit type (engineers for pontoon and repair, artillery for a fire mission) drops the mode back to move (`selectionChanged`).
  - The wheel zooms.
- **Touch:** tap a unit to toggle it in the selection, tap the map to give the order, drag to pan, and pinch to zoom.
- **Keys:**
  - `Space` pauses.
  - `M`, `A` and `F` set the order mode to move, attack-move and fire mission. `H` holds.
  - `P` is pontoon mode: select engineers and click the river.
  - `R` is road repair: select engineers and click cratered road.
  - `X` is air strike mode. It needs no selection, and a click within 40 px of a bridge or pontoon snaps to its middle. The mode returns to move after one strike, and strikes can't be undone.
  - In air strike mode, the strike's ring follows the mouse before you click (satellite copy; `hoverPt`, `airAim`). It snaps to a crossing it would hit, labelled `DESTROY …`, warns when your own units are inside it, turns grey with no strikes left, and isn't drawn past the map border.
  - `S` shows supply lines, `Q` selects all, `Esc` clears the selection.
  - `1`, `2` and `3` set the speed, and `.` / `,` step it up and down; the arrow keys pan.
  - `L` toggles the line of control (satellite copy).
  - `O` toggles order arrows and `V` toggles fog of war.
  - `Cmd/Ctrl+A` selects all. `Cmd/Ctrl+Z` undoes the player's last order, hold or trench (`pushUndo` / `undo`, up to 50 entries). In play it restores routes and modes but not positions. AI orders never go on the stack.
- **Settings:** a popover from the gear button (`#settingsModal`, `renderSettings`): Interface layout, Appearance, order arrows, fog of war, map view and line-of-control style. The game settings live in `settings` and last for the session. With fog off, both sides see every unit (`G.fog`, checked in `computeVis`).

## Conventions

- Keep tunable numbers in the constants block (`TYPES`, `MOVE`, `ROADMOVE`, `DPS`, `FORCES`, `ATK`, `BUDGET`) rather than inline.
- The engine must not touch the DOM. The HUD reads game state and calls order functions.
- Game state lives in `G` and the generated map in `M`. When splitting into modules, pass these around explicitly instead of using module-level globals.
- Map generation must be deterministic. The sim may use `Math.random`; seed it as well if replays or multiplayer are ever added.
- Keep everything mobile-safe: pointer events, `touch-action: none` on the canvas, and a toolbar that scrolls sideways on narrow screens.

## If republishing as a claude.ai artifact

- Ship a single HTML file with no `<html>`, `<head>` or `<body>` tags.
- Scripts may load only from the cdnjs, jsdelivr or unpkg CDNs, and fonts only from Google Fonts.
- No `alert()`, `confirm()` or `prompt()`, and no `window.print()`.
- Don't depend on `localStorage`.

## Next steps (open)

1. Play-test and fix runtime bugs, then balance the DPS values, unit speeds and force sizes.
2. Split the file into the TS modules listed above.
3. Port the AI and supply changes from `index.html` back to `bridgehead.html`, or merge the two files.
4. Minefields for engineers.
5. A minimap; more battlefield types (for example twin rivers or a coastal landing).
6. Balance: in the 18-seed Node bench, a passive defender still loses every game (in about 6 minutes), and the defender AI playing defense wins about 3–5 of 18. That stand-in spreads its infantry thinly and never concentrates, so a person should do better. Re-measure before tuning further.
