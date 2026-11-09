# Project notes and handoff log

Goal: a single self-contained `index.html` Dragonchess game (PC and mobile, offline), with AI difficulty levels, published on GitHub Pages.

## Layout

- `RULES.md`: rules as implemented, with sources and rulings.
- `src/engine.js`: rules engine and AI search (runs in browser, Web Worker and Node).
- `src/ui.js`, `src/style.css`, `src/template.html`: interface.
- `src/icons.json`: piece icons (game-icons.net, CC BY 3.0).
- `build.js`: `node build.js` inlines everything into `index.html`.
- `test/`: Node tests (`node test/run.js`).

## Done

- [x] Rules research from two sources, reconciled in `RULES.md`.

## To do

- [ ] Engine
- [ ] AI
- [ ] UI and art
- [ ] Bundle to `index.html`
- [ ] Tests and browser checks
- [ ] GitHub Pages

## Difficulties and decisions

- The original Dragon #100 article was not read directly. Rules come from Wikipedia and Chess Variant Pages. See "Rulings" in `RULES.md`.
- Session was configured for a `ccr-*` branch. Owner instruction is to push to `main` only, so `main` is used.
