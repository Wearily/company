# COMPANY

The game is named **COMPANY** (it was called Bridgehead; the files keep their old names). Real-time, pausable 2D military strategy game played on a top-down paper-map view of a procedurally generated battlefield. One side attacks from the south and the other defends from the north across a west–east front line. The fight is over three objectives: a crossing (a bridge, a causeway or a crossroads), the town, and a hill. There are six battlefield types (`MAP_MODES`) and three difficulty levels (`DIFFICULTY`).

## Current state

- **Hosting:** https://companymap.vercel.app/, deployed by Vercel from the GitHub repo (Wearily/company). `vercel.json` publishes only the game: its build copies `index.html`, `src/`, `styles/` and the contents of `public/` (the favicon set from RealFaviconGenerator and `site.webmanifest`, linked from the top of `index.html`) into `dist/` (git-ignored) and Vercel serves that folder, so CLAUDE.md, `bridgehead.html`, `company-hud/` and anything else in the repo stay off the site. A file the page needs at runtime must be added to that `buildCommand`. The GitHub repo itself is public.
- The game is `index.html` with its code in `src/` and its styles in `styles/` (see **Files** below), where all current work happens (the satellite copy described below). Plain JS and Canvas 2D, no build step and no dependencies apart from Google Fonts. `bridgehead.html` is the older, paper-only version, still one file with one inline `<script>`. `index legacy.html` is the user's backup of the single-file game from just before the split (untracked).
- `index.html` has no `<html>`, `<head>` or `<body>` tags (it began as a claude.ai artifact, which the host wraps); it starts with `<meta charset="utf-8">` so a copy opened from disk shows `×` and `·` correctly.

## Files

`index.html` holds the markup (the HUD, sheets and popovers), then links the styles and loads the code. The split from the single file (Oct 24, 2026) only moved code: maps, terrain renders, five seeded battles of 3 minutes, a UI smoke test and screenshots of the start screen and a battle all came out identical to the single file.

- **How the files connect:** every `src/` file is a **classic script** (not an ES module), loaded in the order `index.html` lists them, each starting with `'use strict'`. Classic scripts share one global scope, so a file can use anything (`const`, `let`, `function`) declared by the files before it, exactly as when it was all one script. This keeps the game working from a local file (ES modules don't load from `file://`) and needs no build.
  - Load order matters only for code that runs while the page loads: a file's top-level statements may use only what earlier files (or earlier lines) define. Functions run later (event handlers, the frame loop) can use anything. `main.js` is last and starts everything.
  - Function declarations become `window` properties: don't name one after a browser built-in (`reportError` was renamed `reportFrameError` for this; `open`, `close`, `stop`, `print`, `name`, `top` and the like are out).
  - Adding a file: add its `<script src>` line in the right place in `index.html`; anything new outside `src/` and `styles/` must also go into the `buildCommand` in `vercel.json`.
- `styles/`: `base.css` (tokens for Light and Dark, glass materials, shared components, the HUD layer), `hud.css` (the Floating layout and the HUD components), `docked.css` (the Docked layout), linked in that order (the cascade depends on it).
- `src/engine/`: the game itself.
  - `constants.js`: tunable numbers and tables (units, movement, damage, forces, scenarios, climates, battlefields, game codes, colours).
  - `utils.js`: small helpers.
  - `state.js`: the shared state, `G` (the battle), `M` (the map) and `settings`.
  - `messages.js`: `tell` / `tellTo`, event-log messages worded for whoever reads them.
  - `mapgen.js`, `mapgen2.js`: the legacy generator, the V2/V3 generator (`genMap2(seed, mode, ver)`) and `makeMap`.
  - `pathing.js`: flow fields and routes.
  - `setup.js`: starting a battle, `newGame`.
  - `sim.js`: `step` and the win check.
  - `record.js`: replay recording.
  - `ai.js`: both computer players.
  - `econ.js`: Company Command: resources, the depot queue, victory points, the computer's buying.
  - `crossings.js`: bridges, pontoons, road damage, air strikes.
  - `orders.js`: unit orders, deployment, undo.
  - `commands.js`: `act` / `runCmd`, every player action as a command (see **Multiplayer**).
- `src/render/`:
  - `terrain.js`: the canvases, `renderTerrain` and the Strategic style.
  - `satellite.js`: the Satellite style.
  - `scenery.js`: the scenery ring.
  - `draw.js`: the per-frame dynamic layer.
- `src/ui/`:
  - `input.js`: camera, pointer, touch and keys.
  - `replay.js`: replay playback, saving and opening.
  - `hud.js`: HUD overlay, preferences, layouts, selection card, popovers, settings, the event log `addLog`.
  - `depot.js`: Company Command's Depot card, victory points readout, rally clicks and keys.
  - `newgame.js`: the New game sheet, game codes and the Modifiers panel.
  - `endsheet.js`: the end sheet and resuming.
- `src/main.js`: startup and the frame loop. **Startup order:** the interface stays hidden (`html:not(.ready) #app` in `base.css`) until the code has filled it in, so the empty markup never flashes. `main.js` then adds `.ready`, and only after that first paint builds and draws the preview map (`preview`, about 1–1.5 s) and starts the frame loop. The map canvas fades in on `.mapready`. If a battle is started in that gap, the preview is skipped. A small inline script at the top of `index.html` shows everything anyway after an error or 8 s, so a startup failure can't leave the page blank.
- **Where the engine still reaches into the page** (to untangle before multiplayer, which needs an engine that runs without the HUD):
  - `setup.js`'s `newGame` resets the HUD (sheets, `ui.panel`, tools, `fit`, `updateHUD`).
  - `sim.js`'s `end` opens the end sheet (`showEnd`), and the line of control draws into a canvas there.
  - The engine posts to the event log through `tell` (`messages.js`), which calls `addLog` (in `hud.js`).
  - `settings.fog` (in `state.js`) changes what each side sees.
- It has **not been played end to end**, so expect runtime bugs and balance problems. Fix those before adding features.

## Multiplayer (in progress)

Real-time player against player, planned with the user on Oct 24, 2026 (plan: `~/.claude/plans/prancy-hatching-clarke.md`):
- **Network:** Supabase Realtime carries messages, with no tables and no server code.
- **The host's browser runs the battle.** The guest's screen mirrors it from a 10 Hz stream and sends its orders as commands. Lockstep was ruled out: the sim uses unseeded `Math.random`, and `Math.hypot`/`sin`/`cos` may differ by an ulp between browsers.
- **Lobby:** host-only settings. The guest must press Ready before the host can start.
- **Deployment:** the defender deploys against a countdown while the attacker waits.
- **Pause:** no speed changes; the battle pauses only when a player disconnects.

All multiplayer behaviour sits behind `G.mp`, which a single-player game never sets (`G.mp` is `null`).

**Phase 1, the engine prep, is done.** It changed nothing in single-player: the fingerprint test (maps, renders, seeded battles) and a UI-path test came out identical. The UI test covers deploy moves, queued orders, trenches, undo, Begin Battle, holds, fire missions, pontoons, repair and air strikes, comparing game state and every log line.
- **Commands** (`commands.js`): the interface changes the battle only through `act(c)`. Commands are plain data with kind `k`:
  - `order {ids,x,y,mode,direct,queue}`
  - `hold {ids}`
  - `air {x,y}`
  - `trench {parts,spent,live}`
  - `undo`
  - `begin`

  `runCmd(side,c)` runs one for a side, using only that side's own units. A multiplayer guest's `act` hands the command to `G.mp.send` instead. The UI call sites are `orderAt`, `airAt`, `holdSel` and `endTrench` (`input.js`), and Undo, Hold and Begin (`hud.js`). `hold(units)`, `undo(side)` and `sideAir(side,x,y)` (which replaced `playerAir`) take their side and units explicitly.
- **Messages** (`messages.js`): `tell(f)`, where `f(reader)` returns `[text, cls]` or nothing. `tellTo(side,text,cls)` tells one side only. Every engine log line goes through these instead of choosing its wording from `G.player`. The local player's wording goes to `addLog`; a host with `G.mp.tell` also passes the opponent's wording on.
- **`G.mp` guards:**
  - no computer player (the AI tick in `step`);
  - no difficulty in `forceFor`/`airFor`;
  - `newGame` with `opts.mp` deploys whenever the scenario deploys, isn't paused, runs at 1× and has fog on;
  - `setSpeed`, `togglePause` and the fog setting refuse, and their buttons are disabled;
  - the New game sheet and frame errors don't pause it.

**Phase 2, the lobby, is done.** Single-player is still identical on both tests. A two-player test (`mp_lobby_test.html` in the session scratchpad: two iframes over local mode, served over HTTP) passes all 15 checks: create, join by link, live settings, Ready, the Ready race, start, a guest order on the host, an order for the wrong side refused, and leave. Joining also works between two tabs opened from disk.

The files:
- `src/net/config.js`: `MP`, the Supabase URL and anon key (empty, so local mode), the protocol version (2), room codes (6 characters, no 0/O/1/I), keep-alive (1 s), timeouts (15 s; 6 s to join), frames per second (10), the full refresh (3 s) and the deployment time (180 s).
- `src/net/transport.js`: `openTransport(room)` returns `{kind, send, onMessage, close}`. It is the only file that knows the service:
  - **Supabase:** a Realtime broadcast channel `company-<room>`. supabase-js 2.45.4 is loaded from jsdelivr only when a room opens.
  - **Local:** a `BroadcastChannel`, or, on `file://` pages (where tabs can't share one), `localStorage` writes read through the `storage` event.
- `src/net/lobby.js`: the session `L` (role, room, peer, ready, rtt, inGame). Messages are `{type, from, to?}`:
  - the host sends `lobby` (its settings and the guest's Ready, on every change and every second), `start`, `log` and `refuse`;
  - the guest sends `hello`, `ready` (with the settings key it saw, so a Ready that crosses a settings change is ignored) and `cmd`;
  - both send `ping`/`pong` and `leave`. Each side pings every second and answers the other's pings at once, so a partner in a background tab still shows it's there.
- The session hooks: `mpOptsChanged` (called from `syncCode`) passes the host's changes on and un-readies the guest. `mpApplyOpts` gives the guest the settings with the sides swapped, rebuilding the preview only if the map changed. `mpStart` / `mpBeginGame` call `newGame({...opts, side, diff:'normal', mp})`. The host sets difficulty to Normal in the lobby and puts it back on leaving.
- `src/net/sync.js`: the battle stream from host to guest (see Phase 3 below).
- `src/ui/lobby.js`:
  - the Multiplayer window (`#mpModal`: Create Game, or join with a code);
  - lobby mode of the New game sheet (`body.mp-lobby`, plus `mp-host` or `mp-guest`): `#lobbyBar` shows the code, Copy Invite Link and both players with sides, Ready state and ping; the footer becomes Leave plus Start Game (host, enabled once the guest is Ready) or Ready (guest);
  - `#room=CODE` links (`mpCheckLink`, at startup and on `hashchange`).
- `styles/mp.css`: lobby mode hides Start, Multiplayer, Open Replay and Difficulty, and dims and locks the guest's pickers.
- **Deployment belongs to the defender.** `runCmd` refuses every attacker command while `G.phase==='deploy'`. The attacker doesn't get the deploy tools (`#deployTools`), can't draw trenches (`input.js`), and its banner reads "The defender is deploying…". This bug, found by the user, let a multiplayer attacker teleport units into the defender's zone. Single-player only deploys with the player as defender, so none of this changes it.
**Phase 3, battle sync, is done** (`src/net/sync.js`, hooked in by `main.js` calling `mpFrame(dt)` only when `G.mp` is set). The user reported that after Begin Battle it "starts playing vs AI". In fact no computer player ran: the guest's screen was frozen at deployment while the host played alone against units that only fired back.
- **Host** (`mpHostFrame`, `mpSnap`): runs the sim as before and sends a frame (`f`) `MP.snapHz` (10) times a second. Each frame carries:
  - every unit as 7 numbers: id, x, y, hp, flags (supplied, moving, guns set up, revealed, mode, side, type), target id, and waypoints left for the guest's own units;
  - objectives, air strikes left, the A hold timer, losses, what the guest's side can see (`G.vis`), bridge health;
  - new shells, bursts and air strikes, with their game times;
  - during deployment, the clock and the trench budget.

  Only on change: the guest's own units' routes, queues, fire missions and engineer jobs; bridges down; pontoon sites; road damage; trenches; and the guest's supply coverage (run-length coded). All of these go again every `MP.fullEvery` (3 s), so a lost message heals itself.
- **Guest** (`mpOnFrame`, `mpGuestFrame`, state on `G.mpN`):
  - never steps the sim; it shows the stream one frame behind, moving units smoothly between the last two frames as the replay does;
  - keeps the same unit objects, so the selection holds, and makes new ones for reinforcements;
  - draws tracers from shooter→target pairs, shells, bursts, craters and planes from the event times, and ghosts where enemies drop out of sight;
  - works out the line of control locally;
  - shows the end sheet when the frame says the battle is over.
- **Deployment clock:** the defender has `MP.deployTime` (180 s). The banner on both screens shows the time left, and when it runs out the host runs `begin`. While deploying, the host refreshes vision every 0.5 s, because the sim isn't running.
- **Guest commands:** a guest's `act` returns at once, so click markers show. A guest's trench goes as `live:false`, so the host checks and charges the cost.
- **Undo:** in multiplayer both players' orders share `G.undo`, so each entry records its side and `undo(side)` takes only that side's latest. In single-player there is only one side, so nothing changes.
- **Leaving a battle:** in a multiplayer battle the New game sheet doesn't pause, and the end sheet has no Play Again, which would start a game against the computer. New Map leaves the session.
- **Checked:** a two-player test (`mp_sync_test.html` in the session scratchpad; it drives the host's steps by hand, because frames in headless iframes are slow) passes every check from both seats:
  - the deploy mirror and clock;
  - a trench dug from the guest's screen, charged on the host;
  - the clock starting the battle;
  - both players' orders;
  - the guest's screen within 4 px of the host's;
  - per-side undo;
  - no computer player;
  - Victory on one screen and Defeat on the other.

  Single-player is still identical on the fingerprint and UI-path tests.

**Added after phase 3 (Oct 24, 2026, at the user's request):**
- **Trenches under fog of war** (single-player and multiplayer):
  - The attacker sees only the stretches of the defender's trenches that its units have had within vision range. A stretch once seen stays on the map.
  - `trenchSight()` (`sim.js`, called from `computeVis`, and on a multiplayer guest from `mpOnFrame`) adds each seen 14 px segment's key (`tKey`) to `G.tSeen`.
  - `trenchKnown(side,a,b)` is true for the defender, with fog off, or for a seen segment. `draw()` draws only known runs. `trenchNear(...,side)` won't snap an attacker's order to an unseen trench, which would give it away.
  - `visionR(u)` is the vision radius pulled out of `computeVis` (same maths).
  - The computer attacker's own knowledge of trench lines (`P.dug`) is unchanged.
- **Fog of war in multiplayer:** the Settings switch shows on, greyed out (disabled), with "Always on in multiplayer" (`#fogRow.locked`). `renderSettings` runs whenever the popover opens.
- **Host controls time** (a lobby switch, `#mpTime`, `L.time`; part of the lobby key, so flipping it un-readies the guest; the guest sees it locked):
  - On: the host can pause and change speed, and frames carry `pa` / `sp` so the guest shows the same speed. The guest's controls are disabled, and its banner says "The host has paused the battle".
  - Off (the default): the 1×/2×/4× control is hidden, and pause shows but is disabled.
  - `timeCtl()` (`hud.js`) decides this for `setSpeed`, `togglePause` and the buttons; `G.mp.hostTime` carries it into the battle.
- **The stream stops after leaving:** `mpFrame` runs only while `L.inGame` and the session's room match. Before this, a finished battle still on screen kept streaming into the next lobby once someone joined.

- **The guest's replay:** the guest records the battle from the stream (`mpRec` in `sync.js`). It saves a snapshot every `REC_DT` from the frames, plus shells, bursts, strikes and reinforcement events as they arrive, and restarts when the battle begins. The snapshot tail (deaths, captures, pontoons, bridges, road damage) is `recAdd(f)` in `record.js`, which `recFrame` also uses. So the guest can watch and download the replay like the host.
- **Chat:** `T` in a multiplayer battle opens a message box (`#chatIn`) where the event log ends, and the log moves up while it's open. Enter sends and Esc closes.
  - Messages are `chat {name, text}` (text up to 160 characters) and go into both event logs as `name: text`, so they read `00:00  wearily: here is my message` and are kept in both replays.
  - The name comes from "Your name" in the lobby bar (`#lbName`, saved to `localStorage` key `company.name`), or Host / Guest.
  - `mpChat`, `mpHeard` (`net/lobby.js`); `openChat`, `closeChat` (`ui/lobby.js`).
  - Protocol version 3.

**Phase 4, the battle's edges, is done** (`net/lobby.js`, the battle section; `ui/lobby.js`; `sync.js`):
- **Holding:** in a battle, a player silent for `MP.dropAfter` (5 s), or gone (`leave`, sent on `pagehide`), holds it on both screens (`G.mpHold`, checked each keep-alive tick by `mpHoldCheck`).
  - The sim and the deploy clock stop (`main.js`, `mpHostFrame`), and a sheet (`#mpHold`, `mpHoldUI`) says who's missing.
  - **Claim Victory** unlocks after `MP.claimAfter` (90 s), or at once for a guest whose host left (the battle can't go on without the host).
  - The host's claim ends the battle with `end`. The guest's claim ends it on the guest's own screen and closes the session (`mpClaim`).
  - In the lobby the old rule stays: silent for `MP.peerTimeout` means gone.
- **Rejoining:** the guest's tab keeps `{room, cid}` in `sessionStorage` (`company.mp`).
  - A reload rejoins automatically as the same player (`mpCheckLink`). Anyone opening the invite link can take the seat once the guest has gone quiet.
  - The host answers the hello with `start` plus `resume` (`mpResume`: the battle's settings and the attacker's seen trench stretches) and forces a full refresh, and play resumes.
  - Each battle has an id (`gid`), so a repeated `start` is ignored.
  - The rejoined guest's replay starts from the rejoin, and its event log from then on.
- **A host's tab reloaded mid-battle** has lost the battle, since its browser held the only copy. On load it sends `lost` to the room (`mpAnnounceLost`), and the guest can claim at once.
- **Surrender:** in a battle the New game button (and More → New game) opens **Leave the battle?** (`#mpQuit`). Surrender is the command `surrender`, which ends the battle at once in any phase, with the reason "The attacker surrendered." After the battle the same button brings back the end sheet.
- **Rematch:** the end sheet's buttons become **Back to Lobby** (`mpToLobby`: both keep the session; the host may change settings, and the guest presses Ready again) and **Leave** (ends the session, back to New game). While the guest is still on the end sheet, it doesn't take the host's new settings until it's back in the lobby.
- **The host's tab in the background:** browsers stop animation frames there, so the keep-alive timer steps the battle and sends a frame about once a second (`mpBgStep`). The guest's screen moves less smoothly, but the battle no longer stops. Chrome may slow timers to once a minute after about 5 minutes hidden.
- `MP.proto` is 4.
- **Checked:** a two-player test (`mp_p4_test.html`, `mp_p4b_test.html` in the session scratchpad) passes:
  - surrender from the guest's screen;
  - Back to Lobby and a rematch with a new battle id;
  - a quiet guest holding the battle (the sim stops, and Claim waits 1:30);
  - the hold lifting when the guest is back;
  - a real reload of the guest's tab rejoining the running battle (its clock within 0.3 s of the host's);
  - background stepping;
  - the host claiming after the wait;
  - a reloaded host page letting the guest claim at once.

  Single-player is still identical on the fingerprint and UI-path tests.
  - Headless test caveat: both test pages share one thread under a virtual clock, which can run the guest's 6 s join timeout out while the host is busy rebuilding a map. Joins after several back-to-back battles in one test page sometimes fail for that reason alone.

**Next:**
- Supabase: put the project URL and anon key in `src/net/config.js`, then try two machines. The local mode only joins tabs of one browser. Check message sizes and rates; frames are about 2–4 KB at 10 a second.
- Known limits:
  - The host sends every unit, so the guest's browser holds positions that fog hides; it doesn't draw them.
  - A host that leaves or reloads ends the battle; host migration would need a full snapshot.
  - Chrome may slow a hidden host tab's timers further after about 5 minutes.
- Later: send the guest only what it can see; a lobby chat; host migration.

## Company Command (`SCENARIOS.command`, `ECON`, `src/engine/econ.js`, `src/ui/depot.js`)

A Company of Heroes–style mode, added Oct 30, 2026, at the user's request. The user chose a symmetric start, victory points, Manpower + Fuel, and income from territory plus objectives. Everything is gated on `sc.econ` / `sc.vp`, and `G.econ` is null in every other scenario. Other scenarios are byte-for-byte unchanged (fingerprint test: maps, renders, seven seeded battles with player commands).

- **Start:**
  - Both sides get `ECON.start` (5 infantry, 1 tank, 1 engineer) at their depots. `forceFor` returns it, ignoring battlefield and difficulty.
  - Each side has 600 manpower and 90 fuel.
  - Objectives start neutral (the Meeting Engagement set-up). There's no deployment and no trenches.
- **Fair objectives:** `econObjectives` (called by `econInit` before `spawn`) moves C to the south half.
  - It picks the named district or village nearest B's mirror image through A, or failing that the high ground there. Each side then has a home objective and A sits in the middle.
  - Only `G.objs` changes; `M.objs` and map generation don't. Replays carry the moved C in `names.objs`, and `loadReplay` uses it.
- **Production:**
  - One queue per side (`G.econ[s].q`, up to 5, built one at a time). Cost (manpower, fuel, time, population) is in `ECON.cost`, charged when an item is queued and refunded when it's cancelled.
  - A finished unit appears in front of the depot (`econSpawn` → `addUnit`) and walks to its place in a line at the rally point (`slotPos`, `route` with the rally point as the shared field target). The default rally point is 150 px forward.
  - An enemy within `ECON.depotR` of a depot slows its production to `raidMul`. The depot can't be destroyed.
- **Income** (`econTick`, once a second of game time; rates are per minute):
  - base + `obj` per objective held + `terr` × territory share. The territory share counts the side's own supply coverage (`G.cov[s]`): the enemy's half in full, its own at `terr.own`, divided by half the battlefield's land. Cutting a side's supply cuts its income.
  - Upkeep per unit comes off manpower, never below `minNet` of the gross.
  - The computer's income is × `DIFFICULTY[d].econ` (not in multiplayer).
  - Population cap: `ECON.popCap`, counting units plus the queue.
- **Victory points:**
  - 500 each. From `vpGrace` (1:30), the side holding fewer objectives loses `vpRate[gap]` a second.
  - `checkEnd` hands over to `checkVP`: a side at 0 loses; so does a side wiped out (no units, nothing queued, and not enough manpower for an infantry). At 25:00 most points wins, and a tie is a draw.
  - Holding all three doesn't win outright here.
- **Commands:** `build {type}`, `cancel {i}`, `rally {x,y}`, validated on the host (`econBuild`, `econCancel`, `econRally`).
- **Computer:** the role AI it already plays (`aiDefender` or `aiAttacker`) plus, on the AI tick:
  - `aiCommander` buys toward a mix (`ECON.ai.mix`, more armour when it has seen enemy tanks, at most 2 engineers and 3 guns, keeping manpower back while it waits for fuel).
  - `aiNewUnit` and `aiMuster` fold newcomers in. Attacker infantry and tanks wait at the rally point (`u.pool`) and join only a group that is assembling, sized by its live members, or form a new assault once the pool weighs `ai.wave` (`econGroup`). Two of them garrison a lone captured objective (`holdAt`).
  - Defender newcomers (`role:'muster'`) go to the reserve's staging area, then become line infantry posted at the least-held objective, or reserve armour.
  - `planAttack` draws only broad front, flank hook or feint in this mode.
- **Screens:**
  - **Depot card:** rail button `#railDepot`, card `#depotCard` / section `#secDepot` (Docked: in the left bar under Objectives). It shows manpower and fuel with rates per minute (the tooltip has the breakdown), population, a raid warning, four build buttons (disabled with the reason as tooltip), the queue with progress and cancel, and Set rally point.
  - **Status capsule:** victory points (`vpHTML`).
  - **Map:** a rally flag, a build-progress bar under the depot, and a red ring while the depot is raided.
  - **New game sheet badge:** the scenario list shows a blue ★ New badge after Company Command's name (`isNew` in `SCENARIOS`, `NEW_BADGE` in `newgame.js`, style `.newB`).
  - **Keys:** B (Depot card), 4–7 (build infantry, armor, artillery, engineers), G (rally mode, `G.orderMode==='rally'`). Esc closes the card.
  - **New game sheet:** Modifiers rows for start, build, manpower, fuel, victory points and population cap.
  - **End sheet:** victory points, units built, and what you spent.
- **Multiplayer:** host frames carry `ec` (the guest side's depot), `vp` and `bt` (units built). A guest's rally point shows at once and isn't overwritten for 1.5 s. `MP.proto` is 5.
- **Replays:** frames carry `vp`; the timeline draws victory points as dashed lines over faint strength lines.
- **Tuning:** numbers are first guesses. In a 4-minute test the computer built 3–4 units each side and never went over the cap or below zero; against an idle player it took all three objectives in about 1.5 minutes.

## Satellite copy (`index.html`, formerly `bridgehead satalite map.html`)

- **Name and logo:** the page title, the scenario card and the New game and end sheets say COMPANY and show the logo from `COMPANY.svg`. It's embedded once as an inline `<symbol id="logo">` (cropped to `viewBox="90 176 730 220"`, white background dropped; the wordmark's fill is `var(--logo-ink)`, so it turns white in Dark) and drawn with `<svg class="logo"><use href="#logo"/></svg>`. `bridgehead.html` still says BRIDGEHEAD.
- An experimental copy of `bridgehead.html` (made Oct 12, 2026) that adds a generated satellite style for the terrain. `bridgehead.html` itself is unchanged and still paper-only. Port changes between the two by hand until they're merged.
- Settings has a **Map view** switch, *Satellite | Strategic*, also on key `Y` (`setView`). `T` opens the multiplayer chat (see **Multiplayer**). It sets `settings.style` to `'satellite'` (default) or `'paper'`; Strategic is the original `bridgehead.html` printed map. `renderTerrain()` calls `renderSatellite()` or `renderPaper()`, and only the drawing changes, never the battle.
- **Supply differs from `bridgehead.html` here:**
  - It follows the army. A side's supply reaches its own half of the battlefield (by `M.side`), and on the enemy's half only ground it has taken (`G.claim[s]`, kept up by `updateClaim` each supply tick).
  - Taking ground: each unit floods out over land it could walk to (bridges and pontoons count, open water doesn't) up to `SUPPLY.claim` (140 px). A cell becomes the side's when one of its units is nearer than any enemy unit it can see, and goes back when a visible enemy unit is nearer than any of its own.
  - Taken ground stays taken after the units move on, so the road behind an advance keeps carrying supply. A couple of units slipping across a bridge take only the ground around them, not the enemy's town. A unit that cuts far cross-country away from roads is out of supply, as it would be on its own half.
  - Only enemy units the side can currently see (`G.vis[s]`) hold ground against it in `enemyHeld`. An unseen enemy neither cuts supply nor shows up as a hole in the supply overlay, so the overlay can't reveal hidden positions; once spotted, it cuts supply as before.
- `renderSatellite()` is seeded from the map seed, so a map always renders the same, and takes about 0.3–0.5 s. Everything is sized in metres through `SAT_M(m)` (1 px = 2.5 m), and colours live in `SAT`.
  - Per pixel: farmland is 1 km regions (a jittered Voronoi grid), each cut along its own direction into strips, staggered rectangles or large fields, with tracks and hedges. Each parcel is crop or grass outright, weighted by the field mask. On top come forest canopy textured at crown size, rock with tripled relief shading and scrub, and town ground with gardens. All land gets hill shading lit from the north-west. The river has tree-lined banks and gravel bars on wide stretches; lakes are darker open water. A final grade lowers saturation slightly.
  - Streams are painted into the per-pixel pass like small rivers, not stroked on top: each stream's course wobbles a little and tapers from a thread at its source to about 12 m (20 m for dry beds) downstream, drawn into a mask canvas at the render resolution (green: bank edge, red: water, blue: deep middle). Banks get a faint damp edge plus broken clumps of brush (bare shrubs on snow); water uses the river's palette, deeper in the middle; frozen streams are blue-grey ice, darker down the middle with snow drifting in; dry climates get a mottled gravel wash with scrub. The paper view still draws streams as blue lines.
  - Vector layers on top: buildings from `satBuildings()` along every street, typed by district (terraced red-roofed core, apartment slabs, industrial estate, village houses), each with a south-east shadow and pitched or flat roofs; then streets, roads and highways in asphalt at their real widths, and bridge decks.
- The dynamic layer adapts: fallen bridges are filled with `M.satWater`, the cratered-road gap shows the climate's broken ground (`M.satRubble`), and unit outlines are 2 px.
- **Line of control** (toolbar button or `L`, `settings.front`): a display-only front line from the player's point of view. `updateFront()` keeps `G.ctrl` (1 = held by the player), starting with each side holding its own half. Every 0.5 s of game time it changes hands with the same flood rule as taken ground (`updateClaim(..., all=true)`, over both halves, visible enemies only). Open water takes the owner of the bank on its own side.
  - It persists, so salients, pockets and encircled units show as closed loops.
  - In the two-line style, held ground that's close together joins up for display (`frontShape`): a morphological closing of `ctrlP` and `ctrlE` by `FRONT_CLOSE` (16 cells, with exact round distances from `edt2`, Felzenszwalb's two-pass transform; the 4-connected `gridDist` made diamonds and teardrops) fills any neutral gap under about 250 px wide that has the same side's ground on both sides, unless the other side holds it, and then any neutral pocket bordered by only one side's ground is filled with it (`fillHoles`). So a bridgehead or units across the river join their own side's line as one shape instead of floating loops, bays or rings around holes.
  - On frozen water a unit's claim flood (`updateClaim`, shared with supply's taken ground) can go out onto river ice but not up the far bank unless the unit itself is on that side. Bridges and pontoons still carry claims across.

  - During deployment the line is rebuilt from scratch twice a second and snapped (`frontShape(true)`) from the frame loop, so it shows where units stand as they're placed; in play it updates every 0.5 s of game time as before.
  - **Style** (Settings, `settings.frontStyle`): `'one'` is the single shared line above. `'two'` (the default) keeps `G.ctrlP` (held by the player) and `G.ctrlE` (held by the enemy, as the player knows it). The defender's starts as its half minus a band `FRONT_GAP` (110 px) deep from the river bank (or the front line on a dry map); the attacker's starts at the defender's deployment limit (`ry + ZONE`) when the scenario has a deployment, since the defender may stand anywhere north of it (otherwise also `FRONT_GAP` back); that band and the river are no-man's land. The same flood (`updateClaim(..., ex=[P, E])`) moves cells between them, and cells nobody has reached stay neutral. Water counts as held only when one side holds both banks. Each side's line is drawn in its own colour just inside its ground, with enemy ground tinted and no-man's land a faint grey.
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
  - **Company Command** (`CC`): units are bought and built at the depots, and victory points decide it. See **Company Command** below.
  - Fields: `limit` (replaces `TIME_LIMIT`, stored in `G.limit`), `need`, `holdA`, `forces`, `air`, `reinf` (`reinforce()`, `addUnit()`), `counter`, `neutral`, `deploy`, `trenches`, `night`, `vision`, `noAir`. Start positions are set in `scenarioSetup()`, and the panel shows the player's goal, the A hold timer and the next reinforcements.
- **Game codes:** `encodeGame` / `decodeGame` pack scenario, battlefield, climate, side, strength, difficulty and seed as `SC-MODE-CLIMATE-{side}{strength}{difficulty}-SEED36`, for example `LS-LN-WI-DHH-15RA-V2`. The optional last part `-V2` or `-V3` names the map generator; a code without it (every code made before V2 existed) decodes with `gen2:0` and keeps its legacy map. `gen2` is a version number (0 legacy, 2, 3); `genV(g)` reads old values (`true` = 2).
  - The setup screen shows the code, copies a link, and accepts a pasted code.
  - The page address is never written. A page opened with `#game=CODE` (or an older `?game=CODE` link) starts from those options (`gameCode()`), and changing just the `#game=` part in the address bar opens New game with that code, without a reload (`hashchange`). **Copy Game URL** (New game, beside the code; and on the end screen, for the finished game's settings) copies `…#game=CODE` (`gameURL`, `copyText`, which falls back to the textarea method if the clipboard API refuses or doesn't answer within 0.7 s).
  - A link to a local file only works on the same machine; share the code itself instead.

- **Replay (satellite copy):** the end screen has **Watch replay**.
  - Recording: `recInit` / `recScan` / `recFrame` keep `G.rec`. A snapshot every `REC_DT` (0.5 s) holds unit ids, positions, health, flags and firing targets, objectives, pontoons, bridge health and air strikes left. Timestamped lists hold shell launches, impacts, air strikes, the full log, road-damage keyframes, bridges falling and timeline events (captures, air, bridges, pontoons, reinforcements). A defender game restarts the recording when the battle begins. About 0.6 MB for a full game.
  - Playback: `startReplay` swaps `G` for a view object (`RP.RV`, `replay: true`, `phase: 'over'`, so no fog and no orders) that `replayView(t)` fills from the recording, so the normal `draw()` and `updateHUD()` show it. Units are interpolated between snapshots, and firing flickers along recorded shooter→target pairs. `exitReplay` restores the real `G` and the end screen; starting a new game also ends a replay.
  - Controls: a replay bar replaces the command dock, with restart, ±15 s, play/pause, speed 1–16×, time, and a timeline canvas (`buildTimeline`) showing each side's strength, three rounded bands for who held each objective (orange while contested), and event markers. The timeline redraws itself whenever its on-screen width differs from the width it was drawn at (`drawTimelineHead`); `startReplay` un-hides the HUD before measuring it. Click or drag the timeline to seek; clicking a marker jumps to 3 s before it. Keys: Space, `,` / `.`, `[` / `]`, Home, Esc. Pan and zoom work as usual.

- **Shared replays (for reviewing the AI):**
  - Download a replay from the end screen (button beside Watch Replay), the replay bar (download icon) or, mid-battle, Settings → Replays → Download. Settings → Open… and the New game header's **Open Replay…** load one back (`openReplayFile` → `loadReplay`: the map is rebuilt with `makeMap(seed, mode, gen2)` from the saved options, trenches restored, then `startReplay`; Exit Replay returns to New game).
  - The file is `company-replay-<code>-<date>.json.gz` (gzipped JSON, plain `.json` if the browser can't compress): `{format:'company-replay', version:1, code, opts, over, time, plan, trenches, names:{objs, bridges}, rec:{frames, meta, booms, shells, strikes, log, dmg, downs, events, ai}}` (`replayData`). Typed arrays are saved as plain arrays; `meta` entries are `[id, side, type, max, died]` with −1 for alive. A full game is roughly 100–200 KB.
  - **`rec.ai`** is the computer's reasoning, one entry per AI turn (2 s, `recAI` after the AI runs): `def` (reserve mode, focus objective `ti`, threat per objective, from `G.dai`), `att` (plan name and each group as `[i, axis, stance, state, objective order, alive, size]`), and `units`: only the computer's units whose orders changed, as `[id, role, group, mode, goal, retake, sector, falling, dest x, dest y, target id, hp %]`.
  - **How the user shares one:** drop the file into `replays/` in the project (git-ignored, so it stays out of the public repo) and say which moment looks wrong.
  - **Reading one:** `node tools/replay.mjs replays/<file>` prints the overview, events and the computer's decisions over time; `--from m:ss --to m:ss` narrows it, `--at m:ss` lists every unit at that moment (position, nearest objective, health, supply, firing at whom), `--unit <id>` follows one unit's orders. To see it, open the file in the game.
- **HUD (satellite copy):** rebuilt from the design handoff in `company-hud/` (`HANDOFF.md`, `tokens.css`, mockups in `screens/`; direction A, light and floating, is the default). A DOM overlay on the full-screen canvas; the engine never touches it.
  - Look: Inter for all HUD text, tabular figures for numbers; frosted glass (`.gl`: `backdrop-filter: blur(30px) saturate(180%)`), capsule buttons, segmented controls, inset grouped lists. Colours are tokens on `:root`, swapped by `data-appearance` (`light` | `dark`) on `<html>`. The canvas still draws map labels with `--display`, `--body` and `--mono` (the old fonts), and the side colours are unchanged; on dark glass, attacker icons get a white edge and attacker rings turn light (`--atk-ring`).
  - Floating layout (`data-layout="floating"`): scenario card top left (logo, Attacking/Defending badge, goal, scenario · battlefield · climate · game code), status capsule top center (clock, objectives A/B/C as rings, next reinforcements or the A hold timer), controls top right (pause, speed, settings, controls, hide interface, new game). Below the card, a rail of round buttons (Selection, Forces, Modifiers) that stays visible; each toggles its own separate card in a column beside the rail (`#railRow`, `#cards`: `#inspector` for the selection, `#forcesCard`, `#modsGame`; `toggleCard`). The active button turns blue. Each card has a 15 px title and a 30 px round close button (`.cardX`; the selection card's is a chevron). If all three are open the column scrolls. **Dragging:** in Floating on screens 600 px and wider, a card (`#cards>*`) can be dragged by its header (`.selHd` / `.modsHd`) anywhere on screen (`placeCard`, `.moved` = `position:fixed`); its place is saved in `ui.cardPos` and kept when it's closed and reopened, at least 60 px stays on screen, and double-clicking the header puts it back beside the rail. Docked and phones ignore it. The map legend is in the Controls popover (`?`), under the controls, laid out in four columns. Bottom right: select by type with the supply and line-of-control toggles, then the order tools (or, while deploying, Dig Trench, the trench budget, Undo and Begin Battle). Event log bottom left as white text on the map, newest at the bottom: a four-line window that scrolls (wheel or touch) back through the last 40 events, fades older lines toward its top (full strength while hovered), and jumps back to the newest whenever a new event comes in (`lastLogNew`). The same message repeated within 2 s (several units cut off at once) shows once with a count (×3).
  - Docked layout (`data-layout="docked"`): `applyLayout()` moves the same pieces into a flush top bar, a left outliner (`#sideL`: objectives, goal, forces) and a right inspector (`#sideR`: selection), with one command dock along the bottom.
  - Objective rings (`ring()`): owner colour, filled as far as the owner's hold (`takeFrac`); orange arc while contested, with the taker's progress as a percentage once it is above 0; dotted grey when neutral. The map draws the same ring for each objective in `draw()` (no background: a light track, a soft shadow and a white halo on the Inter letter keep it readable), with its name below in Inter, inside the dashed capture circle. Clicking an objective pans the map to it. Callouts (`updateCallouts`, `placeCallouts`) that pointed at an objective being taken are commented out, along with their calls in `updateHUD`, `frame` and the `#callouts` click handler; the markup and CSS are still there. (Their "% taken" read 0% at the start of a capture.)
  - Collapsing: clicking the scenario card shrinks it to a logo pill; clicking the clock shrinks the status and the controls together (the controls then show pause, speed and a More menu); the chevron at the end of the order tools hides their labels and shrinks the select bar to a pill; the inspector's chevron closes it to the rail; clicking the event log shows only the newest line. The selection card opens by itself when you select units unless you closed it (`ui.panel`: `auto` | `open` | `closed` | `folded`). A new battle starts with it `folded`: selecting units doesn't open it until you open it from the rail button (or the docked inspector button); after that it behaves as before, and closing it lasts until the selection is cleared; Forces and Modifiers are `ui.forces` and `ui.modsG`.
  - Preferences (`ui`): layout, appearance (Light, Dark, Auto follows the system), collapsed panels and open sections, saved to `localStorage` key `company.ui` when the browser allows it.
  - Keys added: `U` hides or shows the whole interface, `?` opens Controls, Esc closes a popover first. Double-clicking a unit selects every unit of its type. Tooltips (`data-tip`, `data-key`) show a label and its key for mouse users; key hints are hidden on touch-only devices.
  - Order tools are disabled when they can't be used: Move and Hold need a selection, Fire needs artillery, Pontoon and Repair need engineers, Air strike needs strikes left. Pause and speed are disabled while deploying. Settings, Controls and More are popovers and don't pause the game; the New game sheet does.
  - **Game modifiers** (`#mods`, `setupMods(opts)`, `renderMods`, refreshed from `syncCode` and `showStart`): a small panel (250 px) at the top right of the New game screen listing only what the chosen setup changes from a standard game (Standard Battle, River Town, Temperate, Normal, standard defense), from the player's side. One line each: a coloured icon inline (`MODIC`, no tile), what changes, and the value; the reason is in the row's tooltip. Possible rows: time limit, what wins, your and the enemy's force as changes against the standard one (from `forceFor(side, base, o)`, which takes an optional setup so it matches what spawns), air strikes (only if not 2 each, or none; `airFor(side, o)`), vision, off-road movement, frozen water, no river / lake (no pontoons) / rock ridges, no trenches, the trench budget (always shown to a defender who deploys, coloured only when it differs from the standard 2.0 km), no deployment, counterattack or neutral starts, each reinforcement wave, and difficulty (only if not Normal). A standard game shows "None: standard rules". Its header collapses it to a pill (`ui.compact.mods`). It's the same floating glass card, 16 px from the corner, in both layouts (a flush docked version was tried and dropped); in Docked, the New game sidebar (Show Map) still runs flush down the left edge. The centered sheet moves left to make room at 1210 px and wider; below that the panel shows only with the map shown; it's hidden on phones. With the map shown, the zoom buttons sit above the Satellite / Strategic switch at the bottom right. **In a battle** the same card opens from the third rail button (`#railMods`, sliders icon) as one of the cards beside the rail: `#modsGame` lists the running battle's modifiers (`gameMods()`, `setupMods(gameSetup())`, cached on `G._mods`; rows from the shared `modsRows`). Its close button or Esc closes it, and a new battle starts with it closed. In Docked the left outliner has a collapsible Modifiers section instead (`#secMods`, `ui.sec.mods`).
  - New game sheet (`#startModal`): scenario list with descriptions, battlefield tiles, climate, side, difficulty, defense strength, seed and game code (still editable, so a friend's code can be pasted). Show Map turns it into a sidebar with the map live behind it (pan, zoom buttons, Satellite / Strategic). End sheet (`showEnd`): result icon and title, reason, final objective rings, battle time and losses, a summary list, the enemy's plan with a one-line description (`DOCTRINE_DESC`, defender games), and Watch Replay, New Map, Play Again.
  - Responsive: under 1360 px the status shows rings without names; under 1024 px the order tools are icon-only; under 600 px (phones) the top capsules are compact, the scenario card opens from an info button, each card is a bottom sheet and only one is open at a time (opening one closes the others, and a selection doesn't pop the Selection sheet over another), and the command rows run full width and scroll sideways.
  - The canvas scale bar is drawn white just above the command dock (`scaleAnchor`, `drawScale`).
  - Not settled yet (from `company-hud/screens/Open-Questions.dc.html`): the U key, the Appearance setting and the touch gestures are the designer's proposals; the Dark and Docked looks other than the ones mocked up, and the paper map under the glass, haven't been reviewed by eye.

## Target stack (for the next step: modules and TypeScript)

The files above already follow this layout as classic scripts; moving to Vite and TS turns them into modules with explicit imports.


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

## Map generation v2 (`genMap2`, `index.html` only)

- **Why:** the legacy generator (`genMap`, below) always builds the same layout: one west–east river through the middle third, the town on the north bank at a central main bridge, a dominant hill north of it, one flank bridge per side, depots on the one north–south highway, and a forest pulled to a fixed spot west of the bridge. A, B and C always formed a column in the centre.
- **The switch:** New game has a **New map generation** switch (`#optGen`, `opts.gen2`, on by default). `makeMap(seed, mode, gen2)` picks the generator; `preview`, `newGame` (its "fresh" check includes the generator), Back to game and Play Again all use it, and `G.gen2` / `M.gen2` record it. Off was the legacy generator (it is now V2; see **Map generation V3**), which is byte-for-byte unchanged (checked against fingerprints of 180 maps and 12 terrain renders with the scenery ring). The Modifiers panel shows "Map generation · Legacy" when it's off, and the end sheet's Battlefield row says "legacy map".
- **Same battle, new ground:** attacker south, defender north, three objectives; A on the front line, B and C behind it. `genMap2` produces the same `M` contract as `genMap` (grids, `ry`/`rw`/`water`/`side`, `objs`, `depA`/`depD`, `viaW`/`viaE`, `spans`, `bridges`, roads, streets, streams, contours, `D`, `rp*`, `gen`), plus `M.lakes` (cell mask of water away from the river), `M.vias` (all other crossings, nearest to A first) and `M.gen.v2` (height, lake, forest and field functions for the scenery ring).
- **Themes:** each battlefield keeps its rules (`forces`, `budget`, `vision`, `air`, `doctrines`) and gains a `v2` block of ranges each seed rolls from: noise scale, river width and widenings, `bigLake` (Lake Narrows), `city` (City Fight), lakes, crossings, towns, villages, streams, hills, escarpment chance, `massif` and `rockH` (Mountain Pass), forest and field shares, lateral-road chance.
- **Steps, all per seed:**
  - Front line: a river course walked west to east from 1,200 px past each border (so the scenery ring carries it on), sampled every 10 px (`RV`). Its heading is the sum of meanders (part a swinging rhythm, part noise, so bends vary in size and spacing; their strength varies along the course), slow sweeps from low-frequency noise that carry it far north or south, a little jitter, and a pull toward a target line (which may tilt) that grows with the square of the distance, so it turns back in a bend instead of running flat. The heading never exceeds about 55° from east, so the line stays one-valued. Each map rolls a profile: calm, meandering, wild, mixed (straight reaches between meandering ones) or swinging. Two smoothing passes, then the part on the battlefield is fitted into 26–72% of the height (scaled down only if it spans more than 46%).
  - Width: varies along the course (0.62–1.38 of the theme width), plus widenings; Lake Narrows gets one huge widening anywhere. `RWF` is the north–south thickness: the width across the flow times `sqrt(1 + slope²)` (capped at 1.6), so steep reaches look as wide as flat ones.
  - Compared with the first version over 200 River Town seeds, the river's north–south span on the battlefield went from 100 / 206 / 279 px to 126 / 243 / 436 px (10th / 50th / 90th percentile), and the steepest reach from 0.81 to 0.98 at the 90th percentile.
  - 0–3 lakes and ponds away from the river (ragged shores; in `cls` as WATER, in `M.water`, roads go round; frozen in Winter like the river).
  - Height: noise at the map's own scale, a valley toward the river, hills anywhere, sometimes an escarpment that gives one side the high ground, rock massifs at any angle with a pass cut through each (Mountain Pass). Streams as in the legacy generator.
  - Settlements: the main town on the river (straddling it, with its own bridge), near it or inland on either side; 0–2 more towns; sometimes an industrial works (`kind:'industrial'`, drawn as an industrial estate); farms; villages.
  - Crossings: 1–5 bridges at narrower reaches, unevenly spread (the town's bridge and Lake Narrows' causeway first). Depots anywhere along the top and bottom edges, where the units' start area (about 300 × 260 px) is clear of lakes; arterial highways from each depot (through the main town if it's on that side) to a main bridge; sometimes a second arterial and a lateral highway; every bridge end joined to the network; villages linked; edge entries; farm tracks. Dry maps get edge-to-edge arterials and a lateral road along the front line (its crossings with other roads are the crossroads candidates).
  - Land use: forests from noise, slope and 2–5 random attractors; fields around settlements and in random farm regions; shares rolled from the theme.
  - Objectives: A is one of the front-line crossings (weighted to highways and causeways). B and C pick a kind first, then a feature of that kind behind the line (town, village, station, works, farm, crossroads, hill/"Point"/"Heights", ridge, wood), at least 230–260 px apart, so they spread across the width.
- **Self-check:** each map checks three objectives, room behind B and C, a span on a river map, depots near roads with land in front, and that infantry and armor reach every objective from both depots (flood over passable cells). A failing map rolls again with the next sub-seed (up to 6), so a seed always gives the same map.
- **Elsewhere:** `innerDom` and the scenery ring carry `lakes`; `paperRender` fills them in the river colour and `satRender` draws them (deeper toward the middle, ice when frozen); `genOuter` uses `M.gen.v2` for height, land use, river and lakes past the border (the legacy branch is unchanged); `satBuildings` honours a district's `kind`; `planAttack` builds flank axes from `M.vias` when present.
- **Checked:** 1,800 maps (300 seeds × 6 battlefields) pass every invariant, about 1.1 tries each; the game's own flow fields reach every objective from both depots on 240 of them. Objective A, B, C and the main town land across the whole width; 1–5 bridges by theme. A small computer-vs-computer batch (12 full games, all six themes, both AIs on, headless) ran without errors: every game finished, the attacker reached A in all of them and won 5 of 12 (3 of 6 in a legacy reference batch), and units only jammed briefly in crowds. Battlefield tiles show a `desc2` description while the switch is on.

## Map generation V3 (`genMap2(seed, mode, 3)`, codes ending `-V3`)

Added Oct 30, 2026, when the user asked for seeds to change maps more while still making sense. It's the V2 generator with extra rolls, each behind `V3` in `genMap2Try`, and its own seed salt (+50411). **V2 and legacy codes keep their maps:** the fingerprint test (24 maps over 6 battlefields, terrain renders, seven seeded battles) came out identical. New games use V3. At the user's request the **New map generation** switch now flips between V3 (on) and V2 (off, "the old map generation"); the legacy generator is reached only through a pasted code with no `-V` suffix. V2 shows in Modifiers as "Map generation · Old" and on the end sheet as "old map"; legacy as "Legacy" / "legacy map".
- **Landscape character** (`LOOKS`, weighted per battlefield by `LOOK_W`), rolled first. Each scales the noise, forest and field shares and the hills:
  - open farmland (big fields, few woods, flatter);
  - copses (many smaller woods among fields; key `bocage`);
  - forested (extra forest attractors);
  - wetland (more and smaller lakes, flatter);
  - highland (deeper valley, more and bigger hills);
  - plateau (always an escarpment).
- **River:** meander, wild, mixed, swing, and a new `oxbow` profile (big slow loops). V3 never draws the near-straight `calm` profile. The river sits anywhere in 32–64% of the height (fitted into 20–78%), and its width varies more (× 0.6–1.45).
- **Settlements** (`townPlan`): one main town, twin towns on opposite banks, or scattered villages with no big town. City Fight always has one. On a river map the main town is on the river or near it four times in five.
- **Woods:** patches under 60 cells are dropped (V2: 24), so there are no specks of forest.
- **Roads:** lateral highway chance and edge entries vary per map.
- **Objectives:** none within 170 px of the east or west edge. A sometimes weighs every crossing equally (not just highways); B and C sit 260–520 px apart.
- `M.look = {character, name, towns, river}`. The landscape's name shows in the scenario card's meta line and the end sheet's Battlefield row.
- **Checked** (240 maps, 6 battlefields × 40 seeds, after the review fixes): every map passes the V2 self-check, at 1.43 tries each (V2: 1.1). River north–south span 10/50/90%: 145 / 282 / 490 px (V2: 114 / 248 / 468); B–C spread 395 / 698 / 1134 px (V2: 321 / 544 / 1000). Towns: one 142, twin 69, scattered 29.
- **Tried and removed** after the user's review ("it sucks"):
  - a tributary, a side river drawn as a lake, which looked like a stripe of lake across the fields;
  - a dead-straight `canal` river profile;
  - a `remote` town plan that put the main town deep behind a front, where it wasn't an objective;
  - a bocage hedgerow grid, which never showed.
- Note: temperate water in the satellite view is one of three palettes by seed (`K.water`: muddy brown, grey-green, blue-grey), on every generator.

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
  - Low supply cuts output, down to 60% with empty stocks (see Supply).
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
  - **Supply efficiency** (rewritten Oct 30, 2026, at the user's request; it used to be in or out). `G.cov[s]` is each cell's efficiency, 0–100 in steps of 5: 100 minus the least loss of any route from the depot. A truthy `cov[i]` still means some supply.
    - The route search is a Dijkstra (`Heap`) over two layers: the road network (intact road cells; loss `SUPPLY.road` per 8 px cell: .03 highway and bridge, .08 road, .12 pontoon) and cross-country (`SUPPLY.field` by terrain: open .8, field .9, forest 1.3, town .6, stream and ice 1.6, rock 2.5; cratered road `crater` 2).
    - Leaving the roads is free; getting back onto them costs `SUPPLY.rejoin` (25), so a crater or a stretch of road the enemy holds forces a costly detour instead of cutting supply. Within `SUPPLY.depot` (240 px) of the depot there's no loss.
    - Impassable: enemy-held cells, open water (bridges, pontoons and ice excepted) and the enemy's half beyond taken ground. So an encircled unit or a far bank whose crossings are down gets 0; a gap in the ring brings supply back.
    - Pontoons are road cells, so they need no special case (the old `SUPPLY.link` / `major` / `minor` coverage is gone). `G.sup[s]` marks the road cells the road layer reaches.
    - Measured on one map: 95% within 80 px of a supplied road, 85% at 80–160 px, 80% beyond; cratering every road across the attacker's half dropped supply beyond from 99% to 73% on average (25% at worst), back to 99% once repaired. About 6 ms per side; the tick does one side every 0.5 s (`G.supSide`).
  - **Stocks** (`u.sp`, 0–1): each step they move toward the route's efficiency at the unit (`u.supR`) by up to `SUPPLY.fill` (1/20) a second up and `SUPPLY.drain` (1/120) down, so supply lasts after a cut. During deployment they equal the route.
    - `supF(u)` = `sp / SUPPLY.ok` capped at 1 (`ok` .6). Below it the out-of-supply penalties grow linearly to: move ×.8, fire ×.6, artillery reload ×2.2, pontoon and repair work ×.6. A unit cut off entirely fights at full strength for about 48 s and is at the full penalties by 2:00.
    - `u.sup` = `supF(u) >= 1` (dashed red outline, replay and multiplayer flag bit 1).
    - "… is cut off from supply" is logged when a unit's route drops to 0.
  - Healing: 10 s after the last hit, `SUPPLY.heal` (1.5 HP/s) × stocks, so better supply heals faster (none at 0).
  - Showing it: `1` shows a heat map (`supHeat`, `SUP_RAMP` in `draw.js`; the user found the old one-colour tint confusing): green at full supply, yellow at `ok` where penalties begin, orange, red; deep red on your own ground with none (a pocket, or ground the enemy holds); nothing on the enemy's half you haven't taken. The image is rebuilt only when the supply map changes (`covCv._src`). A key (`drawSupKey`, "Supply 0% … 100%" with a tick at `ok`) sits left of the scale bar. The selection card's Supply row shows average stocks (green from 60%, orange from 30%, red below), "· n cut off", and the route and trend in its tooltip.
  - Company Command territory income weighs each cell by its efficiency. Multiplayer frames carry stocks in flag bits 10–13 (16ths; `MP.proto` 7), and the guest reads the route from the `cov` it is sent.
  - **Wounds** (`WOUND`, added Oct 30, 2026, at the user's request): a unit knocked below `WOUND.at` (25%) of its health is wounded (`u.wounded`, set in `hit`) for the rest of the battle and heals back only to `WOUND.cap` (50%); `hpTop(u)` is the most it can heal to. Its health bar shows the part it can't get back in grey after a white gap, and the selection card counts the wounded. The computer's hurt units (`falling`) return once healed to 75–80% of `hpTop`, not of full health, or a wounded unit would wait forever. Multiplayer frames carry it as flag bit 512 (`MP.proto` 6) and replay frames as `fl` bit 8.
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
  - Line infantry hold their trench posts. Posts on the far bank are given up for the near bank when visible attackers outnumber the local defenders 2.5 to 1 (and are at least 3 strong). When an objective is under attack and has fewer than 4 line units, up to two shift to it from the quietest objective, which keeps at least two. Hurt line units that aren't fighting pull back to heal. **Retaking:** when an objective isn't held by the defender, the line units within 620 px go to win it back (`u.retake`) if their strength is at least 1.15× the attackers seen near it in the last 20 s (or 1.5 when none have been seen): its own sector's units first, then units from objectives with no threat that keep at least two. Up to five go, on attack-move to the objective; they return to their posts once it's held again, and break off if the attackers there turn out more than 1.4× stronger. With the reserve tied up at another objective and one attacker holding B, 6 of 6 test games retook B (about 46–67 s), against 4 of 6 before (67–74 s).
  - Artillery fires missions on remembered attackers near the threatened objective. After 40 s with nothing in range it moves up behind that objective, clear of the reserve and away from known attackers.
  - The engineer repairs cratered road.
- **`aiAttacker`** (the player defends) follows a plan from `planAttack()`, built at game start. It draws one doctrine at random, with random flank sides, group sizes, timings and objective order; the end screen shows which one.
  - The battlefield limits which doctrines can be drawn (`doctrines`), and the surprise crossing is never drawn on a dry map. If its pontoon site is destroyed or every attacker engineer is lost before the pontoon is done, the waiting group switches to a flank (it used to wait all game).
  - Doctrines: broad front (all three crossings at once); feint, then main thrust; flank hook (a pinning group at the main bridge, the main body through a flank); bombard, then assault (two late waves); surprise river crossing (engineers bridge a gap far from the bridges while the main body waits); probe and exploit (three small probes, with the reserve committed behind the one that gets furthest).
  - Groups gather 240 px back from the river, each unit in its formation slot, and move off once 70% of their units are there and not hurt, or after a minute (two after a broken wave). An assault's first wave also waits until the guns have shelled its objective for about 25 s (`g.prep`), or a minute past its start at most. Once the attacker firmly holds an objective nearer an assault's next one, the assault regroups and heals there instead of back at its start line, and units already across skip their crossing on the way out.
  - **Staying out of reach** (`aiSafe`, learned from a Last Stand replay where the player dug in about 200 px south of bridge A and the pin group, the engineers and all three guns were sent onto those trenches): assembly areas (`g.at`), pin lines (`g.pinAt`), gun positions and the engineers' waiting spot are moved south toward the depot, 30 px at a time, until no remembered enemy (guns aside) has them within its range plus a margin. Sightings are kept for this in `P.danger` for 3 minutes, because dug-in troops that hold fire are hard to spot again, unless friendly troops come within half their vision of the spot and find it empty. Distances use the enemy's real range (`rangeOf`, high ground included).
    - Trench lines count as suspected armor for the assembly areas and pin lines (`P.dug`): earthworks are visible even when the troops in them aren't. A stretch stops counting once friendly troops have seen it and found no one in it. Trench suspects don't decide whether a unit is under fire, and they don't place the guns, which have to stay in range of their objective.
    - Learned from a second Last Stand replay (Deep Woods, player defending, trenches south of bridge A and around the north end of the flank bridge), where the attacker lost 13 of 18 combat units in the first 80 s.
  - Stances: `assault`, `probe` (falls back to `pin` if halved), `pin` (holds the south bank opposite its crossing in formation, just out of reach of any defenders found there, then joins the assault; a pin unit under fire from known defenders withdraws to its slot on a plain move instead of standing to trade shots), and `reserve`.
  - A unit inside an objective it hasn't taken holds on while the capture runs. If the capture has been stuck for 20 s (`P.stall`; the defenders holding it are out of reach, as across a lake), it goes after the defenders known to be within the hold radius, or pushes through to the objective's far side.
  - Objectives with no ground to stand on inside the capture zone (a causeway objective once its causeway is down) are skipped. With nothing left to take, a group waits at its assembly area.
  - An assault whose units still fighting (alive and not falling back hurt) drop below `breakAt` of its strength breaks off, regroups and heals for 1–2 minutes, then goes again together. Counting the hurt ones as gone stops the old trickle where each tank healed alone and went back in by itself. Units under 30% HP fall back to heal and rejoin above 80% of what they can heal to (`hpTop`, see Wounds).
  - Artillery supports the biggest group on the move. It closes to about 300 px of that group's objective, but never ahead of that group's leading troops (100 px behind them), never within 90 px of the river on the far side, and never into reach of a remembered enemy. Before an assault goes, the guns already support it: they back the biggest assault on the move or within 30 s of its start, else the biggest group on the move. Once in place a gun fires on remembered defenders in range (`aiArtillery`). Otherwise it fires on trench lines within 200 px of the objective. Failing both, it fires on the objective area if that's in range (beyond any crossing there).
  - Units drop a crossing they can't reach (its bridge is down) and head straight for the objective.
- **Attacker engineers (`aiEngineer`):** build a pontoon 50–90 px beside any fallen bridge that has no attacker pontoon nearby, help finish an open one, repair cratered road (`aiRepair`, never a crater within reach of a remembered defender), or otherwise wait 300 px back from the main bridge (pushed back further if remembered enemies would reach it).
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
- Supply is rechecked during deployment (the sim isn't running then): after every `deployMove`, and twice a second from the frame loop, so the out-of-supply outline follows units as they're placed.
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
- **Camera:** `cam = {x, y, z}`, with `s2w` for screen-to-world conversion. The camera treats the battlefield and the scenery ring as one map (`EXT`: the ring's extent, 16 px inside its edge): panning and zooming work the same everywhere and stop only at that outer edge (`clampCam`), and zooming keeps the point under the cursor fixed. Zoom goes from `minZ` (0.7 of the battlefield's fit level, or higher if the screen's shape would otherwise show past the ring) to 4×. An earlier version used a zoom-dependent margin and snapped the view to the centre once it was wider than the battlefield, which made zooming jump; don't reintroduce either. Only the view is affected; orders still stop at the battlefield border.
- **Map style:**
  - white paper background
  - red roads with white casing (thick for highways)
  - blue water `#0b57f0`
  - forest `#0d7a2e`
  - fields `#f8c9a0`
  - trenches as brown zigzags
- **Unit symbols:** infantry circle, armor square, artillery triangle, engineer hexagon. The HUD fonts lack a hexagon glyph, so the HUD uses the inline SVG `HEX`.
  - **NATO symbols** (Settings → Unit symbols, *Simple | NATO*, `ui.symbols`, saved with the preferences; added Oct 30, 2026, at the user's request): APP-6 style. Your units get the friendly rectangle frame and the enemy's the hostile diamond (`framePath`), filled in the side's colour, with the branch in white (`natoIcon`): infantry a cross, armor an oval, artillery a dot, engineers a bridge. Selection rings and ghosts use the same frames. Holding shows as a bar above the frame, and the enemy's health bar sits below the diamond's point. The HUD icons follow (`uIco`, `NATO_I` in `hud.js`), diamond for the enemy's side.
  - A dashed red outline means low supply (stocks under `SUPPLY.ok`, penalties active).
  - A white bar means holding.
- **HUD:** see "HUD (satellite copy)" above. `bridgehead.html` still has the printed map-legend boxes.

## Controls

- **Mouse:**
  - Left-drag to box-select; click a unit to select it, with Shift to add.
  - Left-click the map gives the current order to the selected units. Right-click does too; right-drag pans.
  - Ctrl- or Cmd-click (left or right) is a straight-line move (satellite copy). `flowField(type, ti, true)` gives every passable cell the same cost, so the route ignores roads but still goes round water and other ground the unit can't cross. `descendDirect` then pulls it tight with `clearLeg`. The flag travels with the order (`u.direct`, a queued leg's `direct`), so Shift+Ctrl-click queues a straight leg. Straight-line order markers are dashed.
  - Shift-click (or Shift-right-click) the map queues a move after each unit's current orders (`queueOrder`, `u.queue`); a plain order replaces the queue. Each queued leg is routed only when the previous one ends, from where it ends, and keeps the formation. Queued legs draw as dashed arrows.
  - Selecting units that lack the current mode's unit type (engineers for pontoon and repair, artillery for a fire mission) drops the mode back to move (`selectionChanged`).
  - The wheel zooms.
- **Touch:** tap a unit to toggle it in the selection, tap the map to give the order, drag to pan, and pinch to zoom.
- **Keys:**
  - `Space` pauses.
  - `M` and `F` set the order mode to move and fire mission. `H` holds. The player's attack-move order (its button and `A`) was removed at the user's request (Oct 30, 2026); the AI still uses `amove` internally.
  - `P` is pontoon mode: select engineers and click the river.
  - `R` is road repair: select engineers and click cratered road.
  - `X` is air strike mode. It needs no selection, and a click within 40 px of a bridge or pontoon snaps to its middle. The mode returns to move after one strike, and strikes can't be undone.
  - In air strike mode, the strike's ring follows the mouse before you click (satellite copy; `hoverPt`, `airAim`). It snaps to a crossing it would hit, labelled `DESTROY …`, warns when your own units are inside it, turns grey with no strikes left, and isn't drawn past the map border.
  - `1` shows supply (the efficiency overlay), `A` selects all (it was `Q`), `Esc` clears the selection.
  - `S` splits the selection in half, as in Hearts of Iron (`splitSel`, `input.js`): it keeps half of each unit type (odd ones out go to the kept half until it's half the total), taking the units on the west or north side of the group, whichever way it's spread wider. Pressing it again halves it again.
  - `.` / `,` step the speed up and down (the `1`/`2`/`3` speed keys were removed at the user's request); the arrow keys pan.
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

- Ship a single HTML file with no `<html>`, `<head>` or `<body>` tags. Since the split, that means inlining `styles/` and `src/` back into one file in `index.html`'s order (each script's own `'use strict'` is fine inline).
- Scripts may load only from the cdnjs, jsdelivr or unpkg CDNs, and fonts only from Google Fonts.
- No `alert()`, `confirm()` or `prompt()`, and no `window.print()`.
- Don't depend on `localStorage`.

## Next steps (open)

1. Play-test and fix runtime bugs, then balance the DPS values, unit speeds and force sizes.
2. Move the split files (see **Files**) to the TS modules listed above, and first untangle the engine from the HUD (the list under **Files**).
3. Port the AI and supply changes from `index.html` back to `bridgehead.html`, or merge the two files.
4. Minefields for engineers.
5. A minimap; more battlefield types (for example twin rivers or a coastal landing).
6. Balance: in the 18-seed Node bench, a passive defender still loses every game (in about 6 minutes), and the defender AI playing defense wins about 3–5 of 18. That stand-in spreads its infantry thinly and never concentrates, so a person should do better. Re-measure before tuning further.
