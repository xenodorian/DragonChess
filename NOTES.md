# Project notes and handoff log

Goal: a single self-contained `index.html` Dragonchess game (PC and mobile, offline), with AI difficulty levels, published on GitHub Pages.

## Layout

- `index.html`: the deliverable. Built file, about 86 KB, no external requests. Do not edit by hand.
- `RULES.md`: rules as implemented, with sources and rulings on unclear points.
- `src/engine.js`: rules engine and AI search (browser, Web Worker and Node). Global `DC`.
- `src/ui.js`, `src/style.css`, `src/template.html`: interface.
- `src/sfx.js`: synthesised sound effects (Web Audio).
- `src/guide.json`: piece descriptions shown in the Guide dialog and info line.
- `src/icons.json`: piece icons from game-icons.net (CC BY 3.0, Lorc and Delapouite).
- `build.js`: `node build.js` inlines everything into `index.html`.
- `test/run.js`: `node test/run.js`. `test/fixtures.json` is generated from `test/cvp-diagrams.txt` by `test/parse-diagrams.js`.
- `.github/workflows/pages.yml`: runs tests and deploys `index.html` to GitHub Pages on each push to `main`.

## Done

- [x] Rules research from two sources (Wikipedia, Chess Variant Pages), reconciled in `RULES.md`.
- [x] Engine: all 15 pieces, three levels, Dragon remote capture, Basilisk freeze, promotion, check, checkmate, stalemate, repetition and move-count draws.
- [x] AI: iterative-deepening alpha-beta with quiescence, transposition table, killer and history ordering, in a Web Worker (falls back to the main thread if Workers are blocked).
- [x] Five difficulty levels: Novice, Easy, Medium, Hard, Expert (settings in `LEVELS` at the top of `src/ui.js`).
- [x] UI: three themed boards, move/capture/Dragon-fire highlights across levels, animations, sounds, undo, flip, two-player mode, move list, captured pieces, guide, autosave to localStorage, responsive layout.
- [x] Tests (154 checks, all pass): every move diagram on the Chess Variant Pages (29 scenarios, quiet moves, captures, remote captures on all 288 squares), starting position, special rules, random self-play consistency, AI sanity.
- [x] AI level check: in 6-game matches each level beat the one below it (6-0, 5-1, 6-0).
- [x] Browser checks in Chromium from `file://`, desktop 1440x900 and iPhone 13 emulation: 120-ply game against the AI, 400-ply two-player game, undo, flip, guide, reload restore. No page errors.

- [x] GitHub Pages live at https://xenodorian.github.io/DragonChess/ (deployed by the workflow; served file verified byte-identical to `index.html`).
- [x] Simulation mode: a "Simulation" button in the difficulty menu starts a bot-vs-bot game where each bot gets an independently random level (`cfg.simG`, `cfg.simS` in `src/ui.js`). Undo is disabled while watching.
- [x] Victory screen names both sides with bot difficulty, e.g. "Hard bot defeated novice bot", "Player defeated easy bot" (`overTitle` and `sideName` in `src/ui.js`). Verified in the browser for a full simulated game; the player-vs-bot wording uses the same code path but was not played to a finish.

## To do / not done

- [ ] Not tested on real devices or in Safari/Firefox. Only headless Chromium was available.
- [ ] Sound was not listened to (headless). `src/sfx.js` only passed a syntax check and ran without errors.
- [ ] Possible improvements: opening variety, mobility and king-safety terms in the evaluation, a hint button, a tilted 3D view, PWA manifest for install-to-home-screen.

## Difficulties and decisions

- The original Dragon #100 article was not read directly. Rules come from Wikipedia and Chess Variant Pages. Five rulings where they are unclear or disagree are listed in `RULES.md`, along with house rules for draws (the sources do not cover stalemate or repetition).
- Two CVP diagrams disagree with the CVP/Wikipedia text (Elemental rise marked as move-or-capture; King return square off by one rank). The text was followed. `test/run.js` overrides those two fixtures and says so.
- Session was configured for a `ccr-*` branch. Owner instruction is to push to `main` only, so `main` is used. The `ccr-*` branch on the remote is untouched and unused.
- On phones the three boards do not all fit on screen at a tappable size. Below 26 px per square the layout switches to width-fit squares and the page scrolls vertically.
- A 3D king can step to another level, so "obvious" 2D mates are often not mate. One hand-written test position was wrong for this reason and was corrected.
- GitHub Pages was not enabled on the repo and no API tool for enabling it was available. The workflow's `actions/configure-pages` step with `enablement: true` enabled it on the first run.
- Expert always uses its full 8 seconds. Hard usually answers in well under 3 seconds.
- Work split: three Haiku subagents wrote `src/sfx.js`, `src/guide.json` + `README.md`, and `test/parse-diagrams.js` + `test/fixtures.json`. Their output was validated (JSON parse, syntax check, fixtures cross-checked against the engine).
