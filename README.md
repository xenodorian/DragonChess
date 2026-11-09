# Dragonchess

Dragonchess is a single-file HTML5 version of Gary Gygax's Dragonchess (Dragon Magazine #100, August 1985). It includes a computer opponent with several difficulty levels, and it is playable offline on PC and mobile.

## Play

Play online at https://xenodorian.github.io/DragonChess/

Or download `index.html` from this repository and open it in any modern browser. No install or internet connection is needed.

## How to play

- The game uses three 12x8 boards stacked on top of each other: Sky (level 3, upper), Land (level 2, middle) and Underworld (level 1, lower).
- Each side starts with pieces on Sky, Land and Underworld. Gold moves first, and Scarlet moves second.
- The goal is to checkmate the enemy King. A King may not be left in check, and there is no castling.
- Dragon remote capture: the Dragon on Sky can capture an enemy piece on Land without moving.
- Basilisk freeze: a Basilisk on Underworld freezes the enemy piece directly above it on Land, so that piece cannot move until the Basilisk moves or is captured.
- Warrior promotion: a Warrior that reaches the far rank is promoted to a Hero.
- For the full rules, including piece movement and the rulings on unclear points, see [RULES.md](RULES.md).

## Development

- Source files are in `src/`.
- Run `node build.js` to regenerate `index.html`.
- Run `node test/run.js` to run the tests.

## Credits and licenses

- Game design by Gary Gygax.
- Rules references: Wikipedia, and The Chess Variant Pages (Edward Jackman, Hans Bodlaender).
- Piece icons from [game-icons.net](https://game-icons.net) by Lorc, Delapouite and contributors, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

This is an unofficial fan implementation. It is not affiliated with the Gygax estate, Wizards of the Coast, or Dragonchess Inc.
